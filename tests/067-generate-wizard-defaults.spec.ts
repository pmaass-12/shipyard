/**
 * tests/067-generate-wizard-defaults.spec.ts
 *
 * // regression: 067-generate-wizard-defaults
 *
 * Static verification for Build 067 — generate-wizard-defaults Supabase Edge Function.
 *
 * All tests are file-system / grep checks — no live network calls.
 * Tests that require a live Supabase environment are marked BLOCKED and
 * skipped so they do not fail the suite.
 *
 * Run: npx playwright test tests/067-generate-wizard-defaults.spec.ts
 */

import { test, expect } from '@playwright/test';
import * as fs          from 'fs';
import * as path        from 'path';

// ── Path helpers ──────────────────────────────────────────────────────────────

const ROOT       = path.resolve(__dirname, '../../');       // repo root
const MIGRATIONS = path.join(ROOT, 'migrations');
const SUPABASE   = path.join(ROOT, 'supabase', 'functions');

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

function exists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

// ── Migration: 067_feature_status_backlog.sql ─────────────────────────────────

test.describe('Build 067 — generate-wizard-defaults Edge Function', () => {

  // ── Migration gate ───────────────────────────────────────────────────────────

  test('migration file 067_feature_status_backlog.sql exists on disk', () => {
    // flaky: false
    const migPath = path.join(MIGRATIONS, '067_feature_status_backlog.sql');
    expect(exists(migPath), `Expected ${migPath} to exist`).toBe(true);
  });

  test('migration contains ALTER TYPE feature_status ADD VALUE IF NOT EXISTS backlog', () => {
    // flaky: false
    const migPath = path.join(MIGRATIONS, '067_feature_status_backlog.sql');
    const sql = read(migPath);
    expect(sql).toContain("ADD VALUE IF NOT EXISTS 'backlog'");
    // Confirm it's placed BEFORE 'design' per the PRD spec
    expect(sql).toMatch(/ADD VALUE IF NOT EXISTS\s+'backlog'\s+BEFORE\s+'design'/);
  });

  test('migration contains self-registration INSERT into schema_migrations', () => {
    // flaky: false
    const migPath = path.join(MIGRATIONS, '067_feature_status_backlog.sql');
    const sql = read(migPath);
    expect(sql).toContain('INSERT INTO schema_migrations');
    expect(sql).toContain("'067_feature_status_backlog.sql'");
    expect(sql).toContain('ON CONFLICT');
  });

  // ── Edge function exists ──────────────────────────────────────────────────────

  test('generate-wizard-defaults/index.ts exists', () => {
    // flaky: false
    const fnPath = path.join(SUPABASE, 'generate-wizard-defaults', 'index.ts');
    expect(exists(fnPath), `Expected ${fnPath} to exist`).toBe(true);
  });

  // ── Supabase _lib: env var correctness ────────────────────────────────────────

  test('supabase _lib/getAIClient.ts imports supabaseAdmin (uses SUPABASE_URL transitively)', () => {
    // flaky: false
    const filePath = path.join(SUPABASE, '_lib', 'getAIClient.ts');
    expect(exists(filePath), `Expected ${filePath} to exist`).toBe(true);
    const src = read(filePath);
    // Must import from supabaseAdmin which uses SUPABASE_URL
    expect(src).toContain("from './supabaseAdmin.ts'");
    // Must NOT reference VITE_SUPABASE_URL in actual code (comments don't count — check Deno.env)
    const denoEnvLines = src.split('\n').filter(l => l.includes('Deno.env'));
    for (const line of denoEnvLines) {
      expect(line).not.toContain('VITE_SUPABASE_URL');
    }
  });

  test('supabase _lib/supabaseAdmin.ts uses SUPABASE_URL (not VITE_SUPABASE_URL)', () => {
    // flaky: false
    const filePath = path.join(SUPABASE, '_lib', 'supabaseAdmin.ts');
    expect(exists(filePath), `Expected ${filePath} to exist`).toBe(true);
    const src = read(filePath);
    expect(src).toContain("Deno.env.get('SUPABASE_URL')");
    // Must not use frontend env var
    const codeLines = src.split('\n').filter(l => !l.trim().startsWith('*') && !l.trim().startsWith('//'));
    for (const line of codeLines) {
      expect(line).not.toContain('VITE_SUPABASE_URL');
    }
  });

  test('generate-wizard-defaults/index.ts uses SUPABASE_URL (not VITE_SUPABASE_URL)', () => {
    // flaky: false
    const filePath = path.join(SUPABASE, 'generate-wizard-defaults', 'index.ts');
    const src = read(filePath);
    // Direct inline client creation also uses SUPABASE_URL
    expect(src).toContain("Deno.env.get('SUPABASE_URL')");
    const codeLines = src.split('\n').filter(l => !l.trim().startsWith('*') && !l.trim().startsWith('//'));
    for (const line of codeLines) {
      expect(line).not.toContain('VITE_SUPABASE_URL');
    }
  });

  // ── extractErrorMessage ───────────────────────────────────────────────────────

  test('supabase _shared/extractErrorMessage.ts exists', () => {
    // flaky: false
    const filePath = path.join(SUPABASE, '_shared', 'extractErrorMessage.ts');
    expect(exists(filePath), `Expected ${filePath} to exist`).toBe(true);
  });

  test('_shared/extractErrorMessage.ts contains no instanceof Error ternary', () => {
    // flaky: false
    // The correct pattern is: if (err instanceof Error) return err.message
    // The incorrect pattern is: err instanceof Error ? err.message : ...
    const filePath = path.join(SUPABASE, '_shared', 'extractErrorMessage.ts');
    const src = read(filePath);
    // Must not contain the ternary form
    expect(src).not.toMatch(/instanceof Error\s*\?/);
    // Must contain the correct direct-return form
    expect(src).toContain('instanceof Error');
  });

  test('_shared/extractErrorMessage.ts logic matches frontend src/lib/extractErrorMessage.ts', () => {
    // flaky: false
    // Both files must export extractErrorMessage with the same 4-branch logic
    const supabasePath  = path.join(SUPABASE, '_shared', 'extractErrorMessage.ts');
    const frontendPath  = path.join(ROOT, 'shipyard', 'src', 'lib', 'extractErrorMessage.ts');
    const supabaseSrc   = read(supabasePath);
    const frontendSrc   = read(frontendPath);
    // Both must handle: instanceof Error, string, object with message, fallback
    for (const branch of ['instanceof Error', 'typeof err === \'string\'', "'message' in err"]) {
      expect(supabaseSrc).toContain(branch);
      expect(frontendSrc).toContain(branch);
    }
  });

  // ── No instanceof Error ternaries in main function file ───────────────────────

  test('generate-wizard-defaults/index.ts has no instanceof Error ternaries', () => {
    // flaky: false
    const filePath = path.join(SUPABASE, 'generate-wizard-defaults', 'index.ts');
    const src = read(filePath);
    expect(src).not.toMatch(/instanceof Error\s*\?/);
  });

  // ── Function semantics: correct column names and field values ─────────────────

  test('index.ts inserts screens using type column (not screen_type)', () => {
    // flaky: false
    // PRD deviation: actual DB column is 'type', not 'screen_type'
    const filePath = path.join(SUPABASE, 'generate-wizard-defaults', 'index.ts');
    const src = read(filePath);
    // Must contain: type: toDbScreenType(...)
    expect(src).toMatch(/type:\s*toDbScreenType\(/);
    // Must NOT pass 'screen_type' as a direct insert column
    // (it may still appear in the sanitised Claude output as a suggestion key — that's fine)
    const insertBlock = src.match(/\.insert\(\s*screens\.map[^)]+\)\s*\)/s)?.[0] ?? '';
    if (insertBlock) {
      // The insert row object must not have a screen_type key
      expect(insertBlock).not.toMatch(/screen_type:\s*[^,)]/);
    }
  });

  test('index.ts inserts features with status backlog and triage_status mvp', () => {
    // flaky: false
    const filePath = path.join(SUPABASE, 'generate-wizard-defaults', 'index.ts');
    const src = read(filePath);
    expect(src).toContain("status:        'backlog'");
    expect(src).toContain("triage_status: 'mvp'");
  });

  test('index.ts has separate try/catch for screens and features inserts', () => {
    // flaky: false
    // Both insert blocks must be individually wrapped
    const filePath = path.join(SUPABASE, 'generate-wizard-defaults', 'index.ts');
    const src = read(filePath);
    // Count try/catch blocks (excluding the top-level and body-parse ones)
    const tryCatchCount = (src.match(/\btry\s*\{/g) ?? []).length;
    // Expect at least 4: body parse, top-level, screens insert, features insert
    expect(tryCatchCount).toBeGreaterThanOrEqual(4);
    // Confirm both blocks have their own catch with extractErrorMessage
    const extractInCatch = (src.match(/catch\s*\([^)]+\)\s*\{[^}]*extractErrorMessage/g) ?? []).length;
    expect(extractInCatch).toBeGreaterThanOrEqual(2);
  });

  test('index.ts idempotency check uses COUNT query and returns skipped: true', () => {
    // flaky: false
    const filePath = path.join(SUPABASE, 'generate-wizard-defaults', 'index.ts');
    const src = read(filePath);
    expect(src).toContain("count: 'exact'");
    expect(src).toContain('skipped: true');
    expect(src).toContain('screens_created: 0, features_created: 0');
  });

  test('index.ts top-level catch always returns HTTP 200 (json helper default)', () => {
    // flaky: false
    // The json() helper defaults to status=200; the top-level catch must use it without explicit 4xx/5xx
    const filePath = path.join(SUPABASE, 'generate-wizard-defaults', 'index.ts');
    const src = read(filePath);
    // Top-level catch must return json() with no explicit non-200 status
    // Look for the closing catch block — it should NOT pass a non-200 status
    expect(src).toContain("return json({ ok: false, error: extractErrorMessage(err, 'Unexpected error') })");
    // Confirm json() helper defaults to 200
    expect(src).toMatch(/function json\([^)]+status\s*=\s*200/);
  });

  test('index.ts imports characterAnchor from _shared and applies to system prompt', () => {
    // flaky: false
    const filePath = path.join(SUPABASE, 'generate-wizard-defaults', 'index.ts');
    const src = read(filePath);
    expect(src).toContain("from '../_shared/characterAnchor.ts'");
    expect(src).toContain("characterAnchor('reeve')");
  });

  test('index.ts calls getAIClient(projectId) — not hardcoded Anthropic SDK', () => {
    // flaky: false
    const filePath = path.join(SUPABASE, 'generate-wizard-defaults', 'index.ts');
    const src = read(filePath);
    expect(src).toContain('getAIClient(projectId)');
    // Must not hardcode Anthropic SDK directly in the main handler
    expect(src).not.toMatch(/new Anthropic\(/);
  });

  // ── BLOCKED: live function invocation tests ───────────────────────────────────
  // These tests require a live Supabase environment and service role key.
  // They are skipped in CI and local static QA runs.
  // Re-enable by setting SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY env vars.

  test.skip('BLOCKED: POST with valid project_id returns { ok: true, screens_created: N, features_created: N }', async () => {
    // flaky: false
    // Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, a valid project UUID with no existing screens
    // curl -X POST <SUPABASE_URL>/functions/v1/generate-wizard-defaults \
    //   -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
    //   -H "Content-Type: application/json" \
    //   -d '{ "project_id": "<VALID_UUID>" }'
    // Expected: { ok: true, screens_created: <4-6>, features_created: <3-5> }
  });

  test.skip('BLOCKED: second POST with same project_id returns { skipped: true, screens_created: 0, features_created: 0 }', async () => {
    // flaky: false
    // Idempotency check: call same project_id twice, second call should skip
  });

  test.skip('BLOCKED: POST with no API key configured returns HTTP 200 with { ok: false, error: "..." }', async () => {
    // flaky: false
    // Project must exist but have no claude_api_key and no openrouter_api_key in project_settings
    // Expected: HTTP 200 (not 500), body: { ok: false, error: "No API key configured..." }
  });

  test.skip('BLOCKED: migration 067_feature_status_backlog.sql applied in Supabase (enum check)', async () => {
    // flaky: false
    // Verify via Supabase Dashboard or pg client:
    //   SELECT enum_range(NULL::feature_status);
    // Expected output must include 'backlog' appearing before 'design' in the enum
    // NOTE: ALTER TYPE ADD VALUE cannot run inside a transaction — apply via Dashboard SQL editor
  });

});
