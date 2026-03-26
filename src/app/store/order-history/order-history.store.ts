import { firstValueFrom } from 'rxjs';
import { Injectable, signal, computed, inject } from '@angular/core';
import { CustomerOrderHistoryService } from '../../services/customer-order-history.service';
import { ProductService } from '../../services/product.service';
import { OrderHistoryItem, OrderLineItem, StatusHistoryEntry } from '../../models/order';

export interface OrderDisplay {
  id: string;
  orderNumber: string;
  orderDate: string;
  total: number;
  status: string;
  items: OrderLineItem[];
  statusHistory: StatusHistoryEntry[];
}

export interface OrderHistoryState {
  orders: OrderDisplay[];
  loading: boolean;
  error: string | null;
  expandedOrderId: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class OrderHistoryStore {
  private readonly orderService = inject(CustomerOrderHistoryService);
  private readonly productService = inject(ProductService);

  private readonly state = signal<OrderHistoryState>({
    orders: [],
    loading: false,
    error: null,
    expandedOrderId: null,
  });

  // Public selectors
  readonly orders = computed(() => this.state().orders);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly expandedOrderId = computed(() => this.state().expandedOrderId);
  readonly hasOrders = computed(() => this.state().orders.length > 0);

  // Actions
  async loadCustomerOrders(customerId: string): Promise<void> {
    if (!customerId) return;

    this.setState({ loading: true, error: null });

    try {
      const rawOrders = await firstValueFrom(
        this.orderService.getCustomerOrders(customerId)
      );

      const orders: OrderDisplay[] = rawOrders.map(order => ({
        id: order.order_id,
        orderNumber: order.order_number,
        orderDate: order.created_at
          ? new Date(order.created_at).toLocaleDateString()
          : 'N/A',
        total: order.total_price ?? order.total ?? order.net_price ?? 0,
        status: order.status ?? 'Completed',
        items: order.items ?? [],
        statusHistory: order.status_history ?? [],
      }));

      this.setState({ orders, loading: false });
    } catch {
      this.setState({ loading: false });
    }
  }

  async toggleOrderDetails(orderId: string): Promise<void> {
    const currentExpanded = this.state().expandedOrderId;

    if (currentExpanded === orderId) {
      this.setState({ expandedOrderId: null });
      return;
    }

    // Enrich order items with product names in parallel
    const orders = this.state().orders;
    const orderIndex = orders.findIndex(o => o.id === orderId);

    if (orderIndex >= 0) {
      const order = orders[orderIndex];
      const enrichedItems = await this.enrichItemsWithProductNames(order.items);
      const updatedOrders = [...orders];
      updatedOrders[orderIndex] = { ...order, items: enrichedItems };
      this.setState({ orders: updatedOrders, expandedOrderId: orderId });
    } else {
      this.setState({ expandedOrderId: orderId });
    }
  }

  setError(error: string): void {
    this.setState({ error });
  }

  clearError(): void {
    this.setState({ error: null });
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async enrichItemsWithProductNames(
    items: OrderLineItem[]
  ): Promise<OrderLineItem[]> {
    const enriched = items.map(item => ({ ...item }));

    await Promise.all(
      enriched
        .filter(item => item.product_id && !item.product_name)
        .map(async item => {
          try {
            const product = await firstValueFrom(
              this.productService.getProductById(Number(item.product_id))
            );
            if (product) {
              item.product_name = product.name;
              item.description = product.description;
            }
          } catch {
            // Non-fatal — item renders without product name
          }
        })
    );

    return enriched;
  }

  private setState(partialState: Partial<OrderHistoryState>): void {
    this.state.update(s => ({ ...s, ...partialState }));
  }
}
