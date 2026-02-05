# Product Catalog Implementation Plan v1

## Overview

This document provides a detailed, phase-by-phase implementation plan for building the product catalog portion of the GoShopping application. The plan is designed for AI coding agents to implement sequentially without requiring extensive additional reasoning.

**Last Updated:** 2026-02-05  
**Status:** Ready for Implementation  
**Total Phases:** 6  
**Estimated Total Time:** 12-15 hours

---

## Architecture Decisions

### Design Patterns (Follow Existing Codebase)
- **Standalone Components**: All new components use Angular's standalone API
- **Signals-Based State Management**: Continue using Angular signals for reactive state
- **Layout-First Routing**: Routes nested under Layout component for consistent header/footer
- **Service Pattern**: Services follow existing CustomerService pattern with HttpClient
- **SCSS Styling**: Component-scoped SCSS with Amazon-inspired color scheme (#131921/#ff9900)
- **Error Handling**: Use existing ErrorHandlerService and NotificationService
- **localStorage**: Use for client-side persistence where needed

### Product Catalog Specifications
- **Search**: Header-integrated with 300ms debouncing
- **Product Cards**: Standard display (image, name, price, stock status)
- **Filters**: Sidebar-based with category, brand, and stock filters
- **Navigation**: Breadcrumbs on all product pages
- **Cart**: UI placeholder only (full cart feature is separate)
- **Reviews**: Skip for now
- **Wishlist**: Not included
- **Sorting**: Client-side sort options
- **Quick View**: Modal-based quick product preview
- **Related Products**: Section on product detail page

---

## Phase 1: Foundation - Models, ProductService, and ProductStore

**Priority:** CRITICAL  
**Dependencies:** None  
**Estimated Time:** 2-3 hours  
**Files to Create:** 4  
**Files to Modify:** 0

### 1.1 Create Product Models

**File:** `src/app/models/product.ts`

**Interfaces to Create:**

```typescript
// Product interface matching API specification
export interface Product {
  id: number;
  name: string;
  description: string;
  initial_price: number;
  final_price: number;
  currency: string;
  in_stock: boolean;
  color: string;
  size: string;
  country_code: string;
  image_count: number;
  model_number: string;
  other_attributes: string;
  root_category: string;
  category: string;
  brand: string;
  all_available_sizes: string;
  created_at: string;
  updated_at: string;
  images: ProductImage[];
}

// ProductImage interface
export interface ProductImage {
  id: number;
  product_id: number;
  minio_object_name: string;
  is_main: boolean;
  image_order: number;
  file_size: number;
  content_type: string;
  created_at: string;
}

// Paginated list response
export interface ProductListResponse {
  products: Product[];
  limit: number;
  offset: number;
  count: number;
}

// Search response
export interface ProductSearchResponse extends ProductListResponse {
  query: string;
}

// Category response
export interface ProductCategoryResponse extends ProductListResponse {
  category: string;
}

// Brand response
export interface ProductBrandResponse extends ProductListResponse {
  brand: string;
}

// Filter state interface
export interface ProductFilters {
  category: string | null;
  brand: string | null;
  searchQuery: string | null;
  inStockOnly: boolean;
}

// Sort options
export type SortOption = 
  | 'name_asc' 
  | 'name_desc' 
  | 'price_asc' 
  | 'price_desc' 
  | 'newest';

// Breadcrumb item
export interface BreadcrumbItem {
  label: string;
  url?: string;
  active?: boolean;
}
```

**Implementation Notes:**
- All date fields are ISO 8601 strings
- Price fields are numbers (not strings)
- images array may be empty
- all_available_sizes is a JSON string that needs parsing

### 1.2 Create Product Service

**File:** `src/app/services/product.service.ts`

**Service Structure:**

```typescript
@Injectable({ providedIn: 'root' })
export class ProductService {
  private apiUrl = `${environment.apiUrl}/products`;
  
  constructor(private http: HttpClient) {}

  // Get all products with pagination
  getAllProducts(limit: number = 50, offset: number = 0): Observable<ProductListResponse> {
    return this.http.get<ProductListResponse>(this.apiUrl, {
      params: { limit: limit.toString(), offset: offset.toString() }
    });
  }

  // Get single product by ID
  getProductById(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/${id}`);
  }

  // Search products
  searchProducts(query: string, limit: number = 50, offset: number = 0): Observable<ProductSearchResponse> {
    return this.http.get<ProductSearchResponse>(`${this.apiUrl}/search`, {
      params: { q: query, limit: limit.toString(), offset: offset.toString() }
    });
  }

  // Get products by category
  getProductsByCategory(category: string, limit: number = 50, offset: number = 0): Observable<ProductCategoryResponse> {
    return this.http.get<ProductCategoryResponse>(
      `${this.apiUrl}/category/${encodeURIComponent(category)}`,
      { params: { limit: limit.toString(), offset: offset.toString() } }
    );
  }

  // Get products by brand
  getProductsByBrand(brand: string, limit: number = 50, offset: number = 0): Observable<ProductBrandResponse> {
    return this.http.get<ProductBrandResponse>(
      `${this.apiUrl}/brand/${encodeURIComponent(brand)}`,
      { params: { limit: limit.toString(), offset: offset.toString() } }
    );
  }

  // Get in-stock products only
  getProductsInStock(limit: number = 50, offset: number = 0): Observable<ProductListResponse> {
    return this.http.get<ProductListResponse>(`${this.apiUrl}/in-stock`, {
      params: { limit: limit.toString(), offset: offset.toString() }
    });
  }

  // Get all images for a product
  getProductImages(productId: number): Observable<ProductImage[]> {
    return this.http.get<ProductImage[]>(`${this.apiUrl}/${productId}/images`);
  }

  // Get main image for a product
  getProductMainImage(productId: number): Observable<ProductImage> {
    return this.http.get<ProductImage>(`${this.apiUrl}/${productId}/main-image`);
  }

  // Helper: Extract image name from minio_object_name
  // Example: "products/40121298/image_0.jpg" -> "image_0.jpg"
  getImageName(minioObjectName: string): string {
    const parts = minioObjectName.split('/');
    return parts[parts.length - 1];
  }

  // Helper: Construct direct image URL
  getImageUrl(productId: number, minioObjectName: string): string {
    const imageName = this.getImageName(minioObjectName);
    return `${environment.apiUrl}/products/${productId}/images/${imageName}`;
  }

  // Helper: Find main image from product
  getMainImage(product: Product): ProductImage | undefined {
    return product.images.find(img => img.is_main);
  }

  // Helper: Calculate discount percentage
  calculateDiscountPercentage(initialPrice: number, finalPrice: number): number {
    if (initialPrice <= 0 || finalPrice >= initialPrice) return 0;
    return Math.round(((initialPrice - finalPrice) / initialPrice) * 100);
  }

  // Helper: Parse all_available_sizes JSON string
  parseAvailableSizes(sizesJson: string): string[] {
    try {
      return JSON.parse(sizesJson);
    } catch {
      return [];
    }
  }
}
```

**Implementation Notes:**
- Import HttpClient from '@angular/common/http'
- Import Observable from 'rxjs'
- Import environment from '../../environments/environment'
- Always URL-encode category and brand names
- Use explicit return types for all methods

### 1.3 Create Product Store

**File:** `src/app/store/product/product.store.ts`

**Store Structure:**

```typescript
export interface ProductState {
  products: Product[];
  selectedProduct: Product | null;
  loading: boolean;
  error: string | null;
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  filters: ProductFilters;
  sortBy: SortOption;
}

@Injectable({ providedIn: 'root' })
export class ProductStore {
  private readonly productService = inject(ProductService);
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly notificationService = inject(NotificationService);

  // Private state signal
  private readonly state = signal<ProductState>({
    products: [],
    selectedProduct: null,
    loading: false,
    error: null,
    pagination: {
      limit: 20,
      offset: 0,
      total: 0,
      hasMore: false
    },
    filters: {
      category: null,
      brand: null,
      searchQuery: null,
      inStockOnly: false
    },
    sortBy: 'name_asc'
  });

