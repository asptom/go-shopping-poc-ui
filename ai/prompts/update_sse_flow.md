# Frontend SSE Flow Implementation Plan

## Overview

This plan details the frontend changes required to support the new cart-product decoupling validation flow. The backend has implemented an optimistic add pattern where cart items are added immediately with a `pending_validation` status and then validated asynchronously via events. The frontend must handle new SSE events to update item states in real-time.

## Key Changes Summary

1. **Data Model Updates**: Extend `CartItem` with validation status fields
2. **New Cart SSE Service**: Handle `cart.item.validated` and `cart.item.backorder` events
3. **Cart Store Enhancements**: Optimistic UI, validation state management, SSE integration
4. **UI Updates**: Status indicators, checkout validation, user feedback

---

## Approach Analysis

### Approach 1: Extend Existing OrderSseService
**Idea**: Add cart validation events to the existing `OrderSseService`

**Pros**:
- Minimal new code
- Single SSE connection per cart

**Cons**:
- Mixes concerns (orders vs cart validation)
- Order SSE is short-lived (disconnects after order created), but cart validation needs persistent connection
- Violates single responsibility principle

**Verdict**: ❌ Rejected - Different lifecycles and concerns

### Approach 2: Create Separate CartSseService
**Idea**: New dedicated service for cart validation SSE events

**Pros**:
- Clear separation of concerns
- Cart SSE can be long-lived (connected while cart exists)
- Easier to test and maintain
- Follows existing patterns (similar to OrderSseService)

**Cons**:
- Slightly more code
- Two SSE connections possible (but acceptable)

**Verdict**: ✅ **SELECTED** - Best architectural fit

### Approach 3: Unified SSE Service
**Idea**: Single service handling all SSE events with event type routing

**Pros**:
- Single connection
- Centralized event handling

**Cons**:
- Complex event routing logic
- Different connection lifecycles (order SSE is temporary, cart SSE is persistent)
- Harder to maintain

**Verdict**: ❌ Rejected - Overly complex for the need

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

#### 1.2 Add SSE Event Interfaces

```typescript
/**
 * SSE Event: cart.item.validated
 * Sent when an item passes validation and is confirmed
 */
export interface CartItemValidatedEvent {
  lineNumber: string;
  productId: string;
  status: 'confirmed';
  productName: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
}

/**
 * SSE Event: cart.item.backorder
 * Sent when an item fails validation (out of stock or not found)
 */
export interface CartItemBackorderEvent {
  lineNumber: string;
  productId: string;
  status: 'backorder';
  productName?: string;
  unitPrice?: number;
  quantity: number;
  totalPrice?: number;
  backorderReason: string;
}
```

#### 1.3 Update CartStoreState Interface

```typescript
/**
 * Cart state interface for the CartStore
 */
export interface CartStoreState {
  cart: Cart | null;
  cartId: string | null;
  loading: boolean;
  error: string | null;
  checkoutStep: 'cart' | 'contact' | 'shipping' | 'payment' | 'review' | 'confirmation';
  // New field for optimistic UI
  pendingItems: Map<string, PendingCartItem>; // lineNumber -> pending item
}

/**
 * Pending cart item for optimistic UI
 */
export interface PendingCartItem {
  lineNumber: string;
  productId: string;
  quantity: number;
  productName: string; // Product name from product listing (temporary)
  unitPrice: number;   // Price from product listing (temporary)
  addedAt: Date;
}
```

---

### Phase 2: Create CartSseService

**File**: `src/app/services/cart-sse.service.ts` (NEW FILE)

#### 2.1 Service Implementation

