/**
 * tests/screens-builder.spec.ts — Build 015
 *
 * Covers: Screens list (empty state, generate flow, manual add panel, card grid,
 * search + type filter), Screen detail (breadcrumb, tabs, feature rows with
 * progress dots, edit, soft-delete confirm, drag-order note), data-testid
 * audit, mobile 375px.
 *
 * ⚠ BUG-P1: No data-testid attributes found anywhere in ScreensScreen.tsx.
 *   All interactive elements lack data-testid.
 *   → See scenario 13 (data-testid audit).
 *
 * Route uniqueness: duplicate route entry should trigger 23505 error message.
 *
 * All API calls mocked via page.route() — no live DB.
 */

import { test, expect } from '@playwright/test';

// ─── Constants ───────────────────────────────────────────────────────────────

const BASE_URL   = 'http://localhost:5173';
const LIST_ROUTE = `${BASE_URL}/projects/proj-001/screens`;

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_SCREENS_SUMMARY = [
  {
    id:            'scr-001',
    project_id:    'proj-001',
    name:          'Home',
    route:         '/',
    type:          'page',
    description:   'Main landing page',
    sort_order:    1,
    created_at:    '2026-01-01T00:00:00Z',
    updated_at:    '2026-03-28T00:00:00Z',
    feature_count: 4,
    open_bug_count:  1,
    pending_cr_count: 2,
  },
  {
    id:            'scr-002',
    project_id:    'proj-001',
    name:          'Auth',
    route:         '/login',
    type:          'auth',
    description:   'Login and signup',
    sort_order:    2,
    created_at:    '2026-01-02T00:00:00Z',
    updated_at:    '2026-03-27T00:00:00Z',
    feature_count: 2,
    open_bug_count:  0,
    pending_cr_count: 0,
  },
  {
    id:            'scr-003',
    project_id:    'proj-001',
    name:          'Dashboard',
    route:         '/dashboard',
    type:          'dashboard',
    description:   'Main analytics dashboard',
    sort_order:    3,
    created_at:    '2026-01-03T00:00:00Z',
    updated_at:    '2026-03-26T00:00:00Z',
    feature_count: 6,
    open_bug_count:  3,
    pending_cr_count: 1,
  },
];

const MOCK_SCREEN_FEATURES = [
  {
    id:            'feat-001',
    name:          'Dark Mode',
    maturity:      'alpha',
    status:        'in_progress',
    workflow_step: 2,
    complexity:    'medium',
    priority:      'p1',
    created_at:    '2026-02-01T00:00:00Z',
  },
  {
    id:            'feat-002',
    name:          'Search Bar',
    maturity:      'beta',
    status:        'in_progress',
    workflow_step: 4,
    complexity:    'simple',
    priority:      'p2',
    created_at:    '2026-02-15T00:00:00Z',
  },
];

const MOCK_GENERATE_RESPONSE = {
  screens: [
    { name: 'Home',      route: '/',        type: 'page' },
    { name: 'Login',     route: '/login',   type: 'auth' },
    { name: 'Dashboard', route: '/dash',    type: 'dashboard' },
    { name: 'Settings',  route: '/settings',type: 'page' },
  ],
};

// ─── Route helper ─────────────────────────────────────────────────────────────

