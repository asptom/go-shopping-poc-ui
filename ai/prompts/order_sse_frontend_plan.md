# Order SSE Frontend Implementation Plan

## Overview

This document provides a detailed implementation plan for adding Server-Sent Events (SSE) support to the frontend Angular application. The frontend will connect to the backend SSE endpoint to receive real-time notifications when an order is created from a cart checkout.

**Use Case:** Frontend calls `POST /api/v1/carts/{id}/checkout`, then connects to `GET /api/v1/carts/{id}/stream` to receive the order number when the `order.created` event completes the checkout saga.

**Backend SSE Endpoint:** `GET /api/v1/carts/{id}/stream`
**Events:** `connected`, `order.created`

---

## Architecture Decisions

### SSE Approach vs Alternatives

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **Native EventSource with Signals** | Built-in browser API, integrates with signals, reactive state | No custom headers | **Primary choice** |
| RxJS + EventSource | Observable streams, easy composition | Adds complexity, EventSource still required | Secondary option |
| HTTP Polling | Works everywhere | Inefficient, delays, unnecessary requests | Rejected |
| WebSockets | Bidirectional | Overkill for server-to-client only, requires upgrade | Rejected |

### Why Native EventSource with Signals is the Best Fit

1. **Simplicity**: Native browser API with automatic reconnection
2. **Signals Integration**: Uses Angular 20's signals for reactive state management
3. **Server-to-client only**: Perfect for this saga pattern use case
4. **Zoneless compatibility**: Works well with Angular 20's zoneless change detection
5. **Separation of concerns**: OrderSseService manages connection, OrderStore manages state

---

## Implementation Architecture

### Data Flow

```
┌─────────────────────┐     checkout()     ┌─────────────────────┐
│ CheckoutComponent   │ ─────────────────▶ │      CartStore      │
└─────────────────────┘                    └──────────┬──────────┘
                                                      │
                                                      ▼
┌─────────────────────┐                    ┌─────────────────────┐
│ OrderConfirmation   │                    │    CartService      │
│    Component        │                    │   (POST checkout)   │
└─────────────────────┘                    └──────────┬──────────┘
        ▲                                             │
        │                                             ▼
        │                              ┌─────────────────────────┐
        │                              │  POST /carts/{id}/checkout
        │                              └──────────┬──────────────┘
        │                                         │
        │                              ┌──────────▼──────────┐
        │                              │  OrderSseService    │
        │                              │  (EventSource)      │
        │                              └──────────┬──────────┘
        │                                         │
        │                              ┌──────────▼──────────┐
        │                              │ OrderStore (Signals)│
        │                              │ - orderConfirmation │
        │                              │ - connectionState   │
        │                              └──────────┬──────────┘
        │                                         │
        └─────────────────────────────────────────┘
```

### State Management Strategy

Separate **OrderStore** from CartStore for better separation of concerns:
1. **CartStore** - Manages cart lifecycle, initiates checkout
2. **OrderStore** - Manages SSE connection, order confirmation state
3. **OrderSseService** - Low-level SSE connection management

---

## File Structure

### New Files

| File | Description |
|------|-------------|
| `src/app/services/order-sse.service.ts` | SSE connection manager using EventSource with signals |
| `src/app/store/order/order.store.ts` | Order state management with SSE integration |
| `src/app/store/order/index.ts` | Order store barrel export |
| `src/app/models/order.ts` | Order model interfaces |
| `src/app/features/order-confirmation/order-confirmation.component.ts` | Order confirmation page component |
| `src/app/features/order-confirmation/order-confirmation.component.html` | Order confirmation template |
| `src/app/features/order-confirmation/order-confirmation.component.scss` | Order confirmation styles |
| `src/app/features/order-confirmation/order-confirmation.routes.ts` | Order confirmation routes |

### Modified Files

| File | Changes |
|------|---------|
| `src/app/store/cart/cart.store.ts` | Remove checkout logic, delegate to OrderStore |
| `src/app/features/checkout/checkout.component.ts` | Use OrderStore for checkout, handle cleanup |
| `src/app/app.routes.ts` | Add order-confirmation route |
| `src/app/store/index.ts` | Export OrderStore |

---

## Detailed Implementation

### Step 1: Create Order Model Interfaces

**File:** `src/app/models/order.ts`

Create a new file for order-related models:

