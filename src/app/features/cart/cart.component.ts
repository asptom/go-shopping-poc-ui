import { Component, inject, Signal, computed } from '@angular/core';

import { RouterModule, Router } from '@angular/router';
import { CartStore } from '../../store';
import { Cart, CartItem } from '../../models/cart';
import { CartItemComponent } from './components/cart-item/cart-item.component';
import { CartSummaryComponent } from './components/cart-summary/cart-summary.component';
import { EmptyCartComponent } from './components/empty-cart/empty-cart.component';

/**
 * Cart Page Component
 * Main shopping cart page displaying cart items and order summary
 */
@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [
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
  private readonly router = inject(Router);

  // Cart store selectors with explicit types
  readonly cart: Signal<Cart | null> = this.cartStore.cart;
  readonly items: Signal<CartItem[]> = this.cartStore.items;
  readonly isEmpty: Signal<boolean> = this.cartStore.isEmpty;
  readonly loading: Signal<boolean> = this.cartStore.loading;
  readonly subtotal: Signal<number> = this.cartStore.subtotal;
  readonly tax: Signal<number> = this.cartStore.tax;
  readonly shipping: Signal<number> = this.cartStore.shipping;
  readonly total: Signal<number> = this.cartStore.total;
  readonly currency: Signal<string> = this.cartStore.currency;

  // Validation state selectors
  readonly hasPendingItems: Signal<boolean> = this.cartStore.hasPendingValidationItems;
  readonly hasBackorderItems: Signal<boolean> = this.cartStore.hasBackorderItems;
  readonly pendingItems: Signal<CartItem[]> = this.cartStore.pendingValidationItems;
  readonly backorderItems: Signal<CartItem[]> = this.cartStore.backorderItems;
  readonly canCheckout: Signal<boolean> = this.cartStore.canCheckout;

  // Checkout disabled reason
  readonly checkoutDisabledReason = computed(() => {
    if (this.isEmpty()) {
      return 'Your cart is empty';
    }
    if (this.hasPendingItems()) {
      return 'Please wait for all items to be validated before checkout';
    }
    return null;
  });

  /**
   * Updates the quantity of a cart item
   * @param lineNumber The line number of the item
   * @param quantity The new quantity
   */
  onUpdateQuantity(lineNumber: string, quantity: number): void {
    if (quantity <= 0) {
      this.onRemoveItem(lineNumber);
    } else {
      this.cartStore.updateItemQuantity(lineNumber, quantity);
    }
  }

  /**
   * Removes an item from the cart
   * @param lineNumber The line number of the item
   */
  onRemoveItem(lineNumber: string): void {
    this.cartStore.removeItem(lineNumber);
  }

  /**
   * Clears all items from the cart
   */
  onClearCart(): void {
    if (confirm('Are you sure you want to clear your cart?')) {
      this.cartStore.clearCart();
    }
  }

  /**
   * Proceeds to checkout
   */
  onProceedToCheckout(): void {
    if (this.hasBackorderItems()) {
      const confirmCheckout = confirm(
        'Your cart contains items on backorder. These items will not ship immediately. Do you want to continue?'
      );
      if (!confirmCheckout) return;
    }
    this.router.navigate(['/checkout']);
  }
}