```typescript
import { Injectable, signal, computed, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { 
  CartItemValidatedEvent, 
  CartItemBackorderEvent,
  SSEConnectionState 
} from '../models/cart';
import { Subject } from 'rxjs';
import { NotificationService } from '../core/notification/notification.service';

/**
 * Service for managing Cart-related Server-Sent Events (SSE)
 * Handles real-time cart item validation updates
 * 
 * Lifecycle:
 * - Connect when cart is loaded/created
 * - Disconnect when cart is cleared or checkout completes
 * - Reconnect on connection errors
 */
@Injectable({
  providedIn: 'root'
})
export class CartSseService {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3;
  private readonly reconnectDelay = 1000;
  private cartId: string | null = null;
  
  private readonly notificationService = inject(NotificationService);
  
  // Private state signals
  private readonly _connectionState = signal<SSEConnectionState>({
    status: 'idle',
    error: null,
    lastEventId: null
  });

  // Public computed state
  readonly connectionState = computed(() => this._connectionState());
  readonly isConnected = computed(() => this._connectionState().status === 'connected');
  readonly isConnecting = computed(() => this._connectionState().status === 'connecting');
  readonly hasError = computed(() => this._connectionState().status === 'error');

  // Event streams as Subjects for reactive handling
  private readonly itemValidated$ = new Subject<CartItemValidatedEvent>();
  private readonly itemBackorder$ = new Subject<CartItemBackorderEvent>();
  private readonly connectionError$ = new Subject<Error>();
  private readonly connected$ = new Subject<string>();

  // Public observables for consumers
  readonly itemValidated = this.itemValidated$.asObservable();
  readonly itemBackorder = this.itemBackorder$.asObservable();
  readonly connectionError = this.connectionError$.asObservable();
  readonly connected = this.connected$.asObservable();

  /**
   * Establishes SSE connection for cart validation events
   * @param cartId The cart ID to subscribe to
   * @returns Promise that resolves when connected
   */
  connect(cartId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Prevent multiple connections
      if (this.eventSource) {
        this.disconnect();
      }

      this.cartId = cartId;
      this.reconnectAttempts = 0;
      
      this._connectionState.set({
        status: 'connecting',
        error: null,
        lastEventId: null
      });

      const url = `${environment.apiUrl}/carts/${cartId}/stream`;
      
      try {
        this.eventSource = new EventSource(url);
        this.setupEventHandlers(resolve, reject);
      } catch (error) {
        console.error('[CartSSE] Failed to create EventSource:', error);
        this._connectionState.set({
          status: 'error',
          error: 'Failed to create SSE connection',
          lastEventId: null
        });
        reject(error);
      }
    });
  }

  /**
   * Sets up EventSource event handlers
   */
  private setupEventHandlers(
    resolve: () => void, 
    reject: (error: Error) => void
  ): void {
    if (!this.eventSource) return;

    // Handle connection open
    this.eventSource.onopen = () => {
      console.log('[CartSSE] Connection opened for cart:', this.cartId);
      this.reconnectAttempts = 0;
      this._connectionState.update(state => ({
        ...state,
        status: 'connected',
        error: null
      }));
      resolve();
    };

    // Handle connected event (initial handshake)
    this.eventSource.addEventListener('connected', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[CartSSE] Connected event received:', data);
        this.connected$.next(data.cartId);
      } catch (e) {
        console.error('[CartSSE] Failed to parse connected event:', e);
      }
    });

    // Handle cart.item.validated event
    this.eventSource.addEventListener('cart.item.validated', (event: MessageEvent) => {
      try {
        const data: CartItemValidatedEvent = JSON.parse(event.data);
        console.log('[CartSSE] Item validated event received:', data);
        
        this._connectionState.update(state => ({
          ...state,
          lastEventId: event.lastEventId || null
        }));
        
        this.itemValidated$.next(data);
      } catch (e) {
        console.error('[CartSSE] Failed to parse cart.item.validated event:', e);
      }
    });

    // Handle cart.item.backorder event
    this.eventSource.addEventListener('cart.item.backorder', (event: MessageEvent) => {
      try {
        const data: CartItemBackorderEvent = JSON.parse(event.data);
        console.log('[CartSSE] Item backorder event received:', data);
        
        this._connectionState.update(state => ({
          ...state,
          lastEventId: event.lastEventId || null
        }));
        
        this.itemBackorder$.next(data);
        
        // Show user notification for backorder items
        this.notificationService.showWarning(
          `${data.productName || 'Item'} is on backorder: ${data.backorderReason}`
        );
      } catch (e) {
        console.error('[CartSSE] Failed to parse cart.item.backorder event:', e);
      }
    });

    // Handle errors
    this.eventSource.onerror = (error) => {
      console.error('[CartSSE] Connection error:', error);
      
      const readyState = this.eventSource?.readyState;
      const wasConnected = this._connectionState().status === 'connected';
      
      if (readyState === EventSource.CLOSED) {
        this._connectionState.set({
          status: 'error',
          error: 'Connection closed unexpectedly',
          lastEventId: this._connectionState().lastEventId
        });
        
        this.connectionError$.next(new Error('Connection closed'));

        if (!wasConnected) {
          reject(new Error('Failed to establish SSE connection'));
        }
      }
    };
  }

  /**
   * Disconnects the SSE connection
   */
  disconnect(): void {
    if (this.eventSource) {
      console.log('[CartSSE] Disconnecting...');
      this.eventSource.close();
      this.eventSource = null;
    }
    
    this.cartId = null;
    this.reconnectAttempts = 0;
    
    this._connectionState.set({
      status: 'closed',
      error: null,
      lastEventId: null
    });
  }

  /**
   * Attempts to reconnect with exponential backoff
   */
  attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[CartSSE] Max reconnection attempts reached');
      this._connectionState.set({
        status: 'error',
        error: 'Max reconnection attempts reached',
        lastEventId: this._connectionState().lastEventId
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[CartSSE] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      if (this.cartId) {
        this.connect(this.cartId).catch(() => {
          // Reconnection failed, will try again if attempts remain
        });
      }
    }, delay);
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.disconnect();
    this.itemValidated$.complete();
    this.itemBackorder$.complete();
    this.connectionError$.complete();
    this.connected$.complete();
  }
}
```

---

### Phase 3: Update CartStore