```typescript
/**
 * Order model interfaces for SSE events and order confirmation
 */

/**
 * Order data received from SSE order.created event
 * Matches backend payload structure
 */
export interface OrderCreatedEvent {
  orderId: string;
  orderNumber: string;
  cartId: string;
  total: number;
}

/**
 * Order confirmation data stored in state
 */
export interface OrderConfirmation {
  orderId: string;
  orderNumber: string;
  cartId: string;
  total: number;
  createdAt: Date;
}

/**
 * SSE connection states
 */
export type SSEConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'closed';

/**
 * SSE connection state with signals
 */
export interface SSEConnectionState {
  status: SSEConnectionStatus;
  error: string | null;
  lastEventId: string | null;
}

/**
 * Checkout process states
 */
export type CheckoutStatus = 
  | 'idle' 
  | 'submitting' 
  | 'awaiting_order' 
  | 'order_received' 
  | 'error';

/**
 * Order store state interface
 */
export interface OrderStoreState {
  orderConfirmation: OrderConfirmation | null;
  checkoutStatus: CheckoutStatus;
  connectionState: SSEConnectionState;
  error: string | null;
}
```

### Step 2: Create Order SSE Service

**File:** `src/app/services/order-sse.service.ts`

Service managing EventSource connections with signals-based state:

```typescript
import { Injectable, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../environments/environment';
import { 
  OrderCreatedEvent, 
  SSEConnectionState, 
  SSEConnectionStatus 
} from '../models/order';
import { Subject } from 'rxjs';

/**
 * Service for managing Server-Sent Events (SSE) connections
 * Uses native EventSource API with signals for reactive state
 */
@Injectable({
  providedIn: 'root'
})
export class OrderSseService {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3;
  private readonly reconnectDelay = 1000;
  private cartId: string | null = null;
  
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
  private readonly orderCreated$ = new Subject<OrderCreatedEvent>();
  private readonly connectionError$ = new Subject<Error>();
  private readonly connected$ = new Subject<string>();

  // Public observables for consumers
  readonly orderCreated = this.orderCreated$.asObservable();
  readonly connectionError = this.connectionError$.asObservable();
  readonly connected = this.connected$.asObservable();

  /**
   * Establishes SSE connection for a specific cart
   * @param cartId The cart ID to subscribe to
   * @returns Promise that resolves when connected, rejects on fatal error
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
        console.error('[SSE] Failed to create EventSource:', error);
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
      console.log('[SSE] Connection opened for cart:', this.cartId);
      this.reconnectAttempts = 0;
      this._connectionState.update(state => ({
        ...state,
        status: 'connected',
        error: null
      }));
      resolve();
    };

    // Handle connected event
    this.eventSource.addEventListener('connected', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[SSE] Connected event received:', data);
        this.connected$.next(data.cartId);
      } catch (e) {
        console.error('[SSE] Failed to parse connected event:', e);
      }
    });

    // Handle order.created event
    this.eventSource.addEventListener('order.created', (event: MessageEvent) => {
      try {
        const data: OrderCreatedEvent = JSON.parse(event.data);
        console.log('[SSE] Order created event received:', data);
        
        this._connectionState.update(state => ({
          ...state,
          lastEventId: event.lastEventId || null
        }));
        
        this.orderCreated$.next(data);
        
        // Auto-disconnect after receiving order
        this.disconnect();
      } catch (e) {
        console.error('[SSE] Failed to parse order.created event:', e);
      }
    });

    // Handle errors
    this.eventSource.onerror = (error) => {
      console.error('[SSE] Connection error:', error);
      
      const readyState = this.eventSource?.readyState;
      const wasConnected = this._connectionState().status === 'connected';
      
      // EventSource.CLOSED = 2
      if (readyState === EventSource.CLOSED) {
        this._connectionState.set({
          status: 'error',
          error: 'Connection closed unexpectedly',
          lastEventId: this._connectionState().lastEventId
        });
        
        this.connectionError$.next(new Error('Connection closed'));

        // Only reject if we haven't connected yet
        if (!wasConnected) {
          reject(new Error('Failed to establish SSE connection'));
        }
      }
    };
  }

  /**
   * Disconnects the SSE connection and cleans up
   */
  disconnect(): void {
    if (this.eventSource) {
      console.log('[SSE] Disconnecting...');
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
   * Call this from OrderStore when connectionError is received
   */
  attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SSE] Max reconnection attempts reached');
      this._connectionState.set({
        status: 'error',
        error: 'Max reconnection attempts reached',
        lastEventId: this._connectionState().lastEventId
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[SSE] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      if (this.cartId) {
        this.connect(this.cartId).catch(() => {
          // Reconnection failed, will try again if attempts remain
        });
      }
    }, delay);
  }

  /**
   * Clean up resources when service is destroyed
   */
  cleanup(): void {
    this.disconnect();
    this.orderCreated$.complete();
    this.connectionError$.complete();
    this.connected$.complete();
  }
}
```

