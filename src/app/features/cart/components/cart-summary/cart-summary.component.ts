import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

/**
 * Cart Summary Component
 * Displays order totals and checkout actions
 */
@Component({
  selector: 'app-cart-summary',
  standalone: true,
  imports: [CommonModule, RouterModule],
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
  @Input() hasPendingItems = false;
  @Input() hasBackorderItems = false;
  @Output() checkout = new EventEmitter<void>();
  @Output() clearCart = new EventEmitter<void>();

  /**
   * Emits checkout event
   */
  onCheckout(): void {
    this.checkout.emit();
  }

  /**
   * Emits clear cart event
   */
  onClearCart(): void {
    this.clearCart.emit();
  }
}
