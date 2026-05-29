'use client';

import { useEffect } from 'react';
import { Plus, Pin, MapPin } from 'lucide-react';
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

  return (
    <div className="flex flex-1 flex-col h-screen overflow-hidden bg-bg">
      <TripHeader />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="flex flex-col w-[400px] shrink-0 border-r border-border bg-surface/40 overflow-hidden">
          <div className="p-4 border-b border-border space-y-3">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-fg-muted mb-2">
                Routes for this trip
              </div>
              <RouteTabs />
            </div>
            <RouteSummary />
          </div>

          <div className="p-4 space-y-3 border-b border-border">
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

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
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

        {/* Map */}
        <div className="flex-1 relative">
          <TripMap />
        </div>
      </div>
    </div>
  );
}
