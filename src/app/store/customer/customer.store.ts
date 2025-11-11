import { Injectable, signal, computed, inject, effect } from '@angular/core';
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

  // Computed selectors
  readonly hasCustomer = computed(() => !!this.state().customer);
  readonly customerName = computed(() => {
    const cust = this.state().customer;
    return cust ? `${cust.first_name || ''} ${cust.last_name || ''}`.trim() : '';
  });
  readonly customerEmail = computed(() => this.state().customer?.email || '');
  readonly addresses = computed(() => {
    const addresses = this.state().customer?.addresses || [];
    console.log('Addresses computed:', addresses);
    return addresses;
  });
  readonly creditCards = computed(() => {
    const creditCards = this.state().customer?.credit_cards || [];
    console.log('Credit cards computed:', creditCards);
    return creditCards;
  });
  readonly defaultAddress = computed(() => 
    this.addresses().find(addr => addr.is_default)
  );
  readonly defaultCreditCard = computed(() => 
    this.creditCards().find(card => card.is_default)
  );

  // Actions
  async loadCustomer(email: string): Promise<void> {
    if (!email) return;
    this.setState({ loading: true, error: null });

    try {
      console.log('Loading customer for email:', email);
      const customer = await this.customerService.getCustomer(email).toPromise();
        console.log('Customer data received:', customer);
        if (customer) {
          console.log('Customer addresses:', customer.addresses);
          console.log('Customer credit cards:', customer.credit_cards);
          console.log('Addresses length:', customer.addresses?.length || 0);
          console.log('Credit cards length:', customer.credit_cards?.length || 0);
          this.setState({ customer, loading: false });
        } else {
          console.log('No customer found, setting null');
          // Customer not found - return null without error, let caller decide what to do
          this.setState({ customer: null, loading: false });
        }
    } catch (error) {
      console.error('Error loading customer:', error);
      this.setState({ 
        loading: false, 
        error: 'Failed to load customer data' 
      });
    }
  }

  async createCustomerFromAuth(userData: any): Promise<void> {
    if (!userData?.email) return;

    const newCustomer: Customer = {
      customer_id: '',
      user_name: userData.preferred_username || userData.email || '',
      email: userData.email,
      first_name: userData.given_name,
      last_name: userData.family_name,
      phone: '',
      addresses: [],
      credit_cards: [],
      customer_statuses: []
    };

    try {
      const savedCustomer = await this.customerService.createCustomer(newCustomer).toPromise();
      this.setState({ customer: savedCustomer, loading: false });
      this.notificationService.showSuccess('Customer profile created successfully');
    } catch (error) {
      this.setState({ 
        loading: false, 
        error: 'Failed to create customer profile' 
      });
    }
  }

  async updateCustomer(customer: Customer): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      const updatedCustomer = await this.customerService.updateCustomer(customer).toPromise();
      this.setState({ customer: updatedCustomer, loading: false });
      this.notificationService.showSuccess('Profile updated successfully');
    } catch (error) {
      this.setState({ 
        loading: false, 
        error: 'Failed to update profile' 
      });
    }
  }

  async addAddress(address: any): Promise<void> {
    const currentCustomer = this.state().customer;
    if (!currentCustomer?.customer_id) return;

    this.setState({ loading: true, error: null });

    try {
      await this.customerService.addAddress(currentCustomer.customer_id, address).toPromise();
      // Reload customer to get updated addresses
      await this.loadCustomer(currentCustomer.email || '');
      this.notificationService.showSuccess('Address added successfully');
    } catch (error) {
      this.setState({ 
        loading: false, 
        error: 'Failed to add address' 
      });
    }
  }

  async updateAddress(addressId: string, address: any): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      await this.customerService.updateAddress(addressId, address).toPromise();
      // Reload customer data to get updated addresses
      const currentCustomer = this.state().customer;
      if (currentCustomer?.email) {
        await this.loadCustomer(currentCustomer.email);
      }
      this.notificationService.showSuccess('Address updated successfully');
    } catch (error) {
      this.setState({ 
        loading: false, 
        error: 'Failed to update address' 
      });
    }
  }

  async deleteAddress(addressId: string): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      await this.customerService.deleteAddress(addressId).toPromise();
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
    } catch (error) {
      this.setState({ 
        loading: false, 
        error: 'Failed to delete address' 
      });
    }
  }

  async addCreditCard(card: any): Promise<void> {
    const currentCustomer = this.state().customer;
    if (!currentCustomer?.customer_id) return;

    this.setState({ loading: true, error: null });

    try {
      await this.customerService.addCreditCard(currentCustomer.customer_id, card).toPromise();
      // Reload customer to get updated credit cards
      await this.loadCustomer(currentCustomer.email || '');
      this.notificationService.showSuccess('Credit card added successfully');
    } catch (error) {
      this.setState({ 
        loading: false, 
        error: 'Failed to add credit card' 
      });
    }
  }

  async updateCreditCard(cardId: string, card: any): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      await this.customerService.updateCreditCard(cardId, card).toPromise();
      // Reload customer data to get updated credit cards
      const currentCustomer = this.state().customer;
      if (currentCustomer?.email) {
        await this.loadCustomer(currentCustomer.email);
      }
      this.notificationService.showSuccess('Credit card updated successfully');
    } catch (error) {
      this.setState({ 
        loading: false, 
        error: 'Failed to update credit card' 
      });
    }
  }

  async deleteCreditCard(cardId: string): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      await this.customerService.deleteCreditCard(cardId).toPromise();
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
    } catch (error) {
      this.setState({ 
        loading: false, 
        error: 'Failed to delete credit card' 
      });
    }
  }

  clearError(): void {
    this.setState({ error: null });
  }

  // Private helper methods
  private setState(partialState: Partial<CustomerState>): void {
    this.state.update(currentState => ({ ...currentState, ...partialState }));
  }
}