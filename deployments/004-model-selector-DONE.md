# [004] Model Selector — QA Sign-off

**Build:** 004
**Feature:** Model Selector (SetupScreen wizard step 2)
**Date:** 2026-03-28
**QA Result:** ✅ PASS — Ready to Deploy

## Bug Summary

| ID | Sev | Status | Description |
|----|-----|--------|-------------|
| BUG-P1-004a | P1 | ✅ Fixed | `useProjects.ts` optimistic object now includes `default_model: 'claude-sonnet-4-6'`. Resolves TS2741 and silent undefined in UI. |
| BUG-P1-004b | P1 | ✅ Fixed | `netlify/edge-functions/save-api-key.ts` created. `ClaudeApiStep.handleSave()` POSTs key to `/api/projects/:projectId/api-key`. Key validated for `sk-ant-` prefix, ownership verified, stored in `projects.anthropic_api_key` (RLS-protected). `netlify.toml` registration confirmed. |

## Static Review Notes

- Three model option cards rendered ✅
- Each card has `data-testid="model-card-{model-id}"` ✅
- Default selection is `claude-sonnet-4-6` ✅
- API key input field has `data-testid="api-key-input"` ✅
- Save triggers POST to `/api/projects/:id/api-key` — no longer silently discards key ✅
- Validation rejects non `sk-ant-` prefixed keys with 400 ✅

## Test File

`tests/model-selector.spec.ts` — 18 tests
