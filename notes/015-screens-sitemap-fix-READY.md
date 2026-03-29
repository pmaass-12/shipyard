# Build 015 — Screens / Sitemap — Fix READY

**Fix date:** 2026-03-29
**Engineer:** Claude
**Status:** Ready for QA re-test

---

## What was fixed

QA blocked build 015 for zero `data-testid` attributes in `ScreensScreen.tsx`. Full data-testid pass completed, plus edit and delete functionality added to ScreenCard.

### data-testid inventory (complete)

| Selector | Element |
|----------|---------|
| `screens-list` | Screen cards grid wrapper |
| `add-screen-btn` | Add Screen button |
| `screen-tab-{key}` | Tab buttons (e.g. `screen-tab-all`, `screen-tab-page`) |
| `screen-card-{id}` | ScreenCard root div per screen |
| `screen-edit-{id}` | Edit button per screen card |
| `screen-delete-{id}` | Delete button per screen card |
| `screen-delete-confirm` | Delete confirmation modal |
| `screen-form` | AddScreenPanel inner form div |
| `screen-name-input` | Name text input |
| `screen-type-select` | Screen type select |
| `screen-description-input` | Description textarea (new field) |
| `screen-route-input` | Route path input |
| `screen-save-btn` | Save / Update button |
| `screen-suggestions` | AI suggestions list container |

### Also added: screen edit & delete (new functionality)

- **Edit**: Clicking `screen-edit-{id}` opens AddScreenPanel in edit mode, pre-populated with existing screen data. Calls `updateScreen()` on save.
- **Delete**: Clicking `screen-delete-{id}` opens a delete confirmation modal (`screen-delete-confirm`). Confirms before calling `deleteScreen()` (soft delete).
- **AddScreenPanel** now supports both create and edit modes via optional `screenId` + `initialData` props.
- Route input now always visible (previously hidden behind "advanced" toggle).
- Description field added to form.

---

## Files changed
- `src/screens/Screens/ScreensScreen.tsx`

---

## QA instructions

1. Open any project's Screens page
2. Verify `screens-list`, `add-screen-btn`, and tab buttons (`screen-tab-all` etc.) resolve
3. Verify each screen card has `screen-card-{id}`, `screen-edit-{id}`, `screen-delete-{id}`
4. **Add flow:** click `add-screen-btn` → form appears with all testids → fill in → save
5. **Edit flow:** click `screen-edit-{id}` → form pre-populated → modify → save → card updates
6. **Delete flow:** click `screen-delete-{id}` → confirm modal appears (`screen-delete-confirm`) → confirm → card removed
7. Verify `screen-suggestions` visible when AI suggestions are present
