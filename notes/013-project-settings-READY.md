# [013] Project Settings Persistence — Ready for QA

**Build:** 013
**Feature:** ProjectSettings table — consolidates all platform feature config into one row per project
**From:** Engineer
**To:** QA
**Date:** 2026-03-28

## What's done

- **projectSettings API** (`src/api/projectSettings.ts`): `getProjectSettings`, `updateProjectSettings`. Uses explicit `SETTINGS_CLIENT_COLUMNS` select string that excludes `test_mode_pin_hash` from all client queries.
- **Types** (`src/types/db.ts`): `ProjectSettings`, `ProjectSettingsPatch`, `seoIsUnpublished()` helper, `tourIsStale()` helper, `WaitlistHighlightEmbed` (JSONB embedded shape, separate from full `WaitlistHighlight` table row).
- **test-mode-validate-pin.ts** — reads `test_mode_pin_hash` from `project_settings` (was `test_mode_pin` on `projects`).
- **test-mode-set-pin.ts** — writes `test_mode_pin_hash + test_mode_pin_set_at` to `project_settings`.
- **generate-seo.ts** — maps generated fields to `seo_*` prefixed columns in `project_settings` (e.g. `meta_title` → `seo_meta_title`); writes `seo_generated_at`.
- **push-to-production.ts** — writes `seo_published_at` to `project_settings`.

## What to pick up

- Run migration `013_project_settings.sql` in Supabase SQL Editor first (creates `project_settings` table, migrates data from `seo_settings` and `projects`).
- Test Mode: set a PIN via the UI, verify PIN hash is stored in `project_settings.test_mode_pin_hash` (not `projects.test_mode_pin`), verify validation works.
- SEO: generate SEO via the SEO screen; verify fields land in `project_settings` with `seo_` prefix.
- Push to Production: verify `project_settings.seo_published_at` is updated.

## Files to read

- `src/api/projectSettings.ts`
- `netlify/edge-functions/test-mode-validate-pin.ts`
- `netlify/edge-functions/test-mode-set-pin.ts`
- `netlify/edge-functions/generate-seo.ts`
- `netlify/edge-functions/push-to-production.ts`
