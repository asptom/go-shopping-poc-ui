import { test, expect } from '@playwright/test';

test('smoke: home page loads', async ({ page }) => {
  await page.goto('/home');
  await expect(page).toHaveTitle(/GoShopping/);
  // Header signin trigger is present when unauthenticated
  await expect(page.getByTestId('signin-trigger-top')).toBeVisible();
});
