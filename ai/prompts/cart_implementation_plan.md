# Shopping Cart Implementation Plan

## Overview

This document provides a detailed implementation plan for adding shopping cart functionality to the go-shopping-poc-ui Angular application. The plan integrates with the existing Cart Service API and follows the established codebase patterns.

## Internal Evaluation Rubric

Before creating this plan, I evaluated multiple approaches against the following criteria:

### Evaluation Criteria

| Criteria | Weight | Description |
|----------|--------|-------------|
| **Architecture Consistency** | 30% | Does it follow existing patterns (signals, standalone components, service/store architecture)? |
| **API Compliance** | 25% | Does it correctly implement all Cart API endpoints and handle all edge cases? |
| **UX Integration** | 20% | Does it provide a smooth user experience integrated with existing UI patterns? |
| **Maintainability** | 15% | Is the code modular, well-organized, and easy to extend? |
| **State Management** | 10% | Does it properly handle cart persistence and synchronization? |

### Approaches Evaluated

#### Approach 1: Minimal Cart Store with Direct Service Calls
- **Description**: Simple cart state in a store, direct API calls from components
- **Score**: 65/100
- **Pros**: Simple, quick to implement
- **Cons**: Doesn't leverage existing patterns, lacks proper separation of concerns
- **Verdict**: ❌ Rejected - Doesn't follow the established ProductStore/CustomerStore patterns

#### Approach 2: Full Cart Store with Service Layer (Selected)
- **Description**: Comprehensive CartStore following ProductStore pattern, CartService for API calls, modular components
- **Score**: 95/100
- **Pros**: 
  - Consistent with existing ProductStore and CustomerStore patterns
  - Proper separation of concerns
  - Reusable components
  - Follows all established patterns
- **Cons**: More initial code to write
- **Verdict**: ✅ **SELECTED** - Best architectural fit

#### Approach 3: RxJS-Heavy with NgRx-style Store
- **Description**: Using NgRx or heavily RxJS-based state management
- **Score**: 55/100
- **Pros**: Industry standard for complex state
- **Cons**: Overkill for this app, doesn't match existing signal-based patterns
- **Verdict**: ❌ Rejected - Inconsistent with existing architecture

#### Approach 4: LocalStorage-Only Cart (No Backend)
- **Description**: Store cart entirely in localStorage, sync to backend on checkout
- **Score**: 40/100
- **Pros**: Works offline, simple
- **Cons**: Doesn't meet requirements, loses cart on device switch, no guest cart support per API
- **Verdict**: ❌ Rejected - Doesn't comply with Cart API specification

### Why Approach 2 Was Selected

1. **Perfect Pattern Match**: The ProductStore and CustomerStore already demonstrate the exact pattern needed - signals-based state, async actions, computed selectors
2. **API Compliance**: Fully implements all Cart API endpoints as documented
3. **Guest & Auth Support**: Handles both authenticated and guest users as required by API
4. **Modular Design**: Components can be reused across product list, product detail, and cart pages
5. **Error Handling**: Leverages existing ErrorHandlerService and NotificationService patterns

## Implementation Phases

### Summary of Phases

1. **Phase 1: Core Data Layer** - Models, Service, and Store
2. **Phase 2: Cart State Management** - CartStore implementation with all actions
3. **Phase 3: UI Components** - Cart icon, mini cart, and cart page components
4. **Phase 4: Product Integration** - Add to cart functionality on product pages
5. **Phase 5: Checkout Flow** - Multi-step checkout with forms
6. **Phase 6: Persistence & Polish** - localStorage persistence and final refinements

---

## Phase 1: Core Data Layer

### 1.1 Cart Models (`src/app/models/cart.ts`)

Create comprehensive TypeScript interfaces matching the Cart API specification:

