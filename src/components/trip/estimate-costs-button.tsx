'use client';

import { useState } from 'react';
import { Coins, Loader2 } from 'lucide-react';
import { useTripStore, useShallow } from '@/store/trip-store';
import { toast } from 'sonner';

const selectTrip = (s: any) => s.trip;
const selectActiveRouteId = (s: any) => s.activeRouteId;
const selectStopsForActive = (s: any) =>
  s.activeRouteId ? s.stopsForRoute(s.activeRouteId) : [];
const selectUpdateStop = (s: any) => s.updateStop;

// Categories whose cost we estimate (gas is handled by the vehicle panel,
// plain waypoints have no inherent cost).
const ESTIMATABLE = new Set(['overnight', 'food', 'attraction', 'scenic']);

export function EstimateCostsButton() {
  const trip = useTripStore(selectTrip);
  const activeRouteId = useTripStore(selectActiveRouteId);
  const stops = useTripStore(useShallow(selectStopsForActive));
  const updateStop = useTripStore(selectUpdateStop);
  const [loading, setLoading] = useState(false);

  // Only fill stops that don't already have a cost, so manual edits are kept.
  const pending = stops.filter(
    (s: any) => ESTIMATABLE.has(s.category) && s.estimated_cost == null,
  );

  if (!activeRouteId || pending.length === 0) return null;

  async function estimate() {
    setLoading(true);
    try {
      const res = await fetch('/api/estimate-costs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          travelers: trip.travelers,
          start_date: trip.start_date,
          end_date: trip.end_date,
          stops: pending.map((s: any) => ({
            name: s.name,
            category: s.category,
            address: s.address,
            nights: s.nights,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? 'Could not estimate costs.');
        return;
      }
      const data = await res.json();
      const estimates: Array<{ name: string; estimated_cost: number }> =
        data.estimates ?? [];

      let applied = 0;
      await Promise.all(
        estimates.map(async (e) => {
          const stop = pending.find((s: any) => s.name === e.name);
          if (!stop || !e.estimated_cost || e.estimated_cost <= 0) return;
          await updateStop(stop.id, { estimated_cost: e.estimated_cost });
          applied++;
        }),
      );

      if (applied > 0) {
        toast.success(`Estimated costs for ${applied} stop${applied > 1 ? 's' : ''}`);
      } else {
        toast.info('No costs to estimate for these stops.');
      }
    } catch (err) {
      toast.error('Network error reaching Claude.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={estimate}
      disabled={loading}
      className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-accent hover:text-accent/80 disabled:opacity-60 transition-colors"
      title="Use Claude to estimate food, lodging and attraction costs"
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Coins className="h-3 w-3" />
      )}
      Auto-estimate
    </button>
  );
}
