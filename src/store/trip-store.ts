'use client';

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type {
  Trip,
  Route,
  Stop,
  BudgetItem,
  StopCategory,
  BudgetCategory,
} from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { getDirections, statesAlongRoute } from '@/lib/mapbox';
import { gasPriceForStates } from '@/lib/gas-prices';
import { ROUTE_COLORS } from '@/lib/types';

export { useShallow };

type GeoPoint = { lng: number; lat: number };

// Great-circle distance in km — a cheap, dependency-free proxy for "how far
// apart" two points are. Good enough to rank insertion gaps along a route.
function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Pick the stop index a new point should slot into so it sits where it makes
// geographic sense along the route, rather than always at the end. Uses the
// classic cheapest-insertion heuristic: for every gap between consecutive
// waypoints (trip origin → stops → destination) measure the extra straight-line
// distance inserting the point would add, and choose the smallest. Returns an
// index in [0, ordered.length].
function bestInsertionIndex(
  point: GeoPoint,
  ordered: Stop[],
  trip: Trip,
): number {
  if (ordered.length === 0) return 0;

  const origin =
    trip?.origin_lng != null && trip?.origin_lat != null
      ? { lng: trip.origin_lng, lat: trip.origin_lat }
      : null;
  const destination =
    trip?.destination_lng != null && trip?.destination_lat != null
      ? { lng: trip.destination_lng, lat: trip.destination_lat }
      : null;

  let bestIndex = ordered.length; // default to appending at the end
  let bestCost = Infinity;

  for (let i = 0; i <= ordered.length; i++) {
    const left: GeoPoint | null = i === 0 ? origin : ordered[i - 1];
    const right: GeoPoint | null =
      i === ordered.length ? destination : ordered[i];

    let cost: number;
    if (left && right) {
      cost =
        haversineKm(left, point) +
        haversineKm(point, right) -
        haversineKm(left, right);
    } else if (left) {
      cost = haversineKm(left, point);
    } else if (right) {
      cost = haversineKm(point, right);
    } else {
      cost = 0;
    }

    if (cost < bestCost) {
      bestCost = cost;
      bestIndex = i;
    }
  }

  return bestIndex;
}

type TripState = {
  trip: Trip;
  routes: Route[];
  stops: Stop[];
  budget: BudgetItem[];
  activeRouteId: string | null;
  isAddingStop: boolean;
  comparingRouteIds: string[]; // for compare view

  // selectors
  activeRoute: () => Route | undefined;
  stopsForRoute: (routeId: string) => Stop[];
  budgetForRoute: (routeId: string | null) => BudgetItem[];
  gasCostForRoute: (routeId: string | null) => number;
  totalForRoute: (routeId: string | null) => number;
  tripTotal: () => number;

  // actions
  hydrate: (state: {
    trip: Trip;
    routes: Route[];
    stops: Stop[];
    budget: BudgetItem[];
  }) => void;
  updateTrip: (patch: Partial<Trip>) => Promise<void>;
  setActiveRoute: (id: string) => void;
  setAddingStop: (v: boolean) => void;
  toggleCompare: (id: string) => void;
  clearCompare: () => void;

  addRoute: () => Promise<void>;
  updateRoute: (id: string, patch: Partial<Route>) => Promise<void>;
  removeRoute: (id: string) => Promise<void>;
  duplicateRoute: (id: string) => Promise<void>;

  addStop: (input: {
    routeId: string;
    name: string;
    lng: number;
    lat: number;
    address?: string | null;
    category?: StopCategory;
  }) => Promise<Stop | null>;
  updateStop: (id: string, patch: Partial<Stop>) => Promise<void>;
  removeStop: (id: string) => Promise<void>;
  reorderStops: (routeId: string, orderedIds: string[]) => Promise<void>;

  refreshRouteGeometry: (routeId: string) => Promise<void>;

  addBudgetItem: (input: {
    label: string;
    amount: number;
    category: BudgetCategory;
    routeId?: string | null;
  }) => Promise<void>;
  removeBudgetItem: (id: string) => Promise<void>;
};

