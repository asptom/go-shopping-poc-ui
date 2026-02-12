import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Product } from '../../../../../models/product';
import { ProductService } from '../../../../../services/product.service';
import { ImageGalleryComponent } from '../../../product-detail/components/image-gallery/image-gallery.component';

@Component({
  selector: 'app-quick-view-modal',
  standalone: true,
  imports: [CommonModule, RouterModule, ImageGalleryComponent],
  templateUrl: './quick-view-modal.component.html',
  styleUrls: ['./quick-view-modal.component.scss']
})
export class QuickViewModalComponent {
  @Input() product: Product | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() viewDetails = new EventEmitter<Product>();

  private productService = inject(ProductService);
  private router = inject(Router);

  get discountPercentage(): number {
    if (!this.product) return 0;
    return this.productService.calculateDiscountPercentage(
      this.product.initial_price,
      this.product.final_price
    );
  }

  get hasDiscount(): boolean {
    if (!this.product) return false;
    return this.product.final_price < this.product.initial_price;
  }

  onClose(): void {
    this.close.emit();
  }

  onViewDetails(): void {
    if (this.product) {
      this.viewDetails.emit(this.product);
      this.close.emit();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }
}
