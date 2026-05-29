import 'server-only';
import { NextResponse } from 'next/server';
import { getPlaceInfo } from '@/lib/place-photos';
import type { PlaceDetails, PlacePhoto } from '@/lib/place-photos';

// Photo + description for a stop's detail card. Prefers Google Places (real,
// current venue photos incl. restaurants) when GOOGLE_PLACES_API_KEY is set,
// and falls back to / enriches with Wikipedia/Wikimedia (free, no key). The
// Google key stays server-side; only the resolved public photo URLs are sent
// to the browser. Results are cached in-memory per server instance.

const cache = new Map<string, PlaceDetails>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!q) {
    return NextResponse.json(empty(''));
  }

  const cacheKey = `${q}|${lat ?? ''}|${lng ?? ''}`;
  const cached = cache.get(cacheKey);
  if (cached) return NextResponse.json(cached);

  let result: PlaceDetails | null = null;

  if (process.env.GOOGLE_PLACES_API_KEY) {
    try {
      result = await fromGoogle(q, lat, lng);
    } catch (err) {
      console.error('Google Places lookup failed', err);
    }
  }

  // Fall back to Wikipedia entirely, or fill in any gaps Google left (no photo
  // or no description — common for lesser-known places).
  if (!result || result.photos.length === 0 || !result.description) {
    const wiki = await getPlaceInfo(q).catch(() => null);
    if (wiki) {
      const wikiPhoto: PlacePhoto[] = wiki.photo
        ? [{ url: wiki.photo, attribution: 'Wikimedia Commons' }]
        : [];
      if (!result) {
        result = {
          title: wiki.title,
          description: wiki.extract,
          photos: wikiPhoto,
          sourceUrl: wiki.url,
          source: 'wikipedia',
        };
      } else {
        if (result.photos.length === 0) result.photos = wikiPhoto;
        if (!result.description) result.description = wiki.extract;
        if (!result.sourceUrl) result.sourceUrl = wiki.url;
      }
    }
  }

  if (!result) result = empty(q);
  cache.set(cacheKey, result);
  return NextResponse.json(result);
}

function empty(title: string): PlaceDetails {
  return { title, description: null, photos: [], sourceUrl: null, source: null };
}

type GooglePhoto = {
  name?: string;
  authorAttributions?: Array<{ displayName?: string }>;
};

async function fromGoogle(
  q: string,
  lat: string | null,
  lng: string | null,
): Promise<PlaceDetails | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY!;

  const body: Record<string, unknown> = { textQuery: q, maxResultCount: 1 };
  if (lat && lng) {
    body.locationBias = {
      circle: {
        center: { latitude: Number(lat), longitude: Number(lng) },
        radius: 3000.0,
      },
    };
  }

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask':
        'places.displayName,places.formattedAddress,places.photos,places.editorialSummary,places.googleMapsUri',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error('Places searchText error', res.status, await res.text().catch(() => ''));
    return null;
  }

  const data = await res.json();
  const place = data.places?.[0];
  if (!place) return null;

  const photos: GooglePhoto[] = (place.photos ?? []).slice(0, 4);
  const resolved = await Promise.all(photos.map((p) => resolvePhoto(p, key)));

  return {
    title: place.displayName?.text ?? q,
    description: place.editorialSummary?.text ?? null,
    photos: resolved.filter((p): p is PlacePhoto => p != null),
    sourceUrl: place.googleMapsUri ?? null,
    source: 'google',
  };
}

// Resolve a photo resource into a public image URL. `skipHttpRedirect=true`
// returns JSON with a `photoUri` (a googleusercontent URL) that the browser can
// load directly — so the API key never leaves the server.
async function resolvePhoto(
  photo: GooglePhoto,
  key: string,
): Promise<PlacePhoto | null> {
  if (!photo?.name) return null;
  const res = await fetch(
    `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=800&skipHttpRedirect=true`,
    { headers: { 'X-Goog-Api-Key': key } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.photoUri) return null;
  return {
    url: data.photoUri,
    attribution: photo.authorAttributions?.[0]?.displayName ?? null,
  };
}