  // Public computed selectors
  readonly products = computed(() => this.state().products);
  readonly selectedProduct = computed(() => this.state().selectedProduct);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly pagination = computed(() => this.state().pagination);
  readonly filters = computed(() => this.state().filters);
  readonly sortBy = computed(() => this.state().sortBy);
  readonly hasMoreProducts = computed(() => this.state().pagination.hasMore);
  readonly activeFiltersCount = computed(() => {
    const f = this.state().filters;
    let count = 0;
    if (f.category) count++;
    if (f.brand) count++;
    if (f.searchQuery) count++;
    if (f.inStockOnly) count++;
    return count;
  });
  readonly currentCategory = computed(() => this.state().filters.category);
  readonly currentBrand = computed(() => this.state().filters.brand);
  readonly searchQuery = computed(() => this.state().filters.searchQuery);
  readonly isFiltered = computed(() => this.activeFiltersCount() > 0);

  // Sorted products (client-side sorting)
  readonly sortedProducts = computed(() => {
    const products = [...this.state().products];
    const sortBy = this.state().sortBy;
    
    switch (sortBy) {
      case 'name_asc':
        return products.sort((a, b) => a.name.localeCompare(b.name));
      case 'name_desc':
        return products.sort((a, b) => b.name.localeCompare(a.name));
      case 'price_asc':
        return products.sort((a, b) => a.final_price - b.final_price);
      case 'price_desc':
        return products.sort((a, b) => b.final_price - a.final_price);
      case 'newest':
        return products.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      default:
        return products;
    }
  });

  // Actions
  async loadProducts(limit: number = 20, offset: number = 0): Promise<void> {
    this.setLoading(true);
    this.setError(null);

    try {
      const response = await firstValueFrom(
        this.productService.getAllProducts(limit, offset)
      );
      
      this.state.update(s => ({
        ...s,
        products: offset === 0 ? response.products : [...s.products, ...response.products],
        pagination: {
          limit: response.limit,
          offset: response.offset,
          total: response.count,
          hasMore: response.products.length === limit
        }
      }));
    } catch (error) {
      this.handleError(error, 'Failed to load products');
    } finally {
      this.setLoading(false);
    }
  }

  async loadProductById(id: number): Promise<void> {
    this.setLoading(true);
    this.setError(null);

    try {
      const product = await firstValueFrom(
        this.productService.getProductById(id)
      );
      
      this.state.update(s => ({
        ...s,
        selectedProduct: product
      }));
    } catch (error) {
      this.handleError(error, 'Failed to load product details');
    } finally {
      this.setLoading(false);
    }
  }

  async searchProducts(query: string, limit: number = 20, offset: number = 0): Promise<void> {
    this.setLoading(true);
    this.setError(null);

    try {
      const response = await firstValueFrom(
        this.productService.searchProducts(query, limit, offset)
      );
      
      this.state.update(s => ({
        ...s,
        products: offset === 0 ? response.products : [...s.products, ...response.products],
        filters: { ...s.filters, searchQuery: query },
        pagination: {
          limit: response.limit,
          offset: response.offset,
          total: response.count,
          hasMore: response.products.length === limit
        }
      }));
    } catch (error) {
      this.handleError(error, 'Search failed');
    } finally {
      this.setLoading(false);
    }
  }

  async filterByCategory(category: string | null): Promise<void> {
    this.state.update(s => ({
      ...s,
      filters: { ...s.filters, category }
    }));

    if (category) {
      await this.loadProductsByCategory(category);
    } else {
      await this.loadProducts();
    }
  }

  async loadProductsByCategory(category: string, limit: number = 20, offset: number = 0): Promise<void> {
    this.setLoading(true);
    this.setError(null);

    try {
      const response = await firstValueFrom(
        this.productService.getProductsByCategory(category, limit, offset)
      );
      
      this.state.update(s => ({
        ...s,
        products: offset === 0 ? response.products : [...s.products, ...response.products],
        pagination: {
          limit: response.limit,
          offset: response.offset,
          total: response.count,
          hasMore: response.products.length === limit
        }
      }));
    } catch (error) {
      this.handleError(error, 'Failed to load products by category');
    } finally {
      this.setLoading(false);
    }
  }

  async filterByBrand(brand: string | null): Promise<void> {
    this.state.update(s => ({
      ...s,
      filters: { ...s.filters, brand }
    }));

    if (brand) {
      await this.loadProductsByBrand(brand);
    } else {
      await this.loadProducts();
    }
  }

  async loadProductsByBrand(brand: string, limit: number = 20, offset: number = 0): Promise<void> {
    this.setLoading(true);
    this.setError(null);

    try {
      const response = await firstValueFrom(
        this.productService.getProductsByBrand(brand, limit, offset)
      );
      
      this.state.update(s => ({
        ...s,
        products: offset === 0 ? response.products : [...s.products, ...response.products],
        pagination: {
          limit: response.limit,
          offset: response.offset,
          total: response.count,
          hasMore: response.products.length === limit
        }
      }));
    } catch (error) {
      this.handleError(error, 'Failed to load products by brand');
    } finally {
      this.setLoading(false);
    }
  }

  async filterByStock(inStockOnly: boolean): Promise<void> {
    this.state.update(s => ({
      ...s,
      filters: { ...s.filters, inStockOnly }
    }));

    if (inStockOnly) {
      await this.loadInStockProducts();
    } else {
      await this.loadProducts();
    }
  }

  async loadInStockProducts(limit: number = 20, offset: number = 0): Promise<void> {
    this.setLoading(true);
    this.setError(null);

    try {
      const response = await firstValueFrom(
        this.productService.getProductsInStock(limit, offset)
      );
      
      this.state.update(s => ({
        ...s,
        products: offset === 0 ? response.products : [...s.products, ...response.products],
        pagination: {
          limit: response.limit,
          offset: response.offset,
          total: response.count,
          hasMore: response.products.length === limit
        }
      }));
    } catch (error) {
      this.handleError(error, 'Failed to load in-stock products');
    } finally {
      this.setLoading(false);
    }
  }

  setSortBy(sortBy: SortOption): void {
    this.state.update(s => ({ ...s, sortBy }));
  }

  clearFilters(): void {
    this.state.update(s => ({
      ...s,
      filters: {
        category: null,
        brand: null,
        searchQuery: null,
        inStockOnly: false
      }
    }));
    this.loadProducts();
  }

  setSelectedProduct(product: Product | null): void {
    this.state.update(s => ({ ...s, selectedProduct: product }));
  }

  async loadMore(): Promise<void> {
    const currentOffset = this.state().pagination.offset;
    const limit = this.state().pagination.limit;
    const newOffset = currentOffset + limit;

    if (this.state().filters.searchQuery) {
      await this.searchProducts(this.state().filters.searchQuery, limit, newOffset);
    } else if (this.state().filters.category) {
      await this.loadProductsByCategory(this.state().filters.category, limit, newOffset);
    } else if (this.state().filters.brand) {
      await this.loadProductsByBrand(this.state().filters.brand, limit, newOffset);
    } else if (this.state().filters.inStockOnly) {
      await this.loadInStockProducts(limit, newOffset);
    } else {
      await this.loadProducts(limit, newOffset);
    }
  }

  private setLoading(loading: boolean): void {
    this.state.update(s => ({ ...s, loading }));
  }

  private setError(error: string | null): void {
    this.state.update(s => ({ ...s, error }));
  }

