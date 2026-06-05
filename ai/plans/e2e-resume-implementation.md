# E2E Implementation Resume

**Plan:** `ai/plans/e2e-testing-plan-v2.md` (vetted, do not re-verify)
**Spec file:** `e2e/specs/full-journey.spec.ts` (single sequential file, 29 tests, `test.describe.serial()`)
**Last test run:** 2026-06-04 21:21 — **27 passed, 1 failed, 2 did not run** (full suite, ~1.7 min)

## Status: 27 / 29 tests passing. Blocked on Phase 7.

Phases 0–6 are complete and green. Phase 7 (order history) is blocked by a **backend bug**, not a test issue. The order placement in P6 succeeds — the order number is captured on `/order-confirmation` and `P6.6` confirms the cart is cleared. The failure is downstream: the placed order is persisted with a **blank/null `customer_id`**, so the order history query `GET /api/v1/orders/customer/{customerId}` returns an empty array for the current customer, and the page renders the empty state (`"No orders yet - now is a great time to start!"`).

Evidence: `test-results/full-journey-Full-journey--1c1c8-ry-and-see-the-placed-order-chromium/test-failed-1.png` shows the dropdown open with `Hello, E2E`, the page title `Order History`, and the empty state message — no error, no card.

## What's done

| Phase | Tests | Status | Notes |
|---|---|---|---|
| 0 — Setup | (config + helpers) | done | `playwright.config.ts`, `e2e/helpers/{auth,sse,notifications,api}.ts`, `global-setup.ts`, `global-teardown.ts`, `e2e/fixtures/test-data.ts`, `e2e/specs/smoke.spec.ts`. TLS fixes applied (`NODE_TLS_REJECT_UNAUTHORIZED=0` at top of `helpers/api.ts` before imports; `ignoreHTTPSErrors: true` in config). |
| 0.5 — testid retrofit | (template changes) | done | All testids from plan §1 added across `product-card`, `product-detail`, `product-list`, `cart`, `cart-item`, `cart-summary`, `empty-cart`, `checkout`, `order-confirmation`, `order-history`, `profile`, `header`, `notification-container`, `confirmation-modal`. |
| 1 — Auth & nav | P1.1, P1.2 | passing | `loginWithKeycloak` + `signOut` helpers in `e2e/helpers/auth.ts`. `beforeAll`/`afterAll` with shared `page`. |
| 2 — Profile | P2.1, P2.2, P2.3 | passing | P2.2 edits + saves + reloads + restores TEST_USER.given_name/phone so downstream tests see fresh state. |
| 3 — Addresses | P3.1–P3.7 | passing | Modal host fix: `:host { position: fixed; inset: 0; pointer-events: none; z-index: 999; }` + `.modal-backdrop { pointer-events: auto; }` in `modal.component.scss` and `confirmation-modal.component.ts`. `data-testid="address-modal"` on inner `<form>`. `address-cancel` testid added. P3.6 (delete billing) uses `confirmation-confirm` filtered by `'Delete'`. |
| 4 — Credit cards | P4.1–P4.5 | passing | `credit-card-cancel` testid added. P4.5 uses `credit-card-form` (not `credit-card-modal`) for the not-visible check. |
| 5 — Browse & cart | P5.1–P5.7 | passing | `waitForCartItemValidated` (30s) used in P5.6 before mutating quantities. Runtime dominated by SSE validation round-trips. |
| 6 — Checkout | **P6, P6.6, P6.7** | passing | P6 chains all 5 steps into one test (P6.1–P6.5 from the plan are not separable because `currentStep = signal<number>(1)` resets on every navigation to `/checkout`). P6.4 asserts `'Bellevue'` (not `TEST_USER.shippingAddress.city`) because P3.5 mutated the city. P6.7 signs out. All nav hazards defused by entering via `/profile` (AuthGuard re-hydrates auth + userData) then router-nav via the header. |
| 7 — Order history | P7.1, P7.2 | **failing** | P7.1 fails: order history returns empty. P7.2 did not run. See "Blocker" below. |

**Total: 27 passing, 1 failing, 1 pending (P7.2, depends on P7.1).**

## Blocker — P7.1: backend stores orders without `customer_id`

**Symptom:** `OrderHistoryComponent` loads the customer successfully, calls `GET /api/v1/orders/customer/{customerId}`, the API returns an empty array, the page renders the empty-state message.

