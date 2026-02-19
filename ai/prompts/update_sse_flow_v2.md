# Frontend SSE Flow Implementation Plan (v2)

## Overview

This plan details the frontend changes required to support the new cart-product decoupling validation flow. The backend has implemented an optimistic add pattern where cart items are added immediately with a `pending_validation` status and then validated asynchronously via events. The frontend must handle new SSE events to update item states in real-time.

## Key Changes Summary

1. **Data Model Updates**: Extend `CartItem` with validation status fields
2. **Extend OrderSseService**: Add cart validation events to existing SSE service
3. **Cart Store Enhancements**: Validation state management via computed signals
4. **UI Updates**: Status indicators, checkout validation, user feedback

---

## Approach Analysis

### Approach 1: Create Separate CartSseService (Original Plan)
**Idea**: New dedicated service for cart validation SSE events

**Pros**:
- Clear separation of concerns
- Cart SSE can be long-lived (connected while cart exists)

**Cons**:
- **CRITICAL**: OrderSseService already uses the same SSE endpoint (`/carts/{cartId}/stream`)
- Duplicate SSE connections to the same endpoint (waste of resources)
- EventSource cannot share connections - browser will create two connections
- Creates architectural inconsistency (Order events in OrderSseService, Cart events in CartSseService, but same connection)

**Verdict**: ❌ **REJECTED** - Would create duplicate connections to the same endpoint

### Approach 2: Extend Existing OrderSseService ✅ SELECTED
**Idea**: Add cart validation events to the existing `OrderSseService`

**Pros**:
- Single SSE connection per cart (efficient resource usage)
- Same endpoint already established
- Consistent with existing codebase patterns
- Both order and cart events are cart-related (same lifecycle context)
- Simpler architecture with one service managing one connection
- Follows KISS principle

**Cons**:
- Service name becomes slightly misleading (OrderSseService handles cart events too)
- Could rename to `CartSseService` but that would require refactoring existing code

**Mitigation**: Add clear documentation in the service explaining it handles both order completion and cart item validation events.

**Verdict**: ✅ **SELECTED** - Best architectural fit given existing implementation

---

## Implementation Plan

### Phase 1: Data Model Updates

**File**: `src/app/models/cart.ts`

#### 1.1 Add Cart Item Status Type and Interface Updates

```typescript
/**
 * Cart item validation status
 */
export type CartItemStatus = 'confirmed' | 'pending_validation' | 'backorder';

/**
 * Individual item within a cart
 */
export interface CartItem {
  id: number;
  cart_id: string;
  line_number: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  // New fields for validation
  status: CartItemStatus;
  validation_id?: string;
  backorder_reason?: string;
}
```

**Rationale**: 
- Maintains consistency with existing snake_case naming convention in the codebase
- `status` field is non-optional - backend will always provide it
- Optional fields use snake_case matching existing patterns

#### 1.2 Add SSE Event Interfaces

```typescript
/**
 * SSE Event: cart.item.validated
 * Sent when an item passes validation and is confirmed
 */
export interface CartItemValidatedEvent {
  line_number: string;  // Changed from lineNumber to match codebase convention
  product_id: string;   // Changed from productId to match codebase convention
  status: 'confirmed';
  product_name: string; // Changed from productName to match codebase convention
  unit_price: number;   // Changed from unitPrice to match codebase convention
  quantity: number;
  total_price: number;  // Changed from totalPrice to match codebase convention
}

/**
 * SSE Event: cart.item.backorder
 * Sent when an item fails validation (out of stock or not found)
 */
export interface CartItemBackorderEvent {
  line_number: string;
  product_id: string;
  status: 'backorder';
  product_name?: string;
  unit_price?: number;
  quantity: number;
  total_price?: number;
  backorder_reason: string;  // Changed from backorderReason to match codebase convention
}
```

**Rationale**:
- **CRITICAL FIX**: Changed all property names from camelCase to snake_case to match existing codebase conventions
- All other models in the project use snake_case for API data structures
- This ensures consistency across the entire codebase

#### 1.3 Add SSE Connection State Interface (if not exists)

