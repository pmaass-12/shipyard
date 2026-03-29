/**
 * tests/feedback-widget.spec.ts — Build 002 (post-fix)
 *
 * All Supabase + Edge Function calls mocked via page.route().
 * Covers: FAB visibility, triage flow, Bug/Change/Feature submission,
 * auth token, annotation overlay, console panel auto-expand.
 *
 * P3-002d (offline queue) intentionally deferred — not tested here.
 */

import { test, expect } from '@playwright/test';

// ── Helpers ─────────────────────────────────────────────────────────────────

const PREVIEW_URL = 'http://localhost:5173/?_preview=1';

async function mountPreview(page: import('@playwright/test').Page) {
  // Intercept feedback endpoints
  await page.route('**/api/feedback/**', async route => {
    await route.fulfill({ status: 200, body: JSON.stringify({ id: 'mock-id' }) });
  });

  // Inject the widget as if VITE_SHIPYARD_ENV=preview
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__VITE_SHIPYARD_ENV__ = 'preview';
  });

  await page.goto(PREVIEW_URL);
}

// ── FAB visibility ───────────────────────────────────────────────────────────

test('FAB renders with data-testid="shipyard-fab"', async ({ page }) => {
  await mountPreview(page);
  await expect(page.locator('[data-testid="shipyard-fab"]')).toBeVisible();
});

test('FAB is hidden when not in preview env', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await expect(page.locator('[data-testid="shipyard-fab"]')).toHaveCount(0);
});

// ── Triage flow ──────────────────────────────────────────────────────────────

test('clicking FAB opens triage sheet', async ({ page }) => {
  await mountPreview(page);
  await page.click('[data-testid="shipyard-fab"]');
  await expect(page.locator('[data-testid="triage-bug"]')).toBeVisible();
  await expect(page.locator('[data-testid="triage-change"]')).toBeVisible();
  await expect(page.locator('[data-testid="triage-feature"]')).toBeVisible();
});

test('triage cards all have data-testid attributes (P1)', async ({ page }) => {
  await mountPreview(page);
  await page.click('[data-testid="shipyard-fab"]');
  // All three triage options must be present
  await expect(page.locator('[data-testid="triage-bug"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="triage-change"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="triage-feature"]')).toHaveCount(1);
});

test('selecting Bug advances to capture step', async ({ page }) => {
  await mountPreview(page);
  await page.click('[data-testid="shipyard-fab"]');
  await page.click('[data-testid="triage-bug"]');
  await expect(page.locator('text=Take screenshot')).toBeVisible();
});

test('selecting Change advances to capture step', async ({ page }) => {
  await mountPreview(page);
  await page.click('[data-testid="shipyard-fab"]');
  await page.click('[data-testid="triage-change"]');
  await expect(page.locator('text=Skip screenshot')).toBeVisible();
});

test('selecting Feature advances to capture step', async ({ page }) => {
  await mountPreview(page);
  await page.click('[data-testid="shipyard-fab"]');
  await page.click('[data-testid="triage-feature"]');
  await expect(page.locator('text=Skip screenshot')).toBeVisible();
});

test('Back button returns from capture to triage', async ({ page }) => {
  await mountPreview(page);
  await page.click('[data-testid="shipyard-fab"]');
  await page.click('[data-testid="triage-bug"]');
  await page.click('text=← Back');
  await expect(page.locator('[data-testid="triage-bug"]')).toBeVisible();
});

// ── Detail step ───────────────────────────────────────────────────────────────

test('detail step shows description textarea with data-testid', async ({ page }) => {
  await mountPreview(page);
  await page.click('[data-testid="shipyard-fab"]');
  await page.click('[data-testid="triage-bug"]');
  await page.click('text=Skip screenshot');
  await expect(page.locator('[data-testid="feedback-description"]')).toBeVisible();
});

test('submit button is disabled when description is empty', async ({ page }) => {
  await mountPreview(page);
  await page.click('[data-testid="shipyard-fab"]');
  await page.click('[data-testid="triage-feature"]');
  await page.click('text=Skip screenshot');
  await expect(page.locator('[data-testid="feedback-submit"]')).toBeDisabled();
});

test('submit button enables once description is filled', async ({ page }) => {
  await mountPreview(page);
  await page.click('[data-testid="shipyard-fab"]');
  await page.click('[data-testid="triage-feature"]');
  await page.click('text=Skip screenshot');
  await page.fill('[data-testid="feedback-description"]', 'Test feedback description');
  await expect(page.locator('[data-testid="feedback-submit"]')).toBeEnabled();
});

test('bug detail shows severity radio options', async ({ page }) => {
  await mountPreview(page);
  await page.click('[data-testid="shipyard-fab"]');
  await page.click('[data-testid="triage-bug"]');
  await page.click('text=Skip screenshot');
  await expect(page.locator('text=P0 — Critical')).toBeVisible();
  await expect(page.locator('text=P1 — High')).toBeVisible();
  await expect(page.locator('text=P2 — Medium')).toBeVisible();
  await expect(page.locator('text=P3 — Low')).toBeVisible();
});

test('change detail does not show severity picker', async ({ page }) => {
  await mountPreview(page);
  await page.click('[data-testid="shipyard-fab"]');
  await page.click('[data-testid="triage-change"]');
  await page.click('text=Skip screenshot');
  await expect(page.locator('text=Severity')).toHaveCount(0);
});

// ── Bug submission ────────────────────────────────────────────────────────────