**File**: `src/app/store/cart/cart.store.ts`

#### 3.1 Add CartSseService Import and State Updates

```typescript
import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { CartService } from '../../services/cart.service';
import { CartSseService } from '../../services/cart-sse.service'; // NEW
import { 
  Cart, 
  CartStoreState,
  SetContactRequest,
  AddAddressRequest,
  SetPaymentRequest,
  CartItemValidatedEvent,
  CartItemBackorderEvent,
  PendingCartItem,
  CartItem
} from '../../models/cart';
import { NotificationService } from '../../core/notification/notification.service';
import { ErrorHandlerService } from '../../core/error/error-handler.service';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CartStore {
  private readonly cartService = inject(CartService);
  private readonly cartSseService = inject(CartSseService); // NEW
  private readonly notificationService = inject(NotificationService);
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly STORAGE_KEY = 'cart_id';

  // Private state signal - ADD pendingItems
  private readonly state = signal<CartStoreState>({
    cart: null,
    cartId: null,
    loading: false,
    error: null,
    checkoutStep: 'cart',
    pendingItems: new Map() // NEW
  });

  // Public computed selectors
  readonly cart = computed(() => this.state().cart);
  readonly cartId = computed(() => this.state().cartId);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly checkoutStep = computed(() => this.state().checkoutStep);
  
  // Derived computed values
  readonly items = computed(() => this.state().cart?.items ?? []);
  readonly itemCount = computed(() => this.items().reduce((sum, item) => sum + item.quantity, 0));
  readonly isEmpty = computed(() => this.items().length === 0);
  readonly subtotal = computed(() => this.state().cart?.net_price ?? 0);
  readonly tax = computed(() => this.state().cart?.tax ?? 0);
  readonly shipping = computed(() => this.state().cart?.shipping ?? 0);
  readonly total = computed(() => this.state().cart?.total_price ?? 0);
  readonly currency = computed(() => this.state().cart?.currency ?? 'USD');
  readonly isActive = computed(() => this.state().cart?.current_status === 'active');
  readonly hasContact = computed(() => !!this.state().cart?.contact);
  readonly hasShippingAddress = computed(() => 
    this.state().cart?.addresses?.some(a => a.address_type === 'shipping') ?? false
  );
  readonly hasBillingAddress = computed(() => 
    this.state().cart?.addresses?.some(a => a.address_type === 'billing') ?? false
  );
  readonly hasPayment = computed(() => !!this.state().cart?.credit_card);
  
  // NEW: Validation state computed signals
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
    !this.hasPendingValidationItems() // NEW: Can't checkout with pending items
  );

  constructor() {
    this.loadPersistedCart();
    this.setupSseSubscriptions(); // NEW: Setup SSE subscriptions
  }

  // NEW: Setup SSE event subscriptions
  private setupSseSubscriptions(): void {
    // Subscribe to item validated events
    this.cartSseService.itemValidated.subscribe({
      next: (event: CartItemValidatedEvent) => {
        console.log('[CartStore] Item validated:', event);
        this.handleItemValidated(event);
      },
      error: (error) => {
        console.error('[CartStore] Item validated stream error:', error);
      }
    });

    // Subscribe to item backorder events
    this.cartSseService.itemBackorder.subscribe({
      next: (event: CartItemBackorderEvent) => {
        console.log('[CartStore] Item backorder:', event);
        this.handleItemBackorder(event);
      },
      error: (error) => {
        console.error('[CartStore] Item backorder stream error:', error);
      }
    });

    // Subscribe to connection errors
    this.cartSseService.connectionError.subscribe({
      next: (error: Error) => {
        console.warn('[CartStore] SSE connection error:', error.message);
        // Attempt reconnection
        this.cartSseService.attemptReconnect();
      }
    });
  }

  // NEW: Handle cart.item.validated event
  private handleItemValidated(event: CartItemValidatedEvent): void {
    this.state.update(s => {
      if (!s.cart) return s;

      const updatedItems = s.cart.items.map(item => {
        if (item.line_number === event.lineNumber) {
          return {
            ...item,
            status: event.status,
            product_name: event.productName,
            unit_price: event.unitPrice,
            total_price: event.totalPrice
          } as CartItem;
        }
        return item;
      });

      // Remove from pending items map
      const newPendingItems = new Map(s.pendingItems);
      newPendingItems.delete(event.lineNumber);

      return {
        ...s,
        cart: {
          ...s.cart,
          items: updatedItems,
          net_price: event.totalPrice, // Recalculate or rely on next cart reload
          total_price: event.totalPrice + (s.cart.tax || 0) + (s.cart.shipping || 0)
        },
        pendingItems: newPendingItems
      };
    });

    this.notificationService.showSuccess(`${event.productName} is now available in your cart`);
  }

  // NEW: Handle cart.item.backorder event
  private handleItemBackorder(event: CartItemBackorderEvent): void {
    this.state.update(s => {
      if (!s.cart) return s;

      const updatedItems = s.cart.items.map(item => {
        if (item.line_number === event.lineNumber) {
          return {
            ...item,
            status: event.status,
            product_name: event.productName || item.product_name,
            unit_price: event.unitPrice || item.unit_price,
            total_price: event.totalPrice || item.total_price,
            backorder_reason: event.backorderReason
          } as CartItem;
        }
        return item;
      });

      // Remove from pending items map
      const newPendingItems = new Map(s.pendingItems);
      newPendingItems.delete(event.lineNumber);

      return {
        ...s,
        cart: {
          ...s.cart,
          items: updatedItems
        },
        pendingItems: newPendingItems
      };
    });
  }

  // NEW: Connect to SSE when cart is loaded
  private async connectSse(cartId: string): Promise<void> {
    try {
      await this.cartSseService.connect(cartId);
      console.log('[CartStore] SSE connected for cart:', cartId);
    } catch (error) {
      console.error('[CartStore] Failed to connect SSE:', error);
      // Non-fatal - cart still works without SSE
    }
  }
```

