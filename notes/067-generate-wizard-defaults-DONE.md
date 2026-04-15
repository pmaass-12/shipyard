# Build 067 — generate-wizard-defaults Edge Function: Done

**Date:** 2026-04-15
**Engineer:** Finn

---

## What was built

### `supabase/functions/generate-wizard-defaults/index.ts` (new)

- POST `{ project_id }` → seeds 4–6 screens + 3–5 features on first wizard completion
- Idempotency: checks `COUNT(*) FROM screens WHERE project_id = ?` — skips if > 0
- Reads `project_settings` for: `product_name`, `description`, `audience_type`, `monetization_type`
- Calls Claude via `getAIClient(projectId)` with `characterAnchor('reeve')` as system prompt
- Sanitises Claude output: caps at 6 screens / 5 features, validates types, filters empty names
- Screen type mapping: Claude receives richer suggestion types (dashboard/auth/form/list/detail/onboarding/settings), mapped to DB `type` enum (`page | modal | auth | dashboard`) before insert — same logic as `ScreensScreen.toDbScreenType()`
- Inserts screens via `type` column (NOT `screen_type` — PRD used incorrect column name)
- Inserts features with `status: 'backlog'`, `triage_status: 'mvp'`, `complexity` from Claude
- Partial success: screens and features each have their own try/catch; screens failure does not abort features insert
- Always returns HTTP 200 — never 4xx/5xx (caller is fire-and-forget)
- All catch blocks use `extractErrorMessage`

### `supabase/functions/_lib/supabaseAdmin.ts` (new)
Supabase EF port of the Netlify version. Key diff: uses `SUPABASE_URL` (not `VITE_SUPABASE_URL`).

### `supabase/functions/_lib/getAIClient.ts` (new)
Supabase EF port of `netlify/edge-functions/_lib/getAIClient.ts`. Logic identical — same two-path Anthropic/OpenRouter routing. Keep in sync with Netlify version when either changes.

### `supabase/functions/_shared/extractErrorMessage.ts` (new)
Identical to `shipyard/src/lib/extractErrorMessage.ts` (Build 062). Keep in sync.

### `migrations/067_feature_status_backlog.sql` (new)
Adds `'backlog'` to the `feature_status` Postgres enum **before** `'design'`.

**This migration was required** — the `feature_status` enum in `001_core_schema.sql` did not include `'backlog'`. Build 066's TriageScreen also inserts `status: 'backlog'` (the `+ Add feature` action) and would silently fail without this migration. Build 065's `extract-features-from-brief` will also need it.

⚠️ `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block (Postgres limitation). Apply with:
```sql
-- Run outside a transaction:
ALTER TYPE feature_status ADD VALUE IF NOT EXISTS 'backlog' BEFORE 'design';
```
Or apply via Supabase Dashboard SQL editor (not via the migration runner if it uses transactions).

---

## PRD deviations (noted for Quinn)

| PRD says | Actual implementation | Reason |
|----------|----------------------|--------|
| `screen_type` column | `type` column | Actual DB column name per `001_core_schema.sql` and db.ts |
| `flow` field on screens | Omitted | No `flow` column exists on `screens` table; `flow_x/y/icon/category` added in Build 061 are different |
| `pipeline_step: 'idea'` | `status: 'backlog'` | `pipeline_step` is a number (1–6), not a text enum; 'backlog' is the correct pre-pipeline label |
| Query `screen_type` enum dynamically from Postgres | Hardcoded valid suggestion types | supabase-js has no raw SQL capability; dynamic query would require a new RPC function (a new migration for a helper). Pragmatic choice — noted as P2 |

---

## TypeScript

`npx tsc --noEmit` (frontend) — exit 0, no errors.
Deno EF TypeScript is not covered by the frontend build (Deno runtime).

---

## Deploy

```bash
supabase functions deploy generate-wizard-defaults
```

Apply migration before deploying:
```sql
ALTER TYPE feature_status ADD VALUE IF NOT EXISTS 'backlog' BEFORE 'design';
INSERT INTO schema_migrations (filename) VALUES ('067_feature_status_backlog.sql') ON CONFLICT DO NOTHING;
```

---

## For Quinn

- POST to `/functions/v1/generate-wizard-defaults` with `{ "project_id": "<valid-uuid>" }` using service role key returns `{ ok: true, screens_created: N, features_created: N }`
- Second call with same `project_id` returns `{ skipped: true, screens_created: 0, features_created: 0 }` (idempotency)
- A call with no API key configured should still return 200 with `{ ok: false, error: "..." }`
- Verify `migrations/067_feature_status_backlog.sql` has self-registration INSERT
- Verify `_lib/getAIClient.ts` uses `SUPABASE_URL` not `VITE_SUPABASE_URL`
- Verify all catch blocks use `extractErrorMessage`, no `instanceof Error` ternaries