  private handleError(error: unknown, defaultMessage: string): void {
    const errorMessage = this.errorHandler.handleError(error);
    this.setError(errorMessage.message || defaultMessage);
    this.notificationService.showError(errorMessage.message || defaultMessage);
  }
}
```

**Implementation Notes:**
- Import necessary dependencies: signal, computed, inject, Injectable
- Import firstValueFrom from 'rxjs'
- Import services: ProductService, ErrorHandlerService, NotificationService
- All async actions use try-catch with error handling
- State updates are atomic using state.update()

### 1.4 Create Store Index

**File:** `src/app/store/product/index.ts`

```typescript
export { ProductStore } from './product.store';
```

**Create Directory:** `src/app/store/product/`

### Phase 1 Testing Checklist

- [ ] All interfaces compile without errors
- [ ] ProductService can be injected
- [ ] ProductStore can be injected
- [ ] Store selectors return correct values
- [ ] Service methods have correct return types

---

## Phase 2: Product Listing Page with Pagination

**Priority:** CRITICAL  
**Dependencies:** Phase 1  
**Estimated Time:** 3-4 hours  
**Files to Create:** 5  
**Files to Modify:** 1

### 2.1 Create Product List Container Component

**File:** `src/app/features/products/product-list/product-list.component.ts`

**Component Specification:**

```typescript
@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ProductCardComponent,
    ProductFiltersComponent,
    PaginationComponent,
    ProductSkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    BreadcrumbComponent
  ],
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss']
})
export class ProductListComponent implements OnInit, OnDestroy {
  private readonly productStore = inject(ProductStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private destroy$ = new Subject<void>();

  // Signals from store
  products = this.productStore.sortedProducts;
  loading = this.productStore.loading;
  error = this.productStore.error;
  pagination = this.productStore.pagination;
  hasMore = this.productStore.hasMoreProducts;
  filters = this.productStore.filters;
  activeFiltersCount = this.productStore.activeFiltersCount;
  isFiltered = this.productStore.isFiltered;

  // Breadcrumb items
  breadcrumbs = signal<BreadcrumbItem[]>([
    { label: 'Home', url: '/home' },
    { label: 'Products', active: true }
  ]);

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
```

**Template:** `product-list.component.html`

```html
<div class="product-list-page">
  <!-- Breadcrumbs -->
  <app-breadcrumb [items]="breadcrumbs()"></app-breadcrumb>

  <div class="page-header">
    <h1>Products</h1>
    <div class="results-info" *ngIf="!loading() && products().length > 0">
      Showing {{ products().length }} of {{ pagination().total }} products
    </div>
  </div>

  <div class="product-list-container">
    <!-- Sidebar Filters -->
    <aside class="filters-sidebar">
      <app-product-filters 
        [filters]="filters()"
        [activeCount]="activeFiltersCount()">
      </app-product-filters>
    </aside>

    <!-- Main Content -->
    <main class="products-content">
      <!-- Loading State -->
      <div class="loading-grid" *ngIf="loading() && products().length === 0">
        <app-product-skeleton *ngFor="let i of [1,2,3,4,5,6,7,8]"></app-product-skeleton>
      </div>

      <!-- Error State -->
      <app-error-state 
        *ngIf="error() && !loading()"
        [message]="error()"
        (retry)="productStore.loadProducts()">
      </app-error-state>

      <!-- Empty State -->
      <app-empty-state 
        *ngIf="!loading() && !error() && products().length === 0"
        [isFiltered]="isFiltered()"
        (clearFilters)="onClearFilters()">
      </app-empty-state>

      <!-- Product Grid -->
      <div class="product-grid" *ngIf="products().length > 0">
        <app-product-card 
          *ngFor="let product of products(); trackBy: trackByProductId"
          [product]="product"
          (viewDetails)="onViewDetails($event)"
          (quickView)="onQuickView($event)">
        </app-product-card>
      </div>

      <!-- Load More -->
      <div class="load-more-container" *ngIf="products().length > 0 && hasMore()">
        <button 
          class="btn-load-more"
          (click)="onLoadMore()"
          [disabled]="loading()">
          {{ loading() ? 'Loading...' : 'Load More Products' }}
        </button>
      </div>
    </main>
  </div>
</div>
```

**Styles:** `product-list.component.scss`

```scss
.product-list-page {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  
  h1 {
    font-size: 28px;
    font-weight: 600;
    color: #131921;
  }
  
  .results-info {
    color: #565959;
    font-size: 14px;
  }
}

.product-list-container {
  display: flex;
  gap: 24px;
}

.filters-sidebar {
  width: 280px;
  flex-shrink: 0;
  
  @media (max-width: 768px) {
    display: none; // Hide on mobile, show toggle button instead
  }
}

.products-content {
  flex: 1;
}

.loading-grid,
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.load-more-container {
  display: flex;
  justify-content: center;
  margin-top: 40px;
  padding: 20px;
}

.btn-load-more {
  padding: 12px 32px;
  background: #ff9900;
  color: #131921;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  
  &:hover:not(:disabled) {
    background: #e88a00;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}
```

### 2.2 Create Product Card Component

**File:** `src/app/features/products/components/product-card/product-card.component.ts`

```typescript
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

  get mainImageUrl(): string {
    const mainImage = this.productService.getMainImage(this.product);
    if (!mainImage) {
      return '/assets/placeholder-product.jpg';
    }
    return this.productService.getImageUrl(this.product.id, mainImage.minio_object_name);
  }

  get discountPercentage(): number {
    return this.productService.calculateDiscountPercentage(
      this.product.initial_price,
      this.product.final_price
    );
  }

  get hasDiscount(): boolean {
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
```

**Template:** `product-card.component.html`

```html
<article class="product-card" (click)="onViewDetails()">
  <div class="image-container">
    <img 
      [src]="mainImageUrl" 
      [alt]="product.name"
      loading="lazy"
      (error)="$event.target.src = '/assets/placeholder-product.jpg'">
    
    <div class="discount-badge" *ngIf="hasDiscount">
      -{{ discountPercentage }}%
    </div>
    
    <button 
      class="quick-view-btn"
      (click)="onQuickView($event)">
      Quick View
    </button>
  </div>
  
  <div class="product-info">
    <h3 class="product-name">{{ product.name }}</h3>
    
    <div class="brand">{{ product.brand }}</div>
    
    <div class="price-section">
      <span class="final-price">{{ product.final_price | currency:product.currency }}</span>
      <span class="initial-price" *ngIf="hasDiscount">
        {{ product.initial_price | currency:product.currency }}
      </span>
    </div>
    
    <div class="stock-status" [class.in-stock]="product.in_stock">
      <span class="status-dot"></span>
      {{ product.in_stock ? 'In Stock' : 'Out of Stock' }}
    </div>
  </div>
</article>
```

**Styles:** `product-card.component.scss`

```scss
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
    
    .quick-view-btn {
      opacity: 1;
      visibility: visible;
    }
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
    padding: 16px;
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

.quick-view-btn {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  border: 1px solid #131921;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s;
  font-size: 14px;
  
  &:hover {
    background: #131921;
    color: white;
  }
}

.product-info {
  padding: 16px;
}

.product-name {
  font-size: 16px;
  font-weight: 500;
  color: #131921;
  margin-bottom: 8px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.brand {
  font-size: 14px;
  color: #565959;
  margin-bottom: 8px;
}

.price-section {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  
  .final-price {
    font-size: 20px;
    font-weight: 600;
    color: #b12704;
  }
  
  .initial-price {
    font-size: 14px;
    color: #565959;
    text-decoration: line-through;
  }
}

.stock-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #b12704;
  
  &.in-stock {
    color: #007600;
  }
  
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
  }
}
```

### 2.3 Create Product Skeleton Component

**File:** `src/app/features/products/components/product-skeleton/product-skeleton.component.ts`

```typescript
@Component({
  selector: 'app-product-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="skeleton-card">
      <div class="skeleton-image"></div>
      <div class="skeleton-content">
        <div class="skeleton-text skeleton-title"></div>
        <div class="skeleton-text skeleton-brand"></div>
        <div class="skeleton-text skeleton-price"></div>
        <div class="skeleton-text skeleton-stock"></div>
      </div>
    </div>
  `,
  styles: [`
    .skeleton-card {
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      overflow: hidden;
    }
    
    .skeleton-image {
      aspect-ratio: 1;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
    
    .skeleton-content {
      padding: 16px;
    }
    
    .skeleton-text {
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
      margin-bottom: 12px;
    }
    
    .skeleton-title {
      height: 20px;
      width: 100%;
    }
    
    .skeleton-brand {
      height: 14px;
      width: 60%;
    }
    
    .skeleton-price {
      height: 24px;
      width: 40%;
    }
    
    .skeleton-stock {
      height: 14px;
      width: 50%;
    }
    
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `]
})
export class ProductSkeletonComponent {}
```

### 2.4 Create Empty State Component

**File:** `src/app/features/products/components/empty-state/empty-state.component.ts`

```typescript
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="empty-state">
      <div class="icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
      </div>
      <h2>{{ isFiltered ? 'No products found' : 'No products available' }}</h2>
      <p>
        {{ isFiltered 
          ? 'Try adjusting your filters or search query to find what you\'re looking for.' 
          : 'Check back later for new products.' }}
      </p>
      <div class="actions" *ngIf="isFiltered">
        <button class="btn-clear" (click)="clearFilters.emit()">
          Clear Filters
        </button>
        <a routerLink="/products" class="btn-browse">Browse All Products</a>
      </div>
    </div>
  `,
  styles: [`
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      
      .icon {
        color: #565959;
        margin-bottom: 20px;
      }
      
      h2 {
        font-size: 24px;
        font-weight: 600;
        color: #131921;
        margin-bottom: 12px;
      }
      
      p {
        color: #565959;
        font-size: 16px;
        margin-bottom: 24px;
        max-width: 400px;
        margin-left: auto;
        margin-right: auto;
      }
      
      .actions {
        display: flex;
        gap: 16px;
        justify-content: center;
        flex-wrap: wrap;
        
        .btn-clear {
          padding: 12px 24px;
          background: #ff9900;
          color: #131921;
          border: none;
          border-radius: 4px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          
          &:hover {
            background: #e88a00;
          }
        }
        
        .btn-browse {
          padding: 12px 24px;
          background: white;
          color: #131921;
          border: 1px solid #131921;
          border-radius: 4px;
          font-size: 16px;
          font-weight: 600;
          text-decoration: none;
          
          &:hover {
            background: #f7f7f7;
          }
        }
      }
    }
  `]
})
export class EmptyStateComponent {
  @Input() isFiltered = false;
  @Output() clearFilters = new EventEmitter<void>();
}
```

### 2.5 Create Error State Component

**File:** `src/app/features/products/components/error-state/error-state.component.ts`

```typescript
@Component({
  selector: 'app-error-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="error-state">
      <div class="icon">⚠️</div>
      <h2>Something went wrong</h2>
      <p>{{ message || 'Unable to load products. Please try again.' }}</p>
      <button class="btn-retry" (click)="retry.emit()">
        Try Again
      </button>
    </div>
  `,
  styles: [`
    .error-state {
      text-align: center;
      padding: 60px 20px;
      
      .icon {
        font-size: 48px;
        margin-bottom: 16px;
      }
      
      h2 {
        font-size: 24px;
        font-weight: 600;
        color: #131921;
        margin-bottom: 12px;
      }
      
      p {
        color: #565959;
        font-size: 16px;
        margin-bottom: 24px;
      }
      
      .btn-retry {
        padding: 12px 24px;
        background: #ff9900;
        color: #131921;
        border: none;
        border-radius: 4px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        
        &:hover {
          background: #e88a00;
        }
      }
    }
  `]
})
export class ErrorStateComponent {
  @Input() message: string | null = null;
  @Output() retry = new EventEmitter<void>();
}
```

### 2.6 Create Product Filters Component (Basic)

**File:** `src/app/features/products/components/product-filters/product-filters.component.ts`

```typescript
@Component({
  selector: 'app-product-filters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-filters.component.html',
  styleUrls: ['./product-filters.component.scss']
})
export class ProductFiltersComponent {
  @Input() filters!: ProductFilters;
  @Input() activeCount = 0;

  private productStore = inject(ProductStore);

  categories = [
    'Automotive', 'Electronics', 'Home & Kitchen', 
    'Sports & Outdoors', 'Clothing', 'Books'
  ];

  brands = [
    'Junsun', 'Sony', 'Samsung', 'Apple', 
    'Nike', 'Adidas', 'Amazon Basics'
  ];

  onCategoryChange(category: string | null): void {
    this.productStore.filterByCategory(category);
  }

  onBrandChange(brand: string | null): void {
    this.productStore.filterByBrand(brand);
  }

  onStockChange(inStockOnly: boolean): void {
    this.productStore.filterByStock(inStockOnly);
  }

  onClearAll(): void {
    this.productStore.clearFilters();
  }
}
```

**Template:** `product-filters.component.html`

```html
<div class="filters-panel">
  <div class="filters-header">
    <h3>Filters</h3>
    <button 
      class="btn-clear"
      *ngIf="activeCount > 0"
      (click)="onClearAll()">
      Clear All ({{ activeCount }})
    </button>
  </div>

  <!-- Category Filter -->
  <div class="filter-section">
    <h4>Category</h4>
    <div class="filter-options">
      <label class="filter-option">
        <input 
          type="radio" 
          name="category"
          [checked]="filters.category === null"
          (change)="onCategoryChange(null)">
        <span>All Categories</span>
      </label>
      <label class="filter-option" *ngFor="let category of categories">
        <input 
          type="radio"
          name="category"
          [value]="category"
          [checked]="filters.category === category"
          (change)="onCategoryChange(category)">
        <span>{{ category }}</span>
      </label>
    </div>
  </div>

  <!-- Brand Filter -->
  <div class="filter-section">
    <h4>Brand</h4>
    <div class="filter-options">
      <label class="filter-option">
        <input 
          type="radio"
          name="brand"
          [checked]="filters.brand === null"
          (change)="onBrandChange(null)">
        <span>All Brands</span>
      </label>
      <label class="filter-option" *ngFor="let brand of brands">
        <input 
          type="radio"
          name="brand"
          [value]="brand"
          [checked]="filters.brand === brand"
          (change)="onBrandChange(brand)">
        <span>{{ brand }}</span>
      </label>
    </div>
  </div>

  <!-- Stock Filter -->
  <div class="filter-section">
    <h4>Availability</h4>
    <label class="filter-option">
      <input 
        type="checkbox"
        [checked]="filters.inStockOnly"
        (change)="onStockChange($event.target.checked)">
      <span>In Stock Only</span>
    </label>
  </div>
</div>
```

**Styles:** `product-filters.component.scss`

```scss
.filters-panel {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
}

.filters-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #ddd;
  
  h3 {
    font-size: 18px;
    font-weight: 600;
    color: #131921;
  }
  
  .btn-clear {
    background: none;
    border: none;
    color: #007185;
    font-size: 14px;
    cursor: pointer;
    text-decoration: underline;
    
    &:hover {
      color: #c7511f;
    }
  }
}

.filter-section {
  margin-bottom: 24px;
  
  &:last-child {
    margin-bottom: 0;
  }
  
  h4 {
    font-size: 16px;
    font-weight: 600;
    color: #131921;
    margin-bottom: 12px;
  }
}

.filter-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-option {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #0f1111;
  
  input {
    cursor: pointer;
  }
  
  &:hover {
    color: #c7511f;
  }
}
```

### 2.7 Update App Routes

**File:** `src/app/app.routes.ts`

Add the product list route:

```typescript
{
  path: 'products',
  loadComponent: () => import('./features/products/product-list/product-list.component').then(m => m.ProductListComponent),
  title: 'Products - GoShopping'
}
```

### Phase 2 Testing Checklist

- [ ] Product list page loads at `/products`
- [ ] Product grid displays with correct data
- [ ] Product cards show image, name, price, stock status
- [ ] Discount badges appear when applicable
- [ ] Loading skeletons display while fetching
- [ ] Empty state displays when no products
- [ ] Error state displays on API failure
- [ ] Load More button loads additional products
- [ ] Filters sidebar displays correctly
- [ ] Breadcrumbs show correct navigation path

---

## Phase 3: Product Search with Debouncing

**Priority:** CRITICAL  
**Dependencies:** Phase 1, Phase 2  
**Estimated Time:** 2-3 hours  
**Files to Create:** 1  
**Files to Modify:** 3

### 3.1 Update Header Component with Search

**File:** `src/app/layout/header/header.ts`

**Modifications:**

Add to imports:
```typescript
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
```

Add to component:
```typescript
export class Header {
  // ... existing code ...
  
  searchQuery = '';
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();
  
  constructor(private router: Router) {
    // Setup search debounce
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      if (query.length >= 2) {
        this.router.navigate(['/products'], {
          queryParams: { q: query }
        });
      } else if (query.length === 0) {
        this.router.navigate(['/products']);
      }
    });
  }
  
  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchSubject.next(value);
  }
  
  onSearchSubmit(event: Event): void {
    event.preventDefault();
    if (this.searchQuery.length >= 2) {
      this.router.navigate(['/products'], {
        queryParams: { q: this.searchQuery }
      });
    }
  }
  
  clearSearch(): void {
    this.searchQuery = '';
    this.router.navigate(['/products']);
  }
}
```

### 3.2 Update Header Template

**File:** `src/app/layout/header/header.html`

Add search form to header:

```html
<div class="search-container">
  <form class="search-form" (submit)="onSearchSubmit($event)">
    <input
      type="text"
      class="search-input"
      placeholder="Search products..."
      [(ngModel)]="searchQuery"
      (input)="onSearchInput($event)"
      name="search">
    <button type="submit" class="search-button">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"></circle>
        <path d="m21 21-4.35-4.35"></path>
      </svg>
    </button>
    <button 
      type="button" 
      class="clear-button"
      *ngIf="searchQuery"
      (click)="clearSearch()">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6 6 18"></path>
        <path d="m6 6 12 12"></path>
      </svg>
    </button>
  </form>
</div>
```

### 3.3 Update Header Styles

**File:** `src/app/layout/header/header.scss`

Add search styles:

```scss
.search-container {
  flex: 1;
  max-width: 600px;
  margin: 0 20px;
}

.search-form {
  display: flex;
  position: relative;
}

.search-input {
  flex: 1;
  padding: 10px 40px 10px 16px;
  border: none;
  border-radius: 4px 0 0 4px;
  font-size: 15px;
  background: white;
  
  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px #ff9900;
  }
}

.search-button {
  padding: 10px 16px;
  background: #ff9900;
  border: none;
  border-radius: 0 4px 4px 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: #e88a00;
  }
}

.clear-button {
  position: absolute;
  right: 50px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: #565959;
  padding: 4px;
  
  &:hover {
    color: #131921;
  }
}
```

### 3.4 Update Product List for Search

**File:** `src/app/features/products/product-list/product-list.component.ts`

Already implemented in Phase 2 - verify it handles search query parameter correctly.

### Phase 3 Testing Checklist

- [ ] Search input displays in header
- [ ] Typing triggers debounced search (300ms delay)
- [ ] Search navigates to /products?q={query}
- [ ] Search results display correctly
- [ ] Clear button clears search
- [ ] Empty search returns to all products
- [ ] Search with no results shows empty state
- [ ] Minimum 2 characters required before search

---

## Phase 4: Product Detail Page with Image Gallery

**Priority:** CRITICAL  
**Dependencies:** Phase 1  
**Estimated Time:** 3-4 hours  
**Files to Create:** 3  
**Files to Modify:** 1

### 4.1 Create Product Detail Component

**File:** `src/app/features/products/product-detail/product-detail.component.ts`

```typescript
@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ImageGalleryComponent,
    BreadcrumbComponent
  ],
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.scss']
})
export class ProductDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productStore = inject(ProductStore);
  private productService = inject(ProductService);
  private destroy$ = new Subject<void>();

  product = this.productStore.selectedProduct;
  loading = this.productStore.loading;
  error = this.productStore.error;
  
  breadcrumbs = signal<BreadcrumbItem[]>([]);

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const productId = Number(params.get('id'));
        if (productId) {
          this.loadProduct(productId);
        } else {
          this.router.navigate(['/products']);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.productStore.setSelectedProduct(null);
  }

  private async loadProduct(id: number): Promise<void> {
    await this.productStore.loadProductById(id);
    
    // Update breadcrumbs when product loads
    effect(() => {
      const p = this.product();
      if (p) {
        this.breadcrumbs.set([
          { label: 'Home', url: '/home' },
          { label: 'Products', url: '/products' },
          { label: p.category, url: `/products`, queryParams: { category: p.category } },
          { label: p.name, active: true }
        ]);
      }
    });
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

  onAddToCart(): void {
    // Placeholder - cart feature to be implemented separately
    console.log('Add to cart:', this.product()?.id);
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
```

**Template:** `product-detail.component.html`

```html
<div class="product-detail-page" *ngIf="!loading() || product()">
  <!-- Breadcrumbs -->
  <app-breadcrumb [items]="breadcrumbs()"></app-breadcrumb>

  <!-- Loading State -->
  <div class="loading-state" *ngIf="loading() && !product()">
    <div class="skeleton-gallery"></div>
    <div class="skeleton-info">
      <div class="skeleton-title"></div>
      <div class="skeleton-price"></div>
      <div class="skeleton-description"></div>
    </div>
  </div>

  <!-- Error State -->
  <div class="error-state" *ngIf="error() && !loading()">
    <h2>Error Loading Product</h2>
    <p>{{ error() }}</p>
    <button class="btn-retry" (click)="loadProduct(route.snapshot.params['id'])">
      Try Again
    </button>
    <a routerLink="/products" class="btn-back">Back to Products</a>
  </div>

  <!-- Product Content -->
  <div class="product-content" *ngIf="product() && !error()">
    <div class="product-layout">
      <!-- Left: Image Gallery -->
      <div class="gallery-section">
        <app-image-gallery [images]="product()!.images"></app-image-gallery>
      </div>

      <!-- Right: Product Info -->
      <div class="info-section">
        <div class="product-header">
          <h1 class="product-name">{{ product()!.name }}</h1>
          
          <div class="meta-info">
            <span class="brand" (click)="onBrandClick()">{{ product()!.brand }}</span>
            <span class="separator">|</span>
            <span class="category" (click)="onCategoryClick()">{{ product()!.category }}</span>
            <span class="separator">|</span>
            <span class="model" *ngIf="product()!.model_number">
              Model: {{ product()!.model_number }}
            </span>
          </div>
        </div>

        <div class="price-section">
          <div class="price-display">
            <span class="final-price">{{ product()!.final_price | currency:product()!.currency }}</span>
            <span class="initial-price" *ngIf="hasDiscount">
              {{ product()!.initial_price | currency:product()!.currency }}
            </span>
          </div>
          <div class="discount-badge" *ngIf="hasDiscount">
            Save {{ discountPercentage }}%
          </div>
        </div>

        <div class="stock-status" [class.in-stock]="product()!.in_stock">
          <span class="status-dot"></span>
          {{ product()!.in_stock ? 'In Stock' : 'Out of Stock' }}
        </div>

        <div class="actions">
          <button 
            class="btn-add-cart"
            [disabled]="!product()!.in_stock"
            (click)="onAddToCart()">
            {{ product()!.in_stock ? 'Add to Cart' : 'Out of Stock' }}
          </button>
        </div>

        <div class="product-details">
          <h3>Product Details</h3>
          
          <div class="detail-row" *ngIf="product()!.color">
            <span class="label">Color:</span>
            <span class="value">{{ product()!.color }}</span>
          </div>
          
          <div class="detail-row" *ngIf="product()!.size">
            <span class="label">Size:</span>
            <span class="value">{{ product()!.size }}</span>
          </div>
          
          <div class="detail-row" *ngIf="availableSizes.length > 0">
            <span class="label">Available Sizes:</span>
            <span class="value sizes">
              <span class="size-badge" *ngFor="let size of availableSizes">{{ size }}</span>
            </span>
          </div>
          
          <div class="detail-row" *ngIf="product()!.country_code">
            <span class="label">Country of Origin:</span>
            <span class="value">{{ product()!.country_code }}</span>
          </div>
        </div>

        <div class="description-section" *ngIf="product()!.description">
          <h3>Description</h3>
          <p class="description">{{ product()!.description }}</p>
        </div>
      </div>
    </div>
  </div>
</div>
```

**Styles:** `product-detail.component.scss`

```scss
.product-detail-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

.loading-state {
  display: flex;
  gap: 40px;
  padding: 40px 0;
  
  .skeleton-gallery {
    width: 50%;
    aspect-ratio: 1;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }
  
  .skeleton-info {
    flex: 1;
    
    .skeleton-title {
      height: 32px;
      width: 80%;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      margin-bottom: 20px;
    }
    
    .skeleton-price {
      height: 40px;
      width: 40%;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      margin-bottom: 20px;
    }
    
    .skeleton-description {
      height: 100px;
      width: 100%;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
  }
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.error-state {
  text-align: center;
  padding: 60px;
  
  h2 {
    font-size: 24px;
    margin-bottom: 16px;
  }
  
  .btn-retry {
    margin-right: 16px;
  }
}

.product-content {
  padding: 20px 0;
}

.product-layout {
  display: flex;
  gap: 60px;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 30px;
  }
}

.gallery-section {
  width: 50%;
  
  @media (max-width: 768px) {
    width: 100%;
  }
}

.info-section {
  flex: 1;
}

.product-header {
  margin-bottom: 24px;
  
  .product-name {
    font-size: 28px;
    font-weight: 600;
    color: #131921;
    line-height: 1.3;
    margin-bottom: 12px;
  }
  
  .meta-info {
    display: flex;
    align-items: center;
    gap: 12px;
    color: #565959;
    font-size: 14px;
    
    .brand,
    .category {
      color: #007185;
      cursor: pointer;
      
      &:hover {
        color: #c7511f;
        text-decoration: underline;
      }
    }
    
    .separator {
      color: #ddd;
    }
  }
}

.price-section {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  
  .price-display {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .final-price {
    font-size: 32px;
    font-weight: 600;
    color: #b12704;
  }
  
  .initial-price {
    font-size: 18px;
    color: #565959;
    text-decoration: line-through;
  }
  
  .discount-badge {
    background: #b12704;
    color: white;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 600;
  }
}

.stock-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  color: #b12704;
  margin-bottom: 24px;
  
  &.in-stock {
    color: #007600;
  }
  
  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: currentColor;
  }
}

.actions {
  margin-bottom: 32px;
  
  .btn-add-cart {
    width: 100%;
    padding: 16px;
    background: #ff9900;
    color: #131921;
    border: none;
    border-radius: 8px;
    font-size: 18px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    
    &:hover:not(:disabled) {
      background: #e88a00;
    }
    
    &:disabled {
      background: #ddd;
      color: #565959;
      cursor: not-allowed;
    }
  }
}

.product-details {
  background: #f7f7f7;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 32px;
  
  h3 {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 16px;
    color: #131921;
  }
  
  .detail-row {
    display: flex;
    padding: 8px 0;
    border-bottom: 1px solid #ddd;
    
    &:last-child {
      border-bottom: none;
    }
    
    .label {
      width: 150px;
      color: #565959;
      font-weight: 500;
    }
    
    .value {
      flex: 1;
      color: #131921;
      
      &.sizes {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
    }
    
    .size-badge {
      background: white;
      border: 1px solid #ddd;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 14px;
    }
  }
}

.description-section {
  h3 {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 16px;
    color: #131921;
  }
  
  .description {
    line-height: 1.6;
    color: #0f1111;
    white-space: pre-line;
  }
}
```

### 4.2 Create Image Gallery Component

**File:** `src/app/features/products/components/image-gallery/image-gallery.component.ts`

```typescript
@Component({
  selector: 'app-image-gallery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-gallery.component.html',
  styleUrls: ['./image-gallery.component.scss']
})
export class ImageGalleryComponent implements OnInit {
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
```

**Template:** `image-gallery.component.html`

```html
<div class="image-gallery">
  <!-- Main Image -->
  <div class="main-image-container">
    <img 
      [src]="selectedImageUrl" 
      [alt]="'Product image'"
      class="main-image"
      (error)="$event.target.src = '/assets/placeholder-product.jpg'">
  </div>

  <!-- Thumbnails -->
  <div class="thumbnails-container" *ngIf="images.length > 1">
    <button 
      class="thumbnail"
      *ngFor="let image of images"
      [class.active]="image.id === selectedImage?.id"
      (click)="selectImage(image)">
      <img 
        [src]="getImageUrl(image)" 
        [alt]="'Thumbnail'"
        loading="lazy"
        (error)="$event.target.src = '/assets/placeholder-product.jpg'">
    </button>
  </div>

  <!-- No Images State -->
  <div class="no-images" *ngIf="images.length === 0">
    <img src="/assets/placeholder-product.jpg" alt="No image available">
    <p>No images available</p>
  </div>
</div>
```

**Styles:** `image-gallery.component.scss`

```scss
.image-gallery {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.main-image-container {
  background: #f7f7f7;
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 1;
  
  .main-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    padding: 20px;
  }
}

.thumbnails-container {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 8px;
  
  .thumbnail {
    flex-shrink: 0;
    width: 80px;
    height: 80px;
    background: #f7f7f7;
    border: 2px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    overflow: hidden;
    padding: 0;
    
    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      padding: 8px;
    }
    
    &.active {
      border-color: #ff9900;
    }
    
    &:hover:not(.active) {
      border-color: #ddd;
    }
  }
}

.no-images {
  text-align: center;
  padding: 40px;
  background: #f7f7f7;
  border-radius: 8px;
  
  img {
    width: 200px;
    height: 200px;
    object-fit: contain;
    opacity: 0.5;
  }
  
  p {
    color: #565959;
    margin-top: 16px;
  }
}
```

### 4.3 Create Breadcrumb Component

**File:** `src/app/shared/components/breadcrumb/breadcrumb.component.ts`

```typescript
@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <ol class="breadcrumb-list">
        <li class="breadcrumb-item" *ngFor="let item of items; let last = last">
          <a 
            *ngIf="!last && item.url"
            [routerLink]="item.url"
            [queryParams]="item.queryParams"
            class="breadcrumb-link">
            <span *ngIf="item.label === 'Home'" class="home-icon">🏠</span>
            <span *ngIf="item.label !== 'Home'">{{ item.label }}</span>
          </a>
          <span *ngIf="last || !item.url" class="breadcrumb-current" aria-current="page">
            {{ item.label }}
          </span>
          <span *ngIf="!last" class="separator">›</span>
        </li>
      </ol>
    </nav>
  `,
  styles: [`
    .breadcrumb {
      padding: 12px 0;
      font-size: 14px;
    }
    
    .breadcrumb-list {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      list-style: none;
      margin: 0;
      padding: 0;
    }
    
    .breadcrumb-item {
      display: flex;
      align-items: center;
    }
    
    .breadcrumb-link {
      color: #565959;
      text-decoration: none;
      
      &:hover {
        color: #c7511f;
        text-decoration: underline;
      }
      
      .home-icon {
        font-size: 16px;
      }
    }
    
    .breadcrumb-current {
      color: #131921;
      font-weight: 500;
    }
    
    .separator {
      margin: 0 8px;
      color: #565959;
    }
  `]
})
export class BreadcrumbComponent {
  @Input() items: BreadcrumbItem[] = [];
}
```

### 4.4 Update App Routes

**File:** `src/app/app.routes.ts`

Add the product detail route:

```typescript
{
  path: 'products/:id',
  loadComponent: () => import('./features/products/product-detail/product-detail.component').then(m => m.ProductDetailComponent),
  title: 'Product Details - GoShopping'
}
```

### Phase 4 Testing Checklist

- [ ] Product detail page loads at `/products/:id`
- [ ] Image gallery displays thumbnails and main image
- [ ] Clicking thumbnail updates main image
- [ ] Product information displays correctly (name, price, stock, etc.)
- [ ] Discount calculation works correctly
- [ ] Add to Cart button respects stock status
- [ ] Category/Brand links navigate to filtered product list
- [ ] Breadcrumbs show correct navigation path
- [ ] Loading and error states work correctly
- [ ] Navigation from product list to detail works

---

## Phase 5: Enhanced Filters and Sorting

**Priority:** HIGH  
**Dependencies:** Phase 1, Phase 2  
**Estimated Time:** 2-3 hours  
**Files to Create:** 2  
**Files to Modify:** 3

### 5.1 Create Sort Component

**File:** `src/app/features/products/components/product-sort/product-sort.component.ts`

```typescript
@Component({
  selector: 'app-product-sort',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sort-container">
      <label for="sort-select">Sort by:</label>
      <select 
        id="sort-select"
        [(ngModel)]="selectedSort"
        (change)="onSortChange()"
        class="sort-select">
        <option value="name_asc">Name: A to Z</option>
        <option value="name_desc">Name: Z to A</option>
        <option value="price_asc">Price: Low to High</option>
        <option value="price_desc">Price: High to Low</option>
        <option value="newest">Newest First</option>
      </select>
    </div>
  `,
  styles: [`
    .sort-container {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      
      label {
        font-size: 14px;
        color: #565959;
      }
      
      .sort-select {
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: white;
        font-size: 14px;
        cursor: pointer;
        
        &:focus {
          outline: none;
          border-color: #ff9900;
        }
      }
    }
  `]
})
export class ProductSortComponent implements OnInit {
  @Input() currentSort: SortOption = 'name_asc';
  @Output() sortChange = new EventEmitter<SortOption>();

  selectedSort: SortOption = 'name_asc';

  ngOnInit(): void {
    this.selectedSort = this.currentSort;
  }

  onSortChange(): void {
    this.sortChange.emit(this.selectedSort);
  }
}
```

### 5.2 Update Product Filters Component

**File:** `src/app/features/products/components/product-filters/product-filters.component.ts`

Enhance the filters component to extract categories and brands from loaded products:

```typescript
export class ProductFiltersComponent implements OnInit, OnDestroy {
  @Input() filters!: ProductFilters;
  @Input() activeCount = 0;

  private productStore = inject(ProductStore);
  private destroy$ = new Subject<void>();

  availableCategories = signal<string[]>([]);
  availableBrands = signal<string[]>([]);

  ngOnInit(): void {
    // Subscribe to products and extract unique categories/brands
    effect(() => {
      const products = this.productStore.products();
      
      const categories = [...new Set(products.map(p => p.category))].sort();
      const brands = [...new Set(products.map(p => p.brand))].sort();
      
      this.availableCategories.set(categories);
      this.availableBrands.set(brands);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ... existing methods remain the same ...
}
```

Update the template to use dynamic lists:

```html
<!-- Category Filter -->
<div class="filter-section">
  <h4>Category</h4>
  <div class="filter-options">
    <label class="filter-option">
      <input 
        type="radio" 
        name="category"
        [checked]="filters.category === null"
        (change)="onCategoryChange(null)">
      <span>All Categories</span>
    </label>
    <label class="filter-option" *ngFor="let category of availableCategories()">
      <input 
        type="radio"
        name="category"
        [value]="category"
        [checked]="filters.category === category"
        (change)="onCategoryChange(category)">
      <span>{{ category }}</span>
    </label>
  </div>
</div>

<!-- Brand Filter -->
<div class="filter-section">
  <h4>Brand</h4>
  <div class="filter-options" [class.collapsed]="availableBrands().length > 10 && !showAllBrands">
    <label class="filter-option">
      <input 
        type="radio"
        name="brand"
        [checked]="filters.brand === null"
        (change)="onBrandChange(null)">
      <span>All Brands</span>
    </label>
    <label class="filter-option" *ngFor="let brand of availableBrands() | slice:0:showAllBrands ? availableBrands().length : 10">
      <input 
        type="radio"
        name="brand"
        [value]="brand"
        [checked]="filters.brand === brand"
        (change)="onBrandChange(brand)">
      <span>{{ brand }}</span>
    </label>
  </div>
  <button 
    class="show-more-btn" 
    *ngIf="availableBrands().length > 10"
    (click)="showAllBrands = !showAllBrands">
    {{ showAllBrands ? 'Show Less' : `Show More (${availableBrands().length - 10})` }}
  </button>
</div>
```

Add to styles:

```scss
.show-more-btn {
  background: none;
  border: none;
  color: #007185;
  font-size: 14px;
  cursor: pointer;
  padding: 8px 0;
  
  &:hover {
    color: #c7511f;
    text-decoration: underline;
  }
}

.filter-options.collapsed {
  max-height: 300px;
  overflow: hidden;
}
```

### 5.3 Update Product List Component

**File:** `src/app/features/products/product-list/product-list.component.ts`

Add sorting functionality:

```typescript
export class ProductListComponent implements OnInit, OnDestroy {
  // ... existing code ...

  sortBy = this.productStore.sortBy;

  onSortChange(sortOption: SortOption): void {
    this.productStore.setSortBy(sortOption);
  }
}
```

Update template to include sort component:

```html
<!-- Add after page-header -->
<div class="toolbar" *ngIf="products().length > 0">
  <app-product-sort 
    [currentSort]="sortBy()"
    (sortChange)="onSortChange($event)">
  </app-product-sort>
</div>
```

### Phase 5 Testing Checklist

- [ ] Sort dropdown displays on product list
- [ ] Sorting by name (A-Z, Z-A) works
- [ ] Sorting by price (low-high, high-low) works
- [ ] Sorting by newest works
- [ ] Filters dynamically show available categories/brands
- [ ] "Show More" button appears when many brands
- [ ] Filter application updates product list
- [ ] Clear All button resets all filters

---

## Phase 6: Quick View Modal and Related Products

**Priority:** HIGH  
**Dependencies:** Phase 1, Phase 2, Phase 4  
**Estimated Time:** 3-4 hours  
**Files to Create:** 3  
**Files to Modify:** 3

### 6.1 Create Quick View Modal Component

**File:** `src/app/features/products/components/quick-view-modal/quick-view-modal.component.ts`

```typescript
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
```

**Template:** `quick-view-modal.component.html`

```html
<div class="modal-overlay" *ngIf="product" (click)="onBackdropClick($event)">
  <div class="modal-content">
    <button class="close-btn" (click)="onClose()">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6 6 18"></path>
        <path d="m6 6 12 12"></path>
      </svg>
    </button>

    <div class="modal-body">
      <!-- Left: Image Gallery -->
      <div class="gallery-section">
        <app-image-gallery [images]="product.images"></app-image-gallery>
      </div>

      <!-- Right: Product Info -->
      <div class="info-section">
        <h2 class="product-name">{{ product.name }}</h2>
        
        <div class="brand">{{ product.brand }}</div>
        
        <div class="price-section">
          <span class="final-price">{{ product.final_price | currency:product.currency }}</span>
          <span class="initial-price" *ngIf="hasDiscount">
            {{ product.initial_price | currency:product.currency }}
          </span>
          <span class="discount-badge" *ngIf="hasDiscount">-{{ discountPercentage }}%</span>
        </div>

        <div class="stock-status" [class.in-stock]="product.in_stock">
          <span class="status-dot"></span>
          {{ product.in_stock ? 'In Stock' : 'Out of Stock' }}
        </div>

        <p class="description" *ngIf="product.description">
          {{ product.description | slice:0:200 }}{{ product.description.length > 200 ? '...' : '' }}
        </p>

        <div class="actions">
          <button 
            class="btn-add-cart"
            [disabled]="!product.in_stock">
            {{ product.in_stock ? 'Add to Cart' : 'Out of Stock' }}
          </button>
          <button class="btn-view-details" (click)="onViewDetails()">
            View Full Details
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
```

**Styles:** `quick-view-modal.component.scss`

```scss
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: white;
  border-radius: 8px;
  max-width: 900px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  position: relative;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  background: white;
  border: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  
  &:hover {
    background: #f7f7f7;
  }
}

.modal-body {
  display: flex;
  overflow-y: auto;
  max-height: 90vh;
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
}

.gallery-section {
  width: 50%;
  padding: 24px;
  
  @media (max-width: 768px) {
    width: 100%;
  }
}

.info-section {
  flex: 1;
  padding: 24px;
  border-left: 1px solid #ddd;
  
  @media (max-width: 768px) {
    border-left: none;
    border-top: 1px solid #ddd;
  }
}

.product-name {
  font-size: 24px;
  font-weight: 600;
  color: #131921;
  margin-bottom: 8px;
}

.brand {
  color: #565959;
  font-size: 14px;
  margin-bottom: 16px;
}

.price-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  
  .final-price {
    font-size: 28px;
    font-weight: 600;
    color: #b12704;
  }
  
  .initial-price {
    font-size: 16px;
    color: #565959;
    text-decoration: line-through;
  }
  
  .discount-badge {
    background: #b12704;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
  }
}

.stock-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #b12704;
  margin-bottom: 16px;
  
  &.in-stock {
    color: #007600;
  }
  
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
  }
}

.description {
  color: #0f1111;
  line-height: 1.5;
  margin-bottom: 20px;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  
  .btn-add-cart {
    padding: 14px;
    background: #ff9900;
    color: #131921;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    
    &:hover:not(:disabled) {
      background: #e88a00;
    }
    
    &:disabled {
      background: #ddd;
      color: #565959;
      cursor: not-allowed;
    }
  }
  
  .btn-view-details {
    padding: 14px;
    background: white;
    color: #131921;
    border: 1px solid #131921;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    
    &:hover {
      background: #f7f7f7;
    }
  }
}
```

### 6.2 Create Related Products Component

**File:** `src/app/features/products/components/related-products/related-products.component.ts`

```typescript
@Component({
  selector: 'app-related-products',
  standalone: true,
  imports: [CommonModule, RouterModule, ProductCardComponent],
  template: `
    <section class="related-products" *ngIf="relatedProducts().length > 0">
      <h2>Related Products</h2>
      <div class="products-grid">
        <app-product-card 
          *ngFor="let product of relatedProducts(); trackBy: trackByProductId"
          [product]="product"
          (viewDetails)="onProductClick($event)">
        </app-product-card>
      </div>
    </section>
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
  `]
})
export class RelatedProductsComponent implements OnInit {
  @Input() currentProduct!: Product;
  
  private productStore = inject(ProductStore);
  private router = inject(Router);
  
  relatedProducts = signal<Product[]>([]);

  ngOnInit(): void {
    // Get related products based on category or brand
    const allProducts = this.productStore.products();
    
    const related = allProducts
      .filter(p => 
        p.id !== this.currentProduct.id && 
        (p.category === this.currentProduct.category || 
         p.brand === this.currentProduct.brand)
      )
      .slice(0, 4); // Show max 4 related products
    
    this.relatedProducts.set(related);
    
    // If no products in store, load some
    if (allProducts.length === 0) {
      this.loadRelatedProducts();
    }
  }

  private async loadRelatedProducts(): Promise<void> {
    await this.productStore.loadProducts(20, 0);
    
    const allProducts = this.productStore.products();
    const related = allProducts
      .filter(p => 
        p.id !== this.currentProduct.id && 
        (p.category === this.currentProduct.category || 
         p.brand === this.currentProduct.brand)
      )
      .slice(0, 4);
    
    this.relatedProducts.set(related);
  }

  onProductClick(product: Product): void {
    this.router.navigate(['/products', product.id]);
  }

  trackByProductId(index: number, product: Product): number {
    return product.id;
  }
}
```

### 6.3 Update Product List Component

**File:** `src/app/features/products/product-list/product-list.component.ts`

Add Quick View functionality:

```typescript
export class ProductListComponent implements OnInit, OnDestroy {
  // ... existing code ...

  quickViewProduct: Product | null = null;

  onQuickView(product: Product): void {
    this.quickViewProduct = product;
  }

  onCloseQuickView(): void {
    this.quickViewProduct = null;
  }

  onViewDetailsFromQuickView(product: Product): void {
    this.router.navigate(['/products', product.id]);
  }
}
```

Update template:

```html
<!-- Add at the end of template -->
<app-quick-view-modal
  [product]="quickViewProduct"
  (close)="onCloseQuickView()"
  (viewDetails)="onViewDetailsFromQuickView($event)">
</app-quick-view-modal>
```

### 6.4 Update Product Detail Component

**File:** `src/app/features/products/product-detail/product-detail.component.ts`

Add to imports:
```typescript
import { RelatedProductsComponent } from '../components/related-products/related-products.component';
```

Add to component imports array.

Update template to include related products:

```html
<!-- Add at the end of product-content div -->
<app-related-products 
  *ngIf="product()"
  [currentProduct]="product()!">
</app-related-products>
```

### Phase 6 Testing Checklist

- [ ] Quick View button appears on product card hover
- [ ] Quick View modal opens with product details
- [ ] Modal closes on backdrop click or close button
- [ ] View Full Details button navigates to product page
- [ ] Related Products section displays on product detail
- [ ] Related products are from same category or brand
- [ ] Clicking related product navigates to that product
- [ ] Maximum 4 related products shown

---

## Final Integration Checklist

### Routes Configuration

Ensure `src/app/app.routes.ts` contains:

```typescript
export const routes: Routes = [
  {
    path: '',
    component: Layout,
    children: [
      { path: '', redirectTo: '/home', pathMatch: 'full' },
      { 
        path: 'home', 
        loadComponent: () => import('./features/home/home.component').then(m => m.Home),
        title: 'Home - GoShopping'
      },
      { 
        path: 'profile', 
        loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent),
        canActivate: [AuthGuard],
        title: 'Profile - GoShopping'
      },
      {
        path: 'products',
        loadComponent: () => import('./features/products/product-list/product-list.component').then(m => m.ProductListComponent),
        title: 'Products - GoShopping'
      },
      {
        path: 'products/:id',
        loadComponent: () => import('./features/products/product-detail/product-detail.component').then(m => m.ProductDetailComponent),
        title: 'Product Details - GoShopping'
      }
    ]
  }
];
```

### Assets Required

Create placeholder image:
- `src/assets/placeholder-product.jpg` - Product placeholder image

### Environment Variables

Ensure `src/environments/environment.ts` has:
```typescript
export const environment = {
  production: false,
  apiUrl: 'https://pocstore.local/api/v1',  // Product API base URL
  // ... existing config
};
```

### Testing Summary

- [ ] All routes resolve correctly
- [ ] Product list loads and displays products
- [ ] Pagination works (Load More)
- [ ] Search works with debouncing
- [ ] Product detail page loads
- [ ] Image gallery works
- [ ] Filters apply correctly
- [ ] Sorting works
- [ ] Quick View modal works
- [ ] Related products display
- [ ] Breadcrumbs update correctly
- [ ] All error states work
- [ ] All loading states work
- [ ] Responsive design works on mobile/tablet/desktop
- [ ] Accessibility features work (keyboard navigation, ARIA labels)

---

## Appendix: API Endpoint Reference

### Base URL
`https://pocstore.local/api/v1`

### Endpoints Used

| Endpoint | Method | Usage |
|----------|--------|-------|
| `/products` | GET | List all products with pagination |
| `/products/{id}` | GET | Get single product details |
| `/products/search` | GET | Search products by query |
| `/products/category/{category}` | GET | Filter by category |
| `/products/brand/{brand}` | GET | Filter by brand |
| `/products/in-stock` | GET | Filter in-stock only |
| `/products/{id}/images/{imageName}` | GET | Direct image streaming |

### Query Parameters

All list endpoints support:
- `limit`: Number of items per page (default: 50, max: 1000)
- `offset`: Number of items to skip

Search endpoint supports:
- `q`: Search query string

---

## Notes for Implementers

1. **Follow Existing Patterns**: All code should match the existing CustomerService, CustomerStore, and component patterns in the codebase.

2. **Error Handling**: Always use ErrorHandlerService and NotificationService for consistent error display.

3. **Image Handling**: Use the direct image endpoint pattern: `/api/v1/products/{id}/images/{imageName}`

4. **Signals**: Use Angular signals for all reactive state management.

5. **Standalone Components**: All components must be standalone with explicit imports.

6. **Lazy Loading**: All feature routes should use loadComponent for lazy loading.

7. **Testing**: Each phase has its own testing checklist - complete all items before moving to next phase.

8. **Styling**: Use Amazon-inspired color scheme (#131921 for text, #ff9900 for accents).

9. **Responsive Design**: Test all components at mobile (320px), tablet (768px), and desktop (1200px+) widths.

10. **Accessibility**: Include proper ARIA labels, keyboard navigation, and alt text for images.

---

**End of Implementation Plan**
