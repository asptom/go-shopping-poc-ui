# GoShopping UI — Codebase Improvement Plan

**Authored by:** Claude Sonnet 4.6 (openrouter/anthropic/claude-sonnet-4.6)  
**Date:** 2026-03-19  
**Angular target:** 21.x  
**Status:** APPROVED — Ready for phased implementation

---

## Executive Summary

This plan addresses a codebase built incrementally by multiple LLMs. The code works but exhibits significant technical debt: legacy Angular patterns, functional bugs (no Bearer token in API requests, broken production URL), orphaned files, excessive logging, and inconsistent naming conventions. The plan is organized into **7 phases** ordered by dependency and risk. Each phase is self-contained, verifiable, and safe to implement independently.

**Phases at a glance:**

| Phase | Name | Risk | Effort |
|-------|------|------|--------|
| 1 | Angular 21 Upgrade & Build Fixes | Medium | Medium |
| 2 | Critical Bug Fixes | Low | Low |
| 3 | Dead Code & Structural Cleanup | Low | Low |
| 4 | Angular Best Practices Modernization | Medium | High |
| 5 | State Management & Services Refactor | Medium | High |
| 6 | UI/UX Polish & Missing Features | Medium | High |
| 7 | Agent Guidance Files Update | Low | Low |

---

## Codebase Audit Summary

### Current State
- **Angular version:** 20.3.x (packages) / 20.3.7 (build cache)
- **Target version:** 21.x (latest stable as of 2026-03-19: 21.2.x)
- **Authentication:** OIDC via `angular-auth-oidc-client` v20 against Keycloak
- **State management:** Custom signal-based stores (`@Injectable` classes with `signal()`)
- **Test coverage:** ~2% (2 spec files, 4 trivial tests)
- **Build system:** `@angular/build:application` (Vite-based)

### Critical Functional Bugs (must fix before any UI work)
1. `environment.prod.ts` has wrong `apiUrl: 'https://api.pocstore.com/customers'` — all prod API calls broken
2. No Bearer token injected into HTTP requests — all authenticated endpoints effectively bypassed
3. `profile.routes.ts` imports `Home` component instead of `ProfileComponent` (unused but misleading)
4. `proxy.conf.json` not wired into `angular.json` and only covers `/customers` — dev proxy is non-functional