```typescript
// Core Cart interfaces
export interface Cart {
  cart_id: string;
  customer_id: string | null;
  current_status: 'active' | 'checked_out' | 'completed' | 'cancelled';
  currency: string;
  net_price: number;
  tax: number;
  shipping: number;
  total_price: number;
  created_at: string;
  updated_at: string;
  version: number;
  contact: CartContact | null;
  addresses: CartAddress[];
  credit_card: CartCreditCard | null;
  items: CartItem[];
  status_history: CartStatus[];
}

export interface CartItem {
  id: number;
  cart_id: string;
  line_number: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
}

export interface CartContact {
  id: number;
  cart_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
}

export interface CartAddress {
  id: number;
  cart_id: string;
  address_type: 'shipping' | 'billing';
  first_name: string;
  last_name: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface CartCreditCard {
  id: number;
  cart_id: string;
  card_type?: string;
  card_number: string;
  card_holder_name: string;
  card_expires: string;
  card_cvv: string;
}

export interface CartStatus {
  id: number;
  cart_id: string;
  cart_status: string;
  status_date_time: string;
}

// Request DTOs
export interface CreateCartRequest {
  customer_id?: string;
}

export interface AddItemRequest {
  product_id: string;
  quantity: number;
}

export interface UpdateItemRequest {
  quantity: number;
}

export interface SetContactRequest {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
}

export interface AddAddressRequest {
  address_type: 'shipping' | 'billing';
  first_name: string;
  last_name: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface SetPaymentRequest {
  card_type?: string;
  card_number: string;
  card_holder_name: string;
  card_expires: string;
  card_cvv: string;
}

// UI State interfaces
export interface CartState {
  cart: Cart | null;
  cartId: string | null;
  loading: boolean;
  error: string | null;
  checkoutStep: 'cart' | 'contact' | 'shipping' | 'payment' | 'review' | 'confirmation';
}
```

### 1.2 Cart Service (`src/app/services/cart.service.ts`)

