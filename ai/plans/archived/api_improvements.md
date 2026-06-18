# API Improvements Implementation Plan

**Date:** 2026-03-26  
**Status:** Ready for implementation

---

## Overview

This plan details the frontend changes required to integrate the backend API improvements that eliminate N+1 HTTP requests and standardize SSE event field naming. The backend now includes image URLs directly in product list and cart responses, order history includes status timeline data, and SSE events use snake_case field names.

---

## Summary of API Changes

| API Change | Endpoint | New Field | Impact |
|------------|----------|-----------|--------|
| Product List | `GET /api/v1/products` | `main_image_url` | Eliminates 20 image fetch requests per page |
| Product Search | `GET /api/v1/products/search` | `main_image_url` | Eliminates image fetch requests during search |
| Cart | `GET /api/v1/carts/{cartId}` | `product_image_url` | Eliminates image fetch requests per cart item |
| Order History | `GET /api/v1/orders/customer/{customerId}` | `status_history` | Enables order status timeline component |
| SSE Events | `/carts/{cartId}/stream` | snake_case fields | Removes key conversion workaround |

---

## Change 1: Product List - Use `main_image_url`

### Goal

Remove sequential `GET /products/{id}/images` calls in `ProductStore.fetchImagesForProducts()`. Use the `main_image_url` field directly from the product list response.

### Files to Modify

1. **`src/app/models/product.ts`** — Add `main_image_url` to Product interface
2. **`src/app/store/product/product.store.ts`** — Remove image fetching logic
3. **`src/app/features/products/product-list/components/product-card/product-card.component.ts`** — Use `main_image_url` directly

### Step 1.1 — Update Product Model

**File:** `src/app/models/product.ts`

Add `main_image_url` field to the Product interface:

```typescript
export interface Product {
  id: number;
  name: string;
  description: string;
  // ... existing fields ...
  initial_price: number;
  final_price: number;
  currency: string;
  in_stock: boolean;
  // NEW FIELD:
  main_image_url: string;
  // ... remaining fields ...
}
```

### Step 1.2 — Update ProductStore

**File:** `src/app/store/product/product.store.ts`

Remove the `fetchImagesForProducts()` method entirely. Update all load methods to not call this method.

**Methods to update:**
- `loadProducts()` — Remove call to `fetchImagesForProducts()`
- `loadMoreProducts()` — Remove call to `fetchImagesForProducts()`
- `searchProducts()` — Remove call to `fetchImagesForProducts()`
- `filterProducts()` — Remove call to `fetchImagesForProducts()`

**After changes:**

```typescript
async loadProducts(): Promise<void> {
  this.setState({ loading: true, error: null });
  try {
    const response = await firstValueFrom(this.productService.getProducts(...));
    // NO LONGER: const productsWithImages = await this.fetchImagesForProducts(response.products);
    this.setState({
      products: response.products,
      loading: false,
      hasMore: response.products.length >= this.state().limit
    });
  } catch (error) {
    // error handling
  }
}
```

**Also remove:**
- `fetchImagesForProducts()` private method
- Any imports related to image fetching (keep `ProductImageListResponse` if still used elsewhere, otherwise remove)

### Step 1.3 — Update ProductCardComponent

**File:** `src/app/features/products/product-list/components/product-card/product-card.component.ts`

The component likely receives a `Product` object. If it currently calls `productService.getProductImages()`, remove that logic and use `product.main_image_url` directly.

**Template change (if applicable):**
```html
<!-- Before: -->
<img [src]="productImage()" />

<!-- After: -->
<img [src]="product().main_image_url || '/assets/placeholder.png'" />
```

### Step 1.4 — Handle Empty Image URLs

Products without images will have `main_image_url` as empty string (`""`). Update templates to show a placeholder image:

```html
<img [src]="product.main_image_url || '/assets/images/placeholder-product.png'" 
     alt="{{ product.name }}" />
```

### Verification

- [ ] `ng build` succeeds
- [ ] Product list page shows images from `main_image_url`
- [ ] No network requests to `/products/{id}/images` on product list page
- [ ] Empty `main_image_url` shows placeholder image

---

## Change 2: Cart Items - Use `product_image_url`

### Goal