### Named Technical Debt Issues
- `standalone: true` set explicitly on ~20 components (Angular 20+ default, explicitly prohibited in project best practices)
- `@Input()`/`@Output()` decorators used instead of `input()`/`output()` signal functions on several components
- `*ngIf`/`*ngFor` structural directives used in multiple components instead of `@if`/`@for`
- `CommonModule` imported unnecessarily (should import only what's needed or use native control flow)
- `ChangeDetectionStrategy.OnPush` missing from ~15 components
- Constructor injection used instead of `inject()` in error interceptor and global error handler
- `.toPromise()` (deprecated) used throughout `CustomerStore` — 14 call sites
- Class-based `ErrorInterceptor` (legacy `HTTP_INTERCEPTORS` token) instead of functional interceptor
- Extensive `console.log`/`console.error`/`console.warn` in production code across 10+ files
- `window.confirm()` dialogs in 3 components — not accessible, not testable
- Inline `[style]="'...'!important'"` overrides in profile template — CSS specificity hack
- N+1 sequential image loading in `ProductStore.fetchImagesForProducts()`
- `allowSignalWrites: true` in 2 effects in `AuthService` — design smell
- `OrderHistoryComponent` template is a giant inline string concatenation
- Inconsistent file/class naming: layout files lack `.component.ts` suffix; `Home` class instead of `HomeComponent`
- No `test` architect target in `angular.json` — `ng test` would fail
- Development server proxy not configured

### Orphaned/Dead Files to Delete
- `src/app/features/order-history/order-history.ts` — scaffold stub, conflicts with real implementation
- `src/app/features/auth/` — empty directory
- `src/app/features/shared/` — empty directory
- `src/app/features/home/home.routes.ts` — exported but never imported anywhere
- `src/app/features/profile/profile.routes.ts` — exported but never imported; imports wrong component

---

## Phase 1: Angular 21 Upgrade & Build Configuration Fixes

**Goal:** Project builds and serves against Angular 21.x with correct build configuration.

**Success criteria:**
- `ng build --configuration production` completes with no errors
- `ng serve` starts with proxy correctly forwarding `/api/v1/*` to `https://pocstore.local`
- `ng test` runs (even with existing trivial tests)
- Angular version in `package.json` is `^21.x.x` throughout

### Step 1.1 — Update Angular to 21.x

Run the official Angular update tool. Angular 20 → 21 is a single major version step.

```bash
ng update @angular/core@21 @angular/cli@21 @angular/cdk@21 @angular/build@21
```

Then update `angular-auth-oidc-client` to the version compatible with Angular 21:

```bash
npm install angular-auth-oidc-client@21
```

Verify all peer dependencies are satisfied. Update `zone.js` if the update guide requires it.

**Files modified by ng update migrations:** Various (let the migration schematics run).

**Verify:** `ng build` produces a build with no errors. `ng version` shows Angular 21.x.

### Step 1.2 — Fix `angular.json`: Add `test` architect target

The `test` architect target is completely absent. Add it so `ng test` works.

**File:** `angular.json`

Add the following `test` key inside the `"architect"` object, at the same level as `"build"` and `"serve"`:

```json
"test": {
  "builder": "@angular/build:karma",
  "options": {
    "polyfills": ["zone.js", "zone.js/testing"],
    "tsConfig": "tsconfig.spec.json",
    "inlineStyleLanguage": "scss",
    "assets": [
      {
        "glob": "**/*",
        "input": "public"
      }
    ],
    "styles": ["src/styles.scss"],
    "scripts": []
  }
}
```

**Verify:** `ng test --watch=false` runs without "unknown architect target" errors.

### Step 1.3 — Fix `angular.json`: Wire up proxy for development

**File:** `angular.json`

In the `"serve"` architect target, add `"proxyConfig"` to the options:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": {
    "buildTarget": "go-shopping-poc-ui:build",
    "proxyConfig": "proxy.conf.json"
  },
  ...
}
```

### Step 1.4 — Rewrite `proxy.conf.json` to cover all API paths

The current proxy only covers `/customers` and is structured incorrectly for how the Angular dev server expects it. Rewrite it to proxy all `/api/v1/*` paths.

**File:** `proxy.conf.json`

Replace entirely with:

```json
{
  "/api/v1": {
    "target": "https://pocstore.local",
    "secure": false,
    "changeOrigin": true,
    "logLevel": "info"
  }
}
```

**Note:** `environment.ts` already has `apiUrl: 'https://pocstore.local/api/v1'`. When the app makes requests to `https://pocstore.local/api/v1/products`, the browser will call the Angular dev server at `http://localhost:4200/api/v1/products` if we update the dev environment to use relative URLs, OR the proxy can be set as a bypass. 

**Revised approach for proxy:** Update `environment.ts` `apiUrl` to use a relative base path for development so that requests go through the Angular dev server proxy:

**File:** `src/environments/environment.ts`

Change:
```typescript
apiUrl: 'https://pocstore.local/api/v1',
```
To:
```typescript
apiUrl: '/api/v1',
```

And update `proxy.conf.json` accordingly (as shown above). This allows the proxy to intercept all API requests during development.

**File:** `src/environments/environment.prod.ts`

Keep the production URL as an absolute URL but fix it (see Phase 2).

**Verify:** `ng serve` starts and API requests to `/api/v1/*` are proxied correctly.

---

## Phase 2: Critical Bug Fixes

**Goal:** All known functional bugs are resolved. The application works correctly for authenticated users.

**Success criteria:**
- Production build makes API calls to the correct base URL
- Bearer token is attached to all HTTP requests
- OIDC configuration is driven from environment, not hardcoded

### Step 2.1 — Fix `environment.prod.ts` API URL

**File:** `src/environments/environment.prod.ts`

Change:
```typescript
apiUrl: 'https://api.pocstore.com/customers',
```
To:
```typescript
apiUrl: 'https://api.pocstore.com/api/v1',
```

### Step 2.2 — Unify environment structure

The `oidc.config.ts` file hardcodes all OIDC configuration. It reads `environment.keycloak.issuer` for logout URL only. The `clientId: 'pocstore-client'` is hardcoded but `environment.keycloak.clientId` has a different value (`'go-shopping-poc-ui'`). This must be reconciled.

**Decision:** Make `oidc.config.ts` fully driven by environment. This requires passing environment values into the config factory.

**File:** `src/app/auth/oidc.config.ts`

Rewrite as a factory function:

```typescript
import { OpenIdConfiguration } from 'angular-auth-oidc-client';
import { environment } from '../../environments/environment';

export function createAuthConfig(): OpenIdConfiguration {
  return {
    authority: environment.keycloak.issuer,
    clientId: environment.keycloak.clientId,
    redirectUrl: `${window.location.origin}/home`,
    postLogoutRedirectUri: window.location.origin,
    scope: environment.keycloak.scope,
    responseType: environment.keycloak.responseType,
    silentRenew: environment.keycloak.silentRenew,
    useRefreshToken: environment.keycloak.useRefreshToken,
    renewTimeBeforeTokenExpiresInSeconds: 30,
    unauthorizedRoute: '/home',
    customParamsAuthRequest: {
      prompt: 'consent',
    },
  };
}
```

**File:** `src/environments/environment.ts`

Ensure the keycloak section has all required fields:

```typescript
export const environment = {
  production: false,
  apiUrl: '/api/v1',
  keycloak: {
    issuer: 'https://keycloak.local/realms/pocstore-realm',
    redirectUri: window.location.origin,
    clientId: 'pocstore-client',
    scope: 'openid profile email',
    responseType: 'code',
    silentRenew: false,
    useRefreshToken: true,
    logLevel: 'debug'
  }
};
```

**File:** `src/environments/environment.prod.ts`

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.pocstore.com/api/v1',
  keycloak: {
    issuer: 'https://auth.pocstore.com/realms/pocstore-realm',
    redirectUri: window.location.origin,
    clientId: 'pocstore-client',
    scope: 'openid profile email',
    responseType: 'code',
    silentRenew: false,
    useRefreshToken: true,
    logLevel: 'warn'
  }
};
```

**File:** `src/app/app.config.ts`

Update `provideAuth` to use the factory:

```typescript
import { createAuthConfig } from './auth/oidc.config';
// ...
provideAuth({ config: createAuthConfig() }),
```

### Step 2.3 — Add Bearer token HTTP interceptor

Create a new functional interceptor that attaches the OIDC access token to all API requests.

**File:** `src/app/core/auth/auth.interceptor.ts` (new file)

```typescript
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { switchMap, take } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Only attach token to API requests
  if (!req.url.startsWith(environment.apiUrl) && !req.url.startsWith('/api')) {
    return next(req);
  }

  const authService = inject(AuthService);

  return authService.getAccessToken().pipe(
    take(1),
    switchMap(token => {
      if (!token) {
        return next(req);
      }
      const authReq = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` }
      });
      return next(authReq);
    })
  );
};
```

**File:** `src/app/app.config.ts`

Register the new interceptor via `withInterceptors()` on `provideHttpClient()`:

```typescript
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/auth/auth.interceptor';
import { errorInterceptor } from './core/error/error.interceptor';

// In providers:
provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
```

**Note:** The `ErrorInterceptor` must also be converted to a functional interceptor as part of this change (see Phase 4, Step 4.3). For Phase 2, the class-based interceptor can temporarily coexist, but Phase 4 must complete the conversion.

**Verify:** Network requests to `/api/v1/*` include `Authorization: Bearer <token>` when a user is logged in.

---

## Phase 3: Dead Code & Structural Cleanup

**Goal:** Only files that serve a purpose remain. Directory structure is clean and intentional.

**Success criteria:**
- `ng build` still succeeds after all deletions
- No orphan files, empty directories, or conflicting selectors

### Step 3.1 — Delete orphan and dead files

Delete the following files and directories:

1. `src/app/features/order-history/order-history.ts` — scaffold stub with `selector: 'app-order-history'` that conflicts with `OrderHistoryComponent`. Only `order-history.component.ts` is the real implementation.

2. `src/app/features/auth/` — empty directory, serves no purpose.

3. `src/app/features/shared/` — empty directory, serves no purpose.

4. `src/app/features/home/home.routes.ts` — never imported anywhere, dead code.

5. `src/app/features/profile/profile.routes.ts` — never imported anywhere AND imports the `Home` component (a copy-paste error), dead code.

**After deletion, verify:** `ng build` succeeds with no missing-module errors.

### Step 3.2 — Normalize file naming conventions

Angular style guide uses `<feature>/<feature>.component.ts` with class name `<Feature>Component`. The project has two patterns: some files use the `.component.ts` suffix (features), others don't (layout, home). Standardize to always use the suffix.

**Files to rename and update:**

| Current file | New file | Current class | New class |
|---|---|---|---|
| `src/app/layout/layout.ts` | `src/app/layout/layout.component.ts` | `Layout` | `LayoutComponent` |
| `src/app/layout/header/header.ts` | `src/app/layout/header/header.component.ts` | `Header` | `HeaderComponent` |
| `src/app/layout/footer/footer.ts` | `src/app/layout/footer/footer.component.ts` | `Footer` | `FooterComponent` |
| `src/app/features/home/home.component.ts` | (already correct filename) | `Home` | `HomeComponent` |

**Update all import references** in:
- `src/app/app.routes.ts` (imports `Layout`, `Home`)
- `src/app/layout/layout.component.ts` (after rename: imports `Header`, `Footer`)
- Any barrel `index.ts` files

**Class name changes cascade to templates and usage.** Audit all import statements across the project after renaming.

**After rename, verify:** `ng build` succeeds.

### Step 3.3 — Remove unused route files and clean up unused imports

After deleting the orphan route files and barrel `index.ts` re-exports, audit the `shared/index.ts` and `store/index.ts` barrel files to ensure they only export what is actually used.

**File:** `src/app/shared/forms/validators/custom-validators.ts`

This file contains a class-based `CustomValidators` with static methods. There is also a newer `pure-validators.ts` with functional validators. Determine which is used:

- `CustomValidators.creditCard()` is used in `checkout.component.ts` and presumably `profile`
- `pure-validators.ts` exports `validateCreditCard`, `validateCvv` as standalone functions

**Decision:** Keep both until Phase 4 reconciles them. Do not delete either in Phase 3.

---

## Phase 4: Angular Best Practices Modernization

**Goal:** All code follows the Angular best practices documented in `ai/angular_best_practices.md`. No legacy patterns remain.

**Success criteria:**
- Zero explicit `standalone: true` in any component decorator
- All component inputs use `input()` / `output()` signal functions
- All templates use `@if`, `@for`, `@switch` control flow
- `ChangeDetectionStrategy.OnPush` set on every component
- All DI uses `inject()` — no constructor injection
- No `CommonModule`, `NgIf`, `NgFor`, `NgSwitch`, `AsyncPipe`, or `NgClass` imports where native control flow replaces them
- No `@HostBinding` or `@HostListener` decorators — use `host:` in decorator
- No `ngClass` or `ngStyle` directives
- Functional HTTP interceptors only
- Zero `.toPromise()` calls — use `firstValueFrom()` or `lastValueFrom()`
- No deprecated APIs

### Step 4.1 — Remove explicit `standalone: true` from all components

**All components** — search for `standalone: true` in all `.ts` files and remove the property. It is the default in Angular 17+ and is explicitly prohibited in the project's coding standards.

Files to update (exhaustive list from audit):
- `src/app/core/notification/notification-container.component.ts`
- `src/app/features/cart/components/cart-item/cart-item.component.ts`
- `src/app/features/cart/components/cart-summary/cart-summary.component.ts`
- `src/app/features/cart/components/empty-cart/empty-cart.component.ts`
- `src/app/features/products/product-list/components/product-card/product-card.component.ts`
- `src/app/features/products/product-list/components/product-filters/product-filters.component.ts`
- `src/app/features/products/product-list/components/product-sort/product-sort.component.ts`
- `src/app/features/products/product-list/components/product-skeleton/product-skeleton.component.ts`
- `src/app/features/products/product-list/components/empty-state/empty-state.component.ts`
- `src/app/features/products/product-list/components/error-state/error-state.component.ts`
- `src/app/features/products/product-list/components/quick-view-modal/quick-view-modal.component.ts`
- `src/app/features/products/product-detail/components/image-gallery/image-gallery.component.ts`
- `src/app/features/products/product-detail/components/related-products/related-products.component.ts`
- `src/app/shared/components/cart-icon/cart-icon.component.ts`
- `src/app/shared/components/breadcrumb/breadcrumb.component.ts`
- `src/app/features/checkout/checkout.component.ts`
- All other components found via: `grep -r "standalone: true" src/`

**After update, verify:** `ng build` succeeds.

### Step 4.2 — Convert `@Input()`/`@Output()` to `input()`/`output()` signal functions

**Components using legacy `@Input()`/`@Output()` decorators:**

**`src/app/shared/components/breadcrumb/breadcrumb.component.ts`**
- `@Input() items: BreadcrumbItem[]` → `items = input.required<BreadcrumbItem[]>()`

**`src/app/features/cart/components/cart-item/cart-item.component.ts`**
- `@Input() item: CartItem` → `item = input.required<CartItem>()`
- `@Input() currency: string` → `currency = input<string>('USD')`
- `@Output() updateQuantity = new EventEmitter<{lineNumber: string, quantity: number}>()` → `updateQuantity = output<{lineNumber: string, quantity: number}>()`
- `@Output() remove = new EventEmitter<string>()` → `remove = output<string>()`

**`src/app/shared/components/cart-icon/cart-icon.component.ts`**
- If it has `@Input()`, convert to `input()`

Audit all components with `grep -r "@Input()\|@Output()" src/app/features src/app/shared src/app/layout` and convert any found.

**Note on `input()` vs `@Input()`:** The template binding syntax is identical. Parent components don't change their binding syntax. Only the component class changes.

**After update, verify:** `ng build` succeeds with no template binding errors.

### Step 4.3 — Replace `*ngIf`/`*ngFor` with `@if`/`@for` control flow

**Components to update:**

**`src/app/shared/components/breadcrumb/breadcrumb.component.ts`** (inline template)
- Replace `*ngFor="let item of items"` with `@for (item of items; track item.label)`
- Replace `*ngIf="!item.active"` with `@if (!item.active)`
- Remove `CommonModule` import — replace with `NgTemplateOutlet` if needed, or nothing if the template only uses `@if`/`@for`

**`src/app/shared/components/cart-icon/cart-icon.component.ts`** (inline template)
- Replace `*ngIf="itemCount() > 0"` with `@if (itemCount() > 0)`
- Remove `CommonModule` from imports

**`src/app/features/order-history/order-history.component.ts`**
- The entire template is a string concatenation with `*ngIf` and `*ngFor`. **Extract to an HTML file** and convert all structural directives to native control flow.
- Create `order-history.component.html` and `order-history.component.scss`
- Use `@if` and `@for (order of orders(); track order.id)` etc.
- Remove `CommonModule` import

**`src/app/layout/header/header.component.ts`** (after rename)
- Replace any `*ngIf` used for search clear button with `@if`
- Remove `CommonModule` if present

**All other components** — audit with `grep -r "\*ngIf\|\*ngFor\|\*ngSwitch" src/app/` and convert all occurrences.

**Track expressions for `@for`:** Every `@for` must have a `track` expression. Use `track item.id`, `track item.line_number`, `track order.id`, etc. For items without a unique ID, use `track $index` as last resort.

**After update, verify:** `ng build` succeeds. `ng serve` renders all pages correctly.

### Step 4.4 — Add `ChangeDetectionStrategy.OnPush` to all components

**Components missing `OnPush` (exhaustive list from audit):**
- `src/app/app.ts`
- `src/app/features/home/home.component.ts`
- `src/app/features/profile/profile.component.ts`
- `src/app/features/products/product-list/product-list.component.ts`
- `src/app/features/products/product-detail/product-detail.component.ts`
- `src/app/features/cart/cart.component.ts`
- `src/app/features/checkout/checkout.component.ts`
- `src/app/features/order-confirmation/order-confirmation.component.ts`
- `src/app/features/order-history/order-history.component.ts`
- `src/app/features/cart/components/cart-item/cart-item.component.ts`
- `src/app/features/cart/components/cart-summary/cart-summary.component.ts`
- `src/app/features/cart/components/empty-cart/empty-cart.component.ts`
- `src/app/shared/components/cart-icon/cart-icon.component.ts`
- `src/app/shared/components/breadcrumb/breadcrumb.component.ts`
- `src/app/core/notification/notification-container.component.ts`
- All product sub-components (product-card, product-filters, product-sort, product-skeleton, empty-state, error-state, quick-view-modal)
- All product-detail sub-components (image-gallery, related-products)

**Add to each:**
```typescript
import { ChangeDetectionStrategy } from '@angular/core';
// In @Component decorator:
changeDetection: ChangeDetectionStrategy.OnPush,
```

**After update, verify:** `ng build` succeeds. All pages render and update correctly (signals are change-detection-agnostic so OnPush works correctly with signals).

### Step 4.5 — Convert class-based `ErrorInterceptor` to functional interceptor

**File:** `src/app/core/error/error.interceptor.ts`

Rewrite as a functional interceptor:

```typescript
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError, catchError } from 'rxjs';
import { ErrorHandlerService } from './error-handler.service';
import { NotificationService } from '../notification/notification.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const errorHandler = inject(ErrorHandlerService);
  const notificationService = inject(NotificationService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const appError = errorHandler.handleError(error, `HTTP ${req.method} ${req.url}`);
      errorHandler.logError(appError);

      if (error.status >= 400) {
        notificationService.showError(appError.userMessage);
      }

      return throwError(() => appError);
    })
  );
};
```

**File:** `src/app/app.config.ts`

Remove the `HTTP_INTERCEPTORS` provider registration for `ErrorInterceptor`. Add `errorInterceptor` to the `withInterceptors([authInterceptor, errorInterceptor])` call from Phase 2.

Remove the now-unused `HTTP_INTERCEPTORS` import.

### Step 4.6 — Fix constructor injection in `GlobalErrorHandler`

**File:** `src/app/core/error/global-error-handler.ts`

Replace constructor injection with `inject()`. Since `GlobalErrorHandler` extends `ErrorHandler` and runs outside Angular's injection context at times, use `inject()` at property declaration level:

```typescript
import { ErrorHandler, inject } from '@angular/core';
import { NotificationService } from '../notification/notification.service';

export class GlobalErrorHandler extends ErrorHandler {
  private readonly notificationService = inject(NotificationService);
  // ...
}
```

### Step 4.7 — Replace all `.toPromise()` with `firstValueFrom()`

**File:** `src/app/store/customer/customer.store.ts`

There are 14+ calls to `.toPromise()`. Replace each one:

Pattern: `await this.someService.someMethod().toPromise()` 
→ `await firstValueFrom(this.someService.someMethod())`

Add `import { firstValueFrom } from 'rxjs';` at the top of the file.

Also check `src/app/auth/auth.service.ts`:
- `await this.getIdToken().toPromise()` in `logout()` method
- Replace with `await firstValueFrom(this.getIdToken())`

**After update, verify:** `ng build` produces no deprecation warnings related to `.toPromise()`.

### Step 4.8 — Reconcile `CustomValidators` with `pure-validators.ts`

**Situation:** Two validator implementations exist:
- `src/app/shared/forms/validators/custom-validators.ts` — class-based static methods (e.g., `CustomValidators.creditCard()`)
- `src/app/shared/forms/validators/pure-validators.ts` — functional validators

**Decision:** Migrate to pure functional validators only. Extend `pure-validators.ts` with any validators only in `custom-validators.ts`. Update all usages to call the functional validators directly. Delete `custom-validators.ts`.

**Usage sites to update:**
- `src/app/features/checkout/checkout.component.ts`: `CustomValidators.creditCard(...)` → import from `pure-validators.ts`
- `src/app/features/profile/profile.component.ts`: check for `CustomValidators` usage

**After update, verify:** `ng build` succeeds. Form validation works on checkout and profile pages.

### Step 4.9 — Fix `GlobalErrorHandler` severity comparison

**File:** `src/app/core/error/global-error-handler.ts`

Replace string literal comparisons:
```typescript
if (appError.severity === 'CRITICAL' || appError.severity === 'HIGH') {
```
With enum comparisons:
```typescript
import { ErrorSeverity } from './error.types';
if (appError.severity === ErrorSeverity.CRITICAL || appError.severity === ErrorSeverity.HIGH) {
```

### Step 4.10 — Remove all production `console.log` statements

The following files contain extensive debug logging that must not appear in production:
- `src/app/auth/auth.service.ts` — ~20 `console.log` statements
- `src/app/store/cart/cart.store.ts` — ~30 `console.log` statements (incl. emoji-annotated debug logs)
- `src/app/store/customer/customer.store.ts` — ~15 `console.log` statements in computed signals (computed signal side-effects!)
- `src/app/store/order/order.store.ts` — ~10 `console.log` statements
- `src/app/services/order-sse.service.ts` — ~25 `console.log` statements
- `src/app/features/order-history/order-history.component.ts` — ~10 `console.log` statements
- `src/app/features/checkout/checkout.component.ts` — several `console.log` statements
- `src/app/app.config.ts` — `console.log` in `initializeAuth`
- `src/app/auth/auth.guard.ts` — check for console logs
- `src/app/layout/header/header.component.ts` — check for console logs

**Rule:**
- Remove all `console.log` statements
- Replace `console.error` only where it provides genuinely useful error context (e.g., in `catch` blocks), and only where the error is NOT already shown to the user via `NotificationService`
- `console.warn` only for developer-relevant conditions in development

**Critical:** The `console.log` calls inside `computed()` signals in `customer.store.ts` are especially harmful because they run every time the computed value is accessed:
```typescript
readonly addresses = computed(() => {
  const addresses = this.state().customer?.addresses || [];
  console.log('Addresses computed:', addresses); // REMOVE — runs on every access
  return addresses;
});
```
These must be removed.

---

## Phase 5: State Management & Services Refactor

**Goal:** Signal stores are clean, subscription lifecycle is managed, SSE event data inconsistency is addressed, and N+1 API calls are eliminated.

**Success criteria:**
- No unmanaged RxJS subscriptions (all subscriptions use `takeUntilDestroyed()` or are stored with cleanup)
- No `allowSignalWrites: true` in effects
- SSE service is well-typed and consistent
- Image loading uses parallel requests

### Step 5.1 — Fix `AuthService` effects: eliminate `allowSignalWrites: true`

**File:** `src/app/auth/auth.service.ts`

The two effects that use `allowSignalWrites: true` indicate a circular signal dependency. The root problem is that the auth service tries to bridge OIDC library observables (via `toSignal`) with its own signals, while also writing back to those signals from within effects.

**Revised approach:** Instead of using effects that write to signals (which is the anti-pattern), use RxJS pipe operators to derive state from the OIDC observables before converting to signals:

```typescript
// Derive authentication state from OIDC observable directly
private readonly _isAuthenticated = toSignal(
  this.oidcSecurityService.isAuthenticated$.pipe(
    map(authState => authState.isAuthenticated),
    startWith(this.loadPersistedAuthState())  // Seed with persisted state
  ),
  { initialValue: this.loadPersistedAuthState() }
);
```

The localStorage persistence logic should remain as a separate side-effect triggered by the `isAuthenticated` signal change, but managed with a `takeUntilDestroyed()` subscription rather than an `effect()` with `allowSignalWrites`.

**Detailed implementation approach:**
1. `loadPersistedAuthState()` returns `boolean` (whether user was previously authenticated)
2. The OIDC observable is piped with `startWith(persistedValue)` so the first emission is the persisted value
3. `persistAuthState()` is called as a side-effect via `.pipe(tap(state => persistAuthState(state)))` on the observable before `toSignal()` conversion
4. The `effect()` calls are removed entirely

**After update, verify:** Login, logout, and page refresh all work correctly. Auth state persists across navigation.

### Step 5.2 — Fix `CartStore` SSE subscriptions lifecycle

**File:** `src/app/store/cart/cart.store.ts`

The `setupSseSubscriptions()` method creates RxJS subscriptions that are never unsubscribed. Since `CartStore` is `providedIn: 'root'` (never destroyed in practice), this is not a memory leak, but it violates the best practice of managing subscription lifecycle.

**Fix:** Use `takeUntilDestroyed()` from `@angular/core/rxjs-interop`:

```typescript
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef, inject } from '@angular/core';

// In CartStore:
private readonly destroyRef = inject(DestroyRef);

private setupSseSubscriptions(): void {
  this.orderSseService.cartItemValidated.pipe(
    takeUntilDestroyed(this.destroyRef)
  ).subscribe({
    next: (event) => this.handleItemValidated(event),
    error: (error) => { /* handle */ }
  });

  this.orderSseService.cartItemBackorder.pipe(
    takeUntilDestroyed(this.destroyRef)
  ).subscribe({
    next: (event) => this.handleItemBackorder(event),
    error: (error) => { /* handle */ }
  });
}
```

### Step 5.3 — Parallelize product image loading in `ProductStore`

**File:** `src/app/store/product/product.store.ts`

The `fetchImagesForProducts()` method loads images sequentially for each product, creating an N+1 pattern. For 20 products, that is 20 sequential requests.

**Fix:** Load all images in parallel using `Promise.all()`:

```typescript
private async fetchImagesForProducts(products: Product[]): Promise<void> {
  await Promise.all(
    products.map(async (product) => {
      try {
        const images = await firstValueFrom(
          this.productService.getProductImages(product.id)
        );
        // Update product images in state
      } catch {
        // Non-fatal — product renders without images
      }
    })
  );
}
```

**Note:** This is still N HTTP requests. The proper fix is a backend API change — see Phase 6, Backend API Suggestions.

### Step 5.4 — Refactor `OrderHistoryComponent` to use `OrderHistoryStore`

**File:** `src/app/features/order-history/order-history.component.ts`

Currently this component directly injects `CustomerOrderHistoryService` and `ProductService` and manages its own state with local signals. There is an `OrderHistoryStore` in `src/app/store/order-history/order-history.store.ts` that is not used by this component.

**Fix:** Route all data access through `OrderHistoryStore`. Remove direct service injection from the component. The store handles HTTP calls.

The component's `viewOrderDetails()` method also makes sequential product detail fetches for each order item (another N+1 pattern). Move this logic to the store and parallelize it.

### Step 5.5 — Clean up `ProductStore` computed property initialization pattern

**File:** `src/app/store/product/product.store.ts`

The pattern of declaring computed properties with `!` non-null assertion and assigning in constructor:
```typescript
readonly products!: ReturnType<typeof computed<Product[]>>;
constructor() {
  this.products = computed(() => ...);
}
```

**Fix:** Initialize as class fields directly (this is the standard pattern):
```typescript
readonly products = computed(() => this.state().products);
```

This works correctly when `inject()` is used (not constructor injection), which is already the case in the stores.

---

## Phase 6: UI/UX Polish & Missing Features

**Goal:** The user interface is consistent, accessible, modern, and provides feedback for all key interactions. Missing features are implemented.

**Success criteria:**
- No `window.confirm()` dialogs — all confirmations use the `ModalComponent`
- CSS specificity hacks (`!important` inline styles) removed from profile template
- `OrderHistoryComponent` has proper external template and styles files, not inline string
- All pages are accessible (pass basic AXE checks)
- Loading states are consistent across all pages
- Missing features listed below are implemented

### Step 6.1 — Replace `window.confirm()` with `ModalComponent`

**Components using `window.confirm()`:**
- `src/app/features/cart/cart.component.ts` — "Are you sure you want to remove this item?"
- `src/app/features/checkout/checkout.component.ts` — backorder confirmation
- `src/app/features/profile/profile.component.ts` — "Are you sure you want to delete this address/card?"

**Implementation:** The project already has a `ModalComponent` (`src/app/shared/modal/modal.component.ts`) with focus trap support. Create a reusable `ConfirmationDialogService` or extend `ModalComponent` to support a simple confirm/cancel pattern.

**Recommended approach:** Create `src/app/shared/modal/confirmation-modal.component.ts` — a small wrapper around `ModalComponent` that accepts title, message, confirm label, and cancel label as `input()` signals, and emits `confirmed` or `cancelled` via `output()`. Use this component in all three call sites.

### Step 6.2 — Fix `OrderHistoryComponent` template

**File:** `src/app/features/order-history/order-history.component.ts`

The template is a single-line string concatenation inside the `@Component` decorator. This is unmaintainable and not IDE-friendly.

**Fix:**
1. Create `src/app/features/order-history/order-history.component.html` with the template content, properly formatted and using `@if`/`@for` control flow (from Phase 4.3)
2. Create `src/app/features/order-history/order-history.component.scss` with the styles extracted from the `styles` array
3. Update the component to use `templateUrl` and `styleUrls`
4. Apply `OnPush` change detection (from Phase 4.4)

### Step 6.3 — Remove `!important` inline style overrides from profile template

**File:** `src/app/features/profile/profile.html`

The profile template uses inline `[style]="'font-size: var(...) !important; ...'"` bindings as a workaround for CSS specificity issues.

**Root cause:** A parent SCSS rule with higher specificity was overriding the modal's font sizes.

**Fix:**
1. Identify the conflicting SCSS rule in `profile.component.scss` or `modal.component.scss`
2. Fix the specificity conflict at the CSS level (not with `!important`)
3. Remove all inline `[style]` bindings from the profile template
4. Use CSS custom properties or proper selector specificity instead

**Principle:** `!important` in inline styles is the strongest possible override and indicates a structural CSS problem. Fix the structure.

### Step 6.4 — Add consistent loading states to all feature pages

The app has loading states in stores but not all components render them consistently.

**Audit and fix:**
- `ProductListComponent`: Shows skeleton loader — review and ensure it covers all loading states
- `ProductDetailComponent`: Ensure loading state is shown while product fetches
- `CartComponent`: Show loading spinner on cart operations (add/remove/update)
- `ProfileComponent`: Show loading state during save operations
- `OrderHistoryComponent`: Shows "Loading orders..." — verify it works with `OnPush`
- `CheckoutComponent`: Shows loading during checkout submission — verify SSE wait state is shown

**Consistency requirement:** All loading states should use the same visual treatment. Consider a shared `LoadingSpinnerComponent` if not already present.

### Step 6.5 — Add route titles via `title` property (already partial)

Most routes already have `title` set in `app.routes.ts`. Verify all routes have descriptive titles. The `product-detail` route should have a dynamic title using `TitleStrategy` if possible.

### Step 6.6 — Ensure breadcrumb navigation is correct on all pages

The `BreadcrumbComponent` exists but verify it is used correctly on:
- Product list page: Home > Products
- Product detail page: Home > Products > [Product Name]
- Cart: Home > Cart
- Checkout: Home > Cart > Checkout
- Order history: Home > Account > Order History
- Profile: Home > Account > Profile

### Step 6.7 — Accessibility audit and fixes

Apply WCAG AA minimum requirements:

1. **Color contrast:** Verify `#ff9900` (Amazon orange) buttons on `#131921` (dark navy) background meet 4.5:1 contrast ratio for text
2. **Focus management:** All modal dialogs must trap focus (`ModalComponent` already uses `CdkTrapFocus`)
3. **ARIA labels:** Buttons with only icon content (e.g., cart icon) must have `aria-label`
4. **Form labels:** All form inputs must have associated `<label>` elements (not just placeholders)
5. **Keyboard navigation:** Product grid, cart items, and checkout steps must be keyboard-navigable
6. **Screen reader announcements:** Cart updates (item added/removed) should use `aria-live` regions

