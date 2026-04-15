# Build 065 — Brief-First Onboarding: Done

**Date:** 2026-04-15
**Engineer:** Finn

---

## What was built

### `supabase/functions/extract-features-from-brief/index.ts` (new)

- POST `{ project_id }` → reads `project_settings.description`, calls Claude, inserts 4–10 features
- Idempotency: checks `COUNT(*) FROM features WHERE project_id = ?` — skips if > 0
- Calls Claude via `getAIClient(projectId)` with `characterAnchor('reeve')` as system prompt
- Sanitises Claude output: caps at 10 features, validates complexity (simple/medium/complex), filters empty names
- Inserts features with `status: 'backlog'`, `triage_status: 'mvp'`, `complexity` from Claude
- Requires migrations/067_feature_status_backlog.sql ('backlog' in feature_status enum)
- Always returns HTTP 200 — never 4xx/5xx (caller is fire-and-forget)
- All catch blocks use `extractErrorMessage`

### `shipyard/src/api/wizard.ts` (modified)

Three new exported functions added before `triggerWizardDefaults`:

| Function | What it does |
|---|---|
| `saveBrief(projectId, description)` | Upserts `project_settings.description` — stores the builder's product brief |
| `triggerExtractFeatures(projectId)` | Invokes `extract-features-from-brief` EF (fire-and-forget, non-fatal) |
| `saveDesignKickoff(projectId, vibes, urls)` | Upserts `design_vibe TEXT[]` and `inspiration_urls JSONB` on `project_settings` |

Existing functions (`saveAudienceType`, `saveMonetizationType`, `saveWizardIdentity`, `triggerWizardDefaults`) are preserved for backwards compatibility.

### `shipyard/src/screens/Setup/SetupWizardScreen.tsx` (full rewrite)

Old 5-screen wizard (Build 032) replaced with a 2-screen flow:

**Screen 1 — Brief (`step === 'brief'`)**
- Reeve avatar + name + tagline ("I'll read your brief and get the team started.")
- 4-row textarea with placeholder copy
- File upload row: accepts PDF/DOCX/TXT; for .txt/.md files, reads content client-side and appends to textarea; PDF/DOCX noted but not extracted in V1
- "Let's go →" button
- On submit: `saveBrief()` → `setStep('loading')` → `Promise.all([triggerExtractFeatures(), triggerWizardDefaults(), 1.8s delay])` → `setStep('kickoff')`
- Draft persisted to localStorage under `shipyard_setup_wizard_draft_${projectId}` key

**Loading screen (`step === 'loading'`)**
- Large Reeve avatar with double pulse ring (CSS animation)
- "Reading your brief…" headline
- Three progress steps with animated states: "Brief received" (done) → "Extracting features" (blinking dot) → "Suggesting screens" (pending)
- No top bar during loading
- `triggerWizardDefaults` is called here in parallel with `triggerExtractFeatures` — replaces the old Screen 5 trigger

**Screen 2 — Design Kickoff (`step === 'kickoff'`)**
- Section 1 (numbered circle): vibe chips — 6 options, max 2 selected, accent-colored when active
- Section 2: inspiration URL inputs — starts with 1, "× remove" on additional rows, "+ Add another" up to 3
- Section 3: screen checklist in 2-col grid — 6 hardcoded options (Dashboard, Sign In, Settings, User Profile, Onboarding, Admin Panel), all pre-checked except Admin Panel
- "Set up my project →" CTA: `saveDesignKickoff()` + `clearSetupDraft()` + navigate to `/projects/:id/triage`
- "Skip for now" link: `clearSetupDraft()` + navigate to `/projects/:id`
- Back button in TopBar (← Back)

**TopBar component**
- Shows "Step N of 2", Shipyard wordmark, optional Back button
- Hidden during loading screen