Remove sequential image fetch calls when loading cart items. Use the `product_image_url` field from the cart response.

### Files to Modify

1. **`src/app/models/cart.ts`** — Add `product_image_url` to CartItem interface
2. **`src/app/features/cart/components/cart-item/cart-item.component.ts`** — Use `product_image_url`

### Step 2.1 — Update CartItem Model

**File:** `src/app/models/cart.ts`

Add `product_image_url` field to CartItem interface:

```typescript
export interface CartItem {
  id: number;
  cart_id: string;
  line_number: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  status: CartItemStatus;
  validation_id?: string;
  backorder_reason?: string;
  // NEW FIELD:
  product_image_url: string;
}
```

### Step 2.2 — Update CartItemComponent

**File:** `src/app/features/cart/components/cart-item/cart-item.component.ts`

The component receives `item: CartItem` via `input()`. Use `item().product_image_url` directly in the template.

**Template change:**
```html
<!-- Before: might be fetching images via service -->
<img [src]="itemImage()" />

<!-- After: -->
<img [src]="item().product_image_url || '/assets/images/placeholder-product.png'" 
     [alt]="item().product_name" />
```

### Step 2.3 — Handle Empty Image URLs

Cart items without product images will have `product_image_url` as empty string (`""`). Show placeholder:

```html
<img [src]="item.product_image_url || '/assets/images/placeholder-product.png'" />
```

### Verification

- [ ] `ng build` succeeds
- [ ] Cart page shows product images from `product_image_url`
- [ ] No network requests to `/products/{id}/images` on cart page
- [ ] Empty `product_image_url` shows placeholder image

---

## Change 3: Order History - Implement Status Timeline

### Goal

Display an order status timeline using the new `status_history` array from the order history API.

### Files to Modify

1. **`src/app/models/order.ts`** — Add `StatusHistoryEntry` interface and `status_history` to order interfaces
2. **`src/app/store/order-history/order-history.store.ts`** — Add status history to display model
3. **`src/app/features/order-history/order-history.component.ts`** — Add timeline UI
4. **`src/app/features/order-history/order-history.component.scss`** — Add timeline styles (or create new file)

### Step 3.1 — Update Order Model

**File:** `src/app/models/order.ts`

Add status history types:

```typescript
export interface StatusHistoryEntry {
  status: string;
  timestamp: string;
}

export interface OrderHistoryItem {
  order_id: string;
  order_number: string;
  created_at: string;
  // ... existing fields ...
  // NEW FIELD:
  status_history: StatusHistoryEntry[];
}
```

### Step 3.2 — Update OrderHistoryStore

**File:** `src/app/store/order-history/order-history.store.ts`

Update `OrderDisplay` interface to include status history:

```typescript
export interface OrderDisplay {
  id: string;
  orderNumber: string;
  orderDate: string;
  total: number;
  status: string;
  items: OrderLineItem[];
  // NEW FIELD:
  statusHistory: StatusHistoryEntry[];
}
```

Update `loadCustomerOrders()` to map `status_history`:

```typescript
const orders: OrderDisplay[] = rawOrders.map(order => ({
  id: order.order_id,
  orderNumber: order.order_number,
  orderDate: order.created_at
    ? new Date(order.created_at).toLocaleDateString()
    : 'N/A',
  total: order.total_price ?? order.total ?? order.net_price ?? 0,
  status: order.status ?? 'Completed',
  items: order.items ?? [],
  // NEW: Map status_history
  statusHistory: order.status_history ?? [],
}));
```

### Step 3.3 — Create OrderTimelineComponent

**File:** `src/app/features/order-history/components/order-timeline/order-timeline.component.ts` (new file)

Create a reusable timeline component:

```typescript
import { input } from '@angular/core';
import { StatusHistoryEntry } from '../../../../models/order';

export class OrderTimelineComponent {
  readonly entries = input.required<StatusHistoryEntry[]>();
  readonly currentStatus = input.required<string>();
}
```

**Template:** `src/app/features/order-history/components/order-timeline/order-timeline.component.html`

