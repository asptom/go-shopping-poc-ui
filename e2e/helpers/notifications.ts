import { Page, expect } from '@playwright/test';

export async function expectSuccessNotification(
  page: Page,
  text: string | RegExp,
  timeoutMs = 10_000,
): Promise<void> {
  const notification = page
    .locator('[data-testid="notification"][class*="notification-success"] [data-testid="notification-message"]')
    .filter({ hasText: text })
    .first();
  await expect(notification).toBeVisible({ timeout: timeoutMs });
}

export async function waitForNotificationToDismiss(
  page: Page,
  text: string | RegExp,
  timeoutMs = 10_000,
): Promise<void> {
  const notification = page
    .locator('[data-testid="notification"][class*="notification-success"] [data-testid="notification-message"]')
    .filter({ hasText: text })
    .first();
  await expect(notification).not.toBeVisible({ timeout: timeoutMs });
}