#### 3.2 Update AddItem Method with Optimistic UI

```typescript
  /**
   * Adds an item to the cart with optimistic UI
   * Creates a new cart if one doesn't exist
   * @param productId The product identifier
   * @param productName The product name (for optimistic UI)
   * @param unitPrice The unit price (for optimistic UI)
   * @param quantity The quantity to add (default: 1)
   */
  async addItem(
    productId: string, 
    productName: string, 
    unitPrice: number,
    quantity: number = 1
  ): Promise<void> {
    const cartId = await this.ensureCart();
    if (!cartId) return;

    // Generate temporary line number for optimistic UI
    const tempLineNumber = `temp-${Date.now()}`;
    
    // Add to pending items for optimistic UI
    this.state.update(s => {
      const newPendingItems = new Map(s.pendingItems);
      newPendingItems.set(tempLineNumber, {
        lineNumber: tempLineNumber,
        productId,
        quantity,
        productName,
        unitPrice,
        addedAt: new Date()
      });
      return { ...s, pendingItems: newPendingItems };
    });

    this.setLoading(true);

    try {
      const item = await firstValueFrom(
        this.cartService.addItem(cartId, productId, quantity)
      );
      
      // Replace pending item with real item from server
      this.state.update(s => {
        const newPendingItems = new Map(s.pendingItems);
        newPendingItems.delete(tempLineNumber);
        
        if (s.cart) {
          // Server returns item with status = 'pending_validation'
          const updatedItems = [...s.cart.items, item];
          return {
            ...s,
            cart: {
              ...s.cart,
              items: updatedItems,
              net_price: s.cart.net_price + (item.total_price || 0)
            },
            pendingItems: newPendingItems
          };
        }
        return { ...s, pendingItems: newPendingItems };
      });

      this.notificationService.showSuccess(`${productName} added to cart - validating...`);
    } catch (error) {
      // Remove pending item on error
      this.state.update(s => {
        const newPendingItems = new Map(s.pendingItems);
        newPendingItems.delete(tempLineNumber);
        return { ...s, pendingItems: newPendingItems };
      });
      
      this.handleError(error, 'Failed to add item to cart');
    } finally {
      this.setLoading(false);
    }
  }
```

#### 3.3 Update LoadCart and CreateCart Methods

```typescript
  /**
   * Creates a new shopping cart
   * @param customerId Optional customer ID for authenticated users
   */
  async createCart(customerId?: string): Promise<void> {
    this.setLoading(true);
    this.setError(null);

    try {
      const cart = await firstValueFrom(this.cartService.createCart(customerId));
      this.state.update(s => ({
        ...s,
        cart,
        cartId: cart.cart_id,
        pendingItems: new Map() // Reset pending items
      }));
      this.persistCartId(cart.cart_id);
      
      // NEW: Connect to SSE
      await this.connectSse(cart.cart_id);
      
      this.notificationService.showSuccess('Cart created successfully');
    } catch (error) {
      this.handleError(error, 'Failed to create cart');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Loads an existing cart by ID
   * @param cartId The UUID of the cart to load
   */
  async loadCart(cartId: string): Promise<void> {
    this.setLoading(true);
    this.setError(null);

    try {
      const cart = await firstValueFrom(this.cartService.getCart(cartId));
      this.state.update(s => ({
        ...s,
        cart,
        cartId: cart.cart_id,
        pendingItems: new Map() // Reset pending items
      }));
      this.persistCartId(cart.cart_id);
      
      // NEW: Connect to SSE
      await this.connectSse(cart.cart_id);
    } catch (error) {
      this.handleError(error, 'Failed to load cart');
      this.clearPersistedCart();
    } finally {
      this.setLoading(false);
    }
  }
```

#### 3.4 Update ClearCart Method

