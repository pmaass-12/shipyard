# [005] Auth Setup Wizard — Fix Ready for QA Re-review

**Build:** 005
**Feature:** Auth Setup Wizard
**From:** Engineer
**To:** QA
**Date:** 2026-03-28

## What's done

- **BUG-P2-005a fixed:** `signInWithGoogle()` in `src/lib/auth.ts` now accepts optional `redirectTo` param (defaults to `/projects`). `AuthStep` passes `window.location.href` so OAuth completes and returns to the setup wizard, not the projects list.
- **BUG-P2-005b fixed:** Replaced one-time `supabase.auth.getUser()` on mount with `supabase.auth.onAuthStateChange` subscription. Handles `SIGNED_IN` event so OAuth callback is reliably detected; subscription cleaned up on unmount.
- **BUG-P2-005c fixed:** `signOut()` call in `AuthStep` is now properly `await`ed inside an `async` handler, preventing unhandled promise rejection.

## What to pick up

- Re-run `tests/auth-setup.spec.ts`. Verify Google OAuth round-trip returns to the setup wizard page, the confirming state resolves on email confirmation, and sign-out from the auth step completes without errors.

## Files to read

- `src/lib/auth.ts` — updated `signInWithGoogle(redirectTo?)` signature
- `src/screens/Setup/SetupScreen.tsx` — `AuthStep` component: `onAuthStateChange` subscription, `signInWithGoogle(window.location.href)`, awaited `signOut()`
