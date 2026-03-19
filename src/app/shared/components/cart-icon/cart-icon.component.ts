import { RouterLink } from '@angular/router';
import { Component, inject, Signal, ChangeDetectionStrategy} from '@angular/core';

import { RouterModule } from '@angular/router';
import { CartStore } from '../../../store';

/**
 * Cart Icon Component
 * Displays a shopping cart icon with item count badge
 * Integrates with CartStore for reactive item count updates
 */
@Component({
  selector: 'app-cart-icon',
  imports: [RouterModule],
  template: `
    <a [routerLink]="['/cart']" class="cart-link" aria-label="Shopping cart">
      @if (itemCount() > 0) {
        <span class="cart-count" aria-label="Items in cart">
          {{ itemCount() > 99 ? '99+' : itemCount() }}
        </span>
      }
      <svg class="cart-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="9" cy="21" r="1"></circle>
        <circle cx="20" cy="21" r="1"></circle>
        <path d="m1 1 4 4h15l-1 7H6"></path>
      </svg>
      <span class="cart-text">Cart</span>
    </a>
    `,
  styleUrls: ['./cart-icon.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartIconComponent {
  private readonly cartStore = inject(CartStore);

  readonly itemCount: Signal<number> = this.cartStore.itemCount;
}