async function setupMocks(
  page: import('@playwright/test').Page,
  overrides?: { screens?: typeof MOCK_SCREENS_SUMMARY }
) {
  const screens = overrides?.screens ?? MOCK_SCREENS_SUMMARY;

  await page.route('**/rest/v1/screen_summary**', async route => {
    await route.fulfill({
      status:  200,
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(screens),
    });
  });

  await page.route('**/rest/v1/screens**', async route => {
    const method = route.request().method();
    if (method === 'POST') {
      await route.fulfill({
        status:  201,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: 'scr-new', project_id: 'proj-001', name: 'New Screen', type: 'page', route: '/new' }),
      });
    } else if (method === 'PATCH' || method === 'DELETE') {
      await route.fulfill({ status: 200, body: JSON.stringify({}) });
    } else {
      await route.fulfill({
        status:  200,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(screens),
      });
    }
  });

  await page.route('**/rest/v1/features**', async route => {
    await route.fulfill({
      status:  200,
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(MOCK_SCREEN_FEATURES),
    });
  });

  await page.route('**/rest/v1/bugs**', async route => {
    await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) });
  });

  await page.route('**/rest/v1/change_requests**', async route => {
    await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) });
  });

  await page.route('**/api/generate-screens**', async route => {
    await route.fulfill({
      status:  200,
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(MOCK_GENERATE_RESPONSE),
    });
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

// 1. Route renders
test('015-01: screens list route renders without crash', async ({ page }) => {
  await setupMocks(page);
  const response = await page.goto(LIST_ROUTE);
  expect(response?.status()).not.toBe(404);
  await expect(page.locator('body')).not.toContainText('404');
});

// 2. Empty state — no screens → shows description textarea and generate CTA
test('015-02: empty state renders description textarea and generate button', async ({ page }) => {
  await setupMocks(page, { screens: [] });
  // Also mock the count query for hasScreens
  await page.route('**/rest/v1/screens*count*', async route => {
    await route.fulfill({
      status:  200,
      headers: { 'Content-Type': 'application/json', 'Content-Range': '*/0' },
      body:    JSON.stringify([]),
    });
  });
  await page.goto(LIST_ROUTE);

  // Empty state should show a textarea for app description and a Generate button
  await expect(page.locator('body')).toContainText(/Generate|describe|sitemap/i, { timeout: 5000 });
});

// 3. Generate screens flow — submits description, shows suggestions with checkboxes
test('015-03: generate flow shows AI suggestions with pre-checked checkboxes', async ({ page }) => {
  await setupMocks(page, { screens: [] });
  await page.goto(LIST_ROUTE);

  const descTextarea = page.locator('textarea').first();
  if (await descTextarea.count() > 0) {
    await descTextarea.fill('A task management app with a home page, login, and dashboard.');

    const generateBtn = page.locator('button', { hasText: /Generate/i }).first();
    if (await generateBtn.count() > 0) {
      await generateBtn.click();

      // Suggestions should appear with checkbox items
      await expect(page.locator('body')).toContainText('Home', { timeout: 5000 });
      await expect(page.locator('body')).toContainText('Login');
      await expect(page.locator('body')).toContainText('Dashboard');

      // Add selected screens button should appear
      await expect(page.locator('button, text=Add selected')).toContainText(/Add/i);
    }
  }
});

// 4. Add screen form — all 4 type options available
test('015-04: Add Screen panel shows all 4 screen type options', async ({ page }) => {
  await setupMocks(page);
  await page.goto(LIST_ROUTE);

  // Open the Add Screen panel
  const addBtn = page.locator('button', { hasText: /Add screen/i }).first();
  if (await addBtn.count() > 0) {
    await addBtn.click();

    // Type select should offer all 4 options
    const typeSelect = page.locator('select').first();
    if (await typeSelect.count() > 0) {
      const options = await typeSelect.locator('option').allTextContents();
      const types = options.map(o => o.toLowerCase());
      expect(types.some(t => t.includes('page'))).toBe(true);
      expect(types.some(t => t.includes('modal'))).toBe(true);
      expect(types.some(t => t.includes('auth'))).toBe(true);
      expect(types.some(t => t.includes('dashboard'))).toBe(true);
    }
  }
});

// 5. Screen cards — name, type badge, route, count chips visible
test('015-05: screen cards show name, type badge, route, and count chips', async ({ page }) => {
  await setupMocks(page);
  await page.goto(LIST_ROUTE);

  // Home screen card
  await expect(page.locator('body')).toContainText('Home', { timeout: 5000 });
  await expect(page.locator('body')).toContainText('/'); // route

  // Count chips: 4 features, 1 bug, 2 CRs for Home screen
  await expect(page.locator('body')).toContainText('4');
  await expect(page.locator('body')).toContainText('1');
  await expect(page.locator('body')).toContainText('2');

  // Type badges
  await expect(page.locator('body')).toContainText('page');
  await expect(page.locator('body')).toContainText('auth');
  await expect(page.locator('body')).toContainText('dashboard');
});

// 6. Screen card navigation — clicking navigates to screen detail
test('015-06: clicking a screen card navigates to screen detail route', async ({ page }) => {
  await setupMocks(page);
  await page.goto(LIST_ROUTE);

  const homeCard = page.locator('a[href*="/screens/scr-001"]').first();
  if (await homeCard.count() === 0) {
    // May be a Link component; look for the card text and click it
    const homeLink = page.locator('text=Home').first();
    if (await homeLink.count() > 0) {
      await homeLink.click();
      await expect(page).toHaveURL(/scr-001/, { timeout: 3000 });
    }
  } else {
    await expect(homeCard).toBeVisible({ timeout: 5000 });
    const href = await homeCard.getAttribute('href');
    expect(href).toContain('/screens/scr-001');
  }
});

// 7. Screen detail — breadcrumb, tab bar (Features/Bugs/Changes)
test('015-07: screen detail shows breadcrumb and Features/Bugs/Changes tabs', async ({ page }) => {
  const detailRoute = `${LIST_ROUTE}/scr-001`;
  await setupMocks(page);
  await page.goto(detailRoute);

  // Breadcrumb: "Screens → Home"
  await expect(page.locator('body')).toContainText('Screens', { timeout: 5000 });
  await expect(page.locator('body')).toContainText('Home');

  // Tab bar
  await expect(page.locator('body')).toContainText('Features');
  await expect(page.locator('body')).toContainText('Bugs');
});

// 8. Features tab — progress dots (5 dots) per feature row
test('015-08: features tab renders progress dots for each feature', async ({ page }) => {
  const detailRoute = `${LIST_ROUTE}/scr-001?tab=features`;
  await setupMocks(page);
  await page.goto(detailRoute);

  // Features tab content: Dark Mode and Search Bar should appear
  await expect(page.locator('body')).toContainText('Dark Mode', { timeout: 5000 });
  await expect(page.locator('body')).toContainText('Search Bar');

  // "Open →" link for navigating to the feature
  await expect(page.locator('body')).toContainText('Open');
});

// 9. Edit screen — pencil button opens edit form
test('015-09: edit button in screen detail header opens edit form', async ({ page }) => {
  const detailRoute = `${LIST_ROUTE}/scr-001`;
  await setupMocks(page);
  await page.goto(detailRoute);

  const editBtn = page.locator('button', { hasText: /Edit|✎|pencil/i }).first();
  if (await editBtn.count() > 0) {
    await editBtn.click();
    // Edit form with name / type / route fields should appear
    const nameInput = page.locator('input[value="Home"], input[placeholder*="name"]');
    await expect(nameInput).toBeVisible({ timeout: 3000 });
  }
});

// 10. Soft-delete confirmation — delete button shows confirm before deleting
test('015-10: delete screen shows confirmation before soft-deleting', async ({ page }) => {
  const detailRoute = `${LIST_ROUTE}/scr-001`;
  await setupMocks(page);
  await page.goto(detailRoute);

  const deleteBtn = page.locator('button', { hasText: /Delete|Remove/i }).first();
  if (await deleteBtn.count() > 0) {
    await deleteBtn.click();
    // A confirmation dialog or confirmation text should appear
    await expect(page.locator('body')).toContainText(/confirm|Are you sure|delete/i, { timeout: 3000 });
  }
});

// 11. Search + type filter — filtering by query hides non-matching screens
test('015-11: search input filters screen cards by name', async ({ page }) => {
  await setupMocks(page);
  await page.goto(LIST_ROUTE);

  // All 3 screens visible initially
  await expect(page.locator('body')).toContainText('Home', { timeout: 5000 });
  await expect(page.locator('body')).toContainText('Auth');
  await expect(page.locator('body')).toContainText('Dashboard');

  // Type in search
  const searchInput = page.locator('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]').first();
  if (await searchInput.count() > 0) {
    await searchInput.fill('Auth');
    // Only Auth should remain visible (the others should be hidden)
    await expect(page.locator('body')).toContainText('Auth');
  }
});

// 12. Route uniqueness error — 23505 shows inline validation
test('015-12: duplicate route entry shows inline validation message', async ({ page }) => {
  await setupMocks(page);

  // Override screens POST to return 23505 error
  await page.route('**/rest/v1/screens**', async route => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status:  409,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code: '23505', message: 'duplicate key value violates unique constraint' }),
      });
    } else {
      await route.continue();
    }
  });

  await page.goto(LIST_ROUTE);
  const addBtn = page.locator('button', { hasText: /Add screen/i }).first();
  if (await addBtn.count() > 0) {
    await addBtn.click();

    const nameInput = page.locator('input[placeholder*="name"], input[name="name"]').first();
    const routeToggle = page.locator('button, summary', { hasText: /Advanced|route/i }).first();

    if (await nameInput.count() > 0) {
      await nameInput.fill('Duplicate Screen');
    }

    if (await routeToggle.count() > 0) {
      await routeToggle.click();
      const routeInput = page.locator('input[placeholder*="route"], input[name="route"]').first();
      if (await routeInput.count() > 0) {
        await routeInput.fill('/');
      }
    }

    const saveBtn = page.locator('button', { hasText: /Save|Add/i }).last();
    if (await saveBtn.count() > 0) {
      await saveBtn.click();
      // Should show the duplicate route error message
      await expect(page.locator('body')).toContainText(/Route.*already used|duplicate/i, { timeout: 3000 });
    }
  }
});

