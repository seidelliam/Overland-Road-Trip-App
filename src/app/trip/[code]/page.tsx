import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Trip, Route, Stop, BudgetItem } from '@/lib/types';
import { TripWorkspace } from '@/components/trip/trip-workspace';

export default async function TripPage(props: PageProps<'/trip/[code]'>) {
  const { code } = await props.params;
  const supabase = await createClient();

  const { data: trip } = await supabase
    .from('trips')
    .select('*')
    .eq('code', code.toUpperCase())
    .maybeSingle<Trip>();

  if (!trip) notFound();

  const [{ data: routes }, { data: stops }, { data: budget }] = await Promise.all([
    supabase
      .from('routes')
      .select('*')
      .eq('trip_id', trip.id)
      .order('position', { ascending: true })
      .returns<Route[]>(),
    supabase
      .from('stops')
      .select('*, routes!inner(trip_id)')
      .eq('routes.trip_id', trip.id)
      .order('position', { ascending: true })
      .returns<(Stop & { routes: { trip_id: string } })[]>(),
    supabase
      .from('budget_items')
      .select('*')
      .eq('trip_id', trip.id)
      .returns<BudgetItem[]>(),
  ]);

  return (
    <TripWorkspace
      trip={trip}
      initialRoutes={routes ?? []}
      initialStops={(stops ?? []).map(({ routes: _r, ...s }) => s as Stop)}
      initialBudget={budget ?? []}
    />
  );
}
