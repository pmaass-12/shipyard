# [016] Feature Workflow UI — QA Review

**Build:** 016
**Feature:** Feature Workflow — `/projects/:id/features/:featureId`
**Date:** 2026-03-28
**QA Result:** ⚠️ STATIC REVIEW PASS · Multiple P2s to address before runtime sign-off

---

## Static Review

### Route
- `/projects/:id/features/:featureId` registered in `App.tsx` ✅
- `FeatureWorkflowScreen` reads both `id` and `featureId` from `useParams` ✅

### FeatureWorkflowScreen — data loading
- `getFeatureWithSteps(featureId)` on mount ✅
- Loading state shown ✅
- Error state shown on failure ✅
- Auto-opens active step on load (first `active` or `changes_requested` step) ✅
- Falls back to first approved step if none active ✅
- `chatTab` synced with initially opened step ✅
- `load()` wrapped in `useCallback`, called on mount and after actions ✅

### Step accordion
- 5 steps rendered from DB (not hardcoded) ✅
- `getStepRenderState`: `pending` → locked, `active`/`changes_requested` → active, `approved` → approved ✅
- Locked steps: accordion header non-clickable, `opacity: 0.5` ✅
- Progress indicator circle: ✓ when approved (green), step number when active (blue), grey when locked ✅
- StatusChip correct for all four states ✅
- Open/close toggle with `openStep` state ✅
- "Switch chat to {step}" prompt when expanded step doesn't match chat tab ✅

### Step 1 — Design panel
- Shows `spec_text` from `isDesignContent` type guard ✅
- Edit mode: textarea with save/cancel ✅
- On save: `updateStepContent(stepId, { spec_text: draft })` ✅
- Edit button hidden when `status === 'approved'` ✅
- Empty state for new spec ✅

### Step 2 — Schema panel
- Shows SQL in code block (dark background, monospace) ✅
- `migration_run` indicator: green "✓ Migration applied" badge ✅
- Edit mode: textarea pre-filled with current SQL ✅
- On save: `updateStepContent(stepId, { sql })` ✅

### Step 3 — Code panel
- Reads `files` from `isCodeContent` ✅
- File tab bar: one tab per file, active tab highlighted ✅
- File content in scrollable dark code block (max-height 480px) ✅
- Line count badge per tab ✅
- Empty state when no files yet ✅
- Code panel is read-only (no edit button) — correct per spec ✅

### Step 4 — Deploy panel
- PR URL + deploy URL inputs (edit mode) ✅
- `isDeployContent` type guard ✅
- Links rendered as clickable `<a>` tags in read mode ✅
- "Not set" placeholder when URL is null ✅

### Step 5 — QA panel
- `test_notes` textarea in edit mode ✅
- `sign_off_by` shown in green if set ✅
- `isQaContent` type guard ✅

### Approve / Request Changes
- Both actions only shown when `renderState === 'active'` ✅
- Approve: `approveStep(stepId, user.id)` → reloads page state ✅
- Request Changes: textarea required before submit ✅
- `requestChanges(stepId, note)`: sets step `status: changes_requested`, inserts iteration row ✅
- Cancel closes reject form ✅
- "Changes Requested" status correctly re-opens the step for editing ✅

### Iteration history
- `getStepIterations(stepId)` loaded on accordion open ✅
- Collapsed by default with `▸ N revisions` toggle ✅
- Each row: iteration_number + change_note ✅
- Hidden when no iterations ✅

### Human tasks banner
- `getPendingTasksForStep(stepId)` loaded on open ✅
- Amber banner only shown when tasks exist ✅
- "Mark done" calls `resolveHumanTask` via dynamic import ✅
- Optimistic removal from list ✅

### Chat sidebar
- 5 tabs (Design / Schema / Code / Deploy / QA) ✅
- Tab click updates `activeTab` + loads thread if not already cached ✅
- Thread cached in `threads` record keyed by tab number (no re-fetch) ✅
- Messages rendered with `ChatBubble` — user right-aligned, assistant left-aligned ✅
- Streaming: user message added optimistically, `streamBuf` appended chunk by chunk ✅
- Blinking cursor (`▊`) appended to last streaming chunk ✅
- On stream complete: assistant message replaces stream buffer in thread ✅
- Scroll-to-bottom ref on new messages ✅
- Enter to send (no shift), Shift+Enter for newline ✅
- Send button disabled when input empty or streaming ✅
- "Sign in to use chat" placeholder when no session token ✅

