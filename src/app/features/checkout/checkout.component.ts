import { Component, inject, signal, OnInit, OnDestroy, Signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ReactiveFormsModule, FormGroup, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { CartStore, CustomerStore, OrderStore } from '../../store';
import { AuthService, UserData } from '../../auth';
import { Cart, CartItem } from '../../models/cart';
import { NotificationService } from '../../core/notification/notification.service';
import { Address, CreditCard } from '../../models/customer';
import { CustomValidators } from '../../shared';
import { OrderConfirmation } from '../../models/order';

/**
 * Checkout Page Component
 * Multi-step checkout flow with contact, shipping, payment, and review steps
 */
@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss']
})
export class CheckoutComponent implements OnInit, OnDestroy {
  private readonly cartStore = inject(CartStore);
  private readonly customerStore = inject(CustomerStore);
  private readonly orderStore = inject(OrderStore);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  // Effect to watch for order confirmation and navigate - must be in constructor context
  private readonly orderConfirmationEffect = effect(() => {
    const confirmation = this.orderStore.orderConfirmation();
    if (confirmation) {
      // Clear cart and navigate
      this.cartStore.clearCartAfterOrder();
      this.router.navigate(['/order-confirmation']);
    }
  });

  // Current step in checkout flow
  currentStep = signal<number>(1);
  
  // Form groups for each step
  contactForm!: FormGroup;
  shippingForm!: FormGroup;
  billingForm!: FormGroup;
  paymentForm!: FormGroup;
  sameAsShipping = signal<boolean>(true);

  // Cart data with explicit types
  readonly cart: Signal<Cart | null> = this.cartStore.cart;
  readonly items: Signal<CartItem[]> = this.cartStore.items;
  readonly subtotal: Signal<number> = this.cartStore.subtotal;
  readonly tax: Signal<number> = this.cartStore.tax;
  readonly shipping: Signal<number> = this.cartStore.shipping;
  readonly total: Signal<number> = this.cartStore.total;
  readonly currency: Signal<string> = this.cartStore.currency;
  readonly cartLoading: Signal<boolean> = this.cartStore.loading;

  // Validation state selectors
  readonly hasPendingValidationItems: Signal<boolean> = this.cartStore.hasPendingValidationItems;
  readonly hasBackorderItems: Signal<boolean> = this.cartStore.hasBackorderItems;
  readonly backorderItems: Signal<CartItem[]> = this.cartStore.backorderItems;

  // Order store data
  readonly isSubmitting: Signal<boolean> = this.orderStore.isSubmitting;
  readonly isAwaitingOrder: Signal<boolean> = this.orderStore.isAwaitingOrder;
  readonly orderError: Signal<string | null> = this.orderStore.error;
  readonly orderConfirmation = this.orderStore.orderConfirmation;

  // User data for pre-filling
  readonly userData: Signal<UserData | null> = this.authService.userData;

  // Customer data for pre-filling
  readonly customer = computed(() => this.customerStore.customer());
  readonly defaultShippingAddress = computed(() => this.customerStore.defaultShippingAddress());
  readonly defaultBillingAddress = computed(() => this.customerStore.defaultBillingAddress());
  readonly defaultCreditCard = computed(() => this.customerStore.defaultCreditCard());

  ngOnInit(): void {
    // Initialize all forms
    this.initializeForms();

    // Load customer data and pre-fill forms when ready
    this.loadCustomerDataAndPrefill();
  }

  ngOnDestroy(): void {
    // Clean up order store if checkout not complete
    if (!this.orderStore.hasOrder()) {
      this.orderStore.destroy();
    }
  }

  private async loadCustomerDataAndPrefill(): Promise<void> {
    // First, pre-fill with user data that's immediately available
    this.prefillForms();

    // Then load customer data and pre-fill again when available
    const user = this.userData();
    if (user?.email) {
      await this.customerStore.loadCustomer(user.email);
    }

    // Pre-fill after customer data loads
    this.prefillForms();
  }

