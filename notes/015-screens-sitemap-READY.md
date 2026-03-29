# [015] Screens & Sitemap Builder — Ready for QA

**Build:** 015
**Feature:** Screens & Sitemap Builder — screen cards, add/edit/delete, Claude generate, screen detail tabs
**From:** Engineer
**To:** QA
**Date:** 2026-03-28

## What's done

- **ScreensScreen** (`src/screens/Screens/ScreensScreen.tsx`): Route `/projects/:id/screens` and `/projects/:id/screens/:screenId`. Three view states:
  - **EmptyState**: Claude generation flow — builder describes their app, Claude suggests screens, builder checks/unchecks suggestions and confirms batch add.
  - **ScreensList**: 3-column card grid; search input + type filter bar; count chips (features/bugs/CRs); "Add screen" slide-in panel for manual add; each card links to screen detail.
  - **ScreenDetail**: breadcrumb `Screens → Screen Name`; URL param `?tab=features|bugs|crs`; Features tab (feature rows with workflow_step dots), Bugs tab (severity chips), Change Requests tab (status chips).
- **screens API** (`src/api/screens.ts`): `listScreens`, `searchScreens`, `hasScreens`, `getScreen`, `getScreenFeatures`, `getScreenBugs`, `getScreenChangeRequests`, `createScreen`, `updateScreen`, `deleteScreen` (soft-delete sets `deleted_at`), `addGeneratedScreens`, `getProgressDots`.
- **generate-screens Edge Function** (`netlify/edge-functions/generate-screens.ts`): POST `/api/generate-screens`; calls Claude to suggest screens from builder's description; validates `type` against allowed values; returns suggestions only — does NOT auto-insert.
- **Types** (`src/types/db.ts`): `ScreenType`, `SCREEN_TYPE_COLORS`, `Screen`, `ScreenSummary`, `ScreenFeatureRow`.

## What to pick up

- Run migration `015_screens.sql` in Supabase SQL Editor (creates `screens` table, `screen_summary` view, `pending_cr_count_by_screen` view).
- Empty state: describe an app, generate screens, verify suggestions list, select/deselect, confirm → rows inserted.
- Screen list: search, type filter, card counts, add manual screen.
- Screen detail: features tab shows workflow_step progress dots; bugs tab; CRs tab.
- Soft-delete: delete a screen → `deleted_at` set, screen disappears from list (never hard DELETE).
- `generate-screens` endpoint requires ANTHROPIC_API_KEY env var.

## Files to read

- `src/screens/Screens/ScreensScreen.tsx`
- `src/api/screens.ts`
- `netlify/edge-functions/generate-screens.ts`