```typescript
/**
 * SSE connection state for cart validation
 */
export interface CartSSEConnectionState {
  status: 'idle' | 'connecting' | 'connected' | 'error' | 'closed';
  error: string | null;
  last_event_id: string | null;
}
```

**Note**: Check if this can reuse `SSEConnectionState` from order models to maintain consistency.

---

### Phase 2: Extend OrderSseService

**File**: `src/app/services/order-sse.service.ts`

#### 2.1 Add New Event Subjects and Observables

Add to the existing OrderSseService:

```typescript
// Add to existing imports
import { 
  CartItemValidatedEvent, 
  CartItemBackorderEvent 
} from '../models/cart';

// Add new event streams as Subjects (after existing subjects)
private readonly cartItemValidated$ = new Subject<CartItemValidatedEvent>();
private readonly cartItemBackorder$ = new Subject<CartItemBackorderEvent>();

// Add public observables (after existing observables)
readonly cartItemValidated = this.cartItemValidated$.asObservable();
readonly cartItemBackorder = this.cartItemBackorder$.asObservable();
```

#### 2.2 Add Event Listeners in setupEventHandlers

Add these event listeners inside `setupEventHandlers` method (after the order.created handler):

```typescript
// Handle cart.item.validated event
this.eventSource.addEventListener('cart.item.validated', (event: MessageEvent) => {
  try {
    const data: CartItemValidatedEvent = JSON.parse(event.data);
    console.log('[SSE] Cart item validated event received:', data);
    
    this._connectionState.update(state => ({
      ...state,
      last_event_id: event.lastEventId || null
    }));
    
    this.cartItemValidated$.next(data);
  } catch (e) {
    console.error('[SSE] Failed to parse cart.item.validated event:', e);
  }
});

// Handle cart.item.backorder event
this.eventSource.addEventListener('cart.item.backorder', (event: MessageEvent) => {
  try {
    const data: CartItemBackorderEvent = JSON.parse(event.data);
    console.log('[SSE] Cart item backorder event received:', data);
    
    this._connectionState.update(state => ({
      ...state,
      last_event_id: event.lastEventId || null
    }));
    
    this.cartItemBackorder$.next(data);
  } catch (e) {
    console.error('[SSE] Failed to parse cart.item.backorder event:', e);
  }
});
```

#### 2.3 Update Cleanup Method

Update the `cleanup` method to complete new subjects:

```typescript
cleanup(): void {
  this.disconnect();
  this.orderCreated$.complete();
  this.connectionError$.complete();
  this.connected$.complete();
  this.cartItemValidated$.complete();  // NEW
  this.cartItemBackorder$.complete();   // NEW
}
```

**Rationale**:
- **CRITICAL FIX**: Avoids creating duplicate SSE connections to the same endpoint
- Leverages existing connection management (connect/disconnect/reconnect)
- Follows existing codebase pattern exactly
- Single source of truth for SSE connection state
- Easier maintenance - one service to manage one connection

---

### Phase 3: Update CartStore

**File**: `src/app/store/cart/cart.store.ts`

#### 3.1 Import OrderSseService Instead of Creating New Service

```typescript
import { OrderSseService } from '../../services/order-sse.service'; // Use existing service
import { 
  CartItemValidatedEvent, 
  CartItemBackorderEvent 
} from '../../models/cart';
```

#### 3.2 Inject OrderSseService and Setup Subscriptions

