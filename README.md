# Overland

An interactive road trip planner. Sketch multiple routes for the same trip, drop
stops along the way, get AI suggestions from Claude for what not to miss, and
share a code so collaborators land on the same map.

Built with Next.js 16, Mapbox GL, Supabase, and the Anthropic SDK.

![Stack](https://img.shields.io/badge/Next.js-16-black) ![Mapbox](https://img.shields.io/badge/Mapbox-GL-blue) ![Supabase](https://img.shields.io/badge/Supabase-Postgres-green) ![Claude](https://img.shields.io/badge/Claude-Opus%204.7-orange)

## Features

- **Interactive map** with custom-styled Mapbox dark layer + draggable stop markers
- **Multiple routes per trip** — A, B, C variations of the same trip for comparison
- **Side-by-side compare view** — see distances, drive times, and costs across up to 3 routes
- **Click-to-drop pins** or geocoding search for adding stops
- **Stops are categorized** — waypoints, overnights, food, gas, scenic, attractions
- **Budget tracker** — per-trip and per-route, with category breakdown
- **AI suggestions** powered by Claude Opus 4.7 with adaptive thinking, structured outputs via Zod, and Mapbox geocoding for accurate coordinates
- **Trip-code sharing** — 6-character codes (e.g. `A2B7K9`) for cross-device access without accounts

## Quickstart

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL Editor and paste the contents of [`db/schema.sql`](./db/schema.sql). Run it.
3. From **Project Settings → API**, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` API key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. Set up Mapbox

1. Sign up at [mapbox.com](https://mapbox.com) (no card needed for the free tier).
2. Create a token at [account.mapbox.com/access-tokens](https://account.mapbox.com/access-tokens). The default public token works.
3. Copy it into `NEXT_PUBLIC_MAPBOX_TOKEN`. For production, restrict the token's allowed URLs in the Mapbox dashboard.

### 4. Set up Anthropic (for AI suggestions)

1. Create an API key at [console.anthropic.com](https://console.anthropic.com/settings/keys).
2. Copy it into `ANTHROPIC_API_KEY`.

### 5. Configure env

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

### 6. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
src/
├── app/
│   ├── page.tsx                       # Landing (create / join trip)
│   ├── actions.ts                     # Server actions for trip CRUD
│   ├── trip/[code]/
│   │   ├── page.tsx                   # Trip dashboard
│   │   └── compare/page.tsx           # Side-by-side route comparison
│   └── api/ai-suggest/route.ts        # Claude API route for stop suggestions
├── components/
│   ├── ui/                            # Button, Input, Card, Dialog primitives
│   ├── landing/                       # Landing page bits
│   └── trip/                          # Map, sidebar, route tabs, panels
├── lib/
│   ├── supabase/                      # Browser + server Supabase clients
│   ├── mapbox.ts                      # Directions + geocoding helpers
│   ├── anthropic.ts                   # Anthropic SDK client
│   ├── types.ts                       # Shared domain types
│   └── utils.ts                       # cn(), formatters, trip-code generator
└── store/
    └── trip-store.ts                  # Zustand store for client state + mutations
```

## How the AI suggestions work

The `/api/ai-suggest` route:

1. Builds a markdown-formatted prompt with the trip's name, description, route notes, current stops, and any user prompt.
2. Calls `claude-opus-4-7` with **adaptive thinking** (`thinking: {type: 'adaptive'}`).
3. Uses **structured outputs** via `messages.parse()` + a Zod schema so the model returns a typed `{suggestions: [{name, category, approximate_area, description}]}` object.
4. Applies **prompt caching** (`cache_control: {type: 'ephemeral'}`) to the static system prompt so repeated calls within the cache TTL save tokens.
5. **Geocodes** each suggestion's `approximate_area` server-side via Mapbox so the coordinates are accurate (LLMs are unreliable at coordinates; LLMs + a dedicated geocoder are not).

## Sharing a trip

Every trip has a 6-character code that's visible in the top bar of the dashboard
(click it to copy). Anyone with the code can open `/trip/<CODE>` and edit the
trip — there's no per-user auth in this MVP. RLS policies in [`db/schema.sql`](./db/schema.sql)
grant the anon role full access; the code in the URL is effectively the access
token. If you want stricter auth, add Supabase Auth + tighten the RLS policies.

## Scripts

```bash
npm run dev       # Dev server with Turbopack
npm run build     # Production build
npm run start     # Run the production build
```

## Deploying

The app works on any Node host that can run Next.js. Vercel is the most
ergonomic — push to GitHub, import the repo, paste the env vars from
`.env.example` into the project's environment settings, and deploy.

## Roadmap ideas (not yet built)

- Weather overlay on each stop (OpenWeather API)
- Gas station search along the route (Mapbox POI search)
- Lodging integration (Airbnb / Booking — both require partner programs)
- Real-time collaboration via Supabase Realtime channels
- Export trip as a PDF itinerary
