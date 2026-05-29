'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check } from 'lucide-react';
import { useTripStore } from '@/store/trip-store';
import type { Trip, Route, Stop, BudgetItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { TripMap } from './trip-map';
import { formatDistance, formatDuration, formatCurrency, cn } from '@/lib/utils';

export function CompareWorkspace({
  trip,
  initialRoutes,
  initialStops,
  initialBudget,
}: {
  trip: Trip;
  initialRoutes: Route[];
  initialStops: Stop[];
  initialBudget: BudgetItem[];
}) {
  const hydrate = useTripStore((s) => s.hydrate);
  const routes = useTripStore((s) => s.routes);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initialRoutes.slice(0, 2).map((r) => r.id),
  );

  useEffect(() => {
    hydrate({
      trip,
      routes: initialRoutes,
      stops: initialStops,
      budget: initialBudget,
    });
  }, [trip, initialRoutes, initialStops, initialBudget, hydrate]);

  function toggle(id: string) {
    setSelectedIds((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(-3),
    );
  }

  const selectedRoutes = routes.filter((r) => selectedIds.includes(r.id));

  return (
    <div className="flex flex-col h-screen bg-bg overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-surface/60 backdrop-blur-md px-4 h-14 shrink-0">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/trip/${trip.code}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to trip
          </Link>
        </Button>
        <div className="h-5 w-px bg-border" />
        <div className="text-sm font-semibold">{trip.name}</div>
        <div className="text-xs text-fg-muted">· Compare routes</div>
      </header>

      {/* Route picker */}
      <div className="border-b border-border bg-surface/40 px-4 py-3 shrink-0">
        <div className="text-[10px] uppercase tracking-wider text-fg-muted mb-2">
          Pick up to 3 routes to compare
        </div>
        <div className="flex gap-2 flex-wrap">
          {routes.map((r) => {
            const isSelected = selectedIds.includes(r.id);
            return (
              <button
                key={r.id}
                onClick={() => toggle(r.id)}
                className={cn(
                  'h-9 px-3 rounded-lg border text-sm font-medium flex items-center gap-2 transition-all',
                  isSelected
                    ? 'bg-surface-2 text-fg'
                    : 'border-border text-fg-muted hover:text-fg',
                )}
                style={
                  isSelected
                    ? {
                        borderColor: r.color,
                        boxShadow: `inset 0 0 0 1px ${r.color}40`,
                      }
                    : undefined
                }
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: r.color }}
                />
                {r.name}
                {isSelected && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Side-by-side panels */}
      {selectedRoutes.length === 0 ? (
        <div className="flex-1 grid place-items-center text-sm text-fg-muted">
          Select at least one route above.
        </div>
      ) : (
        <div
          className="flex-1 grid overflow-hidden"
          style={{
            gridTemplateColumns: `repeat(${selectedRoutes.length}, minmax(0, 1fr))`,
          }}
        >
          {selectedRoutes.map((route) => (
            <ComparePanel key={route.id} route={route} />
          ))}
        </div>
      )}
    </div>
  );
}

function ComparePanel({ route }: { route: Route }) {
  const stops = useTripStore((s) => s.stopsForRoute(route.id));
  const total = useTripStore((s) => s.totalForRoute(route.id));
  const allRoutes = useTripStore((s) => s.routes);
  const allStops = useTripStore((s) => s.stops);

  const overnightCount = stops
    .filter((s) => s.category === 'overnight')
    .reduce((sum, s) => sum + (s.nights || 1), 0);

  return (
    <div className="flex flex-col border-r border-border last:border-r-0 overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-surface/40 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: route.color }}
          />
          <h3 className="text-sm font-semibold">{route.name}</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <CompareStat
            label="Distance"
            value={formatDistance(route.distance_meters)}
          />
          <CompareStat
            label="Drive time"
            value={formatDuration(route.duration_seconds)}
          />
          <CompareStat label="Stops" value={String(stops.length)} />
          <CompareStat label="Overnights" value={String(overnightCount)} />
          <CompareStat
            label="Est. cost"
            value={formatCurrency(total)}
            className="col-span-2"
          />
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0 relative">
        <TripMap
          routesOverride={allRoutes}
          stopsOverride={allStops}
          highlightRouteId={route.id}
          interactive={false}
        />
      </div>

      {/* Stops list */}
      <div className="max-h-48 overflow-y-auto border-t border-border bg-surface/40 p-3 shrink-0">
        <div className="text-[10px] uppercase tracking-wider text-fg-muted mb-2">
          Stops ({stops.length})
        </div>
        {stops.length === 0 ? (
          <div className="text-xs text-fg-muted">No stops on this route yet.</div>
        ) : (
          <ol className="space-y-1">
            {stops.map((s, i) => (
              <li
                key={s.id}
                className="flex items-start gap-2 text-xs"
              >
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold mt-px"
                  style={{
                    background: route.color + '22',
                    color: route.color,
                  }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-fg truncate">{s.name}</div>
                  {s.address && (
                    <div className="text-fg-muted truncate text-[11px]">
                      {s.address}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function CompareStat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-md border border-border bg-surface px-2.5 py-1.5',
        className,
      )}
    >
      <div className="text-[9px] uppercase tracking-wider text-fg-muted">
        {label}
      </div>
      <div className="text-xs font-semibold font-mono tabular-nums mt-0.5">
        {value}
      </div>
    </div>
  );
}
