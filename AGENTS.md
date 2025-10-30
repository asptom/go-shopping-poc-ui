# Agent Guidelines for go-shopping-poc-ui

## Recent Development Summary

**Date**: October 30, 2025

**Completed Tasks**:
- ✅ Analyzed codebase and created initial AGENTS.md with build/test commands and code style guidelines
- ✅ Incorporated best-practices.md content into AGENTS.md with comprehensive Angular/TypeScript guidelines
- ✅ Implemented Amazon-style header/footer framework:
  - Created layout component as application shell
  - Built responsive header with navigation, search bar, account menu, and cart
  - Developed comprehensive footer with multiple link sections and legal information
  - Updated routing configuration to use layout as parent route
  - Simplified app component to router-outlet only
  - Added home component with sample content
  - Implemented responsive design for mobile/tablet/desktop
  - Successfully tested the complete layout framework
 - ✅ Implemented complete OIDC authentication system:
   - Installed and configured `angular-auth-oidc-client` with Authorization Code Flow + S256 PKCE
   - Created AuthService with signals-based reactive state management and localStorage persistence
   - Enhanced header component with dynamic user greeting and login/logout functionality
   - Built comprehensive profile component displaying user information from identity provider
   - Implemented AuthGuard for route protection with persisted state fallback
   - Resolved PKCE method mismatch (S256) and HTTPS issuer validation issues
   - Fixed navigation logout issue with persistent authentication state management
   - Implemented protected authentication state to prevent OIDC service resets during navigation
   - Enabled refresh tokens for seamless token renewal while maintaining navigation stability
   - Added comprehensive error handling and debugging throughout authentication flow
   - Successfully integrated with Keycloak at `https://keycloak.local/realms/pocstore-realm`

**Key Architecture Decisions**:
- Standalone components throughout (Angular 20 default)
- Signals-based state management for both UI and authentication state
- localStorage persistence for authentication state to survive OIDC service resets
- Protected authentication state management to prevent OIDC overrides during navigation
- SCSS for component styling with responsive breakpoints
- Amazon-inspired design with #131921/#ff9900 color scheme
- Layout-first routing approach for consistent header/footer across all pages
- OIDC-first authentication with comprehensive token validation and error handling
- Persistent authentication state management to prevent navigation logout issues

## Commands
- **Build**: `ng build` or `npm run build`
- **Test all**: `ng test` or `npm test`
- **Test single**: `ng test --include="**/component.spec.ts"`
- **Serve**: `ng serve` or `npm start`
- **Watch**: `npm run watch`

## Code Style & Best Practices

### TypeScript
- Use strict type checking
- Prefer type inference when type is obvious
- Avoid `any` type; use `unknown` when type is uncertain
- Single quotes for strings, 2-space indentation
- camelCase for variables/functions, PascalCase for classes/components

### Angular
- Always use standalone components (default, no `standalone: true` needed)
- Use signals for state management
- Implement lazy loading for feature routes
- Use `NgOptimizedImage` for static images (not base64)
- Put host bindings in `host` object instead of `@HostBinding/@HostListener`

### Components
- Keep components small and focused on single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush`
- Prefer inline templates for small components
- Use Reactive forms over Template-driven forms
- Use `class` and `style` bindings instead of `ngClass`/`ngStyle`

### State Management
- Use signals for local component state
- Use `computed()` for derived state
- Keep transformations pure and predictable
- Use `update` or `set` instead of `mutate` on signals

### Templates
- Keep templates simple, avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) over structural directives
- Use async pipe for observables

### Services
- Design around single responsibility
- Use `providedIn: 'root'` for singletons
- Use `inject()` function instead of constructor injection

### Additional Guidelines
- **Imports**: Group Angular imports first, then third-party, then local
- **Styling**: SCSS with component-specific styles
- **Selectors**: Prefix with 'app-'
- **Error Handling**: Use Angular's error boundaries and RxJS error operators
- **Testing**: Jasmine/Karma with Angular Testing Utilities
- **Formatting**: Prettier (printWidth: 100, single quotes, Angular HTML parser)