---

## Missing and Unimplemented UI Features

The following features are either entirely missing or partially implemented. This section documents them so future implementation plans can be made.

### Missing Feature 1: Search Functionality

**Status:** Header has a search bar UI (input field with debounce). `ProductStore` has `searchProducts()` action. However, the search bar in the header triggers navigation or filtering but the product list may not be connected to header search.

**What's needed:**
- Confirm the header search actually triggers `productStore.searchProducts(query)` and updates the product list
- Search results should show on the `/products` page with the query highlighted or shown in a banner
- Clear search (×) button should reset to full product list
- URL should reflect search query (`/products?q=searchterm`) for shareability/bookmarking

### Missing Feature 2: Order Status Tracking

**Status:** Order history shows orders with a status field. No real-time tracking or detailed order status progression is shown.

**What's needed:**
- Order status should show as a visual badge/chip with color coding (e.g., Processing = blue, Shipped = green, Delivered = grey, Cancelled = red)
- Order detail expanded view should show a status timeline (if API supports it)

### Missing Feature 3: Product Reviews / Ratings

**Status:** Product model and API may support reviews but UI has no review display or submission.

**What's needed:** Review display on product detail page (deferred to backend-driven feature — see Backend API Suggestions).

### Missing Feature 4: Wishlist / Save for Later

