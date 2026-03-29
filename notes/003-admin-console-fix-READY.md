# [003] Platform Features + Admin Console — Fix Ready for QA Re-review

**Build:** 003
**Feature:** Platform Features + Admin Console
**From:** Engineer
**To:** QA
**Date:** 2026-03-28

## What's done

- **BUG-P1-003a fixed:** `exportUserData()` in `src/api/admin.ts` now returns `Promise<string>` (signed URL). `AdminScreen` opens the URL in a new tab and shows toast "Export ready — opening download link (expires in 5 minutes)". Edge function uploads JSON to `shipyard-exports` bucket, returns `{ download_url }` with HTTP 200.
- **BUG-P1-003b fixed:** Refactored `ImpersonationBanner.tsx` into `ImpersonationProvider` (owns state, wraps at App root in `App.tsx`) + `ImpersonationBanner` (reads from context). `useImpersonation()` hook now reachable from any component in the tree.
- **BUG-P1-003c fixed:** Removed the dead no-op `actionRow` entry and hidden `<button style={{display:'none'}}/>` for Reset Password. Single `<button data-testid="reset-password-btn">` remains.
- **BUG-P1-003d fixed:** All admin edge functions (`admin-users.ts`, `admin-impersonate.ts`, `admin-user-actions.ts`) return 404 (not 403) on auth failures and when `SHIPYARD_ADMIN` env var is unset, obscuring route existence.
- **BUG-P2-003e fixed:** Last-owner demotion in `admin-user-actions.ts` returns 422 (was 409).
- **BUG-P2-003f fixed:** Removed duplicate `borderBottom` property from `tabStyle()` (TS1117 object literal duplicate key). TypeScript errors cleared.
- **BUG-P2-003g fixed:** `requireAdminRole()` helper extracted into `admin-users.ts` and imported by other edge functions for consistent auth enforcement.

## What to pick up

- Re-run `tests/admin-console.spec.ts`. Verify impersonation banner appears in all routes, export opens a download URL, reset password shows single button, admin routes return 404 to non-admins.
- Confirm `shipyard-exports` Supabase Storage bucket exists and is private (human setup prerequisite).

## Files to read

- `src/screens/Admin/AdminScreen.tsx` — export flow, reset-password single button, `UserDetailPanel`
- `src/components/ImpersonationBanner.tsx` — `ImpersonationProvider` + `ImpersonationBanner` split
- `src/App.tsx` — `<ImpersonationProvider>` at root
- `netlify/edge-functions/admin-users.ts` — 404 auth guard, `requireAdminRole()`
- `netlify/edge-functions/admin-impersonate.ts` — 404 on auth failure
- `netlify/edge-functions/admin-user-actions.ts` — 404 on auth, 422 last-owner, GDPR export signed URL
