# Updates / Change Requests

A running backlog of changes to make. Drop items here in any batch size — Claude
works through them, checking off each as it lands.

**How to use:** add items under "Pending" using the template below. Be as terse or
detailed as you like; a one-liner is fine. When you hand a batch to Claude, it will
move finished items to "Done" with a note on what changed.

---

## Template

```
### <short title>
- [ ] What: <what you want changed>
- Where: <file/area, if you know it — optional>
- Why / notes: <context, acceptance criteria, links — optional>
```

---

## Pending

_(nothing queued)_

---

## Done

### Per-leg drive distances ("how far each day")
- [x] Each connector between stops now shows the **actual driving distance + time** for that leg (e.g. `124 mi · 2h 3m`), plus a leading "from <origin>" and trailing "to <destination>" leg when those are set — so you can see how much driving each day involves.
- Mapbox Directions already returns per-leg figures; `getDirections` now passes `legs` through ([src/lib/mapbox.ts](../src/lib/mapbox.ts)) and they're cached on the route alongside geometry ([src/store/trip-store.ts](../src/store/trip-store.ts)). Rendered by a new `LegConnector` in [src/components/trip/stop-list.tsx](../src/components/trip/stop-list.tsx).
- ⚠️ Adds a `legs jsonb` column to `routes` — run the migration block at the bottom of [db/schema.sql](../db/schema.sql).

### Drag-and-drop: drop *between* stops
- [x] Reordering now uses an **insertion line that snaps to the gap between two stops** (top/bottom half of the hovered row decides which side), instead of dropping on top of a stop. The dragged row dims, leg connectors hide mid-drag so the indicator reads cleanly, and the move only commits if the position actually changed ([src/components/trip/stop-list.tsx](../src/components/trip/stop-list.tsx)).

### Shipping for small use → Vercel + Supabase (skip Railway)
- [x] Recommendation written up in [docs/DEPLOY.md](DEPLOY.md): deploy the Next.js app to **Vercel** (you already use it), keep the DB on **Supabase**, and don't add Railway — there's no separate server/DB to host, so it'd just be a second bill.
- [x] **Security fix:** `.env.example` (which `.gitignore` force-commits) contained a real Anthropic secret key. Replaced all values with placeholders ([.env.example](../.env.example)). **Rotate that Anthropic key before pushing** — see DEPLOY.md.

### Address lookup dropdown + AI "returns nothing"
- [x] Both were the **same root cause**: `geocode()` passed an invalid `poi` type to Mapbox Geocoding v6, so every forward lookup returned a validation error → empty. This emptied the address dropdown AND silently filtered out *all* of Claude's suggestions (they're each re-geocoded), so the AI panel appeared to "spin then return nothing."
- Fix: switched `geocode()` to the Mapbox **Search Box forward** API, which resolves cities, addresses, and POIs in one call ([src/lib/mapbox.ts](../src/lib/mapbox.ts)). Also bumped the AI model to `claude-opus-4-8` ([src/app/api/ai-suggest/route.ts](../src/app/api/ai-suggest/route.ts)).

### Car make/model/year → gas mileage (database)
- [x] New "Vehicle & gas" panel with cascading Year → Make → Model → Trim dropdowns backed by the free EPA fueleconomy.gov database; selecting a trim auto-fills the official combined MPG ([src/components/trip/vehicle-panel.tsx](../src/components/trip/vehicle-panel.tsx), [src/lib/fuel-economy.ts](../src/lib/fuel-economy.ts)).
- Gas cost is auto-computed per route (distance ÷ MPG × price) and folded into the budget. Per your note, the price is **averaged across the US states the route passes through** ([src/lib/gas-prices.ts](../src/lib/gas-prices.ts)); states are detected from the route geometry. A manual $/gal override is available.

### Stop detail card with photos
- [x] Clicking a stop opens a detail card with a photo gallery + short description, plus trip-specific facts (est. cost, nights, arrival, notes) and an Edit button ([src/components/trip/stop-list.tsx](../src/components/trip/stop-list.tsx)).
- Photos come from **Google Places** when `GOOGLE_PLACES_API_KEY` is set (real venue photos incl. restaurants, multi-image gallery, photographer attribution), via a server route that keeps the key off the client ([src/app/api/place-info/route.ts](../src/app/api/place-info/route.ts)). Without a key it **automatically falls back to Wikipedia/Wikimedia** (free) — and Wikipedia also backfills any description/photo gaps Google leaves. Results cached server-side. (Earlier draft put thumbnails on the stop icons / AI cards — reverted in favor of this click-to-open card.)
- To enable Google photos: add `GOOGLE_PLACES_API_KEY` to `.env.local` (see [.env.example](../.env.example) for the Google Cloud setup steps). No code change needed — it picks the key up automatically.

### Auto-finances for map stops (food, lodging, attractions)
- [x] "Auto-estimate" button (in the Stops header) uses Claude to estimate a realistic cost per stop, factoring in traveler count and nights ([src/app/api/estimate-costs/route.ts](../src/app/api/estimate-costs/route.ts), [src/components/trip/estimate-costs-button.tsx](../src/components/trip/estimate-costs-button.tsx)). It only fills stops without a cost, so your manual edits are never overwritten; every estimate stays editable in the stop dialog.

> ⚠️ **Action required:** these features add columns to the `trips` and `routes` tables. Run the migration block at the bottom of [db/schema.sql](../db/schema.sql) in your Supabase SQL editor before using the new panels.

<!-- Completed items get moved here with a one-line summary of the change -->
