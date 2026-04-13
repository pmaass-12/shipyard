# Admin Console Env Gate Fix DONE

**Date:** 2026-04-13
**Engineer:** Finn
**Schema change:** None
**Migration:** None

---

## Root cause

`AdminScreen.tsx` had a build-time guard:

```typescript
const ADMIN_ENABLED = import.meta.env.VITE_SHIPYARD_ADMIN === 'true';
```

…checked at render time:

```typescript
if (!ADMIN_ENABLED) {
  return <lock screen: "Not available in this environment.">
}
```

`VITE_SHIPYARD_ADMIN` was never set in the Netlify dashboard, so it evaluated to `undefined === 'true'` → `false` → lock screen in production. It only worked in local dev if a developer happened to set it in `.env.local`.

---

## Fix

Removed the guard entirely. Admin Console is a core feature, not a dev-only screen. Access control is enforced at the Edge Function level (owner/admin role checks on all writes).

---

## Files changed

| File | Change |
|------|--------|
| `shipyard/src/screens/Admin/AdminScreen.tsx` | Removed `// ── Is admin enabled?` section + `const ADMIN_ENABLED` constant · Removed `if (!ADMIN_ENABLED) { return <lock screen> }` block at top of `AdminScreen()` · Updated file header comment (removed "Gated by VITE_SHIPYARD_ADMIN" line) |
| `shipyard/src/App.tsx` | Updated comment on Admin Console route (removed stale env var reference) |

---

## QA note

The existing tests in `tests/admin-console.spec.ts` include:
- A test that the lock screen shows when `VITE_SHIPYARD_ADMIN` is NOT set (line 121) — this test is now stale and should be removed
- A test that the Admin Console renders when `VITE_SHIPYARD_ADMIN=true` (line 126) — this test still passes but the env var condition is irrelevant now; the test can be simplified

Quinn: please remove or update those two tests as part of this QA pass.

---

## TypeScript

`npx tsc --noEmit` — zero errors.
