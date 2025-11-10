import { Component, inject, signal, effect, ChangeDetectionStrategy } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthStore } from '../../store/auth/auth.store';
import { CustomerStore } from '../../store/customer/customer.store';
import { CustomerFormService, AddressFormService, CreditCardFormService } from '../../shared/forms';
import { ModalComponent } from '../profile/modal.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, ModalComponent],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileComponent {
  private readonly authStore = inject(AuthStore);
  private readonly customerStore = inject(CustomerStore);
  private readonly customerFormService = inject(CustomerFormService);
  private readonly addressFormService = inject(AddressFormService);
  private readonly creditCardFormService = inject(CreditCardFormService);

  // Selectors
  readonly isAuthenticated = this.authStore.isAuthenticated;
  readonly userData = this.authStore.userData;
  readonly customer = this.customerStore.customer;
  readonly loading = this.customerStore.loading;
  readonly error = this.customerStore.error;
  readonly addresses = this.customerStore.addresses;
  readonly creditCards = this.customerStore.creditCards;

  // Form groups
  readonly customerForm = this.customerFormService.createCustomerForm();
  readonly addressForm = this.addressFormService.createAddressForm();
  readonly creditCardForm = this.creditCardFormService.createCreditCardForm();

  // UI state
  readonly editingProfile = signal(false);
  readonly addressModalOpen = signal(false);
  readonly creditCardModalOpen = signal(false);
  readonly editingAddressId = signal<string | null>(null);
  readonly editingCardId = signal<string | null>(null);

  constructor() {
    effect(() => {
      const user = this.userData();
      const email = user?.email;
      if (email && this.isAuthenticated()) {
        this.customerStore.loadCustomer(email);
      }
    });

    effect(() => {
      const customer = this.customer();
      if (customer) {
        this.customerFormService.patchCustomerForm(this.customerForm, customer);
      }
    });
  }

  saveProfile(): void {
    if (this.customerForm.invalid) {
      this.customerForm.markAllAsTouched();
      return;
    }

    const customerData = this.customerFormService.getCustomerFormData(this.customerForm);
    this.customerStore.updateCustomer(customerData);
    this.editingProfile.set(false);
  }

  openAddressModal(addressId?: string): void {
    this.editingAddressId.set(addressId || null);
    if (addressId) {
      // Edit mode - patch existing form with address data
      const address = this.addresses().find(a => a.address_id === addressId);
      if (address) {
        this.addressForm.patchValue(address);
      }
    } else {
      // Add mode - reset form
      this.addressFormService.resetAddressForm(this.addressForm);
    }
    this.addressModalOpen.set(true);
  }

  openCreditCardModal(cardId?: string): void {
    this.editingCardId.set(cardId || null);
    if (cardId) {
      // Edit mode - patch existing form with card data
      const card = this.creditCards().find(c => c.card_id === cardId);
      if (card) {
        this.creditCardForm.patchValue(card);
      }
    } else {
      // Add mode - reset form
      this.creditCardFormService.resetCreditCardForm(this.creditCardForm);
    }
    this.creditCardModalOpen.set(true);
  }

  saveAddress(): void {
    if (this.addressForm.invalid) {
      this.addressForm.markAllAsTouched();
      return;
    }

    const editingId = this.editingAddressId();
    const addressData = this.addressFormService.getAddressFormData(this.addressForm);
    
    if (editingId) {
      // Update existing address
      this.customerStore.updateAddress(editingId, addressData);
    } else {
      // Add new address
      this.customerStore.addAddress(addressData);
    }
    
    this.closeAddressModal();
  }

  saveCreditCard(): void {
    if (this.creditCardForm.invalid) {
      this.creditCardForm.markAllAsTouched();
      return;
    }

    const editingId = this.editingCardId();
    const cardData = this.creditCardFormService.getCreditCardFormData(this.creditCardForm);
    
    if (editingId) {
      // Update existing card
      this.customerStore.updateCreditCard(editingId, cardData);
    } else {
      // Add new card
      this.customerStore.addCreditCard(cardData);
    }
    
    this.closeCreditCardModal();
  }

  closeAddressModal(): void {
    this.addressModalOpen.set(false);
    this.editingAddressId.set(null);
    this.addressFormService.resetAddressForm(this.addressForm);
  }

  closeCreditCardModal(): void {
    this.creditCardModalOpen.set(false);
    this.editingCardId.set(null);
    this.creditCardFormService.resetCreditCardForm(this.creditCardForm);
  }

  deleteAddress(addressId: string): void {
    if (confirm('Are you sure you want to delete this address?')) {
      this.customerStore.deleteAddress(addressId);
    }
  }

  deleteCreditCard(cardId: string): void {
    if (confirm('Are you sure you want to delete this credit card?')) {
      this.customerStore.deleteCreditCard(cardId);
    }
  }

  maskCardNumber(cardNumber: string): string {
    return this.creditCardFormService.maskCardNumber(cardNumber);
  }

  clearError(): void {
    this.customerStore.clearError();
  }

  getErrorMessage(controlName: string): string {
    const control = this.customerForm.get(controlName);
    if (control?.errors) {
      const firstError = Object.values(control.errors)[0] as any;
      return firstError?.message || 'Invalid input';
    }
    return '';
  }

  getAddressErrorMessage(controlName: string): string {
    const control = this.addressForm.get(controlName);
    if (control?.errors) {
      const firstError = Object.values(control.errors)[0] as any;
      return firstError?.message || 'Invalid input';
    }
    return '';
  }

  getCardErrorMessage(controlName: string): string {
    const control = this.creditCardForm.get(controlName);
    if (control?.errors) {
      const firstError = Object.values(control.errors)[0] as any;
      return firstError?.message || 'Invalid input';
    }
    return '';
  }

  // Helper methods for modal titles
  getAddressModalTitle(): string {
    return this.editingAddressId() ? 'Edit Address' : 'Add Address';
  }

  getCreditCardModalTitle(): string {
    return this.editingCardId() ? 'Edit Credit Card' : 'Add Credit Card';
  }
}