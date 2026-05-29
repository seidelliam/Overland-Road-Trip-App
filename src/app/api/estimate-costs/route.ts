import 'server-only';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { anthropic } from '@/lib/anthropic';

const Estimate = z.object({
  name: z.string().describe('The stop name, copied exactly from the input list'),
  estimated_cost: z
    .number()
    .describe(
      'Total estimated cost in USD for the entire traveling party at this stop (not per person)',
    ),
  basis: z
    .string()
    .describe('One short phrase on what the estimate covers, e.g. "2 nights mid-range hotel for 4"'),
});

const EstimatesSchema = z.object({
  estimates: z.array(Estimate),
});

const SYSTEM_PROMPT = `You are a budget-savvy US travel cost estimator. Given a list of road-trip stops, estimate a realistic total cost in USD for the WHOLE traveling party at each stop.

Guidelines by category:
- overnight: lodging for the number of nights given, sized to the party (assume ~2 people per room for mid-range hotels/motels; campgrounds are much cheaper).
- food: one meal out for the whole party at a typical sit-down spot for that place.
- attraction: admission / tickets for the whole party.
- scenic: usually free or just a small parking/entrance fee.
- gas / waypoint: return 0 (fuel is handled separately).

Be realistic and regionally aware (a meal in NYC costs more than rural Kansas). Return exactly one estimate per input stop, copying the name verbatim so it can be matched.`;

type Body = {
  travelers?: number;
  start_date?: string | null;
  end_date?: string | null;
  stops: Array<{
    name: string;
    category: string;
    address?: string | null;
    nights?: number;
  }>;
};

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured.' },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.stops?.length) {
    return NextResponse.json({ estimates: [] });
  }

  const lines: string[] = [];
  lines.push(`Travelers in party: ${body.travelers ?? 1}`);
  if (body.start_date || body.end_date) {
    lines.push(`Trip dates: ${body.start_date ?? '?'} → ${body.end_date ?? '?'}`);
  }
  lines.push('\nStops to estimate:');
  for (const s of body.stops) {
    lines.push(
      `- ${s.name} (${s.category})${s.nights ? `, ${s.nights} night(s)` : ''}${
        s.address ? ` — ${s.address}` : ''
      }`,
    );
  }

  try {
    const response = await anthropic.messages.parse({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      output_config: {
        format: zodOutputFormat(EstimatesSchema),
      },
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: lines.join('\n') }],
    });

    const parsed = response.parsed_output;
    if (!parsed) {
      return NextResponse.json(
        { error: 'Claude returned an unparseable response.' },
        { status: 502 },
      );
    }

    return NextResponse.json({ estimates: parsed.estimates });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error('Anthropic API error', err.status, err.message);
      return NextResponse.json(
        { error: `Claude error (${err.status}): ${err.message}` },
        { status: 502 },
      );
    }
    console.error('Estimate costs unexpected error', err);
    return NextResponse.json(
      { error: 'Unexpected error estimating costs.' },
      { status: 500 },
    );
  }
}
