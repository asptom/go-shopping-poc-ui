import { Component, Input, inject, OnDestroy, signal, effect, EffectRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { ProductFilters } from '../../../../../models/product';
import { ProductStore } from '../../../../../store/product/product.store';

@Component({
  selector: 'app-product-filters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-filters.component.html',
  styleUrls: ['./product-filters.component.scss']
})
export class ProductFiltersComponent implements OnDestroy {
  @Input() filters!: ProductFilters;
  @Input() activeCount = 0;

  private productStore = inject(ProductStore);
  private destroy$ = new Subject<void>();
  private effectRef?: EffectRef;

  availableCategories = signal<string[]>([]);
  availableBrands = signal<string[]>([]);
  showAllBrands = false;

  constructor() {
    // Create effect in constructor to ensure proper injection context
    this.effectRef = effect(() => {
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
    // Explicitly clean up the effect
    this.effectRef?.destroy();
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
