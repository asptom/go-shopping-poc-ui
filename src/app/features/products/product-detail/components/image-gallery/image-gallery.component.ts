import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductImage } from '../../../../../models/product';
import { ProductService } from '../../../../../services/product.service';

@Component({
  selector: 'app-image-gallery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-gallery.component.html',
  styleUrls: ['./image-gallery.component.scss']
})
export class ImageGalleryComponent {
  @Input() images: ProductImage[] = [];
  
  private productService = inject(ProductService);
  
  selectedImage: ProductImage | null = null;

  ngOnInit(): void {
    // Default to main image or first image
    this.selectedImage = this.images.find(img => img.is_main) || this.images[0] || null;
  }

  getImageUrl(image: ProductImage): string {
    return this.productService.getImageUrl(image.product_id, image.minio_object_name);
  }

  selectImage(image: ProductImage): void {
    this.selectedImage = image;
  }

  get selectedImageUrl(): string {
    if (!this.selectedImage) {
      return '/assets/placeholder-product.jpg';
    }
    return this.getImageUrl(this.selectedImage);
  }
}