### Step 3: Create Order Store

**File:** `src/app/store/order/order.store.ts`

Dedicated store for order state and SSE orchestration:

```typescript
import { Injectable, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { OrderSseService } from '../../services/order-sse.service';
import { CartService } from '../../services/cart.service';
import { NotificationService } from '../../core/notification/notification.service';
import { 
  OrderConfirmation, 
  OrderCreatedEvent,
  OrderStoreState,
  CheckoutStatus 
} from '../../models/order';

/**
 * OrderStore manages order state and SSE connections
 * Separates order concerns from CartStore for better architecture
 */
@Injectable({
  providedIn: 'root'
})
export class OrderStore {
  private readonly orderSseService = inject(OrderSseService);
  private readonly cartService = inject(CartService);
  private readonly notificationService = inject(NotificationService);

  // Private state signal
  private readonly state = signal<OrderStoreState>({
    orderConfirmation: null,
    checkoutStatus: 'idle',
    connectionState: {
      status: 'idle',
      error: null,
      lastEventId: null
    },
    error: null
  });

  // Public computed selectors
  readonly orderConfirmation = computed(() => this.state().orderConfirmation);
  readonly checkoutStatus = computed(() => this.state().checkoutStatus);
  readonly connectionState = computed(() => this.state().connectionState);
  readonly error = computed(() => this.state().error);
  readonly isSubmitting = computed(() => this.state().checkoutStatus === 'submitting');
  readonly isAwaitingOrder = computed(() => this.state().checkoutStatus === 'awaiting_order');
  readonly hasOrder = computed(() => !!this.state().orderConfirmation);

  // Track active SSE subscriptions for cleanup
  private sseSubscriptions: (() => void)[] = [];

  /**
   * Initiates checkout and waits for order creation via SSE
   * @param cartId The cart ID to checkout
   * @returns Promise resolving to order confirmation or null
   */
  async checkout(cartId: string): Promise<OrderConfirmation | null> {
    // Reset state
    this.state.set({
      orderConfirmation: null,
      checkoutStatus: 'submitting',
      connectionState: {
        status: 'idle',
        error: null,
        lastEventId: null
      },
      error: null
    });

    try {
      // Step 1: Initiate checkout via HTTP
      console.log('[OrderStore] Initiating checkout for cart:', cartId);
      await firstValueFrom(this.cartService.checkout(cartId));
      
      console.log('[OrderStore] Checkout initiated, connecting to SSE stream...');
      
      // Step 2: Set awaiting state
      this.state.update(s => ({
        ...s,
        checkoutStatus: 'awaiting_order'
      }));

      // Step 3: Subscribe to SSE events before connecting
      this.subscribeToSseEvents();

      // Step 4: Connect to SSE
      await this.orderSseService.connect(cartId);
      
      // Step 5: Wait for order.created event with timeout
      const orderConfirmation = await this.waitForOrderCreated(30000);
      
      if (orderConfirmation) {
        this.state.update(s => ({
          ...s,
          orderConfirmation,
          checkoutStatus: 'order_received',
          error: null
        }));
        
        this.notificationService.showSuccess(
          `Order ${orderConfirmation.orderNumber} placed successfully!`
        );
      }
      
      return orderConfirmation;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Checkout failed';
      console.error('[OrderStore] Checkout error:', errorMessage);
      
      this.state.update(s => ({
        ...s,
        checkoutStatus: 'error',
        error: errorMessage
      }));
      
      this.notificationService.showError(errorMessage);
      return null;
    }
  }

  /**
   * Subscribe to SSE service events
   */
  private subscribeToSseEvents(): void {
    // Clear any existing subscriptions
    this.cleanupSseSubscriptions();

    // Subscribe to order created
    const orderSub = this.orderSseService.orderCreated.subscribe({
      next: (event: OrderCreatedEvent) => {
        console.log('[OrderStore] Order created event received:', event);
        // Order created - state will be updated by waitForOrderCreated
      },
      error: (error: Error) => {
        console.error('[OrderStore] Order created stream error:', error);
      }
    });

    // Subscribe to connection errors for retry logic
    const errorSub = this.orderSseService.connectionError.subscribe({
      next: (error: Error) => {
        console.warn('[OrderStore] SSE connection error:', error.message);
        this.state.update(s => ({
          ...s,
          connectionState: {
            ...s.connectionState,
            status: 'error',
            error: error.message
          }
        }));
        
        // Attempt reconnection
        this.orderSseService.attemptReconnect();
      }
    });

    // Subscribe to connection state changes
    const stateSub = this.orderSseService.connectionState;
    // Note: Since connectionState is a computed signal, we don't need to subscribe
    // It's automatically tracked by Angular's change detection

    this.sseSubscriptions.push(
      () => orderSub.unsubscribe(),
      () => errorSub.unsubscribe()
    );
  }

  /**
   * Waits for order.created event with timeout
   * @param timeoutMs Timeout in milliseconds
   * @returns Promise resolving to OrderConfirmation or null
   */
  private waitForOrderCreated(timeoutMs: number): Promise<OrderConfirmation | null> {
    return new Promise((resolve) => {
      let resolved = false;

      // Set timeout
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.warn('[OrderStore] Order creation timeout');
          this.cleanupSseSubscriptions();
          this.orderSseService.disconnect();
          resolve(null);
        }
      }, timeoutMs);

      // Subscribe to order created
      const subscription = this.orderSseService.orderCreated.subscribe({
        next: (event: OrderCreatedEvent) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            
            const confirmation: OrderConfirmation = {
              orderId: event.orderId,
              orderNumber: event.orderNumber,
              cartId: event.cartId,
              total: event.total,
              createdAt: new Date()
            };
            
            this.cleanupSseSubscriptions();
            resolve(confirmation);
          }
        },
        error: () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            this.cleanupSseSubscriptions();
            resolve(null);
          }
        }
      });

      this.sseSubscriptions.push(() => subscription.unsubscribe());
    });
  }

  /**
   * Clears order confirmation and resets state
   * Call after leaving confirmation page
   */
  clearOrder(): void {
    this.state.set({
      orderConfirmation: null,
      checkoutStatus: 'idle',
      connectionState: {
        status: 'idle',
        error: null,
        lastEventId: null
      },
      error: null
    });
    this.cleanupSseSubscriptions();
    this.orderSseService.disconnect();
  }

  /**
   * Retry checkout after error
   */
  async retryCheckout(cartId: string): Promise<OrderConfirmation | null> {
    this.clearOrder();
    return this.checkout(cartId);
  }

  /**
   * Clean up SSE subscriptions
   */
  private cleanupSseSubscriptions(): void {
    this.sseSubscriptions.forEach(unsub => unsub());
    this.sseSubscriptions = [];
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    this.cleanupSseSubscriptions();
    this.orderSseService.cleanup();
  }
}
```

