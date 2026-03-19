import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
  OnDestroy,
  OnInit,
  NgZone,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { CartIconComponent } from '../../shared/components/cart-icon/cart-icon.component';
import { ProductStore } from '../../store/product/product.store';

@Component({
  selector: 'app-header',
  imports: [FormsModule, CartIconComponent],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);
  private readonly productStore = inject(ProductStore);

  readonly isAuthenticated = this.authService.isAuthenticated;
  readonly userFirstName = this.authService.userFirstName;
  readonly accountDropdownOpen = signal(false);
  readonly categories = this.productStore.categories;
  selectedCategory = signal<string>('All');

  searchQuery = '';
  private readonly searchSubject = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.loadProductsIfNeeded();

    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(query => {
        this.ngZone.run(() => {
          if (query.length >= 2) {
            this.router.navigate(['/products'], { queryParams: { q: query } });
          } else if (query.length === 0) {
            this.router.navigate(['/products']);
          }
        });
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async loadProductsIfNeeded(): Promise<void> {
    if (this.productStore.products().length === 0) {
      await this.productStore.loadProducts(50, 0);
    }
  }

  onCategoryChange(category: string): void {
    this.selectedCategory.set(category);
    if (category === 'All') {
      this.router.navigate(['/products']);
    } else {
      this.router.navigate(['/products'], { queryParams: { category } });
    }
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchSubject.next(value);
  }

  onSearchSubmit(event: Event): void {
    event.preventDefault();
    if (this.searchQuery.length >= 2) {
      this.router.navigate(['/products'], { queryParams: { q: this.searchQuery } });
    }
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchSubject.next('');
    this.ngZone.run(() => this.router.navigate(['/products']));
  }

  onLogin(): void {
    this.authService.login();
  }

  onLogout(): void {
    this.authService.logout();
  }

  onRegister(): void {
    this.authService.login();
  }

  goToOrderHistory(): void {
    this.router.navigate(['/profile/orders']);
  }

  toggleAccountDropdown(): void {
    this.accountDropdownOpen.set(!this.accountDropdownOpen());
  }
}
