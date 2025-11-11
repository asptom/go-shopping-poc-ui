import { Component, inject, signal, effect, computed, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import { ReactiveFormsModule, FormsModule, FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, startWith, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { CustomerStore } from '../../store/customer/customer.store';
import { CustomerFormService, AddressFormService, CreditCardFormService, ModalComponent } from '../../shared';
import { maskCardNumber, formatCardNumber, formatExpiration } from '../../shared/forms/utils/ui-formatters';
import { Customer } from '../../models/customer';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, ModalComponent],
  templateUrl: './profile.html',
  styleUrls: ['./profile.scss', '../../shared/modal/modal-forms.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly customerStore = inject(CustomerStore);
  private readonly customerFormService = inject(CustomerFormService);
  private readonly addressFormService = inject(AddressFormService);
  private readonly creditCardFormService = inject(CreditCardFormService);

  // Selectors
  readonly isAuthenticated = this.authService.isAuthenticated;
  readonly userData = this.authService.userData;
  readonly customer = this.customerStore.customer;
  readonly loading = this.customerStore.loading;
  readonly error = this.customerStore.error;
  readonly addresses = this.customerStore.addresses;
  readonly creditCards = this.customerStore.creditCards;

  // Form groups - all as signals for consistency
  readonly customerForm = signal(this.customerFormService.createCustomerForm());
  readonly addressForm = signal(this.addressFormService.createAddressForm());
  readonly creditCardForm = signal(this.creditCardFormService.createCreditCardForm());

  // UI state
  readonly editingProfile = signal(false);
  readonly addressModalOpen = signal(false);
  readonly creditCardModalOpen = signal(false);
  readonly editingAddressId = signal<string | null>(null);
  readonly editingCardId = signal<string | null>(null);
  
  // Track original form values for edit forms
  readonly originalAddressValues = signal<any>(null);
  readonly originalCardValues = signal<any>(null);
  
  // Form state signals for reactive updates
  readonly addressFormState = signal<{
    valid: boolean;
    dirty: boolean;
    hasChanges: boolean;
    canSave: boolean;
  }>({
    valid: false,
    dirty: false,
    hasChanges: false,
    canSave: true
  });
  
  readonly creditCardFormState = signal<{
    valid: boolean;
    dirty: boolean;
    hasChanges: boolean;
    canSave: boolean;
  }>({
    valid: false,
    dirty: false,
    hasChanges: false,
    canSave: true
  });
  
  private destroy$ = new Subject<void>();

  constructor() {
    effect(() => {
      const user = this.userData();
      const email = user?.email;
      if (email && this.isAuthenticated()) {
        this.initializeCustomerData(user);
      }
    });

    effect(() => {
      const customer = this.customer();
      if (customer) {
        this.customerFormService.patchCustomerForm(this.customerForm(), customer);
      }
    });
  }

  ngOnInit(): void {
    // Component initialization
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateAddressFormState(): void {
    const form = this.addressForm();
    const isEditing = !!this.editingAddressId();
    const originalValues = this.originalAddressValues();
    
    let hasChanges = false;
    if (isEditing && originalValues) {
      hasChanges = JSON.stringify(form.value) !== JSON.stringify(originalValues);
    }
    
    this.addressFormState.set({
      valid: form.valid,
      dirty: form.dirty,
      hasChanges,
      canSave: isEditing ? form.valid && hasChanges : true
    });
  }

  private updateCreditCardFormState(): void {
    const form = this.creditCardForm();
    const isEditing = !!this.editingCardId();
    const originalValues = this.originalCardValues();
    
    let hasChanges = false;
    if (isEditing && originalValues) {
      hasChanges = JSON.stringify(form.value) !== JSON.stringify(originalValues);
    }
    
    this.creditCardFormState.set({
      valid: form.valid,
      dirty: form.dirty,
      hasChanges,
      canSave: isEditing ? form.valid && hasChanges : true
    });
  }

  private async initializeCustomerData(userData: any): Promise<void> {
    const email = userData?.email;
    if (!email) {
      return;
    }
    
    // First try to load existing customer
    await this.customerStore.loadCustomer(email);
    
    // If no customer exists, create one from auth data
    const customer = this.customer();
    if (!customer) {
      await this.customerStore.createCustomerFromAuth(userData);
    }
  }



  saveProfile(): void {
    const form = this.customerForm();
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    // Get existing customer to preserve addresses and credit cards
    const existingCustomer = this.customer();
    const formCustomerData = this.customerFormService.getCustomerFormData(form);
    
    // Merge form data with existing addresses and credit cards
    const updatedCustomerData: Customer = {
      ...formCustomerData,
      addresses: existingCustomer?.addresses || [],
      credit_cards: existingCustomer?.credit_cards || [],
      customer_statuses: existingCustomer?.customer_statuses || []
    };

    this.customerStore.updateCustomer(updatedCustomerData);
    this.editingProfile.set(false);
  }

  openAddressModal(addressId?: string): void {
    this.editingAddressId.set(addressId || null);
    
    if (addressId) {
      // Edit mode: create clean form, then patch
      const newForm = this.addressFormService.createAddressForm();
      const address = this.addresses().find(a => a.address_id === addressId);
      if (address) {
        newForm.patchValue(address);
        // Store original values to track changes - use form value after patching
        this.originalAddressValues.set(newForm.value);
      }
      // Set up value change subscription for the new form
      newForm.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.updateAddressFormState();
        });
      
      this.addressForm.set(newForm);
    } else {
      // Add mode: create clean form
      const newForm = this.addressFormService.createAddressForm();
      
      // Set up value change subscription for the new form
      newForm.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.updateAddressFormState();
        });
      
      this.addressForm.set(newForm);
    }
    
    // Update form state after setting the form
    this.updateAddressFormState();
    this.addressModalOpen.set(true);
  }

  openCreditCardModal(cardId?: string): void {
    this.editingCardId.set(cardId || null);
    
    if (cardId) {
      // Edit mode: create clean form, then patch
      const newForm = this.creditCardFormService.createCreditCardForm();
      const card = this.creditCards().find(c => c.card_id === cardId);
      if (card) {
        newForm.patchValue(card);
        // Store original values to track changes - use form value after patching
        this.originalCardValues.set(newForm.value);
      }
      // Set up value change subscription for new form
      newForm.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          console.log('Credit card form valueChanges detected');
          this.updateCreditCardFormState();
        });
      
      this.creditCardForm.set(newForm);
    } else {
      // Add mode: create clean form
      const newForm = this.creditCardFormService.createCreditCardForm();
      
      // Set up value change subscription for new form
      newForm.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          console.log('Credit card form valueChanges detected');
          this.updateCreditCardFormState();
        });
      
      this.creditCardForm.set(newForm);
    }
    
    // Update form state after setting form
    this.updateCreditCardFormState();
    this.creditCardModalOpen.set(true);
  }

  saveAddress(): void {
    const form = this.addressForm();
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    const editingId = this.editingAddressId();
    const addressData = this.addressFormService.getAddressFormData(form);
    
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
    const form = this.creditCardForm();
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    const editingId = this.editingCardId();
    const cardData = this.creditCardFormService.getCreditCardFormData(form);
    
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
    this.addressFormService.resetAddressForm(this.addressForm());
  }

  closeCreditCardModal(): void {
    this.creditCardModalOpen.set(false);
    this.editingCardId.set(null);
    this.creditCardFormService.resetCreditCardForm(this.creditCardForm());
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

  // Display formatting methods
  maskCardNumber(cardNumber: string): string {
    return maskCardNumber(cardNumber);
  }

  // Input formatting methods for real-time formatting
  onCardNumberInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    input.value = formatCardNumber(input.value);
  }

  onCardExpirationInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    input.value = formatExpiration(input.value);
  }

  clearError(): void {
    this.customerStore.clearError();
  }

  getErrorMessage(controlName: string): string {
    const control = this.customerForm().get(controlName);
    if (control?.errors) {
      const firstError = Object.values(control.errors)[0] as any;
      return firstError?.message || 'Invalid input';
    }
    return '';
  }

  getAddressErrorMessage(controlName: string): string {
    const control = this.addressForm().get(controlName);
    if (control?.errors && (control.dirty || control.touched)) {
      const firstError = Object.values(control.errors)[0] as any;
      return firstError?.message || 'Invalid input';
    }
    return '';
  }

  getCardErrorMessage(controlName: string): string {
    const control = this.creditCardForm().get(controlName);
    if (control?.errors && (control.dirty || control.touched)) {
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