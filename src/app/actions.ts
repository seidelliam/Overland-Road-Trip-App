'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { generateTripCode } from '@/lib/utils';
import { ROUTE_COLORS } from '@/lib/types';

export async function createTrip(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const travelersRaw = formData.get('travelers');
  const travelers = travelersRaw ? Number(travelersRaw) : 1;

  if (!name) {
    return { error: 'Please give your trip a name.' };
  }

  const supabase = await createClient();
  let code = generateTripCode();

  // 6-char alphabet of 32 = ~1B combinations, but retry on the off-chance of collision.
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await supabase
      .from('trips')
      .select('id')
      .eq('code', code)
      .maybeSingle();
    if (!existing) break;
    code = generateTripCode();
  }

  const { data: trip, error } = await supabase
    .from('trips')
    .insert({
      code,
      name,
      description,
      travelers,
    })
    .select('id, code')
    .single();

  if (error || !trip) {
    return { error: error?.message ?? 'Could not create trip.' };
  }

  // Seed the trip with one initial route so the dashboard has something to render.
  await supabase.from('routes').insert({
    trip_id: trip.id,
    name: 'Route A',
    color: ROUTE_COLORS[0],
    position: 0,
  });

  redirect(`/trip/${trip.code}`);
}

export async function joinTrip(formData: FormData) {
  const code = String(formData.get('code') ?? '')
    .trim()
    .toUpperCase();

  if (!code || code.length !== 6) {
    return { error: 'Trip codes are 6 characters.' };
  }

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from('trips')
    .select('code')
    .eq('code', code)
    .maybeSingle();

  if (!trip) {
    return { error: `No trip found for code ${code}.` };
  }

  redirect(`/trip/${trip.code}`);
}