**Confirmed by user:** orders are persisted in the backend with a blank/null `customer_id`. The order placement API call (`POST /api/v1/orders/checkout/{cartId}` or equivalent) is not associating the order with the authenticated customer's `customer_id` field.

**Frontend is correct.** The P6 test captured the order number on `/order-confirmation` (assertion `await expect(page.getByTestId('order-number')).toBeVisible()` passed; `orderNumber` was truthy), so the order was created and returned. The cart-clear in P6.6 also passed, confirming the cart was actually consumed by the checkout. The chain is: order created (P6) → cart cleared (P6.6) → but the order has no `customer_id` set → order history can't find it (P7.1).

**To unblock:** fix the backend order-checkout handler to set `customer_id` from the authenticated session (or from the cart's `customer_id`) before persisting. Once fixed, P7.1 and P7.2 will pass without further test changes.

## What remains

1. **Fix the backend** (separate task — out of scope for the Angular UI work).
2. **Re-run P7.1 + P7.2 only** to verify the fix:
   ```bash
   npx playwright test e2e/specs/full-journey.spec.ts --reporter=list
   ```
   Full suite takes ~1.7 min; Phases 1–6 are stable across runs.
3. **(Optional) Cleanup the orphaned Keycloak user.** The most recent run's teardown returned 401 and the user was not deleted. The user file is at `e2e/.runtime/test-user.json` and will be overwritten on the next run. If you want to delete manually:
   ```bash
   USERNAME=$(jq -r .username e2e/.runtime/test-user.json)
   USER_ID=$(curl -sk -u admin:269460aa8218a7c14a4f2daab2ddcda5 \
     "https://keycloak.local/admin/realms/pocstore-realm/users?username=$USERNAME" \
     | jq -r '.[0].id')
   curl -sk -u admin:269460aa8218a7c14a4f2daab2ddcda5 -X DELETE \
     "https://keycloak.local/admin/realms/pocstore-realm/users/$USER_ID"
   ```

## Key file references

- `e2e/specs/full-journey.spec.ts` — the spec; **P7.1 is at line 536, P7.2 at line 554, P6.7 at line 571**.
- `src/app/features/order-history/order-history.component.{html,ts}` — order history page (testids already in place).
- `src/app/store/order-history/customer-order-history.service.ts` — order history fetch service.
- `src/app/store/order/order.store.ts:85` — `waitForOrderCreated(30000)`; the success toast is `Order ${orderNumber} placed successfully!`.
- `src/app/store/cart/cart.store.ts:471-482` — `clearCartAfterOrder()` called by `orderConfirmationEffect` in `checkout.component.ts:36-43` BEFORE navigation to `/order-confirmation`.
- `e2e/helpers/{auth,sse,notifications,api}.ts` — all helpers.
- `e2e/.runtime/test-user.json` — timestamped Keycloak user created in `globalSetup`.

## Known minor issues (do not block)

- **Global teardown 401 flake.** ~1 in 5 runs, the Keycloak admin token expires before teardown runs. Does not affect test results. The next run creates a new user and overwrites `e2e/.runtime/test-user.json`. If the orphan count grows, run the manual cleanup above.
- **Headless on Linux** requires `xvfb-run npx playwright test ...` (or `headless: false` in config). macOS runs headless out of the box.

## Adaptations from the plan (do not re-do)

These are the divergences from `e2e-testing-plan-v2.md` §11/§13 that the running tests already encode. Do not revert them:

- **P6.1–P6.5 are a single test** (`P6: complete 5-step checkout flow`), because `CheckoutComponent.currentStep` resets on every navigation. The plan's P6.1–P6.5 cannot run independently.
- **P6.4 asserts `'Bellevue'`** as the city (mutated in P3.5), not `TEST_USER.shippingAddress.city` (`'Seattle'`).
- **P6.7 navigation enters via `/profile`** to rehydrate auth via AuthGuard, then hovers the greeting to expose the dropdown.
- **P7.1 navigation enters via `/profile` + `your-orders-link` dropdown** (not `view-my-orders` on `/order-confirmation`), because P6.6 already navigated us off the confirmation page. Same auth-rehydration hazard.
- **P7.2 uses the same dropdown navigation** (not the confirmation page's `view-my-orders` button).
- **Phase 3 modal host visibility** uses the `:host { position: fixed; inset: 0; pointer-events: none; z-index: 999; }` trick so `data-testid="address-modal"` / `credit-card-modal` is always structurally present, but `not.toBeVisible()` assertions target the inner `*-form` element (only rendered while open).
