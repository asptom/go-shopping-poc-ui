import { Component, inject, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth/auth.service';
import { CustomerService } from '../services/customer.service';
import { Customer } from '../models/customer';

@Component({
  selector: 'app-profile',
  imports: [FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile {
  private readonly authService = inject(AuthService);
  private readonly customerService = inject(CustomerService);

  readonly isAuthenticated = this.authService.isAuthenticated;
  readonly userData = this.authService.userData;

  readonly customer = signal<Customer | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const user = this.userData();
      if (user?.email && this.isAuthenticated()) {
        this.loadCustomer(user.email);
      }
    });
  }

  loadCustomer(email: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.customerService.getCustomer(email).subscribe({
      next: (cust) => {
        if (cust) {
          this.customer.set(cust);
        } else {
          // Create new customer from Keycloak data
          const user = this.userData();
          if (user) {
            const newCust: Customer = {
              customer_id: '',
              user_name: user.preferred_username || user.email || '',
              email: user.email,
              first_name: user.given_name,
              last_name: user.family_name,
              phone: '',
              addresses: [],
              credit_cards: [],
              customer_statuses: []
            };
            this.customer.set(newCust);
          }
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load customer data. Please try again.');
        this.loading.set(false);
        console.error('Error loading customer:', err);
      }
    });
  }

  // Helper method to get user data keys for display
  getUserDataKeys(): string[] {
    const data = this.userData();
    return data ? Object.keys(data) : [];
  }

  // Helper method to check if value is an array
  isArray(value: any): boolean {
    return Array.isArray(value);
  }

  maskCardNumber(cardNumber: string): string {
    if (!cardNumber || cardNumber.length < 4) return cardNumber;
    const last4 = cardNumber.slice(-4);
    return '**** **** **** ' + last4;
  }

  saveProfile(): void {
    const cust = this.customer();
    if (!cust) return;

    this.loading.set(true);
    this.error.set(null);

    if (!cust.customer_id) {
      // Create new customer
      this.customerService.createCustomer(cust).subscribe({
        next: (created) => {
          this.customer.set(created);
          this.loading.set(false);
          // TODO: Show success message
        },
        error: (err) => {
          this.error.set('Failed to save profile. Please try again.');
          this.loading.set(false);
          console.error('Error saving profile:', err);
        }
      });
    } else {
      // Update existing customer - placeholder
      this.loading.set(false);
      console.log('Update customer not implemented yet');
      // TODO: Implement update API
    }
  }
}