# [003] Platform Features + Admin Console — QA Sign-off

**Build:** 003
**Feature:** Platform Features + Admin Console
**Date:** 2026-03-28
**QA Result:** ✅ PASS — Ready to Deploy

## Bug Summary

| ID | Sev | Status | Description |
|----|-----|--------|-------------|
| BUG-P1-003a | P1 | ✅ Fixed | `exportUserData()` in `src/api/admin.ts` returns `Promise<string>` (signed URL). AdminScreen opens URL in new tab with 5-min TTL toast. Edge function returns HTTP 200 + `{ download_url }`. |
| BUG-P1-003b | P1 | ✅ Fixed | `ImpersonationBanner.tsx` refactored into `ImpersonationProvider` (state owner, wraps at App root in `App.tsx`) + `ImpersonationBanner` (context consumer). `useImpersonation()` hook reachable from any component. |
| BUG-P1-003c | P1 | ✅ Fixed | Dead no-op `actionRow` entry and hidden `<button style={{display:'none'}}/>` removed. Single `<button data-testid="reset-password-btn">` remains. |
| BUG-P1-003d | P1 | ✅ Fixed | All admin edge functions return 404 (not 403) on auth failures and when `SHIPYARD_ADMIN` unset. Confirmed in `admin-user-actions.ts`. |
| BUG-P2-003e | P2 | ✅ Fixed | Last-owner demotion returns 422 (confirmed line 53 of `admin-user-actions.ts`). |
| BUG-P2-003f | P2 | ✅ Fixed | Duplicate `borderBottom` in `tabStyle()` removed. TypeScript errors cleared. |
| BUG-P2-003g | P2 | ✅ Fixed | `requireAdminRole()` extracted into `admin-users.ts` and imported by all admin edge functions for consistent auth. |
| BUG-P3-003h | P3 | ✅ Fixed | Last-owner guard HTTP status corrected (422 not 409). |

## Static Review Notes

- Admin gate: guarded by `VITE_SHIPYARD_ADMIN` env var ✅
- `data-testid="reset-password-btn"` exists exactly once ✅
- All admin routes return 404 (not 403) on unauthenticated access ✅
- Export returns signed URL with 5-min TTL ✅
- ImpersonationProvider wraps entire app tree ✅
- Audit log JOINs profiles for admin name + email ✅

## Human Setup Prerequisite

`shipyard-exports` Supabase Storage bucket must exist and be private before export is functional in production.

## Test File

`tests/admin-console.spec.ts` — 31 tests
