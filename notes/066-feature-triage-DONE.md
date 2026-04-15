# Build 066 — Feature Triage: Engineer Done

**Date:** 2026-04-14
**Engineer:** Finn

---

## What was built

### New screen: `TriageScreen.tsx`
- Route: `/projects/:id/triage`
- Route (reprioritize mode): `/projects/:id/triage?mode=reprioritize`
- Single grouped list (MVP / Alpha / Beta) per Amendment 1 — no Kanban
- Each row: drag handle + inline name edit + tier pills + ✕ soft-delete
- Tier pill click → instant `UPDATE features SET triage_status = $tier` (no Save button)
- ✕ → soft-delete via `triage_status = 'removed'`
- `+ Add feature` → inline input, inserts with `status: 'backlog'` and `triage_status: 'mvp'`
- HTML5 drag-and-drop for within-tier reordering (client-side only, V1)
- Drag across tier borders → calls `changeTier()` → instant DB write
- Reeve suggestion line: derives most foundational MVP feature (auth keywords first, else first MVP)
- "Start building →" → queries first MVP feature, navigates to `/projects/:id/features/:featureId/chat`
- Empty MVP nudge (inline, non-blocking) if MVP is empty on CTA click
- `?mode=reprioritize` hides Reeve suggestion, replaces CTA with "Save" → back to Features

### DB types: `db.ts`
- Added `'backlog'` to `FeatureStatus` (features newly inserted during triage use `status: 'backlog'`)
- Added `export type TriageStatus = 'mvp' | 'alpha' | 'beta' | 'removed'`
- Added `triage_status: TriageStatus` field to `Feature` interface

### App.tsx
- Imported `TriageScreen`
- Added `<Route path="/projects/:id/triage" element={<TriageScreen />} />`
- Added `<Route path="/projects/:id/features/:featureId/chat" element={<FeatureWorkflowScreen />} />` (alias for the Design/PM chat step)

### FeatureBoardScreen.tsx
- `BoardFeature` interface: added `triage_status: string | null`
- Select query: added `triage_status` column
- `triageFilter` state (`'all' | 'mvp' | 'alpha' | 'beta'`, default `'mvp'`)
- `filteredFeatures` derived value: filters by tier, always hides `triage_status = 'removed'`
- Filter pills row (All | MVP | Alpha | Beta) above the board
- "Reprioritize →" link in board header (links to `/projects/:id/triage?mode=reprioritize`)
- Triage badge on each FeatureCard: small colored pill (9px, uppercase) showing MVP/Alpha/Beta

---

## Notes

- Drag reorder within tier is client-side only in V1 — no DB persistence for order within a tier
- Tier change (clicking a different pill OR dragging to a different section) persists instantly
- `triage_status` column + migration (`migrations/066_feature_triage.sql`) was applied by Sage

---

## TypeScript

`npx tsc --noEmit` — exit 0, no errors.

---

## For Quinn

- Verify `TriageScreen` renders at `/projects/:id/triage`
- Verify tier pill click triggers DB write
- Verify "Start building →" navigates to `/projects/:id/features/:featureId/chat`
- Verify empty MVP nudge appears (inline, no modal) when MVP section is empty
- Verify `?mode=reprioritize` shows "Save" instead of "Start building →"
- Verify "Reprioritize →" link in FeatureBoardScreen header
- Verify filter pills (All | MVP | Alpha | Beta) in FeatureBoardScreen
- Verify triage badge visible on FeatureCard
- Verify removed features are hidden in FeatureBoardScreen (triage_status = 'removed' excluded)
