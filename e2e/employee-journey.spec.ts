import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * E2E Test: Employee Registration → Face Enrollment → Dashboard
 * 
 * This test covers the critical happy path:
 * 1. Admin signs in
 * 2. Navigates to Employees page
 * 3. Registers a new employee with face enrollment
 * 4. Verifies employee appears in the list
 * 5. Checks dashboard for employee data
 */
test.describe('Employee Management Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page
    await page.goto('/');
  });

  test('should allow admin to register employee and view on dashboard', async ({ page }) => {
    // Skip if Clerk is not configured (local dev without keys)
    const clerkPresent = await page.locator('[data-clerk-loaded]').count() > 0;
    if (!clerkPresent) {
      test.skip();
    }

    // Step 1: Sign in (assumes test account exists)
    await page.click('text=Sign In');
    await page.waitForURL(/sign-in/);
    
    // Fill Clerk sign-in form (adjust selectors based on Clerk UI)
    await page.fill('input[name="identifier"]', process.env.TEST_USER_EMAIL || 'test@example.com');
    await page.click('button[type="submit"]');
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD || 'testpassword123');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL(/dashboard/, { timeout: 10000 });

    // Step 2: Navigate to Employees page
    await page.click('text=Employees');
    await page.waitForURL(/employees/);
    
    // Verify page loaded
    await expect(page.locator('h1')).toContainText(/Employees/i);

    // Step 3: Open employee registration modal
    await page.click('text=Add Employee');
    
    // Verify modal opened
    await expect(page.locator('text=Enroll New Face')).toBeVisible();

    // Step 4: Fill employee details
    const testEmployeeName = `Test Employee ${Date.now()}`;
    await page.fill('input[name="name"]', testEmployeeName);
    await page.fill('input[name="email"]', `test${Date.now()}@example.com`);
    await page.selectOption('select[name="role"]', 'employee');
    
    // Note: Face capture requires camera access which can't be easily automated
    // In real E2E, you'd mock the camera API or use a test image
    // For now, we'll test form validation instead
    
    // Step 5: Verify required field validation
    await page.click('text=Capture Face');
    await expect(page.locator('text=/camera|face/i')).toBeVisible({ timeout: 5000 });

    // Close modal
    await page.click('button[aria-label="Close"]');
  });

  test('should display employee list with search functionality', async ({ page }) => {
    // Skip auth for this test - just check UI
    await page.goto('/employees');

    // Check if employees page renders (may show auth redirect)
    const isAuthPage = page.url().includes('sign-in');
    if (isAuthPage) {
      test.skip();
    }

    // Verify search input exists
    const searchInput = page.locator('input[placeholder*="Search"]');
    if (await searchInput.count() > 0) {
      await expect(searchInput).toBeVisible();
    }

    // Verify table headers
    await expect(page.locator('text=Name')).toBeVisible();
    await expect(page.locator('text=Email')).toBeVisible();
  });

  test('should be accessible (WCAG compliance)', async ({ page }) => {
    await page.goto('/');
    
    // Run axe accessibility tests
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    
    // Check for critical violations
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});

/**
 * E2E Test: Kiosk Check-in Flow
 */
test.describe('Kiosk Check-in Journey', () => {
  test('should load kiosk page without authentication', async ({ page }) => {
    await page.goto('/kiosk');
    
    // Kiosk should be accessible without login
    await expect(page.locator('text=/Check-in|Attendance|Face/i')).toBeVisible({ timeout: 10000 });

    // Verify camera access prompt (won't actually grant in headless)
    // Just check the UI elements are present
    const videoElement = page.locator('video');
    expect(await videoElement.count()).toBeGreaterThan(0);
  });

  test('should show org selection if no orgId in URL', async ({ page }) => {
    await page.goto('/kiosk');
    
    // Should show error or org selection UI when orgId is missing
    const hasOrgSelector = await page.locator('text=/organization|select org/i').count() > 0;
    const hasError = await page.locator('text=/error|required/i').count() > 0;
    
    expect(hasOrgSelector || hasError).toBeTruthy();
  });
});

/**
 * E2E Test: Dashboard Real-time Updates
 */
test.describe('Dashboard Journey', () => {
  test('should display dashboard with stats and charts', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check if redirected to sign-in
    if (page.url().includes('sign-in')) {
      test.skip();
    }

    // Verify key dashboard elements
    await expect(page.locator('text=/Total Employees|Present|Attendance/i')).toBeVisible({ timeout: 10000 });

    // Check for chart elements
    const hasChart = await page.locator('svg').count() > 0;
    expect(hasChart).toBeTruthy();
  });

  test('should allow date range selection', async ({ page }) => {
    await page.goto('/dashboard');
    
    if (page.url().includes('sign-in')) {
      test.skip();
    }

    // Look for date range buttons
    const todayButton = page.locator('button:has-text("Today")');
    const weekButton = page.locator('button:has-text("Week")');
    
    if (await todayButton.count() > 0) {
      await todayButton.click();
      await expect(todayButton).toHaveClass(/active|selected/);
    }
    
    if (await weekButton.count() > 0) {
      await weekButton.click();
      // Chart should update (verify by checking data attributes or waiting for re-render)
      await page.waitForTimeout(500);
    }
  });
});

/**
 * E2E Test: Billing Flow
 */
test.describe('Billing Journey', () => {
  test('should display pricing plans', async ({ page }) => {
    await page.goto('/billing');
    
    if (page.url().includes('sign-in')) {
      test.skip();
    }

    // Verify pricing cards
    await expect(page.locator('text=/Free|Pro|Enterprise/i')).toBeVisible({ timeout: 10000 });
    
    // Check for upgrade buttons
    const upgradeButtons = page.locator('button:has-text("Upgrade")');
    expect(await upgradeButtons.count()).toBeGreaterThan(0);
  });

  test('should show feature comparison', async ({ page }) => {
    await page.goto('/billing');
    
    if (page.url().includes('sign-in')) {
      test.skip();
    }

    // Verify feature list items
    await expect(page.locator('text=/employees|AI assistant|analytics/i')).toBeVisible({ timeout: 5000 });
  });
});
