# Agent Guidelines for go-shopping-poc-ui

## Project Overview

Angular 21 single-page application for a proof-of-concept shopping experience. Backend is a Go REST API with Keycloak OIDC authentication. The codebase improvement plan is at `./ai/plans/claude_code_improvement_plan.md`.

## Key Architecture Decisions

- **Angular version:** 21.x — always use latest Angular 21 APIs
- **Standalone components:** All components are standalone. Never add NgModules.
- **Signals everywhere:** Use `signal()`, `computed()`, `input()`, `output()` — never `@Input()`, `@Output()`, or `BehaviorSubject` for local state
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
- **No console.log in production code:** Use `NotificationService` for user messages; remove all debug logging

## File Naming Conventions

| Type | File pattern | Class/export name |
|------|-------------|-------------------|
| Component | `foo.component.ts` | `FooComponent` |
| Service | `foo.service.ts` | `FooService` |
| Store | `foo.store.ts` | `FooStore` |
| Guard | `foo.guard.ts` | `FooGuard` |
| Interceptor | `foo.interceptor.ts` | `fooInterceptor` (functional, not a class) |
| Model | `foo.ts` (in `models/`) | `Foo` (TypeScript interface) |
| Route file | `foo.routes.ts` | `fooRoutes` |

## What NOT to Do

- Do NOT set `standalone: true` in component decorators (it is the default and is redundant)
- Do NOT use `@Input()` or `@Output()` decorators — use `input()` and `output()` functions
- Do NOT use `*ngIf`, `*ngFor`, `*ngSwitch` — use `@if`, `@for`, `@switch`
- Do NOT import `CommonModule` — import only specific directives or use native control flow
- Do NOT use `ngClass` or `ngStyle` — use class/style bindings
- Do NOT use constructor injection — use `inject()`
- Do NOT use `.toPromise()` — use `firstValueFrom()` or `lastValueFrom()`
- Do NOT use `window.confirm()` — use `ConfirmationModalComponent`
- Do NOT write inline `!important` in template style bindings — fix CSS specificity instead
- Do NOT add `console.log` to production code
- Do NOT use `allowSignalWrites: true` in effects — redesign the signal graph instead
- Do NOT use class-based HTTP interceptors — use functional interceptors
- Do NOT use `HTTP_INTERCEPTORS` token — use `withInterceptors()` in `provideHttpClient()`
- Do NOT create NgModules
- Do NOT use `@HostBinding` or `@HostListener` — use `host:` in `@Component` 

## Delegation Protocol (MANDATORY)

You must delegate via the Task tool. Do not research or implement directly.

- **@explore** — ALL code reading, searching, file investigation. Trigger: any task requiring >1 file read.
- **@general** — ALL multi-step implementation. Trigger: any task with >2 steps or >1 file write.
- **Primary agent role**: strategy, decisions, quality review only. Never read or write files directly beyond verifying a single line.
- Not delegating wastes context and produces lower quality work. Delegate early, delegate often.

## Reference Docs (read the one matching your task)

- LLM behavior rules: `.ai/llmrules.md`