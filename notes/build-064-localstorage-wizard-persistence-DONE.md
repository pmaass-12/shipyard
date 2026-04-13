# Build 064 — Wizard localStorage Persistence DONE

**Date:** 2026-04-13
**Engineer:** Finn
**Schema change:** None

---

## What was built

Wizard form state now survives page refresh or accidental navigation. Both the Setup Wizard and Distribute Wizard persist their answers to localStorage on every field change and hydrate on mount. Draft is cleared on successful completion.

---

## Files changed

### `shipyard/src/api/wizard.ts`

**`triggerWizardDefaults`** — complete rewrite:
- Removed `sessionToken: string` parameter
- Replaced `fetch('/functions/v1/generate-wizard-defaults', ...)` (wrong relative URL — was hitting Netlify, not Supabase) with `supabase.functions.invoke('generate-wizard-defaults', { body: { project_id } })`
- **Non-fatal**: logs `console.warn` on error but does NOT throw — user always advances to the hub

### `shipyard/src/screens/Setup/SetupWizardScreen.tsx`

**New types + helpers** added after imports:

```typescript
interface SetupWizardDraft {
  s1?: { name: string; description: string; color: string };
  s2?: { audienceType: AudienceType };
  s3?: { monetizationType: MonetizationType };
}

function readSetupDraft(projectId: string): SetupWizardDraft
function writeSetupDraft(projectId: string, patch: Partial<SetupWizardDraft>): void
function clearSetupDraft(projectId: string): void
```

Storage key: `shipyard_setup_wizard_draft_${projectId}`

**Screen1**:
- Renamed `projectId: _projectId` → `projectId`
- State lazy-initialized from draft (`readSetupDraft(projectId).s1 ?? defaults`)
- `useEffect([data, projectId])` writes `{ s1: data }` to draft on every field change

**Screen2**:
- `selected` state lazy-initialized from `draft.s2?.audienceType ?? 'b2c'`
- `useEffect([selected, projectId])` writes `{ s2: { audienceType: selected } }`

**Screen3**:
- Renamed `projectId: _projectId` → `projectId`
- `selected` state lazy-initialized from `draft.s3?.monetizationType ?? 'free'`
- `useEffect([selected, projectId])` writes `{ s3: { monetizationType: selected } }`

**Screen5** (`handleCompletion` + `handleSetupInfra`):
- Removed `runWizardDefaults()` wrapper + `supabase.auth.getSession()` call
- Now calls `await triggerWizardDefaults(projectId)` directly (non-fatal, no token needed)
- `clearSetupDraft(projectId)` called before `navigate()`

**Screen4 intentionally skipped** — `File[]` is not JSON-serializable.

### `shipyard/src/screens/Distribute/DistributeWizardScreen.tsx`

**New types + helpers** added after imports (same pattern):

```typescript
interface DistributeDraft { s1?: S1Data; s2?: S2Data; s3?: S3Data; s4?: S4Data; }

function readDistributeDraft(projectId: string): DistributeDraft
function writeDistributeDraft(projectId: string, data: DistributeDraft): void
function clearDistributeDraft(projectId: string): void
```

Storage key: `shipyard_distribute_wizard_draft_${projectId}`

**Main component**:
- Added `useEffect` to import
- `const pid = projectId ?? ''` — safe fallback for undefined
- All four state slices (`s1`, `s2`, `s3`, `s4`) now use lazy initializers that read from draft, falling back to the original defaults
- Single `useEffect([s1, s2, s3, s4, pid])` writes full draft on any change
- `clearDistributeDraft(pid)` called in `handleNext` after successful screen-4 DB save, before `setScreen(5)`

---

## What is NOT done

- Supabase Storage upload for Screen4 files (deferred, noted in wizard-screen4-file-upload-fix-DONE.md)
- Backend `generate-wizard-defaults` edge function itself (separate ticket)

---

## TypeScript

`npx tsc --noEmit` — zero errors before and after.
