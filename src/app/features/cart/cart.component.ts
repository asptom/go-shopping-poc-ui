import { Component, inject, Signal, computed, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CartStore } from '../../store';
import { Cart, CartItem } from '../../models/cart';
import { CartItemComponent } from './components/cart-item/cart-item.component';
import { CartSummaryComponent } from './components/cart-summary/cart-summary.component';
import { EmptyCartComponent } from './components/empty-cart/empty-cart.component';
import { ConfirmationModalComponent } from '../../shared/modal';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { BreadcrumbItem } from '../../models/product';

@Component({
  selector: 'app-cart',
  imports: [
    RouterLink,
    CartItemComponent,
    CartSummaryComponent,
    EmptyCartComponent,
    ConfirmationModalComponent,
    BreadcrumbComponent,
  ],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartComponent {
  private readonly cartStore = inject(CartStore);
  private readonly router = inject(Router);

  // Cart store selectors
  readonly cart: Signal<Cart | null> = this.cartStore.cart;
  readonly items: Signal<CartItem[]> = this.cartStore.items;
  readonly isEmpty: Signal<boolean> = this.cartStore.isEmpty;
  readonly loading: Signal<boolean> = this.cartStore.loading;
  readonly subtotal: Signal<number> = this.cartStore.subtotal;
  readonly tax: Signal<number> = this.cartStore.tax;
  readonly shipping: Signal<number> = this.cartStore.shipping;
  readonly total: Signal<number> = this.cartStore.total;
  readonly currency: Signal<string> = this.cartStore.currency;

  // Validation state
  readonly hasPendingItems: Signal<boolean> = this.cartStore.hasPendingValidationItems;
  readonly hasBackorderItems: Signal<boolean> = this.cartStore.hasBackorderItems;
  readonly pendingItems: Signal<CartItem[]> = this.cartStore.pendingValidationItems;
  readonly backorderItems: Signal<CartItem[]> = this.cartStore.backorderItems;
  readonly canCheckout: Signal<boolean> = this.cartStore.canCheckout;

  // Confirmation modal state
  readonly showClearCartConfirm = signal(false);
  readonly showBackorderConfirm = signal(false);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', url: '/home' },
    { label: 'Shopping Cart', url: '/cart' },
  ];

  readonly checkoutDisabledReason = computed(() => {
    if (this.isEmpty()) return 'Your cart is empty';
    if (this.hasPendingItems()) return 'Please wait for all items to be validated before checkout';
    return null;
  });

  onUpdateQuantity(lineNumber: string, quantity: number): void {
    if (quantity <= 0) {
      this.onRemoveItem(lineNumber);
    } else {
      this.cartStore.updateItemQuantity(lineNumber, quantity);
    }
  }

  onRemoveItem(lineNumber: string): void {
    this.cartStore.removeItem(lineNumber);
  }

  onClearCart(): void {
    this.showClearCartConfirm.set(true);
  }

  confirmClearCart(): void {
    this.showClearCartConfirm.set(false);
    this.cartStore.clearCart();
  }

  onProceedToCheckout(): void {
    if (this.hasBackorderItems()) {
      this.showBackorderConfirm.set(true);
    } else {
      this.router.navigate(['/checkout']);
    }
  }

  confirmBackorderCheckout(): void {
    this.showBackorderConfirm.set(false);
    this.router.navigate(['/checkout']);
  }
}
