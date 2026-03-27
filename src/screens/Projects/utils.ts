/**
 * Display-layer helpers for the Projects List screen.
 * These are pure functions — no Supabase, no side effects.
 */

import { formatDistanceToNow } from 'date-fns';
import type { ProjectSummary, ProjectColor, ProjectStatus } from '@/types/db';

// ── Monogram ──────────────────────────────────────────────────────────────

export function getMonogram(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

// ── Color palette ─────────────────────────────────────────────────────────

const COLOR_VARS: Record<ProjectColor, { bg: string; text: string }> = {
  blue:   { bg: 'var(--mono-blue-bg)',   text: 'var(--mono-blue-text)'   },
  purple: { bg: 'var(--mono-purple-bg)', text: 'var(--mono-purple-text)' },
  orange: { bg: 'var(--mono-orange-bg)', text: 'var(--mono-orange-text)' },
  green:  { bg: 'var(--mono-green-bg)',  text: 'var(--mono-green-text)'  },
  teal:   { bg: 'var(--mono-teal-bg)',   text: 'var(--mono-teal-text)'   },
  rose:   { bg: 'var(--mono-rose-bg)',   text: 'var(--mono-rose-text)'   },
};

export const COLOR_OPTIONS: ProjectColor[] = ['blue', 'purple', 'orange', 'green', 'teal', 'rose'];

export function getMonogramColors(color: ProjectColor) {
  return COLOR_VARS[color] ?? COLOR_VARS.blue;
}

// Fallback: deterministically pick a color from project ID if color field
// is missing (e.g. migration hasn't added the column yet).
export function colorFromId(id: string): ProjectColor {
  const sum = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return COLOR_OPTIONS[sum % COLOR_OPTIONS.length];
}

export function resolveColor(p: ProjectSummary): ProjectColor {
  return p.color ?? colorFromId(p.id);
}

// ── Status badge ──────────────────────────────────────────────────────────

export const STATUS_COLORS: Record<ProjectStatus, { bg: string; dot: string; text: string }> = {
  active:  { bg: '#dcfce7', dot: '#22c55e', text: '#15803d' },
  paused:  { bg: '#fef9c3', dot: '#eab308', text: '#854d0e' },
  stalled: { bg: '#fee2e2', dot: '#ef4444', text: '#991b1b' },
  shipped: { bg: '#ede9fe', dot: '#8b5cf6', text: '#6d28d9' },
};

export function statusLabel(status: ProjectStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// ── Progress ──────────────────────────────────────────────────────────────

export function pctLabel(pct: number | null): string {
  return pct === null ? '—' : `${pct}%`;
}

export function pctValue(pct: number | null): number {
  return pct ?? 0;
}

// ── Relative timestamps ───────────────────────────────────────────────────

export function relativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return 'Unknown';
  }
}

// ── Progress bar color by status ──────────────────────────────────────────

export function progressBarColor(status: ProjectStatus): string {
  if (status === 'active')  return '#6366f1'; // indigo
  if (status === 'paused')  return '#eab308'; // yellow
  if (status === 'stalled') return '#ef4444'; // red
  if (status === 'shipped') return '#8b5cf6'; // purple
  return '#6366f1';
}
