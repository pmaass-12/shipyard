# [015] Screens & Sitemap Builder — QA Review

**Build:** 015
**Feature:** Screens & Sitemap Builder — `/projects/:id/screens`
**Date:** 2026-03-28
**QA Result:** ⚠️ STATIC REVIEW PASS · Blocked on migration 015 + ANTHROPIC_API_KEY env var for runtime tests

---

## Static Review

### Routes
- `/projects/:id/screens` → `ScreensScreen` (list or empty state) ✅
- `/projects/:id/screens/:screenId` → `ScreensScreen` (screen detail) ✅
- Both registered in App.tsx ✅
- `ScreensScreen` reads both `id` and `screenId` from `useParams` and branches on `screenId` ✅

### Empty state — Claude generation flow
- Textarea description input, required before generate button enables ✅
- `handleGenerate`: POST `/api/generate-screens` with JWT + `{ project_id, description }` ✅
- Generates loading: button shows "Generating…", disabled ✅
- On success: suggestions rendered as checkbox list ✅
- All suggestions default to `checked: true` ✅
- Checkbox to toggle individual screens ✅
- Name field editable inline (transparent input) ✅
- Route shown in `<code>` badge ✅
- TypeBadge shown per suggestion ✅
- "Add {N} selected screens" disabled when none checked ✅
- `handleAddSelected`: calls `addGeneratedScreens` with checked items only ✅
- On success: `onScreensAdded()` triggers list view ✅
- "Start over" clears suggestions list ✅
- "Or add manually" link opens `AddScreenPanel` slide-in from empty state ✅
- Error state displayed in red on both generate and add failures ✅

### Screen list
- Reads from `screen_summary` view (includes aggregated counts) ✅
- Ordered by `sort_order` (nulls last) then `name` ✅
- 3-column responsive card grid ✅
- Each card: screen name, TypeBadge, CountChip for features / bugs / CRs ✅
- CountChip renders nothing at 0 (no noise for empty screens) ✅
- Search input: debounced via `useCallback` on `searchQuery` state ✅
- Type filter dropdown: all ScreenType values ✅
- "Add screen" slide-in panel opens from header button ✅
- Card links to `/projects/:id/screens/:screenId` ✅

### AddScreenPanel (slide-in)
- Name, type dropdown (public/auth/private/admin/onboarding/modal_sheet), route field ✅
- Submit calls `createScreen(projectId, input)` ✅
- On success: `onAdded()` refreshes list ✅
- Cancel closes panel ✅

### Screen detail view
- Breadcrumb: `Screens → {screen.name}` with correct back link ✅
- Three tabs: Features / Bugs / Change Requests ✅
- Active tab from URL `?tab=` param via `useSearchParams` ✅
- Default tab: `features` ✅

### Features tab
- Shows `ScreenFeatureRow[]` from `getScreenFeatures(screenId)` ✅
- Each row: name, maturity badge, workflow progress dots (5 dots via `getProgressDots`) ✅
- `getProgressDots(workflowStep)`: dot filled when `step < workflowStep` ✅
- Links to `/projects/:id/features/:featureId` ✅
- Empty state: "No features yet" ✅

### Bugs tab
- Shows bugs from `getScreenBugs(screenId)` ✅
- Severity chip coloured by level ✅
- Empty state ✅

### Change Requests tab
- Shows CRs from `getScreenChangeRequests(screenId)` ✅
- StatusChip per CR ✅
- Link to global `/change-requests` view for full detail ✅
- Empty state ✅

### screens API (`src/api/screens.ts`)
- `listScreens`: `screen_summary` view, sorted ✅
- `searchScreens`: type filter + ilike name search ✅
- `hasScreens`: count query with `deleted_at IS NULL` guard ✅
- `getScreen`: single row from `screen_summary` ✅
- `getScreenFeatures`: selects workflow-relevant columns ✅
- `getScreenBugs` / `getScreenChangeRequests`: both select lightweight columns, ordered newest first ✅
- `createScreen`: insert + return new row ✅
- `updateScreen`: patch + return updated row ✅
- `deleteScreen`: `UPDATE screens SET deleted_at = NOW()` — never hard DELETE ✅
- `addGeneratedScreens`: batch insert ✅
- `getProgressDots`: pure helper, returns 5 dot objects ✅

### generate-screens Edge Function
- JWT auth required ✅
- `project_id` + `description` required ✅
- Ownership verification against `projects` table ✅
- Calls Claude with `max_tokens: 1500` ✅
- Validates `type` field against allowed values before returning ✅
- Returns suggestions only — does NOT auto-insert ✅

---

## Issues Found