### feature-chat Edge Function
- JWT auth ✅
- Ownership verified via `project_id` FK on feature ✅
- `step_number` validated 1–5 ✅
- Loads step content for system prompt context ✅
- Loads chat thread, checks last message is from user ✅
- Returns 400 if no pending user message ✅
- Streams Claude SSE → raw text chunks via `TransformStream` ✅
- Persists assistant message via service role after stream completes ✅
- STEP_CONTEXT record covers all 5 steps ✅

### generate-feature-code Edge Function
- JWT auth + ownership verified ✅
- Returns 422 if Step 2 not yet approved ✅
- Reads Step 1 spec + Step 2 SQL for prompt context ✅
- Calls Claude with structured output ✅
- Writes `files` array to `feature_steps[step_3].content` ✅
- Creates `human_tasks` row (`task_type: push_code`, `priority: p0`) ✅

### featureWorkflow API
- `getFeatureWithSteps`: parallel feature + steps fetch ✅
- `getPendingTasksForStep`: filtered by `feature_step_id` + `status: pending` ✅
- `getStepIterations`: ordered by `iteration_number` ✅
- `getChatThread`: filtered by `feature_id` + `step_number`, ordered by `created_at` ✅
- `approveStep`: writes `status: approved`, `approved_by`, `approved_at` ✅
- `requestChanges`: updates status, counts existing iterations, inserts next ✅
- `updateStepContent`: patch content JSONB ✅
- `sendChatMessage`: inserts user message, streams Edge Function response, calls `onChunk`/`onDone` ✅
- `getStepRenderState`: pure function ✅
- All 5 type guards use `'key' in content` check ✅

---

## Issues Found

### P1-016a — `useSession` import not available
**File:** `src/screens/Features/FeatureWorkflowScreen.tsx` line 8
**Issue:** `import { useSession } from '@supabase/auth-helpers-react'` — this package is not listed in `package.json`. Shipyard uses the base `@supabase/supabase-js` client. This import will fail at build time with a module-not-found error.
**Fix:** Replace with `supabase.auth.getSession()` in a `useEffect`, or read the token from a shared auth context. Example:
```tsx
const [sessionToken, setSessionToken] = useState('');
useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    setSessionToken(session?.access_token ?? '');
  });
}, []);
```

### P2-016b — Missing `data-testid` attributes
**Issue:** No `data-testid` on any interactive element: accordion headers, Approve buttons, Request Changes button/textarea, chat input/send, tab buttons, edit/save/cancel in each step panel.
**Fix:** Add `data-testid="step-{n}-header"`, `data-testid="step-{n}-approve"`, `data-testid="step-{n}-request-changes"`, `data-testid="chat-tab-{n}"`, `data-testid="chat-input"`, `data-testid="chat-send"`.

### P2-016c — `approveStep` passes `user.id` but `session` not loaded
**File:** `src/screens/Features/FeatureWorkflowScreen.tsx`
**Issue:** `handleApprove` calls `approveStep(stepId, session?.user?.id ?? '')`. Because `useSession` (from P1-016a) is broken, `session` is `null`, and `approved_by` is always set to `''`. Even after fixing P1-016a, the `approved_by` field needs the actual user ID.
**Fix:** Resolved automatically when P1-016a is fixed and the session is loaded correctly.

### P2-016d — Step-approval trigger assumed in migration (not in code)
**Issue:** The `approveStep` function writes `status: approved` to `feature_steps`. The contract specifies a DB trigger that should automatically: activate the next step, dismiss related human tasks, and sync `features.workflow_step`. This trigger lives in migration 016 only — if the migration hasn't been run, approving a step does nothing beyond setting `status: approved` on that one step.
**Impact:** Feature won't auto-progress to next step without the migration trigger.
**Action:** Verify migration trigger fires correctly in runtime tests. Not an Engineer code bug.

### P2-016e — No streaming fallback on connection drop
**File:** `src/api/featureWorkflow.ts` + `src/screens/Features/FeatureWorkflowScreen.tsx`
**Issue:** If the `fetch` stream drops mid-response (network error, Edge Function cold-start timeout), `onDone` is never called, `streaming` stays `true` permanently, and the user cannot send another message.
**Fix:** Add a `finally` block in `sendChatMessage` that calls `onDone(full)` even on error, or set `streaming: false` in the catch block on the screen side (already partially done via `setStreaming(false)` in catch — verify this covers all failure modes).

