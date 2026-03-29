# [014] Project Hub — QA Review

**Build:** 014
**Feature:** Project Hub — `/projects/:id` main landing page
**Date:** 2026-03-28
**QA Result:** ⚠️ STATIC REVIEW PASS · Blocked on migrations 013+014 for runtime tests

---

## Static Review

### Route
- `/projects/:id` registered in `App.tsx` pointing to `ProjectHubScreen` ✅
- Previously a stub — now fully implemented ✅

### ProjectHubScreen — data loading
- Parallel `Promise.all`: `getProject` + `getProjectHubStats` + `getPendingHumanTasks` on mount ✅
- Loading state rendered while fetching ✅
- Error state rendered on fetch failure ✅
- `reload()` callback passed to PhaseBadge so stats refresh after phase advance ✅

### PhaseBadge component
- Phase colours: alpha = purple `#bf5af2`, beta = amber `#ff9f0a`, live = green `#30d158` ✅
- Dropdown only opens when `nextPhase(phase)` is not null (i.e. `live` phase has no dropdown) ✅
- "Move to {next}" button calls `advanceProjectPhase` ✅
- `live` advance also sets `pushed_to_production_at` in DB ✅
- Success toast shown for 3 seconds ✅
- Dropdown positioned absolutely below badge ✅

### Human Tasks callout
- Only rendered when `pendingTasks.length > 0` ✅
- Amber background `#ff9f0a1a`, amber border ✅
- Each task shows `title` + "Mark done" button ✅
- Dismiss: optimistic removal from list + `resolveHumanTask(id, 'done')` via dynamic import ✅

### SetupChecklist component
- `getSetupChecklistState` returns 6 steps with `done` / `active` / `pending` status ✅
- Active step highlighted; pending steps muted ✅
- Progress bar: `(completed / 6) * 100%` ✅
- Each step: CTA link to setup URL or relevant section ✅
- When all 6 complete: collapses to summary "✓ 6/6 Setup steps complete" with "Review" toggle ✅
- Starts expanded by default (`useState(true)`) ✅
- Step 6 `isComplete` uses `screenCount` from `project_hub_stats` view ✅

### Setup checklist `isComplete` conditions
- Step 1: `p.name && p.description` ✅
- Step 2: `p.supabase_url` (via type cast — column may not be in Project type yet; acceptable) ✅
- Step 3: `p.repo_url` ✅
- Step 4: `p.claude_key` (via type cast — same note) ✅
- Step 5: `p.netlify_site_id` (via type cast) ✅
- Step 6: `screenCount > 0` ✅

### NavCard grid
- 8 cards defined: Screens, Features, Bugs, Change Requests, SEO/AEO, Admin Console, Deployments, Data Schema ✅
- Admin Console locked in `alpha` phase with `🔒 Unlocks in Beta` badge ✅
- Locked cards: `pointer-events` blocked via `onClick` preventDefault, `opacity: 0.6` ✅
- Badge counts sourced from `project_hub_stats` view ✅
- Hover: subtle lift + box shadow ✅

### Quick stats row
- 4 stat chips: `screen_count`, `feature_count`, `open_bug_count`, `pending_cr_count` ✅
- Reads from `ProjectHubStats` returned by `project_hub_stats` view ✅

### Push to Production button
- Only rendered when `project.phase === 'beta'` ✅
- Clicking calls `advanceProjectPhase(projectId, 'live')` ✅

### projectHub API
- `getProjectHubStats`: queries `project_hub_stats` view, `.single()` ✅
- `getProject`: full project row select ✅
- `getPendingHumanTasks`: filters `status = pending`, orders by priority then created_at ✅
- `advanceProjectPhase`: patches `phase`, also writes `pushed_to_production_at` for live ✅
- `updateSetupStep`: writes `setup_step` to `project_settings` ✅
- `resolveHumanTask`: sets `status` + `completed_at` ✅
- `nextPhase`: pure function, returns null for `live` ✅
- `isSetupComplete`: all 6 steps must return true ✅
- `getSetupChecklistState`: first incomplete step gets `active`, prior = `done`, subsequent = `pending` ✅

---

## Issues Found

