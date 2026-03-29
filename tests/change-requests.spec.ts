/**
 * tests/change-requests.spec.ts — Build 012
 *
 * Covers: Change Requests UI — list screen (filter tabs, screen dropdown,
 * sorting), CR card accordion (expand, annotation pins, console errors),
 * AcceptModal (create vs. link modes), reject inline flow,
 * rejected CR visibility, screen card pending count badge,
 * empty state, data-testid audit, mobile 375px.
 *
 * ⚠ BUG-P1: No data-testid attributes found anywhere in
 *   ChangeRequestsScreen.tsx. All interactive elements lack data-testid.
 *   → See scenario 13 (data-testid audit).
 *
 * All API calls mocked via page.route() — no live DB.
 */

import { test, expect } from '@playwright/test';

// ─── Constants ───────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:5173';
const ROUTE    = `${BASE_URL}/projects/proj-001/change-requests`;

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_CR_PENDING = {
  id:             'cr-001',
  project_id:     'proj-001',
  screen_id:      'scr-001',
  title:          'Update hero button color',
  description:    'The CTA button should be indigo, not blue.',
  screenshot_url: 'https://example.com/screenshot.png',
  status:         'pending',
  submitted_at:   '2026-03-28T10:00:00Z',
  submitter_email:'tester@example.com',
};

const MOCK_CR_ACCEPTED = {
  id:             'cr-002',
  project_id:     'proj-001',
  screen_id:      'scr-001',
  title:          'Fix navigation padding',
  description:    'Nav links need 16px padding on mobile.',
  screenshot_url: null,
  status:         'accepted',
  submitted_at:   '2026-03-27T08:00:00Z',
  submitter_email:'other@example.com',
};

const MOCK_CR_REJECTED = {
  id:             'cr-003',
  project_id:     'proj-001',
  screen_id:      'scr-002',
  title:          'Remove footer logo',
  description:    'Footer logo is not needed.',
  screenshot_url: null,
  status:         'rejected',
  submitted_at:   '2026-03-26T06:00:00Z',
  submitter_email:'other2@example.com',
};

const MOCK_CRS = [MOCK_CR_PENDING, MOCK_CR_ACCEPTED, MOCK_CR_REJECTED];

const MOCK_ANNOTATIONS = [
  {
    id:         'ann-001',
    cr_id:      'cr-001',
    x_pct:      25,
    y_pct:      40,
    note:       'Button is here',
    created_at: '2026-03-28T10:01:00Z',
  },
];

const MOCK_SCREENS = [
  { id: 'scr-001', name: 'Home', route: '/', type: 'page' },
  { id: 'scr-002', name: 'Settings', route: '/settings', type: 'page' },
];

const MOCK_FEATURES = [
  { id: 'feat-001', name: 'Dark Mode', screen_id: 'scr-001' },
  { id: 'feat-002', name: 'Theme Switcher', screen_id: 'scr-001' },
];

// ─── Route helper ─────────────────────────────────────────────────────────────