### P3-016f — Chat thread loaded per-tab but not invalidated on approve
**Issue:** When a step is approved and `load()` reloads the workflow state, the cached `threads` record is not cleared. Messages sent before approval are still shown correctly, but if a new step becomes active and the user switches to its chat tab, the system prompt context (which includes step state) is now stale in the Edge Function's next call.
**Impact:** Cosmetic only — chat context is rebuilt from DB on each Edge Function call; client cache is just the message list.
**Action:** Low priority. Document for awareness.

---

## Runtime Tests Required (post-migration + deploy)

Run `tests/feature-workflow.spec.ts` after ALL migrations (012–016) applied:
1. Fix P1-016a (useSession import) BEFORE running runtime tests
2. `/projects/:id/features/:featureId` loads with Step 1 active, Steps 2–5 locked
3. Write spec text → save → spec_text stored in DB
4. Approve Step 1 → Step 2 becomes active (DB trigger fires), workflow_step increments
5. Write SQL → save → approve Step 2 → `generate-feature-code` called → Step 3 content populated
6. `push_code` human_task created → amber banner visible in Step 3
7. Dismiss task → banner disappears optimistically
8. Request changes: change note required, iteration row inserted, step status = changes_requested
9. Iteration history: collapsible, shows change note
10. Chat: send message → streaming response with blinking cursor → message persisted in DB
11. Chat tabs: switching tab loads correct thread, no re-fetch for already-loaded tabs
12. Step 4 Deploy: add PR URL + deploy URL → saved
13. Step 5 QA: write notes → save → approve → all steps approved → feature workflow complete

---

## Playwright Tests Written — 2026-03-28

**Test file:** `tests/feature-workflow.spec.ts` (20 scenarios)

| # | Scenario | Coverage |
|---|---------|---------|
| 016-01 | Route renders without crash | Route registration |
| 016-02 | Header shows feature name, priority chip, breadcrumb | Feature header |
| 016-03 | All 5 workflow steps in order | STEP_LABELS constant |
| 016-04 | Pending steps visually locked (opacity 0.5) | getStepRenderState → locked |
| 016-05 | Active step (step 2) auto-opens on load | Active step auto-open |
| 016-06 | Approved step shows ✓ in circle indicator | Approved state indicator |
| 016-07 | Approve button calls approveStep and shows toast | handleApprove |
| 016-08 | Request changes shows change note textarea | handleRequestChanges flow |
| 016-09 | Request changes submit disabled when empty | Change note required |
| 016-10 | Human task amber banner renders | HumanTaskBanner |
| 016-11 | Step 3 code panel renders file tabs | CodePanel + file tabs |
| 016-12 | Step 4 deploy panel shows PR + deploy URL fields | DeployPanel |
| 016-13 | Step 5 QA sign-off message when approved | QaPanel + sign_off_by |
| 016-14 | Chat sidebar renders 5 step tab buttons | ChatSidebar tabs |
| 016-15 | Chat input sends message on Enter | sendChatMessage + Enter key |
| 016-16 | Iteration history toggle shows revision entries | IterationHistory |
| 016-17 | **BUG-P1** — data-testid attributes missing | data-testid audit |
| 016-18 | Progress dots reflect step status colors | Header progress dots |
| 016-19 | Design panel edit mode behavior when approved | DesignPanel read-only |
| 016-20 | Mobile 375px — no overflow | Responsive layout |

### Outstanding blockers (from prior static review, still open)

| ID | Severity | Issue |
|----|---------|-------|
| P1-016a | **P1** | `useSession` import from `@supabase/auth-helpers-react` — package not in package.json; build will fail |
| P1-016b | **P1** | Missing `data-testid` on all interactive elements — audit test 016-17 will fail |
| P2-016c | P2 | `approved_by` always `''` (linked to P1-016a — resolves when session fixed) |
| P2-016d | P2 | Step approval trigger in migration (not frontend) — verify migration runs at deploy |
| P2-016e | P2 | No streaming fallback on connection drop |

**Status: ⚠ BLOCKED — Fix P1-016a and P1-016b before signing off.**
