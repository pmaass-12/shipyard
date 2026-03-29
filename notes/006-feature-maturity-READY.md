# [006] Feature Maturity + Push to Production — Ready for QA

**Build:** 006
**Feature:** Feature Maturity + Push to Production
**From:** Engineer
**To:** QA
**Date:** 2026-03-28

## What's done

- **MaturityBadge** (`src/components/MaturityBadge.tsx`): Alpha/Beta/Production pill badge with popover; `data-testid="maturity-badge-{alpha|beta|production}"` on badge button; `data-testid="maturity-option-{m}"` on popover options; closes on outside click; `readOnly` prop suppresses popover.
- **PushToProductionModal** (`src/components/PushToProductionModal.tsx`): Centered 440px modal listing Production features, Alpha/Beta warning count, downstream triggers checklist; `data-testid="push-to-production-modal"`, `push-cancel`, `push-confirm`; confirm disabled when `featuresProduction.length === 0` or `loading`.
- **push-to-production edge fn** (`netlify/edge-functions/push-to-production.ts`): Atomic update sets `status='shipped'`, `phase='live'`, `pushed_to_production_at`; 401/404/409/422/500 error codes; fires `generate-tour` + `generate-whats-new` in parallel via `Promise.allSettled`; also marks SEO settings as published.

## What to pick up

- Run `tests/feature-maturity.spec.ts`. Verify: maturity badge opens/closes popover, option selection triggers onChange, push modal renders and can be cancelled, confirm is blocked when no Production features, push endpoint returns correct status codes.
- Known gap: downstream generate-tour/generate-whats-new calls happen inside the edge function — not directly testable from UI tests.

## Files to read

- `src/components/MaturityBadge.tsx`
- `src/components/PushToProductionModal.tsx`
- `netlify/edge-functions/push-to-production.ts`
