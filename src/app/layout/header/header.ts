import { Component, inject, signal, ChangeDetectionStrategy, OnDestroy, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Header implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);

  readonly isAuthenticated = this.authService.isAuthenticated;
  readonly userFirstName = this.authService.userFirstName;
  readonly accountDropdownOpen = signal(false);
  
  searchQuery = '';
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor() {
    // Debug authentication state changes
    console.log('Header component initialized');
    console.log('Initial auth state:', this.isAuthenticated());
    console.log('Initial user name:', this.userFirstName());
  }

  ngOnInit(): void {
    // Setup search debounce - ensure navigation runs in Angular zone
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      // Run navigation inside NgZone to ensure proper context
      this.ngZone.run(() => {
        if (query.length >= 2) {
          this.router.navigate(['/products'], {
            queryParams: { q: query }
          });
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

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchSubject.next(value);
  }

  onSearchSubmit(event: Event): void {
    event.preventDefault();
    if (this.searchQuery.length >= 2) {
      this.router.navigate(['/products'], {
        queryParams: { q: this.searchQuery }
      });
    }
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchSubject.next('');
    this.ngZone.run(() => {
      this.router.navigate(['/products']);
    });
  }

  onLogin(): void {
    console.log('Header: Login clicked');
    this.authService.login();
  }

  onLogout(): void {
    console.log('Header: Logout clicked');
    this.authService.logout();
  }

  onRegister(): void {
    console.log('Header: Register clicked');
    this.authService.login();
  }

  toggleAccountDropdown(): void {
    console.log('Header: Toggle account dropdown');
    this.accountDropdownOpen.set(!this.accountDropdownOpen());
    console.log('Dropdown open:', this.accountDropdownOpen());
  }
}
