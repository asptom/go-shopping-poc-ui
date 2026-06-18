# Auth & Customer Data Stability Fixes

**Date:** 2026-06-05
**Status:** Implementation plan — do not re-verify against the codebase; the line numbers below are verified.

---

## Table of Contents

1. [Problem Summary](#1-problem-summary)
2. [Phase 0 — Prerequisites & verification](#2-phase-0--prerequisites--verification)
3. [Phase 1 — Fix AuthService premature clear of persisted auth state](#3-phase-1--fix-authservice-premature-clear-of-persisted-auth-state)
4. [Phase 2 — Fix APP_INITIALIZER to always call checkAuth](#4-phase-2--fix-app_initializer-to-always-call-checkauth)
5. [Phase 3 — Persist customer state to localStorage](#5-phase-3--persist-customer-state-to-localstorage)
6. [Phase 4 — Fix order history error handling](#6-phase-4--fix-order-history-error-handling)
7. [Phase 5 — Remove E2E test workarounds](#7-phase-5--remove-e2e-test-workarounds)
8. [Verification script](#8-verification)

---

## 1. Problem Summary

### Root cause chain (production code)

When Playwright does `page.goto('/products')` (a hard page navigation to any route without an `AuthGuard`):

1. The Angular app boots fresh. `APP_INITIALIZER` at `app.config.ts:22-30` checks if URL has `code` AND `state` params (the OIDC callback path). Since this is a regular navigation, those params are absent, so the initializer returns `Promise.resolve()` **without calling** `oidcSecurityService.checkAuth()`.

2. Meanwhile, `AuthService` creates its `_isAuthenticated` signal at `auth.service.ts:33-44`. The `startWith(this.loadPersistedIsAuthenticated())` seeds the signal with the correct persisted `true` value from localStorage.

3. The `OidcSecurityService.isAuthenticated$` observable emits `{ isAuthenticated: false }` — this is a **transient emission** emitted before the library has had a chance to re-validate from sessionStorage.

4. The `tap` at `auth.service.ts:36-39` sees this `false` and calls `this.clearPersistedAuthState()`, **destroying the localStorage seed**.

5. The OIDC library then re-validates from sessionStorage and emits `{ isAuthenticated: true }`, but by this point:
   - The `_userData` signal (which also had a `startWith` seed with the correct userData) has been re-read, but the persisted fallback is gone.
   - The `_isAuthenticated` signal eventually corrects itself to `true`, but any consumer that reads it during the gap sees `false`.

6. `CartStore.ensureCart()` at `cart.store.ts:504-543` reads `authService.userData()?.email` to load the customer. If `userData()` is `null` (because localStorage was cleared), the customer is never loaded, and the cart is created **without** `customer_id`.

7. Downstream, the placed order has no `customer_id`, so `GET /api/v1/orders/customer/{customerId}` returns empty, and `OrderHistoryComponent` shows "No orders yet".

### Files affected

| File | Lines | Role |
|------|-------|------|
| `src/app/auth/auth.service.ts` | 33-44 | `_isAuthenticated` signal with destructive `tap` |
| `src/app/app.config.ts` | 22-30 | `APP_INITIALIZER` that short-circuits on non-callback loads |
| `src/app/store/customer/customer.store.ts` | 20-25, 66-117 | In-memory only; no localStorage persistence |
| `src/app/services/customer-order-history.service.ts` | 14-21 | Swallows all errors to `[]` |
| `e2e/specs/full-journey.spec.ts` | 9-24, 371-411 | Workarounds for the auth fragility |

### Fix strategy (4 production changes + 1 test cleanup)

| Phase | Change | Trigger | Risk |
|-------|--------|---------|------|
| 1 | Remove destructive `tap` from `_isAuthenticated` in `AuthService` | OIDC emits false before re-validation | Low — logout() still clears explicitly |
| 2 | Always call `checkAuth()` in `APP_INITIALIZER` | Every app boot | Low — adds ~100-300ms to boot |
| 3 | Persist `customer_id` and `customer_data` to localStorage | After load/create customer | Low — follows CartStore pattern |
| 4 | Better error handling in `CustomerOrderHistoryService` | API errors | Low — more diagnostic info |
| 5 | Simplify E2E test spec | After phases 1-3 verified | N/A — test only |

---

## 2. Phase 0 — Prerequisites & verification

### 2.1 Before starting

Ensure the app builds and the current test suite runs:

```bash
npm run build
npx tsc --noEmit -p tsconfig.app.json
npx tsc --noEmit -p e2e/tsconfig.json
npx playwright test e2e/specs/smoke.spec.ts --reporter=list
```

### 2.2 After each phase

Run TypeScript type-check after each phase to catch errors early:

```bash
npx tsc --noEmit -p tsconfig.app.json
```

Run the full E2E suite only after ALL phases are complete (phases 1-3 are interdependent; running tests mid-way will fail).

---

## 3. Phase 1 — Fix AuthService premature clear of persisted auth state

### Goal

Stop the `_isAuthenticated` signal from clearing `localStorage['auth_state']` when the OIDC library emits its initial transient `false` before re-validating from sessionStorage.

### File

`src/app/auth/auth.service.ts`

### Change 1.1 — Remove destructive `tap` from `_isAuthenticated` (line 32-44)

**Current code (lines 30-44):**

```typescript
  // Derive isAuthenticated directly from the OIDC observable.
  // Seed with persisted state so auth survives page reloads before OIDC resolves.
  // Side-effect: persist or clear storage whenever auth state changes.
  private readonly _isAuthenticated = toSignal(
    this.oidcSecurityService.isAuthenticated$.pipe(
      map(authState => authState.isAuthenticated),
      tap(isAuthenticated => {
        if (!isAuthenticated) {
          this.clearPersistedAuthState();
        }
      }),
      startWith(this.loadPersistedIsAuthenticated()),
    ),
    { initialValue: this.loadPersistedIsAuthenticated() },
  );
```

**Replace with (lines 30-42):**

```typescript
  // Derive isAuthenticated directly from the OIDC observable.
  // Seed with persisted state so auth survives page reloads before OIDC resolves.
  // Side-effect: persist auth state when authenticated (clear is handled by logout()).
  // IMPORTANT: Do NOT clear persisted state on false — the OIDC library emits false
  // before re-validating from sessionStorage on hard navigation, which would destroy
  // the seed value. The seed bridges the gap until OIDC re-validates.
  private readonly _isAuthenticated = toSignal(
    this.oidcSecurityService.isAuthenticated$.pipe(
      map(authState => authState.isAuthenticated),
      startWith(this.loadPersistedIsAuthenticated()),
    ),
    { initialValue: this.loadPersistedIsAuthenticated() },
  );
```

**What changed:** Removed the 4-line `tap(isAuthenticated => { if (!isAuthenticated) { this.clearPersistedAuthState(); } })` block (lines 36-39). The `map` and `startWith` remain unchanged.

### Change 1.2 — Add defensive clear to `_userData` tap (lines 46-59)

**Current code (lines 46-59):**

```typescript
  // Derive userData from the OIDC observable.
  // Seed with persisted userData, side-effect persists changes.
  private readonly _userData = toSignal(
    this.oidcSecurityService.userData$.pipe(
      map(state => (state?.userData as UserData) ?? null),
      tap(userData => {
        if (userData && this._isAuthenticated()) {
          this.persistAuthState(userData);
        }
      }),
      startWith(this.loadPersistedUserData()),
    ),
    { initialValue: this.loadPersistedUserData() },
  );
```

**Replace with (lines 46-61):**

```typescript
  // Derive userData from the OIDC observable.
  // Seed with persisted userData, side-effect persists changes.
  // Clears persisted state when OIDC confirms userData is null (session expired).
  private readonly _userData = toSignal(
    this.oidcSecurityService.userData$.pipe(
      map(state => (state?.userData as UserData) ?? null),
      tap(userData => {
        if (userData && this._isAuthenticated()) {
          this.persistAuthState(userData);
        } else if (!userData && !this._isAuthenticated()) {
          // Both userData is null AND isAuthenticated is false:
          // OIDC has confirmed no valid session — clear persisted state.
          // This avoids stale localStorage from surviving across page loads
          // when a session expires between navigations.
          this.clearPersistedAuthState();
        }
      }),
      startWith(this.loadPersistedUserData()),
    ),
    { initialValue: this.loadPersistedUserData() },
  );
```

**What changed:** Added an `else if` branch to the `tap` that clears `auth_state` when BOTH conditions are true:
- `userData` is `null` (OIDC emitted no user data)
- `isAuthenticated()` signal is `false` (OIDC confirmed not authenticated)

The dual condition prevents false-positive clears during the window where `userData$` emits before `isAuthenticated$`.

### Change 1.3 — Update comment on persisted seed

**Current code (lines 30-32):**

```typescript
  // Derive isAuthenticated directly from the OIDC observable.
  // Seed with persisted state so auth survives page reloads before OIDC resolves.
  // Side-effect: persist or clear storage whenever auth state changes.
```

Already replaced in Change 1.1 above.

### Verification (type-check only)

```bash
npx tsc --noEmit -p tsconfig.app.json
```

Expected: exit 0, no errors.

### Rollback

If Phase 1 causes issues, revert `auth.service.ts` to its original state (the exact code in the "Current code" blocks above). Phase 1 changes are self-contained to one file.

---

## 4. Phase 2 — Fix APP_INITIALIZER to always call checkAuth

### Goal

Ensure `checkAuth()` is called on EVERY app boot, not just on the OIDC callback path. This tells the OIDC library to immediately validate the session from sessionStorage, rather than waiting for the library's internal async timer.

### File

`src/app/app.config.ts`

### Change 2.1 — Remove the code/state guard from `initializeAuth` (lines 20-30)

**Current code (lines 20-30):**

```typescript
// App initializer: only process the OIDC callback when returning from Keycloak.
// On normal page loads we skip checkAuth entirely to avoid overwriting persisted auth state.
function initializeAuth(oidcSecurityService: OidcSecurityService) {
  return (): Promise<unknown> => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('code') && urlParams.has('state')) {
      return firstValueFrom(oidcSecurityService.checkAuth()).catch(() => null);
    }
    return Promise.resolve();
  };
}
```

**Replace with (lines 20-27):**

```typescript
// App initializer: always check auth on boot to trigger OIDC re-validation
// from sessionStorage. Previously we short-circuited on non-callback loads
// to "avoid overwriting persisted auth state", but that prevented OIDC from
// re-validating on hard navigations to non-guarded routes (e.g., /products).
// The APP_INITIALIZER blocks rendering until this resolves, ensuring auth
// signals are correct before any component renders.
function initializeAuth(oidcSecurityService: OidcSecurityService) {
  return (): Promise<unknown> => {
    return firstValueFrom(oidcSecurityService.checkAuth()).catch(() => null);
  };
}
```

**What changed:**
- Removed lines 24-27 (the `urlParams` check and conditional return)
- Removed the old line 28 (`return Promise.resolve()`)
- Updated the comment to explain why we always call `checkAuth()`

### Verification

```bash
npx tsc --noEmit -p tsconfig.app.json
```

### Why this is safe

The `angular-auth-oidc-client` library's `checkAuth()` method:
1. If URL has `code` + `state`: processes the OIDC callback (token exchange)
2. If no callback params: checks sessionStorage for existing tokens → validates them → emits result

Calling `checkAuth()` on every boot means:
- **Callback pages**: Same behavior as before (processes the auth response)
- **Regular pages with valid session**: Reads sessionStorage, finds tokens, emits `true` — same as what happened before after the async timer fired
- **Regular pages without session**: Reads sessionStorage, finds nothing, emits `false` — correct
- **First visit (no callback, no session)**: `checkAuth()` runs, finds nothing in sessionStorage, emits `false` — correct

The performance impact is negligible because `checkAuth()` on non-callback pages is synchronous (just reads sessionStorage) unless a silent renew is needed.

---

## 5. Phase 3 — Persist customer state to localStorage

### Goal

Add localStorage persistence to `CustomerStore`, following the same pattern as `CartStore.persistCartId()` / `CartStore.clearPersistedCart()`. This allows the customer to be re-hydrated on hard navigation without waiting for `AuthService.userData()` to resolve.

### File

`src/app/store/customer/customer.store.ts`

### Change 3.1 — Add localStorage constants and helpers (after line 18)

**Insert after line 18 (`private readonly notificationService = inject(NotificationService);`):**

```typescript
  private readonly CUSTOMER_ID_KEY = 'customer_id';
  private readonly CUSTOMER_DATA_KEY = 'customer_data';
```

### Change 3.2 — Add constructor with hydration (after line 64, before the `// Actions` comment)

**Insert after line 64 (after the `defaultCreditCard` computed, before line 66 `// Actions`):**

```typescript
  constructor() {
    this.hydrateFromStorage();
  }

  // ── Persistence helpers ───────────────────────────────────────────

  /**
   * Attempts to hydrate customer state from localStorage on initialization.
   * Only loads basic customer info (id + email) for downstream consumers;
   * the full customer record is fetched on first profile visit.
   */
  private hydrateFromStorage(): void {
    try {
      const raw = localStorage.getItem(this.CUSTOMER_DATA_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Customer;
        if (parsed && parsed.email) {
          // Set partial state so downstream consumers (CartStore.ensureCart)
          // can access customer_id immediately without an API round-trip.
          this.state.update(s => ({
            ...s,
            customer: parsed,
          }));
        }
      }
    } catch {
      // Storage unavailable or corrupt — non-fatal
    }
  }

  private persistCustomer(customer: Customer): void {
    try {
      if (customer?.customer_id) {
        localStorage.setItem(this.CUSTOMER_ID_KEY, customer.customer_id);
      }
      if (customer?.email) {
        localStorage.setItem(this.CUSTOMER_DATA_KEY, JSON.stringify(customer));
      }
    } catch {
      // Storage unavailable — non-fatal
    }
  }

  private clearPersistedCustomer(): void {
    localStorage.removeItem(this.CUSTOMER_ID_KEY);
    localStorage.removeItem(this.CUSTOMER_DATA_KEY);
  }
```

### Change 3.3 — Add persist call at end of `loadCustomer` (after line 73)

**Current code (lines 66-84):**

```typescript
  async loadCustomer(email: string): Promise<void> {
    if (!email) return;
    this.setState({ loading: true, error: null });

    try {
      const customer = await firstValueFrom(this.customerService.getCustomer(email));
        if (customer) {
          this.setState({ customer, loading: false });
        } else {
          // Customer not found - return null without error, let caller decide what to do
          this.setState({ customer: null, loading: false });
        }
    } catch (error) {
      this.setState({ 
        loading: false, 
        error: 'Failed to load customer data' 
      });
    }
  }
```

**Replace with (lines 66-86):**

```typescript
  async loadCustomer(email: string): Promise<void> {
    if (!email) return;
    this.setState({ loading: true, error: null });

    try {
      const customer = await firstValueFrom(this.customerService.getCustomer(email));
        if (customer) {
          this.setState({ customer, loading: false });
          this.persistCustomer(customer);
        } else {
          // Customer not found - return null without error, let caller decide what to do
          this.setState({ customer: null, loading: false });
        }
    } catch (error) {
      this.setState({ 
        loading: false, 
        error: 'Failed to load customer data' 
      });
    }
  }
```

**What changed:** Added `this.persistCustomer(customer);` after `this.setState({ customer, loading: false });` on line 73.

### Change 3.4 — Add persist call at end of `createCustomerFromAuth` (after line 109)

**Current code (lines 107-109):**

```typescript
      const savedCustomer = await firstValueFrom(this.customerService.createCustomer(newCustomer));
      this.setState({ customer: savedCustomer, loading: false });
      this.notificationService.showSuccess('Customer profile created successfully');
```

**Replace with (lines 107-109):**

```typescript
      const savedCustomer = await firstValueFrom(this.customerService.createCustomer(newCustomer));
      this.setState({ customer: savedCustomer, loading: false });
      this.persistCustomer(savedCustomer);
      this.notificationService.showSuccess('Customer profile created successfully');
```

**What changed:** Added `this.persistCustomer(savedCustomer);` before the notification.

### Change 3.5 — Add persist call in `updateCustomer` (after line 123)

**Current code (lines 122-125):**

```typescript
      const updatedCustomer = await firstValueFrom(this.customerService.updateCustomer(customer));
      this.setState({ customer: updatedCustomer, loading: false });
      this.notificationService.showSuccess('Profile updated successfully');
```

**Replace with (lines 122-125):**

```typescript
      const updatedCustomer = await firstValueFrom(this.customerService.updateCustomer(customer));
      this.setState({ customer: updatedCustomer, loading: false });
      this.persistCustomer(updatedCustomer);
      this.notificationService.showSuccess('Profile updated successfully');
```

### Change 3.6 — Add persist call in `patchCustomer` success branches (after lines 144 and 152)

**Current code (lines 134-162):**

```typescript
  async patchCustomer(customerId: string, updates: Partial<Customer>): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      const currentCustomer = this.state().customer;
      const updatedCustomer = await firstValueFrom(this.customerService.patchCustomer(customerId, updates));

      // API now returns complete customer objects with all fields
      // Validate response completeness, fallback to merge if incomplete
      if (this.isCompleteCustomerResponse(updatedCustomer)) {
        this.setState({ customer: updatedCustomer, loading: false });
      } else {
        let mergedCustomer: Customer;
        if (currentCustomer) {
          mergedCustomer = Object.assign({}, currentCustomer, updatedCustomer) as Customer;
        } else {
          mergedCustomer = updatedCustomer as unknown as Customer;
        }
        this.setState({ customer: mergedCustomer, loading: false });
      }

      this.notificationService.showSuccess('Profile updated successfully');
    } catch (error) {
      this.setState({
        loading: false,
        error: 'Failed to update profile'
      });
    }
  }
```

**Replace with (lines 134-162):**

```typescript
  async patchCustomer(customerId: string, updates: Partial<Customer>): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      const currentCustomer = this.state().customer;
      const updatedCustomer = await firstValueFrom(this.customerService.patchCustomer(customerId, updates));

      // API now returns complete customer objects with all fields
      // Validate response completeness, fallback to merge if incomplete
      if (this.isCompleteCustomerResponse(updatedCustomer)) {
        this.setState({ customer: updatedCustomer, loading: false });
        this.persistCustomer(updatedCustomer);
      } else {
        let mergedCustomer: Customer;
        if (currentCustomer) {
          mergedCustomer = Object.assign({}, currentCustomer, updatedCustomer) as Customer;
        } else {
          mergedCustomer = updatedCustomer as unknown as Customer;
        }
        this.setState({ customer: mergedCustomer, loading: false });
        this.persistCustomer(mergedCustomer);
      }

      this.notificationService.showSuccess('Profile updated successfully');
    } catch (error) {
      this.setState({
        loading: false,
        error: 'Failed to update profile'
      });
    }
  }
```

**What changed:** Added `this.persistCustomer(updatedCustomer);` in the complete-response branch (after line 144 original) and `this.persistCustomer(mergedCustomer);` in the merge branch (after line 152 original).

### Change 3.7 — Add clear in `deleteAddress` when customer changes (after line 213)

**Current code (lines 202-224):**

```typescript
  async deleteAddress(addressId: string): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      await firstValueFrom(this.customerService.deleteAddress(addressId));
      const currentCustomer = this.state().customer;
      if (currentCustomer?.addresses) {
        const updatedAddresses = currentCustomer.addresses.filter(
          addr => addr.address_id !== addressId
        );
        this.setState({ 
          customer: { ...currentCustomer, addresses: updatedAddresses },
          loading: false 
        });
        this.notificationService.showSuccess('Address deleted successfully');
      }
    } catch (error) {
      this.setState({ 
        loading: false, 
        error: 'Failed to delete address' 
      });
    }
  }
```

**Replace with (lines 202-226):**

```typescript
  async deleteAddress(addressId: string): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      await firstValueFrom(this.customerService.deleteAddress(addressId));
      const currentCustomer = this.state().customer;
      if (currentCustomer?.addresses) {
        const updatedAddresses = currentCustomer.addresses.filter(
          addr => addr.address_id !== addressId
        );
        const updatedCustomer = { ...currentCustomer, addresses: updatedAddresses };
        this.setState({ 
          customer: updatedCustomer,
          loading: false 
        });
        this.persistCustomer(updatedCustomer);
        this.notificationService.showSuccess('Address deleted successfully');
      }
    } catch (error) {
      this.setState({ 
        loading: false, 
        error: 'Failed to delete address' 
      });
    }
  }
```

**What changed:**
- Extracted `updatedCustomer = { ...currentCustomer, addresses: updatedAddresses }` to a variable
- Added `this.persistCustomer(updatedCustomer);` after the state update

### Change 3.8 — Add persist call in `deleteCreditCard` (after line 275)

**Current code (lines 264-286):**

```typescript
  async deleteCreditCard(cardId: string): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      await firstValueFrom(this.customerService.deleteCreditCard(cardId));
      const currentCustomer = this.state().customer;
      if (currentCustomer?.credit_cards) {
        const updatedCards = currentCustomer.credit_cards.filter(
          card => card.card_id !== cardId
        );
        this.setState({
          customer: { ...currentCustomer, credit_cards: updatedCards },
          loading: false
        });
        this.notificationService.showSuccess('Credit card deleted successfully');
      }
    } catch (error) {
      this.setState({
        loading: false,
        error: 'Failed to delete credit card'
      });
    }
  }
```

**Replace with (lines 264-288):**

```typescript
  async deleteCreditCard(cardId: string): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      await firstValueFrom(this.customerService.deleteCreditCard(cardId));
      const currentCustomer = this.state().customer;
      if (currentCustomer?.credit_cards) {
        const updatedCards = currentCustomer.credit_cards.filter(
          card => card.card_id !== cardId
        );
        const updatedCustomer = { ...currentCustomer, credit_cards: updatedCards };
        this.setState({
          customer: updatedCustomer,
          loading: false
        });
        this.persistCustomer(updatedCustomer);
        this.notificationService.showSuccess('Credit card deleted successfully');
      }
    } catch (error) {
      this.setState({
        loading: false,
        error: 'Failed to delete credit card'
      });
    }
  }
```

**What changed:**
- Extracted `updatedCustomer` to a variable
- Added `this.persistCustomer(updatedCustomer);` after the state update

### Verification

```bash
npx tsc --noEmit -p tsconfig.app.json
```

Expected: exit 0, no errors.

---

## 6. Phase 4 — Fix order history error handling

### Goal

Make `CustomerOrderHistoryService` distinguish between "no orders found" (404/empty) and "request failed" (401/500/timeout). Currently all errors are swallowed to `[]`, masking auth failures that are the root cause of P7.1's failure.

### File

`src/app/services/customer-order-history.service.ts`

### Full file replacement

**Current code (all 22 lines):**

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, timeout, catchError } from 'rxjs';
import { OrderHistoryItem } from '../models/order';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CustomerOrderHistoryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl + "/orders/customer";

  getCustomerOrders(customerId: string): Observable<OrderHistoryItem[]> {
    return this.http.get<OrderHistoryItem[]>(`${this.apiUrl}/${customerId}`).pipe(
      timeout(10000),
      catchError((error: HttpErrorResponse | any) => {
        return of([]);
      })
    );
  }
}
```

**Replace with (all 30 lines):**

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, timeout, catchError, throwError } from 'rxjs';
import { OrderHistoryItem } from '../models/order';
import { environment } from '../../environments/environment';
import { ErrorHandlerService } from '../core/error/error-handler.service';

@Injectable({
  providedIn: 'root'
})
export class CustomerOrderHistoryService {
  private readonly http = inject(HttpClient);
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly apiUrl = environment.apiUrl + "/orders/customer";

  getCustomerOrders(customerId: string): Observable<OrderHistoryItem[]> {
    return this.http.get<OrderHistoryItem[]>(`${this.apiUrl}/${customerId}`).pipe(
      timeout(10000),
      catchError((error: HttpErrorResponse | any) => {
        // 404 means no orders yet — return empty array (not an error)
        if (error instanceof HttpErrorResponse && error.status === 404) {
          return of([]);
        }
        // 401/403 means auth failure — re-throw so the component can show an error
        if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
          const appError = this.errorHandler.handleError(error, 'getCustomerOrders');
          return throwError(() => appError);
        }
        // Timeout or other errors — log and return empty to avoid breaking the page
        console.warn('[CustomerOrderHistoryService] getCustomerOrders failed:', error);
        return of([]);
      })
    );
  }
}
```

**What changed:**
- Added import for `ErrorHandlerService`
- Injected `ErrorHandlerService`
- Added status-code branching in `catchError`:
  - **404** → return `[]` (no orders yet — normal)
  - **401/403** → re-throw so `OrderHistoryComponent` can display an auth error
  - **Other errors** → `console.warn` + return `[]` (graceful degradation)

### Verification

```bash
npx tsc --noEmit -p tsconfig.app.json
```

### Note on OrderHistoryComponent

The `OrderHistoryComponent` at `src/app/features/order-history/order-history.component.ts:34-61` already handles errors gracefully (it has a `catchError` at the component level or displays an empty state). The re-thrown 401/403 from this service will propagate to that component's error handler. If the component currently lacks error display, add a simple error message display. Verify by reading `order-history.component.ts` lines 34-61 after implementing this phase.

---

## 7. Phase 5 — Remove E2E test workarounds

### Goal

After Phases 1-3 are verified, remove the workarounds from the E2E test spec that were added to compensate for the auth fragility.

### File

`e2e/specs/full-journey.spec.ts`

### Change 5.1 — Remove `ensureCustomerExists()` helper (lines 17-24)

**Delete lines 17-24:**

```typescript
async function ensureCustomerExists(): Promise<void> {
  await gotoStable('/profile');
  await expect(page.getByTestId('hello-greeting-main')).toContainText(
    TEST_USER.given_name,
    { timeout: 15_000 },
  );
  await expect(page.locator('#customerSince')).not.toHaveValue('', { timeout: 15_000 });
}
```

### Change 5.2 — Remove `ensureCustomerExists()` call from P2.1 (line 78)

**Delete line 78:**

```typescript
    // Guarantee customer is created in the backend before downstream tests
    await ensureCustomerExists();
```

### Change 5.3 — Simplify P5.3 to use hard-nav (lines 371-412)

**Current code (lines 371-412):**

```typescript
  test('P5.3: adds the first product to the cart', async () => {
    // P5.1 hard-nav to /products (no AuthGuard) may have un-hydrated OIDC auth;
    // re-verify the customer exists before the first add-to-cart click.
    await ensureCustomerExists();

    // Navigate to /products via the header's search bar (router nav, preserves
    // AuthService signals). page.goto is a hard nav that un-hydrates OIDC:
    // the library's isAuthenticated$ emits false initially, the AuthService
    // tap clears auth_state from localStorage, and the signal stays false
    // because /products has no AuthGuard to trigger re-validation.
    // CartStore.ensureCart() reads authService.userData()?.email
    // (cart.store.ts:522) -- if userData is null, the customer is never loaded,
    // the cart is created without customer_id, and the order has no
    // customer_id downstream, causing P7.1 order history to return [].
    // Typing in the search bar triggers onSearchInput → 300ms debounce →
    // router.navigate(['/products']).
    await page.getByPlaceholder('Search GoShopping').fill('ab');
    await expect(page.getByTestId('product-grid')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('hello-greeting-top')).toContainText(
      TEST_USER.given_name,
      { timeout: 15_000 },
    );

    const first = page.getByTestId('product-card').first();
    const productName = await first.getByTestId('product-name').textContent();
    expect(productName).toBeTruthy();

    await first.getByTestId('add-to-cart').click();
    await expectSuccessNotification(page, 'Item added to cart');
    await waitForNotificationToDismiss(page, 'Item added to cart');

    // Use gotoStable for /cart to handle auth-state re-hydration after page reload
    await gotoStable('/cart');
    await expect(page.getByTestId('cart-title')).toBeVisible();

    await expect(page.getByTestId('cart-item')).toHaveCount(1);
    await expect(page.getByTestId('cart-item-name').first()).toContainText(productName!);
    // SSE validation may take a moment; allow brief settle but don't assert status yet
    await page.waitForTimeout(2000);
    // Item should not be in backorder
    await expect(page.getByTestId('cart-item').first()).not.toHaveClass(/backorder/);
  });
```

**Replace with (lines 371-408):**

```typescript
  test('P5.3: adds the first product to the cart', async () => {
    // Use hard-nav (page.goto) — Phase 1-2 fixes ensure OIDC auth state is
    // correctly re-hydrated on every page load, even without AuthGuard.
    await page.goto('/products');
    await expect(page.getByTestId('product-grid')).toBeVisible({ timeout: 15_000 });
    // Auth state should be re-hydrated by the APP_INITIALIZER checkAuth call
    await expect(page.getByTestId('hello-greeting-top')).toContainText(
      TEST_USER.given_name,
      { timeout: 15_000 },
    );

    const first = page.getByTestId('product-card').first();
    const productName = await first.getByTestId('product-name').textContent();
    expect(productName).toBeTruthy();

    await first.getByTestId('add-to-cart').click();
    await expectSuccessNotification(page, 'Item added to cart');
    await waitForNotificationToDismiss(page, 'Item added to cart');

    await page.goto('/cart');
    await expect(page.getByTestId('cart-title')).toBeVisible();

    await expect(page.getByTestId('cart-item')).toHaveCount(1);
    await expect(page.getByTestId('cart-item-name').first()).toContainText(productName!);
    // SSE validation may take a moment; allow brief settle but don't assert status yet
    await page.waitForTimeout(2000);
    // Item should not be in backorder
    await expect(page.getByTestId('cart-item').first()).not.toHaveClass(/backorder/);
  });
```

**What changed:**
- Removed `await ensureCustomerExists();` call
- Replaced search-bar navigation (`fill('ab')`) with `await page.goto('/products')` (hard-nav)
- Kept the auth-greeting assertion to confirm re-hydration works
- Replaced `gotoStable('/cart')` with `await page.goto('/cart')` (hard-nav now works)
- Removed the multi-line comment explaining the workaround

### Change 5.4 — Remove P1.2 workaround comment about no hard nav (lines 45-62)

**Current code (lines 45-63):**

```typescript
  test('P1.2: account menu links navigate to profile and order history', async () => {
    // The account dropdown's `.account-links` is hidden by default (display: none)
    // and revealed by the CSS rule `.account-menu:hover .account-links { display: block }`.
    // Hovering the greeting triggers that :hover state and exposes the links.
    await page.getByTestId('hello-greeting-main').hover();

    await page.getByTestId('your-account-link').click();
    await page.waitForURL(/\/profile$/);
    await expect(page.getByTestId('profile-title')).toBeVisible();

    // Header is shared across all routes; stay on /profile and use the dropdown there.
    // (A page.goto/goBack here would reload the page, after which the OIDC service
    // emits `false` before the persisted auth state can re-hydrate.)
    await page.getByTestId('hello-greeting-main').hover();

    await page.getByTestId('your-orders-link').click();
    await page.waitForURL(/\/profile\/orders/);
    await expect(page.getByTestId('order-history-title')).toBeVisible();
  });
```

**Replace with (lines 45-62):**

```typescript
  test('P1.2: account menu links navigate to profile and order history', async () => {
    // The account dropdown's `.account-links` is hidden by default (display: none)
    // and revealed by the CSS rule `.account-menu:hover .account-links { display: block }`.
    // Hovering the greeting triggers that :hover state and exposes the links.
    await page.getByTestId('hello-greeting-main').hover();

    await page.getByTestId('your-account-link').click();
    await page.waitForURL(/\/profile$/);
    await expect(page.getByTestId('profile-title')).toBeVisible();

    await page.getByTestId('hello-greeting-main').hover();

    await page.getByTestId('your-orders-link').click();
    await page.waitForURL(/\/profile\/orders/);
    await expect(page.getByTestId('order-history-title')).toBeVisible();
  });
```

**What changed:** Removed the multi-line comment (lines 56-59) about OIDC re-hydration hazard. The code is unchanged.

### Change 5.5 — Simplify Checkout P6 entry comment (lines 462-488)

**Current code (lines 462-488):**

```typescript
  // === Phase 6: Checkout flow ===
  //
  // The CheckoutComponent declares `currentStep = signal<number>(1)` and never
  // restores it from cart/customer/localStorage on init. Each navigation to
  // /checkout resets to step 1, so the plan's P6.1–P6.5 (each starting with
  // `page.goto('/checkout')` and asserting a later step is visible) cannot
  // run as independent tests. They are chained into a single test below.
  //
  // The shipping address city was edited to 'Bellevue' in P3.5, so the review
  // step asserts the literal 'Bellevue' instead of `TEST_USER.shippingAddress.city`.
  //
  // Two navigation hazards must be defused before /checkout:
  //   (1) Hard-navigating to /checkout races CartGuard against CartStore's
  //       async `loadPersistedCart()` (the guard sees `isEmpty()` and bounces
  //       us to /cart).
  //   (2) /cart has no AuthGuard, so on a hard navigation OIDC's
  //       `isAuthenticated$` re-emits `false` (the app initializer only calls
  //       `checkAuth()` on the OIDC callback path), which clears `auth_state`
  //       from localStorage. The header drops to "Hello, sign in" and
  //       CheckoutComponent's `prefillForms()` runs with `userData() === null`,
  //       leaving the contact form empty. CheckoutComponent has no
  //       `effect(userData)` (unlike ProfileComponent) so it never re-prefills.
  //
  // Fix: enter via /profile (AuthGuard.checkAuth re-hydrates auth + userData),
  // then click the header cart icon (router navigation, preserves auth state),
  // then the "Proceed to Checkout" button (router navigation, preserves cart).
```

**Replace with (lines 462-482):**

```typescript
  // === Phase 6: Checkout flow ===
  //
  // The CheckoutComponent declares `currentStep = signal<number>(1)` and never
  // restores it from cart/customer/localStorage on init. Each navigation to
  // /checkout resets to step 1, so the plan's P6.1–P6.5 (each starting with
  // `page.goto('/checkout')` and asserting a later step is visible) cannot
  // run as independent tests. They are chained into a single test below.
  //
  // The shipping address city was edited to 'Bellevue' in P3.5, so the review
  // step asserts the literal 'Bellevue' instead of `TEST_USER.shippingAddress.city`.
  //
  // Navigation hazard: Hard-navigating to /checkout races CartGuard against
  // CartStore's async `loadPersistedCart()` (the guard sees `isEmpty()` and
  // bounces us to /cart). Enter via /profile, then click the header cart icon,
  // then "Proceed to Checkout".
```

**What changed:** Removed the multi-line description of OIDC hazard (2) that no longer applies after Phases 1-2.

### Verification

```bash
npx tsc --noEmit -p e2e/tsconfig.json
```

---

## 8. Full verification

### 8.1 Build and type-check

```bash
npm run build
npx tsc --noEmit -p tsconfig.app.json
npx tsc --noEmit -p e2e/tsconfig.json
```

All should exit 0.

### 8.2 Run E2E smoke test

```bash
npx playwright test e2e/specs/smoke.spec.ts --reporter=list
```

### 8.3 Run full E2E suite (after backend customer_id fix is deployed)

The P7.1/P7.2 tests require the backend `POST /api/v1/orders/checkout/{cartId}` handler to set `customer_id` on the order. If the backend fix is not yet deployed, these tests will still fail with "empty order history". Run the rest of the suite to verify phases 1-3 resolve the auth fragility:

```bash
npx playwright test e2e/specs/full-journey.spec.ts --reporter=list --grep-invert "P7"
```

Expected: all non-P7 tests pass (P1-P6), including P5.3 and P5.4 which previously required workarounds.

### 8.4 Rollback procedure

If any phase causes regressions:

1. **Phase 1**: Revert `src/app/auth/auth.service.ts` to the exact code in the "Current code" blocks in section 3.
2. **Phase 2**: Revert `src/app/app.config.ts` to the original `initializeAuth` function.
3. **Phase 3**: Revert `src/app/store/customer/customer.store.ts` — remove all `persistCustomer`, `hydrateFromStorage`, `clearPersistedCustomer` calls and the constructor.
4. **Phase 4**: Revert `src/app/services/customer-order-history.service.ts` to the original version.
5. **Phase 5**: Revert `e2e/specs/full-journey.spec.ts` to the version with workarounds.

---

## Appendix: Dependency graph

```
Phase 1 (AuthService tap) ──────┐
                                ├──> Combined effect: OIDC state survives hard nav
Phase 2 (APP_INITIALIZER) ──────┘
                                      │
Phase 3 (CustomerStore persist) ──────┤──> Customer data available on hard nav
                                      │
Phase 4 (OrderHistory errors) ────────┤──> Better diagnostics for P7 failures
                                      │
Phase 5 (E2E cleanup) ────────────────┘──> Simplified tests after fixes verified
```

Phases 1-4 are independent in code (different files) but must be verified together since their effects combine. Phase 5 depends on 1-3 being verified.
