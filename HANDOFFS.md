# Shipyard — Handoff Log

Each build moves left to right: Engineer → QA → Done.

| Build | Name | Engineer | QA | Done |
|-------|------|----------|-----|------|
| 012 | Change Requests UI | ✓ | ⚠ Re-test ready | — |
| 013 | Project Settings | ✓ | ✓ | ✓ |
| 014 | Project Hub | ✓ | ⚠ Re-test ready | — |
| 015 | Screens Builder | ✓ | ⚠ Re-test ready | — |
| 016 | Feature Workflow | ✓ | ⚠ P1s fixed | — |
| 006-fix | Phase/Launch rename | ✓ | — | — |
| 024-fix | Inline project editing | ✓ | — | — |

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
