import { RouterLink } from '@angular/router';
import { CurrencyPipe, SlicePipe } from '@angular/common';
import { Component, inject, input, output, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { Product } from '../../../../../models/product';
import { ProductService } from '../../../../../services/product.service';
import { ImageGalleryComponent } from '../../../product-detail/components/image-gallery/image-gallery.component';

@Component({
  selector: 'app-quick-view-modal',
  imports: [CurrencyPipe, SlicePipe, RouterLink, ImageGalleryComponent],
  templateUrl: './quick-view-modal.component.html',
  styleUrls: ['./quick-view-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuickViewModalComponent {
  readonly product = input<Product | null>(null);
  readonly close = output<void>();
  readonly viewDetails = output<Product>();

  private readonly productService = inject(ProductService);
  private readonly router = inject(Router);

  get discountPercentage(): number {
    const p = this.product();
    if (!p) return 0;
    return this.productService.calculateDiscountPercentage(p.initial_price, p.final_price);
  }

  get hasDiscount(): boolean {
    const p = this.product();
    if (!p) return false;
    return p.final_price < p.initial_price;
  }

  onClose(): void {
    this.close.emit();
  }

  onViewDetails(): void {
    const p = this.product();
    if (p) {
      this.viewDetails.emit(p);
      this.close.emit();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }
}
