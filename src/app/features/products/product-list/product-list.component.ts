import { Component, OnInit, OnDestroy, inject, signal, Signal } from '@angular/core';

import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ProductStore } from '../../../store/product/product.store';
import { CartStore } from '../../../store';
import { BreadcrumbItem, Product, SortOption, ProductFilters } from '../../../models/product';
import { ProductCardComponent } from './components/product-card/product-card.component';
import { ProductFiltersComponent } from './components/product-filters/product-filters.component';
import { ProductSortComponent } from './components/product-sort/product-sort.component';
import { ProductSkeletonComponent } from './components/product-skeleton/product-skeleton.component';
import { EmptyStateComponent } from './components/empty-state/empty-state.component';
import { ErrorStateComponent } from './components/error-state/error-state.component';
import { QuickViewModalComponent } from './components/quick-view-modal/quick-view-modal.component';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    RouterModule,
    ProductCardComponent,
    ProductFiltersComponent,
    ProductSortComponent,
    ProductSkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    QuickViewModalComponent
],
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss']
})
export class ProductListComponent implements OnInit, OnDestroy {
  readonly productStore = inject(ProductStore);
  private readonly cartStore = inject(CartStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private destroy$ = new Subject<void>();

  // Signals from store - initialized in constructor to ensure injection context
  products!: Signal<Product[]>;
  loading!: Signal<boolean>;
  error!: Signal<string | null>;
  pagination!: Signal<{ limit: number; offset: number; total: number; hasMore: boolean }>;
  hasMore!: Signal<boolean>;
  filters!: Signal<ProductFilters>;
  activeFiltersCount!: Signal<number>;
  isFiltered!: Signal<boolean>;
  sortBy!: Signal<SortOption>;

  // Breadcrumb items
  breadcrumbs = signal<BreadcrumbItem[]>([
    { label: 'Home', url: '/home' },
    { label: 'Products', active: true }
  ]);

  // Quick View
  quickViewProduct: Product | null = null;

  constructor() {
    // Initialize store signal references in constructor to ensure proper injection context
    this.products = this.productStore.sortedProducts;
    this.loading = this.productStore.loading;
    this.error = this.productStore.error;
    this.pagination = this.productStore.pagination;
    this.hasMore = this.productStore.hasMoreProducts;
    this.filters = this.productStore.filters;
    this.activeFiltersCount = this.productStore.activeFiltersCount;
    this.isFiltered = this.productStore.isFiltered;
    this.sortBy = this.productStore.sortBy;
  }

  ngOnInit(): void {
    // Subscribe to query params for search
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const searchQuery = params['q'];
        const category = params['category'];
        const brand = params['brand'];

        if (searchQuery) {
          this.productStore.searchProducts(searchQuery);
          this.updateBreadcrumbsForSearch(searchQuery);
        } else if (category) {
          this.productStore.filterByCategory(category);
          this.updateBreadcrumbsForCategory(category);
        } else if (brand) {
          this.productStore.filterByBrand(brand);
          this.updateBreadcrumbsForBrand(brand);
        } else {
          this.productStore.loadProducts();
          this.resetBreadcrumbs();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onLoadMore(): void {
    this.productStore.loadMore();
  }

  onClearFilters(): void {
    this.productStore.clearFilters();
    this.router.navigate(['/products']);
  }

  onViewDetails(product: Product): void {
    this.router.navigate(['/products', product.id]);
  }

  onQuickView(product: Product): void {
    this.quickViewProduct = product;
  }

  onCloseQuickView(): void {
    this.quickViewProduct = null;
  }

  onViewDetailsFromQuickView(product: Product): void {
    this.router.navigate(['/products', product.id]);
  }

  async onAddToCart(product: Product): Promise<void> {
    if (product.in_stock) {
      await this.cartStore.addItem(product.id.toString(), product.name, 1);
    }
  }

  trackByProductId(index: number, product: Product): number {
    return product.id;
  }

  onSortChange(sortOption: SortOption): void {
    this.productStore.setSortBy(sortOption);
  }

  private updateBreadcrumbsForSearch(query: string): void {
    this.breadcrumbs.set([
      { label: 'Home', url: '/home' },
      { label: 'Products', url: '/products' },
      { label: `Search: "${query}"`, active: true }
    ]);
  }

  private updateBreadcrumbsForCategory(category: string): void {
    this.breadcrumbs.set([
      { label: 'Home', url: '/home' },
      { label: 'Products', url: '/products' },
      { label: category, active: true }
    ]);
  }

  private updateBreadcrumbsForBrand(brand: string): void {
    this.breadcrumbs.set([
      { label: 'Home', url: '/home' },
      { label: 'Products', url: '/products' },
      { label: brand, active: true }
    ]);
  }

  private resetBreadcrumbs(): void {
    this.breadcrumbs.set([
      { label: 'Home', url: '/home' },
      { label: 'Products', active: true }
    ]);
  }
}
