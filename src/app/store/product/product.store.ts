import { Injectable, signal, computed, inject, untracked } from '@angular/core';
import { ProductService } from '../../services/product.service';
import { Product, ProductFilters, ProductImageListResponse, SortOption } from '../../models/product';
import { NotificationService } from '../../core/notification/notification.service';
import { ErrorHandlerService } from '../../core/error/error-handler.service';
import { firstValueFrom } from 'rxjs';

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

@Injectable({
  providedIn: 'root'
})
export class ProductStore {
  private readonly productService = inject(ProductService);
  private readonly notificationService = inject(NotificationService);
  private readonly errorHandler = inject(ErrorHandlerService);

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

  // Public computed selectors - will be initialized in constructor
  readonly products!: ReturnType<typeof computed<Product[]>>;
  readonly selectedProduct!: ReturnType<typeof computed<Product | null>>;
  readonly loading!: ReturnType<typeof computed<boolean>>;
  readonly error!: ReturnType<typeof computed<string | null>>;
  readonly pagination!: ReturnType<typeof computed<ProductState['pagination']>>;
  readonly filters!: ReturnType<typeof computed<ProductFilters>>;
  readonly sortBy!: ReturnType<typeof computed<SortOption>>;
  readonly hasMoreProducts!: ReturnType<typeof computed<boolean>>;
  readonly activeFiltersCount!: ReturnType<typeof computed<number>>;
  readonly currentCategory!: ReturnType<typeof computed<string | null>>;
  readonly currentBrand!: ReturnType<typeof computed<string | null>>;
  readonly searchQuery!: ReturnType<typeof computed<string | null>>;
  readonly isFiltered!: ReturnType<typeof computed<boolean>>;
  readonly sortedProducts!: ReturnType<typeof computed<Product[]>>;
  readonly categories!: ReturnType<typeof computed<string[]>>;

  constructor() {
    // Create all computed signals in constructor to ensure proper injection context
    this.products = computed(() => this.state().products);
    this.selectedProduct = computed(() => this.state().selectedProduct);
    this.loading = computed(() => this.state().loading);
    this.error = computed(() => this.state().error);
    this.pagination = computed(() => this.state().pagination);
    this.filters = computed(() => this.state().filters);
    this.sortBy = computed(() => this.state().sortBy);
    this.hasMoreProducts = computed(() => this.state().pagination.hasMore);
    this.activeFiltersCount = computed(() => {
      const f = this.state().filters;
      let count = 0;
      if (f.category) count++;
      if (f.brand) count++;
      if (f.searchQuery) count++;
      if (f.inStockOnly) count++;
      return count;
    });
    this.currentCategory = computed(() => this.state().filters.category);
    this.currentBrand = computed(() => this.state().filters.brand);
    this.searchQuery = computed(() => this.state().filters.searchQuery);
    this.isFiltered = computed(() => this.activeFiltersCount() > 0);
    
    // Sorted products (client-side sorting)
    this.sortedProducts = computed(() => {
      const products = untracked(() => this.state().products);
      const sortBy = this.state().sortBy;

      switch (sortBy) {
        case 'name_asc':
          return [...products].sort((a, b) => a.name.localeCompare(b.name));
        case 'name_desc':
          return [...products].sort((a, b) => b.name.localeCompare(a.name));
        case 'price_asc':
          return [...products].sort((a, b) => a.final_price - b.final_price);
        case 'price_desc':
          return [...products].sort((a, b) => b.final_price - a.final_price);
        case 'newest':
          return [...products].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        default:
          return [...products];
      }
    });

    // Unique categories derived from loaded products
    this.categories = computed(() => {
      const products = this.state().products;
      const uniqueCategories = new Set<string>();
      products.forEach(product => {
        if (product.category) {
          uniqueCategories.add(product.category);
        }
      });
      return Array.from(uniqueCategories).sort();
    });
  }

  // Actions
  async loadProducts(limit: number = 20, offset: number = 0): Promise<void> {
    this.setLoading(true);
    this.setError(null);

    try {
      const response = await firstValueFrom(
        this.productService.getAllProducts(limit, offset)
      );

      const productsWithImages = await this.fetchImagesForProducts(response.products);

      this.state.update(s => ({
        ...s,
        products: offset === 0 ? productsWithImages : [...s.products, ...productsWithImages],
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

      try {
        const imageResponse = await firstValueFrom(
          this.productService.getProductImages(product.id)
        );
        product.images = imageResponse.images;
      } catch (error) {
        product.images = [];
      }

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

      const productsWithImages = await this.fetchImagesForProducts(response.products);

      this.state.update(s => ({
        ...s,
        products: offset === 0 ? productsWithImages : [...s.products, ...productsWithImages],
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

  private async fetchImagesForProducts(products: Product[]): Promise<Product[]> {
    const productsWithImages: Product[] = [];

    for (const product of products) {
      try {
        const response = await firstValueFrom(
          this.productService.getProductImages(product.id)
        );
        product.images = response.images;
      } catch (error) {
        product.images = [];
      }
      productsWithImages.push(product);
    }

    return productsWithImages;
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

      const productsWithImages = await this.fetchImagesForProducts(response.products);

      this.state.update(s => ({
        ...s,
        products: offset === 0 ? productsWithImages : [...s.products, ...productsWithImages],
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

      const productsWithImages = await this.fetchImagesForProducts(response.products);

      this.state.update(s => ({
        ...s,
        products: offset === 0 ? productsWithImages : [...s.products, ...productsWithImages],
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

      const productsWithImages = await this.fetchImagesForProducts(response.products);

      this.state.update(s => ({
        ...s,
        products: offset === 0 ? productsWithImages : [...s.products, ...productsWithImages],
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
    const filters = this.state().filters;

    if (filters.searchQuery) {
      await this.searchProducts(filters.searchQuery!, limit, newOffset);
    } else if (filters.category) {
      await this.loadProductsByCategory(filters.category!, limit, newOffset);
    } else if (filters.brand) {
      await this.loadProductsByBrand(filters.brand!, limit, newOffset);
    } else if (filters.inStockOnly) {
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
