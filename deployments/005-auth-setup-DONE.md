# [005] Auth Setup Wizard — QA Sign-off

**Build:** 005
**Feature:** Auth Setup Wizard (SetupScreen wizard step 1)
**Date:** 2026-03-28
**QA Result:** ✅ PASS — Ready to Deploy

## Bug Summary

| ID | Sev | Status | Description |
|----|-----|--------|-------------|
| BUG-P2-005a | P2 | ✅ Fixed | `signInWithGoogle()` in `src/lib/auth.ts` accepts optional `redirectTo` param (line 30). `AuthStep` passes `window.location.href` so OAuth returns to setup wizard, not `/projects`. |
| BUG-P2-005b | P2 | ✅ Fixed | Replaced one-time `getUser()` on mount with `onAuthStateChange` subscription. Handles `SIGNED_IN` event for OAuth callback; subscription cleaned up on unmount. |
| BUG-P2-005c | P2 | ✅ Fixed | `signOut()` is now properly `await`ed inside an async handler — prevents unhandled promise rejection. |

## Static Review Notes

- Google OAuth `signInWithGoogle(window.location.href)` passes redirect back to setup wizard ✅
- `onAuthStateChange` subscription reliably detects OAuth callback ✅
- `signOut()` awaited — no unhandled rejections ✅
- Auth step buttons have `data-testid` attributes ✅
- All P2s resolved. No P1s were raised against this build.

## Test File

`tests/auth-setup.spec.ts` — 22 tests