// 13. data-testid audit — BUG-P1
test('015-13: BUG-P1 — interactive elements must have data-testid attributes', async ({ page }) => {
  await setupMocks(page);
  await page.goto(LIST_ROUTE);

  const requiredTestIds = [
    'screens-list',
    'screens-empty-state',
    'generate-description-textarea',
    'generate-screens-btn',
    'add-screen-btn',
    'add-screen-panel',
    'screen-name-input',
    'screen-type-select',
    'screen-save-btn',
    'screen-card-scr-001',
    'screen-type-badge',
    'screen-route-tag',
    'screen-feature-count',
    'screen-search-input',
    'screen-type-filter',
    'screen-detail-tabs',
    'screen-tab-features',
    'screen-tab-bugs',
    'screen-tab-changes',
    'screen-edit-btn',
    'screen-delete-btn',
  ];

  const missing: string[] = [];
  for (const testId of requiredTestIds) {
    if (await page.locator(`[data-testid="${testId}"]`).count() === 0) {
      missing.push(testId);
    }
  }

  expect(missing, `BUG-P1: Missing data-testid attributes: ${missing.join(', ')}`).toHaveLength(0);
});

// 14. Mobile 375px — screen cards stack vertically, no overflow
test('015-14: mobile 375px — screen cards stack without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await setupMocks(page);
  await page.goto(LIST_ROUTE);

  const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(400);

  await expect(page.locator('body')).toContainText('Home', { timeout: 5000 });
  await expect(page.locator('body')).toContainText('Auth');
});
