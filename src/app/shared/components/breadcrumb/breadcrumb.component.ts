import { RouterLink } from '@angular/router';
import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { BreadcrumbItem } from '../../../models/product';

@Component({
  selector: 'app-breadcrumb',
  imports: [RouterLink],
  template: `
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <ol class="breadcrumb-list">
        @for (item of items(); track item; let last = $last) {
          <li class="breadcrumb-item">
            @if (!last && item.url) {
              <a
                [routerLink]="item.url"
                [queryParams]="item.queryParams"
                class="breadcrumb-link">
                @if (item.label === 'Home') {
                  <span class="home-icon">🏠</span>
                }
                @if (item.label !== 'Home') {
                  <span>{{ item.label }}</span>
                }
              </a>
            }
            @if (last || !item.url) {
              <span class="breadcrumb-current" aria-current="page">
                {{ item.label }}
              </span>
            }
            @if (!last) {
              <span class="separator">›</span>
            }
          </li>
        }
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
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreadcrumbComponent {
  readonly items = input<BreadcrumbItem[]>([]);
}
