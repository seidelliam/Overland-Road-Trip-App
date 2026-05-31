import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { customAlphabet } from 'nanoid';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const codeAlphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const generate = customAlphabet(codeAlphabet, 6);

export function generateTripCode(): string {
  return generate();
}

export function formatDistance(meters: number | null | undefined): string {
  if (meters == null) return '—';
  const miles = meters * 0.000621371;
  return `${miles.toFixed(0)} mi`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

// A sustainable number of hours behind the wheel per day. Used to translate a
// raw drive-time total into "days on the road," which is how people actually
// plan road trips (nobody drives 45 hours straight).
export const DRIVING_HOURS_PER_DAY = 8;

export function driveDays(
  seconds: number | null | undefined,
  hoursPerDay = DRIVING_HOURS_PER_DAY,
): number | null {
  if (seconds == null || seconds <= 0) return null;
  return Math.ceil(seconds / (hoursPerDay * 3600));
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}
