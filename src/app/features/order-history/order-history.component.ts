import { Component, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { CustomerOrderHistoryService } from '../../services/customer-order-history.service';
import { ProductService } from '../../services/product.service';
import { CustomerStore } from '../../store/customer/customer.store';
import { AuthService } from '../../auth/auth.service';
import { firstValueFrom } from 'rxjs';

interface OrderDisplay {
  id: string;
  orderNumber: string;
  orderDate: string;
  total: number;
  status: string;
  items: any[];
}

@Component({
  selector: 'app-order-history',
  imports: [CurrencyPipe],
  templateUrl: './order-history.component.html',
  styleUrl: './order-history.component.scss',
})
export class OrderHistoryComponent implements OnInit {
  private readonly orderService = inject(CustomerOrderHistoryService);
  private readonly productService = inject(ProductService);
  private readonly customerStore = inject(CustomerStore);
  private readonly authService = inject(AuthService);

  orders = signal<OrderDisplay[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  expandedOrderId = signal<string | null>(null);

  ngOnInit(): void {
    this.loadOrders();
  }

  async loadOrders(): Promise<void> {
    let customer = this.customerStore.customer();
    const userEmail = this.authService.userData()?.email;

    if (!customer && userEmail) {
      await this.customerStore.loadCustomer(userEmail);
      customer = this.customerStore.customer();
    }

    const customerId = customer?.customer_id;

    if (!customerId) {
      this.error.set('Unable to load customer information. Please visit Your Account page first.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.orderService.getCustomerOrders(customerId).subscribe({
      next: (orders: any[]) => {
        const displayOrders: OrderDisplay[] = orders.map(order => ({
          id: order.order_id,
          orderNumber: order.order_number,
          orderDate: order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A',
          total: order.total_price || order.total || order.net_price,
          status: order.status || 'Completed',
          items: order.items || [],
        }));
        this.orders.set(displayOrders);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load orders');
        this.loading.set(false);
      },
    });
  }

  async viewOrderDetails(orderId: string): Promise<void> {
    if (this.expandedOrderId() === orderId) {
      this.expandedOrderId.set(null);
      return;
    }

    const currentOrders = this.orders();
    const orderIndex = currentOrders.findIndex(o => o.id === orderId);
    if (orderIndex >= 0) {
      const order = currentOrders[orderIndex];
      await Promise.all(
        order.items
          .filter(item => item.product_id)
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
              // Non-fatal — display without product name
            }
          })
      );
      const updatedOrders = [...currentOrders];
      updatedOrders[orderIndex] = { ...order, items: [...order.items] };
      this.orders.set(updatedOrders);
    }
    this.expandedOrderId.set(orderId);
  }
}
