import { Component, inject } from '@angular/core';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-header',
  imports: [],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  private readonly authService = inject(AuthService);

  readonly isAuthenticated = this.authService.isAuthenticated;
  readonly userFirstName = this.authService.userFirstName;

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
}