```typescript
export class CartStore {
  private readonly cartService = inject(CartService);
  private readonly orderSseService = inject(OrderSseService); // Use OrderSseService
  private readonly notificationService = inject(NotificationService);
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly STORAGE_KEY = 'cart_id';

  // ... existing state ...

  constructor() {
    this.loadPersistedCart();
    this.setupSseSubscriptions(); // Setup subscriptions
  }

  // Setup SSE event subscriptions
  private setupSseSubscriptions(): void {
    // Subscribe to item validated events
    this.orderSseService.cartItemValidated.subscribe({
      next: (event: CartItemValidatedEvent) => {
        console.log('[CartStore] Item validated:', event);
        this.handleItemValidated(event);
      },
      error: (error) => {
        console.error('[CartStore] Item validated stream error:', error);
      }
    });

    // Subscribe to item backorder events
    this.orderSseService.cartItemBackorder.subscribe({
      next: (event: CartItemBackorderEvent) => {
        console.log('[CartStore] Item backorder:', event);
        this.handleItemBackorder(event);
      },
      error: (error) => {
        console.error('[CartStore] Item backorder stream error:', error);
      }
    });

    // Subscribe to connection errors
    this.orderSseService.connectionError.subscribe({
      next: (error: Error) => {
        console.warn('[CartStore] SSE connection error:', error.message);
        // Let OrderSseService handle reconnection
      }
    });
  }
```

#### 3.3 Add Computed Signals for Validation State

Add after existing computed signals:

```typescript
// Validation state computed signals
readonly pendingValidationItems = computed(() => 
  this.items().filter(item => item.status === 'pending_validation')
);
readonly hasPendingValidationItems = computed(() => 
  this.pendingValidationItems().length > 0
);
readonly backorderItems = computed(() => 
  this.items().filter(item => item.status === 'backorder')
);
readonly hasBackorderItems = computed(() => 
  this.backorderItems().length > 0
);
readonly confirmedItems = computed(() => 
  this.items().filter(item => item.status === 'confirmed')
);

// Update canCheckout to account for validation state
readonly canCheckout = computed(() => 
  !this.isEmpty() && 
  this.hasContact() && 
  this.hasShippingAddress() && 
  this.hasPayment() &&
  !this.hasPendingValidationItems() // Can't checkout with pending items
);
```

**Rationale**:
- Uses computed signals for derived state (consistent with existing patterns in ProductStore)
- No need to store validation state separately - it's derived from items
- No `pendingItems` Map needed - the `status` field on CartItem handles this

#### 3.4 Add Event Handlers

```typescript
// Handle cart.item.validated event
private handleItemValidated(event: CartItemValidatedEvent): void {
  this.state.update(s => {
    if (!s.cart) return s;

    const updatedItems = s.cart.items.map(item => {
      if (item.line_number === event.line_number) {
        return {
          ...item,
          status: event.status,
          product_name: event.product_name,
          unit_price: event.unit_price,
          total_price: event.total_price
        };
      }
      return item;
    });

    return {
      ...s,
      cart: {
        ...s.cart,
        items: updatedItems
      }
    };
  });

  this.notificationService.showSuccess(`${event.product_name} is now available in your cart`);
}

// Handle cart.item.backorder event
private handleItemBackorder(event: CartItemBackorderEvent): void {
  this.state.update(s => {
    if (!s.cart) return s;

    const updatedItems = s.cart.items.map(item => {
      if (item.line_number === event.line_number) {
        return {
          ...item,
          status: event.status,
          product_name: event.product_name || item.product_name,
          unit_price: event.unit_price || item.unit_price,
          total_price: event.total_price || item.total_price,
          backorder_reason: event.backorder_reason
        };
      }
      return item;
    });

    return {
      ...s,
      cart: {
        ...s.cart,
        items: updatedItems
      }
    };
  });

  this.notificationService.showWarning(
    `${event.product_name || 'Item'} is on backorder: ${event.backorder_reason}`
  );
}
```

**Rationale**:
- Uses snake_case property names to match event interfaces
- Shows notifications in store (single location for user feedback)
- No pendingItems management needed

#### 3.5 Update AddItem Method (No Optimistic UI Changes)

**IMPORTANT**: Keep the existing `addItem` method unchanged. Do NOT implement optimistic UI with pendingItems Map.

**Rationale**:
- The backend returns the item immediately with `status: 'pending_validation'`
- No need for complex optimistic UI with temporary line numbers
- After adding, reload cart to get the item with its real status
- Simpler, more maintainable code
- Follows existing patterns in the codebase

