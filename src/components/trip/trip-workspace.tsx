'use client';

import { useEffect } from 'react';
import { useTripStore } from '@/store/trip-store';
import type { Trip, Route, Stop, BudgetItem } from '@/lib/types';
import { TripHeader } from './trip-header';
import { TripMap } from './trip-map';
import { RouteTabs } from './route-tabs';
import { StopList } from './stop-list';
import { StopSearch } from './stop-search';
import { RouteSummary } from './route-summary';
import { BudgetPanel } from './budget-panel';
import { AIPanel } from './ai-panel';
import { ItineraryPanel } from './itinerary-panel';
import { VehiclePanel } from './vehicle-panel';
import { EstimateCostsButton } from './estimate-costs-button';

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

  // On mobile the map is a band at the top; when the user starts pin-drop mode
  // (the button lives below the map), scroll it back into view so they can tap.
  useEffect(() => {
    if (isAddingStop && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [isAddingStop]);

  return (
    <div className="flex flex-col bg-bg lg:h-screen lg:overflow-hidden">
      <TripHeader />

      {/*
       * Mobile (< lg):  one vertically-scrolling document. The map is a 50vh
       *   band at the top that scrolls up out of view as you scroll to the
       *   stops below — no internal scroll containers.
       * Desktop (lg+):  fixed full-height split — 400px sidebar on the left
       *   (lg:order-first), map filling the right.
       */}
      <div className="flex flex-col lg:min-h-0 lg:flex-1 lg:flex-row lg:overflow-hidden">
        {/* ── Map ───────────────────────────────────────────────────────────
         *  Mobile:  50vh band at the top; scrolls away with the page.
         *  Desktop: fills the right (sidebar uses lg:order-first to sit left).
         */}
        <div className="relative h-[50vh] shrink-0 lg:h-auto lg:flex-1">
          <TripMap />
        </div>

        {/* ── Sidebar ───────────────────────────────────────────────────────
         *  Mobile:  flows below the map in normal document scroll.
         *  Desktop: fixed 400px, border-r, internal div scrolls.
         */}
        <aside className="flex flex-col border-border bg-surface/40 border-t lg:w-[400px] lg:shrink-0 lg:border-r lg:border-t-0 lg:overflow-hidden lg:order-first">
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

            <ItineraryPanel />

            <AIPanel />

            <VehiclePanel />

            <BudgetPanel />
          </div>
        </aside>
      </div>
    </div>
  );
}