### Step 4: Create Order Store Index

**File:** `src/app/store/order/index.ts`

```typescript
export { OrderStore } from './order.store';
```

### Step 5: Update Store Index

**File:** `src/app/store/index.ts`

Add OrderStore to existing exports:

```typescript
// Existing exports
export { CartStore } from './cart';
export { ProductStore } from './product';
export { CustomerStore } from './customer';

// Add new export
export { OrderStore } from './order';
```

### Step 6: Update Cart Store - Remove Checkout Logic

**File:** `src/app/store/cart/cart.store.ts`

Simplify CartStore by removing checkout logic (now in OrderStore):

```typescript
// Remove these imports and fields:
// - OrderSseService import
// - ORDER_KEY constant
// - orderConfirmation and isAwaitingOrder computed signals
// - checkout(), waitForOrderCreated(), pollForOrder(), clearOrderConfirmation() methods

// Update CartStoreState to remove order-related fields:
export interface CartStoreState {
  cart: Cart | null;
  cartId: string | null;
  loading: boolean;
  error: string | null;
  checkoutStep: 'cart' | 'contact' | 'shipping' | 'payment' | 'review' | 'confirmation';
}

// Update state initialization:
private readonly state = signal<CartStoreState>({
  cart: null,
  cartId: null,
  loading: false,
  error: null,
  checkoutStep: 'cart'
});

// Remove computed signals:
// readonly orderConfirmation = computed(() => this.state().orderConfirmation);
// readonly isAwaitingOrder = computed(() => this.state().isAwaitingOrder);

// Simplified checkout method - just validates and clears cart:
async prepareForCheckout(): Promise<boolean> {
  if (!this.canCheckout()) {
    return false;
  }
  
  // Cart is ready - OrderStore will handle the actual checkout
  return true;
}

// Add method to clear cart after successful order:
async clearCartAfterOrder(): Promise<void> {
  const cartId = this.state().cartId;
  if (cartId) {
    this.clearPersistedCart();
    this.state.update(s => ({
      ...s,
      cart: null,
      cartId: null,
      checkoutStep: 'confirmation'
    }));
  }
}

// Update setCheckoutStep to remove 'awaiting_order':
setCheckoutStep(step: Exclude<CartStoreState['checkoutStep'], 'confirmation'>): void {
  this.state.update(s => ({ ...s, checkoutStep: step }));
}
```

