# [008] AI-Generated Onboarding Tour — QA Sign-off

**Build:** 008
**Feature:** AI-Generated Onboarding Tour
**Date:** 2026-03-28
**QA Result:** ✅ PASS — Ready to Deploy

## Static Review

### TourFab
- `data-testid="tour-fab"` ✅
- `aria-label="Take the tour"` ✅
- Renders null when `tourEnabled=false` ✅
- Dims to `opacity: 0.3` + `pointerEvents: none` during active tour ✅
- Auto-launches via `dispatchEvent('shipyard:launch-tour')` when `tour_seen_at === null` ✅
- Pulsed once on first render before tour seen ✅

### Tour
- Listens for `shipyard:launch-tour` custom event ✅
- Loads steps via `GET /api/tour?project_id=` ✅
- Step counter "Step N of M" ✅
- `tour-exit` button ✅
- `tour-back` button (hidden on step 0) ✅
- `tour-next` button (last step shows `tour-finish`) ✅
- Missing target selector → centered tooltip + MISSING_ELEMENT_NOTE appended ✅
- Preview mode: "Edit this step" button dispatches `shipyard:edit-tour-step` event ✅
- Calls `markTourSeen(userId)` on finish and exit (unless previewMode) ✅
- Returns null in idle/loading phase ✅

### generate-tour Edge Function
- Auth required (401 without JWT) ✅
- Ownership verified (404 if not owner) ✅
- Returns `{ step_count: 0 }` when no screens ✅
- Claude API call with screen+feature context ✅
- Strips markdown code fences from Claude response ✅
- Atomic replace via `replace_tour_steps` RPC ✅
- Updates `tour_last_generated_at` ✅

### tour-load Edge Function (GET /api/tour)
- No auth required ✅
- Returns `{ enabled: false, steps: [] }` when feature disabled ✅
- Returns full steps array on success ✅

## Issues Found

None — build passes QA review.

## Test File

`tests/onboarding-tour.spec.ts` — 22 tests
