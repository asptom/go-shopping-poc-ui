import { Component, Input, Output, EventEmitter } from '@angular/core';

import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-product-skeleton',
  standalone: true,
  imports: [],
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
