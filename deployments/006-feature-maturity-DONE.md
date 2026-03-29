# [006] Feature Maturity + Push to Production — QA Sign-off

**Build:** 006
**Feature:** Feature Maturity + Push to Production
**Date:** 2026-03-28
**QA Result:** ✅ PASS — Ready to Deploy

## Static Review

### MaturityBadge
- `data-testid="maturity-badge-{alpha|beta|production}"` on badge pill ✅
- `data-testid="maturity-option-{alpha|beta|production}"` on all three popover options ✅
- Popover closes on outside click (mousedown handler) ✅
- `readOnly=true` suppresses popover ✅
- Active option highlighted with background fill ✅
- Colors per spec: Alpha gray, Beta amber, Production green ✅

### PushToProductionModal
- `data-testid="push-to-production-modal"` ✅
- `data-testid="push-cancel"` and `data-testid="push-confirm"` ✅
- Confirm button disabled when `featuresProduction.length === 0` ✅
- Confirm button disabled during loading state ✅
- Alpha/Beta warning count rendered when `notIncluded > 0` ✅
- Downstream triggers checklist shows Tour + What's New ✅

### push-to-production Edge Function
- Returns 401 when no auth ✅
- Returns 404 when project not found or not owned ✅
- Returns 409 when project already shipped ✅
- Returns 422 when zero Production-maturity features ✅
- Returns 200 + `{ pushed_at }` on success ✅
- Fires `generate-tour` + `generate-whats-new` via `Promise.allSettled` ✅
- Also marks `seo_settings.is_published = true` ✅

## Issues Found

None — build passes QA review.

## Test File

`tests/feature-maturity.spec.ts` — 15 tests