**Draft persistence**
- `SetupWizardDraft` type updated to `{ s1?: { brief: string }; s2?: { vibes: string[]; inspirationUrls: string[] } }`
- Draft key unchanged: `shipyard_setup_wizard_draft_${projectId}`
- Draft cleared on both "Set up my project →" and "Skip for now"

**Removed from the old wizard:**
- All of `Screen1` (product name, description, color swatches) — name captured at project creation
- All of `Screen2` (audience type selector)
- All of `Screen3` (monetization type picker)
- All of `Screen4` (document category upload)
- All of `Screen5` (completion / pulse ring)
- `COLOR_SWATCHES`, `AUDIENCE_CARDS`, `MONETIZATION_CARDS` constants
- `getWizardScreenCount`, `getNextWizardScreen`, `getWizardDotCount` imports

**Retained from the old wizard:**
- Design tokens `T` (identical values)
- `readSetupDraft`, `writeSetupDraft`, `clearSetupDraft` helpers (updated draft type)
- `extractErrorMessage` import and usage
- Inline styles only (no Tailwind)
- `useToast`, `useNavigate`, `useParams`

---

## PRD deviations

| PRD / Amendment says | Actual implementation | Reason |
|---|---|---|
| Amendment 2: remove Design Kickoff | Design Kickoff retained as Screen 2 | User's build prompt and Wren's spec both include it. Amendment 2 also requires `target_audience`/`target_customer` columns that Sage didn't add. Implementing per user spec. |
| Section 3 uses `generate-screen-suggestions` EF | Hardcoded 6-screen checklist (V1) | `generate-screen-suggestions` EF (PRD 055-upd) doesn't exist yet. V1 uses static common screens. Wire to EF in V2. |
| File upload: extract text from PDF/DOCX | TXT/MD extracted client-side; PDF/DOCX shown but not parsed | Server-side extraction requires a separate EF or library. V1: TXT/MD via FileReader. PDF/DOCX noted as V2. |
| `generate-product-brief` EF (Amendment 1) | Not implemented | Amendment 1's "Build it with Reeve" tab requires a full embedded chat UI. Out of scope for this build — V2. |
| Operation B (screen suggestions) runs in parallel with feature extraction | `generate-wizard-defaults` run in parallel instead | `generate-wizard-defaults` already handles screen seeding and is idempotent. Reusing it avoids needing `generate-screen-suggestions` in V1. |

---

## TypeScript

`npx tsc --noEmit` (frontend) — exit 0, no errors.

---

## Deploy

```bash
supabase functions deploy extract-features-from-brief
```

Prerequisites (must be applied before deploy):
- `migrations/065_design_kickoff.sql` — adds `design_vibe`, `inspiration_urls` to `project_settings`
- `migrations/067_feature_status_backlog.sql` — adds `'backlog'` to `feature_status` enum

---

## For Quinn

- POST to `/functions/v1/extract-features-from-brief` with `{ "project_id": "<uuid>" }` using service role key
  - Returns `{ ok: true, features_created: N }` when features are extracted and inserted
  - Second call with same `project_id` returns `{ skipped: true, features_created: 0 }` (idempotency)
  - A call where `project_settings.description` is null returns `{ ok: false, error: "No product brief found..." }`
- Verify wizard route `/projects/:id/wizard` renders Screen 1 (Brief) with `data-testid="wizard-screen-brief"`
- Verify "Let's go →" shows loading screen (`data-testid="wizard-screen-loading"`) then transitions to kickoff
- Verify kickoff `data-testid="wizard-screen-kickoff"` has: vibe chips, URL inputs, screen checklist
- Verify "Set up my project →" navigates to `/projects/:id/triage`
- Verify "Skip for now" navigates to `/projects/:id`
- Verify Back button in kickoff goes back to brief screen
- Verify vibe chip max-2 enforcement: clicking a 3rd chip when 2 are already selected has no effect
- Verify "+ Add another" capped at 3 URL rows; "× remove" works
