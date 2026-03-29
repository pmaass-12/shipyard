# [002] Feedback Widget — Fix Ready for QA Re-review

**Build:** 002
**Feature:** Feedback Widget
**From:** Engineer
**To:** QA
**Date:** 2026-03-28

## What's done

- **BUG-P1-002a fixed:** Console ring buffer (`_consoleRing`) now patched at module load time (not inside component mount) so errors captured before widget renders are not lost. `console.error`, `console.warn`, `window.onerror`, and `unhandledrejection` all patched.
- **BUG-P2-002b fixed:** `selectType()` now calls `setShowConsole(t === 'bug' && consoleErrors.length > 0)` so the console panel auto-expands when filing a bug and errors are present.
- **BUG-P2-002c fixed:** `ignoreElements` callback typed as `(el: Element) => boolean` to resolve TS7006; all TypeScript errors cleared (`npm run typecheck` passes clean).

## What to pick up

- Re-run the Playwright test suite (`tests/feedback-widget.spec.ts`) and verify all P1+P2 cases now pass.
- P3-002d (offline queue) is intentionally deferred — do not block sign-off on it.

## Files to read

- `src/components/FeedbackWidget.tsx` — module-level ring buffer patch, `selectType()` logic, typed `ignoreElements`
- `src/types/html2canvas.d.ts` — html2canvas module shim
