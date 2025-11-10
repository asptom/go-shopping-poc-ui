import { Injectable, signal, computed, inject } from '@angular/core';
import { AuthService } from '../../auth/auth.service';
import { CustomerService } from '../../services/customer.service';
import { Customer } from '../../models/customer';
import { NotificationService } from '../../core/notification/notification.service';

export interface CustomerState {
  customer: Customer | null;
  loading: boolean;
  error: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class CustomerStore {
  private readonly authService = inject(AuthService);
  private readonly customerService = inject(CustomerService);
  private readonly notificationService = inject(NotificationService);

  // Private state
  private readonly state = signal<CustomerState>({
    customer: null,
    loading: false,
    error: null
  });

  // Public selectors
  readonly customer = computed(() => this.state().customer);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly isAuthenticated = this.authService.isAuthenticated;
  readonly userData = this.authService.userData;

  // Computed selectors
  readonly hasCustomer = computed(() => !!this.state().customer);
  readonly customerName = computed(() => {
    const cust = this.state().customer;
    return cust ? `${cust.first_name || ''} ${cust.last_name || ''}`.trim() : '';
  });
  readonly customerEmail = computed(() => this.state().customer?.email || '');
  readonly addresses = computed(() => this.state().customer?.addresses || []);
  readonly creditCards = computed(() => this.state().customer?.credit_cards || []);
  readonly defaultAddress = computed(() => 
    this.addresses().find(addr => addr.is_default)
  );
  readonly defaultCreditCard = computed(() => 
    this.creditCards().find(card => card.is_default)
  );

  // Actions
  loadCustomer(email: string): void {
    if (!email) return;

    this.setState({ loading: true, error: null });

    this.customerService.getCustomer(email).subscribe({
      next: (customer) => {
        if (customer) {
          this.setState({ customer, loading: false });
        } else {
          this.createCustomerFromAuth();
        }
      },
      error: () => {
        this.setState({ 
          loading: false, 
          error: 'Failed to load customer data' 
        });
      }
    });
  }

  createCustomerFromAuth(): void {
    const user = this.userData();
    if (!user?.email) return;

    const newCustomer: Customer = {
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

    this.customerService.createCustomer(newCustomer).subscribe({
      next: (savedCustomer) => {
        this.setState({ customer: savedCustomer, loading: false });
        this.notificationService.showSuccess('Customer profile created successfully');
      },
      error: () => {
        this.setState({ 
          loading: false, 
          error: 'Failed to create customer profile' 
        });
      }
    });
  }

  updateCustomer(customer: Customer): void {
    this.setState({ loading: true, error: null });

    this.customerService.updateCustomer(customer).subscribe({
      next: (updatedCustomer) => {
        this.setState({ customer: updatedCustomer, loading: false });
        this.notificationService.showSuccess('Profile updated successfully');
      },
      error: () => {
        this.setState({ 
          loading: false, 
          error: 'Failed to update profile' 
        });
      }
    });
  }

  addAddress(address: any): void {
    const currentCustomer = this.state().customer;
    if (!currentCustomer?.customer_id) return;

    this.setState({ loading: true, error: null });

    this.customerService.addAddress(currentCustomer.customer_id, address).subscribe({
      next: () => {
        // Reload customer to get updated addresses
        this.loadCustomer(currentCustomer.email || '');
        this.notificationService.showSuccess('Address added successfully');
      },
      error: () => {
        this.setState({ 
          loading: false, 
          error: 'Failed to add address' 
        });
      }
    });
  }

  updateAddress(addressId: string, address: any): void {
    this.setState({ loading: true, error: null });

    this.customerService.updateAddress(addressId, address).subscribe({
      next: () => {
        // Reload customer data to get updated addresses
        const currentCustomer = this.state().customer;
        if (currentCustomer?.email) {
          this.loadCustomer(currentCustomer.email);
        }
        this.notificationService.showSuccess('Address updated successfully');
      },
      error: () => {
        this.setState({ 
          loading: false, 
          error: 'Failed to update address' 
        });
      }
    });
  }

  deleteAddress(addressId: string): void {
    this.setState({ loading: true, error: null });

    this.customerService.deleteAddress(addressId).subscribe({
      next: () => {
        const currentCustomer = this.state().customer;
        if (currentCustomer?.addresses) {
          const updatedAddresses = currentCustomer.addresses.filter(
            addr => addr.address_id !== addressId
          );
          this.setState({ 
            customer: { ...currentCustomer, addresses: updatedAddresses },
            loading: false 
          });
          this.notificationService.showSuccess('Address deleted successfully');
        }
      },
      error: () => {
        this.setState({ 
          loading: false, 
          error: 'Failed to delete address' 
        });
      }
    });
  }

  addCreditCard(card: any): void {
    const currentCustomer = this.state().customer;
    if (!currentCustomer?.customer_id) return;

    this.setState({ loading: true, error: null });

    this.customerService.addCreditCard(currentCustomer.customer_id, card).subscribe({
      next: () => {
        // Reload customer to get updated credit cards
        this.loadCustomer(currentCustomer.email || '');
        this.notificationService.showSuccess('Credit card added successfully');
      },
      error: () => {
        this.setState({ 
          loading: false, 
          error: 'Failed to add credit card' 
        });
      }
    });
  }

  updateCreditCard(cardId: string, card: any): void {
    this.setState({ loading: true, error: null });

    this.customerService.updateCreditCard(cardId, card).subscribe({
      next: () => {
        // Reload customer data to get updated credit cards
        const currentCustomer = this.state().customer;
        if (currentCustomer?.email) {
          this.loadCustomer(currentCustomer.email);
        }
        this.notificationService.showSuccess('Credit card updated successfully');
      },
      error: () => {
        this.setState({ 
          loading: false, 
          error: 'Failed to update credit card' 
        });
      }
    });
  }

  deleteCreditCard(cardId: string): void {
    this.setState({ loading: true, error: null });

    this.customerService.deleteCreditCard(cardId).subscribe({
      next: () => {
        const currentCustomer = this.state().customer;
        if (currentCustomer?.credit_cards) {
          const updatedCards = currentCustomer.credit_cards.filter(
            card => card.card_id !== cardId
          );
          this.setState({ 
            customer: { ...currentCustomer, credit_cards: updatedCards },
            loading: false 
          });
          this.notificationService.showSuccess('Credit card deleted successfully');
        }
      },
      error: () => {
        this.setState({ 
          loading: false, 
          error: 'Failed to delete credit card' 
        });
      }
    });
  }

  clearError(): void {
    this.setState({ error: null });
  }

  // Private helper methods
  private setState(partialState: Partial<CustomerState>): void {
    this.state.update(currentState => ({ ...currentState, ...partialState }));
  }
}