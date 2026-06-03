import type { Route, Stop, Trip } from '@/lib/types';
import { DRIVING_HOURS_PER_DAY } from '@/lib/utils';

// One driving leg within a day: the hop from one waypoint to the next.
export type ItineraryLeg = {
  fromLabel: string;
  toLabel: string;
  distance: number; // meters
  duration: number; // seconds (calibrated, matches route totals)
};

export type ItineraryDay = {
  index: number; // 1-based day number
  offset: number; // calendar days from the trip start (day 1 = 0)
  legs: ItineraryLeg[];
  driveSeconds: number;
  driveMeters: number;
  // Where you spend the night at the end of this day. null = final day / arrival.
  overnightLabel: string | null;
  overnightNights: number; // nights spent there (1 unless a multi-night stay)
  isLongDay: boolean; // driving exceeded the comfortable per-day budget
};

type Node = { label: string; overnightNights: number };

// Turn a route's cached per-leg figures into a day-by-day plan: accumulate
// driving until either an explicit overnight stop or the daily hour budget is
// hit, then start a new day. Multi-night stays push the calendar forward so
// later days land on the right date. Returns [] when geometry/legs are stale.
export function buildItinerary(
  route: Route | undefined,
  orderedStops: Stop[],
  trip: Trip,
  hoursPerDay = DRIVING_HOURS_PER_DAY,
): ItineraryDay[] {
  const legs = route?.legs;
  if (!route || !legs || legs.length === 0) return [];

  const nodes: Node[] = [];
  if (trip.origin_lng != null && trip.origin_lat != null) {
    nodes.push({ label: trip.origin_label || 'Start', overnightNights: 0 });
  }
  for (const s of orderedStops) {
    nodes.push({
      label: s.name,
      overnightNights: s.category === 'overnight' ? Math.max(1, s.nights || 1) : 0,
    });
  }
  if (trip.destination_lng != null && trip.destination_lat != null) {
    nodes.push({
      label: trip.destination_label || 'End',
      overnightNights: 0,
    });
  }

  // legs has exactly one entry per consecutive node pair; if they disagree the
  // cached geometry predates the current stop list — bail rather than mislead.
  if (nodes.length !== legs.length + 1) return [];

  const dayBudget = hoursPerDay * 3600;
  const days: ItineraryDay[] = [];

  let dayLegs: ItineraryLeg[] = [];
  let driveSeconds = 0;
  let driveMeters = 0;
  let offset = 0;
  let index = 1;

  const closeDay = (overnightLabel: string | null, nights: number) => {
    days.push({
      index,
      offset,
      legs: dayLegs,
      driveSeconds,
      driveMeters,
      overnightLabel,
      overnightNights: nights,
      isLongDay: driveSeconds > dayBudget,
    });
    index += 1;
    offset += Math.max(1, nights);
    dayLegs = [];
    driveSeconds = 0;
    driveMeters = 0;
  };

  for (let i = 0; i < legs.length; i++) {
    const from = nodes[i];
    const to = nodes[i + 1];
    const leg = legs[i];
    dayLegs.push({
      fromLabel: from.label,
      toLabel: to.label,
      distance: leg.distance,
      duration: leg.duration,
    });
    driveSeconds += leg.duration;
    driveMeters += leg.distance;

    const isLast = i === legs.length - 1;
    if (isLast) {
      closeDay(null, 1);
      break;
    }
    if (to.overnightNights > 0) {
      closeDay(to.label, to.overnightNights);
    } else if (driveSeconds >= dayBudget) {
      // No planned overnight, but you've driven a full day — bed down near here.
      closeDay(to.label, 1);
    }
  }

  return days;
}

// Format a day's calendar date from the trip start (a 'yyyy-mm-dd' string) plus
// its offset, kept in local time so it never drifts a day from timezone math.
export function itineraryDate(
  startDate: string | null | undefined,
  offset: number,
): string | null {
  if (!startDate) return null;
  const [y, m, d] = startDate.split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d + offset);
  return dt.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