### Step 7: Update Checkout Component

**File:** `src/app/features/checkout/checkout.component.ts`

Update to use OrderStore:

```typescript
import { Component, inject, signal, OnInit, OnDestroy, Signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ReactiveFormsModule, FormGroup, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { CartStore, CustomerStore, OrderStore } from '../../store';
import { AuthService, UserData } from '../../auth';
import { Cart, CartItem } from '../../models/cart';
import { Address, CreditCard } from '../../models/customer';
import { CustomValidators } from '../../shared';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

/**
 * Checkout Page Component
 * Multi-step checkout flow with contact, shipping, payment, and review steps
 */
@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss']
})
export class CheckoutComponent implements OnInit, OnDestroy {
  private readonly cartStore = inject(CartStore);
  private readonly customerStore = inject(CustomerStore);
  private readonly orderStore = inject(OrderStore);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  // Cleanup subject
  private readonly destroy$ = new Subject<void>();

  // Current step in checkout flow
  currentStep = signal<number>(1);
  
  // Form groups for each step
  contactForm!: FormGroup;
  shippingForm!: FormGroup;
  billingForm!: FormGroup;
  paymentForm!: FormGroup;
  sameAsShipping = signal<boolean>(true);

  // Cart data with explicit types
  readonly cart: Signal<Cart | null> = this.cartStore.cart;
  readonly items: Signal<CartItem[]> = this.cartStore.items;
  readonly subtotal: Signal<number> = this.cartStore.subtotal;
  readonly tax: Signal<number> = this.cartStore.tax;
  readonly shipping: Signal<number> = this.cartStore.shipping;
  readonly total: Signal<number> = this.cartStore.total;
  readonly currency: Signal<string> = this.cartStore.currency;
  readonly cartLoading: Signal<boolean> = this.cartStore.loading;

  // Order store data
  readonly isSubmitting: Signal<boolean> = this.orderStore.isSubmitting;
  readonly isAwaitingOrder: Signal<boolean> = this.orderStore.isAwaitingOrder;
  readonly orderError: Signal<string | null> = this.orderStore.error;
  readonly orderConfirmation = this.orderStore.orderConfirmation;

  // User data for pre-filling
  readonly userData: Signal<UserData | null> = this.authService.userData;

  // Customer data for pre-filling
  readonly customer = computed(() => this.customerStore.customer());
  readonly defaultShippingAddress = computed(() => this.customerStore.defaultShippingAddress());
  readonly defaultBillingAddress = computed(() => this.customerStore.defaultBillingAddress());
  readonly defaultCreditCard = computed(() => this.customerStore.defaultCreditCard());

  ngOnInit(): void {
    // Initialize all forms
    this.initializeForms();

    // Load customer data and pre-fill forms when ready
    this.loadCustomerDataAndPrefill();

    // Subscribe to order confirmation to navigate
    this.orderStore.orderConfirmation
      .pipe(takeUntil(this.destroy$))
      .subscribe(confirmation => {
        if (confirmation) {
          // Clear cart and navigate
          this.cartStore.clearCartAfterOrder();
          this.router.navigate(['/order-confirmation']);
        }
      });
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.destroy$.next();
    this.destroy$.complete();
    
    // Clean up order store if checkout not complete
    if (!this.orderStore.hasOrder()) {
      this.orderStore.destroy();
    }
  }

  private async loadCustomerDataAndPrefill(): Promise<void> {
    // First, pre-fill with user data that's immediately available
    this.prefillForms();

    // Then load customer data and pre-fill again when available
    const user = this.userData();
    if (user?.email) {
      await this.customerStore.loadCustomer(user.email);
    }

    // Pre-fill after customer data loads
    this.prefillForms();
  }

  private initializeForms(): void {
    // Contact form
    this.contactForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      phone: ['', Validators.required]
    });

    // Shipping address form
    this.shippingForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      address1: ['', Validators.required],
      address2: [''],
      city: ['', Validators.required],
      state: ['', Validators.required],
      zip: ['', [Validators.required, Validators.pattern(/^\d{5}(-\d{4})?$/)]],
      country: ['US', Validators.required]
    });

    // Billing address form
    this.billingForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      address1: ['', Validators.required],
      address2: [''],
      city: ['', Validators.required],
      state: ['', Validators.required],
      zip: ['', [Validators.required, Validators.pattern(/^\d{5}(-\d{4})?$/)]],
      country: ['US', Validators.required]
    });

    // Payment form - using CustomValidators for consistency with profile screen
    this.paymentForm = this.fb.group({
      cardNumber: ['', [Validators.required, CustomValidators.creditCard('Please enter a valid credit card number')]],
      cardHolder: ['', Validators.required],
      expiryMonth: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])$/)]],
      expiryYear: ['', [Validators.required, Validators.pattern(/^\d{4}$/), this.futureYearValidator()]],
      cvv: ['', [Validators.required, CustomValidators.cvv('Please enter a valid CVV')]],
      cardType: ['visa']
    });
  }

  private prefillForms(): void {
    const user = this.userData();
    const customer = this.customer();

    // Pre-fill contact form
    if (user) {
      this.contactForm.patchValue({
        email: user.email || '',
        firstName: user.given_name || '',
        lastName: user.family_name || ''
      });
    }

    // Pre-fill phone from customer profile
    if (customer?.phone) {
      this.contactForm.patchValue({
        phone: customer.phone
      });
    }

    // Pre-fill shipping address from default shipping address
    const shippingAddress = this.defaultShippingAddress();
    if (shippingAddress) {
      this.shippingForm.patchValue({
        firstName: shippingAddress.first_name || '',
        lastName: shippingAddress.last_name || '',
        address1: shippingAddress.address_1 || '',
        address2: shippingAddress.address_2 || '',
        city: shippingAddress.city || '',
        state: shippingAddress.state || '',
        zip: shippingAddress.zip || ''
      });
    }

    // Pre-fill billing address from default billing address
    const billingAddress = this.defaultBillingAddress();
    if (billingAddress) {
      this.billingForm.patchValue({
        firstName: billingAddress.first_name || '',
        lastName: billingAddress.last_name || '',
        address1: billingAddress.address_1 || '',
        address2: billingAddress.address_2 || '',
        city: billingAddress.city || '',
        state: billingAddress.state || '',
        zip: billingAddress.zip || ''
      });

      // If billing address is different from shipping, uncheck "same as shipping"
      if (shippingAddress && billingAddress.address_id !== shippingAddress.address_id) {
        this.sameAsShipping.set(false);
      }
    }

    // Pre-fill payment form from default credit card
    const creditCard = this.defaultCreditCard();
    if (creditCard) {
      // Parse expiry date (format: "MM/YY")
      const expiryParts = creditCard.card_expires?.split('/') || [];
      const expiryMonth = expiryParts[0] || '';
      const expiryYear = expiryParts[1] ? '20' + expiryParts[1] : ''; // Convert "YY" to "YYYY"

      this.paymentForm.patchValue({
        cardType: creditCard.card_type || 'visa',
        cardNumber: creditCard.card_number || '',
        cardHolder: creditCard.card_holder_name || '',
        expiryMonth: expiryMonth,
        expiryYear: expiryYear,
        cvv: creditCard.card_cvv || ''
      });
    }
  }

  // Step navigation
  goToStep(step: number): void {
    if (step >= 1 && step <= 5) {
      this.currentStep.set(step);
    }
  }

  nextStep(): void {
    const current = this.currentStep();
    if (current < 5) {
      this.currentStep.set(current + 1);
    }
  }

  previousStep(): void {
    const current = this.currentStep();
    if (current > 1) {
      this.currentStep.set(current - 1);
    }
  }

  // Save contact information
  async saveContact(): Promise<void> {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    const contact = {
      email: this.contactForm.value.email,
      first_name: this.contactForm.value.firstName,
      last_name: this.contactForm.value.lastName,
      phone: this.contactForm.value.phone
    };

    await this.cartStore.setContact(contact);
    this.nextStep();
  }

  // Save shipping address
  async saveShipping(): Promise<void> {
    if (this.shippingForm.invalid) {
      this.shippingForm.markAllAsTouched();
      return;
    }

    const address = {
      address_type: 'shipping' as const,
      first_name: this.shippingForm.value.firstName,
      last_name: this.shippingForm.value.lastName,
      address_1: this.shippingForm.value.address1,
      address_2: this.shippingForm.value.address2 || undefined,
      city: this.shippingForm.value.city,
      state: this.shippingForm.value.state,
      zip: this.shippingForm.value.zip
    };

    await this.cartStore.addAddress(address);
    
    if (this.sameAsShipping()) {
      // Also save as billing
      await this.cartStore.addAddress({ ...address, address_type: 'billing' });
      this.goToStep(4); // Skip billing step
    } else {
      this.nextStep();
    }
  }

  // Save billing address
  async saveBilling(): Promise<void> {
    if (this.billingForm.invalid) {
      this.billingForm.markAllAsTouched();
      return;
    }

    const address = {
      address_type: 'billing' as const,
      first_name: this.billingForm.value.firstName,
      last_name: this.billingForm.value.lastName,
      address_1: this.billingForm.value.address1,
      address_2: this.billingForm.value.address2 || undefined,
      city: this.billingForm.value.city,
      state: this.billingForm.value.state,
      zip: this.billingForm.value.zip
    };

    await this.cartStore.addAddress(address);
    this.nextStep();
  }

  // Save payment information
  async savePayment(): Promise<void> {
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    const payment = {
      card_type: this.paymentForm.value.cardType,
      card_number: this.paymentForm.value.cardNumber,
      card_holder_name: this.paymentForm.value.cardHolder,
      card_expires: `${this.paymentForm.value.expiryMonth}/${this.paymentForm.value.expiryYear.slice(-2)}`,
      card_cvv: this.paymentForm.value.cvv
    };

    await this.cartStore.setPayment(payment);
    this.nextStep();
  }

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

    // Start checkout via OrderStore
    await this.orderStore.checkout(cartId);
    // Navigation handled by subscription in ngOnInit
  }

  // Retry checkout after error
  async retryCheckout(): Promise<void> {
    const cartId = this.cartStore.cartId();
    if (cartId) {
      await this.orderStore.retryCheckout(cartId);
    }
  }

  // Update item quantity
  async updateItemQuantity(lineNumber: string, quantity: number): Promise<void> {
    if (quantity < 1) return;
    await this.cartStore.updateItemQuantity(lineNumber, quantity);
  }

  // Remove item from cart
  async removeItem(lineNumber: string): Promise<void> {
    await this.cartStore.removeItem(lineNumber);
  }

  // Custom validator to ensure expiry year is in the future
  private futureYearValidator() {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      
      const year = parseInt(control.value, 10);
      const currentYear = new Date().getFullYear();
      
      if (year < currentYear) {
        return { futureYear: { message: 'Year must be current or future' } };
      }
      
      return null;
    };
  }

  // Toggle same as shipping
  toggleSameAsShipping(): void {
    this.sameAsShipping.update(value => !value);
  }

  // Copy shipping to billing
  copyShippingToBilling(): void {
    const shippingValue = this.shippingForm.value;
    this.billingForm.patchValue({
      firstName: shippingValue.firstName,
      lastName: shippingValue.lastName,
      address1: shippingValue.address1,
      address2: shippingValue.address2,
      city: shippingValue.city,
      state: shippingValue.state,
      zip: shippingValue.zip,
      country: shippingValue.country
    });
  }

  // Get error message for form control
  getErrorMessage(form: FormGroup, controlName: string): string {
    const control = form.get(controlName);
    if (control?.invalid && (control.dirty || control.touched)) {
      // Check for custom validator messages first
      const errorKeys = Object.keys(control.errors || {});
      for (const key of errorKeys) {
        const error = control.errors![key];
        if (error?.message) {
          return error.message;
        }
      }

      // Fallback to default messages
      if (control.errors?.['required']) {
        return 'This field is required';
      }
      if (control.errors?.['email']) {
        return 'Please enter a valid email address';
      }
      if (control.errors?.['pattern']) {
        return 'Invalid format';
      }
    }
    return '';
  }
}
```

