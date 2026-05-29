'use client';

import { useEffect, useState } from 'react';
import { Pin, MapPin, Maximize2, Minimize2 } from 'lucide-react';
import { useTripStore } from '@/store/trip-store';
import { cn } from '@/lib/utils';
import type { Trip, Route, Stop, BudgetItem } from '@/lib/types';
import { TripHeader } from './trip-header';
import { TripMap } from './trip-map';
import { RouteTabs } from './route-tabs';
import { StopList } from './stop-list';
import { StopSearch } from './stop-search';
import { RouteSummary } from './route-summary';
import { BudgetPanel } from './budget-panel';
import { AIPanel } from './ai-panel';
import { VehiclePanel } from './vehicle-panel';
import { EstimateCostsButton } from './estimate-costs-button';
import { Button } from '@/components/ui/button';

export function TripWorkspace({
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
  const isAddingStop = useTripStore((s) => s.isAddingStop);
  const setAddingStop = useTripStore((s) => s.setAddingStop);
  const [mapExpanded, setMapExpanded] = useState(false);

  useEffect(() => {
    hydrate({
      trip,
      routes: initialRoutes,
      stops: initialStops,
      budget: initialBudget,
    });
    // Run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Backfill geometry for any routes that have stops but no cached geometry yet.
  useEffect(() => {
    for (const route of initialRoutes) {
      const routeStops = initialStops.filter((s) => s.route_id === route.id);
      if (routeStops.length >= 2 && !route.geometry) {
        void useTripStore.getState().refreshRouteGeometry(route.id);
      }
    }
    // Run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-expand map on mobile when the user enters pin-drop mode.
  useEffect(() => {
    if (isAddingStop) setMapExpanded(true);
  }, [isAddingStop]);

  return (
    <div className="flex flex-1 flex-col h-screen overflow-hidden bg-bg">
      <TripHeader />

      {/*
       * Mobile (< lg):  flex-col — map at top, sidebar scrolls below.
       * Desktop (lg+):  flex-row — sidebar fixed-width left, map fills right.
       */}
      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
        {/* ── Map ───────────────────────────────────────────────────────────
         *  Mobile:  fixed height (45 vh) unless expanded; sits at top.
         *  Desktop: flex-1, naturally on the right because sidebar uses
         *           lg:order-first to pull itself to the left.
         */}
        <div
          className={cn(
            'relative shrink-0 lg:shrink lg:flex-1',
            mapExpanded ? 'flex-1' : 'h-[45vh] lg:h-auto',
          )}
        >
          <TripMap />

          {/* Expand / collapse button — mobile only */}
          <button
            onClick={() => setMapExpanded((v) => !v)}
            className="absolute bottom-3 right-3 z-10 lg:hidden flex items-center gap-1.5 rounded-lg bg-surface/90 backdrop-blur-sm border border-border px-3 py-1.5 text-xs font-medium text-fg hover:border-accent/50 hover:text-accent transition-all"
          >
            {mapExpanded ? (
              <>
                <Minimize2 className="h-3.5 w-3.5" />
                Collapse
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5" />
                Full map
              </>
            )}
          </button>
        </div>

        {/* ── Sidebar ───────────────────────────────────────────────────────
         *  Mobile:  flex-1 remaining height, border-t, scrolls as a whole.
         *  Desktop: fixed 400 px, border-r, internal div scrolls (lg:order-first
         *           moves this panel to the left in the flex-row).
         */}
        <aside
          className={cn(
            'flex flex-col border-border bg-surface/40',
            // Desktop positioning & sizing
            'lg:w-[400px] lg:shrink-0 lg:border-r lg:overflow-hidden lg:order-first',
            // Mobile: take remaining height and scroll as one container
            'flex-1 overflow-y-auto border-t lg:border-t-0',
            // Hide sidebar when map is fullscreened on mobile
            mapExpanded && 'hidden lg:flex lg:flex-col',
          )}
        >
          <div className="p-4 border-b border-border space-y-3 shrink-0">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-fg-muted mb-2">
                Routes for this trip
              </div>
              <RouteTabs />
            </div>
            <RouteSummary />
          </div>

          <div className="p-4 space-y-3 border-b border-border shrink-0">
            <StopSearch />
            <Button
              variant={isAddingStop ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setAddingStop(!isAddingStop)}
              className="w-full"
            >
              {isAddingStop ? (
                <>
                  <MapPin className="h-3.5 w-3.5" />
                  Click the map to drop a stop
                </>
              ) : (
                <>
                  <Pin className="h-3.5 w-3.5" />
                  Drop pin on map
                </>
              )}
            </Button>
          </div>

          {/* On desktop this div scrolls inside the fixed-height aside.
              On mobile the aside itself scrolls, so this is just a plain div. */}
          <div className="p-4 space-y-4 lg:flex-1 lg:overflow-y-auto">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-medium uppercase tracking-wider text-fg-muted">
                  Stops along the way
                </div>
                <EstimateCostsButton />
              </div>
              <StopList />
            </div>

            <AIPanel />

            <VehiclePanel />

            <BudgetPanel />
          </div>
        </aside>
      </div>
    </div>
  );
}
