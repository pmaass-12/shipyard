# Build 012 — Change Requests UI — Fix READY

**Fix date:** 2026-03-29
**Engineer:** Claude
**Status:** Ready for QA re-test

---

## What was fixed

QA blocked build 012 for zero `data-testid` attributes in `ChangeRequestsScreen.tsx`. Full data-testid pass completed.

### data-testid inventory (complete)

| Selector | Element |
|----------|---------|
| `cr-list` | CR list wrapper |
| `cr-row-{id}` | CrCard root div per CR |
| `cr-expand-{id}` | Expandable detail div per CR |
| `cr-accept-{id}` | Accept button per CR |
| `cr-reject-{id}` | Reject button per CR |
| `cr-accept-modal` | Accept modal container |
| `cr-accept-new-feature` | "Create new feature" radio |
| `cr-accept-link-feature` | "Link existing feature" radio |
| `cr-feature-search` | Feature search input in accept modal |
| `cr-reject-reason` | Reject reason textarea |
| `cr-reject-confirm` | Reject confirm button |
| `cr-filter-status` | Status pills filter container |
| `cr-filter-screen` | Screen dropdown filter |
| `cr-filter-date` | Date range filter (new — today / this week / this month / all) |

### Also fixed
- **P3-012b** — Duplicate `whiteSpace` property in CrCard inline style removed (`whiteSpace: 'nowrap'` → removed, `whiteSpace: 'normal'` retained)
- `data-testid` prop removed from CrCard interface; all per-CR testids now derive from `cr.id` internally

---

## Files changed
- `src/screens/ChangeRequests/ChangeRequestsScreen.tsx`

---

## QA instructions

1. Load any project with pending change requests
2. Verify all testids in the table above resolve in Playwright via `page.getByTestId(...)`
3. Date filter: confirm filtering by today / this week / this month produces correct subsets
4. Accept flow: open modal → verify `cr-accept-modal`, radio testids, and `cr-feature-search`
5. Reject flow: expand CR → reject → verify `cr-reject-reason` and `cr-reject-confirm`