Create the service following the exact pattern of ProductService:

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ErrorHandlerService } from '../core/error/error-handler.service';
import { NotificationService } from '../core/notification/notification.service';
import { 
  Cart, 
  CreateCartRequest, 
  AddItemRequest, 
  UpdateItemRequest,
  SetContactRequest,
  AddAddressRequest,
  SetPaymentRequest 
} from '../models/cart';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/carts`;
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly notificationService = inject(NotificationService);

  // Cart Management
  createCart(customerId?: string): Observable<Cart> {
    const body: CreateCartRequest = customerId ? { customer_id: customerId } : {};
    return this.http.post<Cart>(this.apiUrl, body).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'createCart');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  getCart(cartId: string): Observable<Cart> {
    return this.http.get<Cart>(`${this.apiUrl}/${cartId}`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'getCart');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  deleteCart(cartId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${cartId}`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'deleteCart');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  // Cart Items
  addItem(cartId: string, productId: string, quantity: number): Observable<CartItem> {
    const body: AddItemRequest = { product_id: productId, quantity };
    return this.http.post<CartItem>(`${this.apiUrl}/${cartId}/items`, body).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'addItem');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  updateItem(cartId: string, lineNumber: string, quantity: number): Observable<void> {
    const body: UpdateItemRequest = { quantity };
    return this.http.put<void>(`${this.apiUrl}/${cartId}/items/${lineNumber}`, body).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'updateItem');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  removeItem(cartId: string, lineNumber: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${cartId}/items/${lineNumber}`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'removeItem');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  // Contact Information
  setContact(cartId: string, contact: SetContactRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${cartId}/contact`, contact).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'setContact');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  // Addresses
  addAddress(cartId: string, address: AddAddressRequest): Observable<CartAddress> {
    return this.http.post<CartAddress>(`${this.apiUrl}/${cartId}/addresses`, address).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'addAddress');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  // Payment
  setPayment(cartId: string, payment: SetPaymentRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${cartId}/payment`, payment).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'setPayment');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  // Checkout
  checkout(cartId: string): Observable<Cart> {
    return this.http.post<Cart>(`${this.apiUrl}/${cartId}/checkout`, {}).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'checkout');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }
}
```

---

## Phase 2: Cart State Management

### 2.1 Cart Store (`src/app/store/cart/cart.store.ts`)

Create the store following the exact pattern of ProductStore and CustomerStore:

```typescript
import { Injectable, signal, computed, inject, untracked } from '@angular/core';
import { CartService } from '../../services/cart.service';
import { 
  Cart, 
  CartItem, 
  CartAddress, 
  CartContact,
  CartCreditCard,
  SetContactRequest,
  AddAddressRequest,
  SetPaymentRequest 
} from '../../models/cart';
import { NotificationService } from '../../core/notification/notification.service';
import { ErrorHandlerService } from '../../core/error/error-handler.service';
import { firstValueFrom } from 'rxjs';

export interface CartStoreState {
  cart: Cart | null;
  cartId: string | null;
  loading: boolean;
  error: string | null;
  checkoutStep: 'cart' | 'contact' | 'shipping' | 'payment' | 'review' | 'confirmation';
}

@Injectable({
  providedIn: 'root'
})
export class CartStore {
  private readonly cartService = inject(CartService);
  private readonly notificationService = inject(NotificationService);
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly STORAGE_KEY = 'cart_id';

  // Private state signal
  private readonly state = signal<CartStoreState>({
    cart: null,
    cartId: null,
    loading: false,
    error: null,
    checkoutStep: 'cart'
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
  readonly canCheckout = computed(() => 
    !this.isEmpty() && 
    this.hasContact() && 
    this.hasShippingAddress() && 
    this.hasPayment()
  );

  constructor() {
    // Try to load persisted cart on initialization
    this.loadPersistedCart();
  }

  // Actions

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
    } catch (error) {
      this.handleError(error, 'Failed to load cart');
      // Clear persisted cart if it fails to load
      this.clearPersistedCart();
    } finally {
      this.setLoading(false);
    }
  }

  async addItem(productId: string, quantity: number = 1): Promise<void> {
    const cartId = this.ensureCart();
    if (!cartId) return;

    this.setLoading(true);

    try {
      await firstValueFrom(this.cartService.addItem(cartId, productId, quantity));
      // Reload cart to get updated totals and items
      await this.loadCart(cartId);
      this.notificationService.showSuccess('Item added to cart');
    } catch (error) {
      this.handleError(error, 'Failed to add item to cart');
    } finally {
      this.setLoading(false);
    }
  }

  async updateItemQuantity(lineNumber: string, quantity: number): Promise<void> {
    const cartId = this.state().cartId;
    if (!cartId) return;

    this.setLoading(true);

    try {
      await firstValueFrom(this.cartService.updateItem(cartId, lineNumber, quantity));
      await this.loadCart(cartId);
      this.notificationService.showSuccess('Cart updated');
    } catch (error) {
      this.handleError(error, 'Failed to update item quantity');
    } finally {
      this.setLoading(false);
    }
  }

  async removeItem(lineNumber: string): Promise<void> {
    const cartId = this.state().cartId;
    if (!cartId) return;

    this.setLoading(true);

    try {
      await firstValueFrom(this.cartService.removeItem(cartId, lineNumber));
      await this.loadCart(cartId);
      this.notificationService.showSuccess('Item removed from cart');
    } catch (error) {
      this.handleError(error, 'Failed to remove item from cart');
    } finally {
      this.setLoading(false);
    }
  }

  async clearCart(): Promise<void> {
    const cartId = this.state().cartId;
    if (!cartId) return;

    this.setLoading(true);

    try {
      await firstValueFrom(this.cartService.deleteCart(cartId));
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

  async setContact(contact: SetContactRequest): Promise<void> {
    const cartId = this.state().cartId;
    if (!cartId) return;

    this.setLoading(true);

    try {
      await firstValueFrom(this.cartService.setContact(cartId, contact));
      await this.loadCart(cartId);
      this.notificationService.showSuccess('Contact information saved');
    } catch (error) {
      this.handleError(error, 'Failed to save contact information');
    } finally {
      this.setLoading(false);
    }
  }

  async addAddress(address: AddAddressRequest): Promise<void> {
    const cartId = this.state().cartId;
    if (!cartId) return;

    this.setLoading(true);

    try {
      await firstValueFrom(this.cartService.addAddress(cartId, address));
      await this.loadCart(cartId);
      this.notificationService.showSuccess('Address added');
    } catch (error) {
      this.handleError(error, 'Failed to add address');
    } finally {
      this.setLoading(false);
    }
  }

  async setPayment(payment: SetPaymentRequest): Promise<void> {
    const cartId = this.state().cartId;
    if (!cartId) return;

    this.setLoading(true);

    try {
      await firstValueFrom(this.cartService.setPayment(cartId, payment));
      await this.loadCart(cartId);
      this.notificationService.showSuccess('Payment information saved');
    } catch (error) {
      this.handleError(error, 'Failed to save payment information');
    } finally {
      this.setLoading(false);
    }
  }

  async checkout(): Promise<boolean> {
    const cartId = this.state().cartId;
    if (!cartId) return false;

    // Validate cart is ready for checkout
    if (!this.canCheckout()) {
      this.notificationService.showError('Please complete all required information before checkout');
      return false;
    }

    this.setLoading(true);

    try {
      const cart = await firstValueFrom(this.cartService.checkout(cartId));
      this.state.update(s => ({
        ...s,
        cart,
        checkoutStep: 'confirmation'
      }));
      this.clearPersistedCart();
      this.notificationService.showSuccess('Order placed successfully!');
      return true;
    } catch (error) {
      this.handleError(error, 'Checkout failed');
      return false;
    } finally {
      this.setLoading(false);
    }
  }

  setCheckoutStep(step: CartStoreState['checkoutStep']): void {
    this.state.update(s => ({ ...s, checkoutStep: step }));
  }

  // Helper methods
  private ensureCart(): string | null {
    let cartId = this.state().cartId;
    
    if (!cartId) {
      // Try to get from localStorage
      cartId = localStorage.getItem(this.STORAGE_KEY);
      if (cartId) {
        this.loadCart(cartId);
      }
    }
    
    return cartId;
  }

  private persistCartId(cartId: string): void {
    localStorage.setItem(this.STORAGE_KEY, cartId);
  }

  private clearPersistedCart(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  private loadPersistedCart(): void {
    const cartId = localStorage.getItem(this.STORAGE_KEY);
    if (cartId) {
      this.loadCart(cartId);
    }
  }

  private setLoading(loading: boolean): void {
    this.state.update(s => ({ ...s, loading }));
  }

  private setError(error: string | null): void {
    this.state.update(s => ({ ...s, error }));
  }

  private handleError(error: unknown, defaultMessage: string): void {
    const errorMessage = this.errorHandler.handleError(error);
    this.setError(errorMessage.message || defaultMessage);
    this.notificationService.showError(errorMessage.message || defaultMessage);
  }
}
```

---

## Phase 3: UI Components

### 3.1 Cart Icon Component (`src/app/shared/components/cart-icon/cart-icon.component.ts`)

Update the existing header cart icon to be reactive:

```typescript
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CartStore } from '../../../store/cart/cart.store';

@Component({
  selector: 'app-cart-icon',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <a [routerLink]="['/cart']" class="cart-link">
      <span class="cart-count" *ngIf="itemCount() > 0">{{ itemCount() }}</span>
      <svg class="cart-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="9" cy="21" r="1"></circle>
        <circle cx="20" cy="21" r="1"></circle>
        <path d="m1 1 4 4h15l-1 7H6"></path>
      </svg>
      <span class="cart-text">Cart</span>
    </a>
  `,
  styleUrls: ['./cart-icon.component.scss']
})
export class CartIconComponent {
  private readonly cartStore = inject(CartStore);
  
