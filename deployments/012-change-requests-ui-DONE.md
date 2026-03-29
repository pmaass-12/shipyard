# [012] Change Requests UI — QA Review

**Build:** 012
**Feature:** Change Requests — Global project view, annotation pins, Accept/Reject flow
**Date:** 2026-03-28
**QA Result:** ⚠️ STATIC REVIEW PASS · Blocked on migration 012 + Netlify deploy for runtime tests

---

## Static Review

### ChangeRequestsScreen (`src/screens/ChangeRequests/ChangeRequestsScreen.tsx`)
- Route: `/projects/:id/change-requests` registered in App.tsx ✅
- Reads `project_id` from `useParams` ✅
- Loads `deploy_url` from `projects` table for empty-state test link ✅
- Filter pill state: All / Pending / Accepted / Rejected with live counts ✅
- `activeTab` filter passed to `listChangeRequests(projectId, { status })` ✅
- Screen dropdown derived from unique `screen_id` values in current CR list ✅
- `screenFilter` passed to `listChangeRequests(projectId, { screenId })` ✅
- `loadCrs` wrapped in `useCallback`, re-runs on `activeTab` / `screenFilter` change ✅
- Loading state shown while fetching ✅
- Empty state shows test link copy button when `deploy_url` is set ✅
- Copy button: clipboard write → "✓ Copied!" text for 2 seconds ✅

### CrCard component
- Thumbnail: shows screenshot image if `screenshot_url` present; fallback clipboard emoji ✅
- Collapsed header: StatusChip, route badge (monospace), title/description truncated, submitter + date ✅
- Expand: triggers `getChangeRequest(cr.id)` on first open only (subsequent toggles skip fetch) ✅
- Loading skeleton shown while detail loads ✅
- Full description rendered on expand ✅
- Screenshot shown at full width with `AnnotationPins` overlay ✅
- Console errors: `<details>` collapsible, color-coded by level (error = red, else muted) ✅
- Accept/Reject action strip only rendered when `status === 'pending'` ✅
- Accepted row: shows "✓ Linked to feature" ✅
- Rejected row: shows `rejection_reason` in red ✅

### AcceptModal component
- Two-mode radio: "Create new feature" / "Link to existing feature" ✅
- Create mode: pre-fills feature name from `cr.title ?? cr.description.slice(0,60)` ✅
- Confirm disabled when feature name is empty ✅
- Link mode: search field triggers `searchFeaturesForScreen` on ≥2 chars ✅
- Search results dropdown: click sets selectedFeatureId and collapses dropdown ✅
- Confirm disabled when no feature selected in link mode ✅
- `acceptCrWithNewFeature`: inserts feature with `source: 'change_request'`, updates CR `status: accepted` + `feature_id` + `reviewed_at` ✅
- `acceptCrLinkFeature`: updates CR `status: accepted` + `feature_id` + `reviewed_at` ✅
- Loading state shown on confirm button ✅
- Modal closes on success, parent list updated optimistically ✅

### Reject flow
- "Reject" toggles inline textarea (optional reason field) ✅
- "Confirm Rejection" calls `rejectChangeRequest(crId, reason)` ✅
- Sets `status: rejected`, `rejection_reason`, `reviewed_at` ✅
- Button disabled + 0.6 opacity while acting ✅

### AnnotationPins component
- Pins positioned with `left: x_pct%` / `top: y_pct%` + `translate(-50%, -50%)` ✅
- Hover shows tooltip with `pin.note` ✅
- Returns `null` when no annotations ✅

### changeRequests API (`src/api/changeRequests.ts`)
- `listChangeRequests`: selects lightweight columns only (no JSONB blobs in list) ✅
- Ordered `submitted_at DESC` ✅
- Optional `status` + `screenId` filters ✅
- `getChangeRequest`: parallel fetch of CR + `cr_annotations` ✅
- Annotations fallback: uses `cr_annotations` table; empty array if no rows (no legacy JSONB attempt) ✅
- `getPendingCrCountsByScreen`: queries `pending_cr_count_by_screen` view, returns `Record<string, number>` ✅
- `searchFeaturesForScreen`: scoped to `project_id`, optionally to `screen_id`, `ilike` search ✅
- `getFeedbackTestLink`: pure function, appends `?feedback=true` ✅