```typescript
async addItem(productId: string, quantity: number = 1): Promise<void> {
  const cartId = await this.ensureCart();
  if (!cartId) return;

  this.setLoading(true);

  try {
    // Backend returns item immediately with status = 'pending_validation'
    await firstValueFrom(this.cartService.addItem(cartId, productId, quantity));
    // Reload cart to get updated items with validation status
    await this.reloadCart();
    this.notificationService.showSuccess('Item added to cart');
  } catch (error) {
    this.handleError(error, 'Failed to add item to cart');
  } finally {
    this.setLoading(false);
  }
}
```

#### 3.6 Connect SSE When Cart is Loaded

Update `loadCart` and `createCart` methods to establish SSE connection:

```typescript
async createCart(customerId?: string): Promise<void> {
  this.setLoading(true);
  this.setError(null);

  try {
    const cart = await firstValueFrom(this.cartService.createCart(customerId));
    this.state.update(s => ({
      ...s,
      cart,
      cartId: cart.cart_id
    }));
    this.persistCartId(cart.cart_id);
    
    // Connect to SSE for real-time validation updates
    await this.connectSse(cart.cart_id);
    
    this.notificationService.showSuccess('Cart created successfully');
  } catch (error) {
    this.handleError(error, 'Failed to create cart');
  } finally {
    this.setLoading(false);
  }
}

async loadCart(cartId: string): Promise<void> {
  this.setLoading(true);
  this.setError(null);

  try {
    const cart = await firstValueFrom(this.cartService.getCart(cartId));
    this.state.update(s => ({
      ...s,
      cart,
      cartId: cart.cart_id
    }));
    this.persistCartId(cart.cart_id);
    
    // Connect to SSE for real-time validation updates
    await this.connectSse(cart.cart_id);
  } catch (error) {
    this.handleError(error, 'Failed to load cart');
    this.clearPersistedCart();
  } finally {
    this.setLoading(false);
  }
}

// Connect to SSE when cart is loaded
private async connectSse(cartId: string): Promise<void> {
  try {
    await this.orderSseService.connect(cartId);
    console.log('[CartStore] SSE connected for cart:', cartId);
  } catch (error) {
    console.error('[CartStore] Failed to connect SSE:', error);
    // Non-fatal - cart still works without SSE
  }
}
```

#### 3.7 Disconnect SSE When Cart is Cleared

Update `clearCart` and `clearCartAfterOrder` methods:

```typescript
async clearCart(): Promise<void> {
  const cartId = this.state().cartId;
  if (!cartId) return;

  this.setLoading(true);

  try {
    await firstValueFrom(this.cartService.deleteCart(cartId));
    
    // Disconnect SSE
    this.orderSseService.disconnect();
    
    this.state.update(s => ({
      ...s,
      cart: null,
      cartId: null
    }));
    this.clearPersistedCart();
    this.notificationService.showSuccess('Cart cleared');
  } catch (error) {
    this.handleError(error, 'Failed to clear cart');
  } finally {
    this.setLoading(false);
  }
}

async clearCartAfterOrder(): Promise<void> {
  // Disconnect SSE since cart is being cleared
  this.orderSseService.disconnect();
  
  this.clearPersistedCart();
  this.state.update(s => ({
    ...s,
    cart: null,
    cartId: null,
    checkoutStep: 'cart'
  }));
}
```

**Rationale**:
- Reuses existing OrderSseService connection management
- No need to duplicate connection logic
- Cleaner separation of concerns

---

### Phase 4: UI Component Updates

#### 4.1 Update CartItemComponent

Add status display properties (similar to original plan, but with snake_case references):

```typescript
get isPendingValidation(): boolean {
  return this.item.status === 'pending_validation';
}

get isBackorder(): boolean {
  return this.item.status === 'backorder';
}

get isConfirmed(): boolean {
  return this.item.status === 'confirmed';
}

get statusText(): string {
  switch (this.item.status) {
    case 'pending_validation':
      return 'Validating...';
    case 'backorder':
      return 'Backorder';
    case 'confirmed':
      return 'Available';
    default:
      return '';
  }
}

get statusClass(): string {
  switch (this.item.status) {
    case 'pending_validation':
      return 'status-pending';
    case 'backorder':
      return 'status-backorder';
    case 'confirmed':
      return 'status-confirmed';
    default:
      return '';
  }
}

get isQuantityControlsDisabled(): boolean {
  return this.isPendingValidation || this.isBackorder;
}
```

