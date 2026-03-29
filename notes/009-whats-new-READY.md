# [009] What's New Screen — Ready for QA

**Build:** 009
**Feature:** What's New Screen
**From:** Engineer
**To:** QA
**Date:** 2026-03-28

## What's done

- **WhatsNewScreen** (`src/screens/WhatsNew/WhatsNewScreen.tsx`): Route `/projects/:id/whats-new`; fetches from `GET /api/whats-new?project_id=`; marks `whats_new_last_seen_at` on mount (clears red dot badge); reverse-chronological release cards; NEW pill on first card; features section (14px, purple dot) + bugs-fixed section (11px muted, gray dot) within each card; empty state ("Nothing here yet") when disabled or no releases; error state on API failure; loading state.
- **whats-new-load edge fn** (`netlify/edge-functions/whats-new-load.ts`): GET `/api/whats-new`; no auth required (public content); returns `{ enabled: false, releases: [] }` when disabled; releases sorted newest-first; items sorted by `sort_order` within each release.
- **generate-whats-new edge fn** (`netlify/edge-functions/generate-whats-new.ts`): POST `/api/generate-whats-new`; called by push-to-production; uses Claude API to generate release note items from Production-maturity features.

## What to pick up

- Run `tests/whats-new.spec.ts`. Verify: screen loads mocked releases, NEW pill on most recent only, features and bugs-fixed sections render correctly, empty state on disabled/no-releases, markWhatsNewSeen called on mount, error state on 500.
- The `red dot badge` in the nav depends on `whats_new_last_seen_at` — that state lives outside this screen; test scope covers the mark-seen side-effect only.

## Files to read

- `src/screens/WhatsNew/WhatsNewScreen.tsx`
- `src/api/whatsNew.ts`
- `netlify/edge-functions/whats-new-load.ts`
- `netlify/edge-functions/generate-whats-new.ts`
