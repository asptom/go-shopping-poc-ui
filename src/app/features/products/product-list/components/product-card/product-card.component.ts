import { Component, Input, Output, EventEmitter, inject, effect, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Product, ProductImage } from '../../../../../models/product';
import { ProductService } from '../../../../../services/product.service';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.scss']
})
export class ProductCardComponent {
  @Input() product!: Product;
  @Output() viewDetails = new EventEmitter<Product>();
  @Output() quickView = new EventEmitter<Product>();

  private productService = inject(ProductService);

  private mainImage = signal<ProductImage | undefined>(undefined);

  constructor() {
    effect(() => {
      if (this.product) {
        const img = this.productService.getMainImage(this.product);
        this.mainImage.set(img);
      }
    });
  }

  get mainImageUrl(): string {
    if (!this.product) {
      return '/assets/placeholder-product.jpg';
    }
    const img = this.mainImage();
    if (!img) {
      return '/assets/placeholder-product.jpg';
    }
    return this.productService.getImageUrl(this.product.id, img.minio_object_name);
  }

  get discountPercentage(): number {
    if (!this.product) {
      return 0;
    }
    return this.productService.calculateDiscountPercentage(
      this.product.initial_price,
      this.product.final_price
    );
  }

  get hasDiscount(): boolean {
    if (!this.product) {
      return false;
    }
    return this.product.final_price < this.product.initial_price;
  }

  onViewDetails(): void {
    this.viewDetails.emit(this.product);
  }

  onQuickView(event: Event): void {
    event.stopPropagation();
    this.quickView.emit(this.product);
  }
}
