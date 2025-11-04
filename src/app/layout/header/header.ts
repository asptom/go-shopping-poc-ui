import { Component, inject, signal } from '@angular/core';
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

  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  private async generateCodeChallenge(codeVerifier: string): Promise<string> {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
    return btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  private generateState(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  toggleAccountDropdown(): void {
    console.log('Header: Toggle account dropdown');
    this.accountDropdownOpen.set(!this.accountDropdownOpen());
    console.log('Dropdown open:', this.accountDropdownOpen());
  }
}
