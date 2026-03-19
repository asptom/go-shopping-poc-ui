import { Component, input, output, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SortOption } from '../../../../../models/product';

@Component({
  selector: 'app-product-sort',
  imports: [FormsModule],
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
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductSortComponent implements OnInit {
  readonly currentSort = input<SortOption>('name_asc');
  readonly sortChange = output<SortOption>();

  selectedSort: SortOption = 'name_asc';

  ngOnInit(): void {
    this.selectedSort = this.currentSort();
  }

  onSortChange(): void {
    this.sortChange.emit(this.selectedSort);
  }
}