### Step 8: Create Order Confirmation Component

**File:** `src/app/features/order-confirmation/order-confirmation.component.ts`

```typescript
import { Component, inject, OnInit, Signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { OrderStore } from '../../store';
import { OrderConfirmation } from '../../models/order';

/**
 * Order Confirmation Page Component
 * Displays order details after successful checkout
 */
@Component({
  selector: 'app-order-confirmation',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './order-confirmation.component.html',
  styleUrls: ['./order-confirmation.component.scss']
})
export class OrderConfirmationComponent implements OnInit {
  private readonly orderStore = inject(OrderStore);
  private readonly router = inject(Router);

  // Order data from store
  order: Signal<OrderConfirmation | null> = this.orderStore.orderConfirmation;
  
  // Computed for template convenience
  hasOrder = computed(() => !!this.order());

  ngOnInit(): void {
    // If no order data, redirect to home
    if (!this.order()) {
      console.warn('[OrderConfirmation] No order data found, redirecting to home');
      this.router.navigate(['/home']);
    }
  }

  /**
   * Navigate to continue shopping
   */
  continueShopping(): void {
    // Clear order confirmation from store
    this.orderStore.clearOrder();
    this.router.navigate(['/products']);
  }

  /**
   * Navigate to view all orders
   */
  viewOrders(): void {
    this.orderStore.clearOrder();
    this.router.navigate(['/profile']);
  }
}
```

