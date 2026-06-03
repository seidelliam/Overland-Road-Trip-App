export type StopCategory =
  | 'waypoint'
  | 'overnight'
  | 'food'
  | 'gas'
  | 'attraction'
  | 'scenic';

export type BudgetCategory =
  | 'gas'
  | 'food'
  | 'lodging'
  | 'activities'
  | 'other';

export type Trip = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  travelers: number;
  origin_label: string | null;
  origin_lng: number | null;
  origin_lat: number | null;
  destination_label: string | null;
  destination_lng: number | null;
  destination_lat: number | null;
  car_year: number | null;
  car_make: string | null;
  car_model: string | null;
  car_trim: string | null;
  car_mpg: number | null;
  gas_price: number | null;
  created_at: string;
  updated_at: string;
};

export type Route = {
  id: string;
  trip_id: string;
  name: string;
  color: string;
  notes: string | null;
  position: number;
  geometry: GeoJSON.LineString | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  // Per-leg distance/duration between consecutive waypoints (origin → stops →
  // destination), one entry per pair. Used to show how far each day's drive is.
  legs: { distance: number; duration: number }[] | null;
  states: string[] | null;
  created_at: string;
  updated_at: string;
};

export type Stop = {
  id: string;
  route_id: string;
  name: string;
  category: StopCategory;
  lng: number;
  lat: number;
  address: string | null;
  notes: string | null;
  position: number;
  estimated_cost: number | null;
  arrival_date: string | null;
  nights: number;
  created_at: string;
};

// A location Claude proposed but the user hasn't committed to the route yet.
// Lives only in client state (never persisted) so the map can render it as a
// lightweight "ghost" waypoint alongside the real stops.
export type AISuggestion = {
  id: string;
  name: string;
  category: StopCategory;
  lng: number;
  lat: number;
  description: string;
  insertAfterStopIndex?: number;
};

export type BudgetItem = {
  id: string;
  trip_id: string;
  route_id: string | null;
  category: BudgetCategory;
  label: string;
  amount: number;
  created_at: string;
};

export type TripWithDetails = Trip & {
  routes: (Route & { stops: Stop[] })[];
  budget_items: BudgetItem[];
};

export const CATEGORY_META: Record<
  StopCategory,
  { label: string; emoji: string; color: string }
> = {
  waypoint: { label: 'Waypoint', emoji: '📍', color: '#94a3b8' },
  overnight: { label: 'Overnight', emoji: '🏕️', color: '#a855f7' },
  food: { label: 'Food', emoji: '🍔', color: '#f97316' },
  gas: { label: 'Gas', emoji: '⛽', color: '#facc15' },
  attraction: { label: 'Attraction', emoji: '🎡', color: '#ec4899' },
  scenic: { label: 'Scenic stop', emoji: '🏞️', color: '#10b981' },
};

export const BUDGET_META: Record<
  BudgetCategory,
  { label: string; emoji: string }
> = {
  gas: { label: 'Gas', emoji: '⛽' },
  food: { label: 'Food', emoji: '🍔' },
  lodging: { label: 'Lodging', emoji: '🏨' },
  activities: { label: 'Activities', emoji: '🎟️' },
  other: { label: 'Other', emoji: '💸' },
};

export const ROUTE_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f97316', // orange
  '#a855f7', // purple
  '#ec4899', // pink
  '#facc15', // yellow
] as const;
