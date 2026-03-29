# [007] App Test Mode (PIN-based) — Ready for QA

**Build:** 007
**Feature:** App Test Mode (PIN-based)
**From:** Engineer
**To:** QA
**Date:** 2026-03-28

## What's done

- **TestModePinSheet** (`src/components/TestModePinSheet.tsx`): Bottom-sheet 6-digit PIN entry; auto-submits on 6th digit; `data-testid="test-mode-pin-sheet"`; digit keys `pin-key-{0-9}`, dismiss `pin-key-dismiss`, backspace `pin-key-backspace`; error messages for incorrect/disabled/not_configured/rate-limited; POST to `/api/test-mode/validate-pin`.
- **TestModeBanner** (`src/components/TestModeBanner.tsx`): Fixed amber banner at app root; `data-testid="test-mode-banner"`, `data-testid="test-mode-exit"`; renders only when `TestMode.isActive()` is true; Exit calls `TestMode.deactivate()` → clears sessionStorage → redirects to `/login`.
- **TestMode utility** (`src/utils/testMode.ts`): sessionStorage-backed state; `isActive()`, `activate(projectId)`, `deactivate()`, `getProjectId()`.
- **set-pin edge fn** (`netlify/edge-functions/test-mode-set-pin.ts`): POST `/api/test-mode/set-pin`; bcrypt(12) hash; validates 4–6 digit format; 401/404/204.
- **validate-pin edge fn** (`netlify/edge-functions/test-mode-validate-pin.ts`): POST `/api/test-mode/validate-pin`; bcrypt compare; rate-limited 5/min per project; 400/403(disabled)/404/422(not_configured)/429.

## What to pick up

- Run `tests/app-test-mode.spec.ts`. Verify: PIN sheet renders, keypad works, correct PIN activates sessionStorage, incorrect PIN shows error, rate limit shows 429 message, Exit button clears sessionStorage and navigates to /login, banner hidden when inactive.
- Physical bcrypt hashing cannot run in Playwright (no Deno) — mock `/api/test-mode/validate-pin` responses.

## Files to read

- `src/components/TestModePinSheet.tsx`
- `src/components/TestModeBanner.tsx`
- `src/utils/testMode.ts`
- `netlify/edge-functions/test-mode-set-pin.ts`
- `netlify/edge-functions/test-mode-validate-pin.ts`