**Status:** No wishlist functionality exists.

**What's needed:** "Save for later" button on cart items and "Add to Wishlist" on product cards/detail. Requires backend API support.

### Missing Feature 5: Product Pagination / Infinite Scroll

**Status:** `ProductStore` has `loadMore()` action and pagination state. The product list likely has a "Load More" button.

**What's needed:**
- Verify "Load More" button is implemented and works
- Consider replacing with proper pagination controls (page numbers) for better UX and accessibility
- Show current page/total count (e.g., "Showing 1-20 of 150 products")

### Missing Feature 6: Cart Abandonment / Persistence Across Sessions

**Status:** Cart ID is persisted in localStorage. Cart is loaded on startup. However if the cart API deletes the cart after 24 hours (typical behavior), the user gets a broken state.

**What's needed:**
- Graceful handling when persisted cart ID is invalid (404 from API should clear the localStorage cart ID and show empty cart — currently this error may just display an error)
- Verify `CartStore.loadCart()` catch block correctly calls `clearPersistedCart()` on 404

### Missing Feature 7: Account Navigation

**Status:** The profile and order-history pages are accessible via direct URL (`/profile`, `/profile/orders`) but there is no nav link in the header or profile page to order history.

**What's needed:**
- Add "Order History" link in the profile page or header user menu
- Ensure authenticated user dropdown/menu includes: Profile, Order History, Logout