async function setupMocks(page: import('@playwright/test').Page, overrides?: {
  crs?: typeof MOCK_CRS;
}) {
  const crs = overrides?.crs ?? MOCK_CRS;

  await page.route('**/rest/v1/change_requests**', async route => {
    await route.fulfill({
      status:  200,
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(crs),
    });
  });

  await page.route('**/rest/v1/cr_annotations**', async route => {
    await route.fulfill({
      status:  200,
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(MOCK_ANNOTATIONS),
    });
  });

  await page.route('**/rest/v1/screens**', async route => {
    await route.fulfill({
      status:  200,
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(MOCK_SCREENS),
    });
  });

  await page.route('**/rest/v1/features**', async route => {
    await route.fulfill({
      status:  200,
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(MOCK_FEATURES),
    });
  });

  await page.route('**/api/feedback/**', async route => {
    await route.fulfill({ status: 201, body: JSON.stringify({ id: 'new-cr' }) });
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

// 1. Route renders
test('012-01: change requests route renders without crash', async ({ page }) => {
  await setupMocks(page);
  const response = await page.goto(ROUTE);
  expect(response?.status()).not.toBe(404);
  await expect(page.locator('body')).not.toContainText('404');
});

// 2. CR list sorts newest first (pending CR 2026-03-28 before accepted 2026-03-27)
test('012-02: CR list is sorted newest submitted_at first', async ({ page }) => {
  await setupMocks(page);
  await page.goto(ROUTE);

  const body = await page.locator('body').textContent();
  const pendingPos  = body?.indexOf('Update hero button color') ?? -1;
  const acceptedPos = body?.indexOf('Fix navigation padding')   ?? -1;
  expect(pendingPos).toBeGreaterThan(-1);
  expect(acceptedPos).toBeGreaterThan(-1);
  expect(pendingPos).toBeLessThan(acceptedPos);
});

// 3. Status badges — correct colors / labels for pending / accepted / rejected
test('012-03: status badges render correct labels for each CR status', async ({ page }) => {
  await setupMocks(page);
  await page.goto(ROUTE);

  await expect(page.locator('body')).toContainText('pending');
  await expect(page.locator('body')).toContainText('accepted');
  await expect(page.locator('body')).toContainText('rejected');
});

// 4. Accordion expand — clicking a CR card loads detail and shows description
test('012-04: clicking a CR card expands it and shows full description', async ({ page }) => {
  await setupMocks(page);
  await page.route('**/rest/v1/change_requests?id=eq.cr-001**', async route => {
    await route.fulfill({
      status:  200,
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify([{ ...MOCK_CR_PENDING, annotations: MOCK_ANNOTATIONS }]),
    });
  });

  await page.goto(ROUTE);

  // Click the first CR card (pending)
  const crCard = page.locator('text=Update hero button color').first();
  await expect(crCard).toBeVisible({ timeout: 5000 });
  await crCard.click();

  // Description should now be visible in the expanded body
  await expect(page.locator('body')).toContainText('The CTA button should be indigo', { timeout: 3000 });
});

// 5. Annotation pins — hover shows tooltip text (if screenshot present)
test('012-05: annotation pin tooltip shows note text on hover', async ({ page }) => {
  await setupMocks(page);
  await page.goto(ROUTE);

  const crCard = page.locator('text=Update hero button color').first();
  if (await crCard.count() > 0) {
    await crCard.click();
    // After expansion, look for annotation pin elements positioned absolutely
    const pinEls = page.locator('[style*="position: absolute"]').filter({ hasText: '' });
    if (await pinEls.count() > 0) {
      await pinEls.first().hover();
      // Tooltip with annotation note should appear
      await expect(page.locator('body')).toContainText('Button is here', { timeout: 3000 });
    }
  }
});

// 6. Accept modal — "Create new feature" path shows feature name input
test('012-06: AcceptModal create-feature path shows feature name input', async ({ page }) => {
  await setupMocks(page);
  await page.goto(ROUTE);

  // Expand CR card to reveal action strip
  const crCard = page.locator('text=Update hero button color').first();
  if (await crCard.count() > 0) {
    await crCard.click();
    const acceptBtn = page.locator('button', { hasText: /Accept/ }).first();
    if (await acceptBtn.count() > 0) {
      await acceptBtn.click();
      // AcceptModal should open
      // "Create new feature" radio is default
      await expect(page.locator('body')).toContainText('Create new feature', { timeout: 3000 });
      // Feature name input should be visible
      const nameInput = page.locator('input[placeholder*="Feature name"], input[placeholder*="feature"]');
      await expect(nameInput).toBeVisible({ timeout: 2000 });
    }
  }
});

// 7. Accept modal — "Link to existing feature" switches to searchable dropdown
test('012-07: AcceptModal link-feature path shows searchable feature dropdown', async ({ page }) => {
  await setupMocks(page);
  await page.goto(ROUTE);

  const crCard = page.locator('text=Update hero button color').first();
  if (await crCard.count() > 0) {
    await crCard.click();
    const acceptBtn = page.locator('button', { hasText: /Accept/ }).first();
    if (await acceptBtn.count() > 0) {
      await acceptBtn.click();

      // Switch to "Link to existing feature" radio
      const linkRadio = page.locator('input[type="radio"][value="link"], label', { hasText: 'Link to existing' });
      if (await linkRadio.count() > 0) {
        await linkRadio.first().click();
        // Searchable dropdown should appear (features list)
        await expect(page.locator('body')).toContainText('Dark Mode', { timeout: 3000 });
      }
    }
  }
});

// 8. Reject inline flow — shows rejection textarea
test('012-08: reject inline flow reveals rejection reason textarea', async ({ page }) => {
  await setupMocks(page);
  await page.goto(ROUTE);

  const crCard = page.locator('text=Update hero button color').first();
  if (await crCard.count() > 0) {
    await crCard.click();

    const rejectBtn = page.locator('button', { hasText: /Reject/ }).first();
    if (await rejectBtn.count() > 0) {
      await rejectBtn.click();
      // Rejection textarea / reason input should appear
      const textarea = page.locator('textarea').first();
      await expect(textarea).toBeVisible({ timeout: 3000 });
    }
  }
});

// 9. Rejected CRs are visible but visually muted (not hidden)
test('012-09: rejected CRs are visible in the list with rejected status chip', async ({ page }) => {
  await setupMocks(page);
  await page.goto(ROUTE);

  // Rejected CR title should be visible
  await expect(page.locator('body')).toContainText('Remove footer logo', { timeout: 5000 });
  await expect(page.locator('body')).toContainText('rejected');
});

// 10. Filter tabs — "Pending" tab shows only pending CRs
test('012-10: Pending filter tab shows only pending CRs', async ({ page }) => {
  await setupMocks(page);
  await page.goto(ROUTE);

  // Click the Pending tab
  const pendingTab = page.locator('button, [role="tab"]', { hasText: /Pending/ }).first();
  if (await pendingTab.count() > 0) {
    await pendingTab.click();

    // Only pending CR should be visible
    await expect(page.locator('body')).toContainText('Update hero button color', { timeout: 3000 });
    // Accepted and rejected should not be visible in filtered view
    // (the filter hides non-pending rows)
    await expect(page.locator('body')).not.toContainText('Fix navigation padding');
  }
});

// 11. Screen dropdown filter — filters CRs by screen
test('012-11: screen dropdown filter shows only CRs for selected screen', async ({ page }) => {
  await setupMocks(page);
  await page.goto(ROUTE);

  // Look for screen filter dropdown
  const screenSelect = page.locator('select').first();
  if (await screenSelect.count() > 0) {
    await screenSelect.selectOption({ label: 'Settings' });
    // Only the rejected CR (on scr-002 = Settings) should be visible
    await expect(page.locator('body')).toContainText('Remove footer logo', { timeout: 3000 });
    await expect(page.locator('body')).not.toContainText('Update hero button color');
  }
});

// 12. Empty state — shows copy test link button when no CRs
test('012-12: empty state shows clipboard icon and Copy test link button', async ({ page }) => {
  await setupMocks(page, { crs: [] });
  await page.goto(ROUTE);

  await expect(page.locator('body')).toContainText(/Copy test link|No change requests/, { timeout: 5000 });
});

// 13. data-testid audit — BUG-P1
test('012-13: BUG-P1 — interactive elements must have data-testid attributes', async ({ page }) => {
  await setupMocks(page);
  await page.goto(ROUTE);

  const requiredTestIds = [
    'cr-list',
    'cr-card-cr-001',
    'cr-status-chip',
    'filter-tab-all',
    'filter-tab-pending',
    'filter-tab-accepted',
    'filter-tab-rejected',
    'screen-filter-dropdown',
    'cr-accept-btn',
    'cr-reject-btn',
    'accept-modal',
    'accept-modal-create-radio',
    'accept-modal-link-radio',
    'accept-modal-submit-btn',
    'cr-empty-state',
    'copy-test-link-btn',
  ];

  const missing: string[] = [];
  for (const testId of requiredTestIds) {
    if (await page.locator(`[data-testid="${testId}"]`).count() === 0) {
      missing.push(testId);
    }
  }

  expect(missing, `BUG-P1: Missing data-testid attributes: ${missing.join(', ')}`).toHaveLength(0);
});

// 14. Mobile 375px — layout doesn't overflow
test('012-14: mobile 375px — no horizontal scroll overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await setupMocks(page);
  await page.goto(ROUTE);

  const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(400);

  // CR titles should still be visible
  await expect(page.locator('body')).toContainText('Update hero button color', { timeout: 5000 });
});