```typescript
  /**
   * Clears the cart by deleting it
   */
  async clearCart(): Promise<void> {
    const cartId = this.state().cartId;
    if (!cartId) return;

    this.setLoading(true);

    try {
      await firstValueFrom(this.cartService.deleteCart(cartId));
      
      // NEW: Disconnect SSE
      this.cartSseService.disconnect();
      
      this.state.update(s => ({
        ...s,
        cart: null,
        cartId: null,
        pendingItems: new Map()
      }));
      this.clearPersistedCart();
      this.notificationService.showSuccess('Cart cleared');
    } catch (error) {
      this.handleError(error, 'Failed to clear cart');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Clears cart after successful order placement
   */
  async clearCartAfterOrder(): Promise<void> {
    // NEW: Disconnect SSE
    this.cartSseService.disconnect();
    
    this.clearPersistedCart();
    this.state.update(s => ({
      ...s,
      cart: null,
      cartId: null,
      checkoutStep: 'cart',
      pendingItems: new Map()
    }));
  }
```

---

### Phase 4: Update Cart Service

**File**: `src/app/services/cart.service.ts`

No changes required - the API endpoints remain the same. The `addItem` method already returns `Observable<CartItem>` and the backend will now include the `status` field in the response.

---

### Phase 5: Update UI Components

#### 5.1 Update CartItem Model Interface (Already done in Phase 1)

#### 5.2 Update CartItemComponent

**File**: `src/app/features/cart/components/cart-item/cart-item.component.ts`

```typescript
import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CartItem } from '../../../../models/cart';
import { ProductService } from '../../../../services/product.service';

@Component({
  selector: 'app-cart-item',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './cart-item.component.html',
  styleUrls: ['./cart-item.component.scss']
})
export class CartItemComponent {
  @Input() item!: CartItem;
  @Input() currency: string = 'USD';
  @Output() updateQuantity = new EventEmitter<number>();
  @Output() remove = new EventEmitter<void>();

  private productService = inject(ProductService);

  /**
   * Check if item is in pending validation state
   */
  get isPendingValidation(): boolean {
    return this.item.status === 'pending_validation';
  }

  /**
   * Check if item is on backorder
   */
  get isBackorder(): boolean {
    return this.item.status === 'backorder';
  }

  /**
   * Check if item is confirmed
   */
  get isConfirmed(): boolean {
    return this.item.status === 'confirmed';
  }

  /**
   * Get display status text
   */
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

  /**
   * Get CSS class for status badge
   */
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

  /**
   * Check if quantity controls should be disabled
   */
  get isQuantityControlsDisabled(): boolean {
    return this.isPendingValidation || this.isBackorder;
  }

  onQuantityChange(event: Event): void {
    const quantity = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(quantity) && quantity >= 1 && quantity <= 99) {
      this.updateQuantity.emit(quantity);
    }
  }

  incrementQuantity(): void {
    if (this.item.quantity < 99 && !this.isQuantityControlsDisabled) {
      this.updateQuantity.emit(this.item.quantity + 1);
    }
  }

  decrementQuantity(): void {
    if (this.item.quantity > 1 && !this.isQuantityControlsDisabled) {
      this.updateQuantity.emit(this.item.quantity - 1);
    }
  }

  onRemove(): void {
    this.remove.emit();
  }
}
```

**File**: `src/app/features/cart/components/cart-item/cart-item.component.html`

Update the template to show status indicators:

```html
<!-- Cart Item Template -->
<div class="cart-item" [class.pending]="isPendingValidation" [class.backorder]="isBackorder">
  <!-- Product Info -->
  <div class="product-info">
    <div class="product-details">
      <h3 class="product-name">{{ item.product_name }}</h3>
      <span class="product-id">Item #{{ item.line_number }}</span>
      
      <!-- NEW: Status Badge -->
      <span class="status-badge" [class]="statusClass" *ngIf="statusText">
        <span class="status-icon" *ngIf="isPendingValidation">⟳</span>
        <span class="status-icon" *ngIf="isBackorder">!</span>
        <span class="status-icon" *ngIf="isConfirmed">✓</span>
        {{ statusText }}
      </span>
      
      <!-- NEW: Backorder Reason -->
      <span class="backorder-reason" *ngIf="isBackorder && item.backorder_reason">
        {{ item.backorder_reason }}
      </span>
      
      <span class="unit-price" *ngIf="isConfirmed">
        {{ item.unit_price | currency:currency }} each
      </span>
      <span class="unit-price pending" *ngIf="!isConfirmed">
        Price pending validation
      </span>
    </div>
  </div>

  <!-- Quantity Controls -->
  <div class="quantity-section">
    <div class="quantity-controls">
      <button 
        class="btn-quantity" 
        (click)="decrementQuantity()"
        [disabled]="item.quantity <= 1 || isQuantityControlsDisabled"
        aria-label="Decrease quantity">
        -
      </button>
      <input 
        type="number" 
        class="quantity-input"
        [value]="item.quantity"
        (change)="onQuantityChange($event)"
        min="1"
        max="99"
        [disabled]="isQuantityControlsDisabled"
        aria-label="Quantity">
      <button 
        class="btn-quantity" 
        (click)="incrementQuantity()"
        [disabled]="item.quantity >= 99 || isQuantityControlsDisabled"
        aria-label="Increase quantity">
        +
      </button>
    </div>
    <button class="btn-remove" (click)="onRemove()">
      Delete
    </button>
  </div>

  <!-- Price -->
  <div class="price-section">
    <span class="item-total" *ngIf="isConfirmed">
      {{ item.total_price | currency:currency }}
    </span>
    <span class="item-total pending" *ngIf="!isConfirmed">
      --
    </span>
  </div>
</div>
```

