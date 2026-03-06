# Order History Feature Implementation Plan

## Overview
This plan outlines the implementation of an order history feature for the go-shopping-poc-ui application. The feature will allow authenticated users to view their order history, following existing architectural patterns and conventions.

## Architecture Context
The application follows a modern Angular architecture using:
- Standalone components with Signals for state management
- Store pattern for managing application state (Customer, Order, Cart)
- Service-oriented architecture with dependency injection
- Reactive programming patterns with RxJS
- Clear separation of concerns with features, services, models, and stores

## Implementation Approach

### 1. Service Layer Implementation

#### File: `src/app/services/customer-order-history.service.ts`
```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { OrderConfirmation } from '../models/order';
import { environment } from '../../environments/environment';
import { ErrorHandlerService } from '../core/error/error-handler.service';
import { NotificationService } from '../core/notification/notification.service';

@Injectable({
  providedIn: 'root'
})
export class CustomerOrderHistoryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl + "/orders/customer";
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly notificationService = inject(NotificationService);

  getCustomerOrders(customerId: string): Observable<OrderConfirmation[]> {
    return this.http.get<OrderConfirmation[]>(`${this.apiUrl}/${customerId}`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'getCustomerOrders');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }
}
```

### 2. Store Layer Implementation

#### File: `src/app/store/order-history/order-history.store.ts`
```typescript
import { Injectable, signal, computed, inject } from '@angular/core';
import { CustomerOrderHistoryService } from '../../services/customer-order-history.service';
import { OrderConfirmation } from '../../models/order';
import { NotificationService } from '../../core/notification/notification.service';

export interface OrderHistoryState {
  orders: OrderConfirmation[] | null;
  loading: boolean;
  error: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class OrderHistoryStore {
  private readonly customerOrderHistoryService = inject(CustomerOrderHistoryService);
  private readonly notificationService = inject(NotificationService);

  // Private state
  private readonly state = signal<OrderHistoryState>({
    orders: null,
    loading: false,
    error: null
  });

  // Public selectors
  readonly orders = computed(() => this.state().orders);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly hasOrders = computed(() => !!this.state().orders && this.state().orders.length > 0);

  // Actions
  async loadCustomerOrders(customerId: string): Promise<void> {
    if (!customerId) return;
    
    this.setState({ loading: true, error: null });

    try {
      const orders = await this.customerOrderHistoryService.getCustomerOrders(customerId).toPromise();
      this.setState({ 
        orders: orders || [], 
        loading: false 
      });
    } catch (error) {
      this.setState({ 
        loading: false, 
        error: 'Failed to load order history' 
      });
    }
  }

  clearError(): void {
    this.setState({ error: null });
  }

  // Private helper methods
  private setState(partialState: Partial<OrderHistoryState>): void {
    this.state.update(currentState => ({ ...currentState, ...partialState }));
  }
}
```

### 3. Component Layer Implementation

#### File: `src/app/features/order-history/order-history.component.ts`
```typescript
import { Component, inject, OnInit, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { OrderHistoryStore } from '../../store/order-history/order-history.store';
import { OrderConfirmation } from '../../models/order';
import { CustomerStore } from '../../store/customer/customer.store';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [CommonModule, RouterModule, SkeletonLoaderComponent],
  templateUrl: './order-history.component.html',
  styleUrls: ['./order-history.component.scss']
})
export class OrderHistoryComponent implements OnInit {
  private readonly orderHistoryStore = inject(OrderHistoryStore);
  private readonly customerStore = inject(CustomerStore);

  orders: Signal<OrderConfirmation[] | null> = this.orderHistoryStore.orders;
  loading = this.orderHistoryStore.loading;
  error = this.orderHistoryStore.error;
  hasOrders = this.orderHistoryStore.hasOrders;

  ngOnInit(): void {
    // Load orders for the authenticated customer
    const customerId = this.customerStore.customer()?.customer_id;
    if (customerId) {
      this.orderHistoryStore.loadCustomerOrders(customerId);
    }
  }

  clearError(): void {
    this.orderHistoryStore.clearError();
  }
}
```

