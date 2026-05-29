import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex-1 grid-bg flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-surface border border-border">
          <Compass className="h-6 w-6 text-fg-muted" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Trip not found
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          That trip code didn&apos;t turn up anything. Double-check it, or start a
          new trip.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </main>
  );
}
