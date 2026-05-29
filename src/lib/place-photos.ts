// Fetch a representative photo for a place from Wikipedia / Wikimedia.
// Free, no API key, CORS-enabled (origin=*). Best coverage for parks,
// landmarks, attractions and scenic spots; thinner for small businesses.
// Results (including misses) are cached in-memory for the session so the same
// place name isn't looked up twice.

const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

export async function getPlacePhoto(query: string): Promise<string | null> {
  const q = query.trim();
  if (!q) return null;
  if (cache.has(q)) return cache.get(q) ?? null;
  const existing = inflight.get(q);
  if (existing) return existing;

  const p = fetchPhoto(q)
    .then((url) => {
      cache.set(q, url);
      return url;
    })
    .catch(() => {
      cache.set(q, null);
      return null;
    })
    .finally(() => {
      inflight.delete(q);
    });
  inflight.set(q, p);
  return p;
}

async function fetchPhoto(q: string): Promise<string | null> {
  return (await getPlaceInfo(q))?.photo ?? null;
}

export type PlaceInfo = {
  title: string;
  photo: string | null;
  extract: string | null;
  url: string | null;
};

// Unified shape returned by the /api/place-info route (Google Places when a key
// is configured, otherwise Wikipedia). Shared between the route and the hook.
export type PlacePhoto = { url: string; attribution: string | null };
export type PlaceDetails = {
  title: string;
  description: string | null;
  photos: PlacePhoto[];
  sourceUrl: string | null;
  source: 'google' | 'wikipedia' | null;
};

const infoCache = new Map<string, PlaceInfo | null>();
const infoInflight = new Map<string, Promise<PlaceInfo | null>>();

// Richer lookup for the stop detail card: best-matching article's lead image,
// a short intro extract, the page title, and a link back to Wikipedia.
export async function getPlaceInfo(query: string): Promise<PlaceInfo | null> {
  const q = query.trim();
  if (!q) return null;
  if (infoCache.has(q)) return infoCache.get(q) ?? null;
  const existing = infoInflight.get(q);
  if (existing) return existing;

  const p = fetchInfo(q)
    .then((info) => {
      infoCache.set(q, info);
      // Seed the photo cache too so the two lookups share one network call.
      cache.set(q, info?.photo ?? null);
      return info;
    })
    .catch(() => {
      infoCache.set(q, null);
      return null;
    })
    .finally(() => {
      infoInflight.delete(q);
    });
  infoInflight.set(q, p);
  return p;
}

async function fetchInfo(q: string): Promise<PlaceInfo | null> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: q,
    gsrlimit: '1',
    prop: 'pageimages|extracts|info',
    piprop: 'thumbnail',
    pithumbsize: '800',
    exintro: '1',
    explaintext: '1',
    exchars: '360',
    inprop: 'url',
    redirects: '1',
    origin: '*',
  });
  const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`);
  if (!res.ok) return null;
  const data = await res.json();
  const pages = data?.query?.pages as
    | Record<
        string,
        {
          title?: string;
          thumbnail?: { source?: string };
          extract?: string;
          fullurl?: string;
        }
      >
    | undefined;
  if (!pages) return null;
  const page = Object.values(pages)[0];
  if (!page?.title) return null;
  // Wikipedia's search always returns its single best fuzzy match, even when
  // nothing relevant exists — so a street address like "5561 Baja Drive" can
  // resolve to some unrelated article. Only trust the result if its title
  // actually shares a meaningful word with the query.
  if (!titleMatchesQuery(q, page.title)) return null;
  return {
    title: page.title,
    photo: page.thumbnail?.source ?? null,
    extract: page.extract?.trim() || null,
    url: page.fullurl ?? null,
  };
}

const STOP_WORDS = new Set([
  'the', 'of', 'and', 'at', 'in', 'on', 'de', 'la', 'el', 'los', 'las',
  'st', 'street', 'ave', 'avenue', 'rd', 'road', 'dr', 'drive', 'blvd',
  'boulevard', 'ln', 'lane', 'ct', 'court', 'way', 'pl', 'place', 'hwy',
  'highway', 'us', 'usa', 'united', 'states', 'suite', 'ste', 'apt', 'unit',
  'north', 'south', 'east', 'west', 'n', 's', 'e', 'w',
]);

// Significant lowercase word tokens: drop punctuation, pure numbers, very short
// words, and common address/filler words.
function significantTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t) && !STOP_WORDS.has(t));
}

// True if the article title shares a meaningful word with the query (exact, or
// a 4+ char prefix overlap to tolerate minor spelling/accent differences).
function titleMatchesQuery(query: string, title: string): boolean {
  const q = significantTokens(query);
  const t = significantTokens(title);
  if (q.length === 0 || t.length === 0) return false;
  return q.some((a) =>
    t.some(
      (b) =>
        a === b ||
        (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))),
    ),
  );
}