export const useTripStore = create<TripState>((set, get) => ({
  trip: {} as Trip,
  routes: [],
  stops: [],
  budget: [],
  activeRouteId: null,
  isAddingStop: false,
  comparingRouteIds: [],

  activeRoute: () => get().routes.find((r) => r.id === get().activeRouteId),
  stopsForRoute: (routeId) =>
    get()
      .stops.filter((s) => s.route_id === routeId)
      .sort((a, b) => a.position - b.position),
  budgetForRoute: (routeId) =>
    get().budget.filter((b) => b.route_id === routeId),
  gasCostForRoute: (routeId) => {
    const { trip, routes } = get();
    const mpg = trip.car_mpg ? Number(trip.car_mpg) : null;
    if (!mpg || mpg <= 0) return 0;
    const relevant =
      routeId == null ? routes : routes.filter((r) => r.id === routeId);
    const meters = relevant.reduce((m, r) => m + (r.distance_meters ?? 0), 0);
    if (meters <= 0) return 0;
    const miles = meters * 0.000621371;
    // Manual per-trip override wins; otherwise average the per-state prices for
    // the states this route passes through.
    const price =
      trip.gas_price != null
        ? Number(trip.gas_price)
        : gasPriceForStates([
            ...new Set(relevant.flatMap((r) => r.states ?? [])),
          ]);
    return (miles / mpg) * price;
  },
  totalForRoute: (routeId) =>
    get()
      .budget.filter((b) => b.route_id === routeId)
      .reduce((sum, b) => sum + Number(b.amount), 0) +
    get()
      .stops.filter((s) => routeId == null || s.route_id === routeId)
      .reduce((sum, s) => sum + (s.estimated_cost ? Number(s.estimated_cost) : 0), 0) +
    get().gasCostForRoute(routeId),
  tripTotal: () =>
    get().budget.reduce((sum, b) => sum + Number(b.amount), 0) +
    get().stops.reduce(
      (sum, s) => sum + (s.estimated_cost ? Number(s.estimated_cost) : 0),
      0,
    ),

  hydrate: ({ trip, routes, stops, budget }) =>
    set({
      trip,
      routes,
      stops,
      budget,
      activeRouteId: routes[0]?.id ?? null,
      comparingRouteIds: [],
    }),

  updateTrip: async (patch) => {
    const { trip } = get();
    set((s) => ({ trip: { ...s.trip, ...patch } }));
    const supabase = createClient();
    await supabase.from('trips').update(patch).eq('id', trip.id);
  },

  setActiveRoute: (id) => set({ activeRouteId: id }),
  setAddingStop: (v) => set({ isAddingStop: v }),
  toggleCompare: (id) =>
    set((s) => ({
      comparingRouteIds: s.comparingRouteIds.includes(id)
        ? s.comparingRouteIds.filter((x) => x !== id)
        : [...s.comparingRouteIds, id].slice(-3),
    })),
  clearCompare: () => set({ comparingRouteIds: [] }),

  addRoute: async () => {
    const { trip, routes } = get();
    const supabase = createClient();
    const color = ROUTE_COLORS[routes.length % ROUTE_COLORS.length];
    const name = `Route ${String.fromCharCode(65 + routes.length)}`;
    const { data, error } = await supabase
      .from('routes')
      .insert({
        trip_id: trip.id,
        name,
        color,
        position: routes.length,
      })
      .select('*')
      .single<Route>();
    if (error || !data) return;
    set((s) => ({
      routes: [...s.routes, data],
      activeRouteId: data.id,
    }));
  },

  updateRoute: async (id, patch) => {
    set((s) => ({
      routes: s.routes.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
    const supabase = createClient();
    await supabase.from('routes').update(patch).eq('id', id);
  },

  removeRoute: async (id) => {
    const { routes, activeRouteId } = get();
    const next = routes.filter((r) => r.id !== id);
    set({
      routes: next,
      stops: get().stops.filter((s) => s.route_id !== id),
      budget: get().budget.filter((b) => b.route_id !== id),
      activeRouteId:
        activeRouteId === id ? (next[0]?.id ?? null) : activeRouteId,
    });
    const supabase = createClient();
    await supabase.from('routes').delete().eq('id', id);
  },

  duplicateRoute: async (id) => {
    const { trip, routes, stops } = get();
    const source = routes.find((r) => r.id === id);
    if (!source) return;
    const supabase = createClient();
    const color = ROUTE_COLORS[routes.length % ROUTE_COLORS.length];
    const { data: newRoute, error } = await supabase
      .from('routes')
      .insert({
        trip_id: trip.id,
        name: `${source.name} copy`,
        color,
        position: routes.length,
        notes: source.notes,
      })
      .select('*')
      .single<Route>();
    if (error || !newRoute) return;
    const sourceStops = stops.filter((s) => s.route_id === source.id);
    if (sourceStops.length > 0) {
      const { data: newStops } = await supabase
        .from('stops')
        .insert(
          sourceStops.map((s) => ({
            route_id: newRoute.id,
            name: s.name,
            category: s.category,
            lng: s.lng,
            lat: s.lat,
            address: s.address,
            notes: s.notes,
            position: s.position,
            estimated_cost: s.estimated_cost,
            arrival_date: s.arrival_date,
            nights: s.nights,
          })),
        )
        .select('*')
        .returns<Stop[]>();
      set((s) => ({
        routes: [...s.routes, newRoute],
        stops: [...s.stops, ...(newStops ?? [])],
        activeRouteId: newRoute.id,
      }));
    } else {
      set((s) => ({
        routes: [...s.routes, newRoute],
        activeRouteId: newRoute.id,
      }));
    }
    // refresh geometry for the new route
    void get().refreshRouteGeometry(newRoute.id);
  },

  addStop: async (input) => {
    const { stops, trip } = get();
    const routeStops = stops
      .filter((s) => s.route_id === input.routeId)
      .sort((a, b) => a.position - b.position);

    // Slot the new stop where it fits best along the route rather than always
    // tacking it onto the end.
    const position = bestInsertionIndex(input, routeStops, trip);

    const supabase = createClient();

    // Make room: every existing stop at or after the insertion point shifts
    // down by one so positions stay contiguous and unique.
    const shifted = routeStops.slice(position);
    if (shifted.length > 0) {
      const shiftIds = new Set(shifted.map((s) => s.id));
      set((s) => ({
        stops: s.stops.map((stop) =>
          shiftIds.has(stop.id)
            ? { ...stop, position: stop.position + 1 }
            : stop,
        ),
      }));
      await Promise.all(
        shifted.map((stop) =>
          supabase
            .from('stops')
            .update({ position: stop.position + 1 })
            .eq('id', stop.id),
        ),
      );
    }

    const { data, error } = await supabase
      .from('stops')
      .insert({
        route_id: input.routeId,
        name: input.name,
        lng: input.lng,
        lat: input.lat,
        address: input.address ?? null,
        category: input.category ?? 'waypoint',
        position,
      })
      .select('*')
      .single<Stop>();
    if (error || !data) return null;
    set((s) => ({ stops: [...s.stops, data] }));
    void get().refreshRouteGeometry(input.routeId);
    return data;
  },

  updateStop: async (id, patch) => {
    set((s) => ({
      stops: s.stops.map((stop) =>
        stop.id === id ? { ...stop, ...patch } : stop,
      ),
    }));
    const supabase = createClient();
    await supabase.from('stops').update(patch).eq('id', id);

    // If location changed, refresh route geometry
    const stop = get().stops.find((s) => s.id === id);
    if (stop && (patch.lng !== undefined || patch.lat !== undefined)) {
      void get().refreshRouteGeometry(stop.route_id);
    }
  },

  removeStop: async (id) => {
    const stop = get().stops.find((s) => s.id === id);
    if (!stop) return;
    set((s) => ({ stops: s.stops.filter((x) => x.id !== id) }));
    const supabase = createClient();
    await supabase.from('stops').delete().eq('id', id);
    void get().refreshRouteGeometry(stop.route_id);
  },

  reorderStops: async (routeId, orderedIds) => {
    const supabase = createClient();
    const updates = orderedIds.map((id, position) => ({ id, position }));
    set((s) => ({
      stops: s.stops.map((stop) => {
        if (stop.route_id !== routeId) return stop;
        const idx = orderedIds.indexOf(stop.id);
        return idx === -1 ? stop : { ...stop, position: idx };
      }),
    }));
    await Promise.all(
      updates.map((u) =>
        supabase.from('stops').update({ position: u.position }).eq('id', u.id),
      ),
    );
    void get().refreshRouteGeometry(routeId);
  },

  refreshRouteGeometry: async (routeId) => {
    const { routes, stops, trip } = get();
    const route = routes.find((r) => r.id === routeId);
    if (!route) return;

    const orderedStops = stops
      .filter((s) => s.route_id === routeId)
      .sort((a, b) => a.position - b.position);

    // Build coordinate list: optional trip origin → stops → optional destination
    const coords: Array<[number, number]> = [];
    if (trip.origin_lng != null && trip.origin_lat != null) {
      coords.push([trip.origin_lng, trip.origin_lat]);
    }
    for (const s of orderedStops) coords.push([s.lng, s.lat]);
    if (trip.destination_lng != null && trip.destination_lat != null) {
      coords.push([trip.destination_lng, trip.destination_lat]);
    }

    if (coords.length < 2) {
      // Clear cached geometry
      set((s) => ({
        routes: s.routes.map((r) =>
          r.id === routeId
            ? {
                ...r,
                geometry: null,
                distance_meters: null,
                duration_seconds: null,
                legs: null,
                states: null,
              }
            : r,
        ),
      }));
      const supabase = createClient();
      await supabase
        .from('routes')
        .update({
          geometry: null,
          distance_meters: null,
          duration_seconds: null,
          legs: null,
          states: null,
        })
        .eq('id', routeId);
      return;
    }

    const result = await getDirections(coords);
    if (!result) return;

    // Detect the US states the route passes through (for per-state gas pricing).
    const states = await statesAlongRoute(result.geometry);

    set((s) => ({
      routes: s.routes.map((r) =>
        r.id === routeId
          ? {
              ...r,
              geometry: result.geometry,
              distance_meters: result.distance,
              duration_seconds: result.duration,
              legs: result.legs,
              states,
            }
          : r,
      ),
    }));
    const supabase = createClient();
    await supabase
      .from('routes')
      .update({
        geometry: result.geometry,
        distance_meters: result.distance,
        duration_seconds: result.duration,
        legs: result.legs,
        states,
      })
      .eq('id', routeId);
  },

  addBudgetItem: async ({ label, amount, category, routeId = null }) => {
    const { trip } = get();
    const supabase = createClient();
    const { data, error } = await supabase
      .from('budget_items')
      .insert({
        trip_id: trip.id,
        route_id: routeId,
        category,
        label,
        amount,
      })
      .select('*')
      .single<BudgetItem>();
    if (error || !data) return;
    set((s) => ({ budget: [...s.budget, data] }));
  },

  removeBudgetItem: async (id) => {
    set((s) => ({ budget: s.budget.filter((b) => b.id !== id) }));
    const supabase = createClient();
    await supabase.from('budget_items').delete().eq('id', id);
  },
}));
