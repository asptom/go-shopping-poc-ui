# E2E Implementation Resume — Session 2

**Plan:** `ai/plans/e2e-testing-plan-v2.md` (vetted, do not re-verify)
**Spec file:** `e2e/specs/full-journey.spec.ts` (single sequential file, 29 tests, `test.describe.serial()`)
**Last full test run:** 2026-06-05 — P5.3 passes, P5.4 fails (see below)

## Status: 20 / 29 tests passing. Blocked on P5.4.

Phases 0–4 and most of P5 are green. P5.3 now passes (the cart is created with a `customer_id`). P5.4 fails for a **new issue** introduced by the P5.3 fix: the OIDC auth state is now preserved across P5.3, so P5.4's hard-nav to `/products` behaves differently than in the original run.

## What's done

| Phase | Tests | Status | Notes |
|---|---|---|---|
| 0 — Setup | (config + helpers) | done | Unchanged from session 1. |
| 0.5 — testid retrofit | (template changes) | done | Unchanged from session 1. |
| 1 — Auth & nav | P1.1, P1.2 | passing | Unchanged. |
| 2 — Profile | P2.1, P2.2, P2.3 | passing | P2.1 now calls `ensureCustomerExists()` helper at end. |
| 3 — Addresses | P3.1–P3.7 | passing | Unchanged. |
| 4 — Credit cards | P4.1–P4.5 | passing | Unchanged. |
| 5 — Products & cart | P5.1, P5.2, **P5.3** | P5.3 passes, P5.4 fails | P5.3 changed to use search bar (router nav). P5.4 fails — see "Blocker" below. |
| 6 — Checkout | P6, P6.6 | not yet reached | Blocked by P5.4. |
| 7 — Order history | P7.1, P7.2 | not yet reached | Blocked by P5.4. |

**Total: 20 passing, 1 failing (P5.4), 8 did not run (P5.5–P6.7).**

## Changes made this session

### 1. TypeScript @types/node error fix
- `package.json`: added `"@types/node": "^24.9.2"` to `devDependencies`.
- `e2e/tsconfig.json` (new): `{ "extends": "../tsconfig.json", "compilerOptions": { "types": ["node"] }, "include": ["**/*.ts"], "exclude": [] }`.
- `e2e/helpers/api.ts`: changed `process.env.NODE_TLS_REJECT_UNAUTHORIZED` to bracket-access `process.env['NODE_TLS_REJECT_UNAUTHORIZED']` (required by `noPropertyAccessFromIndexSignature` once `@types/node` is loaded).
- Verified: `npx tsc --noEmit -p e2e/tsconfig.json` → exit 0. `npx tsc --noEmit -p tsconfig.app.json` → exit 0.

### 2. `ensureCustomerExists()` helper in spec
Added at `e2e/specs/full-journey.spec.ts:17-24`:
```ts
async function ensureCustomerExists(): Promise<void> {
  await gotoStable('/profile');
  await expect(page.getByTestId('hello-greeting-main')).toContainText(
    TEST_USER.given_name,
    { timeout: 15_000 },
  );
  await expect(page.locator('#customerSince')).not.toHaveValue('', { timeout: 15_000 });
}
```

### 3. P2.1 calls `ensureCustomerExists()` at end
After the existing assertions, calls the helper to guarantee the customer is created in the backend before downstream tests.

### 4. P5.3 changed: search bar navigation instead of `page.goto('/products')`
Replaced `await page.goto('/products')` with:
```ts
await page.getByPlaceholder('Search GoShopping').fill('ab');
await expect(page.getByTestId('product-grid')).toBeVisible({ timeout: 15_000 });
await expect(page.getByTestId('hello-greeting-top')).toContainText(
  TEST_USER.given_name,
  { timeout: 15_000 },
);
```

**Why:** On hard-nav to `/products` (no AuthGuard), the OIDC library's `isAuthenticated$` emits `false` initially, the `AuthService.tap` side-effect at `auth.service.ts:36-39` clears `auth_state` from localStorage, and the signal stays `false` because nothing re-triggers validation. `CartStore.ensureCart()` at `cart.store.ts:522` reads `authService.userData()?.email` — if null, the customer is never loaded and the cart is created without a `customer_id`, causing P7.1 to return empty order history.

**Result:** P5.3 now passes. The cart is created with a `customer_id`. The `hello-greeting-top` greeting is visible, proving OIDC is re-hydrated.

## Blocker — P5.4: hard-nav to `/products` loses OIDC Bearer token

**Symptom:** P5.4 does `await page.goto('/products')` (hard nav). The product grid renders, product cards are visible, the `add-to-cart` click fires, but the success notification "Item added to cart" never appears. The `cart-item` count is 1, not 2.

**Root cause:** On hard-nav, the OIDC library's internal token storage is reset. The `authInterceptor` reads the token from `AuthService.getAccessToken()` → `oidcSecurityService.getAccessToken()`. If the OIDC library doesn't re-validate on `/products` (no AuthGuard), the token is null, the `authInterceptor` doesn't attach the Bearer token, and the `POST /api/v1/carts/{cartId}/items` request is rejected by the backend. The `addItem` fails silently.

