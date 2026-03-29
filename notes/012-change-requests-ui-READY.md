# [012] Change Requests UI — Ready for QA

**Build:** 012
**Feature:** Change Requests — Global project view, per-screen panel, annotation pins, Accept/Reject flow
**From:** Engineer
**To:** QA
**Date:** 2026-03-28

## What's done

- **ChangeRequestsScreen** (`src/screens/ChangeRequests/ChangeRequestsScreen.tsx`): Route `/projects/:id/change-requests`; filter pills (All / Pending / Accepted / Rejected); screen dropdown filter; expandable CR cards showing screenshot + annotation pin overlay; Accept modal (create new feature OR link to existing feature); inline reject flow with rejection reason; empty state with test link copy button.
- **changeRequests API** (`src/api/changeRequests.ts`): `listChangeRequests`, `getChangeRequest` (reads `cr_annotations` table first, falls back to JSONB `annotations` for legacy rows), `getPendingCrCountsByScreen`, `acceptCrWithNewFeature`, `acceptCrLinkFeature`, `rejectChangeRequest`, `searchFeaturesForScreen`, `getFeedbackTestLink`. Uses `project_id` as RLS anchor (not `screen_id`).
- **Types** (`src/types/db.ts`): `CrAnnotation`, updated `ChangeRequest` (nullable `screen_id`, added `project_id`, `title`, `submitter_email`, `reviewed_at`, `rejection_reason`, `submitted_at`), `ChangeRequestSummary`, `PendingCrCountByScreen`.

## What to pick up

- Run migration `012_change_requests_ui.sql` in Supabase SQL Editor before testing.
- Submit a test change request via the feedback widget on a preview URL, then visit the CR screen; verify it appears, is expandable, and can be accepted/rejected.
- Accept → Create new feature: verify feature row is inserted with `source = 'change_request'` and CR status updates to `accepted`.
- Accept → Link existing: verify feature_id FK set on the CR row.
- Reject flow: verify `rejection_reason` is stored and status = `rejected`.
- `getPendingCrCountsByScreen` is used by ScreensScreen screen cards — verify counts update after accept/reject.

## Files to read

- `src/screens/ChangeRequests/ChangeRequestsScreen.tsx`
- `src/api/changeRequests.ts`
- `src/types/db.ts` (CrAnnotation, ChangeRequest, ChangeRequestSummary)
