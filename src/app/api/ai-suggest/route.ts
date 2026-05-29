import 'server-only';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { anthropic } from '@/lib/anthropic';
import { geocode } from '@/lib/mapbox';

const Suggestion = z.object({
  name: z.string().describe('Specific name of the place (e.g. "Garden of the Gods")'),
  category: z
    .enum(['waypoint', 'overnight', 'food', 'gas', 'attraction', 'scenic'])
    .describe('What kind of stop this is'),
  approximate_area: z
    .string()
    .describe(
      'City, state/province, country — specific enough to geocode (e.g. "Colorado Springs, Colorado, USA")',
    ),
  description: z
    .string()
    .describe(
      'One or two sentences on why this stop is worth visiting and what makes it unique.',
    ),
});

const SuggestionsSchema = z.object({
  suggestions: z
    .array(Suggestion)
    .min(0)
    .max(8)
    .describe('Between 3 and 8 stop ideas that fit the trip and any user prompt'),
});

const SYSTEM_PROMPT = `You are an expert road trip planner with deep knowledge of US and global geography, scenic byways, national parks, food scenes, and offbeat attractions.

A user is planning a route and wants stop suggestions. Your job is to recommend stops that:

1. Make geographic sense given the existing waypoints on their route (don't suggest stops thousands of miles off the route).
2. Are concrete, real places — not "a coffee shop in Seattle" but "Caffe Vita, Capitol Hill, Seattle".
3. Fit the vibe and constraints of the trip (e.g. budget, traveler count, dates, any user preferences).
4. Include a mix of categories when possible — scenic stops, food, attractions, and overnight options.
5. Have an \`approximate_area\` string specific enough that a geocoding API can resolve it to coordinates (city + state/region at minimum).

If the user gives a specific prompt (e.g. "best taco trucks", "family-friendly hikes"), prioritize that. Otherwise, return a balanced set.

Return between 3 and 8 suggestions. Skip anything you can't place confidently on a map.`;

type TripContext = {
  trip: {
    name?: string;
    description?: string | null;
    travelers?: number;
    start_date?: string | null;
    end_date?: string | null;
  };
  route: {
    name?: string;
    notes?: string | null;
  };
  stops: Array<{
    name: string;
    category: string;
    address: string | null;
    position: number;
  }>;
  prompt?: string;
};

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured.' },
      { status: 503 },
    );
  }

  let body: TripContext;
  try {
    body = (await request.json()) as TripContext;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const userMessage = buildUserMessage(body);

  try {
    const response = await anthropic.messages.parse({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      output_config: {
        format: zodOutputFormat(SuggestionsSchema),
      },
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    });

    const parsed = response.parsed_output;
    if (!parsed) {
      return NextResponse.json(
        { error: 'Claude returned an unparseable response.' },
        { status: 502 },
      );
    }

    const geocoded = await Promise.all(
      parsed.suggestions.map(async (s) => {
        const results = await geocode(`${s.name}, ${s.approximate_area}`);
        const hit = results[0];
        if (!hit) return null;
        return {
          name: s.name,
          category: s.category,
          description: s.description,
          lng: hit.lng,
          lat: hit.lat,
        };
      }),
    );

    return NextResponse.json({
      suggestions: geocoded.filter((s): s is NonNullable<typeof s> => s != null),
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error('Anthropic API error', err.status, err.message);
      return NextResponse.json(
        { error: `Claude error (${err.status}): ${err.message}` },
        { status: 502 },
      );
    }
    console.error('AI suggest unexpected error', err);
    return NextResponse.json(
      { error: 'Unexpected error generating suggestions.' },
      { status: 500 },
    );
  }
}

function buildUserMessage(ctx: TripContext): string {
  const lines: string[] = [];
  lines.push(`# Trip: ${ctx.trip.name ?? 'Untitled trip'}`);
  if (ctx.trip.description) lines.push(`Description: ${ctx.trip.description}`);
  if (ctx.trip.travelers) lines.push(`Travelers: ${ctx.trip.travelers}`);
  if (ctx.trip.start_date || ctx.trip.end_date) {
    lines.push(
      `Dates: ${ctx.trip.start_date ?? '?'} → ${ctx.trip.end_date ?? '?'}`,
    );
  }

  lines.push(`\n## Route: ${ctx.route.name ?? 'Unnamed route'}`);
  if (ctx.route.notes) lines.push(`Route notes: ${ctx.route.notes}`);

  if (ctx.stops.length > 0) {
    lines.push('\n## Current stops (in order):');
    for (const stop of ctx.stops) {
      lines.push(
        `${stop.position + 1}. ${stop.name} (${stop.category})${stop.address ? ' — ' + stop.address : ''}`,
      );
    }
  } else {
    lines.push('\n## Current stops: none yet — this is a blank slate.');
  }

  if (ctx.prompt) {
    lines.push(`\n## User's specific request:\n${ctx.prompt}`);
  } else {
    lines.push(
      '\nNo specific request — suggest a balanced mix of stops that fit this route.',
    );
  }

  return lines.join('\n');
}
