import { Page, expect } from '@playwright/test';

export async function waitForCartItemValidated(
  page: Page,
  testId = 'cart-item',
  timeoutMs = 30_000,
): Promise<void> {
  const item = page.getByTestId(testId).first();
  await expect(item).toBeVisible({ timeout: timeoutMs });
  await expect(item.locator('[data-testid="cart-item-status"]')).toHaveClass(
    /status-confirmed/,
    { timeout: timeoutMs },
  );
}

export async function waitForOrderConfirmation(page: Page, timeoutMs = 35_000): Promise<void> {
  await page.waitForURL(/\/order-confirmation/, { timeout: timeoutMs });
}
