'use client';

import { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, MapPin, KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Label } from '@/components/ui/input';
import { createTrip, joinTrip } from '@/app/actions';

type Mode = 'choose' | 'create' | 'join';

export function LandingForm() {
  const [mode, setMode] = useState<Mode>('choose');
  const [pending, startTransition] = useTransition();

  function onCreate(formData: FormData) {
    startTransition(async () => {
      const res = await createTrip(formData);
      if (res?.error) toast.error(res.error);
    });
  }

  function onJoin(formData: FormData) {
    startTransition(async () => {
      const res = await joinTrip(formData);
      if (res?.error) toast.error(res.error);
    });
  }

  return (
    <div className="relative w-full max-w-xl">
      <AnimatePresence mode="wait">
        {mode === 'choose' && (
          <motion.div
            key="choose"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            <button
              onClick={() => setMode('create')}
              className="group rounded-2xl border border-border bg-surface p-6 text-left transition-all hover:border-accent/40 hover:bg-surface-2 hover:shadow-[0_30px_60px_-30px_rgba(52,211,153,0.35)]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent mb-4 transition-transform group-hover:scale-110">
                <MapPin className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold tracking-tight">
                Start a new trip
              </h3>
              <p className="mt-1 text-sm text-fg-muted">
                Plan routes, drop stops, and compare options.
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-accent">
                Begin <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </button>

            <button
              onClick={() => setMode('join')}
              className="group rounded-2xl border border-border bg-surface p-6 text-left transition-all hover:border-accent/40 hover:bg-surface-2 hover:shadow-[0_30px_60px_-30px_rgba(52,211,153,0.35)]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent mb-4 transition-transform group-hover:scale-110">
                <KeyRound className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold tracking-tight">
                Open existing trip
              </h3>
              <p className="mt-1 text-sm text-fg-muted">
                Got a 6-character code? Hop right in.
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-accent">
                Enter code <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </button>
          </motion.div>
        )}

        {mode === 'create' && (
          <motion.form
            key="create"
            action={onCreate}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl border border-border bg-surface p-6 space-y-4"
          >
            <div className="space-y-1">
              <h3 className="text-base font-semibold tracking-tight">
                New trip
              </h3>
              <p className="text-sm text-fg-muted">
                We&apos;ll generate a shareable 6-char code for collaborators.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Trip name</Label>
              <Input
                id="name"
                name="name"
                placeholder="PNW summer loop"
                autoFocus
                required
                maxLength={80}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="2 weeks, ending at the Oregon coast"
                maxLength={400}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="travelers">Travelers</Label>
              <Input
                id="travelers"
                name="travelers"
                type="number"
                min={1}
                max={20}
                defaultValue={2}
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setMode('choose')}
                disabled={pending}
              >
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={pending}>
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    Create trip
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </motion.form>
        )}

        {mode === 'join' && (
          <motion.form
            key="join"
            action={onJoin}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl border border-border bg-surface p-6 space-y-4"
          >
            <div className="space-y-1">
              <h3 className="text-base font-semibold tracking-tight">
                Open trip
              </h3>
              <p className="text-sm text-fg-muted">
                Enter the 6-character code you were sent.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Trip code</Label>
              <Input
                id="code"
                name="code"
                placeholder="A2B7K9"
                autoFocus
                required
                minLength={6}
                maxLength={6}
                autoComplete="off"
                className="font-mono text-center text-2xl tracking-[0.4em] uppercase h-14"
                style={{ letterSpacing: '0.4em' }}
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setMode('choose')}
                disabled={pending}
              >
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={pending}>
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Opening…
                  </>
                ) : (
                  <>
                    Open trip
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
