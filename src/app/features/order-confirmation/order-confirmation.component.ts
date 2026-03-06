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
    this.router.navigate(['/profile/orders']);
  }
}