### Step 9-11: Templates, Styles, and Routes

The template, styles, and routes remain the same as in the original plan (Steps 7, 8, 9, 10).

---

## Key Improvements Over Original Plan

### 1. **Separation of Concerns**
- **OrderStore** handles order-specific state and SSE orchestration
- **CartStore** focuses on cart management only
- **OrderSseService** is a low-level connection manager

### 2. **Signals-Based State Management**
- OrderSseService exposes connection state as signals
- OrderStore uses signals for reactive checkout status
- Better integration with Angular 20's zoneless change detection

### 3. **Better Resource Management**
- Proper cleanup with `destroy()` method
- RxJS subscriptions managed with `takeUntil` pattern
- SSE subscriptions tracked and cleaned up

### 4. **Simplified Error Handling**
- Connection errors flow through RxJS observables
- Retry logic centralized in OrderStore
- No callback hell

### 5. **Component Lifecycle Safety**
- `ngOnDestroy` properly cleans up SSE connections
- Prevents memory leaks when navigating away
- Handles component destruction gracefully

### 6. **Retry Capability**
- `retryCheckout()` method for user-initiated retries
- Proper state reset between attempts

### 7. **Type Safety**
- Strongly typed throughout
- No generic `Error` types
- Explicit state transitions

---

## Error Handling Strategy

