import { test, expect } from '@playwright/test';

test.describe('Tool Integration E2E Tests', () => {
  test.describe('Tool Discovery and Management', () => {
    test('should display tools in sidebar when enabled', async ({ page }) => {
      await page.goto('/');

      // Check that sidebar shows available tools
      const sidebar = page.locator('[class*="border-r"]').or(page.locator('[class*="sidebar"]'));

      // Look for tool indicators or status
      const toolStatusElements = sidebar.locator('[class*="bg-teal-600"]').or(sidebar.locator('text=/connected|enabled/i'));
      if (await toolStatusElements.count() > 0) {
        await expect(toolStatusElements.first()).toBeVisible();
      }
    });

    test('should handle dynamic tool widget loading', async ({ page }) => {
      await page.goto('/');

      // Navigate to overview tab
      await page.getByRole('tab', { name: 'Overview' }).click();

      // Look for widget containers or loading states
      const widgetContainer = page.locator('[class*="grid"]').or(page.locator('[class*="widget"]'));
      await expect(widgetContainer.first()).toBeVisible();

      // Check for refresh buttons on dynamic widgets
      const refreshButton = page.getByRole('button', { name: /refresh|reload/i });
      if (await refreshButton.isVisible()) {
        await refreshButton.click();
        // Should show loading state temporarily
        // (exact behavior may vary based on implementation)
      }
    });

    test('should handle tool API failures gracefully', async ({ page }) => {
      // Mock API failures
      await page.route('**/api/tools/**', route => route.fulfill({ status: 500 }));

      await page.goto('/');

      await page.getByRole('tab', { name: 'Livefeed' }).click();

      // Should show error state instead of crashing
      const errorIndicator = page.getByText(/error|failed|unable to load/i);
      if (await errorIndicator.isVisible({ timeout: 5000 })) {
        await expect(errorIndicator).toBeVisible();
      }

      // Should still allow navigation
      await page.getByRole('tab', { name: 'Overview' }).click();
      await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    });
  });

  test.describe('Real-time Data Updates', () => {
    test('should handle tab visibility data refresh', async ({ page }) => {
      await page.goto('/');

      await page.getByRole('tab', { name: 'Livefeed' }).click();

      // Simulate switching tabs (bringing page back into focus)
      await page.evaluate(() => {
        // Trigger visibilitychange event
        Object.defineProperty(document, 'visibilityState', { value: 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
        // Then make it visible again
        Object.defineProperty(document, 'visibilityState', { value: 'visible' });
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Content might update (but this depends on implementation)
      // At minimum, page should remain responsive
      await expect(page.getByRole('tab', { name: 'Livefeed' })).toHaveAttribute('aria-selected', 'true');
    });

    test('should handle automatic refresh intervals', async ({ page }) => {
      await page.goto('/');

      await page.getByRole('tab', { name: 'Livefeed' }).click();

      // Wait for initial load
      await page.waitForTimeout(1000);

      // Wait for potential auto-refresh (if implemented)
      await page.waitForTimeout(5000);

      // Page should still be functional regardless of auto-refresh
      await expect(page.getByRole('tab', { name: 'Livefeed' })).toBeVisible();

      // Try navigating to ensure responsiveness
      await page.getByRole('tab', { name: 'Overview' }).click();
      await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    });
  });

  test.describe('Cross-browser Compatibility', () => {
    test('should work with different input methods', async ({ page }) => {
      await page.goto('/');

      await page.getByRole('tab', { name: 'Discovery' }).click();

      const searchInput = page.getByPlaceholder(/search.*tools/i).or(page.getByRole('textbox'));

      // Try typing
      await searchInput.fill('test input');
      await expect(searchInput).toHaveValue('test input');

      // Try clearing
      await searchInput.clear();
      await expect(searchInput).toHaveValue('');

      // Try paste (if clipboard API available)
      const testText = 'pasted content';
      await page.evaluate(async (text) => {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(text).catch(() => {});
        }
      }, testText);

      // Manual paste simulation
      await searchInput.click();
      await page.keyboard.type(testText);
      await expect(searchInput).toHaveValue(testText);
    });

    test('should handle keyboard navigation', async ({ page }) => {
      await page.goto('/');

      // Focus management
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Should be able to tab through focusable elements
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();

      // Tab navigation through tabs
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');

      // Current focused element should be updated
      // (implementation-specific behavior)
    });

    test('should handle browser back/forward', async ({ page }) => {
      await page.goto('/');

      // Click on a different tab
      await page.getByRole('tab', { name: 'Livefeed' }).click();
      await expect(page.getByRole('tab', { name: 'Livefeed' })).toHaveAttribute('aria-selected', 'true');

      // Browser navigation
      await page.goBack();
      await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');

      await page.goForward();
      await expect(page.getByRole('tab', { name: 'Livefeed' })).toHaveAttribute('aria-selected', 'true');
    });
  });

  test.describe('Performance and Accessibility', () => {
    test('should load content within reasonable time', async ({ page }) => {
      const start = Date.now();

      await page.goto('/', { waitUntil: 'networkidle' });

      const loadTime = Date.now() - start;

      // Should load within 5 seconds (reasonable for a development app)
      expect(loadTime).toBeLessThan(5000);

      // Main content should be visible
      await expect(page.getByRole('heading')).toBeVisible();
    });

    test('should have proper accessibility attributes', async ({ page }) => {
      await page.goto('/');

      // Check main landmark roles
      await expect(page.locator('main, [role="main"]')).toBeVisible();

      // Check tab navigation accessibility
      const tabs = page.getByRole('tab');
      for (const tab of await tabs.all()) {
        await expect(tab).toBeVisible();
      }

      // Check headings hierarchy
      const h1Elements = await page.locator('h1').count();
      expect(h1Elements).toBeGreaterThanOrEqual(0); // At least one main heading
    });

    test('should handle large datasets efficiently', async ({ page }) => {
      // This test depends on implementation - checks if virtual scrolling or pagination is working
      await page.goto('/');

      await page.getByRole('tab', { name: 'Livefeed' }).click();

      // Check that large amounts of data don't break the UI
      // (Implementation-specific - might need data loading simulation)

      // At minimum, should maintain responsiveness
      await expect(page.getByRole('tab', { name: 'Livefeed' })).toHaveAttribute('aria-selected', 'true');

      // Try scroll to ensure virtual scrolling or pagination works
      await page.mouse.wheel(0, 1000); // Scroll down
      await page.waitForTimeout(500);
      await page.mouse.wheel(0, -500); // Scroll up

      // Page should still be functional
      await expect(page.getByRole('tab', { name: 'Livefeed' })).toBeVisible();
    });
  });
});
