import { RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { Component, input, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { Product } from '../../../../../models/product';
import { ProductStore } from '../../../../../store/product/product.store';
import { ProductService } from '../../../../../services/product.service';

@Component({
  selector: 'app-related-products',
  imports: [CurrencyPipe],
  template: `
    @if (relatedProducts().length > 0) {
      <section class="related-products">
        <h2>Related Products</h2>
        <div class="products-grid">
          @for (product of relatedProducts(); track trackByProductId($index, product)) {
            <article
              class="product-card"
              (click)="onProductClick(product)">
              <div class="image-container">
                <img
                  [src]="getImageUrl(product)"
                  [alt]="product.name"
                  loading="lazy"
                  (error)="$event.target.src = '/assets/placeholder-product.jpg'">
                  @if (hasDiscount(product)) {
                    <div class="discount-badge">
                      -{{ getDiscount(product) }}%
                    </div>
                  }
                </div>
                <div class="product-info">
                  <h3 class="product-name">{{ product.name }}</h3>
                  <div class="brand">{{ product.brand }}</div>
                  <div class="price-section">
                    <span class="final-price">{{ product.final_price | currency:product.currency }}</span>
                    @if (hasDiscount(product)) {
                      <span class="initial-price">
                        {{ product.initial_price | currency:product.currency }}
                      </span>
                    }
                  </div>
                </div>
              </article>
            }
          </div>
        </section>
      }
    `,
  styles: [`
    .related-products {
      margin-top: 60px;
      padding-top: 40px;
      border-top: 1px solid #ddd;
      
      h2 {
        font-size: 24px;
        font-weight: 600;
        color: #131921;
        margin-bottom: 24px;
      }
    }
    
    .products-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 20px;
    }

    .product-card {
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      
      &:hover {
        transform: translateY(-4px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }
    }

    .image-container {
      position: relative;
      aspect-ratio: 1;
      background: #f7f7f7;
      
      img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        padding: 12px;
      }
    }

    .discount-badge {
      position: absolute;
      top: 8px;
      left: 8px;
      background: #b12704;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }

    .product-info {
      padding: 12px;
    }

    .product-name {
      font-size: 14px;
      font-weight: 500;
      color: #131921;
      margin-bottom: 4px;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .brand {
      font-size: 12px;
      color: #565959;
      margin-bottom: 4px;
    }

    .price-section {
      display: flex;
      align-items: center;
      gap: 6px;
      
      .final-price {
        font-size: 16px;
        font-weight: 600;
        color: #b12704;
      }
      
      .initial-price {
        font-size: 12px;
        color: #565959;
        text-decoration: line-through;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RelatedProductsComponent implements OnInit {
  readonly currentProduct = input.required<Product>();

  private readonly productStore = inject(ProductStore);
  private readonly productService = inject(ProductService);
  private readonly router = inject(Router);
  
  relatedProducts = signal<Product[]>([]);

  ngOnInit(): void {
    const allProducts = this.productStore.products();
    
    const related = allProducts
      .filter((p: Product) => 
        p.id !== this.currentProduct().id && 
        (p.category === this.currentProduct().category || 
         p.brand === this.currentProduct().brand)
      )
      .slice(0, 4);
    
    this.relatedProducts.set(related);
    
    if (allProducts.length === 0) {
      this.loadRelatedProducts();
    }
  }

  private async loadRelatedProducts(): Promise<void> {
    await this.productStore.loadProducts(20, 0);
    
    const allProducts = this.productStore.products();
    const related = allProducts
      .filter((p: Product) => 
        p.id !== this.currentProduct().id && 
        (p.category === this.currentProduct().category || 
         p.brand === this.currentProduct().brand)
      )
      .slice(0, 4);
    
    this.relatedProducts.set(related);
  }

  getImageUrl(product: Product): string {
    const mainImage = this.productService.getMainImage(product);
    if (!mainImage) {
      return '/assets/placeholder-product.jpg';
    }
    return this.productService.getImageUrl(product.id, mainImage.minio_object_name);
  }

  hasDiscount(product: Product): boolean {
    return product.final_price < product.initial_price;
  }

  getDiscount(product: Product): number {
    return this.productService.calculateDiscountPercentage(
      product.initial_price,
      product.final_price
    );
  }

  onProductClick(product: Product): void {
    this.router.navigate(['/products', product.id]);
  }

  trackByProductId(index: number, product: Product): number {
    return product.id;
  }
}
