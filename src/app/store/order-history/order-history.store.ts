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
  readonly hasOrders = computed(() => {
    const orders = this.state().orders;
    return orders !== null && orders.length > 0;
  });

  // Actions
  async loadCustomerOrders(customerId: string): Promise<void> {
    if (!customerId) return;
    
    this.setState({ loading: true, error: null });

    try {
      const orders = await this.customerOrderHistoryService.getCustomerOrders(customerId).toPromise();
      this.setState({ 
        orders: orders ?? [], 
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