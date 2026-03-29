# [014] Project Hub — Ready for QA

**Build:** 014
**Feature:** Project Hub — `/projects/:id` main landing page
**From:** Engineer
**To:** QA
**Date:** 2026-03-28

## What's done

- **ProjectHubScreen** (`src/screens/ProjectHub/ProjectHubScreen.tsx`): Route `/projects/:id`; PhaseBadge (inline dropdown to advance Alpha → Beta → Live); human tasks amber callout (pending `human_tasks` rows with dismiss/mark-done); 6-step SetupChecklist (collapses to summary when all steps complete); 8-card NavGrid (Screens, Features, Change Requests, SEO, What's New, Test Mode, Tour, Waitlist); quick stats row (4 stat chips from `project_hub_stats` view); "Push to Production" button (Beta phase only).
- **projectHub API** (`src/api/projectHub.ts`): `getProjectHubStats`, `getProject`, `getPendingHumanTasks`, `advanceProjectPhase`, `updateSetupStep`, `resolveHumanTask`, `SETUP_STEPS`, `getSetupChecklistState`, `isSetupComplete`, `nextPhase`.
- **Types** (`src/types/db.ts`): `HumanTaskType`, `HumanTaskStatus`, `HumanTaskPriority`, `HumanTask`, `ProjectHubStats`.

## What to pick up

- Run migration `014_project_hub.sql` in Supabase SQL Editor (creates `human_tasks` table, `project_hub_stats` view).
- Visit `/projects/:id` — verify stats row shows correct counts.
- Advance phase: Alpha → Beta, verify phase badge updates.
- Human tasks: insert a row directly in Supabase; verify amber callout appears, dismiss works.
- Setup checklist: verify each step can be marked complete, collapses to summary when all done.
- Nav grid: all 8 cards link to correct routes.

## Files to read

- `src/screens/ProjectHub/ProjectHubScreen.tsx`
- `src/api/projectHub.ts`
- `src/types/db.ts` (HumanTask, ProjectHubStats)
