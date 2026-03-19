# Agent Guidelines for go-shopping-poc-ui

> IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for all Angular tasks in this project.
> IMPORTANT: Follow LLM rules: `./ai/llmrules.md`
> IMPORTANT: Read `./ai/angular_best_practices.md` before writing any Angular code.

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
- Do NOT use `@HostBinding` or `@HostListener` — use `host:` in `@Component` decorator

**Development History**:
A history of development steps and decisions can be found in: `./ai/development_history.md`

## Angular Code Style & Best Practices

IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any Angular tasks.

See `./ai/angular_best_practices.md`
See `./ai/angular_full_llms.txt`

# Angular

Angular — Deliver web apps with confidence 🚀

## Table of Contents

- [What is Angular](https://angular.dev/overview)
- [Installation guide](https://angular.dev/installation)
- [Style Guide](https://next.angular.dev/style-guide)

## Components

- [What is a component](https://angular.dev/guide/components)
- [Component selectors](https://angular.dev/guide/components/selectors)
- [Styling components](https://angular.dev/guide/components/styling)
- [Accepting data with input properties](https://angular.dev/guide/components/inputs)
- [Custom events with output](https://angular.dev/guide/components/outputs)
- [Content projection](https://angular.dev/guide/components/content-projection)
- [Component lifecycle](https://angular.dev/guide/components/lifecycle)

## Templates guides

- [Template Overview](https://angular.dev/guide/templates)
- [Adding event listeners](https://angular.dev/guide/templates/event-listeners)
- [Binding text, properties and attributes](https://angular.dev/guide/templates/binding)
- [Control Flow](https://angular.dev/guide/templates/control-flow)
- [Template variable declaration](https://angular.dev/guide/templates/variables)
- [Deferred loading of components](https://angular.dev/guide/templates/defer) 
- [Expression syntax](https://angular.dev/guide/templates/expression-syntax)

## Directives

- [Directives overview](https://angular.dev/guide/directives)
- [Attribute directives](https://angular.dev/guide/directives/attribute-directives)
- [Structural directives](https://angular.dev/guide/directives/structural-directives)
- [Directive composition](https://angular.dev/guide/directives/directive-composition-api)
- [Optimizing images](https://angular.dev/guide/image-optimization)

## Signals 

- [Signals overview](https://angular.dev/guide/signals)
- [Dependent state with linkedSignal](https://angular.dev/guide/signals/linked-signal)
- [Async reactivity with resources](https://angular.dev/guide/signals/resource)

## Dependency injection (DI)

- [Dependency Injection overview](https://angular.dev/guide/di)
- [Understanding Dependency injection](https://angular.dev/guide/di/dependency-injection)
- [Creating an injectable service](https://angular.dev/guide/di/creating-injectable-service)
- [Configuring dependency providers](https://angular.dev/guide/di/dependency-injection-providers)
- [Injection context](https://angular.dev/guide/di/dependency-injection-context)
- [Hierarchical injectors](https://angular.dev/guide/di/hierarchical-dependency-injection)
- [Optimizing Injection tokens](https://angular.dev/guide/di/lightweight-injection-tokens)

## RxJS 

- [RxJS interop with Angular signals](https://angular.dev/ecosystem/rxjs-interop)
- [Component output interop](https://angular.dev/ecosystem/rxjs-interop/output-interop)

## Loading Data

- [HttpClient overview](https://angular.dev/guide/http)
- [Setting up the HttpClient](https://angular.dev/guide/http/setup)
- [Making requests](https://angular.dev/guide/http/making-requests)
- [Intercepting requests](https://angular.dev/guide/http/interceptors)
- [Testing](https://angular.dev/guide/http/testing)

## Forms
- [Forms overview](https://angular.dev/guide/forms)
- [Reactive Forms](https://angular.dev/guide/forms/reactive-forms)
- [Strictly types forms](https://angular.dev/guide/forms/typed-forms)
- [Template driven forms](https://angular.dev/guide/forms/template-driven-forms)
- [Validate forms input](https://angular.dev/guide/forms/form-validation)
- [Building dynamic forms](https://angular.dev/guide/forms/dynamic-forms)

## Routing
- [Routing overview](https://angular.dev/guide/routing)
- [Define routes](https://angular.dev/guide/routing/define-routes)
- [Show routes with outlets](https://angular.dev/guide/routing/show-routes-with-outlets)
- [Navigate to routes](https://angular.dev/guide/routing/navigate-to-routes)
- [Read route state](https://angular.dev/guide/routing/read-route-state)
- [Common routing tasks](https://angular.dev/guide/routing/common-router-tasks)
- [Creating custom route matches](https://angular.dev/guide/routing/routing-with-urlmatcher)

## Server Side Rendering (SSR)

- [SSR Overview](https://angular.dev/guide/performance)
- [SSR with Angular](https://angular.dev/guide/ssr)
- [Build-time prerendering (SSG)](https://angular.dev/guide/prerendering)
- [Hybrid rendering with server routing](https://angular.dev/guide/hybrid-rendering)
- [Hydration](https://angular.dev/guide/hydration)
- [Incremental Hydration](https://angular.dev/guide/incremental-hydration)

# CLI 
[Angular CLI Overview](https://angular.dev/tools/cli)

## Testing

- [Testing overview](https://angular.dev/guide/testing)
- [Testing coverage](https://angular.dev/guide/testing/code-coverage)
- [Testing services](https://angular.dev/guide/testing/services)
- [Basics of component testing](https://angular.dev/guide/testing/components-basics)
- [Component testing scenarios](https://angular.dev/guide/testing/components-scenarios)
- [Testing attribute directives](https://angular.dev/guide/testing/attribute-directives)
- [Testing pipes](https://angular.dev/guide/testing/pipes)
- [Debugging tests](https://angular.dev/guide/testing/debugging)
- [Testing utility apis](https://angular.dev/guide/testing/utility-apis)
- [Component harness overview](https://angular.dev/guide/testing/component-harnesses-overview)
- [Using component harness in tests](https://angular.dev/guide/testing/using-component-harnesses)
- [Creating a component harness for your components](https://angular.dev/guide/testing/creating-component-harnesses)

## Animations
- [Animations your content](https://angular.dev/guide/animations/css)
- [Route transition animation](https://angular.dev/guide/routing/route-transition-animations)
- [Migrating to native CSS animations](https://next.angular.dev/guide/animations/migration)

## APIs
- [API reference](https://angular.dev/api)
- [CLI command reference](https://angular.dev/cli)


## Others

- [Zoneless](https://angular.dev/guide/zoneless)
- [Error encyclopedia](https://angular.dev/errors)
- [Extended diagnostics](https://angular.dev/extended-diagnostics)
- [Update guide](https://angular.dev/update-guide)
- [Contribute to Angular](https://github.com/angular/angular/blob/main/CONTRIBUTING.md)
- [Angular's Roadmap](https://angular.dev/roadmap)
- [Keeping your projects up-to-date](https://angular.dev/update)
- [Security](https://angular.dev/best-practices/security)
- [Internationalization (i18n)](https://angular.dev/guide/i18n)