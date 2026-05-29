'use client';

import { useTripStore, useShallow } from '@/store/trip-store';
import { formatDistance, formatDuration, formatCurrency } from '@/lib/utils';
import { Route, Clock, Wallet, Bed } from 'lucide-react';
import type { Stop } from '@/lib/types';

const selectActive = (s: any) => s.activeRoute();
const selectStopsForActive = (s: any): Stop[] =>
  s.activeRouteId ? s.stopsForRoute(s.activeRouteId) : [];
const selectTotalForActive = (s: any) =>
  s.activeRouteId ? s.totalForRoute(s.activeRouteId) : 0;

export function RouteSummary() {
  const active = useTripStore(selectActive);
  const stops = useTripStore(useShallow(selectStopsForActive));
  const total = useTripStore(selectTotalForActive);

  if (!active) return null;

  const overnightCount = stops
    .filter((s) => s.category === 'overnight')
    .reduce((sum, s) => sum + (s.nights || 1), 0);

  return (
    <div className="grid grid-cols-2 gap-2">
      <Stat
        icon={<Route className="h-3.5 w-3.5" />}
        label="Distance"
        value={formatDistance(active.distance_meters)}
      />
      <Stat
        icon={<Clock className="h-3.5 w-3.5" />}
        label="Drive time"
        value={formatDuration(active.duration_seconds)}
      />
      <Stat
        icon={<Bed className="h-3.5 w-3.5" />}
        label="Overnights"
        value={String(overnightCount)}
      />
      <Stat
        icon={<Wallet className="h-3.5 w-3.5" />}
        label="Est. cost"
        value={formatCurrency(total)}
      />
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <div className="flex items-center gap-1.5 text-fg-muted text-[10px] uppercase tracking-wider">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-sm font-semibold text-fg mt-0.5 font-mono">
        {value}
      </div>
    </div>
  );
}
