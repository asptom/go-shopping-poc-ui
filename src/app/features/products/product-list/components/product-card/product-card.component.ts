import { RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { Component, input, output, computed, ChangeDetectionStrategy } from '@angular/core';
import { Product } from '../../../../../models/product';
import { environment } from '../../../../../../environments/environment';

@Component({
  selector: 'app-product-card',
  imports: [CurrencyPipe],
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCardComponent {
  readonly product = input.required<Product>();
  readonly viewDetails = output<Product>();
  readonly quickView = output<Product>();
  readonly addToCart = output<Product>();

  readonly mainImageUrl = computed(() => {
    const url = this.product().main_image_url;
    if (!url) return '/assets/placeholder-product.jpg';
    if (url.startsWith('http')) return url;
    const baseUrl = environment.apiUrl.replace('/api/v1', '');
    return `${baseUrl}${url}`;
  });

  get discountPercentage(): number {
    const initial = this.product().initial_price;
    const final = this.product().final_price;
    if (initial <= 0 || final >= initial) return 0;
    return Math.round(((initial - final) / initial) * 100);
  }

  get hasDiscount(): boolean {
    return this.product().final_price < this.product().initial_price;
  }

  onViewDetails(): void {
    this.viewDetails.emit(this.product());
  }

  onQuickView(event: Event): void {
    event.stopPropagation();
    this.quickView.emit(this.product());
  }

  onAddToCart(event: Event): void {
    event.stopPropagation();
    if (this.product().in_stock) {
      this.addToCart.emit(this.product());
    }
  }
}
