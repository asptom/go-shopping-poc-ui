import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Header {
  private readonly authService = inject(AuthService);

  readonly isAuthenticated = this.authService.isAuthenticated;
  readonly userFirstName = this.authService.userFirstName;
  readonly accountDropdownOpen = signal(false);

  constructor() {
    // Debug authentication state changes
    console.log('Header component initialized');
    console.log('Initial auth state:', this.isAuthenticated());
    console.log('Initial user name:', this.userFirstName());
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
