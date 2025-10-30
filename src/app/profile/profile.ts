import { Component, inject } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { AuthService, UserData } from '../auth/auth.service';

@Component({
  selector: 'app-profile',
  imports: [TitleCasePipe],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile {
  private readonly authService = inject(AuthService);

  readonly isAuthenticated = this.authService.isAuthenticated;
  readonly userData = this.authService.userData;

  // Helper method to get user data keys for display
  getUserDataKeys(): string[] {
    const data = this.userData();
    return data ? Object.keys(data) : [];
  }

  // Helper method to check if value is an array
  isArray(value: any): boolean {
    return Array.isArray(value);
  }
}