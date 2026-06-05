import { Page, expect } from '@playwright/test';
import { TEST_USER } from '../fixtures/test-data';

export async function loginWithKeycloak(page: Page): Promise<void> {
  // Navigate to home page
  await page.goto('/home');
  await page.waitForLoadState('networkidle');

  // Click top nav sign-in trigger, then the Sign in link
  await page.getByTestId('signin-trigger-top').click();
  await page.getByTestId('signin-link-top').click();

  // Wait for navigation to Keycloak
  await page.waitForURL(/keycloak\.local/, { timeout: 15_000 });

  // Fill credentials
  await page.locator('#username').fill(TEST_USER.username);
  await page.locator('#password').fill(TEST_USER.password);
  await page.locator('#kc-login').click();

  // Handle consent screen (oidc.config.ts has prompt: 'consent')
  // Keycloak consent screen shows a Submit/Accept button. Try several selectors.
  const consentButton = page
    .locator('input[name="accept"], button[name="accept"], button:has-text("Accept"), button:has-text("Yes")')
    .first();
  if (await consentButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await consentButton.click();
  }

  // Wait for redirect back to /home
  await page.waitForURL(/\/home/, { timeout: 30_000 });

  // Verify authenticated greeting is visible
  await expect(page.getByTestId('hello-greeting-main')).toContainText(
    TEST_USER.given_name,
    { timeout: 15_000 },
  );
}

export async function signOut(page: Page): Promise<void> {
  await page.getByTestId('sign-out-link').click();
  await page.waitForURL(/\/home/, { timeout: 15_000 });
  await expect(page.getByTestId('signin-trigger-top')).toBeVisible({ timeout: 10_000 });
}
