import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { BreadcrumbItem } from '../../models/product';
import { OrderHistoryStore } from '../../store/order-history/order-history.store';
import { CustomerStore } from '../../store/customer/customer.store';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-order-history',
  imports: [CurrencyPipe, BreadcrumbComponent],
  templateUrl: './order-history.component.html',
  styleUrl: './order-history.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderHistoryComponent implements OnInit {
  private readonly orderHistoryStore = inject(OrderHistoryStore);
  private readonly customerStore = inject(CustomerStore);
  private readonly authService = inject(AuthService);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', url: '/home' },
    { label: 'Account', url: '/profile' },
    { label: 'Order History', url: '/profile/orders' },
  ];

  // Expose store selectors directly to the template
  readonly orders = this.orderHistoryStore.orders;
  readonly loading = this.orderHistoryStore.loading;
  readonly error = this.orderHistoryStore.error;
  readonly expandedOrderId = this.orderHistoryStore.expandedOrderId;

  ngOnInit(): void {
    this.loadOrders();
  }

  private async loadOrders(): Promise<void> {
    let customer = this.customerStore.customer();
    const userEmail = this.authService.userData()?.email;

    if (!customer && userEmail) {
      await this.customerStore.loadCustomer(userEmail as string);
      customer = this.customerStore.customer();
    }

    const customerId = customer?.customer_id;
    if (!customerId) {
      this.orderHistoryStore.setError(
        'Unable to load customer information. Please visit Your Account page first.'
      );
      return;
    }

    await this.orderHistoryStore.loadCustomerOrders(customerId);
  }

  viewOrderDetails(orderId: string): void {
    this.orderHistoryStore.toggleOrderDetails(orderId);
  }
}
