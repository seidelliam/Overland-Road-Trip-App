'use client';

import { useState } from 'react';
import { Plus, MoreVertical, Copy, Trash2, Palette } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useTripStore } from '@/store/trip-store';
import { ROUTE_COLORS, type Route } from '@/lib/types';
import { cn } from '@/lib/utils';

import { useShallow } from '@/store/trip-store';

const selectRoutes = (s: any): Route[] => s.routes;
const selectActiveRouteId = (s: any) => s.activeRouteId;
const selectSetActiveRoute = (s: any) => s.setActiveRoute;
const selectAddRoute = (s: any) => s.addRoute;
const selectUpdateRoute = (s: any) => s.updateRoute;
const selectRemoveRoute = (s: any) => s.removeRoute;
const selectDuplicateRoute = (s: any) => s.duplicateRoute;

export function RouteTabs() {
  const routes = useTripStore(useShallow(selectRoutes));
  const activeRouteId = useTripStore(selectActiveRouteId);
  const setActiveRoute = useTripStore(selectSetActiveRoute);
  const addRoute = useTripStore(selectAddRoute);
  const updateRoute = useTripStore(selectUpdateRoute);
  const removeRoute = useTripStore(selectRemoveRoute);
  const duplicateRoute = useTripStore(selectDuplicateRoute);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {routes.map((r) => {
        const isActive = r.id === activeRouteId;
        return (
          <div key={r.id} className="relative">
            {editingId === r.id ? (
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => {
                  if (editName.trim() && editName !== r.name) {
                    updateRoute(r.id, { name: editName.trim() });
                  }
                  setEditingId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') {
                    setEditingId(null);
                  }
                }}
                className="h-8 px-3 rounded-lg border bg-surface text-sm w-32"
                style={{ borderColor: r.color }}
                maxLength={40}
              />
            ) : (
              <button
                onClick={() => setActiveRoute(r.id)}
                onDoubleClick={() => {
                  setEditName(r.name);
                  setEditingId(r.id);
                }}
                className={cn(
                  'group h-8 pl-3 pr-1 rounded-lg border text-sm font-medium flex items-center gap-2 transition-all',
                  isActive
                    ? 'bg-surface-2 text-fg shadow-[inset_0_0_0_1px_var(--color-border-strong)]'
                    : 'bg-transparent text-fg-muted border-transparent hover:bg-surface',
                )}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ background: r.color }}
                />
                <span>{r.name}</span>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <span
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        'h-6 w-6 grid place-items-center rounded text-fg-muted hover:text-fg hover:bg-bg/40 transition-all',
                        isActive
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100',
                      )}
                      role="button"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </span>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      align="end"
                      sideOffset={6}
                      className="z-50 min-w-[180px] rounded-lg border border-border bg-surface shadow-2xl p-1 text-sm"
                    >
                      <DropdownMenu.Item
                        onSelect={() => {
                          setEditName(r.name);
                          setEditingId(r.id);
                        }}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-surface-2 outline-none"
                      >
                        <Palette className="h-3.5 w-3.5 text-fg-muted" />
                        Rename
                      </DropdownMenu.Item>
                      <DropdownMenu.Sub>
                        <DropdownMenu.SubTrigger className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-surface-2 outline-none">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ background: r.color }}
                          />
                          Color
                        </DropdownMenu.SubTrigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.SubContent className="z-50 rounded-lg border border-border bg-surface shadow-2xl p-2 grid grid-cols-3 gap-1.5">
                            {ROUTE_COLORS.map((c) => (
                              <DropdownMenu.Item
                                key={c}
                                onSelect={() => updateRoute(r.id, { color: c })}
                                className="h-6 w-6 rounded-md cursor-pointer outline-none hover:scale-110 transition-transform"
                                style={{ background: c }}
                              />
                            ))}
                          </DropdownMenu.SubContent>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Sub>
                      <DropdownMenu.Item
                        onSelect={() => duplicateRoute(r.id)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-surface-2 outline-none"
                      >
                        <Copy className="h-3.5 w-3.5 text-fg-muted" />
                        Duplicate
                      </DropdownMenu.Item>
                      {routes.length > 1 && (
                        <DropdownMenu.Item
                          onSelect={() => {
                            if (
                              confirm(`Delete ${r.name}? All its stops will be removed.`)
                            ) {
                              removeRoute(r.id);
                            }
                          }}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-danger/10 text-danger outline-none"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </DropdownMenu.Item>
                      )}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </button>
            )}
          </div>
        );
      })}

      <button
        onClick={addRoute}
        className="h-8 w-8 grid place-items-center rounded-lg text-fg-muted hover:text-accent hover:bg-surface transition-colors"
        aria-label="Add route"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
