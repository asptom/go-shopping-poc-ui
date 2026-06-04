# E2E Testing Plan — GoShopping POC UI

**Date:** 2026-06-04  
**Test framework:** Playwright with TypeScript  
**App:** Angular 21 SPA at `http://localhost:4200`  
**Backend:** Go REST API + Keycloak OIDC (dev services running)  
**Auth approach:** Real Keycloak OIDC flow (no app test-mode flags)  
**API approach:** Real Go backend API (no Playwright route mocking)  
**SSE approach:** Real Server-Sent Events (no mock stream injection)  
**Test isolation:** Single sequential spec file, one fresh user per run  
**File location:** `e2e/specs/full-journey.spec.ts`

---

## Table of Contents

1. [Phase 0: Project Setup & Tooling](#phase-0-project-setup--tooling)
2. [Phase 1: Auth & Navigation](#phase-1-auth--navigation)
3. [Phase 2: User Registration / Profile Management](#phase-2-user-registration--profile-management)
4. [Phase 3: Address Management](#phase-3-address-management)
5. [Phase 4: Credit Card Management](#phase-4-credit-card-management)
6. [Phase 5: Product Browsing & Add to Cart](#phase-5-product-browsing--add-to-cart)
7. [Phase 6: Checkout Flow & Order Placement](#phase-6-checkout-flow--order-placement)
8. [Phase 7: Order History Verification](#phase-7-order-history-verification)
9. [Phase 8: CI Integration](#phase-8-ci-integration)
10. [Appendix: Test Data Constants](#appendix-test-data-constants)

---

## Phase 0: Project Setup & Tooling

### Step 0.1 — Install Playwright

Run in project root:

```bash
npm init playwright@latest -- --yes --browser chromium --quiet
```

This installs `@playwright/test`, creates `playwright.config.ts`, adds `e2e/` directory, and downloads Chromium browser binaries.

### Step 0.2 — Create project file structure

```
e2e/
├── playwright.config.ts          # Auto-generated, modify per config below
├── fixtures/
│   └── test-data.ts              # Shared test constants
├── helpers/
│   └── auth.ts                   # Keycloak OIDC login helper
│   └── sse.ts                   # SSE wait helper
│   └── api.ts                   # Direct API call helpers (for setup/teardown)
├── specs/
│   └── full-journey.spec.ts     # Single sequential spec file
└── global-setup.ts               # Prerequisite: create Keycloak user + seed data
```

### Step 0.3 — Configure `playwright.config.ts`

Key settings:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/specs',
  timeout: 120_000,              // 2 minutes — SSE + OIDC redirects need room
  expect: { timeout: 15_000 },
  fullyParallel: false,           // Sequential — tests share a single user session
  retries: 1,                     // One retry for flaky SSE timing
  workers: 1,                     // Single worker — can't parallelize shared session
  reporter: [['html'], ['list']],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'npx ng serve',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

**Critical paths to verify before tests will work:**

1. **`angular.json` has `"proxyConfig": "proxy.conf.json"` on the serve target.** The dev server must proxy `/api/v1/*` to the Go backend and the OIDC endpoints to Keycloak.
2. **`proxy.conf.json`** must proxy both API and Keycloak requests:
   ```json
   {
     "/api/v1": {
       "target": "https://pocstore.local",
       "secure": false,
       "changeOrigin": true,
       "logLevel": "info"
     },
     "/auth": {
       "target": "https://keycloak.local",
       "secure": false,
       "changeOrigin": true,
       "logLevel": "info"
     }
   }
   ```
3. **`src/environments/environment.ts`** must have `apiUrl: '/api/v1'` (relative path) so browser requests hit the Angular proxy instead of going direct.

### Step 0.4 — Add npm scripts

In `package.json`:

```json
{
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "test:e2e:debug": "playwright test --debug"
}
```

### Step 0.5 — Verify setup

Create a smoke test that navigates to `/home` and asserts the page title:

```typescript
test('smoke: app loads', async ({ page }) => {
  await page.goto('/home');
  await expect(page).toHaveTitle(/GoShopping/);
});
```

Run `npx playwright test` and confirm the test passes.

---

## Phase 1: Auth & Navigation

### Objective

Log in via real Keycloak OIDC and verify the authenticated session is established. All subsequent phases depend on this.

### Step 1.1 — Create the OIDC login helper

File: `e2e/helpers/auth.ts`

The app uses `angular-auth-oidc-client` which redirects to Keycloak's authorization endpoint. The flow is:

1. User clicks "Sign In" → `AuthService.login()` → `oidcSecurityService.authorize()` → browser navigates to Keycloak
2. Keycloak presents login form
3. User enters credentials and submits
4. Keycloak redirects back to `http://localhost:4200/home?code=...&state=...`
5. App's `initializeAuth` detects `code` + `state` params → calls `oidcSecurityService.checkAuth()` → exchanges code for tokens
6. `AuthService` signals update → `isAuthenticated` = true, `userData` populated

The helper function must:

```typescript
import { Page } from '@playwright/test';
import { TEST_USER } from '../fixtures/test-data';

/**
 * Logs in via Keycloak OIDC flow.
 * 
 * Strategy: Click "Sign In" button -> OIDC redirects to Keycloak ->
 * fill login form -> Keycloak redirects back to /home with code+state ->
 * app completes OIDC token exchange.
 * 
 * Important: Keycloak realm, client, and user must be pre-configured in dev Keycloak.
 */
export async function loginWithKeycloak(page: Page): Promise<void> {
  await page.goto('/home');

  // Click "Sign In" — this triggers oidcSecurityService.authorize()
  const signInButton = page.locator('button:has-text("Sign In"), a:has-text("Sign In")');
  await signInButton.click();

  // Wait for navigation to Keycloak login page
  // The URL will be something like:
  // https://keycloak.local/realms/pocstore-realm/protocol/openid-connect/auth?...
  await page.waitForURL(/realms\/pocstore-realm\/protocol\/openid-connect\/auth/);

  // Fill Keycloak login form
  await page.fill('#username', TEST_USER.username);
  await page.fill('#password', TEST_USER.password);
  await page.click('#kc-login');

  // After successful login, Keycloak redirects back to /home?code=...&state=...
  // The app processes the OIDC callback automatically
  await page.waitForURL(/\/home/);

  // Verify authenticated state is visible in the header
  // The header shows "Hello, <firstName>" when authenticated
  await expect(page.locator('text=Hello,')).toBeVisible();
}
```

**Important considerations:**

- The Keycloak URL depends on `environment.keycloak.issuer`. The proxy (`proxy.conf.json`) must route `/auth/realms/...` or the full Keycloak URL must be accessible from the test browser.
- If Keycloak has a "Terms and conditions" or "Update password" page after first login, the helper must handle those extra steps.
- If Keycloak is on a different port/domain than `localhost:4200`, the test browser must be able to reach it (no same-origin issues — OIDC redirects work cross-origin).
- The `environment.ts` Keycloak URL must be `http://keycloak.local` or `http://localhost:8080` (whatever Keycloak runs on) that the test machine can reach.

### Step 1.2 — Create global setup to ensure Keycloak user exists

File: `e2e/global-setup.ts`

Since tests need a real Keycloak user, the global setup should either:

1. **Use Keycloak Admin API** to create the test user before tests run:
   ```typescript
   // POST http://keycloak.local/admin/realms/pocstore-realm/users
   // with username, password, enabled=true, emailVerified=true
   ```

2. **Or validate that the test user already exists** and fail fast if not.

The test user credentials are defined in `e2e/fixtures/test-data.ts`.

### Step 1.3 — Write auth spec / integration into full journey

The auth flow must be the `test.beforeAll` setup in `full-journey.spec.ts`:

```typescript
import { test as base, expect, Page } from '@playwright/test';
import { loginWithKeycloak } from '../helpers/auth';
import { TEST_USER } from '../fixtures/test-data';

let sharedPage: Page;

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  sharedPage = await context.newPage();
  await loginWithKeycloak(sharedPage);
});

test.afterAll(async () => {
  await sharedPage.context().close();
});
```

### Step 1.4 — Verify navigation

Assertions:
- Header displays "Hello, {given_name}" (from OIDC userData)
- "Sign In" button is replaced with account dropdown greeting
- "Your Account" link points to `/profile`
- "Your Orders" link points to `/profile/orders`
- Navigating to `/profile` does NOT redirect to `/home` (AuthGuard passes)
- Navigating to `/profile/orders` does NOT redirect to `/home`

**Implementation details unique to this app:**

The `AuthService` persists auth state to `localStorage` under key `auth_state`. After OIDC login completes, this key contains:
```json
{
  "isAuthenticated": true,
  "userData": { ... },
  "timestamp": ...
}
```

This means that if the page reloads, the app sees the persisted state before OIDC resolves. However, the OIDC login itself is still needed for the initial session. The helper must do the real Keycloak redirect.

---

## Phase 2: User Registration / Profile Management

### Objective

Verify that visiting `/profile` for the first time auto-creates a customer record, and that profile info can be edited and saved.

### Step 2.1 — Customer auto-creation on first profile visit

The `ProfileComponent` has an `effect` that watches `userData` and `isAuthenticated`. When auth is ready, it calls:

1. `customerStore.loadCustomer(email)` → `GET /api/customers/{email}`
2. If 404 (not found), calls `customerStore.createCustomerFromAuth(userData)` → `POST /api/customers`

Test steps:

```typescript
test('auto-creates customer on first profile visit', async () => {
  await sharedPage.goto('/profile');
  
  // Wait for loading state to clear (the effect runs async)
  // The page shows a loading indicator while the customer is being created/loaded
  await expect(sharedPage.locator('text=Profile Information')).toBeVisible({ timeout: 15_000 });
  
  // Verify the form is populated with OIDC data
  const emailInput = sharedPage.locator('[formcontrolname="email"]');
  await expect(emailInput).toHaveValue(TEST_USER.email);
});
```

### Step 2.2 — Edit and save profile info

```typescript
test('updates and persists profile information', async () => {
  await sharedPage.goto('/profile');
  
  // Update fields
  await sharedPage.fill('[formcontrolname="first_name"]', TEST_USER.firstName);
  await sharedPage.fill('[formcontrolname="last_name"]', TEST_USER.lastName);
  await sharedPage.fill('[formcontrolname="phone"]', TEST_USER.phone);
  
  // Click Save
  await sharedPage.click('button:has-text("Save")');
  
  // Verify success notification
  await expect(sharedPage.locator('text=Profile updated')).toBeVisible();
  
  // Reload and verify persistence
  await sharedPage.reload();
  await expect(sharedPage.locator('[formcontrolname="first_name"]')).toHaveValue(TEST_USER.firstName);
  await expect(sharedPage.locator('[formcontrolname="phone"]')).toHaveValue(TEST_USER.phone);
});
```

### Step 2.3 — Form validation

```typescript
test('validates profile form fields', async () => {
  await sharedPage.goto('/profile');
  
  // Clear required field and try to save
  await sharedPage.fill('[formcontrolname="first_name"]', '');
  await sharedPage.click('button:has-text("Save")');
  
  // Verify validation error appears
  await expect(sharedPage.locator('text=First name is required')).toBeVisible();
  
  // Test invalid email
  await sharedPage.fill('[formcontrolname="email"]', 'not-an-email');
  await sharedPage.click('button:has-text("Save")');
  await expect(sharedPage.locator('text=Invalid email')).toBeVisible();
});
```

### Key App Behaviors to Test

- **The `customer_id` from the API response**: After customer creation, the customer object has a `customer_id`. This is used for all subsequent address/credit-card API calls. The test doesn't need to extract this explicitly — the app handles it internally.
- **The address/credit card tabs/sections**: The profile page shows Addresses and Payment Methods sections below Profile Information. These are separate modals.

---

## Phase 3: Address Management

### Objective

Test adding, editing, deleting, and setting default shipping/billing addresses.

### Step 3.1 — Add a shipping address

```typescript
test('adds a shipping address', async () => {
  await sharedPage.goto('/profile');
  
  // Click "Add Address" button
  await sharedPage.click('button:has-text("Add Address")');
  
  // Fill address form in modal
  await sharedPage.selectOption('[formcontrolname="address_type"]', 'shipping');
  await sharedPage.fill('[formcontrolname="first_name"]', TEST_USER.firstName);
  await sharedPage.fill('[formcontrolname="last_name"]', TEST_USER.lastName);
  await sharedPage.fill('[formcontrolname="address_1"]', TEST_USER.shippingAddress.address1);
  await sharedPage.fill('[formcontrolname="city"]', TEST_USER.shippingAddress.city);
  await sharedPage.fill('[formcontrolname="state"]', TEST_USER.shippingAddress.state);
  await sharedPage.fill('[formcontrolname="zip"]', TEST_USER.shippingAddress.zip);
  
  // Submit
  await sharedPage.click('button:has-text("Save")');
  
  // Verify success
  await expect(sharedPage.locator('text=Address added')).toBeVisible();
  
  // Verify address appears in the list
  await expect(sharedPage.locator(`text=${TEST_USER.shippingAddress.address1}`)).toBeVisible();
  await expect(sharedPage.locator('text=Shipping')).toBeVisible();
});
```

### Step 3.2 — Add a billing address

Same flow but `address_type: 'billing'`. Use `TEST_USER.billingAddress` data.

### Step 3.3 — Set default shipping address

```typescript
test('sets default shipping address', async () => {
  await sharedPage.goto('/profile');
  
  // Click "Set as Default" on the shipping address
  await sharedPage.click('li:has-text("Shipping") button:has-text("Default")');
  
  // Verify "Default" badge appears on the shipping address
  await expect(sharedPage.locator('li:has-text("Shipping") >> text=Default Shipping')).toBeVisible();
});
```

### Step 3.4 — Set default billing address

Same pattern but for the billing address.

### Step 3.5 — Edit an address

```typescript
test('edits an existing address', async () => {
  await sharedPage.goto('/profile');
  
  // Click "Edit" on the shipping address
  const addressCard = sharedPage.locator('li:has-text("Shipping")');
  await addressCard.locator('button:has-text("Edit")').click();
  
  // Change city
  const newCity = 'Portland';
  await sharedPage.fill('[formcontrolname="city"]', newCity);
  await sharedPage.click('button:has-text("Save")');
  
  // Verify
  await expect(sharedPage.locator(`text=${newCity}`)).toBeVisible();
});
```

### Step 3.6 — Delete an address

```typescript
test('deletes an address', async () => {
  await sharedPage.goto('/profile');
  
  const addressCard = sharedPage.locator('li:has-text("Billing")');
  await addressCard.locator('button:has-text("Delete")').click();
  
  // Confirmation modal appears
  await expect(sharedPage.locator('text=Are you sure?')).toBeVisible();
  await sharedPage.click('button:has-text("Confirm")');
  
  // Verify address no longer in list
  // This is trickier — need to verify the billing address count decreased
  // or that the specific address text is gone
  await expect(addressCard).not.toBeVisible();
});
```

### Step 3.7 — Form validation for addresses

Tests for:
- Empty required fields show validation messages
- Invalid zip code format shows error
- Address type selection is required

---

## Phase 4: Credit Card Management

### Objective

Test adding, editing, deleting, and setting default credit cards.

### Step 4.1 — Add a credit card

```typescript
test('adds a credit card', async () => {
  await sharedPage.goto('/profile');
  
  // Scroll to Payment Methods section
  await sharedPage.click('button:has-text("Add Card")');
  
  // Fill card form
  await sharedPage.selectOption('[formcontrolname="card_type"]', 'visa');
  await sharedPage.fill('[formcontrolname="card_number"]', TEST_USER.creditCard.number);
  await sharedPage.fill('[formcontrolname="card_holder_name"]', TEST_USER.creditCard.holderName);
  await sharedPage.fill('[formcontrolname="card_expires"]', TEST_USER.creditCard.expiry);
  await sharedPage.fill('[formcontrolname="card_cvv"]', TEST_USER.creditCard.cvv);
  
  // Submit
  await sharedPage.click('button:has-text("Save")');
  
  // Verify success
  await expect(sharedPage.locator('text=Card added')).toBeVisible();
  
  // Verify card appears in list with masked number
  // The app shows "****{last4}" where last4 is the last 4 digits
  const last4 = TEST_USER.creditCard.number.slice(-4);
  await expect(sharedPage.locator(`text=${last4}`)).toBeVisible();
});
```

**Important**: The credit card number must be a valid format for the `card_type`. The app uses `CardValidator` that validates Luhn checksum and card type prefix patterns. Use a genuine test card number (e.g., VISA test number `4111111111111111`) that passes validation.

### Step 4.2 — Set default credit card

```typescript
test('sets default credit card', async () => {
  await sharedPage.goto('/profile');
  
  // Click "Set as Default" on the card
  const cardItem = sharedPage.locator('text=Visa').first();
  await cardItem.locator('..button:has-text("Default")').click();
  
  // Verify "Default" badge
  await expect(sharedPage.locator('text=Default Card')).toBeVisible();
});
```

### Step 4.3 — Edit a credit card

Edit `card_holder_name`, save, reload, and verify the change persisted.

### Step 4.4 — Delete a credit card

Click "Delete", confirm modal, verify card removed.

### Step 4.5 — Card formatting behavior

These are important UI polish validations:
- Card number input auto-formats with spaces every 4 digits
- Expiry auto-formats as MM/YY (adds `/` after 2 digits)
- Card type auto-detected from first digits (4=Visa, 5=Mastercard, 3=Amex, 6=Discover)
- CVV max length (3 for Visa/MC/Discover, 4 for Amex)
- Invalid card number (wrong Luhn checksum) rejected

---

## Phase 5: Product Browsing & Add to Cart

### Objective

Test browsing products, viewing details, adding items to cart, and verifying cart state.

### Step 5.1 — Browse product list

```typescript
test('displays products on the product list page', async () => {
  await sharedPage.goto('/products');
  
  // Verify product cards are loaded
  await expect(sharedPage.locator('[data-testid="product-card"]').first()).toBeVisible({ timeout: 10_000 });
  
  // Verify count
  const productCount = await sharedPage.locator('[data-testid="product-card"]').count();
  expect(productCount).toBeGreaterThan(0);
  
  // Verify each card shows name, price, image
  const firstCard = sharedPage.locator('[data-testid="product-card"]').first();
  await expect(firstCard.locator('[data-testid="product-name"]')).toBeVisible();
  await expect(firstCard.locator('[data-testid="product-price"]')).toBeVisible();
  await expect(firstCard.locator('[data-testid="product-image"]')).toBeVisible();
  await expect(firstCard.locator('button:has-text("Add to Cart")')).toBeVisible();
});
```

### Step 5.2 — View product detail

```typescript
test('navigates to product detail page', async () => {
  await sharedPage.goto('/products');
  
  // Click on a product card
  const firstCard = sharedPage.locator('[data-testid="product-card"]').first();
  const productName = await firstCard.locator('[data-testid="product-name"]').textContent();
  await firstCard.click();
  
  // Verify product detail page loads
  await expect(sharedPage.locator('[data-testid="product-detail-name"]')).toHaveText(productName!);
  await expect(sharedPage.locator('button:has-text("Add to Cart")')).toBeVisible();
  await expect(sharedPage.locator('[data-testid="breadcrumb"]')).toContainText(productName!);
});
```

### Step 5.3 — Add item to cart (from product list)

```typescript
test('adds item to cart from product list', async () => {
  await sharedPage.goto('/products');
  
  // Capture the product name before clicking
  const firstCard = sharedPage.locator('[data-testid="product-card"]').first();
  const productName = await firstCard.locator('[data-testid="product-name"]').textContent();
  
  // Click "Add to Cart" on the first product
  await firstCard.locator('button:has-text("Add to Cart")').click();
  
  // Wait for cart to be created and item added — this triggers:
  // 1. CartStore.ensureCart() -> POST /api/carts (if no cart yet)
  // 2. CartStore.addItem() -> POST /api/carts/{id}/items
  // 3. SSE connects to /api/carts/{id}/stream
  // 4. Item validation via SSE events
  await expect(sharedPage.locator('text=Added to cart')).toBeVisible({ timeout: 20_000 });
  
  // Verify cart icon badge
  await expect(sharedPage.locator('[data-testid="cart-count"]')).toHaveText('1');
  
  // Store product name for later use (use test context or a variable)
  // In a sequential test, we use a closure variable or test context
});
```

### Step 5.4 — View cart

```typescript
test('displays cart with added item', async () => {
  // The cart should already have 1 item from step 5.3
  
  // Click cart icon or navigate directly
  await sharedPage.goto('/cart');
  
  // Verify cart contains the item
  await expect(sharedPage.locator('[data-testid="cart-item"]')).toHaveCount(1);
  await expect(sharedPage.locator('[data-testid="cart-item-name"]')).toBeVisible();
  await expect(sharedPage.locator('[data-testid="cart-item-quantity"]')).toHaveValue('1');
  await expect(sharedPage.locator('[data-testid="cart-total"]')).toBeVisible();
  
  // Store the subtotal/total for later checkout verification
});
```

### Step 5.5 — Update item quantity (optional, within same test)

```typescript
await sharedPage.locator('[data-testid="increment-quantity"]').click();
await expect(sharedPage.locator('[data-testid="cart-item-quantity"]')).toHaveValue('2');
```

Then decrement back to 1.

### Step 5.6 — Add second item to cart

Add a different product from the product list so the cart has 2 items before checkout. This validates the checkout order summary shows multiple line items.

### Step 5.7 — Verify cart total with multiple items

```
- Item 1: quantity 1 × price
- Item 2: quantity 1 × price
- Subtotal = sum of item totals
- Tax = subtotal * tax rate
- Total = subtotal + tax + shipping (0 = free shipping)
```

### Important Cart/SSE Timing Notes

When testing cart operations, the SSE stream at `GET /api/carts/{cartId}/stream` responds with:
- `cart.item.validated` — item is confirmed with possibly corrected price/name
- `cart.item.backorder` — item couldn't be fulfilled

**The test must wait for the SSE validation to complete** before proceeding. The `CartStore` updates item status in its `items` computed signal. The test should wait for the item status to be `confirmed` or check that the cart page shows "validated" items.

A helper function can be useful:

```typescript
async function waitForCartItemValidation(page: Page, timeout = 30_000) {
  // Wait for all cart items to show "confirmed" status
  // or wait for the loading indicator to disappear
  await page.waitForFunction(() => {
    const items = document.querySelectorAll('[data-testid="cart-item"]');
    return items.length > 0;
  }, { timeout });
}
```

---

## Phase 6: Checkout Flow & Order Placement

### Objective

Test the full multi-step checkout wizard and verify order creation via real SSE events.

This is the most complex phase. The checkout has 5 steps:
1. Contact Information
2. Shipping Address
3. Billing Address (skipped if "same as shipping")
4. Payment Information
5. Review & Confirm

**Setup needed:** 1+ items in cart (reuse Phase 5 state).

### Step 6.1 — Navigate to checkout

```typescript
test('navigates to checkout with items in cart', async () => {
  await sharedPage.goto('/cart');
  
  // Verify "Proceed to Checkout" is enabled (canCheckout = true)
  await expect(sharedPage.locator('button:has-text("Proceed to Checkout")')).toBeEnabled();
  await sharedPage.click('button:has-text("Proceed to Checkout")');
  
  // Wait for checkout page
  await expect(sharedPage).toHaveURL(/\/checkout/);
  
  // Verify step indicator shows step 1 as active
  await expect(sharedPage.locator('[data-testid="checkout-step-1"].active')).toBeVisible();
});
```

### Step 6.2 — Step 1: Contact Information

```typescript
test('fills and saves contact information', async () => {
  await sharedPage.goto('/checkout');
  
  // Form should be pre-filled from OIDC user data (email, first_name, last_name)
  const emailInput = sharedPage.locator('[formcontrolname="email"]');
  await expect(emailInput).toHaveValue(TEST_USER.email);
  
  // Fill phone number
  await sharedPage.fill('[formcontrolname="phone"]', TEST_USER.phone);
  
  // Click Continue
  await sharedPage.click('button:has-text("Continue")');
  
  // Wait for API call (PUT /api/carts/{id}/contact)  
  // Step indicator should advance to step 2
  await expect(sharedPage.locator('[data-testid="checkout-step-2"].active')).toBeVisible({ timeout: 10_000 });
});
```

### Step 6.3 — Step 2: Shipping Address

The shipping address form should be pre-filled from the customer's `defaultShippingAddress` (set in Phase 3).

```typescript
test('fills shipping address', async () => {
  await sharedPage.goto('/checkout');
  // Navigate to step 2 if needed (or do in sequence)
  
  // Verify pre-filled from default shipping address
  await expect(sharedPage.locator('[formcontrolname="address_1"]')).toHaveValue(TEST_USER.shippingAddress.address1);
  await expect(sharedPage.locator('[formcontrolname="city"]')).toHaveValue(TEST_USER.shippingAddress.city);
  
  // The "Same as billing" checkbox — keep it CHECKED so we skip billing step
  const sameAsBillingCheckbox = sharedPage.locator('[data-testid="same-as-billing"]');
  if (await sameAsBillingCheckbox.isChecked() === false) {
    await sameAsBillingCheckbox.check();
  }
  
  await sharedPage.click('button:has-text("Continue")');
  
  // Should skip step 3 (billing) and go to step 4 (payment)
  await expect(sharedPage.locator('[data-testid="checkout-step-4"].active')).toBeVisible({ timeout: 10_000 });
});
```

### Step 6.4 — Step 3: Billing Address (if different)

This step is only executed if "Same as billing" was UNCHECKED in Step 2. For the main test path, keep it checked.

We should add a secondary test where they are different:

```typescript
test('supports different billing address', async () => {
  await sharedPage.goto('/checkout');
  // Navigate through step 1 quickly, then:
  
  // Uncheck "same as billing"
  await sharedPage.locator('[data-testid="same-as-billing"]').uncheck();
  
  // Fill billing address
  await sharedPage.fill('[formcontrolname="billing_address_1"]', TEST_USER.billingAddress.address1);
  // ... fill other billing fields
  
  // Continue to step 3 (which is billing)
  // Actually, after unchecking, clicking Continue on step 2 goes to billing step
  await sharedPage.click('button:has-text("Continue")');
  
  // Step 3 (billing) should now be active
  await expect(sharedPage.locator('[data-testid="checkout-step-3"].active')).toBeVisible();
  
  // Fill billing form and continue
  await sharedPage.click('button:has-text("Continue")');
  
  // Step 4 (payment) should be active
  await expect(sharedPage.locator('[data-testid="checkout-step-4"].active')).toBeVisible();
});
```

### Step 6.5 — Step 4: Payment Information

```typescript
test('fills payment information', async () => {
  await sharedPage.goto('/checkout');
  // Navigate through steps 1-2 (or use a helper method to reach step 4)
  
  // Verify pre-filled from default credit card
  // Card type should be selected from default
  await expect(sharedPage.locator('[formcontrolname="card_number"]')).toHaveValue(/4111/);
  
  // If not pre-filled, fill manually
  // ...
  
  await sharedPage.click('button:has-text("Continue")');
  
  // Step 5 (Review) should be active
  await expect(sharedPage.locator('[data-testid="checkout-step-5"].active')).toBeVisible({ timeout: 10_000 });
});
```

### Step 6.6 — Step 5: Review & Place Order

```typescript
test('displays order review with correct data', async () => {
  await sharedPage.goto('/checkout');
  // Navigate to review step
  
  // Verify contact info is displayed
  await expect(sharedPage.locator('[data-testid="review-contact"]')).toContainText(TEST_USER.email);
  
  // Verify shipping address displayed
  await expect(sharedPage.locator('[data-testid="review-shipping"]')).toContainText(TEST_USER.shippingAddress.address1);
  
  // Verify billing address (or "Same as shipping")
  await expect(sharedPage.locator('[data-testid="review-billing"]')).toContainText(TEST_USER.shippingAddress.address1);
  
  // Verify payment: masked card number displayed
  const last4 = TEST_USER.creditCard.number.slice(-4);
  await expect(sharedPage.locator('[data-testid="review-payment"]')).toContainText(last4);
  
  // Verify order summary items
  await expect(sharedPage.locator('[data-testid="review-items"]')).toBeVisible();
  
  // Verify total
  await expect(sharedPage.locator('[data-testid="order-total"]')).toBeVisible();
  
  // Click Place Order
  await sharedPage.click('button:has-text("Place Order")');
});
```

### Step 6.7 — Order Creation (SSE Wait)

After clicking "Place Order", the app:
1. Calls `orderStore.checkout(cartId)` → `POST /api/carts/{cartId}/checkout`
2. Sets `checkoutStatus` to `submitting`, then `awaiting_order`
3. Connects SSE to `GET /api/carts/{cartId}/stream`
4. Waits for `order.created` SSE event (30s timeout)
5. On event: creates `OrderConfirmation`, sets status to `order_received`, clears cart
6. Side effect watches `orderConfirmation` and navigates to `/order-confirmation`

```typescript
test('completes checkout and receives order confirmation via SSE', async () => {
  // Continue from review step — Place Order already clicked
  
  // The UI should show a processing state
  await expect(sharedPage.locator('text=Processing your order')).toBeVisible();
  await expect(sharedPage.locator('text=Connected to real-time order updates')).toBeVisible();
  
  // Wait for navigation to order confirmation page
  // This happens when the SSE order.created event is received
  await sharedPage.waitForURL(/\/order-confirmation/, { timeout: 45_000 });
  
  // Verify order confirmation page content
  await expect(sharedPage.locator('[data-testid="order-number"]')).toBeVisible();
  await expect(sharedPage.locator('[data-testid="order-total"]')).toBeVisible();
  await expect(sharedPage.locator('text=Order confirmed')).toBeVisible();
  
  // Extract order number for later verification
  const orderNumber = await sharedPage.locator('[data-testid="order-number"]').textContent();
  
  // Store orderNumber in test context (or use a closure)
});
```

### Critical Timing Notes for Checkout

1. **SSE timeout is 30 seconds.** The `OrderStore.waitForOrderCreated()` uses `race()` with a 30s timer. The Playwright test timeout for this step should be at least 45 seconds to allow for backend processing + SSE delivery.

2. **The SSE might fire before the test can observe the processing state.** If the backend is fast, the app might navigate to `/order-confirmation` very quickly. The test should handle this by waiting for *either* the processing state *or* the confirmation page:
   ```typescript
   await Promise.race([
     sharedPage.waitForURL('/order-confirmation', { timeout: 45_000 }),
     sharedPage.waitForSelector('text=Processing your order', { timeout: 5_000 }),
   ]);
   ```

3. **The `CartStore.clearCartAfterOrder()` is called after order confirmation.** This means after checkout, the cart is empty. If `canCheckout` is false (empty cart), the checkout guard should redirect to cart page on next visit.

### Step 6.8 — Verify cart is cleared after order

```typescript
test('clears cart after successful order', async () => {
  await sharedPage.goto('/cart');
  
  // Cart should be empty
  await expect(sharedPage.locator('text=Your cart is empty')).toBeVisible();
  
  // Cart icon badge should show 0 or be hidden
  await expect(sharedPage.locator('[data-testid="cart-count"]')).toHaveText('0');
});
```

---

## Phase 7: Order History Verification

### Objective

Verify the placed order appears in the order history page.

### Step 7.1 — Navigate to order history

```typescript
test('navigates to order history', async () => {
  // Option 1: Click "Your Orders" in header
  await sharedPage.goto('/');
  await sharedPage.click('text=Your Orders');
  
  // Option 2: Navigate directly
  // await sharedPage.goto('/profile/orders');
  
  await expect(sharedPage).toHaveURL(/\/profile\/orders/);
  await expect(sharedPage.locator('text=Order History')).toBeVisible();
});
```

### Step 7.2 — Verify order appears in list

```typescript
test('displays the placed order in order history', async () => {
  await sharedPage.goto('/profile/orders');
  
  // Wait for orders to load
  await expect(sharedPage.locator('[data-testid="order-card"]').first()).toBeVisible({ timeout: 15_000 });
  
  // Find the order with the matching order number
  // (orderNumber was captured in Phase 6 step 6.7)
  const orderCard = sharedPage.locator(`[data-testid="order-card"]:has-text("${orderNumber}")`);
  await expect(orderCard).toBeVisible();
  
  // Verify order details
  await expect(orderCard.locator('[data-testid="order-status"]')).toBeVisible();
  await expect(orderCard.locator('[data-testid="order-total"]')).toBeVisible();
  
  // Verify the order date is present and reasonable (today or yesterday)
  await expect(orderCard.locator('[data-testid="order-date"]')).toBeVisible();
});
```

### Step 7.3 — Expand order details

```typescript
test('shows order details when expanded', async () => {
  await sharedPage.goto('/profile/orders');
  
  // Find the order and click "View Details"
  const orderCard = sharedPage.locator(`[data-testid="order-card"]:has-text("${orderNumber}")`);
  await orderCard.locator('button:has-text("View Details")').click();
  
  // Expanded view shows:
  // 1. Status timeline
  await expect(orderCard.locator('[data-testid="order-timeline"]')).toBeVisible();
  
  // 2. Line items (the products we added to cart)
  await expect(orderCard.locator('[data-testid="order-line-item"]')).toHaveCount(2); // 2 items
  
  // Verify the first product name matches what we added
  await expect(orderCard.locator('[data-testid="order-line-item"]').first()).toContainText(productName1);
  await expect(orderCard.locator('[data-testid="order-line-item"]').last()).toContainText(productName2);
  
  // Verify item quantities and prices
  await expect(orderCard.locator('[data-testid="order-line-item"]').first()).toContainText('1'); // qty
});
```

### Step 7.4 — Verify no other unexpected state

- The order status should not be "cancelled"
- The total should match what was displayed on order confirmation
- The order date should be in the expected range

---

## Phase 8: CI Integration

### Step 8.1 — GitHub Actions workflow

Create `.github/workflows/e2e.yml`:

```yaml
name: E2E Tests
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  e2e:
    timeout-minutes: 15
    runs-on: ubuntu-latest
    
    services:
      keycloak:
        image: quay.io/keycloak/keycloak:25.0
        env:
          KC_BOOTSTRAP_ADMIN_USERNAME: admin
          KC_BOOTSTRAP_ADMIN_PASSWORD: admin
          KC_DB: dev-file
        ports:
          - 8080:8080
        options: >-
          --health-cmd "curl -f http://localhost:8080/health/ready || exit 1"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      # If backend is containerized:
      api:
        image: goshopping/api:latest
        ports:
          - 8081:8081
        env:
          KEYCLOAK_URL: http://keycloak:8080
          DATABASE_URL: ... # or use another service
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'
      
      - run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps chromium
      
      - name: Run global setup (create Keycloak test user)
        run: npx tsx e2e/global-setup.ts
        env:
          KEYCLOAK_ADMIN_URL: http://localhost:8080
          KEYCLOAK_REALM: pocstore-realm
          KEYCLOAK_CLIENT_ID: pocstore-client
      
      - name: Run E2E tests
        run: npx playwright test
      
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

### Step 8.2 — Key considerations for CI

1. **Keycloak realm/client must be pre-configured.** Either:
   - Use a Keycloak Docker image with a pre-exported realm (`-e KC_IMPORT=/opt/keycloak/data/import/realm.json`)
   - Use Keycloak Admin API in `global-setup.ts` to create the realm, client, and user

2. **Backend must be configured to use the CI Keycloak instance.** The Go backend's `KEYCLOAK_URL` must point to the Keycloak service container.

3. **Angular environment must be overridden for CI.** Use `fileReplacements` in `angular.json` to swap to a `environment.ci.ts` with CI-specific URLs:
   ```typescript
   // src/environments/environment.ci.ts
   export const environment = {
     production: false,
     apiUrl: '/api/v1',
     keycloak: {
       issuer: 'http://localhost:8080/realms/pocstore-realm',
       clientId: 'pocstore-client',
       scope: 'openid profile email',
       responseType: 'code',
       silentRenew: false,
       useRefreshToken: true,
     }
   };
   ```

4. **Proxy configuration must work in CI.** The `proxy.conf.json` must forward `/api/v1/*` to the backend service and `/auth` or Keycloak URL paths to the Keycloak service.

### Step 8.3 — Recommended CI test data strategy

Since each test run creates a fresh user, include cleanup logic in `global-setup.ts` that:
1. Connects to Keycloak Admin API
2. Creates a test user with unique email (e.g., `e2e-test-{timestamp}@example.com`)
3. Creates a test customer record in the app backend (if needed)
4. Stores the user credentials in an env variable or shared file

The `global-setup.ts` should also handle realm-level setup if not using a pre-exported realm:
- Create realm `pocstore-realm` if it doesn't exist
- Create client `pocstore-client` if it doesn't exist (with valid redirect URIs `http://localhost:4200/*`)
- Create test user with password

---

## Appendix: Test Data Constants

File: `e2e/fixtures/test-data.ts`

```typescript
export const TEST_USER = {
  username: 'e2e-test-user',
  email: 'e2e-test-user@example.com',
  password: 'TestPassword123!',
  firstName: 'E2E',
  lastName: 'TestUser',
  phone: '+1-555-0100',
  
  shippingAddress: {
    address1: '123 Main Street',
    address2: 'Apt 4B',
    city: 'Seattle',
    state: 'WA',
    zip: '98101',
  },
  
  billingAddress: {
    address1: '456 Oak Avenue',
    city: 'Portland',
    state: 'OR',
    zip: '97201',
  },
  
  creditCard: {
    type: 'visa',
    number: '4111111111111111',    // Standard VISA test card, passes Luhn check
    holderName: 'E2E TestUser',
    expiry: '12/28',
    cvv: '123',
  },
};
```

**Important:** The test credit card number `4111111111111111` is a standard VISA test number that passes Luhn validation. The backend must accept this test number (or the test must use a card number the backend's test mode accepts).

---

## Implementation Order

The recommended implementation order, component by component:

| Order | Component | Depends On | Est. Effort |
|-------|-----------|------------|-------------|
| 1 | `test-data.ts` | None | 15 min |
| 2 | `playwright.config.ts` | None | 30 min |
| 3 | `auth.ts` helper | test-data | 1 hr |
| 4 | `sse.ts` helper | None | 30 min |
| 5 | `global-setup.ts` | test-data | 1 hr |
| 6 | Auth + Nav tests | auth helper | 30 min |
| 7 | Profile tests | Auth working | 45 min |
| 8 | Address tests | Customer created | 45 min |
| 9 | Credit card tests | Customer created | 30 min |
| 10 | Product browsing tests | Auth (cart optional) | 45 min |
| 11 | Cart add tests | Auth, Products | 45 min |
| 12 | Checkout tests (steps 1-4) | Cart, Addresses, Card | 1 hr |
| 13 | Checkout Place Order + SSE | All above | 1.5 hr |
| 14 | Order history tests | Checkout working | 30 min |
| 15 | CI workflow | All tests pass | 1 hr |

**Total estimated effort: ~10 hours**

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **SSE timeout during checkout** | Test fails intermittently | Set generous timeout (45s); add retry with `retries: 1` |
| **OIDC redirect timing** | Auth test flakes | Use `waitForURL()` with regex patterns; screenshot on failure for debugging |
| **Backend data seeding** | Conflicting test data | Use unique usernames/emails per run (timestamp-based), or clean up after run |
| **Keycloak first-login flows** | Extra redirects (T&C, password change) | Add conditional checks in `auth.ts` helper for common Keycloak post-login pages |
| **Cart SSE validation delay** | Item in "pending_validation" state after add | Add wait-for-confirmation helper; check `canCheckout` before proceeding |
| **Backend not running** | All tests fail | `webServer` config ensures Angular serves; add pre-flight check for API health |
| **Proxy configuration** | API calls fail from test browser | Verify `proxy.conf.json` is correct; test with curl before running Playwright |
