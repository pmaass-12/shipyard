# [009] What's New Screen — QA Sign-off

**Build:** 009
**Feature:** What's New Screen
**Date:** 2026-03-28
**QA Result:** ✅ PASS — Ready to Deploy

## Static Review

### WhatsNewScreen
- Route: `/projects/:id/whats-new` ✅
- Fetches `GET /api/whats-new?project_id=` ✅
- Calls `markWhatsNewSeen(user.id)` on mount → clears red dot badge ✅
- Loading state shown before data arrives ✅
- Error state shows "Couldn't load release notes — check your connection." ✅
- Empty state (disabled or no releases): ✨ icon + "Nothing here yet" + explanatory copy ✅
- Releases in reverse-chronological order (newest first) ✅
- "✨ What's New" H1 heading ✅

### ReleaseCard
- Card header: formatted date + "NEW" pill on first (newest) card only ✅
- "▲ New Features" section with feature items (14px, purple dot) ✅
- "⏱ Bugs Fixed" section with bug items (11px muted, gray dot, separated by top border) ✅
- Features/bugs sections only rendered when items exist ✅
- Empty items fallback: "This release has no notes." ✅

### whats-new-load Edge Function (GET /api/whats-new)
- No auth required — public content ✅
- Returns 400 when `project_id` missing ✅
- Returns `{ enabled: false, releases: [] }` when `whats_new_enabled=false` ✅
- Returns releases with items sorted by `sort_order` ✅
- Ordered by `release_date DESC` ✅

### generate-whats-new Edge Function
- Called by push-to-production (not directly by UI) ✅
- Auth required ✅
- Uses Claude API to generate feature/bug_fix items ✅

## Issues Found

None — build passes QA review.

## Test File

`tests/whats-new.spec.ts` — 20 tests
