import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BreadcrumbItem } from '../../../models/product';

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
