import { Component, inject, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
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
    CommonModule, 
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
    this.cartStore.setCheckoutStep('contact');
  }
}
