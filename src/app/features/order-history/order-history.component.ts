import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { CustomerOrderHistoryService } from '../../services/customer-order-history.service';
import { ProductService } from '../../services/product.service';
import { CustomerStore } from '../../store/customer/customer.store';
import { AuthService } from '../../auth/auth.service';

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
  imports: [CommonModule, CurrencyPipe],
  template: '<div class="order-history-container">' +
      '<div class="container">' +
      '<h1>Order History</h1>' +
      '<div class="orders-content">' +
      '<h2>Your Orders</h2>' +
      '@if (loading()) {
      <div class="loading">Loading orders...</div>
      }' +
      '@if (error()) {
      <div class="error">{{error()}}</div>
      }' +
      '@if (!loading() && !error() && orders().length === 0) {
      <div class="no-orders">No orders found</div>
      }' +
      '@for (order of orders(); track order) {
      <div class="order-card">' +
        '<div class="order-header">' +
        '<div class="order-id">Order #{{order.orderNumber}}</div>' +
        '<div class="order-date">{{order.orderDate}}</div>' +
      '</div>' +
      '<div class="order-details">' +
      '<div class="order-status">{{order.status}}</div>' +
      '<div class="order-total">Total: {{order.total | currency:"USD":"symbol":"1.2-2"}}</div>' +
    '</div>' +
    '<div class="order-actions">' +
    '<button (click)="viewOrderDetails(order.id)" class="view-details-button">{{expandedOrderId() === order.id ? "Hide Details" : "View Details"}}</button>' +
    '</div>' +
    '@if (expandedOrderId() === order.id) {
    <div class="order-items">' +
      '<div class="item-header"><span>Product</span><span>Qty</span><span>Price</span></div>' +
      '@for (item of order.items; track item) {
      <div class="item">' +
        '<div class="item-name">{{item.product_name || item.name || item.product_id || "Product"}}{{item.description ? (" - " + item.description) : ""}}</div>' +
        '<div class="item-quantity">{{item.quantity}}</div>' +
        '<div class="item-price">{{(item.unit_price || item.price) | currency:"USD":"symbol":"1.2-2"}}</div>' +
      '</div>
      }' +
    '</div>
    }' +
    '</div>
    }' +
    '</div>' +
    '</div>' +
    '</div>',
  styles: ['.order-history-container { padding: 2rem 0; background-color: #eaeded; min-height: calc(100vh - 200px); } .container { max-width: 1200px; margin: 0 auto; padding: 0 1rem; } h1 { font-size: 2rem; font-weight: 400; color: #0f1111; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #ddd; } .orders-content { background: white; border-radius: 8px; padding: 2rem; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); } .order-card { border: 1px solid #ddd; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 1rem; } .order-header { display: flex; justify-content: space-between; align-items: center; } .order-id { font-size: 1.1rem; font-weight: 600; color: #0f1111; } .order-date { color: #565959; font-size: 0.9rem; } .order-details { display: flex; justify-content: space-between; align-items: center; } .order-status { font-weight: 600; } .order-total { color: #0f1111; font-weight: 600; font-size: 1.1rem; } .order-actions { text-align: center; } .order-actions button { background-color: #0f7938; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; font-weight: 600; } .order-items { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #ddd; } .item-header { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #ddd; font-weight: 600; color: #565959; font-size: 0.9rem; } .item { display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid #eee; } .item-name { flex: 3; color: #0f1111; font-weight: 600; } .item-quantity { flex: 1; text-align: center; } .item-price { flex: 1; text-align: right; } .loading { text-align: center; padding: 2rem; color: #666; } .error { text-align: center; padding: 2rem; color: #c40000; } .no-orders { text-align: center; padding: 2rem; color: #666; }']
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
    // First ensure customer is loaded
    let customer = this.customerStore.customer();
    const userEmail = this.authService.userData()?.email;
    
    console.log('Current customer:', customer);
    console.log('User email from auth:', userEmail);
    
    if (!customer && userEmail) {
      console.log('Customer not loaded, loading by email:', userEmail);
      await this.customerStore.loadCustomer(userEmail);
      customer = this.customerStore.customer();
      console.log('Customer after loading:', customer);
    }
    
    const customerId = customer?.customer_id;
    console.log('Customer ID:', customerId);
    
    if (!customerId) {
      this.error.set('Unable to load customer information. Please visit Your Account page first.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.orderService.getCustomerOrders(customerId).subscribe({
      next: (orders: any[]) => {
        console.log('Orders received:', orders);
        const displayOrders: OrderDisplay[] = orders.map(order => ({
          id: order.order_id,
          orderNumber: order.order_number,
          orderDate: order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A',
          total: order.total_price || order.total || order.net_price,
          status: order.status || 'Completed',
          items: order.items || []
        }));
        console.log('Display orders:', displayOrders);
        this.orders.set(displayOrders);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading orders:', err);
        this.error.set('Failed to load orders');
        this.loading.set(false);
      }
    });
  }

  async viewOrderDetails(orderId: string): Promise<void> {
    console.log('Viewing order details for:', orderId);
    if (this.expandedOrderId() === orderId) {
      this.expandedOrderId.set(null);
    } else {
      // Load product details for each order item
      const currentOrders = this.orders();
      const orderIndex = currentOrders.findIndex(o => o.id === orderId);
      if (orderIndex >= 0) {
        const order = currentOrders[orderIndex];
        for (const item of order.items) {
           if (item.product_id) {
             try {
               const product = await this.productService.getProductById(Number(item.product_id)).toPromise();
               if (product) {
                 item.product_name = product.name;
                 item.description = product.description;
               }
             } catch (err) {
               console.error('Error loading product:', item.product_id, err);
             }
           }
        }
        // Update the orders with product details
        const updatedOrders = [...currentOrders];
        updatedOrders[orderIndex] = { ...order, items: [...order.items] };
        this.orders.set(updatedOrders);
      }
      this.expandedOrderId.set(orderId);
    }
  }
}