### StatusChip
- All three statuses mapped to correct background/text colours ✅
- Amber for pending, green for accepted, red for rejected ✅

---

## Issues Found

### P2-012a — Missing `data-testid` attributes
**File:** `src/screens/ChangeRequests/ChangeRequestsScreen.tsx`
**Issue:** Contract specifies all interactive elements must carry `data-testid`. Filter pills, CrCard expand trigger, Accept/Reject buttons, AcceptModal confirm, and EmptyState copy button have no `data-testid`.
**Impact:** Playwright tests cannot target these elements reliably.
**Fix:** Add `data-testid="cr-filter-{key}"`, `data-testid="cr-card-{id}"`, `data-testid="cr-accept-btn"`, `data-testid="cr-reject-btn"`, `data-testid="accept-modal-confirm"`, `data-testid="cr-test-link-copy"`.

### P3-012b — Duplicate `whiteSpace` property in annotation tooltip
**File:** `src/screens/ChangeRequests/ChangeRequestsScreen.tsx` line 84
**Issue:** Tooltip div has both `whiteSpace: 'nowrap'` and `whiteSpace: 'normal'` on the same style object. Last value wins (`normal`), so `nowrap` has no effect. The intent was likely `'normal'` to allow text wrapping in the tooltip — this is functionally correct but the redundant property should be removed.
**Impact:** Cosmetic/lint warning only. No functional breakage.
**Fix:** Remove the `whiteSpace: 'nowrap'` line; keep `whiteSpace: 'normal'`.

### P3-012c — Screen dropdown populated from loaded CRs only
**File:** `src/screens/ChangeRequests/ChangeRequestsScreen.tsx` line 592
**Issue:** `screenOptions` derived from `crs` array in memory. If filtering by status first, the dropdown only shows screens that appear in that filtered set. A screen with only accepted CRs disappears from the dropdown when "Pending" filter is active.
**Impact:** Minor UX confusion when switching filters. No data loss.
**Fix (deferred):** Fetch `screens` list separately for the dropdown; don't derive from filtered CRs.

---

## Runtime Tests Required (post-migration)

Run `tests/change-requests.spec.ts` after:
1. Migration `012_change_requests_ui.sql` applied in Supabase
2. App deployed to Netlify preview
3. At least one CR submitted via feedback widget

Key scenarios to verify:
- CR appears in list after feedback widget submission
- Expand → screenshot loads, annotation pins positioned correctly
- Accept → Create: feature row inserted, CR status = accepted
- Accept → Link: CR `feature_id` updated, CR status = accepted
- Reject: `rejection_reason` stored, row visually muted
- Filter pills update counts correctly
- Screen dropdown filters list correctly
- Empty state copy button copies `deploy_url?feedback=true`

---

## Playwright Tests Written — 2026-03-28

**Test file:** `tests/change-requests.spec.ts` (14 scenarios)

| # | Scenario | Coverage |
|---|---------|---------|
| 012-01 | Route renders without crash | Route registration |
| 012-02 | CR list sorted newest first | submitted_at DESC order |
| 012-03 | Status badges for pending/accepted/rejected | StatusChip labels |
| 012-04 | CR card accordion expand → description visible | getChangeRequest on expand |
| 012-05 | Annotation pin hover shows tooltip note | AnnotationPins x_pct/y_pct positioning |
| 012-06 | AcceptModal create-feature path shows name input | Radio mode 'create' |
| 012-07 | AcceptModal link-feature path shows feature dropdown | Radio mode 'link' |
| 012-08 | Reject inline reveals rejection textarea | Reject flow |
| 012-09 | Rejected CRs visible but visually muted | Soft visibility |
| 012-10 | Pending filter tab shows only pending | Filter tab behavior |
| 012-11 | Screen dropdown filters CRs by screen | Screen filter |
| 012-12 | Empty state shows Copy test link | Empty state |
| 012-13 | **BUG-P1** — data-testid attributes missing | data-testid audit |
| 012-14 | Mobile 375px — no horizontal scroll | Responsive layout |

### BUG-P1 — Missing data-testid (confirmed in this session)
Full source review of `ChangeRequestsScreen.tsx` (672 lines) confirmed zero `data-testid` attributes on any interactive element. This is a P1 blocker per QA standard. **Status remains ⚠ BLOCKED.**

**Required before sign-off:** Engineer must add `data-testid` to all interactive elements per the list in 012-13.