#### 4.2 Update CartComponent

Add validation state selectors and checkout handling:

```typescript
export class CartComponent {
  private readonly cartStore = inject(CartStore);

  // Existing selectors
  readonly cart: Signal<Cart | null> = this.cartStore.cart;
  readonly items: Signal<CartItem[]> = this.cartStore.items;
  readonly isEmpty: Signal<boolean> = this.cartStore.isEmpty;
  readonly loading: Signal<boolean> = this.cartStore.loading;
  readonly subtotal: Signal<number> = this.cartStore.subtotal;
  readonly tax: Signal<number> = this.cartStore.tax;
  readonly shipping: Signal<number> = this.cartStore.shipping;
  readonly total: Signal<number> = this.cartStore.total;
  readonly currency: Signal<string> = this.cartStore.currency;
  
  // NEW: Validation state selectors
  readonly hasPendingItems: Signal<boolean> = this.cartStore.hasPendingValidationItems;
  readonly hasBackorderItems: Signal<boolean> = this.cartStore.hasBackorderItems;
  readonly pendingItems: Signal<CartItem[]> = this.cartStore.pendingValidationItems;
  readonly backorderItems: Signal<CartItem[]> = this.cartStore.backorderItems;
  
  // NEW: Checkout disabled reason
  readonly checkoutDisabledReason = computed(() => {
    if (this.isEmpty()) {
      return 'Your cart is empty';
    }
    if (this.hasPendingItems()) {
      return 'Please wait for all items to be validated before checkout';
    }
    return null;
  });

  onProceedToCheckout(): void {
    if (this.hasBackorderItems()) {
      // Show warning but allow proceeding
      const confirmCheckout = confirm(
        'Your cart contains items on backorder. These items will not ship immediately. Do you want to continue?'
      );
      if (!confirmCheckout) return;
    }
    this.cartStore.setCheckoutStep('contact');
  }
}
```

#### 4.3 Update Cart Template

Add validation warnings and update checkout button (similar to original plan):

```html
<!-- Validation warnings -->
<div class="validation-warnings" *ngIf="hasPendingItems() || hasBackorderItems()">
  <div class="alert alert-info" *ngIf="hasPendingItems()">
    <span class="alert-icon">⟳</span>
    <div class="alert-content">
      <strong>Validating Items</strong>
      <p>{{ pendingItems().length }} item(s) are being validated. Please wait before checking out.</p>
    </div>
  </div>
  
  <div class="alert alert-warning" *ngIf="hasBackorderItems()">
    <span class="alert-icon">!</span>
    <div class="alert-content">
      <strong>Backorder Items</strong>
      <p>{{ backorderItems().length }} item(s) are on backorder and won't ship immediately.</p>
    </div>
  </div>
</div>

<!-- Checkout button with disabled state -->
<button 
  class="btn-checkout" 
  [disabled]="!cartStore.canCheckout()"
  (click)="onProceedToCheckout()"
  [title]="checkoutDisabledReason()">
  Proceed to Checkout
</button>

<span class="checkout-hint" *ngIf="checkoutDisabledReason()">
  {{ checkoutDisabledReason() }}
</span>
```

---

### Phase 5: Checkout Component Updates

Update checkout validation (similar to original plan):

```typescript
async completeCheckout(): Promise<void> {
  const cartId = this.cartStore.cartId();
  if (!cartId) {
    return;
  }

  // Validate cart is ready
  const isReady = await this.cartStore.prepareForCheckout();
  if (!isReady) {
    return;
  }

  // Check for pending validation items
  if (this.cartStore.hasPendingValidationItems()) {
    this.notificationService.showError(
      'Please wait for all items to be validated before checkout'
    );
    return;
  }

  // Check for backorder items and confirm
  if (this.cartStore.hasBackorderItems()) {
    const confirmBackorder = confirm(
      `Your cart contains ${this.cartStore.backorderItems().length} item(s) on backorder. ` +
      'These items will not ship immediately. Do you want to continue with checkout?'
    );
    if (!confirmBackorder) {
      return;
    }
  }

  // Start checkout via OrderStore
  await this.orderStore.checkout(cartId);
}
```

