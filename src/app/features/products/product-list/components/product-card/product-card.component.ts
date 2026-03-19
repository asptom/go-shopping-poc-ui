import { RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { Component, inject, input, output, effect, signal, ChangeDetectionStrategy } from '@angular/core';
import { Product, ProductImage } from '../../../../../models/product';
import { ProductService } from '../../../../../services/product.service';

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

  private readonly productService = inject(ProductService);
  private readonly mainImage = signal<ProductImage | undefined>(undefined);

  constructor() {
    effect(() => {
      const img = this.productService.getMainImage(this.product());
      this.mainImage.set(img);
    });
  }

  get mainImageUrl(): string {
    const img = this.mainImage();
    if (!img) return '/assets/placeholder-product.jpg';
    return this.productService.getImageUrl(this.product().id, img.minio_object_name);
  }

  get discountPercentage(): number {
    return this.productService.calculateDiscountPercentage(
      this.product().initial_price,
      this.product().final_price
    );
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
