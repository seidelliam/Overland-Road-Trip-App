'use client';

import { useEffect, useState, useTransition } from 'react';
import { Search, Loader2, MapPin } from 'lucide-react';
import { geocode, type GeocodeResult } from '@/lib/mapbox';
import { useTripStore } from '@/store/trip-store';
import { toast } from 'sonner';

export function StopSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, startSearch] = useTransition();
  const activeRouteId = useTripStore((s) => s.activeRouteId);
  const addStop = useTripStore((s) => s.addStop);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    const timer = setTimeout(() => {
      startSearch(async () => {
        const r = await geocode(query);
        setResults(r);
        setOpen(r.length > 0);
      });
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  async function handlePick(result: GeocodeResult) {
    if (!activeRouteId) {
      toast.error('Pick a route first');
      return;
    }
    setQuery('');
    setOpen(false);
    setResults([]);
    await addStop({
      routeId: activeRouteId,
      name: result.name,
      lng: result.lng,
      lat: result.lat,
      address: result.fullAddress,
    });
    toast.success(`Added ${result.name}`);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-muted pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search for a place to add…"
          className="w-full h-10 pl-9 pr-10 rounded-lg border border-border bg-surface text-sm text-fg placeholder:text-fg-subtle focus-visible:outline-none focus-visible:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent/20 transition-colors"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-muted animate-spin" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-30 left-0 right-0 top-full mt-1.5 rounded-lg border border-border bg-surface shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden">
          {results.map((r) => (
            <button
              key={r.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handlePick(r)}
              className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-surface-2 transition-colors border-b border-border last:border-b-0"
            >
              <MapPin className="h-4 w-4 text-fg-muted shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="font-medium text-fg truncate">{r.name}</div>
                {r.fullAddress && (
                  <div className="text-xs text-fg-muted truncate">
                    {r.fullAddress}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
