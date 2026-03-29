# [004] Model Selector — Fix Ready for QA Re-review

**Build:** 004
**Feature:** Model Selector
**From:** Engineer
**To:** QA
**Date:** 2026-03-28

## What's done

- **BUG-P1-004a fixed:** `useProjects.ts` optimistic object now includes `default_model: 'claude-sonnet-4-6'` — was missing field causing TS2741 and silent undefined in UI.
- **BUG-P1-004b fixed:** Created `netlify/edge-functions/save-api-key.ts` (POST `/api/projects/:projectId/api-key`). `ClaudeApiStep.handleSave()` now POSTs key to this endpoint before advancing the wizard — key is validated (`sk-ant-` prefix), project ownership verified, stored in `projects.anthropic_api_key` (RLS-protected). Added `netlify.toml` edge function registration.

## What to pick up

- Re-run `tests/model-selector.spec.ts`. Verify saving an API key actually persists to the DB (check Supabase `projects` table), and that the optimistic UI shows the correct `default_model` value without refresh.

## Files to read

- `netlify/edge-functions/save-api-key.ts` — new API key storage endpoint
- `src/screens/Setup/SetupScreen.tsx` — `ClaudeApiStep.handleSave()` wiring
- `src/hooks/useProjects.ts` — `default_model` in optimistic object
- `netlify.toml` — edge function path registration
