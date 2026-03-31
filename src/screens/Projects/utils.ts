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

export function pctLabel(pct: number | null | undefined): string {
  if (pct == null) return '—';
  return `${Math.round(pct)}%`;
}

export function pctValue(pct: number | null): number {
  return pct ?? 0;
}

// ── Lifecycle status (derived from project phase + deploy history) ────────

export type ProjectLifecycle = 'development' | 'alpha' | 'beta' | 'production';

export function deriveLifecycle(p: { phase: string; pushed_to_production_at: string | null; status: string }): ProjectLifecycle {
  if (p.status === 'shipped' || p.pushed_to_production_at !== null) return 'production';
  if (p.phase === 'live') return 'production';
  if (p.phase === 'beta') return 'beta';
  if (p.phase === 'alpha') return 'alpha';
  return 'development';
}

export const LIFECYCLE_DISPLAY: Record<ProjectLifecycle, { label: string; bg: string; dot: string; text: string }> = {
  development: { label: 'Development', bg: '#f0f0f5', dot: '#8e8e93', text: '#3a3a3c' },
  alpha:       { label: 'Alpha',       bg: '#fff4e0', dot: '#f59e0b', text: '#92400e' },
  beta:        { label: 'Beta',        bg: '#dbeafe', dot: '#3b82f6', text: '#1e40af' },
  production:  { label: 'Production',  bg: '#dcfce7', dot: '#22c55e', text: '#15803d' },
};

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