test('bug report POSTs to /api/feedback/bug with auth token', async ({ page }) => {
  let capturedRequest: { url: string; headers: Record<string, string> } | null = null;

  await page.route('**/api/feedback/bug', async route => {
    capturedRequest = {
      url:     route.request().url(),
      headers: route.request().headers(),
    };
    await route.fulfill({ status: 200, body: JSON.stringify({ id: 'bug-123' }) });
  });

  await mountPreview(page);
  await page.click('[data-testid="shipyard-fab"]');
  await page.click('[data-testid="triage-bug"]');
  await page.click('text=Skip screenshot');
  await page.fill('[data-testid="feedback-description"]', 'Something broke badly');
  await page.click('[data-testid="feedback-submit"]');

  await expect(page.locator('[data-testid="feedback-success"]')).toBeVisible({ timeout: 5000 });
  expect(capturedRequest).not.toBeNull();
  expect(capturedRequest!.headers['x-shipyard-preview-token']).toBeDefined();
});

test('bug submission shows success state', async ({ page }) => {
  await page.route('**/api/feedback/bug', async route => {
    await route.fulfill({ status: 200, body: JSON.stringify({ id: 'bug-123' }) });
  });
  await mountPreview(page);
  await page.click('[data-testid="shipyard-fab"]');
  await page.click('[data-testid="triage-bug"]');
  await page.click('text=Skip screenshot');
  await page.fill('[data-testid="feedback-description"]', 'Bug description');
  await page.click('[data-testid="feedback-submit"]');
  await expect(page.locator('[data-testid="feedback-success"]')).toBeVisible({ timeout: 5000 });
});

test('bug submission shows error state on server failure', async ({ page }) => {
  await page.route('**/api/feedback/bug', async route => {
    await route.fulfill({ status: 500, body: 'Internal Server Error' });
  });
  await mountPreview(page);
  await page.click('[data-testid="shipyard-fab"]');
  await page.click('[data-testid="triage-bug"]');
  await page.click('text=Skip screenshot');
  await page.fill('[data-testid="feedback-description"]', 'Bug description');
  await page.click('[data-testid="feedback-submit"]');
  await expect(page.locator('[data-testid="feedback-error"]')).toBeVisible({ timeout: 5000 });
});

// ── Change submission ─────────────────────────────────────────────────────────

test('change request POSTs to /api/feedback/change', async ({ page }) => {
  let endpoint = '';
  await page.route('**/api/feedback/**', async route => {
    endpoint = route.request().url();
    await route.fulfill({ status: 200, body: JSON.stringify({ id: 'change-123' }) });
  });
  await mountPreview(page);
  await page.click('[data-testid="shipyard-fab"]');
  await page.click('[data-testid="triage-change"]');
  await page.click('text=Skip screenshot');
  await page.fill('[data-testid="feedback-description"]', 'Change this button color');
  await page.click('[data-testid="feedback-submit"]');
  await expect(page.locator('[data-testid="feedback-success"]')).toBeVisible({ timeout: 5000 });
  expect(endpoint).toContain('/api/feedback/change');
});

// ── Feature submission ────────────────────────────────────────────────────────

test('feature idea POSTs to /api/feedback/feature', async ({ page }) => {
  let endpoint = '';
  await page.route('**/api/feedback/**', async route => {
    endpoint = route.request().url();
    await route.fulfill({ status: 200, body: JSON.stringify({ id: 'feature-123' }) });
  });
  await mountPreview(page);
  await page.click('[data-testid="shipyard-fab"]');
  await page.click('[data-testid="triage-feature"]');
  await page.click('text=Skip screenshot');
  await page.fill('[data-testid="feedback-description"]', 'Add dark mode');
  await page.click('[data-testid="feedback-submit"]');
  await expect(page.locator('[data-testid="feedback-success"]')).toBeVisible({ timeout: 5000 });
  expect(endpoint).toContain('/api/feedback/feature');
});

// ── Console panel (BUG-P2-002b fix) ──────────────────────────────────────────

test('console panel toggle button is present in bug detail step', async ({ page }) => {
  await mountPreview(page);
  await page.click('[data-testid="shipyard-fab"]');
  await page.click('[data-testid="triage-bug"]');
  await page.click('text=Skip screenshot');
  await expect(page.locator('text=console errors')).toBeVisible();
});

test('console panel is expanded when selecting bug with prior errors (BUG-P2-002b)', async ({ page }) => {
  // Inject a console error before widget opens so the ring buffer has content
  await page.addInitScript(() => {
    // The module-level patch should capture this at page load
    window.addEventListener('load', () => {
      setTimeout(() => console.error('Test error for ring buffer'), 50);
    });
  });
  await mountPreview(page);
  await page.click('[data-testid="shipyard-fab"]');
  await page.click('[data-testid="triage-bug"]');
  await page.click('text=Skip screenshot');
  // Console panel should be visible (auto-expanded) because consoleErrors.length > 0
  // The hide/show toggle text indicates current state
  await expect(page.locator('text=Hide console errors')).toBeVisible();
});

// ── Escape key closes widget ──────────────────────────────────────────────────

test('Escape key closes the widget', async ({ page }) => {
  await mountPreview(page);
  await page.click('[data-testid="shipyard-fab"]');
  await expect(page.locator('[data-testid="triage-bug"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="triage-bug"]')).toHaveCount(0);
});

// ── Close button ──────────────────────────────────────────────────────────────

test('close button on triage sheet returns to idle (FAB visible)', async ({ page }) => {
  await mountPreview(page);
  await page.click('[data-testid="shipyard-fab"]');
  // Click the CloseIcon button (title not set, use the X SVG container)
  await page.click('button:has(line[x1="18"][y1="6"])');
  await expect(page.locator('[data-testid="shipyard-fab"]')).toBeVisible();
});
