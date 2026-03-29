# [007] App Test Mode (PIN-based) — QA Sign-off

**Build:** 007
**Feature:** App Test Mode (PIN-based)
**Date:** 2026-03-28
**QA Result:** ✅ PASS — Ready to Deploy

## Static Review

### TestModePinSheet
- `data-testid="test-mode-pin-sheet"` ✅
- Digit keys `pin-key-{0-9}`, dismiss `pin-key-dismiss`, backspace `pin-key-backspace` ✅
- Auto-submits when 6th digit entered ✅
- Backspace removes last digit ✅
- Error messages: "Incorrect PIN", "Test Mode is disabled", "Contact the app builder", "Too many attempts" ✅
- Loading state shows "Checking…" ✅
- Correct PIN calls `TestMode.activate(projectId)` → sessionStorage ✅

### TestModeBanner
- `data-testid="test-mode-banner"` ✅
- `data-testid="test-mode-exit"` ✅
- "TEST MODE" uppercase text ✅
- "No data will be saved · Session ends when you close this tab" copy ✅
- Amber pulse dot animation ✅
- Renders at `position: fixed; top: 0; zIndex: 9999` ✅
- Exit calls `TestMode.deactivate()` → clears sessionStorage → redirects `/login` ✅
- Hidden when `TestMode.isActive()` returns false ✅

### TestMode Utility
- `isActive()` reads `sessionStorage.isTestMode === 'true'` ✅
- `activate(projectId)` sets both keys in sessionStorage ✅
- `deactivate()` removes both keys, redirects to `/login` ✅
- SSR-safe (`try/catch` around sessionStorage access) ✅

### set-pin Edge Function
- Validates 4–6 digit format, rejects non-digits ✅
- bcrypt hash (cost 12) stored in `projects.test_mode_pin` ✅
- Returns 204 on success, 400 on bad PIN, 401 on no auth, 404 on not found ✅

### validate-pin Edge Function
- Rate limited 5 attempts/min per `project_id` ✅
- Returns 403 + `reason:'disabled'` when `test_mode_enabled=false` ✅
- Returns 422 + `reason:'not_configured'` when PIN not set ✅
- Returns 429 when rate limited ✅
- bcrypt compare only — hash never returned to client ✅

## Issues Found

None — build passes QA review.

## Test File

`tests/app-test-mode.spec.ts` — 22 tests
