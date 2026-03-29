# Shipyard — Handoff Log

Each build moves left to right: Engineer → QA → Done.

| Build | Name | Engineer | QA | Done |
|-------|------|----------|-----|------|
| 012 | Change Requests UI | Fix ✓ 2026-03-29 | ⚠ Re-test ready | — |
| 013 | Project Settings | ✓ | ✓ | ✓ |
| 014 | Project Hub | Fix ✓ 2026-03-29 | ⚠ Re-test ready | — |
| 015 | Screens Builder | Fix ✓ 2026-03-29 | ⚠ Re-test ready | — |
| 016 | Feature Workflow | ✓ | ⚠ P1s fixed | — |
| 006-fix | Phase/Launch rename | ✓ 2026-03-29 | — | — |
| 022 | Human Tasks Global View | ✓ 2026-03-29 ⚠ run migration | — | — |
| 024-fix | Inline project delete | ✓ 2026-03-29 | — | — |
| 025-fix | Forgot Password / Reset | ✓ 2026-03-29 | — | — |
| 033 | Feature Workflow Redesign | ⛔ Blocked — run migrations 033+039 first | — | — |
| 040 | Named Team + PM Chat + Briefing | ⛔ Blocked — contracts + migrations not delivered | — | — |
| 041 | Import Existing Website | ⛔ Blocked — contracts + migrations not delivered | — | — |

---

## Engineer Log

### Session 1 — Builds 012–016 (initial implementation)
- Wrote all 5 screens + edge function
- Added routes in App.tsx
- Created READY notes for all 5 builds

### Session 2 — QA sign-off files
- Wrote static-review DONE files for builds 012–016
- Identified P1-016a (useSession import), data-testid gaps, and other bugs

### Session 3 — P1 fixes + data-testid pass 1
- Fixed P1-016a (useSession → supabase.auth.getSession)
- Added data-testid to ChangeRequestsScreen, ProjectHubScreen, ScreensScreen, FeatureWorkflowScreen (round 1)
- Committed bc5878d + a634fed (push pending, requires local terminal)

### Session 7 — 025-fix, migrations (2026-03-29)
- **025-fix**: Added forgot password flow to LoginScreen (new `'forgot'` mode, `Forgot password?` link in sign-in, calls `resetPasswordForEmail`). Created `ResetPasswordScreen` at `/reset-password` (public route) — handles Supabase password reset callback, calls `updatePassword`, redirects to `/login` on success. Added `resetPasswordForEmail` and `updatePassword` to `lib/auth.ts`. No migration needed.
- **Migrations**: Running 013→016→022→033→039 in Supabase SQL Editor. 013 ✓, 014 ✓ (split), 016 ✓ (split), 022 ✓. Block 4 (033) in progress.

### Session 6 — 006-fix, 022, 024-fix (2026-03-29)
- **006-fix**: Updated display-layer strings — data-testids on MaturityBadge (maturity→phase), PushToProductionModal (push-to-production-modal→launch-modal), ProjectHubScreen (push-to-production-btn→launch-btn). Warning text replaced with informational note. Modal subtitle updated.
- **022**: Created `src/api/humanTasks.ts`, `src/screens/HumanTasks/HumanTasksScreen.tsx`, added `/tasks` route to App.tsx, wired bell badge in ProjectsListScreen. Updated `src/types/db.ts` with expanded HumanTask types. ⚠️ Requires migration 022_human_tasks.sql to run in Supabase first.
- **024-fix**: Moved delete confirmation from `DeleteConfirmModal` (full-screen) to inline overlay on `ProjectCard`. Passes `onDelete` as a direct prop; overlay is anchored to the card.
- **033**: BLOCKED — Paul must run migrations/033_feature_workflow.sql + migrations/039_artifact_coherence.sql in Supabase SQL Editor.
- **040/041**: BLOCKED — Data Schema has not delivered contracts or migrations for these builds yet.
- Push pending — run `git push origin main` from local terminal.

### Session 5 — data-testid fix handoff notes (2026-03-29)
- QA blocked 012, 014, 015 — all three for zero data-testid. Fixes already committed in session 4 (commit 8b16085).
- Created fix READY notes: notes/012-change-requests-ui-fix-READY.md, notes/014-project-hub-fix-READY.md, notes/015-screens-sitemap-fix-READY.md
- Updated HANDOFFS.md build table with "Fix ✓ 2026-03-29" for 012, 014, 015
- Push pending — run `git push origin main` from local terminal (3 commits: bc5878d, a634fed, 8b16085)

### Session 4 — data-testid pass 2 + Fix 006 + Fix 024
- **Build 012**: Added cr-list, cr-row-{id}, cr-expand-{id}, cr-accept-{id}, cr-reject-{id}, cr-accept-modal, cr-accept-new-feature, cr-accept-link-feature, cr-feature-search, cr-reject-reason, cr-reject-confirm, cr-filter-status, cr-filter-screen, cr-filter-date (new date filter). Fixed P3-012b (duplicate whiteSpace property). Builds 012, 014, 015 → re-test ready.
- **Build 014**: Added setup-checklist, checklist-step-{n}, checklist-action-{n}, project-progress (new progress bar), nav-{id} per card, quick-stats, human-tasks-callout. Switched to data-driven testIds via NavCardDef.testId.
- **Build 015**: Added screens-list, add-screen-btn, screen-form, screen-name-input, screen-type-select, screen-description-input (new field), screen-route-input, screen-save-btn, screen-edit-{id}, screen-delete-{id}, screen-delete-confirm (new delete modal), screen-suggestions. Renamed tab-{key} → screen-tab-{key}. Added edit/delete functionality to ScreenCard. Extended AddScreenPanel to support edit mode.
- **Fix 006-fix**: Renamed "Push to Production" → "Launch" in ProjectHubScreen, PushToProductionModal, AdminScreen. Renamed "maturity" → "phase" in display strings (AdminScreen).
- **Fix 024-fix**: Replaced disabled Edit button stub with inline editing in ProjectHubScreen header: inline name (click-to-edit, Enter/Escape), inline description, status dropdown, preset color swatch popover (6 colors), tag input for tech_stack. All call updateProject() with optimistic updates.

---

## QA Notes

### Build 013 — CLEARED
No bugs. DB migration trigger handles auto-insert. ✓

### Build 012 — READY FOR RE-TEST
Pass 1 testids added in session 3. Pass 2 added in session 4. See deployments/012-change-requests-ui-DONE.md.

### Build 014 — READY FOR RE-TEST
Pass 1 testids added in session 3. Pass 2 added in session 4 (progress bar, setup-checklist, etc). See deployments/014-project-hub-DONE.md.

### Build 015 — READY FOR RE-TEST
Pass 1 testids added in session 3. Pass 2 added in session 4 (form testids, edit/delete, delete confirm). See deployments/015-screens-sitemap-DONE.md.

### Build 016 — P1s FIXED
P1-016a fixed (session 3). data-testid added (sessions 3+4). Outstanding: P2-016d (trigger only in migration), P2-016e (no stream fallback). See deployments/016-feature-workflow-DONE.md.
