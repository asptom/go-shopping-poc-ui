import { Injectable, signal, computed, inject, untracked } from '@angular/core';
import { ProductService } from '../../services/product.service';
import { Product, ProductFilters, SortOption } from '../../models/product';
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
  providedIn: 'root',
})
export class ProductStore {
  private readonly productService = inject(ProductService);
  private readonly notificationService = inject(NotificationService);
  private readonly errorHandler = inject(ErrorHandlerService);

  private readonly state = signal<ProductState>({
    products: [],
    selectedProduct: null,
    loading: false,
    error: null,
    pagination: { limit: 20, offset: 0, total: 0, hasMore: false },
    filters: { category: null, brand: null, searchQuery: null, inStockOnly: false },
    sortBy: 'name_asc',
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
    return [f.category, f.brand, f.searchQuery, f.inStockOnly].filter(Boolean).length;
  });

  readonly currentCategory = computed(() => this.state().filters.category);
  readonly currentBrand = computed(() => this.state().filters.brand);
  readonly searchQuery = computed(() => this.state().filters.searchQuery);
  readonly isFiltered = computed(() => this.activeFiltersCount() > 0);

  readonly sortedProducts = computed(() => {
    const products = untracked(() => this.state().products);
    const sortBy = this.state().sortBy;
    const sorted = [...products];
    switch (sortBy) {
      case 'name_asc':   return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'name_desc':  return sorted.sort((a, b) => b.name.localeCompare(a.name));
      case 'price_asc':  return sorted.sort((a, b) => a.final_price - b.final_price);
      case 'price_desc': return sorted.sort((a, b) => b.final_price - a.final_price);
      case 'newest':     return sorted.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      default: return sorted;
    }
  });

  readonly categories = computed(() =>
    [...new Set(this.state().products.map(p => p.category).filter(Boolean))].sort()
  );

  // Actions
  async loadProducts(limit = 20, offset = 0): Promise<void> {
    this.setLoading(true);
    this.setError(null);
    try {
      const response = await firstValueFrom(this.productService.getAllProducts(limit, offset));
      const productsWithImages = await this.fetchImagesForProducts(response.products);
      this.state.update(s => ({
        ...s,
        products: offset === 0 ? productsWithImages : [...s.products, ...productsWithImages],
        pagination: {
          limit: response.limit,
          offset: response.offset,
          total: response.count,
          hasMore: response.products.length === limit,
        },
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
      const product = await firstValueFrom(this.productService.getProductById(id));
      try {
        const imageResponse = await firstValueFrom(this.productService.getProductImages(product.id));
        product.images = imageResponse.images;
      } catch {
        product.images = [];
      }
      this.state.update(s => ({ ...s, selectedProduct: product }));
    } catch (error) {
      this.handleError(error, 'Failed to load product details');
    } finally {
      this.setLoading(false);
    }
  }

  async searchProducts(query: string, limit = 20, offset = 0): Promise<void> {
    this.setLoading(true);
    this.setError(null);
    try {
      const response = await firstValueFrom(this.productService.searchProducts(query, limit, offset));
      const productsWithImages = await this.fetchImagesForProducts(response.products);
      this.state.update(s => ({
        ...s,
        products: offset === 0 ? productsWithImages : [...s.products, ...productsWithImages],
        filters: { ...s.filters, searchQuery: query },
        pagination: {
          limit: response.limit,
          offset: response.offset,
          total: response.count,
          hasMore: response.products.length === limit,
        },
      }));
    } catch (error) {
      this.handleError(error, 'Search failed');
    } finally {
      this.setLoading(false);
    }
  }

  async filterByCategory(category: string | null): Promise<void> {
    this.state.update(s => ({ ...s, filters: { ...s.filters, category } }));
    await (category ? this.loadProductsByCategory(category) : this.loadProducts());
  }

  async loadProductsByCategory(category: string, limit = 20, offset = 0): Promise<void> {
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
          hasMore: response.products.length === limit,
        },
      }));
    } catch (error) {
      this.handleError(error, 'Failed to load products by category');
    } finally {
      this.setLoading(false);
    }
  }

  async filterByBrand(brand: string | null): Promise<void> {
    this.state.update(s => ({ ...s, filters: { ...s.filters, brand } }));
    await (brand ? this.loadProductsByBrand(brand) : this.loadProducts());
  }

  async loadProductsByBrand(brand: string, limit = 20, offset = 0): Promise<void> {
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
          hasMore: response.products.length === limit,
        },
      }));
    } catch (error) {
      this.handleError(error, 'Failed to load products by brand');
    } finally {
      this.setLoading(false);
    }
  }

  async filterByStock(inStockOnly: boolean): Promise<void> {
    this.state.update(s => ({ ...s, filters: { ...s.filters, inStockOnly } }));
    await (inStockOnly ? this.loadInStockProducts() : this.loadProducts());
  }

  async loadInStockProducts(limit = 20, offset = 0): Promise<void> {
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
          hasMore: response.products.length === limit,
        },
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
      filters: { category: null, brand: null, searchQuery: null, inStockOnly: false },
    }));
    this.loadProducts();
  }

  setSelectedProduct(product: Product | null): void {
    this.state.update(s => ({ ...s, selectedProduct: product }));
  }

  async loadMore(): Promise<void> {
    const { offset, limit } = this.state().pagination;
    const { searchQuery, category, brand, inStockOnly } = this.state().filters;
    const newOffset = offset + limit;

    if (searchQuery) await this.searchProducts(searchQuery, limit, newOffset);
    else if (category) await this.loadProductsByCategory(category, limit, newOffset);
    else if (brand) await this.loadProductsByBrand(brand, limit, newOffset);
    else if (inStockOnly) await this.loadInStockProducts(limit, newOffset);
    else await this.loadProducts(limit, newOffset);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async fetchImagesForProducts(products: Product[]): Promise<Product[]> {
    await Promise.all(
      products.map(async product => {
        try {
          const response = await firstValueFrom(
            this.productService.getProductImages(product.id)
          );
          product.images = response.images;
        } catch {
          product.images = [];
        }
      })
    );
    return products;
  }

  private setLoading(loading: boolean): void {
    this.state.update(s => ({ ...s, loading }));
  }

  private setError(error: string | null): void {
    this.state.update(s => ({ ...s, error }));
  }

  private handleError(error: unknown, defaultMessage: string): void {
    const appError = this.errorHandler.handleError(error);
    this.setError(appError.message || defaultMessage);
    this.notificationService.showError(appError.message || defaultMessage);
  }
}
