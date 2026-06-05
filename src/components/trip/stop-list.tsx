'use client';

import { useState } from 'react';
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  Trash2,
  Pencil,
  ArrowDown,
  Bed,
  DollarSign,
  ExternalLink,
  Calendar,
  Loader2,
} from 'lucide-react';
import { useTripStore } from '@/store/trip-store';
import {
  CATEGORY_META,
  type Route,
  type Stop,
  type StopCategory,
  type Trip,
} from '@/lib/types';
import { Input, Textarea, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { formatCurrency, formatDistance, formatDuration, cn } from '@/lib/utils';
import { usePlaceInfo } from '@/lib/use-place-photo';
import { useShallow } from '@/store/trip-store';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

const selectActiveRouteId = (s: any) => s.activeRouteId;
const selectStopsForActive = (s: any): Stop[] =>
  s.activeRouteId ? s.stopsForRoute(s.activeRouteId) : [];
const selectActiveRoute = (s: any): Route | undefined => s.activeRoute();
const selectTrip = (s: any): Trip => s.trip;
const selectReorderStops = (s: any) => s.reorderStops;

export function StopList() {
  const activeRouteId = useTripStore(selectActiveRouteId);
  const stops = useTripStore(useShallow(selectStopsForActive));
  const activeRoute = useTripStore(selectActiveRoute);
  const trip = useTripStore(selectTrip);
  const reorderStops = useTripStore(selectReorderStops);
  const [editingStop, setEditingStop] = useState<Stop | null>(null);
  const [detailStop, setDetailStop] = useState<Stop | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // Insertion gap the dragged stop will land in (0 = before first, N = after
  // last). Lets us drop *between* stops rather than on top of one.
  const [dropGap, setDropGap] = useState<number | null>(null);

  if (!activeRouteId) {
    return (
      <div className="text-sm text-fg-muted text-center py-6">
        Pick a route to start dropping stops.
      </div>
    );
  }

  if (stops.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
        <div className="text-sm font-medium text-fg">No stops yet</div>
        <div className="text-xs text-fg-muted mt-1">
          Search above or click <kbd className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface border border-border">+ Stop</kbd>{' '}
          to drop a pin on the map.
        </div>
      </div>
    );
  }

  const hasOrigin = trip?.origin_lng != null && trip?.origin_lat != null;
  const hasDestination =
    trip?.destination_lng != null && trip?.destination_lat != null;
  const legs = activeRoute?.legs ?? null;
  // Origin (when set) occupies legs[0], so inter-stop legs are offset by one.
  const originOffset = hasOrigin ? 1 : 0;
  const legBetween = (idx: number) => legs?.[idx + originOffset] ?? null;
  const dragging = dragIndex !== null;

  // Deterministic reorder used by the up/down buttons — works on touch devices
  // where native HTML5 drag-and-drop never fires.
  function moveStop(from: number, to: number) {
    if (to < 0 || to >= stops.length || to === from) return;
    const reordered = [...stops];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    reorderStops(
      activeRouteId,
      reordered.map((s) => s.id),
    );
  }

  function commitDrop() {
    if (dragIndex === null || dropGap === null) {
      setDragIndex(null);
      setDropGap(null);
      return;
    }
    const reordered = [...stops];
    const [moved] = reordered.splice(dragIndex, 1);
    // Removing the dragged item shifts everything after it down by one.
    const target = dragIndex < dropGap ? dropGap - 1 : dropGap;
    if (target !== dragIndex) {
      reordered.splice(target, 0, moved);
      reorderStops(
        activeRouteId,
        reordered.map((s) => s.id),
      );
    }
    setDragIndex(null);
    setDropGap(null);
  }

  return (
    <>
      <ul
        className="flex flex-col"
        onDragOver={(e) => dragging && e.preventDefault()}
        onDrop={commitDrop}
      >
        {hasOrigin && !dragging && (
          <LegConnector
            leg={legs?.[0] ?? null}
            label={`from ${trip.origin_label ?? 'start'}`}
          />
        )}
        {stops.map((stop, idx) => {
          const meta = CATEGORY_META[stop.category];
          const next = stops[idx + 1];
          return (
            <li key={stop.id}>
              <DropIndicator active={dragging && dropGap === idx} />
              <div
                draggable
                onDragStart={(e) => {
                  setDragIndex(idx);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDropGap(null);
                }}
                onDragOver={(e) => {
                  if (!dragging) return;
                  e.preventDefault();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const after = e.clientY > rect.top + rect.height / 2;
                  setDropGap(after ? idx + 1 : idx);
                }}
                onDrop={(e) => {
                  e.stopPropagation();
                  commitDrop();
                }}
                className={cn(
                  'group flex items-start gap-2 rounded-lg border border-transparent hover:border-border hover:bg-surface px-2 py-2 transition-all',
                  dragIndex === idx && 'opacity-40',
                )}
              >
                <div className="flex flex-col items-center pt-0.5 select-none">
                  <button
                    type="button"
                    onClick={() => moveStop(idx, idx - 1)}
                    disabled={idx === 0}
                    aria-label="Move up"
                    className="grid h-5 w-5 place-items-center rounded text-fg-subtle hover:text-fg hover:bg-bg/40 disabled:opacity-20 disabled:pointer-events-none"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <GripVertical className="hidden h-3 w-3 text-fg-subtle opacity-0 transition-opacity cursor-grab active:cursor-grabbing group-hover:opacity-100 lg:block" />
                  <button
                    type="button"
                    onClick={() => moveStop(idx, idx + 1)}
                    disabled={idx === stops.length - 1}
                    aria-label="Move down"
                    className="grid h-5 w-5 place-items-center rounded text-fg-subtle hover:text-fg hover:bg-bg/40 disabled:opacity-20 disabled:pointer-events-none"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold mt-0.5"
                  style={{
                    background: meta.color + '22',
                    color: meta.color,
                    border: `1px solid ${meta.color}44`,
                  }}
                >
                  {idx + 1}
                </div>

                <button
                  type="button"
                  onClick={() => setDetailStop(stop)}
                  className="flex-1 min-w-0 text-left cursor-pointer"
                  title="View details & photos"
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium text-fg truncate group-hover:text-accent transition-colors">
                      {stop.name}
                    </span>
                    <CategoryBadge category={stop.category} />
                  </div>
                  {stop.address && (
                    <div className="text-xs text-fg-muted truncate">
                      {stop.address}
                    </div>
                  )}
                  {(stop.estimated_cost || stop.nights > 0) && (
                    <div className="flex items-center gap-3 text-xs text-fg-muted mt-1">
                      {stop.estimated_cost && (
                        <span className="inline-flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {formatCurrency(Number(stop.estimated_cost))}
                        </span>
                      )}
                      {stop.nights > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Bed className="h-3 w-3" />
                          {stop.nights}{' '}
                          {stop.nights === 1 ? 'night' : 'nights'}
                        </span>
                      )}
                    </div>
                  )}
                </button>

                <div className="flex items-center gap-0.5 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
                  <button
                    onClick={() => setEditingStop(stop)}
                    className="h-7 w-7 grid place-items-center rounded-md text-fg-muted hover:text-fg hover:bg-bg/40"
                    aria-label="Edit stop"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Remove ${stop.name}?`)) {
                        useTripStore.getState().removeStop(stop.id);
                      }
                    }}
                    className="h-7 w-7 grid place-items-center rounded-md text-fg-muted hover:text-danger hover:bg-danger/10"
                    aria-label="Remove stop"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Per-leg drive distance to the next stop. Hidden mid-drag so
                  the insertion indicators read cleanly. */}
              {next && !dragging && <LegConnector leg={legBetween(idx)} />}
            </li>
          );
        })}
        <DropIndicator active={dragging && dropGap === stops.length} />
        {hasDestination && !dragging && (
          <LegConnector
            leg={legs?.[stops.length - 1 + originOffset] ?? null}
            label={`to ${trip.destination_label ?? 'destination'}`}
          />
        )}
      </ul>

      {detailStop && (
        <StopDetailDialog
          stop={detailStop}
          onClose={() => setDetailStop(null)}
          onEdit={() => {
            setEditingStop(detailStop);
            setDetailStop(null);
          }}
        />
      )}

      {editingStop && (
        <EditStopDialog
          stop={editingStop}
          onClose={() => setEditingStop(null)}
        />
      )}
    </>
  );
}

function CategoryBadge({ category }: { category: StopCategory }) {
  const meta = CATEGORY_META[category];
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wide"
      style={{
        background: meta.color + '15',
        color: meta.color,
      }}
    >
      <span>{meta.emoji}</span>
      <span>{meta.label}</span>
    </span>
  );
}

// The connector shown between two consecutive stops: an arrow plus the actual
// driving distance and time for that leg (falls back to a generic label until
// the route geometry has been fetched).
function LegConnector({
  leg,
  label,
}: {
  leg: { distance: number; duration: number } | null;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-2 pl-7 py-0.5 text-[11px] text-fg-subtle">
      <ArrowDown className="h-3 w-3 shrink-0" />
      {leg ? (
        <span className="flex items-center gap-1.5">
          <span className="font-mono text-fg-muted">
            {formatDistance(leg.distance)}
          </span>
          <span className="opacity-50">·</span>
          <span className="font-mono">{formatDuration(leg.duration)}</span>
          {label && <span className="opacity-80">{label}</span>}
        </span>
      ) : (
        <span>drive {label ?? 'to next'}</span>
      )}
    </div>
  );
}

// Thin accent line marking where a dragged stop will be inserted. Collapses to
// zero height when inactive so the list doesn't jump as the pointer moves.
function DropIndicator({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none mx-2 flex items-center gap-1 overflow-hidden transition-all duration-150',
        active ? 'h-4 opacity-100' : 'h-0 opacity-0',
      )}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
      <span className="h-0.5 flex-1 rounded-full bg-accent" />
    </div>
  );
}

// Read-oriented detail card shown when a stop is clicked: a hero photo and a
// short description from Wikipedia/Wikimedia, plus the trip-specific facts
// (cost, nights, arrival, notes). "Edit" hands off to the edit dialog.
function StopDetailDialog({
  stop,
  onClose,
  onEdit,
}: {
  stop: Stop;
  onClose: () => void;
  onEdit: () => void;
}) {
  const meta = CATEGORY_META[stop.category];
  const { info, loading } = usePlaceInfo(stop.name, stop.lat, stop.lng);
  const photos = info?.photos ?? [];
  const [active, setActive] = useState(0);
  const hero = photos[active] ?? photos[0] ?? null;
  const sourceLabel = info?.source === 'google' ? 'View on Google Maps' : 'Wikipedia';

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="p-0 overflow-hidden">
        {/* Hero */}
        <div className="relative h-44 w-full bg-surface-2">
          {loading ? (
            <div className="flex h-full w-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-fg-muted" />
            </div>
          ) : hero ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hero.url}
                alt={stop.name}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/20 to-transparent" />
              {hero.attribution && (
                <span className="absolute bottom-1.5 right-2 text-[9px] text-white/70 drop-shadow">
                  © {hero.attribution}
                </span>
              )}
            </>
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-5xl"
              style={{ background: meta.color + '18' }}
            >
              {meta.emoji}
            </div>
          )}
          <span
            className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white backdrop-blur-sm"
            style={{ background: meta.color + 'cc' }}
          >
            <span>{meta.emoji}</span>
            <span>{meta.label}</span>
          </span>
        </div>

        {/* Thumbnail strip (when more than one photo) */}
        {photos.length > 1 && (
          <div className="flex gap-1.5 px-5 pt-3">
            {photos.map((p, i) => (
              <button
                key={p.url}
                onClick={() => setActive(i)}
                className={cn(
                  'h-10 w-14 shrink-0 overflow-hidden rounded-md border transition-opacity',
                  i === active
                    ? 'border-accent'
                    : 'border-border opacity-60 hover:opacity-100',
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="space-y-4 p-5">
          <div>
            <DialogTitle>{stop.name}</DialogTitle>
            {stop.address && (
              <DialogDescription className="mt-1">
                {stop.address}
              </DialogDescription>
            )}
          </div>

          {info?.description && (
            <p className="text-sm leading-relaxed text-fg-muted">
              {info.description}{' '}
              {info.sourceUrl && (
                <a
                  href={info.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                >
                  {sourceLabel}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </p>
          )}
          {!loading && !info?.description && !hero && (
            <p className="text-sm text-fg-subtle">
              No background info found for this place — you can still add your
              own notes below.
            </p>
          )}

          {(stop.estimated_cost != null ||
            stop.category === 'overnight' ||
            stop.arrival_date) && (
            <div className="grid grid-cols-2 gap-2">
              {stop.estimated_cost != null && (
                <Fact
                  icon={<DollarSign className="h-3.5 w-3.5" />}
                  label="Est. cost"
                  value={formatCurrency(Number(stop.estimated_cost))}
                />
              )}
              {stop.category === 'overnight' && (
                <Fact
                  icon={<Bed className="h-3.5 w-3.5" />}
                  label="Nights"
                  value={String(stop.nights || 0)}
                />
              )}
              {stop.arrival_date && (
                <Fact
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="Arrival"
                  value={stop.arrival_date}
                />
              )}
            </div>
          )}

          {stop.notes && (
            <div className="rounded-lg border border-border bg-surface-2/50 p-3">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-fg-muted">
                Notes
              </div>
              <div className="whitespace-pre-wrap text-sm text-fg">
                {stop.notes}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-fg-muted">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-0.5 text-sm font-semibold text-fg">{value}</div>
    </div>
  );
}

function EditStopDialog({
  stop,
  onClose,
}: {
  stop: Stop;
  onClose: () => void;
}) {
  const updateStop = useTripStore((s) => s.updateStop);
  const [name, setName] = useState(stop.name);
  const [notes, setNotes] = useState(stop.notes ?? '');
  const [category, setCategory] = useState<StopCategory>(stop.category);
  const [estimatedCost, setEstimatedCost] = useState(
    stop.estimated_cost?.toString() ?? '',
  );
  const [nights, setNights] = useState(stop.nights ?? 0);

  async function save() {
    await updateStop(stop.id, {
      name: name.trim() || stop.name,
      notes: notes.trim() || null,
      category,
      estimated_cost: estimatedCost ? Number(estimatedCost) : null,
      nights: category === 'overnight' ? Math.max(0, nights) : 0,
    });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit stop</DialogTitle>
          <DialogDescription>
            Update notes, mark as overnight, or set an estimated cost.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="stop-name">Name</Label>
            <Input
              id="stop-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Category</Label>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-2 w-full h-10 px-3 rounded-lg border border-border bg-surface text-sm text-left hover:border-border-strong">
                  <span>{CATEGORY_META[category].emoji}</span>
                  <span>{CATEGORY_META[category].label}</span>
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="z-50 min-w-[200px] rounded-lg border border-border bg-surface shadow-2xl p-1 text-sm"
                  align="start"
                  sideOffset={4}
                >
                  {(Object.keys(CATEGORY_META) as StopCategory[]).map((c) => (
                    <DropdownMenu.Item
                      key={c}
                      onSelect={() => setCategory(c)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-surface-2 outline-none"
                    >
                      <span>{CATEGORY_META[c].emoji}</span>
                      <span>{CATEGORY_META[c].label}</span>
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="stop-notes">Notes</Label>
            <Textarea
              id="stop-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Park hours, reservation info, why this place is great…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="stop-cost">Est. cost</Label>
              <Input
                id="stop-cost"
                type="number"
                step="1"
                min="0"
                placeholder="0"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
              />
            </div>
            {category === 'overnight' && (
              <div className="space-y-1.5">
                <Label htmlFor="stop-nights">Nights</Label>
                <Input
                  id="stop-nights"
                  type="number"
                  min="0"
                  max="30"
                  value={nights}
                  onChange={(e) => setNights(Number(e.target.value))}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