  readonly itemCount = this.cartStore.itemCount;
}
```

### 3.2 Cart Page Component (`src/app/features/cart/cart.component.ts`)

```typescript
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CartStore } from '../../store/cart/cart.store';
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

  readonly cart = this.cartStore.cart;
  readonly items = this.cartStore.items;
  readonly isEmpty = this.cartStore.isEmpty;
  readonly loading = this.cartStore.loading;
  readonly subtotal = this.cartStore.subtotal;
  readonly tax = this.cartStore.tax;
  readonly shipping = this.cartStore.shipping;
  readonly total = this.cartStore.total;
  readonly currency = this.cartStore.currency;

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
    // Navigate to checkout
    this.cartStore.setCheckoutStep('contact');
  }
}
```

### 3.3 Cart Item Component (`src/app/features/cart/components/cart-item/cart-item.component.ts`)

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
  @Output() updateQuantity = new EventEmitter<number>();
  @Output() remove = new EventEmitter<void>();

  private productService = inject(ProductService);

  onQuantityChange(event: Event): void {
    const quantity = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(quantity)) {
      this.updateQuantity.emit(quantity);
    }
  }

  onRemove(): void {
    this.remove.emit();
  }
}
```

### 3.4 Cart Summary Component (`src/app/features/cart/components/cart-summary/cart-summary.component.ts`)

