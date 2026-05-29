'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Compass, Copy, Check, GitCompareArrows, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTripStore } from '@/store/trip-store';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export function TripHeader() {
  const trip = useTripStore((s) => s.trip);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(trip.name);

  async function copyCode() {
    await navigator.clipboard.writeText(trip.code);
    setCopied(true);
    toast.success('Trip code copied');
    setTimeout(() => setCopied(false), 1500);
  }

  async function saveName() {
    if (!name.trim() || name === trip.name) {
      setEditing(false);
      setName(trip.name);
      return;
    }
    const supabase = createClient();
    await supabase.from('trips').update({ name }).eq('id', trip.id);
    useTripStore.setState((s) => ({ trip: { ...s.trip, name } }));
    setEditing(false);
  }

  return (
    <header className="flex items-center gap-3 border-b border-border bg-surface/60 backdrop-blur-md px-4 h-14 shrink-0">
      <Link
        href="/"
        className="flex items-center gap-2 text-fg hover:text-accent transition-colors"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/10 text-accent">
          <Compass className="h-4 w-4" />
        </div>
        <span className="font-semibold tracking-tight hidden sm:inline">
          Overland
        </span>
      </Link>

      <div className="h-5 w-px bg-border" />

      {editing ? (
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveName();
            if (e.key === 'Escape') {
              setName(trip.name);
              setEditing(false);
            }
          }}
          autoFocus
          className="h-8 w-64 text-sm"
          maxLength={80}
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="group flex items-center gap-2 text-sm font-medium text-fg hover:text-accent transition-colors min-w-0"
        >
          <span className="truncate">{trip.name}</span>
          <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </button>
      )}

      <div className="flex-1" />

      <button
        onClick={copyCode}
        className={cn(
          'flex items-center gap-2 rounded-lg border border-border bg-surface px-3 h-8 text-xs font-mono uppercase tracking-[0.2em] transition-all',
          'hover:border-accent/40 hover:text-accent',
          copied && 'border-accent/60 text-accent',
        )}
        aria-label="Copy trip code"
      >
        <span>{trip.code}</span>
        {copied ? (
          <Check className="h-3 w-3" />
        ) : (
          <Copy className="h-3 w-3 opacity-60" />
        )}
      </button>

      <Button variant="outline" size="sm" asChild>
        <Link href={`/trip/${trip.code}/compare`}>
          <GitCompareArrows className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Compare</span>
        </Link>
      </Button>
    </header>
  );
}
