# Angular Best Practices — go-shopping-poc-ui

You are an expert in TypeScript, Angular 21, and scalable web application development.
Write functional, maintainable, performant, and accessible code following Angular 21 and TypeScript best practices.

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
- Do NOT write to signals inside `computed()` — computed signals must be pure

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
- Use `track $index` only as a last resort when items have no unique identity
- Never write arrow functions in templates
- Never call methods that have side effects in templates — use `computed()`

### Bindings
- Use `[class.active]="condition"` or `[class]="{'active': condition}"` — NOT `[ngClass]`
- Use `[style.color]="value"` — NOT `[ngStyle]`
- Use `(click)="handler()"` — NOT `@HostListener`
- Never write inline `[style]="'...!important'"` — fix specificity in SCSS instead

### Imports in Component Decorator
- ONLY import what you actually use in the template
- Do NOT import `CommonModule` — import individual pipes/directives or use native control flow
- With `@if`/`@for`, you do NOT need `NgIf`/`NgFor` imports at all
- Import `CurrencyPipe`, `DatePipe`, etc. individually when needed

## State Management (Signal Stores)

- Use signal-based stores: `private readonly state = signal<StateType>(initialState)`
- Expose read-only computed signals: `readonly foo = computed(() => this.state().foo)`
- Mutate via `state.update(s => ({ ...s, changes }))` or `state.set(newState)`
- NEVER mutate signal values directly (no `state().items.push(...)`)
- Use `firstValueFrom()` (not `.toPromise()`) to convert Observables to Promises in async store actions
- All stores are `@Injectable({ providedIn: 'root' })` singletons

## Services and HTTP

- `providedIn: 'root'` for all singleton services and stores
- Use functional HTTP interceptors via `withInterceptors([fn1, fn2])` in `provideHttpClient()`
- NEVER use class-based interceptors or `HTTP_INTERCEPTORS` token
- Services return Observables; stores convert to Promises via `firstValueFrom()`
- Do NOT add `console.log` to production code — use `NotificationService` for user feedback
- Do NOT use `console.error` unless in a catch block where the error is not already handled

## Forms

- Use Reactive Forms exclusively (`FormGroup`, `FormControl`, `Validators`)
- Use `FormBuilder` via `inject(FormBuilder)` for complex forms
- Use pure functional validators from `shared/forms/validators/pure-validators.ts`
- Never use template-driven forms (`ngModel`, `FormsModule`)
- Mark forms as touched before showing validation errors: `form.markAllAsTouched()`
- Provide clear error messages for each validation rule

## Subscriptions and Effects

- Use `takeUntilDestroyed(this.destroyRef)` for all long-lived subscriptions in services/stores
- Use `DestroyRef` via `inject(DestroyRef)` — set as a class field, not in constructor
- NEVER use `allowSignalWrites: true` in `effect()` — redesign the signal graph if you feel you need it
- Prefer converting Observables to signals with `toSignal()` over subscribing and writing to signals manually
- Unsubscribe or use `takeUntil` — never let subscriptions leak

## Routing

- Use `loadComponent` for individual component lazy loading
- Use `loadChildren` + route files for feature areas with multiple routes
- Always set `title` on routes
- Use route guards (`CanActivateFn`) for protected routes

## Accessibility (WCAG AA Required)

- ALL interactive elements must be keyboard accessible
- ALL non-text content must have text alternatives (`alt`, `aria-label`, `aria-labelledby`)
- Color contrast must meet WCAG AA: 4.5:1 for normal text, 3:1 for large text (18px+)
- Use `<button>` for actions, `<a>` for navigation — NEVER `<div>` with click handler
- Modal dialogs must trap focus using `CdkTrapFocus` from `@angular/cdk/a11y`
- Form inputs must have associated `<label>` elements (not just placeholders)
- Use `aria-live="polite"` regions for dynamic content updates (cart count, notifications)
- Test with keyboard navigation: tab, shift-tab, enter, escape, space

## Error Handling

- Show user-friendly errors via `NotificationService`
- Log developer-useful context via `ErrorHandlerService.logError()`
- Never show raw error objects or stack traces to users
- Handle HTTP 404 gracefully — it is often a valid "not found" state, not an error
- Always provide a path to recovery (retry button, return to previous page)

## CSS/SCSS

- Use component SCSS files (`*.component.scss`) for component-specific styles
- Use global CSS custom properties in `styles.scss` for theme values
- Never use `!important` — fix specificity issues at the selector level
- Never use inline `[style]` bindings with hard-coded values — use CSS classes
- Responsive breakpoints: mobile (320px), tablet (768px), desktop (1200px)
- Color scheme: `#131921` (dark navy background), `#ff9900` (orange accent), `#ffffff` (text on dark)

## Use of NgOptimizedImage

- Use `NgOptimizedImage` (`ngSrc`) for all static images that have known dimensions
- `NgOptimizedImage` does NOT work for inline base64 or dynamically-sourced images with unknown dimensions

## Confirmations and Dialogs

- NEVER use `window.confirm()` — it is not accessible and not testable
- Use `ConfirmationModalComponent` (wrapping the shared `ModalComponent`) for all confirm/cancel dialogs
- The `ModalComponent` in `shared/modal/` uses `CdkTrapFocus` for proper focus management