```typescript
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cart-summary',
  standalone: true,
  imports: [CommonModule],
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

---

## Phase 4: Product Integration

### 4.1 Update Product Detail Component

Modify `src/app/features/products/product-detail/product-detail.component.ts`:

```typescript
// Add CartStore injection
import { CartStore } from '../../../store/cart/cart.store';

// In the component class:
export class ProductDetailComponent implements OnInit, OnDestroy {
  // ... existing injections
  private cartStore = inject(CartStore);
  
  // Add quantity selector signal
  quantity = signal(1);
  addingToCart = signal(false);

  // ... rest of component

  onAddToCart(): void {
    const product = this.product();
    if (!product || !product.in_stock) return;

    this.addingToCart.set(true);
    
    // Convert product.id to string for the API
    this.cartStore.addItem(product.id.toString(), this.quantity())
      .finally(() => {
        this.addingToCart.set(false);
        this.quantity.set(1); // Reset quantity
      });
  }

  onQuantityChange(delta: number): void {
    const current = this.quantity();
    const newQuantity = current + delta;
    if (newQuantity >= 1 && newQuantity <= 10) {
      this.quantity.set(newQuantity);
    }
  }
}
```

### 4.2 Update Product Detail Template

Add quantity selector and enhance Add to Cart button:

```html
<!-- In the actions section -->
<div class="actions">
  <div class="quantity-selector">
    <label>Quantity:</label>
    <div class="quantity-controls">
      <button 
        class="btn-quantity" 
        (click)="onQuantityChange(-1)"
        [disabled]="quantity() <= 1">
        -
      </button>
      <span class="quantity-value">{{ quantity() }}</span>
      <button 
        class="btn-quantity" 
        (click)="onQuantityChange(1)"
        [disabled]="quantity() >= 10">
        +
      </button>
    </div>
  </div>
  
  <button 
    class="btn-add-cart"
    [disabled]="!product()!.in_stock || addingToCart()"
    (click)="onAddToCart()">
    <span *ngIf="!addingToCart()">
      {{ product()!.in_stock ? 'Add to Cart' : 'Out of Stock' }}
    </span>
    <span *ngIf="addingToCart()">Adding...</span>
  </button>
</div>
```

### 4.3 Update Product Card Component

Modify `src/app/features/products/product-list/components/product-card/product-card.component.ts`:

```typescript
// Add output for add to cart
@Output() addToCart = new EventEmitter<void>();

onAddToCart(event: Event): void {
  event.stopPropagation();
  this.addToCart.emit();
}
```

Update product card template to include quick add button:

```html
<!-- Add to cart button on product card -->
<button 
  class="btn-quick-add"
  *ngIf="product.in_stock"
  (click)="onAddToCart($event)">
  Add to Cart
</button>
```

---

## Phase 5: Checkout Flow

### 5.1 Checkout Page Component (`src/app/features/checkout/checkout.component.ts`)

```typescript
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { CartStore } from '../../store/cart/cart.store';
import { AuthService } from '../../auth/auth.service';
import { CustomerStore } from '../../store/customer/customer.store';
import { AddressFormService, CreditCardFormService } from '../../shared';
import { ContactFormComponent } from './components/contact-form/contact-form.component';
import { AddressFormComponent } from './components/address-form/address-form.component';
import { PaymentFormComponent } from './components/payment-form/payment-form.component';
import { OrderReviewComponent } from './components/order-review/order-review.component';
import { OrderConfirmationComponent } from './components/order-confirmation/order-confirmation.component';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    ContactFormComponent,
    AddressFormComponent,
    PaymentFormComponent,
    OrderReviewComponent,
    OrderConfirmationComponent
  ],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss']
})
export class CheckoutComponent {
  private readonly cartStore = inject(CartStore);
  private readonly authService = inject(AuthService);
  private readonly customerStore = inject(CustomerStore);
  private readonly addressFormService = inject(AddressFormService);
  private readonly creditCardFormService = inject(CreditCardFormService);
  private readonly router = inject(Router);