### SSE Connection Errors

1. **Initial Connection Failure**
   - Error flows through `connectionError$` observable
   - OrderStore handles error and updates state
   - User sees error message, can retry

2. **Mid-stream Disconnection**
   - Automatic reconnection via `attemptReconnect()`
   - Up to 3 attempts with exponential backoff
   - State updates reflect reconnection status

3. **Timeout (30 seconds)**
   - Promise resolves with `null`
   - State set to error
   - User can retry checkout

### Component Cleanup

```typescript
ngOnDestroy(): void {
  // Clean up subscriptions
  this.destroy$.next();
  this.destroy$.complete();
  
  // Clean up order store if checkout not complete
  if (!this.orderStore.hasOrder()) {
    this.orderStore.destroy();
  }
}
```

---

## Testing Strategy

### Unit Tests - OrderSseService

```typescript
// Test cases:
// 1. Should create EventSource with correct URL
// 2. Should update connection state to 'connecting' then 'connected'
// 3. Should emit order.created event through observable
// 4. Should handle connection errors
// 5. Should attempt reconnection up to max attempts
// 6. Should clean up resources on disconnect
// 7. Should not allow multiple simultaneous connections
```

### Unit Tests - OrderStore

```typescript
// Test cases:
// 1. Should initiate checkout and connect to SSE
// 2. Should update checkout status through states
// 3. Should handle successful order creation
// 4. Should handle SSE connection failure
// 5. Should timeout after specified duration
// 6. Should clean up subscriptions on destroy
// 7. Should retry checkout properly
```

### Component Tests

```typescript
// Test cases:
// 1. Should navigate to confirmation on order success
// 2. Should show error state on checkout failure
// 3. Should clean up SSE on component destroy
// 4. Should disable complete button while submitting
```

---

## Implementation Order

1. Create `src/app/models/order.ts` with order interfaces
2. Create `src/app/services/order-sse.service.ts` with signals-based SSE
3. Create `src/app/store/order/order.store.ts` for order state
4. Create `src/app/store/order/index.ts` barrel export
5. Update `src/app/store/index.ts` to export OrderStore
6. Update `src/app/store/cart/cart.store.ts` - remove checkout logic
7. Update `src/app/features/checkout/checkout.component.ts` - use OrderStore
8. Create order confirmation component files
9. Update `src/app/app.routes.ts` with new route
10. Test end-to-end

---

## Summary

This improved implementation provides:

1. **Better Architecture**: Separated OrderStore from CartStore
2. **Signals Integration**: Full signals-based reactive state
3. **Resource Safety**: Proper cleanup and lifecycle management
4. **Error Resilience**: Observable-based error handling with retries
5. **Type Safety**: Strongly typed throughout
6. **Maintainability**: Clear separation of concerns

The approach follows Angular 20 best practices and integrates seamlessly with the existing signals-based codebase.