```html
<div class="timeline">
  @for (entry of entries(); track entry.timestamp) {
    <div class="timeline-entry" [class.current]="entry.status === currentStatus()">
      <div class="timeline-marker"></div>
      <div class="timeline-content">
        <span class="status">{{ entry.status | titlecase }}</span>
        <span class="timestamp">{{ formatDate(entry.timestamp) }}</span>
      </div>
    </div>
  }
</div>
```

**Styles:** `src/app/features/order-history/components/order-timeline/order-timeline.component.scss`

```scss
.timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
  
  &-entry {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding-bottom: 16px;
    position: relative;
    
    &:not(:last-child)::before {
      content: '';
      position: absolute;
      left: 7px;
      top: 16px;
      bottom: 0;
      width: 2px;
      background: #ddd;
    }
    
    &.current .timeline-marker {
      background: #ff9900;
      border-color: #ff9900;
    }
  }
  
  &-marker {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid #666;
    background: #fff;
    flex-shrink: 0;
  }
  
  &-content {
    display: flex;
    flex-direction: column;
    
    .status {
      font-weight: 600;
      color: #131921;
    }
    
    .timestamp {
      font-size: 12px;
      color: #666;
    }
  }
}
```

### Step 3.4 — Integrate Timeline in OrderHistoryComponent

**File:** `src/app/features/order-history/order-history.component.ts`

Import and add `OrderTimelineComponent`:

```typescript
import { OrderTimelineComponent } from './components/order-timeline/order-timeline.component';

@Component({
  // ...
  imports: [OrderTimelineComponent, /* other imports */],
  // ...
})
export class OrderHistoryComponent {
  // existing code...
}
```

**Template update:** Add timeline in expanded order details:

```html
@if (isExpanded(order.id)) {
  <div class="order-details">
    <!-- existing order items -->
    
    <!-- NEW: Status Timeline -->
    @if (order.statusHistory.length > 0) {
      <div class="order-timeline">
        <h4>Order Timeline</h4>
        <app-order-timeline 
          [entries]="order.statusHistory" 
          [currentStatus]="order.status">
        </app-order-timeline>
      </div>
    }
  </div>
}
```

### Step 3.5 — Add Status Badge Component (Optional)

Create `src/app/shared/components/status-badge/status-badge.component.ts`:

```typescript
import { input } from '@angular/core';

export class StatusBadgeComponent {
  readonly status = input.required<string>();
  
  get statusClass(): string {
    const s = this.status().toLowerCase();
    return {
      'created': 'badge-info',
      'confirmed': 'badge-info',
      'processing': 'badge-warning',
      'shipped': 'badge-success',
      'delivered': 'badge-success',
      'cancelled': 'badge-error',
      'refunded': 'badge-error'
    }[s] ?? 'badge-secondary';
  }
}
```

Use in order history and cart items to show color-coded status badges.

### Verification

- [ ] `ng build` succeeds
- [ ] Order history shows timeline for each order
- [ ] Current status is highlighted in timeline
- [ ] Empty `status_history` array shows nothing (graceful handling)
- [ ] Status badges use correct colors

---

## Change 4: SSE Events - Convert from camelCase to snake_case

### Goal

The backend now sends SSE event data in snake_case (matching the REST API). Remove the `convertKeysToSnakeCase()` workaround in `OrderSseService`.

### Files to Modify

1. **`src/app/models/order.ts`** — Update `OrderCreatedEvent` interface to snake_case
2. **`src/app/models/cart.ts`** — Update `CartItemValidatedEvent` and `CartItemBackorderEvent` to snake_case
3. **`src/app/services/order-sse.service.ts`** — Remove key conversion functions and update event handlers

### Step 4.1 — Update OrderCreatedEvent Model

**File:** `src/app/models/order.ts`

```typescript
// BEFORE (camelCase):
export interface OrderCreatedEvent {
  orderId: string;
  orderNumber: string;
  cartId: string;
  total: number;
}

// AFTER (snake_case):
export interface OrderCreatedEvent {
  order_id: string;
  order_number: string;
  cart_id: string;
  total: number;
}
```

### Step 4.2 — Update CartItemValidatedEvent Model

**File:** `src/app/models/cart.ts`

The interface already uses snake_case (lines 52-60), but verify alignment:

```typescript
export interface CartItemValidatedEvent {
  line_number: string;
  product_id: string;
  status: 'confirmed';
  product_name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
}
```

### Step 4.3 — Update CartItemBackorderEvent Model

**File:** `src/app/models/cart.ts`

```typescript
// BEFORE (has backorder_reason but mixed):
export interface CartItemBackorderEvent {
  line_number: string;
  product_id: string;
  status: 'backorder';
  product_name?: string;
  unit_price?: number;
  quantity: number;
  total_price?: number;
  backorder_reason: string;
}
// Already correct - verify matches backend response
```

### Step 4.4 — Update OrderSseService

**File:** `src/app/services/order-sse.service.ts`

**Remove helper functions** (no longer needed):
- `camelToSnakeCase()` (lines 14-16)
- `convertKeysToSnakeCase()` (lines 18-25)

**Update event handler for `connected`** (line 139):
```typescript
// BEFORE:
this.connected$.next(data.cartId);

// AFTER:
this.connected$.next(data.cart_id);
```

**Update event handler for `cart.item.validated`** (lines 165-180):
```typescript
// BEFORE:
const parsed = JSON.parse(event.data);
const data: CartItemValidatedEvent = convertKeysToSnakeCase(parsed) as unknown as CartItemValidatedEvent;

// AFTER:
const data: CartItemValidatedEvent = JSON.parse(event.data);
```

**Update event handler for `cart.item.backorder`** (lines 183-198):
```typescript
// BEFORE:
const parsed = JSON.parse(event.data);
const data: CartItemBackorderEvent = convertKeysToSnakeCase(parsed) as unknown as CartItemBackorderEvent;

// AFTER:
const data: CartItemBackorderEvent = JSON.parse(event.data);
```

**Also update `order.created` handler** if it parses any nested objects (line 148):
```typescript
// Verify direct parsing works now:
const data: OrderCreatedEvent = JSON.parse(event.data);
```

### Step 4.5 — Update OrderStore Consumers

**File:** `src/app/store/order/order.store.ts`

If the store accesses camelCase fields from `OrderCreatedEvent`, update to snake_case:

```typescript
// BEFORE:
next: (event: OrderCreatedEvent) => {
  this.setConfirmation({
    orderId: event.orderId,
    orderNumber: event.orderNumber,
    cartId: event.cartId,
    total: event.total,
    createdAt: new Date()
  });
}

// AFTER:
next: (event: OrderCreatedEvent) => {
  this.setConfirmation({
    orderId: event.order_id,
    orderNumber: event.order_number,
    cartId: event.cart_id,
    total: event.total,
    createdAt: new Date()
  });
}
```

### Step 4.6 — Update CartStore Consumers

**File:** `src/app/store/cart/cart.store.ts`

Check `handleItemValidated()` and `handleItemBackorder()` methods - likely already using snake_case from the interface definitions, but verify:

```typescript
// These should work if CartItemValidatedEvent is snake_case:
// event.line_number
// event.product_id
// event.total_price
```

### Verification

- [ ] `ng build` succeeds
- [ ] SSE events are received and processed correctly
- [ ] No runtime errors from field name mismatches
- [ ] Order confirmation shows correct data from `order.created` event
- [ ] Cart item validation updates work correctly

---

## Implementation Order

1. **Model updates first** — Update TypeScript interfaces before any store/component changes
2. **Store updates second** — Update state management to use new fields
3. **Component updates third** — Update UI to display new data
4. **Test last** — Verify no API calls to image endpoints

---

## Rollback Plan

If issues arise:

1. **Product images not showing:** Revert `product.store.ts` to call `fetchImagesForProducts()` temporarily
2. **Cart images not showing:** Verify backend response includes `product_image_url`
3. **Timeline not showing:** Check API response for `status_history` field

---

## Post-Implementation Tasks

- [ ] Remove unused `getProductImages` import from components that no longer need it
- [ ] Verify no orphaned image-fetching code remains
- [ ] Test on both dev and production environments
- [ ] Update `AGENTS.md` to document the new API response structure

---

## Dependencies

- Product model update depends on nothing
- Cart model update depends on nothing
- Order model update depends on nothing

All model changes are independent and can be done in parallel before store/component work begins.