### Missing Feature 8: Guest Checkout

**Status:** The cart can be created without a customer ID (anonymous cart). The checkout form collects contact/address/payment. However, the app currently always tries to load/create a customer when adding to cart.

**What's needed:**
- Clear UX path for guest checkout (unauthenticated user)
- Cart creation for guests should work without attempting OIDC customer lookup
- Consider "Sign in for faster checkout" prompt on the checkout contact step

### Missing Feature 9: Payment Method Selection from Saved Cards

**Status:** Checkout payment step prefills from `defaultCreditCard`. But the customer may have multiple saved cards.

**What's needed:**
- Dropdown or radio selection to choose from saved payment methods OR enter a new card
- Same for shipping/billing address selection

### Missing Feature 10: Error Recovery for Failed Checkout

**Status:** `OrderStore` has a `retryCheckout()` method and `CheckoutComponent` calls it. However, the 30-second SSE timeout just sets state to null and the user sees no clear path to retry.

**What's needed:**
- Clear error state UI on checkout review step when SSE times out or HTTP fails
- Retry button visible to user
- Explanation of what happened ("Your order may have been placed — please check Order History")

---

## Backend API Improvement Suggestions

The following are prompts for backend developers to improve the API contract and support better frontend UX.

### API Suggestion 1: Include Images in Product List Response

