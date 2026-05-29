import { LandingForm } from '@/components/landing/landing-form';
import { Compass, Sparkles, Map as MapIcon, Wallet } from 'lucide-react';

const FEATURES = [
  {
    icon: MapIcon,
    title: 'Visual route planning',
    description:
      'Drop pins on a beautiful map. Compare multiple routes for the same trip side-by-side.',
  },
  {
    icon: Sparkles,
    title: 'AI suggestions',
    description:
      'Stuck for ideas? Claude suggests stops, scenic detours, and overnight options.',
  },
  {
    icon: Wallet,
    title: 'Budget + overnights',
    description:
      'Track gas, food, and lodging. Mark which stops are sleep nights.',
  },
];

export default function Home() {
  return (
    <main className="relative flex-1 grid-bg overflow-hidden">
      {/* Hero glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full bg-accent/10 blur-[120px]" />

      <div className="relative mx-auto flex max-w-6xl flex-col px-6 py-16 sm:py-24">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-16 animate-fade-up">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Compass className="h-5 w-5" />
          </div>
          <span className="font-semibold tracking-tight text-fg">Overland</span>
        </div>

        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-start">
          {/* Left: pitch */}
          <div className="space-y-8 animate-fade-up" style={{ animationDelay: '50ms' }}>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-fg-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot" />
              Plan your next road trip
            </div>

            <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
              Map the route.{' '}
              <span className="text-accent">Compare the options.</span>{' '}
              Hit the road.
            </h1>

            <p className="text-lg text-fg-muted max-w-xl leading-relaxed">
              An interactive planner for road trips. Sketch multiple routes for
              the same trip, drop stops along the way, get AI ideas for what
              not to miss, and share a code so everyone&apos;s on the same map.
            </p>

            <ul className="grid gap-4 sm:gap-3 pt-4">
              {FEATURES.map(({ icon: Icon, title, description }, i) => (
                <li
                  key={title}
                  className="flex gap-3 animate-fade-up"
                  style={{ animationDelay: `${100 + i * 50}ms` }}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface border border-border text-accent">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-fg">{title}</div>
                    <div className="text-sm text-fg-muted">{description}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: form card */}
          <div
            className="animate-fade-up lg:sticky lg:top-12"
            style={{ animationDelay: '200ms' }}
          >
            <LandingForm />
          </div>
        </div>

        <footer className="mt-20 sm:mt-32 flex items-center justify-between border-t border-border pt-6 text-xs text-fg-subtle">
          <div>Built for wanderers.</div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline">Mapbox · Supabase · Claude</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