**File**: `src/app/features/cart/components/cart-item/cart-item.component.scss`

Add status styles:

```scss
// Add to existing styles

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  margin-top: 0.25rem;
  
  .status-icon {
    font-size: 0.875rem;
  }
  
  &.status-pending {
    background-color: #fff3cd;
    color: #856404;
  }
  
  &.status-backorder {
    background-color: #f8d7da;
    color: #721c24;
  }
  
  &.status-confirmed {
    background-color: #d4edda;
    color: #155724;
  }
}

.backorder-reason {
  display: block;
  font-size: 0.75rem;
  color: #666;
  margin-top: 0.25rem;
  font-style: italic;
}

.unit-price.pending {
  color: #999;
  font-style: italic;
}

.item-total.pending {
  color: #999;
}

// Disable styles for pending/backorder items
.cart-item.pending {
  opacity: 0.8;
  background-color: #fafafa;
}

.cart-item.backorder {
  background-color: #fff5f5;
}

.quantity-input:disabled,
.btn-quantity:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

#### 5.3 Update CartComponent

**File**: `src/app/features/cart/cart.component.ts`

```typescript
import { Component, inject, Signal, computed } from '@angular/core'; // Add computed
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CartStore } from '../../store';
import { Cart, CartItem } from '../../models/cart';
import { CartItemComponent } from './components/cart-item/cart-item.component';
import { CartSummaryComponent } from './components/cart-summary/cart-summary.component';
import { EmptyCartComponent } from './components/empty-cart/empty-cart.component';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule,
    CartItemComponent,
    CartSummaryComponent,
    EmptyCartComponent
  ],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss']
})
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

  onUpdateQuantity(lineNumber: string, quantity: number): void {
    if (quantity <= 0) {
      this.onRemoveItem(lineNumber);
    } else {
      this.cartStore.updateItemQuantity(lineNumber, quantity);
    }
  }

  onRemoveItem(lineNumber: string): void {
    this.cartStore.removeItem(lineNumber);
  }

  onClearCart(): void {
    if (confirm('Are you sure you want to clear your cart?')) {
      this.cartStore.clearCart();
    }
  }

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

**File**: `src/app/features/cart/cart.component.html`

Add validation warnings:

```html
<!-- Add at top of cart, before items list -->
<div class="validation-warnings" *ngIf="hasPendingItems() || hasBackorderItems()">
  <!-- Pending Items Warning -->
  <div class="alert alert-info" *ngIf="hasPendingItems()">
    <span class="alert-icon">⟳</span>
    <div class="alert-content">
      <strong>Validating Items</strong>
      <p>{{ pendingItems().length }} item(s) are being validated. Please wait before checking out.</p>
    </div>
  </div>
  
  <!-- Backorder Items Warning -->
  <div class="alert alert-warning" *ngIf="hasBackorderItems()">
    <span class="alert-icon">!</span>
    <div class="alert-content">
      <strong>Backorder Items</strong>
      <p>{{ backorderItems().length }} item(s) are on backorder and won't ship immediately.</p>
      <ul class="backorder-list">
        <li *ngFor="let item of backorderItems()">
          {{ item.product_name }} - {{ item.backorder_reason }}
        </li>
      </ul>
    </div>
  </div>
</div>

<!-- Update checkout button to show disabled reason -->
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

**File**: `src/app/features/cart/cart.component.scss`

Add alert styles:

```scss
.validation-warnings {
  margin-bottom: 1.5rem;
}

.alert {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  
  &.alert-info {
    background-color: #e3f2fd;
    border: 1px solid #bbdefb;
    color: #0d47a1;
  }
  
  &.alert-warning {
    background-color: #fff3e0;
    border: 1px solid #ffe0b2;
    color: #e65100;
  }
  
  .alert-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }
  
  .alert-content {
    flex: 1;
    
    strong {
      display: block;
      margin-bottom: 0.25rem;
    }
    
    p {
      margin: 0;
      font-size: 0.875rem;
    }
  }
}

.backorder-list {
  margin: 0.5rem 0 0 0;
  padding-left: 1.25rem;
  font-size: 0.875rem;
}

