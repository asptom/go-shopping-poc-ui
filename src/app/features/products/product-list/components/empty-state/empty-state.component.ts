import { Component, Input, Output, EventEmitter } from '@angular/core';

import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [RouterModule],
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
      @if (isFiltered) {
        <div class="actions">
          <button class="btn-clear" (click)="clearFilters.emit()">
            Clear Filters
          </button>
          <a routerLink="/products" class="btn-browse">Browse All Products</a>
        </div>
      }
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
