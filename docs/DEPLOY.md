# Shipping this for small use (family & friends)

Short version: **deploy the app to Vercel, keep the database on Supabase, skip
Railway.** Here's the reasoning and the steps.

## Why Vercel + Supabase (and not Railway)

This app is a single Next.js app that talks to a few hosted services:

- **Supabase** already hosts your Postgres database — it's a managed service, so
  there's nothing for you to run. It stays exactly as-is.
- **Mapbox / Anthropic / Google Places** are external APIs you just call.

So the only thing that needs hosting is the Next.js app itself. Vercel is the
native home for Next.js (zero-config, the framework is made by them) and you
already have an account there. **Railway would only earn its keep if you needed
to run your own Postgres or a separate long-running server — you don't, because
Supabase covers the database.** Adding it here is a second bill and a second
dashboard for no benefit.

Using your existing Vercel project is fine; just add this as a new project in
the same account/team so its env vars and domains stay separate.

## One-time setup

1. **Rotate the Anthropic key.** It was sitting in `.env.example` (which is
   committed) in plaintext. Generate a fresh key at
   <https://console.anthropic.com/settings/keys> and retire the old one before
   you push anything public. The Supabase anon key and Mapbox token are designed
   to be public, but the Anthropic key is a real secret.
2. **Push to GitHub.** Confirm `.env.local` is not tracked (`git status` should
   never show it — it's gitignored) and that `.env.example` contains only
   placeholders.
3. **Run the database migrations.** In the Supabase SQL editor, run the
   migration block at the bottom of [`db/schema.sql`](../db/schema.sql) so the
   newest columns (vehicle/gas, per-leg distances) exist.

## Deploy on Vercel

1. Vercel → **Add New → Project** → import the GitHub repo. Framework preset
   auto-detects as **Next.js**; leave build/output settings default.
2. Add the environment variables (Project → Settings → Environment Variables),
   matching [`.env.example`](../.env.example):
   - `NEXT_PUBLIC_MAPBOX_TOKEN`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY` (the freshly rotated one)
   - `GOOGLE_PLACES_API_KEY` (optional — leave empty to use Wikipedia photos)
3. Deploy. Future pushes to your default branch redeploy automatically.

## Before you share the link

- **Access model:** there is no login. A trip's 6-character code in the URL is
  the only gate — anyone with the link can view *and edit* that trip. That's
  fine for trusted family/friends, but it means trips aren't private and the
  link shouldn't be posted publicly.
- **Lock down API keys to your domain:** restrict the Mapbox token (Mapbox
  dashboard → URL restriction) and the Google Places key (Google Cloud →
  credentials) to your Vercel domain so a leaked public token can't be abused.

## Cost at this scale

All of these have free tiers that comfortably cover a handful of users:

- **Vercel** Hobby — free for personal, non-commercial use.
- **Supabase** Free tier — plenty for a few trips.
- **Mapbox** — generous free monthly map loads / API calls.
- **Anthropic** — pay-as-you-go. Only the "AI suggest" and "Auto-estimate cost"
  buttons spend tokens, and only when clicked, so usage is tiny for small use.
- **Google Places** — optional; covered by Google's monthly free credit.
