# [002] Feedback Widget — QA Sign-off

**Build:** 002
**Feature:** Feedback Widget
**Date:** 2026-03-28
**QA Result:** ✅ PASS — Ready to Deploy

## Bug Summary

| ID | Sev | Status | Description |
|----|-----|--------|-------------|
| BUG-P1-002a | P1 | ✅ Fixed | Console ring buffer patched at module load time (not inside component mount). Module-level `_consoleRing` array and `_patchConsole` confirmed in `FeedbackWidget.tsx` lines 70–118. |
| BUG-P2-002b | P2 | ✅ Fixed | `selectType()` calls `setShowConsole(t === 'bug' && consoleErrors.length > 0)` — auto-expands console panel when filing a bug and errors exist. Confirmed at line 377. |
| BUG-P2-002c | P2 | ✅ Fixed | `ignoreElements` callback typed as `(el: Element) => boolean` — resolves TS7006. Confirmed at line 388. |
| BUG-P3-002d | P3 | ⏭ Deferred | Offline queue — intentionally deferred per Engineer notes. Not blocking. |

## Static Review Notes

- FAB: `data-testid="shipyard-fab"` ✅
- Triage cards: `data-testid="triage-bug"`, `data-testid="triage-change"`, `data-testid="triage-feature"` ✅
- Description field: `data-testid="feedback-description"` ✅
- Submit button: `data-testid="feedback-submit"` ✅
- Success state: `data-testid="feedback-success"` ✅
- Error state: `data-testid="feedback-error"` ✅
- Auth: `X-Shipyard-Preview-Token` header included in all submissions ✅
- Screenshot masking: `ignoreElements` correctly masks `type="password"` and `data-shipyard-mask` ✅

## Test File

`tests/feedback-widget.spec.ts` — 24 tests