  private initializeForms(): void {
    // Contact form
    this.contactForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      phone: ['', Validators.required]
    });

    // Shipping address form
    this.shippingForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      address1: ['', Validators.required],
      address2: [''],
      city: ['', Validators.required],
      state: ['', Validators.required],
      zip: ['', [Validators.required, Validators.pattern(/^\d{5}(-\d{4})?$/)]],
      country: ['US', Validators.required]
    });

    // Billing address form
    this.billingForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      address1: ['', Validators.required],
      address2: [''],
      city: ['', Validators.required],
      state: ['', Validators.required],
      zip: ['', [Validators.required, Validators.pattern(/^\d{5}(-\d{4})?$/)]],
      country: ['US', Validators.required]
    });

    // Payment form - using CustomValidators for consistency with profile screen
    this.paymentForm = this.fb.group({
      cardNumber: ['', [Validators.required, CustomValidators.creditCard('Please enter a valid credit card number')]],
      cardHolder: ['', Validators.required],
      expiryMonth: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])$/)]],
      expiryYear: ['', [Validators.required, Validators.pattern(/^\d{4}$/), this.futureYearValidator()]],
      cvv: ['', [Validators.required, CustomValidators.cvv('Please enter a valid CVV')]],
      cardType: ['visa']
    });
  }

  private prefillForms(): void {
    const user = this.userData();
    const customer = this.customer();

    // Pre-fill contact form
    if (user) {
      this.contactForm.patchValue({
        email: user.email || '',
        firstName: user.given_name || '',
        lastName: user.family_name || ''
      });
    }

    // Pre-fill phone from customer profile
    if (customer?.phone) {
      this.contactForm.patchValue({
        phone: customer.phone
      });
    }

    // Pre-fill shipping address from default shipping address
    const shippingAddress = this.defaultShippingAddress();
    if (shippingAddress) {
      this.shippingForm.patchValue({
        firstName: shippingAddress.first_name || '',
        lastName: shippingAddress.last_name || '',
        address1: shippingAddress.address_1 || '',
        address2: shippingAddress.address_2 || '',
        city: shippingAddress.city || '',
        state: shippingAddress.state || '',
        zip: shippingAddress.zip || ''
      });
    }

    // Pre-fill billing address from default billing address
    const billingAddress = this.defaultBillingAddress();
    if (billingAddress) {
      this.billingForm.patchValue({
        firstName: billingAddress.first_name || '',
        lastName: billingAddress.last_name || '',
        address1: billingAddress.address_1 || '',
        address2: billingAddress.address_2 || '',
        city: billingAddress.city || '',
        state: billingAddress.state || '',
        zip: billingAddress.zip || ''
      });

      // If billing address is different from shipping, uncheck "same as shipping"
      if (shippingAddress && billingAddress.address_id !== shippingAddress.address_id) {
        this.sameAsShipping.set(false);
      }
    }

    // Pre-fill payment form from default credit card
    const creditCard = this.defaultCreditCard();
    if (creditCard) {
      // Parse expiry date (format: "MM/YY")
      const expiryParts = creditCard.card_expires?.split('/') || [];
      const expiryMonth = expiryParts[0] || '';
      const expiryYear = expiryParts[1] ? '20' + expiryParts[1] : ''; // Convert "YY" to "YYYY"

      this.paymentForm.patchValue({
        cardType: creditCard.card_type || 'visa',
        cardNumber: creditCard.card_number || '',
        cardHolder: creditCard.card_holder_name || '',
        expiryMonth: expiryMonth,
        expiryYear: expiryYear,
        cvv: creditCard.card_cvv || ''
      });
    }
  }

  // Step navigation
  goToStep(step: number): void {
    if (step >= 1 && step <= 5) {
      this.currentStep.set(step);
    }
  }

  nextStep(): void {
    const current = this.currentStep();
    if (current < 5) {
      this.currentStep.set(current + 1);
    }
  }

  previousStep(): void {
    const current = this.currentStep();
    if (current > 1) {
      this.currentStep.set(current - 1);
    }
  }

  // Save contact information
  async saveContact(): Promise<void> {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    const contact = {
      email: this.contactForm.value.email,
      first_name: this.contactForm.value.firstName,
      last_name: this.contactForm.value.lastName,
      phone: this.contactForm.value.phone
    };

    await this.cartStore.setContact(contact);
    this.nextStep();
  }

  // Save shipping address
  async saveShipping(): Promise<void> {
    if (this.shippingForm.invalid) {
      this.shippingForm.markAllAsTouched();
      return;
    }

    const address = {
      address_type: 'shipping' as const,
      first_name: this.shippingForm.value.firstName,
      last_name: this.shippingForm.value.lastName,
      address_1: this.shippingForm.value.address1,
      address_2: this.shippingForm.value.address2 || undefined,
      city: this.shippingForm.value.city,
      state: this.shippingForm.value.state,
      zip: this.shippingForm.value.zip
    };

    await this.cartStore.addAddress(address);
    
    if (this.sameAsShipping()) {
      // Also save as billing
      await this.cartStore.addAddress({ ...address, address_type: 'billing' });
      this.goToStep(4); // Skip billing step
    } else {
      this.nextStep();
    }
  }

  // Save billing address
  async saveBilling(): Promise<void> {
    if (this.billingForm.invalid) {
      this.billingForm.markAllAsTouched();
      return;
    }

    const address = {
      address_type: 'billing' as const,
      first_name: this.billingForm.value.firstName,
      last_name: this.billingForm.value.lastName,
      address_1: this.billingForm.value.address1,
      address_2: this.billingForm.value.address2 || undefined,
      city: this.billingForm.value.city,
      state: this.billingForm.value.state,
      zip: this.billingForm.value.zip
    };

    await this.cartStore.addAddress(address);
    this.nextStep();
  }

  // Save payment information
  async savePayment(): Promise<void> {
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    const payment = {
      card_type: this.paymentForm.value.cardType,
      card_number: this.paymentForm.value.cardNumber,
      card_holder_name: this.paymentForm.value.cardHolder,
      card_expires: `${this.paymentForm.value.expiryMonth}/${this.paymentForm.value.expiryYear.slice(-2)}`,
      card_cvv: this.paymentForm.value.cvv
    };

    await this.cartStore.setPayment(payment);
    this.nextStep();
  }

  // Complete checkout - delegates to OrderStore
  async completeCheckout(): Promise<void> {
    const cartId = this.cartStore.cartId();
    console.log('[CheckoutComponent] Completing checkout for cart:', cartId);
    if (!cartId) {
      return;
    }

    // Validate cart is ready
    const isReady = await this.cartStore.prepareForCheckout();
    if (!isReady) {
      return;
    }

    // Check for pending validation items
    if (this.hasPendingValidationItems()) {
      this.notificationService.showError(
        'Please wait for all items to be validated before checkout'
      );
      return;
    }

    // Check for backorder items and confirm
    if (this.hasBackorderItems()) {
      const confirmBackorder = confirm(
        `Your cart contains ${this.backorderItems().length} item(s) on backorder. ` +
        'These items will not ship immediately. Do you want to continue with checkout?'
      );
      if (!confirmBackorder) {
        return;
      }
    }

    // Start checkout via OrderStore
    await this.orderStore.checkout(cartId);
    // Navigation handled by subscription in ngOnInit
  }

  // Retry checkout after error
  async retryCheckout(): Promise<void> {
    const cartId = this.cartStore.cartId();
    if (cartId) {
      await this.orderStore.retryCheckout(cartId);
    }
  }

  // Update item quantity
  async updateItemQuantity(lineNumber: string, quantity: number): Promise<void> {
    if (quantity < 1) return;
    await this.cartStore.updateItemQuantity(lineNumber, quantity);
  }

  // Remove item from cart
  async removeItem(lineNumber: string): Promise<void> {
    await this.cartStore.removeItem(lineNumber);
  }

  // Custom validator to ensure expiry year is in the future
  private futureYearValidator() {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      
      const year = parseInt(control.value, 10);
      const currentYear = new Date().getFullYear();
      
      if (year < currentYear) {
        return { futureYear: { message: 'Year must be current or future' } };
      }
      
      return null;
    };
  }

  // Toggle same as shipping
  toggleSameAsShipping(): void {
    this.sameAsShipping.update(value => !value);
  }

  // Copy shipping to billing
  copyShippingToBilling(): void {
    const shippingValue = this.shippingForm.value;
    this.billingForm.patchValue({
      firstName: shippingValue.firstName,
      lastName: shippingValue.lastName,
      address1: shippingValue.address1,
      address2: shippingValue.address2,
      city: shippingValue.city,
      state: shippingValue.state,
      zip: shippingValue.zip,
      country: shippingValue.country
    });
  }

  // Get error message for form control
  getErrorMessage(form: FormGroup, controlName: string): string {
    const control = form.get(controlName);
    if (control?.invalid && (control.dirty || control.touched)) {
      // Check for custom validator messages first
      const errorKeys = Object.keys(control.errors || {});
      for (const key of errorKeys) {
        const error = control.errors![key];
        if (error?.message) {
          return error.message;
        }
      }

      // Fallback to default messages
      if (control.errors?.['required']) {
        return 'This field is required';
      }
      if (control.errors?.['email']) {
        return 'Please enter a valid email address';
      }
      if (control.errors?.['pattern']) {
        return 'Invalid format';
      }
    }
    return '';
  }
}