---

## Testing Strategy

### Unit Tests

#### OrderSseService Tests (Extended)

```typescript
describe('OrderSseService', () => {
  let service: OrderSseService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [OrderSseService]
    });
    service = TestBed.inject(OrderSseService);
  });

  it('should emit cartItemValidated event', (done) => {
    service.cartItemValidated.subscribe(event => {
      expect(event.line_number).toBe('001');
      expect(event.status).toBe('confirmed');
      done();
    });

    service.connect('cart-123').then(() => {
      const messageEvent = new MessageEvent('cart.item.validated', {
        data: JSON.stringify({
          line_number: '001',
          product_id: 'prod-1',
          status: 'confirmed',
          product_name: 'Widget',
          unit_price: 10.00,
          quantity: 2,
          total_price: 20.00
        })
      });
      // Trigger event handling
    });
  });

  it('should emit cartItemBackorder event', (done) => {
    service.cartItemBackorder.subscribe(event => {
      expect(event.line_number).toBe('001');
      expect(event.status).toBe('backorder');
      expect(event.backorder_reason).toBe('Out of stock');
      done();
    });

    service.connect('cart-123').then(() => {
      const messageEvent = new MessageEvent('cart.item.backorder', {
        data: JSON.stringify({
          line_number: '001',
          product_id: 'prod-1',
          status: 'backorder',
          quantity: 2,
          backorder_reason: 'Out of stock'
        })
      });
      // Trigger event handling
    });
  });
});
```

#### CartStore Tests

```typescript
describe('CartStore', () => {
  let store: CartStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CartStore,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    store = TestBed.inject(CartStore);
  });

  it('should update item status on validated event', () => {
    // Set initial cart with pending item
    store.state.set({
      cart: {
        cart_id: 'cart-123',
        items: [{
          line_number: '001',
          status: 'pending_validation',
          // ... other fields
        }]
      }
      // ... other state
    });

    // Simulate SSE event
    const event: CartItemValidatedEvent = {
      line_number: '001',
      product_id: 'prod-1',
      status: 'confirmed',
      product_name: 'Widget',
      unit_price: 10.00,
      quantity: 2,
      total_price: 20.00
    };

    (store as any).handleItemValidated(event);

    const items = store.items();
    expect(items[0].status).toBe('confirmed');
    expect(items[0].product_name).toBe('Widget');
  });

  it('should disable checkout when pending items exist', () => {
    store.state.update(s => ({
      ...s,
      cart: {
        cart_id: 'cart-123',
        items: [{
          line_number: '001',
          status: 'pending_validation',
          // ... other fields
        }],
        contact: { /* ... */ },
        addresses: [{ address_type: 'shipping' }],
        credit_card: { /* ... */ }
      }
    }));

    expect(store.canCheckout()).toBeFalse();
    expect(store.hasPendingValidationItems()).toBeTrue();
  });
});
```

---

## Migration Path

### For Existing Carts
- Existing cart items will have `status: 'confirmed'` (backend default)
- No migration needed on frontend
- SSE connection will be established on next cart load

### Environment Configuration
No changes required - uses existing `environment.apiUrl`.

### Rollback Plan
If issues occur:
1. Remove SSE event listeners from OrderSseService
2. Remove validation state computed signals from CartStore
3. Frontend will work in "degraded" mode - items will still be added but validation status won't update in real-time
4. Cart refresh (page reload) will show current validation status

---

## Performance Considerations

1. **SSE Connection Management**:
   - Only one SSE connection per active cart (shared between order and cart events)
   - Connection established on cart load/creation
   - Connection closed on cart clear/checkout
   - Automatic reconnection with exponential backoff (handled by OrderSseService)

