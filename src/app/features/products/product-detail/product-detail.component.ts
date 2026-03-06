import { Component, inject, OnDestroy, OnInit, signal, effect, EffectRef, NgZone, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ProductStore } from '../../../store/product/product.store';
import { ProductService } from '../../../services/product.service';
import { CartStore } from '../../../store';
import { BreadcrumbItem, Product } from '../../../models/product';
import { ImageGalleryComponent } from './components/image-gallery/image-gallery.component';
import { RelatedProductsComponent } from './components/related-products/related-products.component';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ImageGalleryComponent,
    RelatedProductsComponent,
    BreadcrumbComponent
  ],
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.scss']
})
export class ProductDetailComponent implements OnInit, OnDestroy {
  route = inject(ActivatedRoute);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private productStore = inject(ProductStore);
  private productService = inject(ProductService);
  private cartStore = inject(CartStore);
  private destroy$ = new Subject<void>();
  private breadcrumbEffectRef?: EffectRef;

  // Signals from store - initialized in constructor
  product!: Signal<Product | null>;
  loading!: Signal<boolean>;
  error!: Signal<string | null>;
  
  breadcrumbs = signal<BreadcrumbItem[]>([]);
  
  // Quantity selector state
  quantity = signal(1);
  addingToCart = signal(false);

  constructor() {
    // Initialize store signals in constructor
    this.product = this.productStore.selectedProduct;
    this.loading = this.productStore.loading;
    this.error = this.productStore.error;

    // Setup effect to update breadcrumbs when product changes - must be in constructor
    this.breadcrumbEffectRef = effect(() => {
      const p = this.product();
      if (p) {
        this.breadcrumbs.set([
          { label: 'Home', url: '/home' },
          { label: 'Products', url: '/products' },
          { label: p.category, url: '/products', queryParams: { category: p.category } },
          { label: p.name, active: true }
        ]);
      }
    });
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const productId = Number(params.get('id'));
        if (productId) {
          this.loadProduct(productId);
        } else {
          this.ngZone.run(() => {
            this.router.navigate(['/products']);
          });
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.productStore.setSelectedProduct(null);
    this.breadcrumbEffectRef?.destroy();
  }

  async loadProduct(id: number): Promise<void> {
    await this.productStore.loadProductById(id);
  }

  get discountPercentage(): number {
    const p = this.product();
    if (!p) return 0;
    return this.productService.calculateDiscountPercentage(
      p.initial_price,
      p.final_price
    );
  }

  get hasDiscount(): boolean {
    const p = this.product();
    if (!p) return false;
    return p.final_price < p.initial_price;
  }

  get availableSizes(): string[] {
    const p = this.product();
    if (!p) return [];
    return this.productService.parseAvailableSizes(p.all_available_sizes);
  }

  async onAddToCart(): Promise<void> {
    const product = this.product();
    if (!product || !product.in_stock || this.addingToCart()) return;

    this.addingToCart.set(true);
    
    try {
      await this.cartStore.addItem(product.id.toString(), product.name, this.quantity());
      this.quantity.set(1); // Reset quantity
    } finally {
      this.addingToCart.set(false);
    }
  }

  onQuantityChange(delta: number): void {
    const current = this.quantity();
    const newQuantity = current + delta;
    if (newQuantity >= 1 && newQuantity <= 10) {
      this.quantity.set(newQuantity);
    }
  }

  onCategoryClick(): void {
    const category = this.product()?.category;
    if (category) {
      this.router.navigate(['/products'], {
        queryParams: { category }
      });
    }
  }

  onBrandClick(): void {
    const brand = this.product()?.brand;
    if (brand) {
      this.router.navigate(['/products'], {
        queryParams: { brand }
      });
    }
  }
}
