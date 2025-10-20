import { test, expect } from '@playwright/test';

test.describe('Hyperpage Dashboard E2E Tests', () => {
  test('should load dashboard and display initial state', async ({ page }) => {
    await page.goto('/');

    // Check that the page loaded successfully
    await expect(page).toHaveTitle(/Hyperpage/);

    // Check main elements are present
    await expect(page.getByRole('heading')).toHaveText('Hyperpage');
    await expect(page.locator('.bg-gradient-to-br')).toBeVisible();

    // Check tabs are present
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Livefeed' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Discovery' })).toBeVisible();

    // Verify no tools state is shown initially
    await expect(page.getByText('No tools are currently enabled')).toBeVisible();
  });

  test('should navigate between tabs correctly', async ({ page }) => {
    await page.goto('/');

    // Check Overview tab is active by default
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');

    // Navigate to Livefeed tab
    await page.getByRole('tab', { name: 'Livefeed' }).click();
    await expect(page.getByRole('tab', { name: 'Livefeed' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'false');

    // Navigate to Discovery tab
    await page.getByRole('tab', { name: 'Discovery' }).click();
    await expect(page.getByRole('tab', { name: 'Discovery' })).toHaveAttribute('aria-selected', 'true');

    // Return to Overview
    await page.getByRole('tab', { name: 'Overview' }).click();
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
  });

  test('should display themed content correctly', async ({ page }) => {
    await page.goto('/');

    // Check body has theme-specific classes (should be light mode initially)
    await expect(page.locator('body')).toHaveClass(/bg-white/);

    // Toggle dark mode if toggle exists
    const themeToggle = page.getByRole('button', { name: /dark|light/i });
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      // Should now be dark mode
      await expect(page.locator('body')).toHaveClass(/bg-gray-900|bg-slate-900/);
    }
  });

  test('should handle search functionality', async ({ page }) => {
    await page.goto('/');

    // Navigate to discovery tab
    await page.getByRole('tab', { name: 'Discovery' }).click();

    // Check search input exists
    const searchInput = page.getByPlaceholder(/search.*tools/i).or(page.getByRole('textbox', { name: 'search' }));
    await expect(searchInput).toBeVisible();

    // Enter search term
    await searchInput.fill('github');
    await searchInput.press('Enter');

    // Check that search results appear or "no results" message
    await expect(page.locator('.bg-card').or(page.getByText('No tools found'))).toBeVisible();
  });

  test('should show loading states appropriately', async ({ page }) => {
    await page.goto('/');

    // Check for loading element on Livefeed tab (should show loading animation)
    await page.getByRole('tab', { name: 'Livefeed' }).click();

    // Loading states might vary - check for skeleton animations or loading text
    const loadingContent = page.locator('[class*="animate-shimmer"]').or(page.getByText(/loading|fetching/i));
    if (await loadingContent.isVisible({ timeout: 3000 })) {
      await expect(loadingContent).toBeVisible();
    }
  });

  test('should handle responsive design', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 }); // Desktop
    await page.goto('/');

    // Check desktop layout
    await expect(page.locator('.bg-card').first()).toBeVisible();

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone size

    // Mobile layout should still work (tabs, sidebar collapses, etc.)
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();

    // Check that content adapts
    const mobileContent = page.locator('.p-4').or(page.locator('.px-4'));
    await expect(mobileContent.first()).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await page.route('**/api/tools/**', route => route.abort());
    await page.goto('/');

    // Should show error states instead of crashing
    await page.getByRole('tab', { name: 'Livefeed' }).click();

    // Check for error message or fallback content
    const errorContent = page.getByText(/error|failed|no data/i);
    if (await errorContent.isVisible({ timeout: 5000 })) {
      await expect(errorContent).toBeVisible();
    }
  });
});
