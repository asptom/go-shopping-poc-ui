import { Component, inject, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth/auth.service';
import { CustomerService } from '../services/customer.service';
import { Customer, Address, CreditCard } from '../models/customer';
import { Modal } from './modal';

@Component({
  selector: 'app-profile',
  imports: [FormsModule, Modal],
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
  readonly success = signal<string | null>(null);

  // Edit mode states
  readonly editingProfile = signal(false);
  readonly editingAddressIndex = signal<number | null>(null);
  readonly editingCardIndex = signal<number | null>(null);
  readonly addingAddress = signal(false);
  readonly addingCard = signal(false);

  // New address form data
  newAddressType = 'shipping';
  newAddressFirstName = '';
  newAddressLastName = '';
  newAddress1 = '';
  newAddress2 = '';
  newAddressCity = '';
  newAddressState = '';
  newAddressZip = '';

  // New card form data
  newCardType = 'visa';
  newCardNumber = '';
  newCardHolderName = '';
  newCardExpires = '';
  newCardCvv = '';

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
          this.loading.set(false);
        } else {
          // Create new customer from Keycloak data and save to backend
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

            // Save the new customer to the backend
            this.customerService.createCustomer(newCust).subscribe({
              next: (savedCustomer) => {
                this.customer.set(savedCustomer);
                this.loading.set(false);
              },
              error: (createErr) => {
                console.error('Failed to create new customer:', createErr);
                this.error.set('Failed to create customer profile. Please try again.');
                this.loading.set(false);
              }
            });
          } else {
            this.error.set('Unable to load user data from authentication.');
            this.loading.set(false);
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

  maskCardNumber(cardNumber: string | undefined): string {
    if (!cardNumber || cardNumber.length < 4) return cardNumber || '';
    const last4 = cardNumber.slice(-4);
    return '**** **** **** ' + last4;
  }

  // Address management methods
  editAddress(index: number): void {
    this.editingAddressIndex.set(index);
  }

  cancelEditAddress(): void {
    this.editingAddressIndex.set(null);
  }

  saveAddress(index: number): void {
    const cust = this.customer();
    if (!cust || !cust.addresses) return;

    const address = cust.addresses[index];
    if (!address || !address.address_id) return;

    // Validate required fields
    if (!address.first_name?.trim() || !address.last_name?.trim() ||
        !address.address_1?.trim() || !address.city?.trim() ||
        !address.state?.trim() || !address.zip?.trim()) {
      this.error.set('Please fill in all required fields.');
      return;
    }

    // Validate ZIP code
    if (!this.validateZip(address.zip)) {
      this.error.set('Please enter a valid ZIP code.');
      return;
    }

    // Sanitize inputs
    address.first_name = this.sanitizeInput(address.first_name);
    address.last_name = this.sanitizeInput(address.last_name);
    address.address_1 = this.sanitizeInput(address.address_1);
    address.address_2 = address.address_2 ? this.sanitizeInput(address.address_2) : '';
    address.city = this.sanitizeInput(address.city);
    address.state = this.sanitizeInput(address.state);

    this.loading.set(true);
    this.error.set(null);

    this.customerService.updateAddress(address.address_id, address).subscribe({
      next: (updatedAddress) => {
        // Update the specific address in the array
        const updatedAddresses = [...cust.addresses!];
        updatedAddresses[index] = updatedAddress;
        this.customer.set({ ...cust, addresses: updatedAddresses });
        this.editingAddressIndex.set(null);
        this.loading.set(false);
        this.success.set('Address updated successfully');
        setTimeout(() => this.success.set(null), 3000);
      },
      error: (err) => {
        this.error.set('Failed to update address. Please try again.');
        this.loading.set(false);
        console.error('Error updating address:', err);
      }
    });
  }

  addNewAddress(): void {
    this.addingAddress.set(true);
  }

  cancelAddAddress(): void {
    this.addingAddress.set(false);
    // Reset form data
    this.newAddressType = 'shipping';
    this.newAddressFirstName = '';
    this.newAddressLastName = '';
    this.newAddress1 = '';
    this.newAddress2 = '';
    this.newAddressCity = '';
    this.newAddressState = '';
    this.newAddressZip = '';
  }

  saveNewAddress(newAddress: Address): void {
    // Validate required fields
    if (!newAddress.first_name?.trim() || !newAddress.last_name?.trim() ||
        !newAddress.address_1?.trim() || !newAddress.city?.trim() ||
        !newAddress.state?.trim() || !newAddress.zip?.trim()) {
      this.error.set('Please fill in all required fields.');
      return;
    }

    // Validate ZIP code
    if (!this.validateZip(newAddress.zip)) {
      this.error.set('Please enter a valid ZIP code.');
      return;
    }

    // Sanitize inputs
    newAddress.first_name = this.sanitizeInput(newAddress.first_name);
    newAddress.last_name = this.sanitizeInput(newAddress.last_name);
    newAddress.address_1 = this.sanitizeInput(newAddress.address_1);
    newAddress.address_2 = newAddress.address_2 ? this.sanitizeInput(newAddress.address_2) : '';
    newAddress.city = this.sanitizeInput(newAddress.city);
    newAddress.state = this.sanitizeInput(newAddress.state);

    const cust = this.customer();
    if (!cust || !cust.customer_id) return;

    this.loading.set(true);
    this.error.set(null);

    this.customerService.addAddress(cust.customer_id, newAddress).subscribe({
      next: () => {
        // Reload customer data to get the updated addresses
        const user = this.userData();
        if (user?.email) {
          this.loadCustomer(user.email);
        }
        this.addingAddress.set(false);
        // Reset form data
        this.newAddressType = 'shipping';
        this.newAddressFirstName = '';
        this.newAddressLastName = '';
        this.newAddress1 = '';
        this.newAddress2 = '';
        this.newAddressCity = '';
        this.newAddressState = '';
        this.newAddressZip = '';
        this.success.set('Address added successfully');
        setTimeout(() => this.success.set(null), 3000);
      },
      error: (err) => {
        this.error.set('Failed to add address. Please try again.');
        this.loading.set(false);
        console.error('Error adding address:', err);
      }
    });
  }

  deleteAddress(index: number): void {
    const cust = this.customer();
    if (!cust || !cust.addresses) return;

    const address = cust.addresses[index];
    if (!address || !address.address_id) return;

    if (confirm('Are you sure you want to delete this address?')) {
      this.loading.set(true);
      this.error.set(null);

      this.customerService.deleteAddress(address.address_id).subscribe({
        next: () => {
          // Remove the address from the array
          const updatedAddresses = cust.addresses!.filter((_, i) => i !== index);
          this.customer.set({ ...cust, addresses: updatedAddresses });
          this.loading.set(false);
          this.success.set('Address deleted successfully');
          setTimeout(() => this.success.set(null), 3000);
        },
        error: (err) => {
          this.error.set('Failed to delete address. Please try again.');
          this.loading.set(false);
          console.error('Error deleting address:', err);
        }
      });
    }
  }

  setDefaultAddress(index: number): void {
    const cust = this.customer();
    if (!cust || !cust.addresses) return;

    const address = cust.addresses[index];
    if (!address || !address.address_id) return;

    // Create a copy of the address with is_default set to true
    const updatedAddress = { ...address, is_default: true };

    this.loading.set(true);
    this.error.set(null);

    this.customerService.updateAddress(address.address_id, updatedAddress).subscribe({
      next: (updatedAddr) => {
        // Update the specific address in the array and set all others to non-default
        const updatedAddresses = cust.addresses!.map((addr, i) => ({
          ...addr,
          is_default: i === index
        }));
        updatedAddresses[index] = updatedAddr;
        this.customer.set({ ...cust, addresses: updatedAddresses });
        this.loading.set(false);
        this.success.set('Default address updated successfully');
        setTimeout(() => this.success.set(null), 3000);
      },
      error: (err) => {
        this.error.set('Failed to update default address. Please try again.');
        this.loading.set(false);
        console.error('Error updating default address:', err);
      }
    });
  }

  // Credit card management methods
  editCard(index: number): void {
    this.editingCardIndex.set(index);
  }

  cancelEditCard(): void {
    this.editingCardIndex.set(null);
  }

  saveCard(index: number): void {
    const cust = this.customer();
    if (!cust || !cust.credit_cards) return;

    const card = cust.credit_cards[index];
    if (!card || !card.card_id) return;

    // Validate required fields
    if (!card.card_number?.trim() || !card.card_holder_name?.trim() ||
        !card.card_expires?.trim() || !card.card_cvv?.trim()) {
      this.error.set('Please fill in all required fields.');
      return;
    }

    // Validate card number
    if (!this.validateCardNumber(card.card_number)) {
      this.error.set('Please enter a valid card number.');
      return;
    }

    // Validate expiration
    if (!this.validateExpiration(card.card_expires)) {
      this.error.set('Please enter a valid expiration date (MM/YY).');
      return;
    }

    // Validate CVV
    if (!this.validateCvv(card.card_cvv)) {
      this.error.set('Please enter a valid CVV (3-4 digits).');
      return;
    }

    // Sanitize card holder name
    card.card_holder_name = this.sanitizeInput(card.card_holder_name);

    this.loading.set(true);
    this.error.set(null);

    this.customerService.updateCreditCard(card.card_id, card).subscribe({
      next: (updatedCard) => {
        // Update the specific card in the array
        const updatedCards = [...cust.credit_cards!];
        updatedCards[index] = updatedCard;
        this.customer.set({ ...cust, credit_cards: updatedCards });
        this.editingCardIndex.set(null);
        this.loading.set(false);
        this.success.set('Credit card updated successfully');
        setTimeout(() => this.success.set(null), 3000);
      },
      error: (err) => {
        this.error.set('Failed to update credit card. Please try again.');
        this.loading.set(false);
        console.error('Error updating credit card:', err);
      }
    });
  }

  addNewCard(): void {
    this.addingCard.set(true);
  }

  cancelAddCard(): void {
    this.addingCard.set(false);
    // Reset form data
    this.newCardType = 'visa';
    this.newCardNumber = '';
    this.newCardHolderName = '';
    this.newCardExpires = '';
    this.newCardCvv = '';
  }

  saveNewCard(newCard: CreditCard): void {
    // Validate required fields
    if (!newCard.card_number?.trim() || !newCard.card_holder_name?.trim() ||
        !newCard.card_expires?.trim() || !newCard.card_cvv?.trim()) {
      this.error.set('Please fill in all required fields.');
      return;
    }

    // Validate card number
    if (!this.validateCardNumber(newCard.card_number)) {
      this.error.set('Please enter a valid card number.');
      return;
    }

    // Validate expiration
    if (!this.validateExpiration(newCard.card_expires)) {
      this.error.set('Please enter a valid expiration date (MM/YY).');
      return;
    }

    // Validate CVV
    if (!this.validateCvv(newCard.card_cvv)) {
      this.error.set('Please enter a valid CVV (3-4 digits).');
      return;
    }

    // Sanitize card holder name
    newCard.card_holder_name = this.sanitizeInput(newCard.card_holder_name);

    const cust = this.customer();
    if (!cust || !cust.customer_id) return;

    this.loading.set(true);
    this.error.set(null);

    this.customerService.addCreditCard(cust.customer_id, newCard).subscribe({
      next: () => {
        // Reload customer data to get the updated credit cards
        const user = this.userData();
        if (user?.email) {
          this.loadCustomer(user.email);
        }
        this.addingCard.set(false);
        // Reset form data
        this.newCardType = 'visa';
        this.newCardNumber = '';
        this.newCardHolderName = '';
        this.newCardExpires = '';
        this.newCardCvv = '';
        this.success.set('Credit card added successfully');
        setTimeout(() => this.success.set(null), 3000);
      },
      error: (err) => {
        this.error.set('Failed to add credit card. Please try again.');
        this.loading.set(false);
        console.error('Error adding credit card:', err);
      }
    });
  }

  deleteCard(index: number): void {
    const cust = this.customer();
    if (!cust || !cust.credit_cards) return;

    const card = cust.credit_cards[index];
    if (!card || !card.card_id) return;

    if (confirm('Are you sure you want to delete this credit card?')) {
      this.loading.set(true);
      this.error.set(null);

      this.customerService.deleteCreditCard(card.card_id).subscribe({
        next: () => {
          // Remove the card from the array
          const updatedCards = cust.credit_cards!.filter((_, i) => i !== index);
          this.customer.set({ ...cust, credit_cards: updatedCards });
          this.loading.set(false);
          this.success.set('Credit card deleted successfully');
          setTimeout(() => this.success.set(null), 3000);
        },
        error: (err) => {
          this.error.set('Failed to delete credit card. Please try again.');
          this.loading.set(false);
          console.error('Error deleting credit card:', err);
        }
      });
    }
  }

  setDefaultCard(index: number): void {
    const cust = this.customer();
    if (!cust || !cust.credit_cards) return;

    const card = cust.credit_cards[index];
    if (!card || !card.card_id) return;

    // Create a copy of the card with is_default set to true
    const updatedCard = { ...card, is_default: true };

    this.loading.set(true);
    this.error.set(null);

    this.customerService.updateCreditCard(card.card_id, updatedCard).subscribe({
      next: (updatedCrd) => {
        // Update the specific card in the array and set all others to non-default
        const updatedCards = cust.credit_cards!.map((crd, i) => ({
          ...crd,
          is_default: i === index
        }));
        updatedCards[index] = updatedCrd;
        this.customer.set({ ...cust, credit_cards: updatedCards });
        this.loading.set(false);
        this.success.set('Default credit card updated successfully');
        setTimeout(() => this.success.set(null), 3000);
      },
      error: (err) => {
        this.error.set('Failed to update default credit card. Please try again.');
        this.loading.set(false);
        console.error('Error updating default credit card:', err);
      }
    });
  }

  // Validation methods
  validateCardNumber(cardNumber: string): boolean {
    // Remove spaces and dashes
    const cleaned = cardNumber.replace(/[\s-]/g, '');
    // Basic validation: 13-19 digits
    return /^\d{13,19}$/.test(cleaned);
  }

  validateExpiration(expiration: string): boolean {
    // Check MM/YY format
    const match = expiration.match(/^(\d{2})\/(\d{2})$/);
    if (!match) return false;

    const month = parseInt(match[1], 10);
    const year = parseInt(match[2], 10) + 2000;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    return month >= 1 && month <= 12 && year >= currentYear && (year > currentYear || month >= currentMonth);
  }

  validateCvv(cvv: string): boolean {
    return /^\d{3,4}$/.test(cvv);
  }

  validateZip(zip: string): boolean {
    return /^\d{5}(-\d{4})?$/.test(zip);
  }

  // Sanitization methods
  sanitizeInput(input: string): string {
    return input.trim().replace(/[<>]/g, '');
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
        this.success.set('Profile created successfully');
        setTimeout(() => this.success.set(null), 3000);
      },
      error: (err) => {
        this.error.set('Failed to save profile. Please try again.');
        this.loading.set(false);
        console.error('Error saving profile:', err);
      }
    });
    } else {
      // Update existing customer
    this.customerService.updateCustomer(cust).subscribe({
      next: (updated) => {
        this.customer.set(updated);
        this.loading.set(false);
        this.success.set('Profile updated successfully');
        setTimeout(() => this.success.set(null), 3000);
      },
      error: (err) => {
        this.error.set('Failed to update profile. Please try again.');
        this.loading.set(false);
        console.error('Error updating profile:', err);
      }
    });
    }
  }
}