  // Form groups as signals
  contactForm = signal<FormGroup | null>(null);
  shippingAddressForm = signal<FormGroup | null>(null);
  billingAddressForm = signal<FormGroup | null>(null);
  paymentForm = signal<FormGroup | null>(null);
  useSameAddress = signal(true);

  // Cart store selectors
  readonly cart = this.cartStore.cart;
  readonly checkoutStep = this.cartStore.checkoutStep;
  readonly items = this.cartStore.items;
  readonly subtotal = this.cartStore.subtotal;
  readonly tax = this.cartStore.tax;
  readonly total = this.cartStore.total;
  readonly hasContact = this.cartStore.hasContact;
  readonly hasShippingAddress = this.cartStore.hasShippingAddress;
  readonly hasPayment = this.cartStore.hasPayment;
  readonly canCheckout = this.cartStore.canCheckout;
  readonly loading = this.cartStore.loading;

  // User data for pre-filling
  readonly userData = this.authService.userData;
  readonly customer = this.customerStore.customer;

  constructor() {
    // Initialize forms
    this.contactForm.set(this.createContactForm());
    this.shippingAddressForm.set(this.addressFormService.createAddressForm());
    this.billingAddressForm.set(this.addressFormService.createAddressForm());
    this.paymentForm.set(this.creditCardFormService.createCreditCardForm());

    // Pre-fill with customer data if available
    this.prefillForms();
  }

  private createContactForm(): FormGroup {
    // Use customer form service as base, but simplified for cart contact
    const customer = this.customer();
    return this.fb.group({
      email: [customer?.email || this.userData()?.email || '', [Validators.required, Validators.email]],
      first_name: [customer?.first_name || this.userData()?.given_name || '', Validators.required],
      last_name: [customer?.last_name || this.userData()?.family_name || '', Validators.required],
      phone: [customer?.phone || '', Validators.required]
    });
  }

  private prefillForms(): void {
    const customer = this.customer();
    if (customer) {
      // Pre-fill with default addresses if available
      // Implementation details...
    }
  }

  // Navigation methods
  goToStep(step: typeof this.checkoutStep): void {
    this.cartStore.setCheckoutStep(step);
  }

  async saveContact(): Promise<void> {
    const form = this.contactForm();
    if (!form || form.invalid) {
      form?.markAllAsTouched();
      return;
    }

    await this.cartStore.setContact(form.value);
    this.goToStep('shipping');
  }

  async saveShippingAddress(): Promise<void> {
    const form = this.shippingAddressForm();
    if (!form || form.invalid) {
      form?.markAllAsTouched();
      return;
    }

    const address = this.addressFormService.getAddressFormData(form);
    await this.cartStore.addAddress({ ...address, address_type: 'shipping' });

    if (this.useSameAddress()) {
      // Also add as billing
      await this.cartStore.addAddress({ ...address, address_type: 'billing' });
      this.goToStep('payment');
    } else {
      this.goToStep('billing');
    }
  }

  async saveBillingAddress(): Promise<void> {
    const form = this.billingAddressForm();
    if (!form || form.invalid) {
      form?.markAllAsTouched();
      return;
    }

    const address = this.addressFormService.getAddressFormData(form);
    await this.cartStore.addAddress({ ...address, address_type: 'billing' });
    this.goToStep('payment');
  }

  async savePayment(): Promise<void> {
    const form = this.paymentForm();
    if (!form || form.invalid) {
      form?.markAllAsTouched();
      return;
    }

    const payment = this.creditCardFormService.getCreditCardFormData(form);
    await this.cartStore.setPayment(payment);
    this.goToStep('review');
  }

  async placeOrder(): Promise<void> {
    const success = await this.cartStore.checkout();
    if (success) {
      this.goToStep('confirmation');
    }
  }

