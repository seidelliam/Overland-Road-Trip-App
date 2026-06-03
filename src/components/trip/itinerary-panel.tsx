'use client';

import { useState } from 'react';
import { CalendarDays, ChevronDown, Bed, Car, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTripStore, useShallow } from '@/store/trip-store';
import { formatDistance, formatDuration } from '@/lib/utils';
import { buildItinerary, itineraryDate } from '@/lib/itinerary';
import type { Stop } from '@/lib/types';

const selectTrip = (s: any) => s.trip;
const selectActive = (s: any) => s.activeRoute();
const selectStopsForActive = (s: any): Stop[] =>
  s.activeRouteId ? s.stopsForRoute(s.activeRouteId) : [];

export function ItineraryPanel() {
  const trip = useTripStore(selectTrip);
  const active = useTripStore(selectActive);
  const stops = useTripStore(useShallow(selectStopsForActive));
  const [open, setOpen] = useState(false);

  const days = buildItinerary(active, stops, trip);
  if (days.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-3 space-y-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <CalendarDays className="h-3.5 w-3.5" />
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-fg">Day-by-day plan</div>
            <div className="text-xs text-fg-muted">
              {days.length} {days.length === 1 ? 'day' : 'days'} on the road
            </div>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-fg-muted transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ol
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-2 overflow-hidden"
          >
            {days.map((day) => {
              const date = itineraryDate(trip.start_date, day.offset);
              return (
                <li
                  key={day.index}
                  className="rounded-lg border border-border bg-bg/40 p-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-fg">
                        Day {day.index}
                      </span>
                      {date && (
                        <span className="text-xs text-fg-muted">{date}</span>
                      )}
                    </div>
                    <div
                      className={`flex items-center gap-1 text-xs font-mono ${
                        day.isLongDay ? 'text-amber-500' : 'text-fg-muted'
                      }`}
                    >
                      {day.isLongDay && <AlertTriangle className="h-3 w-3" />}
                      <Car className="h-3 w-3" />
                      {formatDuration(day.driveSeconds)} ·{' '}
                      {formatDistance(day.driveMeters)}
                    </div>
                  </div>

                  <div className="mt-1.5 text-xs text-fg-subtle leading-relaxed">
                    {day.legs[0]?.fromLabel}
                    {day.legs.map((leg, i) => (
                      <span key={i}>
                        {' → '}
                        <span className="text-fg-muted">{leg.toLabel}</span>
                      </span>
                    ))}
                  </div>

                  {day.overnightLabel && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-accent">
                      <Bed className="h-3 w-3" />
                      Overnight in {day.overnightLabel}
                      {day.overnightNights > 1
                        ? ` (${day.overnightNights} nights)`
                        : ''}
                    </div>
                  )}
                </li>
              );
            })}
          </motion.ol>
        )}
      </AnimatePresence>
    </div>
  );
}
