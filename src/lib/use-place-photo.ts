'use client';

import { useEffect, useState } from 'react';
import { getPlacePhoto, type PlaceDetails } from '@/lib/place-photos';

// Resolve a place name to a photo URL (or null if none found). Cached across
// the session, so re-renders and repeated names are cheap.
export function usePlacePhoto(query: string | null | undefined) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!!query);

  useEffect(() => {
    if (!query) {
      setSrc(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    getPlacePhoto(query).then((url) => {
      if (!active) return;
      setSrc(url);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [query]);

  return { src, loading };
}

// Photos + description for the stop detail card. Hits the /api/place-info route
// (Google Places when configured, else Wikipedia). lat/lng help disambiguate
// the place (e.g. the right "Lincoln Park").
export function usePlaceInfo(
  query: string | null | undefined,
  lat?: number | null,
  lng?: number | null,
) {
  const [info, setInfo] = useState<PlaceDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(!!query);

  useEffect(() => {
    if (!query) {
      setInfo(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({ q: query });
    if (lat != null) params.set('lat', String(lat));
    if (lng != null) params.set('lng', String(lng));
    fetch(`/api/place-info?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((result: PlaceDetails | null) => {
        if (!active) return;
        setInfo(result);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setInfo(null);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query, lat, lng]);

  return { info, loading };
}