.checkout-hint {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #666;
}
```

#### 5.4 Update CartSummaryComponent

**File**: `src/app/features/cart/components/cart-summary/cart-summary.component.ts`

```typescript
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-cart-summary',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './cart-summary.component.html',
  styleUrls: ['./cart-summary.component.scss']
})
export class CartSummaryComponent {
  @Input() subtotal = 0;
  @Input() tax = 0;
  @Input() shipping = 0;
  @Input() total = 0;
  @Input() currency = 'USD';
  @Input() itemCount = 0;
  @Input() canCheckout = false;
  @Input() hasPendingItems = false; // NEW
  @Input() hasBackorderItems = false; // NEW
  @Output() checkout = new EventEmitter<void>();
  @Output() clearCart = new EventEmitter<void>();

  onCheckout(): void {
    this.checkout.emit();
  }

  onClearCart(): void {
    this.clearCart.emit();
  }
}
```

#### 5.5 Update ProductCardComponent

**File**: `src/app/features/products/product-list/components/product-card/product-card.component.ts`

```typescript
import { Component, Input, Output, EventEmitter, inject, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Product, ProductImage } from '../../../../../models/product';
import { ProductService } from '../../../../../services/product.service';
import { CartStore } from '../../../../../store'; // NEW

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.scss']
})
export class ProductCardComponent {
  @Input() product!: Product;
  @Output() viewDetails = new EventEmitter<Product>();
  @Output() quickView = new EventEmitter<Product>();
  // Remove addToCart output - handle internally

  private productService = inject(ProductService);
  private cartStore = inject(CartStore); // NEW

  private mainImage = signal<ProductImage | undefined>(undefined);
  
  // NEW: Track adding state for optimistic UI feedback
  isAddingToCart = signal<boolean>(false);

  constructor() {
    effect(() => {
      if (this.product) {
        const img = this.productService.getMainImage(this.product);
        this.mainImage.set(img);
      }
    });
  }

  get mainImageUrl(): string {
    if (!this.product) {
      return '/assets/placeholder-product.jpg';
    }
    const img = this.mainImage();
    if (!img) {
      return '/assets/placeholder-product.jpg';
    }
    return this.productService.getImageUrl(this.product.id, img.minio_object_name);
  }

  get discountPercentage(): number {
    if (!this.product) {
      return 0;
    }
    return this.productService.calculateDiscountPercentage(
      this.product.initial_price,
      this.product.final_price
    );
  }

  get hasDiscount(): boolean {
    if (!this.product) {
      return false;
    }
    return this.product.final_price < this.product.initial_price;
  }

  onViewDetails(): void {
    this.viewDetails.emit(this.product);
  }

  onQuickView(event: Event): void {
    event.stopPropagation();
    this.quickView.emit(this.product);
  }

  // NEW: Handle add to cart with optimistic UI
  async onAddToCart(event: Event): Promise<void> {
    event.stopPropagation();
    if (!this.product.in_stock || this.isAddingToCart()) {
      return;
    }

    this.isAddingToCart.set(true);
    
    try {
      await this.cartStore.addItem(
        this.product.id.toString(),
        this.product.name,
        this.product.final_price,
        1
      );
    } finally {
      // Keep loading state briefly for better UX
      setTimeout(() => {
        this.isAddingToCart.set(false);
      }, 500);
    }
  }
}
```

**File**: `src/app/features/products/product-list/components/product-card/product-card.component.html`

Update add to cart button:

```html
<button 
  class="btn-add-to-cart" 
  [disabled]="!product.in_stock || isAddingToCart()"
  (click)="onAddToCart($event)">
  <span *ngIf="isAddingToCart()" class="spinner"></span>
  <span *ngIf="!isAddingToCart()">
    {{ product.in_stock ? 'Add to Cart' : 'Out of Stock' }}
  </span>
</button>
```

---

### Phase 6: Update Checkout Component

**File**: `src/app/features/checkout/checkout.component.ts`

Update the completeCheckout method to handle validation states:

```typescript
  // Complete checkout - delegates to OrderStore
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

    // NEW: Check for pending validation items
    if (this.cartStore.hasPendingValidationItems()) {
      this.notificationService.showError(
        'Please wait for all items to be validated before checkout'
      );
      return;
    }

    // NEW: Check for backorder items and confirm
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

### Phase 7: Update Order Store

**File**: `src/app/store/order/order.store.ts`

Ensure proper cleanup of cart SSE when order is complete:

```typescript
  async checkout(cartId: string): Promise<OrderConfirmation | null> {
    // ... existing code ...
    
    try {
      // Step 1: Initiate checkout via HTTP
      console.log('[OrderStore] Initiating checkout for cart:', cartId);
      await firstValueFrom(this.cartService.checkout(cartId));
      
      // NEW: Disconnect cart SSE since we're transitioning to order
      console.log('[OrderStore] Disconnecting cart SSE...');
      // Note: CartStore will handle this via clearCartAfterOrder
      
      // ... rest of existing code ...
    } catch (error) {
      // ... existing error handling ...
    }
  }
```

---

## Testing Strategy

### Unit Tests