  goToCart(): void {
    this.router.navigate(['/cart']);
  }
}
```

### 5.2 Checkout Routes

Add checkout routes to `src/app/app.routes.ts`:

```typescript
{
  path: 'cart',
  loadComponent: () => import('./features/cart/cart.component').then(m => m.CartComponent),
  title: 'Shopping Cart - GoShopping'
},
{
  path: 'checkout',
  loadComponent: () => import('./features/checkout/checkout.component').then(m => m.CheckoutComponent),
  title: 'Checkout - GoShopping'
}
```

---

## Phase 6: Persistence & Polish

### 6.1 Cart Persistence Service

Create `src/app/core/persistence/cart-persistence.service.ts`:

```typescript
import { Injectable, inject } from '@angular/core';
import { CartStore } from '../../store/cart/cart.store';

@Injectable({
  providedIn: 'root'
})
export class CartPersistenceService {
  private readonly cartStore = inject(CartStore);
  private readonly STORAGE_KEY = 'cart_id';
  private readonly CUSTOMER_CART_KEY = 'customer_cart_id';

  initialize(): void {
    // Load persisted cart on app initialization
    const cartId = this.getStoredCartId();
    if (cartId) {
      this.cartStore.loadCart(cartId);
    }
  }

  getStoredCartId(): string | null {
    return localStorage.getItem(this.STORAGE_KEY);
  }

  storeCartId(cartId: string): void {
    localStorage.setItem(this.STORAGE_KEY, cartId);
  }

