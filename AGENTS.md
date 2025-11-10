# Agent Guidelines for go-shopping-poc-ui

## Recent Development Summary

**Date**: November 10, 2025 (Updated: Font size issue notes added)

**Today's Session - Modal Form Fixes & Edit Functionality**:
- ✅ **Fixed Add Address and Add Credit Card button functionality**:
  - Added modal components to profile template with proper event binding
  - Updated ModalComponent to use modern Angular `@if` syntax instead of deprecated `*ngIf`
  - Implemented comprehensive address and credit card forms inside modals
  - Added form validation and error handling for modal forms
  - Fixed "ModalComponent is not used" warning by properly implementing modals

- ✅ **Implemented complete edit functionality for addresses and credit cards**:
  - Added "Edit" buttons for both addresses and credit cards with blue styling (#146eb4)
  - Created dynamic modal titles ("Add Address" vs "Edit Address")
  - Implemented form pre-population with existing data when editing
  - Added proper ID preservation during update operations
  - Fixed form services to include address_id and card_id fields

- ✅ **Resolved critical ID null errors in update operations**:
  - Fixed `TypeError: null is not an object (evaluating 't.address_id')` error
  - Fixed `TypeError: null is not an object (evaluating 't.card_id')` error
  - Updated form reset methods to include ID fields
  - Changed from form recreation to patchValue() approach for better state management
  - Enhanced CustomerStore to reload customer data after successful updates

- ✅ **Fixed data disappearing after update operations**:
  - Modified CustomerStore update methods to use data reload pattern
  - Both updateAddress() and updateCreditCard() now call loadCustomer() after success
  - Ensures UI reflects latest data from backend after updates
  - Eliminated potential sync issues between frontend and backend

- ✅ **Enhanced modal form styling to match application design**:
  - Updated modal styling to match Amazon-inspired design system
  - Added consistent color scheme (#0f1111, #ff9900, #0f7938, #c40000)
  - Implemented proper spacing, padding, and responsive design
  - Added hover effects, transitions, and focus states
  - Enhanced button styling with proper visual feedback

- ✅ **Multiple attempts to fix modal form font size consistency**:
  - Attempted to match modal form styling to main profile form exactly
  - Added explicit font-size declarations to prevent inheritance issues
  - Updated input padding, grid layout, and spacing to match main form
  - Set base font-size on modal content container
  - Added global base font styles (html, body { font-size: 16px })
  - Used !important declarations to override conflicting styles
  - Issue persists - modal forms still appear to have smaller fonts than main form

## **Outstanding Issue: Modal Font Size Discrepancy**

### **Problem Status**: ❌ **UNRESOLVED**
- Modal form fonts appear **smaller** than main profile form fonts despite multiple attempts
- All functionality works correctly - only visual appearance mismatch remains
- Issue confirmed after latest styling attempts on November 10, 2025

### **Attempts Made**:
1. **Explicit font-size declarations** - Added `font-size: 1rem` to all modal form elements
2. **Global base font setting** - Added `html, body { font-size: 16px }` to styles.scss
3. **CSS specificity overrides** - Used `!important` declarations to force font sizes
4. **Inheritance approach** - Tried `font-size: inherit` on modal containers
5. **Container-level sizing** - Set font-size on modal-backdrop, modal-content, and modal-body

### **Potential Root Causes to Investigate**:
- **CSS cascade conflicts** - Global browser styles or Angular defaults may override modal styles
- **Fixed positioning context** - Modal's `position: fixed` may inherit from different DOM context
- **Browser default styling** - Different default font sizes for form elements in fixed contexts
- **Angular ViewEncapsulation** - Component styling may be scoped differently for modals
- **CSS specificity hierarchy** - More specific selectors elsewhere may be taking precedence

### **Next Session Investigation Approaches**:
1. **Browser DevTools Analysis**:
   - Use computed styles tab to identify actual font sizes being applied
   - Check which CSS rules are overriding modal font sizes
   - Compare computed styles between modal and main form elements

2. **CSS Reset Approach**:
   - Try CSS reset specifically for modal context
   - Use normalize.css or similar to standardize cross-browser behavior

3. **Alternative Styling Strategies**:
   - Try CSS variables for consistent font sizing across components
   - Consider using CSS-in-JS or inline styles as fallback
   - Experiment with different CSS specificity patterns

4. **DOM Structure Investigation**:
   - Check if modal placement in DOM affects font inheritance
   - Consider moving modal to different DOM context if needed

### **Files Involved**:
- `src/app/features/profile/modal.scss` - Modal styling
- `src/app/features/profile/profile.scss` - Main profile styling (for comparison)
- `src/styles.scss` - Global styles
- `src/app/features/profile/modal.component.ts` - Modal component structure

**Previous Architecture Work (November 4, 2025)**:
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
- ✅ Enhanced customer profile management system:
  - Created TypeScript interfaces matching Go entity definitions (Customer, Address, CreditCard, CustomerStatus)
  - Implemented CustomerService with HttpClient for API integration (GET /customers/{email}, POST /customers)
  - Updated Profile component with reactive data fetching and automatic customer creation from Keycloak data
  - Built comprehensive profile forms for editing personal information, managing multiple addresses (shipping/billing with defaults), and credit cards (with masked display for security)
  - Added responsive styling and error handling for loading states and API failures
  - Resolved angular.json configuration issues for Angular 20 compatibility
  - Configured CORS handling for development (backend CORS configuration required for production)
- ✅ Implemented complete customer profile update functionality:
  - Added PUT endpoint integration for full customer updates
  - Implemented address CRUD operations (add, update, delete, set default)
  - Implemented credit card CRUD operations with secure handling
  - Created reusable modal component for add/edit forms
  - Added comprehensive form validation (card numbers, expiration dates, ZIP codes)
  - Implemented input sanitization and security measures
  - Added success/error messaging and loading states
  - Built inline editing capabilities for addresses and credit cards
  - Enhanced UI with responsive design and improved user experience
- ✅ Updated to individual ID-based operations:
  - Modified backend to expose individual IDs for addresses and credit cards
  - Updated service methods to use new REST endpoints with individual IDs
  - Changed from bulk operations to individual CRUD operations
  - Improved API design following RESTful principles
  - Enhanced performance with smaller payloads and better caching
  - Better concurrency handling and error management
- ✅ Fixed new user registration flow:
  - Automatically create customer record in backend when new Keycloak user is detected
  - Prevent address/credit card addition failures for new users
  - Improved user onboarding experience with seamless profile creation
- ✅ Fixed modal form submission and API response handling:
  - Resolved signal-based form compatibility issues with ngModel
  - Modified service methods to return void for add operations to handle null responses
  - Implemented customer data reloading after successful adds to ensure UI updates
  - Added success messages for profile saves and operations
- ✅ Enhanced header dropdown functionality:
  - Made account dropdowns clickable to toggle open/closed for better mobile accessibility
  - Added stopPropagation to prevent event bubbling issues
  - Configured "New customer? Start here" to redirect to Keycloak login page for registration
  - Increased modal sizes for better field visibility without scrolling
- ✅ Implemented server-side logout:
  - Modified logout method to redirect to Keycloak logout endpoint with id_token_hint
  - Ensured user sessions are properly terminated in Keycloak upon logout

**API Endpoints** (Updated for Individual ID Operations):
- **Customer**: `GET /customers/{email}`, `POST /customers`, `PUT /customers`
- **Addresses**:
  - `POST /customers/{customerId}/addresses` - Add address
  - `PUT /customers/addresses/{addressId}` - Update address
  - `DELETE /customers/addresses/{addressId}` - Delete address
- **Credit Cards**:
  - `POST /customers/{customerId}/credit-cards` - Add credit card
  - `PUT /customers/credit-cards/{cardId}` - Update credit card
  - `DELETE /customers/credit-cards/{cardId}` - Delete credit card

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
- Individual ID-based CRUD operations for better RESTful API design

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