#### CartSseService Tests
```typescript
describe('CartSseService', () => {
  let service: CartSseService;
  let mockEventSource: any;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CartSseService]
    });
    service = TestBed.inject(CartSseService);
  });

  it('should connect to SSE endpoint', async () => {
    const connectPromise = service.connect('cart-123');
    
    // Simulate connection open
    mockEventSource.onopen();
    
    await expectAsync(connectPromise).toBeResolved();
    expect(service.isConnected()).toBeTrue();
  });

  it('should emit itemValidated event', (done) => {
    service.itemValidated.subscribe(event => {
      expect(event.lineNumber).toBe('001');
      expect(event.status).toBe('confirmed');
      done();
    });

    service.connect('cart-123').then(() => {
      const messageEvent = new MessageEvent('cart.item.validated', {
        data: JSON.stringify({
          lineNumber: '001',
          status: 'confirmed',
          productName: 'Widget',
          unitPrice: 10.00,
          quantity: 2,
          totalPrice: 20.00
        })
      });
      mockEventSource.dispatchEvent(messageEvent);
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
      lineNumber: '001',
      status: 'confirmed',
      productName: 'Widget',
      unitPrice: 10.00,
      quantity: 2,
      totalPrice: 20.00,
      productId: 'prod-1'
    };

    // Call private method via any cast or make it public for testing
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

### Integration Tests

#### Add to Cart Flow
```typescript
describe('Add to Cart Integration', () => {
  it('should add item with optimistic UI and update on SSE event', async () => {
    // Setup
    const cartStore = TestBed.inject(CartStore);
    const cartSseService = TestBed.inject(CartSseService);
    
    // Create cart
    await cartStore.createCart();
    
    // Add item
    await cartStore.addItem('prod-1', 'Widget', 10.00, 1);
    
    // Verify pending state
    expect(cartStore.pendingValidationItems().length).toBe(1);
    
    // Simulate SSE event
    const event: CartItemValidatedEvent = {
      lineNumber: cartStore.items()[0].line_number,
      status: 'confirmed',
      productName: 'Widget',
      unitPrice: 10.00,
      quantity: 1,
      totalPrice: 10.00,
      productId: 'prod-1'
    };
    
    (cartStore as any).handleItemValidated(event);
    
    // Verify confirmed state
    expect(cartStore.items()[0].status).toBe('confirmed');
    expect(cartStore.hasPendingValidationItems()).toBeFalse();
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
1. Disable SSE connections in CartStore (comment out `connectSse` calls)
2. Frontend will work in "degraded" mode - items will still be added but validation status won't update in real-time
3. Cart refresh (page reload) will show current validation status

---

## Performance Considerations

1. **SSE Connection Management**:
   - Only one SSE connection per active cart
   - Connection established on cart load/creation
   - Connection closed on cart clear/checkout
   - Automatic reconnection with exponential backoff

2. **Optimistic UI**:
   - Items appear immediately with "Validating..." status
   - No blocking waits for API calls
   - Smooth user experience

3. **Memory Management**:
   - pendingItems Map cleared after validation or error
   - SSE subscriptions cleaned up on service destroy
   - No memory leaks from abandoned connections

4. **Network Efficiency**:
   - SSE used only for validation events
   - No polling required
   - Minimal overhead (text-based protocol)

---

## Error Handling

### SSE Connection Failures
- Non-fatal - cart functionality continues without real-time updates
- User can still add/remove items
- Page refresh will sync latest state
- Reconnection attempts with exponential backoff

### Validation Timeouts
- Backend responsible for timeout handling
- Frontend shows "Validating..." indefinitely
- User can remove item if tired of waiting
- No automatic timeout on frontend

### Network Interruptions
- SSE automatically attempts reconnection
- Cart state preserved
- User notified of connection issues via console logs

---

## Security Considerations

1. **SSE Endpoint**: Uses same authentication as REST API
2. **Event Validation**: Only accept events for current cart ID
3. **No Sensitive Data**: SSE events contain only cart item metadata
4. **CORS**: Configured on backend to allow EventSource connections

---

## Summary of Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `src/app/models/cart.ts` | Modify | Add status fields and SSE event interfaces |
| `src/app/services/cart-sse.service.ts` | Create | New SSE service for cart validation events |
| `src/app/store/cart/cart.store.ts` | Modify | Add SSE integration, optimistic UI, validation state |
| `src/app/features/cart/components/cart-item/*` | Modify | Add status indicators and disabled states |
| `src/app/features/cart/cart.component.*` | Modify | Add validation warnings and checkout restrictions |
| `src/app/features/cart/components/cart-summary/*` | Modify | Add validation state inputs |
| `src/app/features/products/product-list/components/product-card/*` | Modify | Update add to cart with optimistic UI |
| `src/app/features/checkout/checkout.component.ts` | Modify | Add validation checks before checkout |

---

## Success Metrics

1. **Performance**: Add to cart response < 100ms (optimistic UI)
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

**Plan Version**: 1.0
**Last Updated**: 2026-02-17
**Author**: AI Assistant