### P2-014a — Missing `data-testid` attributes
**Issue:** Contract specifies all interactive elements must carry `data-testid`. PhaseBadge advance button, SetupChecklist CTA links, NavCard links, "Mark done" buttons, and "Push to Production" button have no `data-testid`.
**Fix:** Add `data-testid="phase-badge-advance"`, `data-testid="setup-step-{n}-cta"`, `data-testid="nav-card-{id}"`, `data-testid="human-task-dismiss-{id}"`, `data-testid="push-to-production-btn"`.

### P2-014b — NavCard routes for Deployments and Data Schema not registered
**File:** `src/screens/ProjectHub/ProjectHubScreen.tsx`
**Issue:** "Deployments" card links to `/projects/:id/deployments` and "Data Schema" to `/projects/:id/schema`. Neither route is registered in `App.tsx` — both will 404. These are future builds (not yet implemented).
**Impact:** Clicking either card hits the catch-all redirect. Not a blocker for 014 itself, but the cards should either be locked (like Admin Console) or link to coming-soon stubs.
**Fix (deferred):** Mark Deployments and Data Schema cards as `isLocked: true` with `lockReason: 'Coming soon'` until those builds ship.

### P2-014c — NavCard "Features" links to unregistered route
**File:** `src/screens/ProjectHub/ProjectHubScreen.tsx` line 133
**Issue:** "Features" card links to `/projects/${id}/features` but the registered route is `/projects/:id/features/:featureId`. There is no index features list route yet.
**Impact:** Clicking "Features" hits the catch-all redirect.
**Fix (deferred):** Either register a features list screen at `/projects/:id/features` in a future build, or lock this card until Build 016 adds a proper index. For now note it as a known gap.

### P3-014d — `supabase_url`, `claude_key`, `netlify_site_id` cast via `unknown`
**File:** `src/api/projectHub.ts` lines 127, 142, 150
**Issue:** Three setup step `isComplete` checks cast `project` through `unknown as Record<string, unknown>` to access columns not in the `Project` type. This compiles but silently breaks if the column names change.
**Action:** When `Project` type is updated to include `supabase_url`, `claude_key`, `netlify_site_id`, remove the casts. Low priority — functional now.

---

## Runtime Tests Required (post-migration)

Run `tests/project-hub.spec.ts` after migrations 013 + 014 applied:
1. `/projects/:id` loads hub with stats, checklist, nav grid
2. Phase advance Alpha → Beta: badge changes, toast shows, `projects.phase` updated
3. Phase advance Beta → Live: `pushed_to_production_at` set, push button disappears
4. Human task callout hidden when no pending tasks; shows when tasks exist
5. Mark done: task disappears from callout optimistically; DB row = `done`
6. Setup checklist: steps 1–5 reflect actual project column values
7. Step 6 complete when at least one screen exists
8. All-complete: checklist collapses to summary
9. NavCard badges match `project_hub_stats` counts
10. Admin Console card locked in alpha, unlocked in beta

---

## Playwright Tests Written — 2026-03-28

**Test file:** `tests/project-hub.spec.ts` (13 scenarios)

| # | Scenario | Coverage |
|---|---------|---------|
| 014-01 | Route renders without crash | Route registration |
| 014-02 | Project header shows name and description | getProject data |
| 014-03 | Edit button is present but disabled | cursor: not-allowed / coming soon |
| 014-04 | Setup checklist renders all 6 steps | SETUP_STEPS constant |
| 014-05 | Done/active/pending states render correctly | Step indicator circles + IN PROGRESS chip |
| 014-06 | Progress bar reflects partial completion | Progress bar element |
| 014-07 | All 8 nav cards rendered with correct labels | NAV_CARDS constant |
| 014-08 | Screens card has correct href | /projects/:id/screens route |
| 014-09 | Quick stats grid shows correct counts | project_hub_stats |
| 014-10 | Amber human tasks callout appears | Human tasks banner |
| 014-11 | Push to Production hidden in alpha, shown in beta | Phase-conditional CTA |
| 014-12 | **BUG-P1** — data-testid attributes missing | data-testid audit |
| 014-13 | Mobile 375px — no horizontal scroll | Responsive layout |

### BUG-P1 — Missing data-testid (confirmed in this session)
Full source review of `ProjectHubScreen.tsx` (527 lines) confirmed zero `data-testid` attributes on any interactive element. **Status remains ⚠ BLOCKED.**

**Required before sign-off:** Engineer must add `data-testid` to all interactive elements per the list in 014-12.
