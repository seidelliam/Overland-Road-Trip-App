'use client';

import { useState } from 'react';
import { Plus, Trash2, Wallet } from 'lucide-react';
import { useTripStore } from '@/store/trip-store';
import { BUDGET_META, type BudgetCategory, type BudgetItem, type Stop } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

import { useShallow } from '@/store/trip-store';

const selectBudgetItems = (s: any): BudgetItem[] => s.budget;
const selectTripTotal = (s: any): number => s.tripTotal();
const selectAddBudgetItem = (s: any) => s.addBudgetItem;
const selectRemoveBudgetItem = (s: any) => s.removeBudgetItem;
const selectStops = (s: any): Stop[] => s.stops;
const selectGasCost = (s: any) =>
  s.activeRouteId ? s.gasCostForRoute(s.activeRouteId) : 0;

export function BudgetPanel() {
  const items = useTripStore(useShallow(selectBudgetItems));
  const tripTotal = useTripStore(selectTripTotal);
  const addBudgetItem = useTripStore(selectAddBudgetItem);
  const removeBudgetItem = useTripStore(selectRemoveBudgetItem);
  const stops = useTripStore(useShallow(selectStops));
  const gasCost = useTripStore(selectGasCost);

  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<BudgetCategory>('gas');

  // Aggregate totals by category, including stop estimated_costs
  const totalsByCategory: Record<BudgetCategory, number> = {
    gas: 0,
    food: 0,
    lodging: 0,
    activities: 0,
    other: 0,
  };
  items.forEach((i) => {
    totalsByCategory[i.category] += Number(i.amount);
  });
  // Stop costs roll into "lodging" if overnight, "activities" otherwise.
  stops.forEach((s) => {
    if (!s.estimated_cost) return;
    totalsByCategory[s.category === 'overnight' ? 'lodging' : 'activities'] +=
      Number(s.estimated_cost);
  });
  // Auto-computed fuel cost for the active route (from vehicle MPG + gas price).
  totalsByCategory.gas += gasCost;

  // tripTotal already folds in gas via totalForRoute selectors elsewhere, but
  // the trip-level total is route-agnostic, so add the active route's gas here.
  const displayTotal = tripTotal + gasCost;

  async function submit() {
    const amt = Number(amount);
    if (!label.trim() || !amt || isNaN(amt)) return;
    await addBudgetItem({ label: label.trim(), amount: amt, category });
    setLabel('');
    setAmount('');
    setShowForm(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-fg-muted uppercase tracking-wide">
          <Wallet className="h-3.5 w-3.5" />
          Trip budget
        </div>
        <div className="text-xl font-semibold tabular-nums">
          {formatCurrency(displayTotal)}
        </div>
      </div>

      {/* Category bars */}
      <div className="space-y-1.5">
        {(Object.keys(totalsByCategory) as BudgetCategory[]).map((cat) => {
          const amount = totalsByCategory[cat];
          const percent =
            displayTotal > 0 ? Math.round((amount / displayTotal) * 100) : 0;
          return (
            <div key={cat} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-fg-muted">
                  {BUDGET_META[cat].emoji} {BUDGET_META[cat].label}
                </span>
                <span className="font-mono text-fg-muted">
                  {formatCurrency(amount)}
                </span>
              </div>
              <div className="h-1 rounded-full bg-surface overflow-hidden">
                <div
                  className="h-full bg-accent/80 transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Items list */}
      {items.length > 0 && (
        <ul className="space-y-1 pt-1">
          {items.map((i) => (
            <li
              key={i.id}
              className="group flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-surface text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base">{BUDGET_META[i.category].emoji}</span>
                <span className="truncate">{i.label}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-mono tabular-nums text-fg-muted">
                  {formatCurrency(Number(i.amount))}
                </span>
                <button
                  onClick={() => removeBudgetItem(i.id)}
                  className="h-6 w-6 grid place-items-center rounded text-fg-muted opacity-0 group-hover:opacity-100 hover:text-danger transition-all"
                  aria-label="Remove"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add form */}
      {showForm ? (
        <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
          <div className="flex gap-2">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="h-9 w-9 grid place-items-center rounded-lg border border-border bg-bg text-base">
                  {BUDGET_META[category].emoji}
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="z-50 rounded-lg border border-border bg-surface p-1 text-sm shadow-2xl">
                  {(Object.keys(BUDGET_META) as BudgetCategory[]).map((c) => (
                    <DropdownMenu.Item
                      key={c}
                      onSelect={() => setCategory(c)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-surface-2 outline-none"
                    >
                      <span>{BUDGET_META[c].emoji}</span>
                      <span>{BUDGET_META[c].label}</span>
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <Input
              placeholder="What?"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="flex-1 h-9"
              autoFocus
            />
            <Input
              type="number"
              placeholder="$"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-20 h-9 font-mono"
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={submit}>
              Add
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full h-9 rounded-lg border border-dashed border-border text-sm text-fg-muted hover:text-accent hover:border-accent/40 transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Add budget item
        </button>
      )}
    </div>
  );
}
