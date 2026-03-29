# [016] Feature Workflow UI — Ready for QA

**Build:** 016
**Feature:** 5-step Feature Workflow — accordion UI, Claude chat sidebar, streaming, iteration history
**From:** Engineer
**To:** QA
**Date:** 2026-03-28

## What's done

- **FeatureWorkflowScreen** (`src/screens/Features/FeatureWorkflowScreen.tsx`): Route `/projects/:id/features/:featureId`. Two-panel layout:
  - **Left panel** — 5-step vertical accordion (Design → Schema → Code → Deploy → QA). Each step accordion: status chip, render state driven by `feature_steps.status` (`pending` = locked, `active`/`changes_requested` = open/editable, `approved` = collapsed read-only). Approve button / Request Changes textarea per active step. Human tasks amber banner per step. Iteration history (collapsed by default). Inline edit for Design (spec text), Schema (SQL), Deploy (PR/deploy URLs), QA (test notes). Code step shows generated files in tab view (read-only).
  - **Right panel** — Persistent Claude chat sidebar with 5 tabs (one per step). Chat thread persists in `feature_chat_messages`. Streams response as raw text chunks with blinking cursor. Enter to send, Shift+Enter for newline.
- **featureWorkflow API** (`src/api/featureWorkflow.ts`): `getFeatureWithSteps`, `getPendingTasksForStep`, `getStepIterations`, `getChatThread`, `approveStep`, `requestChanges`, `updateStepContent`, `sendChatMessage` (inserts user msg + streams), `getStepRenderState`, type guards.
- **feature-chat Edge Function** (`netlify/edge-functions/feature-chat.ts`): POST `/api/feature-chat`; auth + ownership check; loads step context + chat thread; streams Claude response as raw UTF-8; persists assistant message via service role after stream completes.
- **generate-feature-code Edge Function** (`netlify/edge-functions/generate-feature-code.ts`): POST `/api/generate-feature-code`; called automatically when Step 2 is approved; reads Step 1 spec + Step 2 SQL; calls Claude (structured output); writes files array to `feature_steps[step_3].content`; creates `human_tasks` row (task_type: `push_code`); returns 422 if Step 2 not yet approved.
- **Types** (`src/types/db.ts`): `FeatureStepStatus`, `StepFile`, `StepContent`, `FeatureStep`, `FeatureIteration`, `FeatureChatMessage`, `STEP_LABELS`.

## What to pick up

- Run migration `016_feature_workflow.sql` in Supabase SQL Editor (adds `feature_steps`, `feature_iterations`, `feature_chat_messages` tables; adds `feature_id`/`feature_step_id` FKs to `human_tasks`; adds DB trigger to sync `features.workflow_step` on step approval).
- Navigate to a feature via `/projects/:id/features/:featureId` — verify accordion loads with Step 1 active.
- Approve Step 1 (Design) → verify Step 2 becomes active.
- Approve Step 2 (Schema) → verify `generate-feature-code` is called automatically (Step 3 content populated, `push_code` human task appears).
- Chat sidebar: send a message on Step 1 tab → verify streaming response appears; verify message persisted in `feature_chat_messages`.
- Request changes: enter a note, submit → step status → `changes_requested`; iteration row inserted; iteration history collapsible shows it.
- Code tab: verify generated files render with syntax-highlighted tabs.
- Deploy step: add PR URL + deploy URL → saved.
- QA step: write test notes → saved; approve to complete workflow.

## Files to read

- `src/screens/Features/FeatureWorkflowScreen.tsx`
- `src/api/featureWorkflow.ts`
- `netlify/edge-functions/feature-chat.ts`
- `netlify/edge-functions/generate-feature-code.ts`