#### File: `src/app/features/order-history/order-history.component.html`
```html
<div class="order-history-container">
  <h2>Order History</h2>

  <div class="orders-header">
    <p *ngIf="!hasOrders() && !loading()" class="no-orders-message">
      You don't have any orders yet.
    </p>
    
    <div *ngIf="loading()" class="orders-loading">
      <app-skeleton-loader [rows]="5"></app-skeleton-loader>
    </div>
    
    <div *ngIf="error()" class="error-message">
      <p>{{ error() }}</p>
      <button (click)="clearError()" class="retry-btn">Retry</button>
    </div>
  </div>

  <div *ngIf="hasOrders() && !loading()" class="orders-list">
    <div class="order-item" *ngFor="let order of orders(); trackBy: trackByOrderId">
      <div class="order-header">
        <div class="order-number">
          <strong>Order #{{ order.orderNumber }}</strong>
        </div>
        <div class="order-date">
          {{ order.createdAt | date:'medium' }}
        </div>
        <div class="order-total">
          ${{ order.total | number:'1.2-2' }}
        </div>
      </div>
      
      <div class="order-details">
        <div class="order-status">
          <span class="status-complete">Completed</span>
        </div>
        <div class="order-actions">
          <button 
            [routerLink]="['/order', order.orderId]" 
            class="view-details-btn">
            View Details
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
```

#### File: `src/app/features/order-history/order-history.component.scss`
```scss
.order-history-container {
  padding: 1rem;
  max-width: 800px;
  margin: 0 auto;
  
  h2 {
    margin-bottom: 1.5rem;
    color: #333;
  }
  
  .no-orders-message {
    text-align: center;
    padding: 2rem;
    color: #666;
    font-style: italic;
  }
  
  .orders-header {
    margin-bottom: 1.5rem;
  }
  
  .orders-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .order-item {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 1rem;
    background-color: #fff;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    
    .order-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      flex-wrap: wrap;
      gap: 1rem;
    }
    
    .order-number {
      font-weight: bold;
      color: #333;
    }
    
    .order-date {
      color: #666;
    }
    
    .order-total {
      font-weight: bold;
      color: #2c5aa0;
    }
    
    .order-details {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }
    
    .order-status {
      display: flex;
      align-items: center;
      
      .status-complete {
        background-color: #d4edda;
        color: #155724;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.875rem;
      }
    }
    
    .order-actions {
      .view-details-btn {
        background-color: #2c5aa0;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.875rem;
        
        &:hover {
          background-color: #1e437a;
        }
      }
    }
  }
  
  .error-message {
    padding: 1rem;
    background-color: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
    border-radius: 4px;
    margin: 1rem 0;
    
    .retry-btn {
      margin-top: 0.5rem;
      background-color: #dc3545;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
    }
  }
  
  .orders-loading {
    padding: 2rem;
  }
}
```

### 4. Routing Integration

#### File: `src/app/features/order-history/order-history.routes.ts`
```typescript
import { Routes } from '@angular/router';
import { OrderHistoryComponent } from './order-history.component';
import { AuthGuard } from '../../core/auth/auth.guard';

export const ORDER_HISTORY_ROUTES: Routes = [
  {
    path: 'profile/orders',
    component: OrderHistoryComponent,
    canActivate: [AuthGuard]
  }
];
```

#### Update `src/app/app.routes.ts`
Add the route to the existing routes configuration:
```typescript
// Add to existing routes
{
  path: 'profile/orders',
  component: OrderHistoryComponent,
  canActivate: [AuthGuard]
}
```

### 5. Profile Integration

#### Update `src/app/features/profile/profile.component.ts`
Add link to order history in the profile component navigation:
```typescript
// Add to the profile component navigation
{
  title: 'Order History',
  path: '/profile/orders',
  icon: 'history'
}
```

#### Update `src/app/features/profile/profile.component.html`
Add the order history link to the profile navigation menu:
```html
<div class="profile-menu">
  <!-- existing menu items -->
  <a [routerLink]="['/profile/orders']" class="menu-item">
    <i class="history-icon"></i>
    <span>Order History</span>
  </a>
  <!-- existing menu items -->
</div>
```

### 6. Required Model Updates
The existing `OrderConfirmation` model in `src/app/models/order.ts` already includes:
```typescript
export interface OrderConfirmation {
  orderId: string;
  orderNumber: string;
  cartId: string;
  total: number;
  createdAt: Date;
}
```

## API Integration Details
The implementation uses the existing API endpoint:
- **Endpoint**: `GET /api/v1/orders/customer/{customerId}`
- **Method**: `getCustomerOrders(customerId)` in `CustomerOrderHistoryService`
- **Response Format**: Array of `OrderConfirmation` objects

## Security and Authentication
- All order history routes are protected by `AuthGuard`
- Only authenticated users can access their own order history
- Orders are linked to the authenticated customer's ID

## Testing Strategy
1. Unit tests for `CustomerOrderHistoryService`
2. Unit tests for `OrderHistoryStore` 
3. Component tests for `OrderHistoryComponent`
4. Integration tests for API connectivity
5. End-to-end tests for user flow

## Accessibility and UX
- Responsive design that works on all device sizes
- Loading states with skeleton loaders
- Clear error messaging with retry options
- Consistent styling with existing application
- Proper semantic HTML for accessibility
- Responsive table/list structure for order details