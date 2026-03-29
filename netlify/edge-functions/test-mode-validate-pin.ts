/**
 * POST /api/test-mode/validate-pin — Build 007
 *
 * Validates a PIN entry against the bcrypt hash stored server-side.
 * Called by the deployed app login screen — no Authorization required.
 * Rate-limited: 5 attempts per project_id per minute.
 *
 * The hash is never returned to the client; only { valid: bool } is sent.
 *
 * Error codes:
 *   400 — PIN format invalid (not 4–6 digits)
 *   403 — Test Mode disabled for this project
 *   404 — Project not found
 *   422 — PIN not configured yet
 *   429 — Rate limit exceeded (5 attempts / min)
 */

import { supabaseAdmin } from './_lib/supabaseAdmin.ts';
import * as bcrypt from 'https://esm.sh/bcryptjs@2.4.3';

// ── Simple in-memory rate limiter (resets between function cold-starts) ───
// In production, replace with a Redis/Upstash-backed implementation.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxAttempts: number, windowSeconds: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }

  if (entry.count >= maxAttempts) return false;

  entry.count++;
  return true;
}

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let body: { project_id: string; pin: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Malformed JSON', { status: 400 });
  }

  const { project_id, pin } = body;

  // ── Validate PIN format ───────────────────────────────────────────────
  if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
    return Response.json({ valid: false }, { status: 400 });
  }

  // ── Rate limit ────────────────────────────────────────────────────────
  const allowed = checkRateLimit(`test_pin:${project_id}`, 5, 60);
  if (!allowed) {
    return Response.json({ error: 'Too many attempts' }, { status: 429 });
  }

  // ── Fetch hashed PIN from project_settings (Build 013) ────────────────
  const { data, error } = await supabaseAdmin
    .from('project_settings')
    .select('test_mode_enabled, test_mode_pin_hash')
    .eq('project_id', project_id)
    .single();

  if (error || !data) {
    return Response.json({ valid: false }, { status: 404 });
  }

  if (!data.test_mode_enabled) {
    return Response.json({ valid: false, reason: 'disabled' }, { status: 403 });
  }

  if (!data.test_mode_pin_hash) {
    return Response.json({ valid: false, reason: 'not_configured' }, { status: 422 });
  }

  // ── bcrypt compare (server-side only) ─────────────────────────────────
  const match = await bcrypt.compare(pin, data.test_mode_pin_hash as string);
  return Response.json({ valid: match });
};

export const config = { path: '/api/test-mode/validate-pin' };