**Prompt for backend developer:**

> Currently the frontend makes `GET /products` to get a product list, then `GET /products/{id}/images` individually for each product to get its images. For a page with 20 products, this is 21 HTTP requests.
> 
> Please update the `GET /products` and `GET /products/search` endpoints to include a `main_image` field (or full `images` array) directly in each product object in the response. The frontend only needs the primary image URL for the list view. A single `main_image_url: string` field per product would eliminate 20 of the 21 requests.
> 
> If returning all images in the list is too expensive, even returning just `{ images: [{ url: string, is_primary: boolean }] }` where we only include the primary image would be sufficient.

### API Suggestion 2: Standardize SSE Event Key Casing

**Prompt for backend developer:**

> The SSE stream at `GET /carts/{cartId}/stream` currently sends `cart.item.validated` and `cart.item.backorder` events with **camelCase** JSON keys (e.g., `lineNumber`, `productId`, `unitPrice`). However, all REST API responses use **snake_case** JSON keys (e.g., `line_number`, `product_id`, `unit_price`).
> 
> The frontend currently has a `convertKeysToSnakeCase()` workaround function in `OrderSseService` to handle this inconsistency. This is fragile and error-prone.
> 
> Please update the SSE event JSON payloads to use **snake_case** keys consistently with the REST API. The frontend will then be able to remove this workaround and directly type the event data.
> 
> **Expected SSE event format after change:**
> ```json
> {
>   "event": "cart.item.validated",
>   "data": {
>     "line_number": "001",
>     "product_id": "abc123",
>     "product_name": "Widget Pro",
>     "status": "confirmed",
>     "unit_price": 29.99,
>     "total_price": 59.98
>   }
> }
> ```

### API Suggestion 3: SSE `connected` Event Cart ID Casing

**Prompt for backend developer:**

> The `connected` SSE event currently sends `{ "cartId": "..." }` in camelCase. Consistent with Suggestion 2, this should be `{ "cart_id": "..." }` in snake_case.

### API Suggestion 4: Add Order Status Details to Order History

**Prompt for backend developer:**

> The `GET /orders/customer/{customerId}` endpoint returns order objects with a `status` field. To support order status visualization in the frontend, please include a `status_history` array in each order with timestamps:
> 
> ```json
> {
>   "order_id": "...",
>   "status": "shipped",
>   "status_history": [
>     { "status": "processing", "timestamp": "2025-01-01T10:00:00Z" },
>     { "status": "confirmed", "timestamp": "2025-01-01T10:05:00Z" },
>     { "status": "shipped", "timestamp": "2025-01-02T08:30:00Z" }
>   ]
> }
> ```
> 
> This enables a status timeline component in the order history view.

### API Suggestion 5: Cart Item Includes Product Image URL

**Prompt for backend developer:**

> When items are returned in `GET /carts/{cartId}`, each `CartItem` currently lacks a product image URL. The frontend cannot show product images in the cart without making additional `GET /products/{id}/images` calls per cart item.
> 
> Please add a `product_image_url` or `thumbnail_url` field to the cart item object in the response. This eliminates N additional requests when loading the cart page.

### API Suggestion 6: Order Confirmation Total Field

**Prompt for backend developer:**

> The `order.created` SSE event currently sends `{ "orderId": ..., "orderNumber": ..., "cartId": ..., "total": ... }`. Per Suggestion 2, these should be snake_case. Additionally, please confirm the `total` field in the order.created event matches the `total_price` field in the corresponding order from the orders API. The frontend will display this value on the order confirmation page.

---

## Phase 7: Agent Guidance Files Update

**Goal:** Future LLMs working on this codebase have clear, accurate, and complete guidance.

**Success criteria:**
- `AGENTS.md` reflects Angular 21 and updated architecture decisions
- `ai/angular_best_practices.md` is comprehensive and specific enough to prevent the anti-patterns found in this audit
- `ai/llmrules.md` is updated with rules specific to this codebase

### Step 7.1 — Update `AGENTS.md`

