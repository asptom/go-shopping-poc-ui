import { Component, inject, input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ProductImage } from '../../../../../models/product';
import { ProductService } from '../../../../../services/product.service';

@Component({
  selector: 'app-image-gallery',
  imports: [],
  templateUrl: './image-gallery.component.html',
  styleUrls: ['./image-gallery.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageGalleryComponent implements OnInit {
  readonly images = input<ProductImage[]>([]);

  private readonly productService = inject(ProductService);

  selectedImage: ProductImage | null = null;

  ngOnInit(): void {
    const imgs = this.images();
    this.selectedImage = imgs.find(img => img.is_main) || imgs[0] || null;
  }

  getImageUrl(image: ProductImage): string {
    return this.productService.getImageUrl(image.product_id, image.minio_object_name);
  }

  selectImage(image: ProductImage): void {
    this.selectedImage = image;
  }

  get selectedImageUrl(): string {
    if (!this.selectedImage) return '/assets/placeholder-product.jpg';
    return this.getImageUrl(this.selectedImage);
  }
}
