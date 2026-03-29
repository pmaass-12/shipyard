# 025-fix — Forgot Password / Password Reset — READY FOR QA

**Build:** 025-fix
**Type:** Auth infrastructure fix (P1)
**Date:** 2026-03-29

---

## What was built

Users had no way to recover their accounts if they forgot their password. This adds the full reset flow.

### Changes

**`src/lib/auth.ts`**
- Added `resetPasswordForEmail(email)` — calls `supabase.auth.resetPasswordForEmail` with `redirectTo: window.location.origin + '/reset-password'`
- Added `updatePassword(newPassword)` — calls `supabase.auth.updateUser({ password: newPassword })`

**`src/screens/Login/LoginScreen.tsx`**
- Added `'forgot'` as a third mode alongside `'signin'` and `'signup'`
- "Forgot password?" link appears below the password field in sign-in mode only
- Clicking it switches the card to the forgot form (email input + send button)
- On submit: calls `resetPasswordForEmail`, shows "Check your email for a reset link."
- "Back to sign in" link returns to the sign-in form

**`src/screens/Login/ResetPasswordScreen.tsx`** (new)
- Route: `/reset-password` (public, outside AuthGuard)
- Supabase auto-parses the hash tokens from the email link — no manual token handling needed
- Shows: new password + confirm password inputs with show/hide toggles
- Validates: passwords match, minimum 8 characters
- On submit: calls `updatePassword`, shows success message, redirects to `/login` after 2s

**`src/App.tsx`**
- Added `import ResetPasswordScreen`
- Added `<Route path="/reset-password" element={<ResetPasswordScreen />} />` as a public route (above the AuthGuard block)

---

## data-testids added

| testid | Element |
|--------|---------|
| `forgot-password-link` | "Forgot password?" button in sign-in form |
| `forgot-email-input` | Email input in forgot mode |
| `forgot-submit` | "Send reset link" button |
| `forgot-success` | Success confirmation message |
| `reset-password-input` | New password input on /reset-password |
| `reset-confirm-input` | Confirm password input on /reset-password |
| `reset-submit` | "Update password" button |
| `reset-success` | Success message after update |

---

## QA checklist

- [ ] "Forgot password?" link visible below password field in sign-in mode only (not in sign-up)
- [ ] Clicking link shows forgot form; Google button and sign-in/up form hidden
- [ ] "Back to sign in" returns to sign-in form
- [ ] Submitting forgot form with valid email shows success message
- [ ] Submitting forgot form with invalid email shows error
- [ ] `/reset-password` page loads without auth (public route)
- [ ] After clicking email link, `/reset-password` shows password form
- [ ] Mismatched passwords show "Passwords do not match." error
- [ ] Password shorter than 8 chars shows length error
- [ ] Valid submission shows "Password updated! Redirecting…" then navigates to `/login`

---

## No migration required

Auth is handled entirely by Supabase Auth — no schema changes.