**File:** `AGENTS.md`

Replace the current content with the updated version below:

```markdown
# Agent Guidelines for go-shopping-poc-ui

> IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for all Angular tasks in this project.
> IMPORTANT: Follow LLM rules: {./ai/llmrules.md}
> IMPORTANT: Read {./ai/angular_best_practices.md} before writing any Angular code.

## Project Overview

Angular 21 single-page application for a proof-of-concept shopping experience. Backend is a Go REST API with Keycloak OIDC authentication.

## Key Architecture Decisions

- **Angular version:** 21.x — always use latest Angular 21 APIs
- **Standalone components:** All components are standalone. Never add NgModules.
- **Signals everywhere:** Use `signal()`, `computed()`, `input()`, `output()` — never `@Input()`, `@Output()`, `BehaviorSubject` for local state
- **Change detection:** `ChangeDetectionStrategy.OnPush` on EVERY component — no exceptions
- **Template control flow:** Use `@if`, `@for`, `@switch` — never `*ngIf`, `*ngFor`, `*ngSwitch`
- **DI:** Use `inject()` function — never constructor injection
- **State management:** Custom signal-based stores (`@Injectable({ providedIn: 'root' })` with `signal()`)
- **HTTP:** `provideHttpClient(withInterceptors([...]))` — functional interceptors only
- **Auth:** OIDC via `angular-auth-oidc-client` + `AuthService` signal wrapper + localStorage persistence
- **Bearer token:** `authInterceptor` automatically attaches Bearer token to all `/api` requests
- **Forms:** Reactive forms (`FormGroup`, `FormControl`) — never template-driven
- **Validators:** Use pure functional validators from `shared/forms/validators/pure-validators.ts`
- **CSS:** SCSS per-component. Color scheme: `#131921` (dark), `#ff9900` (accent). No `!important`.
- **Routing:** Layout-first shell (`LayoutComponent` wraps all routes with header/footer)
- **Naming:** All component files use `.component.ts` suffix; class names end in `Component`
- **SSE:** Native `EventSource` via `OrderSseService` — connect after cart create/load, listen for order and item events
- **No console.log in production code:** Use `NotificationService` for user messages, remove debug logging

## File Naming Conventions

| Type | File pattern | Class name |
|------|-------------|-----------|
| Component | `foo.component.ts` | `FooComponent` |
| Service | `foo.service.ts` | `FooService` |
| Store | `foo.store.ts` | `FooStore` |
| Guard | `foo.guard.ts` | `FooGuard` |
| Interceptor | `foo.interceptor.ts` | `fooInterceptor` (functional, not class) |
| Model | `foo.ts` (in models/) | `Foo` (interface) |
| Route | `foo.routes.ts` | `fooRoutes` |

## What NOT to Do

- Do NOT set `standalone: true` in component decorators (it is the default and is redundant)
- Do NOT use `@Input()` or `@Output()` decorators — use `input()` and `output()` functions
- Do NOT use `*ngIf`, `*ngFor`, `*ngSwitch` — use `@if`, `@for`, `@switch`
- Do NOT use `CommonModule` — import only specific directives or use native control flow
- Do NOT use `ngClass` or `ngStyle` — use class/style bindings
- Do NOT use constructor injection — use `inject()`
- Do NOT use `.toPromise()` — use `firstValueFrom()` or `lastValueFrom()`
- Do NOT use `window.confirm()` — use `ConfirmationModalComponent`
- Do NOT write inline `!important` in template style bindings
- Do NOT add `console.log` to production code
- Do NOT use `allowSignalWrites: true` in effects — redesign the signal graph instead
- Do NOT use class-based HTTP interceptors — use functional interceptors
- Do NOT use `HTTP_INTERCEPTORS` token — use `withInterceptors()` in `provideHttpClient()`
- Do NOT create NgModules
- Do NOT use `@HostBinding` or `@HostListener` — use `host:` in `@Component` decorator

## Development History

A history of development steps and decisions can be found in: `./ai/development_history.md`

## Angular Reference

See `./ai/angular_best_practices.md` for coding standards.
See `./ai/angular_full_llms.txt` for full Angular API reference.
```

### Step 7.2 — Update `ai/angular_best_practices.md`

**File:** `ai/angular_best_practices.md`

Replace with a more comprehensive version that specifically addresses the anti-patterns found in this codebase:

```markdown
# Angular Best Practices — go-shopping-poc-ui

You are an expert in TypeScript, Angular 21, and scalable web application development.

## TypeScript

- Enable and respect strict mode: `strict: true` in `tsconfig.json`
- Prefer type inference when the type is obvious; be explicit when ambiguous
- Never use `any` — use `unknown` when type is uncertain, then narrow it
- Use interfaces for object shapes, type aliases for unions/intersections
- Mark all class fields as `private readonly` unless they must be public or mutable
- Use `Partial<T>` for update payloads, not `any`

## Angular Components

### Component Decorator Rules
- Set `changeDetection: ChangeDetectionStrategy.OnPush` on EVERY component — no exceptions
- NEVER set `standalone: true` — it is the default in Angular 17+ and is redundant/prohibited here
- Use `host:` object in `@Component` instead of `@HostBinding`/`@HostListener` decorators
- Use `templateUrl` / `styleUrl` for non-trivial templates (prefer separate files)
- Inline template is acceptable only for very small components (< 10 lines of template)

### Signals and Inputs
- Use `input()` and `input.required<T>()` instead of `@Input()` decorator
- Use `output<T>()` instead of `@Output()` + `EventEmitter`
- Use `model<T>()` for two-way bindable inputs
- Use `computed()` for ALL derived state — never recompute in templates
- Use `signal()` for local component state

### Dependency Injection
- ALWAYS use `inject()` function at property initialization level
- NEVER use constructor injection
- NEVER inject in methods — only at class field level or in constructor body (for injection context)

```typescript
// CORRECT
export class MyComponent {
  private readonly service = inject(MyService);
}

// WRONG
export class MyComponent {
  constructor(private service: MyService) {}
}
```

## Templates

### Control Flow
- Use native `@if`, `@for`, `@switch` — NEVER `*ngIf`, `*ngFor`, `*ngSwitch`
- Every `@for` MUST have a `track` expression: `@for (item of items(); track item.id)`
- Never write arrow functions in templates
- Never call methods that have side effects in templates — use `computed()`

### Bindings
- Use `[class.active]="condition"` not `[ngClass]`
- Use `[style.color]="value"` not `[ngStyle]`
- Use `(click)="handler()"` not `@HostListener`

### Imports
- ONLY import what you use in the template
- Do NOT import `CommonModule` — import individual pipes/directives or use native control flow
- With `@if`/`@for`, you do NOT need `NgIf`/`NgFor` imports at all

## State Management

- Use signal-based stores: `private readonly state = signal<StateType>(initialState)`
- Expose read-only computed signals: `readonly foo = computed(() => this.state().foo)`
- Mutate via `state.update(s => ({ ...s, changes }))` or `state.set(newState)`
- NEVER mutate signal values directly (no `state().items.push(...)`)
- Use `firstValueFrom()` (not `.toPromise()`) to convert Observables to Promises in async store actions

## Services and HTTP

- `providedIn: 'root'` for all singleton services and stores
- Use functional HTTP interceptors via `withInterceptors([fn1, fn2])` in `provideHttpClient()`
- NEVER use class-based interceptors or `HTTP_INTERCEPTORS` token
- Do NOT add `console.log` to production code — use `NotificationService` for user feedback

