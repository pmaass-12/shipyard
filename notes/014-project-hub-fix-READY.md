# Build 014 — Project Hub — Fix READY

**Fix date:** 2026-03-29
**Engineer:** Claude
**Status:** Ready for QA re-test

---

## What was fixed

QA blocked build 014 for zero `data-testid` attributes in `ProjectHubScreen.tsx`. Full data-testid pass completed, plus inline project editing (Fix 024).

### data-testid inventory (complete)

| Selector | Element |
|----------|---------|
| `nav-screens` | Screens nav card link |
| `nav-features` | Features nav card link |
| `nav-bugs` | Bugs nav card link |
| `nav-change-requests` | Change Requests nav card link |
| `nav-seo` | SEO/AEO nav card link |
| `nav-admin` | Admin Console nav card link |
| `nav-deployments` | Deployments nav card link |
| `nav-data-schema` | Data Schema nav card link |
| `setup-checklist` | Setup checklist container |
| `project-progress` | Project progress bar |
| `checklist-step-{n}` | Individual checklist step row |
| `checklist-action-{n}` | CTA link/button for each step |
| `human-tasks-callout` | Human tasks callout section |
| `quick-stats` | Quick stats row |
| `edit-project-btn` | Status dropdown (inline editing) |

### Also added: inline project editing (Fix 024)

Replaced stub disabled Edit button with full inline editing:

- **Project name** — click to edit inline; Enter saves, Escape cancels
- **Description** — click to edit inline textarea; blur saves
- **Status** — dropdown select (testid: `edit-project-btn`), saves on change
- **Color** — preset swatch popover (6 ProjectColor values); click to open, click swatch to save
- **Tech stack tags** — tag input with Enter-to-add and × remove; each change saves immediately

All edits call `updateProject()` with optimistic UI update.

---

## Files changed
- `src/screens/ProjectHub/ProjectHubScreen.tsx`

---

## QA instructions

1. Open any project's hub page
2. Verify all nav card links resolve via `page.getByTestId('nav-screens')` etc.
3. Verify `setup-checklist` and `project-progress` present when project has incomplete steps
4. Verify `quick-stats` and `human-tasks-callout` visible in main body
5. **Inline edit tests:**
   - Click project name → input appears → type new name → Enter → saved
   - Click description → textarea appears → blur → saved
   - Change status dropdown → saves immediately
   - Click color swatch → popover with 6 colors appears → click one → saved
   - Add tag in tech stack → Enter → tag appears; click × → tag removed
