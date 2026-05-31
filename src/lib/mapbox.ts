// Helpers for the Mapbox Directions and Geocoding APIs.
// These are called from the browser using NEXT_PUBLIC_MAPBOX_TOKEN — Mapbox
// public tokens are designed to be exposed to the client. Restrict the token
// to your domain in the Mapbox dashboard for production.

export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

// One driving segment between two consecutive waypoints.
export type RouteLeg = {
  distance: number; // meters
  duration: number; // seconds
};

export type DirectionsResult = {
  geometry: GeoJSON.LineString;
  distance: number; // meters
  duration: number; // seconds (already calibrated, see DRIVE_TIME_CALIBRATION)
  // Per-segment distance/duration, one entry per pair of consecutive
  // waypoints (so coordinates.length - 1 entries).
  legs: RouteLeg[];
};

// Real-world calibration applied to the raw Mapbox drive time. Mapbox's figures
// tend to run high vs. what people actually experience (≈110% of Google Maps in
// spot checks), so we scale the duration to bring it in line. 1 = unchanged.
// Only the *time* is adjusted — distances are left exactly as returned, so gas
// and per-state pricing stay accurate. Tune this single number to taste.
export const DRIVE_TIME_CALIBRATION = 1.0;

type RawRoute = {
  geometry: GeoJSON.LineString;
  distance: number;
  duration: number;
  legs?: Array<{ distance: number; duration: number }>;
};

async function fetchRoute(
  profile: 'driving-traffic' | 'driving',
  coords: string,
): Promise<RawRoute | null> {
  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return (data.routes?.[0] as RawRoute) ?? null;
}

export async function getDirections(
  coordinates: Array<[number, number]>, // [lng, lat]
): Promise<DirectionsResult | null> {
  if (coordinates.length < 2) return null;
  // Mapbox accepts up to 25 coordinates per call.
  const coords = coordinates
    .slice(0, 25)
    .map(([lng, lat]) => `${lng},${lat}`)
    .join(';');

  // Prefer the traffic-aware profile for a more realistic ETA; fall back to the
  // plain driving profile if it returns nothing (e.g. an unsupported request).
  const route =
    (await fetchRoute('driving-traffic', coords)) ??
    (await fetchRoute('driving', coords));
  if (!route) return null;

  return {
    geometry: route.geometry,
    distance: route.distance,
    duration: route.duration * DRIVE_TIME_CALIBRATION,
    legs: (route.legs ?? []).map(
      (l): RouteLeg => ({
        distance: l.distance,
        duration: l.duration * DRIVE_TIME_CALIBRATION,
      }),
    ),
  };
}

export type GeocodeResult = {
  id: string;
  name: string;
  fullAddress: string;
  lng: number;
  lat: number;
  category?: string;
};

export async function geocode(
  query: string,
  proximity?: [number, number],
): Promise<GeocodeResult[]> {
  if (!query.trim()) return [];
  // Use the Search Box forward endpoint rather than Geocoding v6: it resolves
  // cities, addresses AND points of interest (e.g. "Garden of the Gods") in a
  // single call. The Geocoding v6 `forward` endpoint rejects a `poi` type with
  // a validation error, which previously made every lookup return nothing.
  const params = new URLSearchParams({
    q: query,
    access_token: MAPBOX_TOKEN,
    limit: '8',
  });
  if (proximity) params.set('proximity', `${proximity[0]},${proximity[1]}`);

  const res = await fetch(
    `https://api.mapbox.com/search/searchbox/v1/forward?${params}`,
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.features ?? []).map(
    (f: {
      properties: {
        mapbox_id?: string;
        name?: string;
        address?: string;
        full_address?: string;
        place_formatted?: string;
        feature_type?: string;
      };
      geometry: { coordinates: [number, number] };
    }) => ({
      id: f.properties.mapbox_id ?? `${f.geometry.coordinates.join(',')}`,
      name: f.properties.name ?? 'Unknown',
      fullAddress:
        f.properties.full_address ?? f.properties.place_formatted ?? '',
      lng: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      category: f.properties.feature_type,
    }),
  );
}

// Reverse-geocode a single point to its US state code (e.g. "UT"). Returns null
// for points outside the US or on lookup failure.
async function regionCodeAt(lng: number, lat: number): Promise<string | null> {
  const params = new URLSearchParams({
    longitude: String(lng),
    latitude: String(lat),
    access_token: MAPBOX_TOKEN,
    limit: '1',
    types: 'region',
  });
  const res = await fetch(
    `https://api.mapbox.com/search/geocode/v6/reverse?${params}`,
  );
  if (!res.ok) return null;
  const data = await res.json();
  const ctx = data.features?.[0]?.properties?.context?.region;
  return ctx?.region_code ?? null;
}

// Sample points evenly along a route's geometry and resolve the distinct US
// state codes it passes through. Used to estimate gas cost from per-state fuel
// prices. Keeps the number of reverse-geocode calls bounded (<= samples).
export async function statesAlongRoute(
  geometry: GeoJSON.LineString,
  samples = 6,
): Promise<string[]> {
  const coords = geometry.coordinates;
  if (coords.length === 0) return [];
  const picks: Array<[number, number]> = [];
  const n = Math.min(samples, coords.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.round((i / Math.max(1, n - 1)) * (coords.length - 1));
    picks.push(coords[idx] as [number, number]);
  }
  const codes = await Promise.all(picks.map(([lng, lat]) => regionCodeAt(lng, lat)));
  return [...new Set(codes.filter((c): c is string => !!c))];
}

export async function reverseGeocode(
  lng: number,
  lat: number,
): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    longitude: String(lng),
    latitude: String(lat),
    access_token: MAPBOX_TOKEN,
    limit: '1',
  });
  const res = await fetch(
    `https://api.mapbox.com/search/geocode/v6/reverse?${params}`,
  );
  if (!res.ok) return null;
  const data = await res.json();
  const f = data.features?.[0];
  if (!f) return null;
  return {
    id: f.id,
    name: f.properties.name ?? 'Pinned location',
    fullAddress:
      f.properties.full_address ?? f.properties.place_formatted ?? '',
    lng,
    lat,
  };
}