## Forms

- Use Reactive Forms exclusively (`FormGroup`, `FormControl`, `Validators`)
- Use `FormBuilder` via `inject(FormBuilder)` for complex forms
- Use pure functional validators from `shared/forms/validators/pure-validators.ts`
- Never use template-driven forms (`ngModel`, `FormsModule`)
- Mark forms as touched before showing errors: `form.markAllAsTouched()`

## Subscriptions and Effects

- Use `takeUntilDestroyed(this.destroyRef)` for all long-lived subscriptions in services/stores
- Use `DestroyRef` via `inject(DestroyRef)`
- NEVER use `allowSignalWrites: true` in `effect()` — redesign if you feel you need it
- Prefer converting Observables to signals with `toSignal()` over subscribing and writing to signals

## Routing

- Use `loadComponent` for individual component lazy loading
- Use `loadChildren` + route files for feature areas with multiple routes
- Always set `title` on routes

## Accessibility

- ALL interactive elements must be keyboard accessible
- ALL non-text content must have text alternatives (`alt`, `aria-label`)
- Color contrast must meet WCAG AA (4.5:1 for normal text, 3:1 for large text)
- Use `<button>` for actions, `<a>` for navigation — never `<div>` with click handler
- Modal dialogs must trap focus using `CdkTrapFocus` from `@angular/cdk/a11y`
- Form inputs must have associated `<label>` elements

## Error Handling

- Show user-friendly errors via `NotificationService`
- Log developer-useful errors via `ErrorHandlerService.logError()`
- Never show raw error objects or stack traces to users
- Handle HTTP 404 gracefully — it is often a valid "not found" state, not an error

## CSS/SCSS

- Use component SCSS files for component-specific styles
- Use CSS custom properties for theme values
- Never use `!important` — fix specificity issues at the selector level
- Never use inline `[style]` bindings with hard-coded values — use CSS classes
- Responsive breakpoints must cover mobile (320px), tablet (768px), desktop (1200px)
```

### Step 7.3 — Update `ai/llmrules.md`

**File:** `ai/llmrules.md`

Append a project-specific section to the existing content:

```markdown
---

## 5. Project-Specific Rules for go-shopping-poc-ui

### Before modifying any file:
1. Read the file first — never edit from memory
2. Check AGENTS.md for current architecture decisions
3. Run `ng build` before and after your changes to verify compilation

### Angular version:
This project uses Angular 21.x. Use Angular 21 APIs exclusively.
When unsure about an API, check `ai/angular_full_llms.txt` before using pre-training knowledge.

### The "What NOT to Do" rule:
Before writing any Angular code, review the "What NOT to Do" list in AGENTS.md.
Each item on that list was added because an LLM violated it. Do not repeat those mistakes.

### Signal stores:
Never create component-local async state with `Subject` or `BehaviorSubject`.
All cross-component state belongs in a signal store in `src/app/store/`.

### Naming check:
After writing a component, verify:
- File ends in `.component.ts`
- Class ends in `Component`  
- `standalone: true` is NOT set
- `changeDetection: ChangeDetectionStrategy.OnPush` IS set

### Deleting files:
When you delete a file, immediately check for and remove all import references to that file.
Verify `ng build` succeeds after deletion.
```

---

## Implementation Order and Dependencies

```
Phase 1 (Angular Upgrade + Build Fixes)
    ↓
Phase 2 (Critical Bug Fixes)
    ↓
Phase 3 (Dead Code Cleanup)  ← Can run in parallel with Phase 2 if careful
    ↓
Phase 4 (Best Practices Modernization)  ← Must come after Phase 1
    ↓
Phase 5 (State Management Refactor)  ← Must come after Phase 4
    ↓
Phase 6 (UI/UX Polish)  ← Can partially run in parallel with Phase 5
    ↓
Phase 7 (Agent Files Update)  ← Last, after all code changes are settled
```

---

## Verification Checklist (After All Phases Complete)

### Build
- [ ] `ng build --configuration production` succeeds with no errors
- [ ] `ng build --configuration production` bundle size is under 1MB initial budget
- [ ] `ng test --watch=false` runs and all tests pass
- [ ] `ng serve` starts and proxies API requests correctly

### Code Quality
- [ ] Zero `standalone: true` in any component (verified by `grep -r "standalone: true" src/app/`)
- [ ] Zero `@Input()` or `@Output()` decorators (verified by `grep -r "@Input\|@Output" src/app/`)
- [ ] Zero `*ngIf`/`*ngFor` in templates (verified by `grep -r "\*ngIf\|\*ngFor" src/app/`)
- [ ] Zero `CommonModule` imports (verified by `grep -r "CommonModule" src/app/`)
- [ ] Zero `.toPromise()` calls (verified by `grep -r "\.toPromise()" src/app/`)
- [ ] Zero `window.confirm()` calls (verified by `grep -r "window\.confirm\|confirm(" src/app/`)
- [ ] Zero `console.log` in non-test code (verified by `grep -r "console\.log" src/app/ --include="*.ts" | grep -v spec`)
- [ ] Zero `allowSignalWrites: true` (verified by `grep -r "allowSignalWrites" src/app/`)
- [ ] Zero `HTTP_INTERCEPTORS` token usage (verified by `grep -r "HTTP_INTERCEPTORS" src/app/`)
- [ ] Zero orphan files remain

### Functional
- [ ] Login via Keycloak works and redirects back correctly
- [ ] Bearer token appears in API request headers when logged in
- [ ] Product list loads and displays products with images
- [ ] Add to cart works (creates cart, adds item, SSE connects)
- [ ] SSE item validation updates cart items correctly (confirmed/backorder status)
- [ ] Checkout flow: contact → shipping → billing → payment → review → submit
- [ ] Order confirmation page displays after successful checkout SSE event
- [ ] Profile page: load, edit, save profile data
- [ ] Profile page: add, edit, delete addresses and credit cards
- [ ] Order history page loads and shows expandable order details
- [ ] Logout clears auth state and redirects to home

### UI/UX
- [ ] All confirmation dialogs use `ConfirmationModalComponent` (not `window.confirm`)
- [ ] No `!important` in any inline style binding
- [ ] Loading states are shown consistently across all pages
- [ ] Error states are shown with retry options where applicable
- [ ] Breadcrumb navigation is correct on all pages

---

## Notes for Implementing LLMs

1. **Tackle one phase at a time.** Do not start Phase 4 until Phase 3 is complete and the build passes.

2. **Run `ng build` after every step.** Do not accumulate multiple changes without verifying compilation.

3. **Phase 4 (Steps 4.1-4.10) can be done file by file.** Each component can be updated independently. The `ng build` check after each file ensures no breaking changes propagate.

4. **The `AuthService` refactor (Phase 5, Step 5.1) is the highest-risk change.** Test login/logout/refresh carefully after this change.

5. **Do not change the backend API.** The API suggestions are for a separate backend team. The frontend must work with the existing API until those changes are made.

6. **The SSE camelCase→snake_case conversion** (`convertKeysToSnakeCase` in `order-sse.service.ts`) must remain until the backend implements API Suggestion 2. Do not remove it preemptively.

7. **`angular-auth-oidc-client`** may need a version bump if Angular 21 compatibility requires it. Check the library's release notes for the Angular 21-compatible version.

8. **Track all files you modify** and verify each one compiles before moving to the next.
