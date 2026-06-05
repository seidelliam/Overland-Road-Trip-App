'use client';

import { useState } from 'react';
import { Sparkles, Plus, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Textarea, Label } from '@/components/ui/input';
import { useTripStore } from '@/store/trip-store';
import { CATEGORY_META, type Stop, type AISuggestion } from '@/lib/types';
import { toast } from 'sonner';

import { useShallow } from '@/store/trip-store';

const selectTrip = (s: any) => s.trip;
const selectActiveRouteId = (s: any) => s.activeRouteId;
const selectActiveRoute = (s: any) => s.activeRoute();
const selectStopsForActive = (s: any): Stop[] =>
  s.activeRouteId ? s.stopsForRoute(s.activeRouteId) : [];
const selectAddStop = (s: any) => s.addStop;
const selectSuggestions = (s: any): AISuggestion[] => s.aiSuggestions;
const selectSetSuggestions = (s: any) => s.setAiSuggestions;
const selectDismissSuggestion = (s: any) => s.dismissSuggestion;
const selectSetHovered = (s: any) => s.setHoveredSuggestion;
const selectHoveredId = (s: any) => s.hoveredSuggestionId;
const selectBudgetTarget = (s: any): number | null => s.budgetTarget;
// "Spent so far" mirrors the budget panel: all stop costs + budget items + the
// active route's gas. Used to tell Claude how much budget is left.
const selectSpent = (s: any): number =>
  s.tripTotal() + (s.activeRouteId ? s.gasCostForRoute(s.activeRouteId) : 0);

export function AIPanel() {
  const trip = useTripStore(selectTrip);
  const activeRouteId = useTripStore(selectActiveRouteId);
  const activeRoute = useTripStore(selectActiveRoute);
  const stops = useTripStore(useShallow(selectStopsForActive));
  const addStop = useTripStore(selectAddStop);
  const suggestions = useTripStore(useShallow(selectSuggestions));
  const setSuggestions = useTripStore(selectSetSuggestions);
  const dismissSuggestion = useTripStore(selectDismissSuggestion);
  const setHovered = useTripStore(selectSetHovered);
  const hoveredId = useTripStore(selectHoveredId);
  const budgetTarget = useTripStore(selectBudgetTarget);
  const spent = useTripStore(selectSpent);

  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function generate() {
    if (!activeRouteId) {
      toast.error('Pick a route first');
      return;
    }
    setLoading(true);
    setSuggestions([]);
    setOpen(true);
    try {
      const res = await fetch('/api/ai-suggest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          trip: {
            name: trip.name,
            description: trip.description,
            travelers: trip.travelers,
            start_date: trip.start_date,
            end_date: trip.end_date,
          },
          route: {
            name: activeRoute?.name,
            notes: activeRoute?.notes,
          },
          stops: stops.map((s) => ({
            name: s.name,
            category: s.category,
            address: s.address,
            position: s.position,
          })),
          budget:
            budgetTarget != null
              ? {
                  target: budgetTarget,
                  spent,
                  remaining: Math.max(0, budgetTarget - spent),
                }
              : undefined,
          prompt: prompt.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? 'Could not get suggestions.');
        return;
      }
      const data = await res.json();
      const incoming: AISuggestion[] = (data.suggestions ?? []).map(
        (s: Omit<AISuggestion, 'id'>) => ({
          ...s,
          id:
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `${s.name}-${s.lng},${s.lat}`,
        }),
      );
      setSuggestions(incoming);
      if (!incoming.length) {
        toast.info("Claude didn't return any suggestions for this prompt.");
      }
    } catch (err) {
      toast.error('Network error reaching Claude.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function addSuggestion(s: AISuggestion) {
    if (!activeRouteId) return;
    await addStop({
      routeId: activeRouteId,
      name: s.name,
      lng: s.lng,
      lat: s.lat,
      address: s.description,
      category: s.category,
      estimated_cost: s.estimated_cost ?? null,
    });
    toast.success(`Added ${s.name}`);
    dismissSuggestion(s.id);
  }

  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-accent/5 via-surface to-surface p-3 space-y-3 relative overflow-hidden">
      <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-accent/10 blur-2xl pointer-events-none" />

      <button
        onClick={() => setOpen(!open)}
        className="relative w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-fg">AI suggestions</div>
            <div className="text-xs text-fg-muted">
              Get ideas from Claude
            </div>
          </div>
        </div>
      </button>

      <AnimatePresence>
        {(open || suggestions.length > 0) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-3 overflow-hidden relative"
          >
            <div className="space-y-1.5">
              <Label htmlFor="ai-prompt">What are you looking for?</Label>
              <Textarea
                id="ai-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Best scenic stops between my current waypoints, or hidden gems for a foodie trip…"
                className="min-h-16 text-xs"
              />
            </div>

            <Button
              onClick={generate}
              disabled={loading}
              size="sm"
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Thinking…
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Suggest stops
                </>
              )}
            </Button>

            {suggestions.length > 0 && (
              <p className="text-[11px] text-fg-muted pt-1">
                Shown as dashed pins on the map — hover either to preview, click{' '}
                <Plus className="inline h-3 w-3 -mt-0.5" /> to add.
              </p>
            )}

            {suggestions.length > 0 && (
              <ul className="space-y-1.5 pt-1">
                {suggestions.map((s, i) => {
                  const meta = CATEGORY_META[s.category];
                  const isHovered = hoveredId === s.id;
                  return (
                    <motion.li
                      key={s.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onMouseEnter={() => setHovered(s.id)}
                      onMouseLeave={() => setHovered(null)}
                      className={`group rounded-lg border bg-surface p-2.5 transition-colors ${
                        isHovered ? 'border-accent' : 'border-border'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs"
                          style={{
                            background: meta.color + '22',
                            color: meta.color,
                          }}
                        >
                          {meta.emoji}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-fg truncate">
                              {s.name}
                            </span>
                            {s.estimated_cost != null && (
                              <span className="shrink-0 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent tabular-nums">
                                {s.estimated_cost > 0
                                  ? `≈ $${Math.round(s.estimated_cost).toLocaleString()}`
                                  : 'Free'}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-fg-muted line-clamp-2 mt-0.5">
                            {s.description}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => addSuggestion(s)}
                            className="h-6 w-6 grid place-items-center rounded-md bg-accent/10 text-accent hover:bg-accent hover:text-bg transition-colors"
                            aria-label="Add to route"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => dismissSuggestion(s.id)}
                            className="h-6 w-6 grid place-items-center rounded-md text-fg-muted hover:text-fg hover:bg-bg/50 transition-colors"
                            aria-label="Dismiss"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