**Why it worked in the original run:** In the original test run, BOTH P5.3 and P5.4 used `page.goto('/products')` (hard nav). The OIDC state was consistently un-hydrated across both tests, and the `addItem` somehow worked (possibly because the backend allowed the request, or the OIDC library's sessionStorage token was still valid). After the P5.3 fix (search bar preserves OIDC), the OIDC state is now fresh before P5.4, and P5.4's hard-nav un-hydrates it differently — the Bearer token is not re-attached.

**Attempted fixes that did NOT work:**
1. **`gotoStable('/products')`** — waits for `networkidle` but OIDC doesn't re-validate on `/products`. Greeting never appears. (`hello-greeting-top` is inside `@if (isAuthenticated())` at `header.html:6`.)
2. **Wait for `hello-greeting-top` after hard nav** — never appears, OIDC stays `false`.
3. **`history.pushState` to trigger Angular router** — Angular's `Location` service does not monkey-patch `pushState`; router does not navigate. Product grid never appears.
4. **Category dropdown `selectOption({ index: 1 })`** — `(ngModelChange)` fires, `onCategoryChange` runs, `router.navigate` is called, but the page stays on `/profile` (or the current page). Router navigation doesn't take effect.
5. **Search bar `fill('cd')` (different query)** — navigates to `/products?q=cd` but `ProductListComponent` errors with "Cannot read properties of null (reading 'length')" during the re-fetch. The "Something went wrong" error block appears. `add-to-cart` click does not produce a notification.
6. **Search bar `fill('')` (clear)** — `distinctUntilChanged` allows the emission, debounce fires, router navigates to `/products` (no `q` param), but `product-grid` is not visible within 15s timeout. Possibly the navigation didn't complete, or the product list component didn't render in time.

**To unblock P5.4 (pick one):**
1. **Add an AuthGuard to `/products`** (production code change). This triggers `checkAuth()` on every nav to `/products`, re-validating OIDC and persisting `auth_state`. The `authInterceptor` then attaches the Bearer token, and `addItem` works. This is the cleanest fix and also fixes the root cause of the P7.1 issue (OIDC un-hydration on hard-nav to non-guarded routes).
2. **Fix the OIDC re-validation on hard-nav** (production code change in `AuthService`). The `tap` at `auth.service.ts:36-39` clears `auth_state` on every `false` emission from `isAuthenticated$`. The initial `false` from the OIDC library (before re-validation) clears the persisted state. The fix: only clear `auth_state` if the OIDC library has explicitly confirmed unauthenticated status (e.g., after token refresh failure), not on the initial emission.
3. **Use the Angular debug API to call `checkAuth()` in the test** (test workaround). After `page.goto('/products')`, inject the `AuthService` via `(window as any).ng.getInjector(root)` and call `checkAuth().subscribe()` to trigger re-validation. Fragile and depends on the debug API being available in dev builds.

**Recommendation:** Option 1 (add AuthGuard to `/products`) is the cleanest and most correct fix. It also resolves the underlying OIDC fragility that caused P7.1 to fail in the first place.

## Recommended next session agenda

1. **Decide on OIDC strategy** (see "OIDC Architecture Review" below).
2. **Fix P5.4** using the chosen approach.
3. **Re-run P5.4 → P6.7 → P7.1 → P7.2** to verify the full suite passes.
4. **Update `e2e-resume-implementation.md`** to reflect the final state.

## OIDC Architecture Review — strongly recommended separate session

The OIDC implementation has several fragility issues that are causing the test failures. A dedicated review session should address:

### Issues identified

1. **`AuthService` clears `auth_state` on initial `false` emission** (`src/app/auth/auth.service.ts:36-39`):
   ```ts
   tap(isAuthenticated => {
     if (!isAuthenticated) {
       this.clearPersistedAuthState();
     }
   }),
   ```
   On hard-nav (non-callback path), the OIDC library's `isAuthenticated$` emits `false` before re-validating the token from sessionStorage. The `tap` clears `auth_state` from localStorage. Then the library re-validates and emits `true`, but the persisted state is already gone. The `startWith` seed is a one-time value — after the first emission, the signal follows the OIDC observable.

2. **No AuthGuard on `/products`** (`src/app/app.routes.ts:22-26`): Hard-nav to `/products` (or any non-guarded route) doesn't trigger `checkAuth()`, so OIDC never re-validates. The `authInterceptor` can't attach a Bearer token, and any API call that requires auth fails.

3. **CustomerStore and CartStore are in-memory only** (no localStorage persistence): On hard-nav, all store state is lost. `CustomerStore.customer()` returns `null` and must be re-loaded. `CartStore.state().cartId` is lost, but `localStorage` has the cartId, so `ensureCart()` re-loads from the backend.

4. **`customer-order-history.service.ts:14-21` swallows all errors into `[]`**: The `catchError` returns `of([])` for ANY error (404, 500, timeout). This masks the real failure mode. P7.1 fails with "empty order history" instead of a clear error like "401 Unauthorized" or "customer not found".

5. **`history.pushState` does not trigger Angular's router** — Angular's `Location` service does not monkey-patch `pushState`. The router only responds to `popstate` events (back/forward) or its own `Location.go()` calls. This is a test limitation, not a production bug, but it means the test can't easily do router navigation from `page.evaluate()`.

### Recommended improvements

- **Persist `customer_id` in `localStorage`** (like `cart_id` is). On app init, re-hydrate the customer from `localStorage` so the `CustomerStore` survives hard-navs.
- **Make `OrderHistoryComponent` set a clear error message** when the API returns 401 or when the customer is null. Don't swallow errors silently.
- **Add an AuthGuard to `/products`** (and any other public route that triggers authenticated API calls). This ensures OIDC re-validates on every nav.
- **Fix the `tap` in `AuthService`** to only clear `auth_state` on confirmed unauthenticated status, not on the initial `false` emission.
- **Consider a `provideAppInitializer` that calls `checkAuth()` on every app boot** (not just the callback path). This ensures OIDC is always validated before the app renders.

### Test-side improvements

- **The `gotoStable` helper uses `hello-greeting-main` which is hidden by CSS** (`.account-links { display: none }` until `:hover`). The `waitFor({ state: 'visible' })` check always times out; the `networkidle` check is what actually resolves. Consider using `hello-greeting-top` (always visible when authenticated) or `state: 'attached'`.
- **The `gotoStable` helper doesn't help on non-guarded routes** — there's no `networkidle` event that proves OIDC re-validated, because re-validation never happens.
- **The test relies on a shared `BrowserContext` across all tests** (no cleanup between phases). This is intentional (to preserve auth) but makes the tests order-dependent and fragile to OIDC state changes.

## Key file references

| What | File:line |
|---|---|
| `CreateCustomer` HTTP call | `src/app/services/customer.service.ts:33-41` |
| `createCustomerFromAuth` | `src/app/store/customer/customer.store.ts:86-117` |
| Profile page effect (call site A) | `src/app/features/profile/profile.component.ts:94-101, 156-170` |
| Cart `ensureCart` (call site B) | `src/app/store/cart/cart.store.ts:505-544` |
| OIDC `tap` that clears `auth_state` | `src/app/auth/auth.service.ts:36-39` |
| `loadPersistedIsAuthenticated` / `loadPersistedUserData` | `src/app/auth/auth.service.ts:72-96` |
| `authInterceptor` (assumed in AGENTS.md, not yet verified) | `src/app/interceptors/auth.interceptor.ts` (if exists) |
| `OrderHistoryComponent` `loadOrders` | `src/app/features/order-history/order-history.component.ts:34-61` |
| `customer-order-history.service` (swallows errors) | `src/app/services/customer-order-history.service.ts:14-21` |
| Routes (no AuthGuard on `/products`) | `src/app/app.routes.ts:22-26` |
| Header testids | `src/app/layout/header/header.html:7,75,77,78,79` |
| P5.3 (now uses search bar) | `e2e/specs/full-journey.spec.ts:371-408` |
| P5.4 (failing) | `e2e/specs/full-journey.spec.ts:414-431` |
| P7.1 (not yet reached) | `e2e/specs/full-journey.spec.ts:573-590` |
| P7.2 (not yet reached) | `e2e/specs/full-journey.spec.ts:592-607` |
| `e2e/tsconfig.json` (new) | `e2e/tsconfig.json` |
| `@types/node` added | `package.json` devDependencies |

## Known minor issues (do not block)

- **Global teardown 401 flake.** ~1 in 5 runs, the Keycloak admin token expires before teardown runs. Does not affect test results. The next run creates a new user and overwrites `e2e/.runtime/test-user.json`. If the orphan count grows, run the manual cleanup from session 1's plan.
- **Headless on Linux** requires `xvfb-run npx playwright test ...` (or `headless: false` in config). macOS runs headless out of the box.

## Adaptations from the plan (do not re-do)

These are the divergences from `e2e-testing-plan-v2.md` §11/§13 that the running tests already encode. Do not revert them:

- **P6.1–P6.5 are a single test** (`P6: complete 5-step checkout flow`), because `CheckoutComponent.currentStep` resets on every navigation.
- **P6.4 asserts `'Bellevue'`** as the city (mutated in P3.5), not `TEST_USER.shippingAddress.city` (`'Seattle'`).
- **P6.7 navigation enters via `/profile`** to rehydrate auth via AuthGuard, then hovers the greeting to expose the dropdown.
- **P7.1 navigation enters via `/profile` + `your-orders-link` dropdown** (not `view-my-orders` on `/order-confirmation`), because P6.6 already navigated off the confirmation page.
- **P7.2 uses the same dropdown navigation** (not the confirmation page's `view-my-orders` button).
- **Phase 3 modal host visibility** uses the `:host { position: fixed; inset: 0; pointer-events: none; z-index: 999; }` trick so `data-testid="address-modal"` / `credit-card-modal` is always structurally present, but `not.toBeVisible()` assertions target the inner `*-form` element.
- **P2.1 calls `ensureCustomerExists()` helper** at end (new in session 2).
- **P5.3 uses search bar** instead of `page.goto('/products')` to preserve OIDC (new in session 2).
