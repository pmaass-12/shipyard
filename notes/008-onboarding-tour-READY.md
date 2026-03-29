# [008] AI-Generated Onboarding Tour — Ready for QA

**Build:** 008
**Feature:** AI-Generated Onboarding Tour
**From:** Engineer
**To:** QA
**Date:** 2026-03-28

## What's done

- **TourFab** (`src/components/TourFab.tsx`): Fixed "?" FAB at bottom-right; `data-testid="tour-fab"`; `aria-label="Take the tour"`; renders null when `tourEnabled=false`; dims (opacity 0.3) during active tour; auto-launches on first login (`tour_seen_at === null`); dispatches `shipyard:launch-tour` custom event.
- **Tour** (`src/components/Tour.tsx`): Spotlight/dim overlay; listens for `shipyard:launch-tour` event; loads steps via `GET /api/tour?project_id=`; tooltip with step counter, title, description, dot progress; `tour-exit`, `tour-back`, `tour-next`, `tour-finish` buttons; missing-target fallback note; preview mode shows "Edit this step" button; calls `markTourSeen` on finish/exit (unless previewMode).
- **generate-tour edge fn** (`netlify/edge-functions/generate-tour.ts`): POST `/api/generate-tour`; calls Claude API with screen+feature context; atomic replace via `replace_tour_steps` RPC; updates `tour_last_generated_at`.
- **tour-load edge fn** (`netlify/edge-functions/tour-load.ts` → config path `/api/tour`): GET `/api/tour?project_id=`; returns `{ enabled, steps }`.

## What to pick up

- Run `tests/onboarding-tour.spec.ts`. Verify: TourFab renders and dispatches event, tour loads mocked steps, Next/Back/Finish navigation works, missing-element shows fallback note, Exit marks tour seen, previewMode skips gate.
- Claude API call in generate-tour cannot run in tests — mock `/api/generate-tour`.

## Files to read

- `src/components/TourFab.tsx`
- `src/components/Tour.tsx`
- `src/api/tour.ts`
- `netlify/edge-functions/generate-tour.ts`
- `netlify/edge-functions/tour-load.ts`
