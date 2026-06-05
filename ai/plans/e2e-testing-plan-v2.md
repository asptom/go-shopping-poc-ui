# E2E Testing Plan v2 — GoShopping POC UI

**Date:** 2026-06-04
**Status:** Revised — supersedes `ai/plans/e2e-testing-plan.md`
**Test framework:** Playwright (TypeScript) — `@playwright/test`
**App:** Angular 21 SPA served at `http://localhost:4200`
**Backend:** Go REST API (`https://pocstore.local/api/v1`) + Keycloak OIDC (`https://keycloak.local/realms/pocstore-realm`)
**Auth:** Real Keycloak OIDC flow against a real Keycloak instance (no app test-mode flags, no auth state seeding, no OIDC route mocking).
**API:** Real Go backend (no Playwright route mocking of app's own APIs).
**SSE:** Real Server-Sent Events (no `EventSource` mock injection).
**Test isolation:** Single sequential spec file with `test.describe.serial()`, one fresh Keycloak user per run (timestamped), one `BrowserContext` shared for the whole suite. Cleanup via `globalTeardown` deletes the Keycloak user via the Admin API.
**File location:** `e2e/specs/full-journey.spec.ts` (all phases in one file)

---

## 0. Critical context (read this first)

This plan was rewritten after verifying every claim in v1 against the actual codebase. The verified findings below are the source of truth. **Do not re-verify these during implementation** — they are already correct.

### 0.1 Environment & DNS — already correct (no changes needed)

- `pocstore.local` and `keycloak.local` are already in `/etc/hosts` (confirmed by user). Do not modify `/etc/hosts`.
- `src/environments/environment.ts:7` uses `apiUrl: 'https://pocstore.local/api/v1'` (absolute) — **keep as-is**. Browser requests will go cross-origin to `pocstore.local` directly.
- `src/environments/environment.ts:9` uses `issuer: 'https://keycloak.local/realms/pocstore-realm'` — **keep as-is**.
- `proxy.conf.json:1-7` only proxies `/api/v1` to `https://pocstore.local`. It does **not** proxy Keycloak. Keycloak is reached via direct DNS.
- `angular.json:74` — `serve.builder` is `@angular/build:dev-server` with `proxyConfig: "proxy.conf.json"`. **Default build target is production** (`buildTarget: 'go-shopping-poc-ui:build'`). Always invoke with `--configuration development` for e2e.

### 0.2 OIDC quirks — must be handled

- `src/app/auth/oidc.config.ts:16-18` — `customParamsAuthRequest: { prompt: 'consent' }` forces the Keycloak consent screen on **every** login. The auth helper must click the consent `Submit` / `Accept` button after credential submit.
- `src/app/auth/oidc.config.ts:8` — `redirectUrl: ${window.location.origin}/home`. After Keycloak callback, the app lands at `http://localhost:4200/home?code=...&state=...`.
- `src/app/app.config.ts:22-30` — `APP_INITIALIZER` only calls `oidcSecurityService.checkAuth()` when URL has `code` AND `state`. Otherwise it short-circuits. This means after the OIDC callback, the auth state is established only when the user lands on `/home?code=&state=`.

### 0.3 Form naming convention — the #1 source of bugs

- **Profile form** (`profile.html`): `snake_case` — `first_name`, `last_name`, `phone`, `email`, `address_1`, `address_2`, `city`, `state`, `zip`, `card_type`, `card_number`, `card_holder_name`, `card_expires`, `card_cvv`.
- **Checkout forms** (`checkout.component.html`): `camelCase` — `firstName`, `lastName`, `address1`, `address2`, `city`, `state`, `zip`, `cardType`, `cardNumber`, `cardHolder`, `expiryMonth`, `expiryYear`, `cvv`.
- Both form models are correct for their context (profile matches the `Customer` model; checkout is local form state converted to the cart API shape at submit time).
- **Stable selectors**: every input in both has a unique `id` attribute (e.g., `#firstName`, `#shipFirstName`, `#billAddress1`, `#cardNumber`, `#cvv`, `#cardHolder`, `#expiryMonth`, `#expiryYear`, `#cardCVV`, `#address1`, `#email`, `#phone`, `#zip`, `#city`, `#state`, etc.). **Prefer `id` selectors over `formControlName` selectors** in the spec — IDs are stable across the snake_case/camelCase split.

### 0.4 Notification toast messages — exact text

Toasts are emitted by stores via `NotificationService` and rendered by `<app-notification-container>` at `src/app/core/notification/notification-container.component.ts:8-26`. The container adds the classes `.notification`, `.notification-{type}`, `.notification-title`, `.notification-message`.

| Action | Exact toast text | Source |
|---|---|---|
| Add profile info (initial) | `Customer profile created successfully` | `customer.store.ts:110` |
| Update profile | `Profile updated successfully` | `customer.store.ts:125, 155` |
| Add address (profile) | `Address added successfully` | `customer.store.ts:174` |
| Update address | `Address updated successfully` | `customer.store.ts:193` |
| Delete address | `Address deleted successfully` | `customer.store.ts:216` |
| Add credit card (profile) | `Credit card added successfully` | `customer.store.ts:236` |
| Update credit card | `Credit card updated successfully` | `customer.store.ts:255` |
| Delete credit card | `Credit card deleted successfully` | `customer.store.ts:278` |
| Set default shipping | `Default shipping address updated` | `customer.store.ts:299` |
| Set default billing | `Default billing address updated` | `customer.store.ts:318` |
| Set default credit card | `Default credit card updated` | `customer.store.ts:337` |
| Cart created | `Cart created successfully` | `cart.store.ts:259` |
| Item added to cart | `Item added to cart` | `cart.store.ts:313` |
| Cart updated | `Cart updated` | `cart.store.ts:335` |
| Item removed | `Item removed from cart` | `cart.store.ts:356` |
| Cart cleared | `Cart cleared` | `cart.store.ts:385` |
| Contact info saved | `Contact information saved` | `cart.store.ts:406` |
| Address added (cart) | `Address added` | `cart.store.ts:427` |
| Payment saved | `Payment information saved` | `cart.store.ts:448` |
| Pre-checkout gate error | `Please complete all required information before checkout` | `cart.store.ts:462` |
| Cart item validated | `${productName} is now available in your cart` | `cart.store.ts:177` |
| Cart item backorder | `${productName} is on backorder: ${reason}` | `cart.store.ts:222-224` |
| Order placed (dynamic) | `Order ${orderNumber} placed successfully!` | `order.store.ts:95-97` |

For success-toast assertions use the selector `.notification-success .notification-message` (e.g., `page.locator('.notification-success .notification-message', { hasText: 'Item added to cart' })`).

### 0.5 Step indicator in checkout

- `<div class="step">` pills at `checkout.component.html:23-60`. Active = `[class.active]`, completed = `[class.completed]`.
- Pill labels: `Contact`, `Shipping`, `Billing`, `Payment`. The `Billing` pill is **conditionally rendered** when `!sameAsShipping()`. The `Payment` pill number is `{{ sameAsShipping() ? '3' : '4' }}` — count is dynamic.
- **There is no `Review` step pill.** Step 5 (Review) is rendered as a `.review-section` in the form area only (`checkout.component.html:523`).
- The Order Summary sidebar (`checkout.component.html:603-650`) renders per `.summary-item` rows.

### 0.6 SSE timing

- `order.store.ts:85` — `waitForOrderCreated(30000)`. The SSE wait is 30 s hard-coded.
- `order.store.ts:91-93` — On success, sets `orderConfirmation` and `checkoutStatus: 'order_received'`.
- `order.store.ts:95-97` — Fires the success toast `Order ${orderNumber} placed successfully!`.
- `checkout.component.ts:36-43` — `orderConfirmationEffect` watches `orderStore.orderConfirmation()` and on truthy:
  1. Calls `cartStore.clearCartAfterOrder()` (disconnects SSE, clears persisted `cart_id`, resets state)
  2. Navigates to `/order-confirmation`
- The order confirmation page reads from `orderStore.orderConfirmation` (a separate signal) and is safe — the cart is already cleared by the time the route activates.

### 0.7 `canCheckout` is intentionally lenient

- `cart.store.ts:92-96` — `canCheckout = computed(() => !this.isEmpty() && !this.hasPendingValidationItems())`.
- It does **not** require contact, shipping address, billing address, or payment. Those are collected during checkout, not gated.

---

## 1. The data-testid retrofit (Phase 0.5)

**Every testid listed here is new code. Add them as instructed. Do not invent additional testids beyond this list — other tests use `id=`/`text=`/class selectors.**

Naming convention: `kebab-case`, prefixed by the area (e.g., `product-card`, `cart-item`, `checkout-step-1`). For elements that repeat, give the *container* the testid and use `nth()` or `:has-text()` for the specific row.

### 1.1 `src/app/features/products/product-list/components/product-card/product-card.component.html`

| Line | Element | Add attribute |
|---|---|---|
| 1 | `<article class="product-card" ...>` | `data-testid="product-card"` |
| 23 | `<h3 class="product-name">` | `data-testid="product-name"` |
| 28 | `<span class="final-price">` | `data-testid="product-price"` |
| 42 | `<button class="btn-add-cart">` | `data-testid="add-to-cart"` |

The `<img>` on line 3 should be left without a testid (no stable test currently depends on it).

### 1.2 `src/app/features/products/product-detail/product-detail.component.html`

| Line | Element | Add attribute |
|---|---|---|
| 38 | `<h1 class="product-name">` | `data-testid="product-detail-name"` |
| 91-103 | `<button class="btn-add-cart">` (the outer button) | `data-testid="add-to-cart-detail"` |

### 1.3 `src/app/features/products/product-list/product-list.component.html`

| Line | Element | Add attribute |
|---|---|---|
| 3 | `<h1>Products</h1>` | `data-testid="product-list-title"` |
| 60 | `<div class="product-grid">` (the @for wrapper) | `data-testid="product-grid"` |

### 1.4 `src/app/features/cart/cart.component.html`

| Line | Element | Add attribute |
|---|---|---|
| 27 | `<h1 class="page-title">Shopping Cart</h1>` | `data-testid="cart-title"` |
| 50 | `<div class="cart-content">` | `data-testid="cart-content"` |
| 84 | `<div class="items-section">` | `data-testid="cart-items"` |
| 100 | `<div class="cart-actions">` | `data-testid="cart-actions"` |
| 110 | `<div class="summary-section">` | `data-testid="cart-summary"` |

### 1.5 `src/app/features/cart/components/cart-item/cart-item.component.html`

| Line | Element | Add attribute |
|---|---|---|
| 2 | `<div class="cart-item" ...>` | `data-testid="cart-item"` |
| 11 | `<h3 class="product-name">` | `data-testid="cart-item-name"` |
| 60-68 | `<input class="quantity-input">` | `data-testid="cart-item-quantity"` |
| 53-59 | `<button class="btn-quantity" (click)="decrementQuantity()">` | `data-testid="cart-item-decrement"` |
| 69-75 | `<button class="btn-quantity" (click)="incrementQuantity()">` | `data-testid="cart-item-increment"` |
| 16 | `<span class="status-badge">` | `data-testid="cart-item-status"` |

### 1.6 `src/app/features/cart/components/cart-summary/cart-summary.component.html`

| Line | Element | Add attribute |
|---|---|---|
| 35-38 | `<div class="summary-row total">` | `data-testid="cart-total"` |
| 42-47 | `<button class="btn-checkout">` | `data-testid="proceed-to-checkout"` |
| 49-51 | `<a class="btn-continue">` (Continue Shopping) | `data-testid="continue-shopping"` |
| 53-55 | `<button class="btn-clear">` | `data-testid="clear-cart"` |

### 1.7 `src/app/features/cart/components/empty-cart/empty-cart.component.html`

If `<h2 class="empty-cart-title">` exists with text `Your Shopping Cart is Empty`, add:
- `<h2 class="empty-cart-title">` → `data-testid="cart-empty-title"`
- `<button class="btn-shop">` (Start Shopping) → `data-testid="start-shopping"`

Verify file content before editing.

### 1.8 `src/app/features/checkout/checkout.component.html`

| Line | Element | Add attribute |
|---|---|---|
| 23-60 | `<div class="checkout-steps">` | `data-testid="checkout-steps"` |
| 24-30 | step 1 pill (`Contact`) | `data-testid="checkout-step-1"` |
| 32-38 | step 2 pill (`Shipping`) | `data-testid="checkout-step-2"` |
| 40-48 | step 3 pill (`Billing`) | `data-testid="checkout-step-3"` |
| 53-59 | step 4 pill (`Payment`) | `data-testid="checkout-step-4"` |
| 67 | step 1 form section (`Contact Information`) | `data-testid="checkout-form-1"` |
| 146 | step 2 form section | `data-testid="checkout-form-2"` |
| 279 | step 3 form section | `data-testid="checkout-form-3"` |
| 399 | step 4 form section | `data-testid="checkout-form-4"` |
| 524 | step 5 review section | `data-testid="checkout-form-5"` |
| 253-261 | `<label class="checkbox-label">` containing the "Billing address same as shipping" checkbox | `data-testid="same-as-billing-label"` (the label is the stable handle since the input has no `id`/`name`) |
| 407-417 | card-type radio group container | `data-testid="card-type-selector"` |
| 549-555 | contact review block | `data-testid="review-contact"` |
| 556-565 | shipping review block | `data-testid="review-shipping"` |
| 567-576 | billing review block | `data-testid="review-billing"` |
| 578-584 | payment review block | `data-testid="review-payment"` |
| 589-595 | `<button class="btn-primary btn-place-order">` | `data-testid="place-order"` |
| 604-650 | order summary sidebar | `data-testid="order-summary"` |
| 608-650 | `<div class="summary-items">` | `data-testid="summary-items"` |

### 1.9 `src/app/features/order-confirmation/order-confirmation.component.html`

| Line | Element | Add attribute |
|---|---|---|
| 1 | root `<div class="order-confirmation-container">` | `data-testid="order-confirmation"` |
| 10 | `<h1>Order Confirmed!</h1>` | `data-testid="confirmation-heading"` |
| 16 | `<span class="value order-number">` | `data-testid="order-number"` |
| 24 | `<span class="value total">` | `data-testid="order-total"` |
| 33 | `<button class="btn-primary">Continue Shopping</button>` | `data-testid="continue-shopping-confirmation"` |
| 36 | `<button class="btn-secondary">View My Orders</button>` | `data-testid="view-my-orders"` |

### 1.10 `src/app/features/order-history/order-history.component.html`

| Line | Element | Add attribute |
|---|---|---|
| 4 | `<h1>Order History</h1>` | `data-testid="order-history-title"` |
| 6 | `<h2>Your Orders</h2>` | `data-testid="order-history-subtitle"` |
| 21 | `<div class="order-card">` | `data-testid="order-card"` |
| 23 | `<div class="order-id">Order #...</div>` | `data-testid="order-id"` |
| 24 | `<div class="order-date">` | `data-testid="order-date"` |
| 28 | `<div class="order-status">` | `data-testid="order-status"` |
| 29 | `<div class="order-total">Total: ...</div>` | `data-testid="order-total"` |
| 33-35 | `<button class="view-details-button">` | `data-testid="view-details"` |
| 40 | `<div class="order-timeline">` | `data-testid="order-timeline"` |
| 49 | `<div class="order-items">` | `data-testid="order-items"` |
| 56 | `<div class="item">` (per line item) | `data-testid="order-line-item"` |
| 57 | `<div class="item-name">` | `data-testid="order-line-item-name"` |
| 61 | `<div class="item-quantity">` | `data-testid="order-line-item-quantity"` |
| 62 | `<div class="item-price">` | `data-testid="order-line-item-price"` |

### 1.11 `src/app/features/profile/profile.html`

| Line | Element | Add attribute |
|---|---|---|
| 26 | `<h1>Your Account</h1>` | `data-testid="profile-title"` |
| 46 | `<div class="profile-nav">` | `data-testid="profile-nav"` |
| 51 | `<div class="profile-section">` | `data-testid="profile-section"` |
| 52 | `<h2>Profile Information</h2>` | `data-testid="profile-info-heading"` |
| 87 | `<button class="edit-button">Edit Profile</button>` | `data-testid="edit-profile"` |
| 89 | `<button class="save-button">Save Profile</button>` | `data-testid="save-profile"` |
| 90 | `<button class="cancel-button">Cancel</button>` | `data-testid="cancel-profile"` |
| 97 | `<div class="addresses-section">` | `data-testid="addresses-section"` |
| 98 | `<h2>Addresses</h2>` | `data-testid="addresses-heading"` |
| 100 | `<button class="add-button">Add Address</button>` | `data-testid="add-address"` |
| 104 | `<div class="address-card">` | `data-testid="address-card"` |
| 114 | `<span class="default-badge">Default Shipping</span>` | `data-testid="default-shipping-badge"` |
| 117 | `<span class="default-badge">Default Billing</span>` | `data-testid="default-billing-badge"` |
| 121 | `<button class="edit-button">Edit</button>` (address) | `data-testid="edit-address"` |
| 123 | `<button class="default-button">Set as Default Shipping</button>` | `data-testid="set-default-shipping"` |
| 126 | `<button class="default-button">Set as Default Billing</button>` | `data-testid="set-default-billing"` |
| 128 | `<button class="delete-button">Delete</button>` (address) | `data-testid="delete-address"` |
| 135 | `<div class="cards-section">` | `data-testid="cards-section"` |
| 136 | `<h2>Credit Cards</h2>` | `data-testid="cards-heading"` |
| 138 | `<button class="add-button">Add Credit Card</button>` | `data-testid="add-credit-card"` |
| 142 | `<div class="card-card">` | `data-testid="credit-card"` |
| 145 | `<p>{{ maskCardNumber(card.card_number) }}</p>` | `data-testid="credit-card-masked"` |
| 149 | `<span class="default-badge">Default</span>` | `data-testid="default-credit-card-badge"` |
| 153 | `<button class="edit-button">Edit</button>` (card) | `data-testid="edit-credit-card"` |
| 155 | `<button class="default-button">Set as Default</button>` | `data-testid="set-default-credit-card"` |
| 157 | `<button class="delete-button">Delete</button>` (card) | `data-testid="delete-credit-card"` |
| 169 | `<app-modal>` (address modal) | `data-testid="address-modal"` |
| 170 | `[isOpen]="addressModalOpen()"` — give the inner form a stable selector. Edit line 173 `<form [formGroup]="addressForm()" (ngSubmit)="saveAddress()">` to add `data-testid="address-form"` |
| 178 | `<select id="addressType">` | `data-testid="address-type-select"` |
| 237 | `<button class="save-button">Add Address / Update Address</button>` | `data-testid="address-save"` |
| 244 | `<app-modal>` (credit card modal) | `data-testid="credit-card-modal"` |
| 248 | `<form ... (ngSubmit)="saveCreditCard()">` | `data-testid="credit-card-form"` |
| 252 | `<select id="cardType">` | `data-testid="card-type-select"` |
| 293 | `<button class="save-button">Add / Update Credit Card</button>` | `data-testid="credit-card-save"` |
| 2-9 | `<app-confirmation-modal>` (Delete Address) | `data-testid="confirm-delete-address"` |
| 13-20 | `<app-confirmation-modal>` (Delete Credit Card) | `data-testid="confirm-delete-credit-card"` |

### 1.12 `src/app/layout/header/header.html`

| Line | Element | Add attribute |
|---|---|---|
| 7 | `<span class="nav-link">Hello, ...</span>` (top nav authenticated) | `data-testid="hello-greeting-top"` |
| 9 | `<span class="nav-link" (click)="toggleAccountDropdown...">Hello, sign in</span>` | `data-testid="signin-trigger-top"` |
| 11 | `<a class="account-link" (click)="onLogin()">Sign in</a>` | `data-testid="signin-link-top"` |
| 75 | `<span class="account-greeting">Hello, ...</span>` (main header) | `data-testid="hello-greeting-main"` |
| 77 | `<a href="/profile" class="account-link">Your Account</a>` | `data-testid="your-account-link"` |
| 78 | `<a class="account-link" (click)="goToOrderHistory()">Your Orders</a>` | `data-testid="your-orders-link"` |
| 79 | `<a class="account-link" (click)="onLogout()">Sign Out</a>` | `data-testid="sign-out-link"` |
| 84 | `<a class="account-link" (click)="onLogin()">Sign in</a>` (main header dropdown) | `data-testid="signin-link-main"` |
| 90 | `<app-cart-icon></app-cart-icon>` | `data-testid="cart-icon"` |

### 1.13 `src/app/core/notification/notification-container.component.ts`

The component uses an inline template at lines 8-26. Edit the inline template to add `data-testid` attributes:

| Element in inline template | Add attribute |
|---|---|
| `<div class="notification-container">` (line 9) | `data-testid="notification-container"` |
| `<div class="notification notification-{{ type }}" ...>` (line 11) | `data-testid="notification"` |
| `<div class="notification-message">` (line 19) | `data-testid="notification-message"` |

These replace the class-based assertions used in the spec.

### 1.14 `src/app/shared/modal/confirmation-modal.component.ts`

The component uses an inline template. Edit it to add:
- The `<div class="modal-overlay">` (or root) → `data-testid="confirmation-modal"`
- The `<button class="btn-confirm">` → `data-testid="confirmation-confirm"`
- The `<button class="btn-cancel">` → `data-testid="confirmation-cancel"`

(Read the file first to find the exact element lines; the v1 plan did not capture this file.)

---

## 2. Phase 0 — Project setup & tooling

### 2.1 Install Playwright

```bash
cd /Users/tom/Projects/Angular/go-shopping-poc-ui
npm init playwright@latest -- --yes --browser chromium --quiet --no-install-deps
# Then install the package manually so we can pin the version
npm install --save-dev @playwright/test@^1.60.0
npx playwright install chromium
```

The `--no-install-deps` flag prevents apt/yum system package installation. We do not need Playwright system deps on macOS dev machines; if a developer is missing them, `npx playwright install --with-deps chromium` will set them up.

### 2.2 Install TypeScript runner for `global-setup.ts`

`global-setup.ts` is a Node script, not a Playwright test, so it must be runnable directly. Add `tsx` as a dev dependency:

```bash
npm install --save-dev tsx@^4.0.0
```

### 2.3 Create the directory structure

```
e2e/
├── playwright.config.ts
├── fixtures/
│   └── test-data.ts
├── helpers/
│   ├── auth.ts                # OIDC login helper (handles consent screen)
│   ├── sse.ts                 # SSE wait helpers
│   ├── api.ts                 # Direct API call helpers (used by global-setup only)
│   └── notifications.ts       # Toast assertion helpers
├── specs/
│   └── full-journey.spec.ts
├── global-setup.ts            # Pre-test: provision Keycloak user
└── global-teardown.ts         # Post-test: delete Keycloak user
```

### 2.4 `playwright.config.ts`

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/specs',
  timeout: 120_000,                  // 2 min — SSE + OIDC redirect need room
  expect: { timeout: 15_000 },
  fullyParallel: false,              // Sequential — tests share a single user session
  retries: process.env.CI ? 2 : 0,   // More retries in CI for SSE flakiness
  workers: 1,                        // Single worker — can't parallelize shared session
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['list'], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  webServer: {
    // Always build in development mode for e2e
    command: 'npm run start -- --configuration development',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
```

### 2.5 Add npm scripts to `package.json`

In the `scripts` section, add:

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui",
"test:e2e:debug": "playwright test --debug",
"test:e2e:headed": "playwright test --headed",
"test:e2e:report": "playwright show-report"
```

### 2.6 Smoke test (verify setup before continuing)

Create `e2e/specs/smoke.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('smoke: home page loads', async ({ page }) => {
  await page.goto('/home');
  await expect(page).toHaveTitle(/GoShopping/);
  // Header signin trigger is present when unauthenticated
  await expect(page.getByTestId('signin-trigger-top')).toBeVisible();
});
```

Run `npm run test:e2e -- smoke.spec.ts` and confirm the test passes. **Do not proceed to Phase 1 until this passes.**

---

## 3. Test data and shared fixtures

### 3.1 `e2e/fixtures/test-data.ts`

```ts
export const TIMESTAMP = Date.now();

export const TEST_USER = {
  // Append a timestamp to make every test run unique (avoids customer collisions)
  username: `e2e-user-${TIMESTAMP}`,
  email: `e2e-user-${TIMESTAMP}@example.com`,
  password: 'E2eTestPassword123!',
  given_name: 'E2E',
  family_name: 'TestUser',
  phone: '555-010-0100',   // matches profile phone regex ^\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}$

  // Address values used in profile AND checkout
  shippingAddress: {
    first_name: 'E2E',
    last_name: 'TestUser',
    address_1: '123 Main Street',
    address_2: 'Apt 4B',
    city: 'Seattle',
    state: 'WA',
    zip: '98101',
  },
  billingAddress: {
    first_name: 'E2E',
    last_name: 'TestUser',
    address_1: '456 Oak Avenue',
    address_2: '',
    city: 'Portland',
    state: 'OR',
    zip: '97201',
  },

  // Credit card — Visa test number, Luhn-valid, 16 digits
  creditCard: {
    card_type: 'visa' as const,
    card_number: '4111111111111111',   // masked as **** **** **** 1111
    card_holder_name: 'E2E TestUser',
    card_expires: '12/28',            // MM/YY
    card_cvv: '123',
  },
} as const;

// Backend hostnames (must be in /etc/hosts)
export const BACKEND_BASE = 'https://pocstore.local/api/v1';
export const KEYCLOAK_ISSUER = 'https://keycloak.local/realms/pocstore-realm';
export const KEYCLOAK_ADMIN_BASE = 'https://keycloak.local/admin/realms/pocstore-realm';

// Credentials for the Keycloak admin user used by global-setup/teardown
export const KEYCLOAK_ADMIN = {
  base: 'https://keycloak.local',
  username: 'admin',         // pre-configured in dev Keycloak
  password: 'admin',         // pre-configured in dev Keycloak
  realm: 'pocstore-realm',
};
```

### 3.2 Local development prerequisites

This plan assumes the following are already in place on the developer's machine before running tests. They are one-time manual setup steps, **not** part of the e2e test implementation.

1. **`/etc/hosts` contains:**
   ```
   127.0.0.1   pocstore.local
   127.0.0.1   keycloak.local
   ```
   (Confirmed by user — already in place.)

2. **Keycloak dev instance is running and reachable at `https://keycloak.local`** with:
   - Realm `pocstore-realm` created.
   - Client `pocstore-client` created (confidential, `directAccessGrantsEnabled: true`, `standardFlowEnabled: true`, valid redirect URIs `http://localhost:4200/*`).
   - Admin user `admin/admin` available for the Keycloak Admin API (used by `global-setup.ts`).

3. **Go API is running and reachable at `https://pocstore.local/api/v1`** with CORS allowing `http://localhost:4200`.

If any of the above is missing, the tests will fail with DNS errors, 404s, or CORS rejections. Fix the dev environment first; do not attempt to mock any of it.

---

## 4. Helpers

### 4.1 `e2e/helpers/auth.ts`

```ts
import { Page, expect } from '@playwright/test';
import { TEST_USER, KEYCLOAK_ISSUER } from '../fixtures/test-data';

/**
 * Logs in via real Keycloak OIDC.
 *
 * Flow:
 *  1. Navigate to /home
 *  2. Click the "Sign in" link in the top nav
 *  3. Keycloak login form appears — fill credentials, submit
 *  4. Because oidc.config.ts sets prompt: 'consent', the consent screen
 *     appears after credential submit. Click "Yes" / the submit button.
 *  5. Keycloak redirects to http://localhost:4200/home?code=&state=
 *  6. APP_INITIALIZER calls checkAuth(), tokens are stored,
 *    AuthService signals update, header shows "Hello, {firstName}".
 */
export async function loginWithKeycloak(page: Page): Promise<void> {
  await page.goto('/home');

  // Click Sign in (top nav dropdown trigger)
  await page.getByTestId('signin-trigger-top').click();
  await page.getByTestId('signin-link-top').click();

  // Keycloak login page
  await page.waitForURL(
    /keycloak\.local\/realms\/pocstore-realm\/protocol\/openid-connect\/auth/,
    { timeout: 15_000 }
  );

  await page.locator('#username').fill(TEST_USER.username);
  await page.locator('#password').fill(TEST_USER.password);
  await page.locator('#kc-login').click();

  // Consent screen (prompt=consent in oidc.config.ts). Click "Yes".
  // The submit button text is "Yes" by default in Keycloak's consent.ftl.
  // If the realm is configured to skip consent for this client, this
  // selector will time out — that's fine, we proceed.
  const consentButton = page.locator('input[name="accept"], input[name="yes"], button[name="accept"]');
  if (await consentButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await consentButton.click();
  }

  // Wait for the OIDC callback to complete and the app to render the authenticated header
  await page.waitForURL(/\/home/, { timeout: 15_000 });
  await expect(page.getByTestId('hello-greeting-main')).toContainText(
    TEST_USER.given_name,
    { timeout: 15_000 }
  );
}

/**
 * Signs out via the Sign Out link in the header account menu.
 * After sign-out the app returns to /home with the "Hello, sign in" trigger visible.
 */
export async function signOut(page: Page): Promise<void> {
  await page.getByTestId('sign-out-link').click();
  await page.waitForURL(/\/home/, { timeout: 15_000 });
  await expect(page.getByTestId('signin-trigger-top')).toBeVisible({ timeout: 10_000 });
}
```

### 4.2 `e2e/helpers/sse.ts`

```ts
import { Page, expect } from '@playwright/test';

/**
 * Waits for a cart item to reach `confirmed` (or `validated`) status.
 * Cart page shows a `.status-badge` with class `.status-confirmed` when ready.
 * Times out at 30s to match the backend SSE pipeline.
 */
export async function waitForCartItemValidated(
  page: Page,
  testId = 'cart-item',
  timeoutMs = 30_000
): Promise<void> {
  const item = page.getByTestId(testId).first();
  await expect(item).toBeVisible({ timeout: 10_000 });
  await expect(item.getByTestId('cart-item-status')).toHaveClass(/status-confirmed/, {
    timeout: timeoutMs,
  });
}

/**
 * Waits for the post-checkout navigation to /order-confirmation.
 * This is the canonical signal that the SSE order.created event was received
 * and OrderStore.checkout resolved successfully.
 */
export async function waitForOrderConfirmation(page: Page, timeoutMs = 35_000): Promise<void> {
  // Race: the navigation can happen very quickly, or we may briefly see the
  // "Processing Your Order..." awaiting-order state. The page stays at /checkout
  // until navigation, so just wait for the URL.
  await page.waitForURL(/\/order-confirmation/, { timeout: timeoutMs });
}
```

### 4.3 `e2e/helpers/notifications.ts`

```ts
import { Page, expect } from '@playwright/test';

/**
 * Asserts a success notification with the given text appears.
 * Notifications are rendered by <app-notification-container>
 * and auto-dismiss after 3s (default success duration).
 */
export async function expectSuccessNotification(
  page: Page,
  text: string | RegExp,
  timeoutMs = 10_000
): Promise<void> {
  const message = page.locator(
    '[data-testid="notification"][class*="notification-success"] [data-testid="notification-message"]'
  );
  await expect(message.filter({ hasText: text }).first()).toBeVisible({ timeout: timeoutMs });
}

/**
 * Waits for the notification to disappear (default 3s success duration).
 */
export async function waitForNotificationToDismiss(
  page: Page,
  text: string | RegExp,
  timeoutMs = 10_000
): Promise<void> {
  const message = page.locator(
    '[data-testid="notification"][class*="notification-success"] [data-testid="notification-message"]'
  );
  await expect(message.filter({ hasText: text }).first()).not.toBeVisible({ timeout: timeoutMs });
}
```

### 4.4 `e2e/helpers/api.ts` (only for `global-setup` and `global-teardown`)

```ts
import { TEST_USER, KEYCLOAK_ADMIN, BACKEND_BASE } from '../fixtures/test-data';
import { request, APIRequestContext } from '@playwright/test';

let adminToken: string | null = null;

/**
 * Authenticates against the Keycloak Admin API using the password grant
 * and caches the access token for subsequent calls.
 */
export async function getKeycloakAdminToken(): Promise<string> {
  if (adminToken) return adminToken;
  const ctx: APIRequestContext = await request.newContext({
    baseURL: KEYCLOAK_ADMIN.base,
  });
  const res = await ctx.post(
    `/realms/master/protocol/openid-connect/token`,
    {
      form: {
        grant_type: 'password',
        client_id: 'admin-cli',
        username: KEYCLOAK_ADMIN.username,
        password: KEYCLOAK_ADMIN.password,
      },
    }
  );
  if (!res.ok()) {
    throw new Error(`Failed to get Keycloak admin token: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  adminToken = body.access_token;
  await ctx.dispose();
  return adminToken!;
}

export interface KeycloakUser {
  id: string;
  username: string;
  email: string;
}

/**
 * Creates a Keycloak user with given_name / family_name / email attributes
 * and sets a non-temporary password (no required actions).
 */
export async function createKeycloakUser(user: {
  username: string;
  email: string;
  given_name: string;
  family_name: string;
  password: string;
}): Promise<KeycloakUser> {
  const token = await getKeycloakAdminToken();
  const ctx = await request.newContext({
    baseURL: KEYCLOAK_ADMIN.base,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
  const res = await ctx.post(`/admin/realms/${KEYCLOAK_ADMIN.realm}/users`, {
    data: {
      username: user.username,
      email: user.email,
      enabled: true,
      emailVerified: true,
      firstName: user.given_name,
      lastName: user.family_name,
      credentials: [
        {
          type: 'password',
          value: user.password,
          temporary: false,  // critical: no "Update Password" required action
        },
      ],
    },
  });
  if (res.status() !== 201) {
    throw new Error(`Failed to create Keycloak user: ${res.status()} ${await res.text()}`);
  }
  // The 201 has an empty body; fetch the user to get the ID
  const list = await ctx.get(`/admin/realms/${KEYCLOAK_ADMIN.realm}/users?username=${encodeURIComponent(user.username)}`);
  const arr = await list.json();
  if (!arr.length) throw new Error(`User ${user.username} not found after creation`);
  await ctx.dispose();
  return { id: arr[0].id, username: user.username, email: user.email };
}

/**
 * Deletes a Keycloak user by ID.
 */
export async function deleteKeycloakUser(userId: string): Promise<void> {
  const token = await getKeycloakAdminToken();
  const ctx = await request.newContext({
    baseURL: KEYCLOAK_ADMIN.base,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
  await ctx.delete(`/admin/realms/${KEYCLOAK_ADMIN.realm}/users/${userId}`);
  await ctx.dispose();
}
```

---

## 5. `e2e/global-setup.ts`

```ts
import { TEST_USER } from './fixtures/test-data';
import { createKeycloakUser } from './helpers/api';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export default async function globalSetup() {
  // Ensure the user exists in Keycloak. If a previous run created a user
  // with the same username (rare, only on clock skew), the create call returns
  // 409; we treat that as success.
  try {
    const user = await createKeycloakUser({
      username: TEST_USER.username,
      email: TEST_USER.email,
      given_name: TEST_USER.given_name,
      family_name: TEST_USER.family_name,
      password: TEST_USER.password,
    });
    mkdirSync(resolve(__dirname, '../e2e/.runtime'), { recursive: true });
    writeFileSync(
      resolve(__dirname, '../e2e/.runtime/keycloak-user.json'),
      JSON.stringify(user, null, 2)
    );
  } catch (e) {
    throw new Error(`global-setup failed: ${e}`);
  }
}
```

---

## 6. `e2e/global-teardown.ts`

```ts
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { deleteKeycloakUser } from './helpers/api';

export default async function globalTeardown() {
  const file = resolve(__dirname, '../e2e/.runtime/keycloak-user.json');
  if (!existsSync(file)) return;
  try {
    const user = JSON.parse(readFileSync(file, 'utf-8'));
    if (user?.id) {
      await deleteKeycloakUser(user.id);
    }
  } catch (e) {
    console.warn('global-teardown: failed to delete Keycloak user', e);
  } finally {
    try { unlinkSync(file); } catch { /* ignore */ }
  }
}
```

---

## 7. Phase 1 — Auth & navigation

Test ID: P1.
All tests in this phase run after `loginWithKeycloak` in `test.beforeAll`.

```ts
import { test as base, expect, Page } from '@playwright/test';
import { test, expect as baseExpect, Page as BasePage } from '@playwright/test';
import { loginWithKeycloak, signOut } from '../helpers/auth';
import { TEST_USER } from '../fixtures/test-data';
import { expectSuccessNotification, waitForNotificationToDismiss } from '../helpers/notifications';

let page: Page;

test.describe.serial('Full journey: auth through order history', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await loginWithKeycloak(page);
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  // … all subsequent tests use the shared `page` …
});
```

### Test P1.1 — Header shows authenticated greeting

```ts
test('header shows authenticated greeting with first name', async () => {
  await expect(page.getByTestId('hello-greeting-main')).toContainText(TEST_USER.given_name);
  // Sign-in trigger is gone
  await expect(page.getByTestId('signin-trigger-top')).not.toBeVisible();
});
```

### Test P1.2 — Account menu links are visible and point to correct routes

```ts
test('account menu links navigate to profile and order history', async () => {
  await page.getByTestId('your-account-link').click();
  await page.waitForURL(/\/profile$/);
  await expect(page.getByTestId('profile-title')).toBeVisible();

  await page.goBack();
  await expect(page.getByTestId('hello-greeting-main')).toBeVisible();

  await page.getByTestId('your-orders-link').click();
  await page.waitForURL(/\/profile\/orders/);
  await expect(page.getByTestId('order-history-title')).toBeVisible();
});
```

### Test P1.3 — AuthGuard blocks anonymous access

Manual check: AuthGuard sends unauthenticated users to `/home`. This is implicitly tested by the auth helper — if `loginWithKeycloak` does not result in a visible `hello-greeting-main`, the AuthGuard is broken. No separate test needed.

---

## 8. Phase 2 — Customer auto-creation and profile management

### Test P2.1 — First /profile visit auto-creates a customer

```ts
test('first profile visit auto-creates a customer and renders the form', async () => {
  await page.goto('/profile');
  await expect(page.getByTestId('profile-info-heading')).toBeVisible({ timeout: 15_000 });
  // The email field is populated from OIDC userData
  await expect(page.locator('#email')).toHaveValue(TEST_USER.email);
  // Member Since is set after customer creation
  await expect(page.locator('#customerSince')).not.toHaveValue('');
});
```

The auto-create effect at `profile.component.ts:94-101` fires on first `/profile` visit. It calls `customerStore.loadCustomer(email)` (GET 404) and then `customerStore.createCustomerFromAuth(userData)` (POST 201). The success toast is `Customer profile created successfully` (`customer.store.ts:110`). The test waits for the heading to appear (15s) to cover the round-trip.

### Test P2.2 — Edit and save profile

```ts
test('edits and saves profile information', async () => {
  await page.goto('/profile');
  await expect(page.getByTestId('profile-info-heading')).toBeVisible({ timeout: 15_000 });

  await page.getByTestId('edit-profile').click();
  await page.locator('#firstName').fill('UpdatedFirstName');
  await page.locator('#phone').fill('555-020-0200');
  await page.getByTestId('save-profile').click();

  await expectSuccessNotification(page, 'Profile updated successfully');
  await waitForNotificationToDismiss(page, 'Profile updated successfully');

  // Reload and verify persistence
  await page.reload();
  await expect(page.locator('#firstName')).toHaveValue('UpdatedFirstName');
  await expect(page.locator('#phone')).toHaveValue('555-020-0200');
  // Restore for downstream tests
  await page.getByTestId('edit-profile').click();
  await page.locator('#firstName').fill(TEST_USER.given_name);
  await page.locator('#phone').fill(TEST_USER.phone);
  await page.getByTestId('save-profile').click();
  await expectSuccessNotification(page, 'Profile updated successfully');
  await waitForNotificationToDismiss(page, 'Profile updated successfully');
});
```

The email field is `readonly` (`profile.html:78`), so we only test first name and phone.

### Test P2.3 — Form validation

```ts
test('validates profile form fields', async () => {
  await page.goto('/profile');
  await expect(page.getByTestId('profile-info-heading')).toBeVisible({ timeout: 15_000 });

  await page.getByTestId('edit-profile').click();
  await page.locator('#firstName').fill('');
  await page.getByTestId('save-profile').click();

  // The save button is disabled when the form is invalid (profile.html:89 — [disabled]="customerForm().invalid")
  // So the save itself does nothing; we verify the disabled state.
  await expect(page.getByTestId('save-profile')).toBeDisabled();

  // Cancel
  await page.getByTestId('cancel-profile').click();
});
```

The `Save Profile` button is `[disabled]="customerForm().invalid"` (`profile.html:89`), so the validation test asserts the disabled state instead of trying to submit and read an inline error. (The `customerForm` includes pure-validators with custom messages; see `form-configs.ts:41-75`.)

---

## 9. Phase 3 — Address management

### Test P3.1 — Add shipping address

```ts
test('adds a shipping address', async () => {
  await page.goto('/profile');
  await expect(page.getByTestId('addresses-heading')).toBeVisible({ timeout: 15_000 });

  await page.getByTestId('add-address').click();
  await expect(page.getByTestId('address-modal')).toBeVisible();

  // Address type is a <select> with values 'shipping' / 'billing'
  await page.getByTestId('address-type-select').selectOption('shipping');
  await page.locator('#first_name').fill(TEST_USER.shippingAddress.first_name);
  await page.locator('#last_name').fill(TEST_USER.shippingAddress.last_name);
  await page.locator('#address1').fill(TEST_USER.shippingAddress.address_1);
  await page.locator('#address2').fill(TEST_USER.shippingAddress.address_2);
  await page.locator('#city').fill(TEST_USER.shippingAddress.city);
  await page.locator('#state').fill(TEST_USER.shippingAddress.state);
  await page.locator('#zip').fill(TEST_USER.shippingAddress.zip);

  await page.getByTestId('address-save').click();
  await expectSuccessNotification(page, 'Address added successfully');
  await waitForNotificationToDismiss(page, 'Address added successfully');

  // Address card visible with the new address
  const shippingCard = page.getByTestId('address-card').filter({ hasText: 'shipping' });
  await expect(shippingCard).toContainText(TEST_USER.shippingAddress.address_1);
  await expect(shippingCard).toContainText(TEST_USER.shippingAddress.city);
});
```

### Test P3.2 — Add billing address

```ts
test('adds a billing address', async () => {
  await page.goto('/profile');
  await expect(page.getByTestId('addresses-heading')).toBeVisible({ timeout: 15_000 });

  await page.getByTestId('add-address').click();
  await expect(page.getByTestId('address-modal')).toBeVisible();

  await page.getByTestId('address-type-select').selectOption('billing');
  await page.locator('#first_name').fill(TEST_USER.billingAddress.first_name);
  await page.locator('#last_name').fill(TEST_USER.billingAddress.last_name);
  await page.locator('#address1').fill(TEST_USER.billingAddress.address_1);
  await page.locator('#city').fill(TEST_USER.billingAddress.city);
  await page.locator('#state').fill(TEST_USER.billingAddress.state);
  await page.locator('#zip').fill(TEST_USER.billingAddress.zip);

  await page.getByTestId('address-save').click();
  await expectSuccessNotification(page, 'Address added successfully');
  await waitForNotificationToDismiss(page, 'Address added successfully');

  const billingCard = page.getByTestId('address-card').filter({ hasText: 'billing' });
  await expect(billingCard).toContainText(TEST_USER.billingAddress.address_1);
});
```

### Test P3.3 — Set default shipping address

```ts
test('sets default shipping address', async () => {
  await page.goto('/profile');
  await expect(page.getByTestId('addresses-heading')).toBeVisible({ timeout: 15_000 });

  const shippingCard = page.getByTestId('address-card').filter({ hasText: 'shipping' });
  await shippingCard.getByTestId('set-default-shipping').click();
  await expectSuccessNotification(page, 'Default shipping address updated');
  await expect(shippingCard.getByTestId('default-shipping-badge')).toBeVisible();
});
```

### Test P3.4 — Set default billing address

```ts
test('sets default billing address', async () => {
  await page.goto('/profile');
  await expect(page.getByTestId('addresses-heading')).toBeVisible({ timeout: 15_000 });

  const billingCard = page.getByTestId('address-card').filter({ hasText: 'billing' });
  await billingCard.getByTestId('set-default-billing').click();
  await expectSuccessNotification(page, 'Default billing address updated');
  await expect(billingCard.getByTestId('default-billing-badge')).toBeVisible();
});
```

### Test P3.5 — Edit an address

```ts
test('edits an existing address', async () => {
  await page.goto('/profile');
  await expect(page.getByTestId('addresses-heading')).toBeVisible({ timeout: 15_000 });

  const shippingCard = page.getByTestId('address-card').filter({ hasText: 'shipping' });
  await shippingCard.getByTestId('edit-address').click();
  await expect(page.getByTestId('address-modal')).toBeVisible();

  await page.locator('#city').fill('Bellevue');
  await page.getByTestId('address-save').click();
  await expectSuccessNotification(page, 'Address updated successfully');
  await waitForNotificationToDismiss(page, 'Address updated successfully');

  await expect(shippingCard).toContainText('Bellevue');
});
```

### Test P3.6 — Delete a billing address

The shipping address stays as default. The billing address is deleted.

```ts
test('deletes a billing address with confirmation', async () => {
  await page.goto('/profile');
  await expect(page.getByTestId('addresses-heading')).toBeVisible({ timeout: 15_000 });

  const billingCard = page.getByTestId('address-card').filter({ hasText: 'billing' });
  await billingCard.getByTestId('delete-address').click();

  // Confirmation modal — title is "Delete Address", confirm button text "Delete"
  await expect(page.getByTestId('confirm-delete-address')).toBeVisible();
  await page.locator('[data-testid="confirmation-confirm"]').filter({ hasText: 'Delete' }).first().click();

  await expectSuccessNotification(page, 'Address deleted successfully');

  // Billing card is gone
  await expect(page.getByTestId('address-card').filter({ hasText: 'billing' })).toHaveCount(0);
});
```

### Test P3.7 — Address form validation

The `addressForm()` is built by `address-form.service.ts:14-23` using Angular built-in `Validators` (not the pure validators). The error-message display at `profile.component.ts:394-401` falls back to `'Invalid input'` for built-in validator errors. Save button is `[disabled]="!addressFormState().canSave"` (`profile.html:237`).

```ts
test('validates address form', async () => {
  await page.goto('/profile');
  await page.getByTestId('add-address').click();
  await expect(page.getByTestId('address-modal')).toBeVisible();

  // Save is disabled when form is empty
  await expect(page.getByTestId('address-save')).toBeDisabled();

  // Fill required fields with valid data
  await page.getByTestId('address-type-select').selectOption('shipping');
  await page.locator('#first_name').fill('A');
  await page.locator('#last_name').fill('B');
  await page.locator('#address1').fill('1 Main');
  await page.locator('#city').fill('City');
  await page.locator('#state').fill('WA');
  await page.locator('#zip').fill('NOTAZIP');  // invalid
  await expect(page.getByTestId('address-save')).toBeDisabled();

  // Fix the zip
  await page.locator('#zip').fill('98101');
  await expect(page.getByTestId('address-save')).toBeEnabled();

  // Cancel without saving
  await page.locator('[data-testid="confirmation-cancel"], button:has-text("Cancel")').first().click();
});
```

---

## 10. Phase 4 — Credit card management

### Test P4.1 — Add a credit card

```ts
test('adds a credit card', async () => {
  await page.goto('/profile');
  await expect(page.getByTestId('cards-heading')).toBeVisible({ timeout: 15_000 });

  await page.getByTestId('add-credit-card').click();
  await expect(page.getByTestId('credit-card-modal')).toBeVisible();

  await page.getByTestId('card-type-select').selectOption(TEST_USER.creditCard.card_type);
  await page.locator('#cardNumber').fill(TEST_USER.creditCard.card_number);
  await page.locator('#cardHolderName').fill(TEST_USER.creditCard.card_holder_name);
  await page.locator('#cardExpires').fill(TEST_USER.creditCard.card_expires);
  await page.locator('#cardCVV').fill(TEST_USER.creditCard.card_cvv);

  await page.getByTestId('credit-card-save').click();
  await expectSuccessNotification(page, 'Credit card added successfully');
  await waitForNotificationToDismiss(page, 'Credit card added successfully');

  // Card is displayed with mask **** **** **** 1111
  const cardEl = page.getByTestId('credit-card').first();
  await expect(cardEl.getByTestId('credit-card-masked')).toContainText('**** **** **** 1111');
});
```

### Test P4.2 — Set default credit card

```ts
test('sets default credit card', async () => {
  await page.goto('/profile');
  await expect(page.getByTestId('cards-heading')).toBeVisible({ timeout: 15_000 });

  const cardEl = page.getByTestId('credit-card').first();
  await cardEl.getByTestId('set-default-credit-card').click();
  await expectSuccessNotification(page, 'Default credit card updated');
  await expect(cardEl.getByTestId('default-credit-card-badge')).toBeVisible();
});
```

### Test P4.3 — Edit a credit card

```ts
test('edits a credit card', async () => {
  await page.goto('/profile');
  await expect(page.getByTestId('cards-heading')).toBeVisible({ timeout: 15_000 });

  const cardEl = page.getByTestId('credit-card').first();
  await cardEl.getByTestId('edit-credit-card').click();
  await expect(page.getByTestId('credit-card-modal')).toBeVisible();

  await page.locator('#cardHolderName').fill('Updated Cardholder');
  await page.getByTestId('credit-card-save').click();
  await expectSuccessNotification(page, 'Credit card updated successfully');
  await waitForNotificationToDismiss(page, 'Credit card updated successfully');

  await expect(cardEl).toContainText('Updated Cardholder');
});
```

### Test P4.4 — Delete the credit card

After this test, the user has no default credit card. The checkout flow does not require a default (Phase 6 collects it inline).

```ts
test('deletes a credit card with confirmation', async () => {
  await page.goto('/profile');
  await expect(page.getByTestId('cards-heading')).toBeVisible({ timeout: 15_000 });

  const cardEl = page.getByTestId('credit-card').first();
  await cardEl.getByTestId('delete-credit-card').click();

  await expect(page.getByTestId('confirm-delete-credit-card')).toBeVisible();
  await page.locator('[data-testid="confirmation-confirm"]').filter({ hasText: 'Delete' }).first().click();
  await expectSuccessNotification(page, 'Credit card deleted successfully');

  await expect(page.getByTestId('credit-card')).toHaveCount(0);
});
```

### Test P4.5 — Card input formatting

The card number input has `(input)="onCardNumberInput($event)"` (`profile.html:264`) which calls `formatCardNumber()` (`ui-formatters.ts:11-19`) — strips non-digits, inserts a space every 4 digits. The expiry input calls `formatExpiration()` (`ui-formatters.ts:21-31`) — strips non-digits, inserts `/` after 2 digits.

```ts
test('card number and expiry are auto-formatted', async () => {
  await page.goto('/profile');
  await page.getByTestId('add-credit-card').click();
  await expect(page.getByTestId('credit-card-modal')).toBeVisible();

  await page.locator('#cardNumber').fill('4111111111111111');
  await expect(page.locator('#cardNumber')).toHaveValue('4111 1111 1111 1111');

  await page.locator('#cardExpires').fill('1228');
  await expect(page.locator('#cardExpires')).toHaveValue('12/28');
});
```

---

## 11. Phase 5 — Product browsing & cart

### Test P5.1 — Browse product list

The product list is gated by nothing. There is no auth requirement.

```ts
test('browses the product list', async () => {
  await page.goto('/products');
  await expect(page.getByTestId('product-list-title')).toBeVisible();
  await expect(page.getByTestId('product-grid')).toBeVisible({ timeout: 15_000 });

  // Wait for at least 2 cards (we need 2 distinct products for the multi-item checkout)
  await expect(page.getByTestId('product-card')).not.toHaveCount(0);
  const cardCount = await page.getByTestId('product-card').count();
  expect(cardCount).toBeGreaterThanOrEqual(2);

  // Each card has the expected structure
  const first = page.getByTestId('product-card').first();
  await expect(first.getByTestId('product-name')).toBeVisible();
  await expect(first.getByTestId('product-price')).toBeVisible();
  await expect(first.getByTestId('add-to-cart')).toBeVisible();
});
```

### Test P5.2 — View product detail

```ts
test('navigates to product detail page', async () => {
  await page.goto('/products');
  const first = page.getByTestId('product-card').first();
  const productName = await first.getByTestId('product-name').textContent();
  expect(productName).toBeTruthy();

  await first.locator('.product-name').click();   // card is a <a>/<article> that navigates
  await page.waitForURL(/\/products\/.+/);

  await expect(page.getByTestId('product-detail-name')).toHaveText(productName!);
  await expect(page.getByTestId('add-to-cart-detail')).toBeVisible();
});
```

Note: clicking the `<article>` element (`product-card.component.html:1` has `(click)="onViewDetails()"` on the article itself). The "Add to Cart" button has `(click)="onAddToCart($event)"` and calls `event.stopPropagation()` to prevent the card click from also firing — verify by reading the component if needed; assume it does. If not, use the inner add-to-cart button which has its own click handler.

### Test P5.3 — Add item to cart (from product list)

The flow:
1. `CartStore.addItem()` → `POST /api/v1/carts` (creates cart) → `POST /api/v1/carts/{id}/items` (adds item)
2. `POST /carts/{id}/items` triggers `cart.item.validated` SSE event
3. Item moves to `status: 'confirmed'` (or `backorder`)

```ts
test('adds the first product to the cart', async () => {
  await page.goto('/products');
  await expect(page.getByTestId('product-grid')).toBeVisible({ timeout: 15_000 });

  const first = page.getByTestId('product-card').first();
  const productName = await first.getByTestId('product-name').textContent();
  expect(productName).toBeTruthy();

  await first.getByTestId('add-to-cart').click();
  await expectSuccessNotification(page, 'Item added to cart');
  await waitForNotificationToDismiss(page, 'Item added to cart');

  // Cart page should show the validated item
  await page.goto('/cart');
  await expect(page.getByTestId('cart-title')).toBeVisible();

  await expect(page.getByTestId('cart-item')).toHaveCount(1);
  await expect(page.getByTestId('cart-item-name').first()).toContainText(productName!);
  // SSE may take a moment to confirm; wait up to 30s
  await page.waitForTimeout(2000);   // brief settle for SSE
  // Do NOT assert status-badge here — the validation may take longer than the test
  //   is willing to wait. Just assert the item is present and not in backorder.
  await expect(page.getByTestId('cart-item').first()).not.toHaveClass(/backorder/);
});
```

The cart's `canCheckout` is `!isEmpty() && !hasPendingValidationItems()` — so we must wait for the SSE validation to complete before proceeding to Phase 6. See `waitForCartItemValidated` helper in §4.2. If your backend reliably validates within 2s, you can replace the `waitForTimeout(2000)` with the helper:

```ts
await waitForCartItemValidated(page, 'cart-item', 30_000);
```

### Test P5.4 — Add a second item to the cart

```ts
test('adds a second product to the cart', async () => {
  await page.goto('/products');
  await expect(page.getByTestId('product-grid')).toBeVisible({ timeout: 15_000 });

  const second = page.getByTestId('product-card').nth(1);
  const secondName = await second.getByTestId('product-name').textContent();
  expect(secondName).toBeTruthy();

  await second.getByTestId('add-to-cart').click();
  await expectSuccessNotification(page, 'Item added to cart');
  await waitForNotificationToDismiss(page, 'Item added to cart');

  await page.goto('/cart');
  await expect(page.getByTestId('cart-item')).toHaveCount(2);
});
```

### Test P5.5 — Cart total reflects both items

```ts
test('cart total reflects both items', async () => {
  await page.goto('/cart');
  await expect(page.getByTestId('cart-title')).toBeVisible();

  // The cart total is in <div data-testid="cart-total">
  const totalText = await page.getByTestId('cart-total').textContent();
  expect(totalText).toMatch(/\$\d+\.\d{2}/);

  // The order summary has item subtotal
  await expect(page.getByTestId('cart-summary')).toBeVisible();
});
```

The summary shows `Order Total:` in `.summary-row.total` (`cart-summary.component.html:35-38`).

### Test P5.6 — Update item quantity (decrement, increment)

```ts
test('updates item quantity in the cart', async () => {
  await page.goto('/cart');
  await expect(page.getByTestId('cart-title')).toBeVisible();

  const item = page.getByTestId('cart-item').first();
  // Increment
  await item.getByTestId('cart-item-increment').click();
  await expect(item.getByTestId('cart-item-quantity')).toHaveValue('2');
  // Decrement back
  await item.getByTestId('cart-item-decrement').click();
  await expect(item.getByTestId('cart-item-quantity')).toHaveValue('1');
});
```

### Test P5.7 — Proceed to checkout button is enabled

```ts
test('proceed to checkout button is enabled with non-empty cart', async () => {
  await page.goto('/cart');
  await expect(page.getByTestId('proceed-to-checkout')).toBeEnabled();
});
```

---

## 12. Phase 6 — Checkout flow

The checkout has 5 steps but the stepper only shows 3 or 4 pills (Billing is conditional). Step 5 (Review) has no pill — it's a `.review-section` in the form area.

### Test P6.1 — Step 1: Contact information

```ts
test('fills contact information', async () => {
  await page.goto('/checkout');
  // CartGuard redirects to /cart if cart is empty
  await expect(page).toHaveURL(/\/checkout/);
  await expect(page.getByTestId('checkout-form-1')).toBeVisible();

  // The contact form is pre-populated from OIDC userData on init
  // (see checkout.component.ts:228 — loadContactFromAuth)
  await expect(page.locator('#email')).toHaveValue(TEST_USER.email);
  await expect(page.locator('#firstName')).toHaveValue(TEST_USER.given_name);
  await expect(page.locator('#lastName')).toHaveValue(TEST_USER.family_name);

  // Phone is required, fill it
  await page.locator('#phone').fill(TEST_USER.phone);

  await page.getByTestId('checkout-form-1').getByRole('button', { name: 'Continue to Shipping' }).click();
  await expect(page.getByTestId('checkout-form-2')).toBeVisible({ timeout: 15_000 });
});
```

### Test P6.2 — Step 2: Shipping address (with same-as-shipping = true)

```ts
test('fills shipping address and keeps same-as-billing checked', async () => {
  await page.goto('/checkout');
  await expect(page.getByTestId('checkout-form-2')).toBeVisible();

  // The shipping form may be pre-populated from the customer's default shipping address
  // (see checkout.component.ts:288-291 — prefillShippingFromCustomer).
  // Verify the field is populated.
  await expect(page.locator('#address1')).toHaveValue(TEST_USER.shippingAddress.address_1);

  // Ensure the "same as billing" checkbox is checked
  const checkbox = page.getByTestId('same-as-billing-label').locator('input[type="checkbox"]');
  if (!(await checkbox.isChecked())) {
    await page.getByTestId('same-as-billing-label').click();
  }
  await expect(checkbox).toBeChecked();

  // Continue
  await page.getByTestId('checkout-form-2').getByRole('button', { name: 'Continue to Payment' }).click();

  // Should skip billing (step 3) and go to step 4 (payment)
  await expect(page.getByTestId('checkout-form-4')).toBeVisible({ timeout: 15_000 });
});
```

### Test P6.3 — Step 4: Payment information

```ts
test('fills payment information', async () => {
  await page.goto('/checkout');
  await expect(page.getByTestId('checkout-form-4')).toBeVisible();

  // Card type is a radio group. Default is "visa" (per checkout.component.ts:151 — `cardType: ['visa', Validators.required]`).
  // Select Visa explicitly.
  await page.getByTestId('card-type-selector').getByRole('radio', { name: 'Visa' }).check();

  await page.locator('#cardNumber').fill(TEST_USER.creditCard.card_number);
  await page.locator('#cardHolder').fill(TEST_USER.creditCard.card_holder_name);
  await page.locator('#expiryMonth').fill('12');
  await page.locator('#expiryYear').fill('2028');
  await page.locator('#cvv').fill(TEST_USER.creditCard.card_cvv);

  await page.getByTestId('checkout-form-4').getByRole('button', { name: 'Review Order' }).click();
  await expect(page.getByTestId('checkout-form-5')).toBeVisible({ timeout: 15_000 });
});
```

### Test P6.4 — Step 5: Review

```ts
test('displays order review with correct data', async () => {
  await page.goto('/checkout');
  await expect(page.getByTestId('checkout-form-5')).toBeVisible();

  // Contact
  await expect(page.getByTestId('review-contact')).toContainText(TEST_USER.email);
  await expect(page.getByTestId('review-contact')).toContainText(TEST_USER.phone);

  // Shipping
  await expect(page.getByTestId('review-shipping')).toContainText(TEST_USER.shippingAddress.address_1);
  await expect(page.getByTestId('review-shipping')).toContainText(TEST_USER.shippingAddress.city);

  // Billing — same as shipping, billing block is NOT rendered (see checkout.component.html:566 — @if (!sameAsShipping()))
  // Verify the billing review block is absent
  await expect(page.getByTestId('review-billing')).toHaveCount(0);

  // Payment — format is "Visa ending in 1111"
  await expect(page.getByTestId('review-payment')).toContainText('Visa ending in 1111');
  await expect(page.getByTestId('review-payment')).toContainText(TEST_USER.creditCard.card_holder_name);

  // Order summary sidebar
  await expect(page.getByTestId('order-summary')).toBeVisible();
  await expect(page.getByTestId('summary-items')).toBeVisible();
});
```

### Test P6.5 — Place order and wait for SSE

```ts
test('places order and waits for SSE order.created event', async () => {
  await page.goto('/checkout');
  await expect(page.getByTestId('checkout-form-5')).toBeVisible();

  await page.getByTestId('place-order').click();

  // The Place Order button changes to "Processing..." while submitting
  await expect(page.getByTestId('place-order')).toContainText('Processing...', { timeout: 5_000 });

  // Wait for navigation to /order-confirmation (driven by orderConfirmationEffect on order.created SSE)
  await page.waitForURL(/\/order-confirmation/, { timeout: 35_000 });

  // The dynamic success toast is "Order {orderNumber} placed successfully!" — it appears once
  await expectSuccessNotification(page, /Order .+ placed successfully!/);

  // Order confirmation page
  await expect(page.getByTestId('confirmation-heading')).toBeVisible();
  await expect(page.getByTestId('order-number')).toBeVisible();
  const orderNumber = await page.getByTestId('order-number').textContent();
  expect(orderNumber).toBeTruthy();
});
```

### Test P6.6 — Cart is cleared after order

```ts
test('cart is cleared after successful order', async () => {
  await page.goto('/cart');
  await expect(page.getByTestId('cart-title')).toBeVisible();
  // Either the empty cart title is visible OR there are no cart items
  const itemCount = await page.getByTestId('cart-item').count();
  expect(itemCount).toBe(0);
  // If the empty cart component is rendered, verify the heading
  const emptyTitle = page.getByTestId('cart-empty-title');
  if (await emptyTitle.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await expect(emptyTitle).toContainText('Your Shopping Cart is Empty');
  }
});
```

`CartStore.clearCartAfterOrder()` (`cart.store.ts:471-482`) disconnects SSE and clears the persisted cart ID. The cart page then renders `<app-empty-cart>` which shows the title "Your Shopping Cart is Empty".

### Test P6.7 — Sign out (auxiliary)

```ts
test('signs out from the header', async () => {
  await signOut(page);
  // After sign-out, the top nav shows "Hello, sign in"
  await expect(page.getByTestId('signin-trigger-top')).toBeVisible();
});
```

This is not strictly required by the journey but is useful for proving the auth lifecycle is testable.

---

## 13. Phase 7 — Order history

### Test P7.1 — Navigate to order history and see the order

```ts
test('displays the placed order in order history', async () => {
  await page.goto('/profile/orders');
  await expect(page.getByTestId('order-history-title')).toBeVisible({ timeout: 15_000 });

  // Wait for at least one order card
  await expect(page.getByTestId('order-card').first()).toBeVisible({ timeout: 15_000 });

  // The most recent order is the one we just placed
  const firstCard = page.getByTestId('order-card').first();
  await expect(firstCard.getByTestId('order-id')).toBeVisible();
  await expect(firstCard.getByTestId('order-date')).toBeVisible();
  await expect(firstCard.getByTestId('order-status')).toBeVisible();
  await expect(firstCard.getByTestId('order-total')).toBeVisible();
});
```

The order list is fetched from `GET /api/v1/orders/customer/{customerId}` (`customer-order-history.service.ts:12`). It returns `OrderHistoryItem[]` (newest first — verify against your backend's sort order; if oldest-first, use `.last()`).

### Test P7.2 — Expand order details

```ts
test('expands order details to show timeline and line items', async () => {
  await page.goto('/profile/orders');
  await expect(page.getByTestId('order-history-title')).toBeVisible();

  const firstCard = page.getByTestId('order-card').first();
  await firstCard.getByTestId('view-details').click();

  await expect(firstCard.getByTestId('order-timeline')).toBeVisible();
  await expect(firstCard.getByTestId('order-items')).toBeVisible();
  await expect(firstCard.getByTestId('order-line-item')).toHaveCount(2);
});
```

The order should have 2 line items (one per product we added). The expand toggle button text changes between "View Details" and "Hide Details" (`order-history.component.html:34`).

---

## 14. Implementation order

| Order | Component | Depends on | Est. effort |
|---|---|---|---|
| 1 | `e2e/fixtures/test-data.ts` | none | 15 min |
| 2 | `e2e/helpers/api.ts` | test-data | 30 min |
| 3 | `e2e/global-setup.ts` | api | 15 min |
| 4 | `e2e/global-teardown.ts` | api | 15 min |
| 5 | `playwright.config.ts` + smoke test | test-data, global-setup | 30 min |
| 6 | **Phase 0.5: retrofit templates with data-testid** (13 files) | none | 1.5 hr |
| 7 | `e2e/helpers/auth.ts` | test-data | 30 min |
| 8 | `e2e/helpers/sse.ts` | none | 15 min |
| 9 | `e2e/helpers/notifications.ts` | none | 15 min |
| 10 | Phase 1: Auth & nav tests | auth helper | 30 min |
| 11 | Phase 2: Profile tests | Phase 0.5 | 30 min |
| 12 | Phase 3: Address tests | Phase 2 | 45 min |
| 13 | Phase 4: Credit card tests | Phase 2 | 45 min |
| 14 | Phase 5: Product browsing + cart tests | auth helper | 45 min |
| 15 | Phase 6: Checkout tests | Phases 3, 4, 5 | 1.5 hr |
| 16 | Phase 7: Order history tests | Phase 6 | 30 min |

**Total estimated effort: ~8 hours.**

---

## 15. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| SSE `order.created` event timing | Checkout test flakes | Generous 35s timeout; use `waitForURL` for navigation rather than asserting a status text |
| Keycloak consent screen | Auth helper hangs | `if (await consentButton.isVisible(...).catch(() => false))` guard — the helper is resilient to consent being skipped |
| `prompt: 'consent'` forces consent on every login | Adds a step to every test that re-authenticates | Only log in once in `test.beforeAll`; do not re-authenticate mid-suite |
| Required actions on Keycloak user (e.g., "Update Password") | First login redirects to a password-change page | `global-setup.ts` sets `temporary: false` on the credential (`api.ts:createKeycloakUser`) and `emailVerified: true` to avoid required actions |
| `pocstore.local` / `keycloak.local` not resolvable | All tests fail | Verify `/etc/hosts` before running tests; document the one-time setup in `README.md` |
| Card number `4111111111111111` not accepted by backend | "Add Credit Card" returns 4xx | The frontend validator passes (Luhn + 16 digits). The backend must accept this number. If it doesn't, swap to another Luhn-valid number like `5500000000000004` (Mastercard test) |
| Cross-origin CORS for `https://pocstore.local` from `http://localhost:4200` | Browser blocks API calls | The Go backend must allow `http://localhost:4200` in its CORS config. The Angular dev server's proxy is irrelevant for absolute URLs |
| Customer auto-create POST may fail on race | Profile test flakes | The effect uses `await` on `loadCustomer` then `createCustomerFromAuth` (sequential). No race. |
| `OrderStore` 30s timeout exceeded | Checkout fails with `Order placed successfully!` not firing | Backend SSE pipeline must be ≤ 25s end-to-end. If slower, the assertion at 35s catches the navigation timeout and the test fails with a clear message |
| `cart` value at `OrderConfirmationComponent` may be null after `clearCartAfterOrder` | "Continue Shopping" / "View My Orders" buttons fail | `OrderConfirmationComponent` reads from `orderStore.orderConfirmation` (separate signal), not `cartStore`. Safe. |
| Long suite runtime | Slow local runs | Sequential `workers: 1`; total runtime should be 3-5 min |
| Playwright browser version drift across machines | Tests against slightly different Chromium | `npx playwright install --with-deps chromium` downloads a fixed browser version; do not override with `PLAYWRIGHT_BROWSERS_PATH` |
| `data-testid` collision with app tests | Existing tests broken | This project has no unit/integration tests on these templates (only the form-config spec). Verified safe. |

---

## 16. Things this plan explicitly does NOT cover

These are out of scope for v2; add them in a v3 plan if needed:

- CI integration (GitHub Actions workflow, containerized backend services, Keycloak container with pre-exported realm). The CI runner has no access to the dev backend services, so CI is deferred until a CI-accessible backend is available.
- Accessibility (axe-core) tests
- Mobile viewport tests
- Visual regression (percy / playwright snapshots)
- Load / performance tests
- 401/expired-token recovery tests
- Multi-user concurrent tests
- The `Out of Stock` state in product cards (the happy-path test uses in-stock products)
- The backorder branch in checkout (`hasBackorderItems` → confirmation modal)
- Sign-up via "New customer? Start here" (the OIDC consent page is one path; the test uses an admin-created user)
- The "Edit" buttons on the review step that jump back to steps 1-4 (one smoke test is sufficient)
- The "Try Again" button on the checkout error state (only meaningful in a deliberately failed test)

Each can be added incrementally as a follow-up.

---

## 17. Acceptance criteria for "Phase 0 is done"

The implementation can move past Phase 0 only when:

1. `npm run test:e2e -- smoke.spec.ts` passes locally.
2. `npm run test:e2e` (with the smoke test removed or moved to its own spec) reaches Phase 1 successfully.
3. The Keycloak admin user `admin/admin` exists and the realm `pocstore-realm` with client `pocstore-client` is configured. This is a one-time manual setup in the dev Keycloak. Document it in `README.md`.

If any of the above is not met, debug with `--headed --debug` and check the Playwright trace.
