import { RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-cart-summary',
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './cart-summary.component.html',
  styleUrls: ['./cart-summary.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartSummaryComponent {
  readonly subtotal = input<number>(0);
  readonly tax = input<number>(0);
  readonly shipping = input<number>(0);
  readonly total = input<number>(0);
  readonly currency = input<string>('USD');
  readonly itemCount = input<number>(0);
  readonly canCheckout = input<boolean>(false);
  readonly hasPendingItems = input<boolean>(false);
  readonly hasBackorderItems = input<boolean>(false);
  readonly checkout = output<void>();
  readonly clearCart = output<void>();

  onCheckout(): void {
    this.checkout.emit();
  }

  onClearCart(): void {
    this.clearCart.emit();
  }
}