  clearStoredCart(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
```

### 6.2 Update Header Component

Integrate cart icon into existing header:

```typescript
// In header.ts
import { CartIconComponent } from '../../shared/components/cart-icon/cart-icon.component';

@Component({
  // ...
  imports: [
    CommonModule, 
    FormsModule,
    CartIconComponent  // Add this
  ],
  // ...
})
```

Update header.html to use the cart icon component:

```html
<!-- Replace the cart div with: -->
<app-cart-icon></app-cart-icon>
```

### 6.3 Cart Guard

Create `src/app/features/cart/cart.guard.ts`:

```typescript
import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { CartStore } from '../../store/cart/cart.store';

@Injectable({
  providedIn: 'root'
})
export class CartGuard implements CanActivate {
  private readonly cartStore = inject(CartStore);
  private readonly router = inject(Router);

  canActivate(): boolean {
    if (this.cartStore.isEmpty()) {
      this.router.navigate(['/cart']);
      return false;
    }
    return true;
  }
}
```

Apply guard to checkout route:

```typescript
{
  path: 'checkout',
  loadComponent: () => import('./features/checkout/checkout.component').then(m => m.CheckoutComponent),
  canActivate: [CartGuard],
  title: 'Checkout - GoShopping'
}
```

### 6.4 Add to Cart Notification

Create a toast/notification when items are added to cart. Leverage the existing NotificationService.

---

## Component Files Summary

### New Files to Create:

1. **Models** (1 file)
   - `src/app/models/cart.ts` - All cart-related interfaces

2. **Services** (1 file)
   - `src/app/services/cart.service.ts` - Cart API service

3. **Store** (1 file)
   - `src/app/store/cart/cart.store.ts` - Cart state management

4. **Shared Components** (1 file)
   - `src/app/shared/components/cart-icon/cart-icon.component.ts` - Cart icon with badge

5. **Cart Feature** (5 files)
   - `src/app/features/cart/cart.component.ts` - Main cart page
   - `src/app/features/cart/components/cart-item/cart-item.component.ts` - Individual cart item
   - `src/app/features/cart/components/cart-summary/cart-summary.component.ts` - Order summary
   - `src/app/features/cart/components/empty-cart/empty-cart.component.ts` - Empty state
   - `src/app/features/cart/cart.routes.ts` - Cart routes

6. **Checkout Feature** (7 files)
   - `src/app/features/checkout/checkout.component.ts` - Main checkout page
   - `src/app/features/checkout/components/contact-form/contact-form.component.ts` - Contact info step
   - `src/app/features/checkout/components/address-form/address-form.component.ts` - Address step
   - `src/app/features/checkout/components/payment-form/payment-form.component.ts` - Payment step
   - `src/app/features/checkout/components/order-review/order-review.component.ts` - Review step
   - `src/app/features/checkout/components/order-confirmation/order-confirmation.component.ts` - Confirmation step
   - `src/app/features/checkout/checkout.guard.ts` - Checkout guard

7. **Persistence** (1 file)
   - `src/app/core/persistence/cart-persistence.service.ts` - Cart persistence logic

### Files to Modify:

1. `src/app/app.routes.ts` - Add cart and checkout routes
2. `src/app/layout/header/header.ts` - Integrate cart icon
3. `src/app/layout/header/header.html` - Use cart icon component
4. `src/app/features/products/product-detail/product-detail.component.ts` - Add to cart functionality
5. `src/app/features/products/product-detail/product-detail.component.html` - Add quantity selector
6. `src/app/features/products/product-list/components/product-card/product-card.component.ts` - Quick add to cart

---

## Key Integration Points

### 1. Authentication Integration
- Guest carts work without authentication
- Authenticated users: cart can be created with customer_id
- On login: Consider merging guest cart with existing customer cart (optional enhancement)

### 2. Product Integration
- Product detail page: Add quantity selector + Add to Cart button
- Product cards: Quick add button
- Stock check: API validates stock on add (API handles this)

### 3. Profile Integration
- Checkout can pre-fill from CustomerStore addresses/credit cards
- Contact info can use AuthService user data

### 4. Error Handling
- Uses existing ErrorHandlerService pattern
- Uses existing NotificationService for user feedback

### 5. Styling
- Follow existing Amazon-inspired color scheme (#131921/#ff9900)
- Use existing SCSS patterns and breakpoints
- Match existing component spacing and typography

---

## Testing Considerations

1. **Unit Tests**: Test CartStore actions and CartService methods
2. **Integration Tests**: Test checkout flow end-to-end
3. **Edge Cases**: 
   - Cart expiration handling
   - Concurrent cart modifications
   - Network failures during checkout
   - Invalid product IDs
   - Out-of-stock scenarios

---

## Performance Considerations

1. **Lazy Loading**: Cart and checkout features should be lazy-loaded
2. **Signal Efficiency**: Use computed signals for derived state
3. **Image Optimization**: Reuse existing ProductService image helpers
4. **API Caching**: Consider caching cart data in store

---

## Security Considerations

1. **Credit Card Data**: API stores card data (as per API spec). In production, would use tokenization.
2. **Cart ID Exposure**: Cart ID in localStorage is acceptable for this use case
3. **CSRF Protection**: Angular's HttpClient handles this automatically

---

## Future Enhancements (Out of Scope)

1. Cart abandonment recovery
2. Save for later functionality
3. Coupon/promo code support
4. Real-time stock updates
5. Cart sharing
6. Wishlist integration
7. Order history viewing
8. Guest checkout email confirmation

---

## Implementation Order Summary

**Phase 1: Core Data Layer**
1. Create cart models
2. Create cart service
3. Create cart store

**Phase 2: UI Components**
4. Create cart icon component
5. Create cart page and sub-components
6. Create checkout components

**Phase 3: Integration**
7. Update product detail page
8. Update product card
9. Update header
10. Add routes

**Phase 4: Polish**
11. Add cart persistence
12. Add guards
13. Style components
14. Test and refine

---

## Success Criteria

- [ ] Cart persists across page refreshes using localStorage
- [ ] Users can add items from product detail and product list pages
- [ ] Users can update quantities and remove items in cart
- [ ] Complete checkout flow works: Contact → Shipping → Payment → Review → Confirmation
- [ ] Cart totals calculate correctly (subtotal, tax, shipping, total)
- [ ] Error messages display using existing notification system
- [ ] UI matches existing design system (colors, spacing, typography)
- [ ] Works for both guest and authenticated users
- [ ] Cart icon in header shows item count badge
- [ ] All Cart API endpoints are properly utilized

---

## Conclusion

This implementation plan follows the existing architecture patterns (signals, standalone components, service/store separation) and integrates seamlessly with the Cart Service API. The phased approach allows for incremental development and testing, with each phase building upon the previous one.

The selected approach (Approach 2) was chosen because it:
1. Maintains architectural consistency with existing stores
2. Properly separates concerns between services, stores, and components
3. Supports all API features including guest/authenticated user flows
4. Provides a foundation for future enhancements
5. Follows Angular 20 best practices with signals-based reactivity
