import { SlicePipe } from '@angular/common';
import { Component, inject, input, OnDestroy, signal, effect, EffectRef, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProductFilters } from '../../../../../models/product';
import { ProductStore } from '../../../../../store/product/product.store';

@Component({
  selector: 'app-product-filters',
  imports: [SlicePipe, FormsModule],
  templateUrl: './product-filters.component.html',
  styleUrls: ['./product-filters.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFiltersComponent implements OnDestroy {
  readonly filters = input.required<ProductFilters>();
  readonly activeCount = input<number>(0);

  private readonly productStore = inject(ProductStore);
  private readonly effectRef: EffectRef;

  readonly availableCategories = signal<string[]>([]);
  readonly availableBrands = signal<string[]>([]);
  showAllBrands = false;

  constructor() {
    this.effectRef = effect(() => {
      const products = this.productStore.products();
      this.availableCategories.set([...new Set(products.map(p => p.category))].sort());
      this.availableBrands.set([...new Set(products.map(p => p.brand))].sort());
    });
  }

  ngOnDestroy(): void {
    this.effectRef.destroy();
  }

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