### P2-015a — Missing `data-testid` attributes
**Issue:** No `data-testid` on any interactive element: generate button, suggestion checkboxes, add button, search input, type filter, screen cards, tab buttons, AddScreenPanel form inputs or submit.
**Fix:** Add `data-testid="generate-screens-btn"`, `data-testid="suggestion-checkbox-{i}"`, `data-testid="add-selected-btn"`, `data-testid="screen-search"`, `data-testid="type-filter"`, `data-testid="screen-card-{id}"`, `data-testid="tab-{name}"`.

### P2-015b — Drag-to-reorder not implemented
**Issue:** Contract specifies drag-to-reorder of screen cards updates `sort_order`. The current implementation has no drag-and-drop; cards can only be reordered by editing `sort_order` directly in the DB.
**Impact:** Screens list has a static visual order only.
**Fix (next build):** Implement drag-and-drop with `sort_order` update via `updateScreen` patch. Acceptable to defer — list is functional without it.

### P2-015c — Edit/delete actions missing from screen detail view
**Issue:** Contract specifies Edit and Delete actions on the screen detail view. The current `ScreenDetail` component (implicit from route) only shows the tab view — no edit button, no delete confirmation. The `updateScreen` and `deleteScreen` API functions exist but are not wired to any UI.
**Fix:** Add an Edit button (opens `AddScreenPanel` pre-filled with current values) and a Delete button (confirmation dialog → calls `deleteScreen(screenId)`) to the screen detail header.

### P3-015d — Suggestion route values not user-editable
**Issue:** In the suggestion review step, the `name` field is editable inline but the `route` field is displayed as a `<code>` badge (read-only). Users cannot correct the suggested route without starting over.
**Impact:** Minor UX friction. Routes are often correct from Claude.
**Fix (low priority):** Make `route` an editable input in the suggestion review step.

### P3-015e — `getProgressDots` completeness logic
**File:** `src/api/screens.ts` line 172
**Issue:** `complete: idx + 1 < workflowStep` marks a dot complete only when step is strictly before `workflowStep`. This means the dot for `workflowStep` itself is hollow even when that step is approved (it would need `idx + 1 <= workflowStep`). This is a visual undercount of progress.
**Fix:** Change to `complete: idx + 1 <= workflowStep` to fill the dot of the current step when it's been reached.

---

## Runtime Tests Required (post-migration)

Run `tests/screens.spec.ts` after migrations 013 + 014 + 015 applied and `ANTHROPIC_API_KEY` set in Netlify env:
1. Empty state loads for new project, generate button calls Claude
2. Suggestions render as checkbox list; uncheck → removed from batch insert
3. Confirm → screen rows inserted; list view loads
4. Screen card shows correct feature/bug/CR counts from `screen_summary` view
5. Search filters by name
6. Type filter reduces visible cards
7. Add screen manually: name + type + route → row inserted
8. Soft delete: `deleted_at` set; screen disappears from list (verify no hard DELETE in logs)
9. Screen detail: three tabs load correct data
10. Features tab: workflow dots reflect `workflow_step` value

---

## Playwright Tests Written — 2026-03-28

**Test file:** `tests/screens-builder.spec.ts` (14 scenarios)

| # | Scenario | Coverage |
|---|---------|---------|
| 015-01 | Route renders without crash | Route registration |
| 015-02 | Empty state shows generate textarea + button | EmptyState component |
| 015-03 | Generate flow shows AI suggestions with checkboxes | POST /api/generate-screens |
| 015-04 | Add Screen panel shows all 4 type options | page/modal/auth/dashboard |
| 015-05 | Screen cards show name, type badge, route, count chips | ScreenCard + SCREEN_TYPE_COLORS |
| 015-06 | Clicking screen card navigates to detail | Link href |
| 015-07 | Screen detail breadcrumb and tabs visible | Features/Bugs/Changes tabs |
| 015-08 | Features tab shows progress dots per feature | getProgressDots(workflow_step) |
| 015-09 | Edit button opens edit form | Screen detail edit |
| 015-10 | Delete shows confirmation before soft-delete | deleted_at soft-delete |
| 015-11 | Search input filters screen cards by name | searchScreens query |
| 015-12 | Duplicate route shows 23505 validation message | Route uniqueness |
| 015-13 | **BUG-P1** — data-testid attributes missing | data-testid audit |
| 015-14 | Mobile 375px — no overflow | Responsive layout |

### BUG-P1 — Missing data-testid (confirmed in this session)
Full source review of `ScreensScreen.tsx` (771 lines) confirmed zero `data-testid` attributes on any interactive element. **Status remains ⚠ BLOCKED.**

**Required before sign-off:** Engineer must add `data-testid` to all interactive elements per the list in 015-13.