2. **State Management**:
   - No additional state needed - validation status stored on CartItem
   - Computed signals efficiently derive validation state
   - No memory leaks from abandoned subscriptions

3. **Network Efficiency**:
   - SSE used only for validation events
   - No polling required
   - Minimal overhead (text-based protocol)
   - Single connection for both order and cart events

---

## Error Handling

### SSE Connection Failures
- Non-fatal - cart functionality continues without real-time updates
- User can still add/remove items
- Page refresh will sync latest state
- Reconnection attempts handled by OrderSseService

### Validation Timeouts
- Backend responsible for timeout handling
- Frontend shows "Validating..." indefinitely
- User can remove item if tired of waiting
- No automatic timeout on frontend

### Network Interruptions
- SSE automatically attempts reconnection (handled by OrderSseService)
- Cart state preserved
- User notified of connection issues via console logs

---

## Security Considerations

1. **SSE Endpoint**: Uses same authentication as REST API
2. **Event Validation**: Only accept events for current cart ID
3. **No Sensitive Data**: SSE events contain only cart item metadata
4. **CORS**: Configured on backend to allow EventSource connections

---

## Summary of Changes (v2)

| File | Change Type | Description |
|------|-------------|-------------|
| `src/app/models/cart.ts` | Modify | Add `status`, `validation_id`, `backorder_reason` to CartItem; Add SSE event interfaces with snake_case properties |
| `src/app/services/order-sse.service.ts` | Modify | Add `cartItemValidated` and `cartItemBackorder` observables; Add event listeners for cart validation events |
| `src/app/store/cart/cart.store.ts` | Modify | Inject OrderSseService; Add validation computed signals; Add event handlers; Connect/disconnect SSE |
| `src/app/features/cart/components/cart-item/*` | Modify | Add status indicators and disabled states |
| `src/app/features/cart/cart.component.*` | Modify | Add validation warnings and checkout restrictions |
| `src/app/features/checkout/checkout.component.ts` | Modify | Add validation checks before checkout |

**Files NOT Changed** (removed from original plan):
- ❌ `src/app/services/cart-sse.service.ts` - Not created (reuse OrderSseService)
- ❌ `src/app/features/cart/components/cart-summary/*` - No changes needed
- ❌ `src/app/features/products/product-list/components/product-card/*` - No changes needed (no optimistic UI)

---

## Key Improvements Over Original Plan

1. **No Duplicate SSE Connections**: Reuses existing OrderSseService instead of creating a second connection to the same endpoint
2. **Consistent Naming**: All properties use snake_case to match existing codebase conventions
3. **Simpler State Management**: No `pendingItems` Map needed - uses computed signals from existing items
4. **No Optimistic UI Complexity**: Backend returns items immediately with status field, eliminating need for temporary line numbers
5. **Cleaner Architecture**: Single service managing one connection, following existing patterns
6. **Reduced Code**: Fewer files modified, less code to maintain
7. **Better Testing**: Easier to test with one SSE service

---

## Success Metrics

1. **Performance**: Add to cart response < 100ms (backend returns immediately)
2. **Validation Speed**: 95% of items validated within 500ms (end-to-end)
3. **User Experience**: No blocking waits during add to cart
4. **Error Rate**: < 0.1% cart operations fail due to SSE issues
5. **Checkout Conversion**: No drop-off due to validation delays

---

## Future Enhancements

1. **Validation Timeout**: Auto-remove items pending > 5 minutes
2. **Price Updates**: Real-time price change notifications via SSE
3. **Stock Alerts**: Notify when backorder items come in stock
4. **Batch Validation**: Optimize multiple items added simultaneously
5. **Offline Support**: Queue add-to-cart actions when offline

---

**Plan Version**: 2.0
**Original Plan Version**: 1.0
**Last Updated**: 2026-02-18
**Author**: AI Assistant
**Changes from v1**: 
- Replaced CartSseService with extensions to OrderSseService
- Changed all property names from camelCase to snake_case
- Removed optimistic UI with pendingItems Map
- Simplified state management using computed signals
- Reduced number of files to modify
