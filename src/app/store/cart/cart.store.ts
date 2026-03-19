import { Injectable, signal, computed, inject } from '@angular/core';
import { CartService } from '../../services/cart.service';
import { OrderSseService } from '../../services/order-sse.service';
import {
  Cart,
  CartStoreState,
  SetContactRequest,
  AddAddressRequest,
  SetPaymentRequest,
  CartItemValidatedEvent,
  CartItemBackorderEvent
} from '../../models/cart';
import { NotificationService } from '../../core/notification/notification.service';
import { ErrorHandlerService } from '../../core/error/error-handler.service';
import { firstValueFrom } from 'rxjs';
import { CustomerStore } from '../customer/customer.store';
import { AuthService } from '../../auth/auth.service';

/**
 * CartStore manages shopping cart state using Angular signals
 * Follows the same pattern as ProductStore and CustomerStore
 */
@Injectable({
  providedIn: 'root'
})
export class CartStore {
  private readonly cartService = inject(CartService);
  private readonly orderSseService = inject(OrderSseService);
  private readonly notificationService = inject(NotificationService);
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly customerStore = inject(CustomerStore);
  private readonly authService = inject(AuthService);
  private readonly STORAGE_KEY = 'cart_id';

  // Private state signal
  private readonly state = signal<CartStoreState>({
    cart: null,
    cartId: null,
    loading: false,
    error: null,
    checkoutStep: 'cart'
  });

  // Public computed selectors
  readonly cart = computed(() => this.state().cart);
  readonly cartId = computed(() => this.state().cartId);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly checkoutStep = computed(() => this.state().checkoutStep);
  
  // Derived computed values for UI convenience
  readonly items = computed(() => this.state().cart?.items ?? []);
  readonly itemCount = computed(() => this.items().reduce((sum, item) => sum + item.quantity, 0));
  readonly isEmpty = computed(() => this.items().length === 0);
  readonly subtotal = computed(() => this.state().cart?.net_price ?? 0);
  readonly tax = computed(() => this.state().cart?.tax ?? 0);
  readonly shipping = computed(() => this.state().cart?.shipping ?? 0);
  readonly total = computed(() => this.state().cart?.total_price ?? 0);
  readonly currency = computed(() => this.state().cart?.currency ?? 'USD');
  readonly isActive = computed(() => this.state().cart?.current_status === 'active');
  readonly hasContact = computed(() => !!this.state().cart?.contact);
  readonly hasShippingAddress = computed(() => 
    this.state().cart?.addresses?.some(a => a.address_type === 'shipping') ?? false
  );
  readonly hasBillingAddress = computed(() => 
    this.state().cart?.addresses?.some(a => a.address_type === 'billing') ?? false
  );
  readonly hasPayment = computed(() => !!this.state().cart?.credit_card);

  // Validation state computed signals
  readonly pendingValidationItems = computed(() =>
    this.items().filter(item => item.status === 'pending_validation')
  );
  readonly hasPendingValidationItems = computed(() =>
    this.pendingValidationItems().length > 0
  );
  readonly backorderItems = computed(() =>
    this.items().filter(item => item.status === 'backorder')
  );
  readonly hasBackorderItems = computed(() =>
    this.backorderItems().length > 0
  );
  readonly confirmedItems = computed(() =>
    this.items().filter(item => {
      const status = item.status as string;
      return status === 'confirmed' || status === 'validated';
    })
  );

  // Update canCheckout to only require valid items - contact/shipping/payment collected during checkout
  readonly canCheckout = computed(() =>
    !this.isEmpty() &&
    !this.hasPendingValidationItems()
  );

  constructor() {
    // Try to load persisted cart on initialization
    this.loadPersistedCart();
    this.setupSseSubscriptions();
  }

  // Setup SSE event subscriptions
  private setupSseSubscriptions(): void {

    // Subscribe to item validated events
    this.orderSseService.cartItemValidated.subscribe({
      next: (event: CartItemValidatedEvent) => {
        try {
          this.handleItemValidated(event);
        } catch (e) {
          console.error('[CartStore] ❌ Error in cartItemValidated handler:', e);
        }
      },
      error: (error) => {
        console.error('[CartStore] ❌ cartItemValidated stream error:', error);
      }
    });

    // Subscribe to item backorder events
    this.orderSseService.cartItemBackorder.subscribe({
      next: (event: CartItemBackorderEvent) => {
        this.handleItemBackorder(event);
      },
      error: (error) => {
        console.error('[CartStore] ❌ cartItemBackorder stream error:', error);
      }
    });

    // Subscribe to connection errors
    this.orderSseService.connectionError.subscribe({
      next: (error: Error) => {
        // Let OrderSseService handle reconnection
      }
    });
  }

  // Handle cart.item.validated event
  private handleItemValidated(event: CartItemValidatedEvent): void {

    if (!this.state().cart) {
      return;
    }

    const currentItems = this.state().cart!.items;

    const matchingItem = currentItems.find(item => item.line_number === event.line_number);
    if (!matchingItem) {
    } else {
    }

    this.state.update(s => {
      if (!s.cart) return s;

      const updatedItems = s.cart.items.map(item => {
        if (item.line_number === event.line_number) {
          return {
            ...item,
            status: event.status,
            product_name: event.product_name,
            unit_price: event.unit_price,
            total_price: event.total_price
          };
        }
        return item;
      });

      const updatedState = {
        ...s,
        cart: {
          ...s.cart,
          items: updatedItems
        }
      };

      return updatedState;
    });

    this.notificationService.showSuccess(`${event.product_name} is now available in your cart`);
  }

  // Handle cart.item.backorder event
  private handleItemBackorder(event: CartItemBackorderEvent): void {

    if (!this.state().cart) {
      return;
    }

    const currentItems = this.state().cart!.items;

    const matchingItem = currentItems.find(item => item.line_number === event.line_number);
    if (!matchingItem) {
    } else {
    }

    this.state.update(s => {
      if (!s.cart) return s;

      const updatedItems = s.cart.items.map(item => {
        if (item.line_number === event.line_number) {
          return {
            ...item,
            status: event.status,
            product_name: event.product_name || item.product_name,
            unit_price: event.unit_price || item.unit_price,
            total_price: event.total_price || item.total_price,
            backorder_reason: event.backorder_reason
          };
        }
        return item;
      });

      const updatedState = {
        ...s,
        cart: {
          ...s.cart,
          items: updatedItems
        }
      };

      return updatedState;
    });

    this.notificationService.showWarning(
      `${event.product_name || 'Item'} is on backorder: ${event.backorder_reason}`
    );
  }

  // Connect to SSE when cart is loaded
  private async connectSse(cartId: string): Promise<void> {
    try {
      await this.orderSseService.connect(cartId);
    } catch (error) {
      console.error(`[CartStore] ❌ Failed to connect SSE for cart ${cartId}:`, error);
      // Non-fatal - cart still works without SSE
    }
  }

  // Actions

  /**
   * Creates a new shopping cart
   * @param customerId Optional customer ID for authenticated users
   */
  async createCart(customerId?: string): Promise<void> {
    this.setLoading(true);
    this.setError(null);

    try {
      const cart = await firstValueFrom(this.cartService.createCart(customerId));
      this.state.update(s => ({
        ...s,
        cart,
        cartId: cart.cart_id
      }));
      this.persistCartId(cart.cart_id);

      // Connect to SSE for real-time validation updates
      await this.connectSse(cart.cart_id);

      this.notificationService.showSuccess('Cart created successfully');
    } catch (error) {
      this.handleError(error, 'Failed to create cart');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Loads an existing cart by ID
   * @param cartId The UUID of the cart to load
   */
  async loadCart(cartId: string): Promise<void> {
    this.setLoading(true);
    this.setError(null);

    try {
      const cart = await firstValueFrom(this.cartService.getCart(cartId));
      this.state.update(s => ({
        ...s,
        cart,
        cartId: cart.cart_id
      }));
      this.persistCartId(cart.cart_id);

      // Connect to SSE for real-time validation updates
      await this.connectSse(cart.cart_id);
    } catch (error) {
      this.handleError(error, 'Failed to load cart');
      // Clear persisted cart if it fails to load
      this.clearPersistedCart();
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Adds an item to the cart
   * Creates a new cart if one doesn't exist
   * @param productId The product identifier
   * @param productName The product name
   * @param quantity The quantity to add (default: 1)
   */
  async addItem(productId: string, productName: string, quantity: number = 1): Promise<void> {
    const cartId = await this.ensureCart();
    if (!cartId) return;

    this.setLoading(true);

    try {
      await firstValueFrom(this.cartService.addItem(cartId, productId, productName, quantity));
      // Reload cart to get updated totals and items
      await this.reloadCart();
      this.notificationService.showSuccess('Item added to cart');
    } catch (error) {
      this.handleError(error, 'Failed to add item to cart');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Updates the quantity of an existing cart item
   * @param lineNumber The 3-digit line number of the item
   * @param quantity The new quantity
   */
  async updateItemQuantity(lineNumber: string, quantity: number): Promise<void> {
    const cartId = this.state().cartId;
    if (!cartId) return;

    this.setLoading(true);

    try {
      await firstValueFrom(this.cartService.updateItem(cartId, lineNumber, quantity));
      await this.reloadCart();
      this.notificationService.showSuccess('Cart updated');
    } catch (error) {
      this.handleError(error, 'Failed to update item quantity');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Removes an item from the cart
   * @param lineNumber The 3-digit line number of the item
   */
  async removeItem(lineNumber: string): Promise<void> {
    const cartId = this.state().cartId;
    if (!cartId) return;

    this.setLoading(true);

    try {
      await firstValueFrom(this.cartService.removeItem(cartId, lineNumber));
      await this.reloadCart();
      this.notificationService.showSuccess('Item removed from cart');
    } catch (error) {
      this.handleError(error, 'Failed to remove item from cart');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Clears the cart by deleting it
   */
  async clearCart(): Promise<void> {
    const cartId = this.state().cartId;
    if (!cartId) return;

    this.setLoading(true);

    try {
      await firstValueFrom(this.cartService.deleteCart(cartId));

      // Disconnect SSE
      this.orderSseService.disconnect();

      this.state.update(s => ({
        ...s,
        cart: null,
        cartId: null
      }));
      this.clearPersistedCart();
      this.notificationService.showSuccess('Cart cleared');
    } catch (error) {
      this.handleError(error, 'Failed to clear cart');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Sets contact information for the cart
   * @param contact The contact information
   */
  async setContact(contact: SetContactRequest): Promise<void> {
    const cartId = this.state().cartId;
    if (!cartId) return;

    this.setLoading(true);

    try {
      await firstValueFrom(this.cartService.setContact(cartId, contact));
      await this.reloadCart();
      this.notificationService.showSuccess('Contact information saved');
    } catch (error) {
      this.handleError(error, 'Failed to save contact information');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Adds an address to the cart
   * @param address The address information
   */
  async addAddress(address: AddAddressRequest): Promise<void> {
    const cartId = this.state().cartId;
    if (!cartId) return;

    this.setLoading(true);

    try {
      await firstValueFrom(this.cartService.addAddress(cartId, address));
      await this.reloadCart();
      this.notificationService.showSuccess('Address added');
    } catch (error) {
      this.handleError(error, 'Failed to add address');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Sets payment information for the cart
   * @param payment The payment information
   */
  async setPayment(payment: SetPaymentRequest): Promise<void> {
    const cartId = this.state().cartId;
    if (!cartId) return;

    this.setLoading(true);

    try {
      await firstValueFrom(this.cartService.setPayment(cartId, payment));
      await this.reloadCart();
      this.notificationService.showSuccess('Payment information saved');
    } catch (error) {
      this.handleError(error, 'Failed to save payment information');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Prepares cart for checkout - validates cart is ready
   * @returns True if cart is ready for checkout
   */
  async prepareForCheckout(): Promise<boolean> {
    if (!this.canCheckout()) {
      this.notificationService.showError('Please complete all required information before checkout');
      return false;
    }
    return true;
  }

  /**
   * Clears cart after successful order placement
   */
  async clearCartAfterOrder(): Promise<void> {
    // Disconnect SSE since cart is being cleared
    this.orderSseService.disconnect();

    this.clearPersistedCart();
    this.state.update(s => ({
      ...s,
      cart: null,
      cartId: null,
      checkoutStep: 'cart'
    }));
  }

  /**
   * Sets the current checkout step
   * @param step The checkout step to set
   */
  setCheckoutStep(step: Exclude<CartStoreState['checkoutStep'], 'confirmation'>): void {
    this.state.update(s => ({ ...s, checkoutStep: step }));
  }

  /**
   * Clears any error state
   */
  clearError(): void {
    this.setError(null);
  }

  // Helper methods

  /**
   * Ensures a cart exists, creating one if necessary
   * @returns The cart ID or null if creation failed
   */
  private async ensureCart(): Promise<string | null> {
    let cartId = this.state().cartId;
    
    if (!cartId) {
      // Try to get from localStorage
      cartId = localStorage.getItem(this.STORAGE_KEY);
      if (cartId) {
        await this.loadCart(cartId);
        cartId = this.state().cartId;
      }
    }
    
    // If still no cart, create one with customerId if authenticated
    if (!cartId) {
      // First ensure customer is loaded - get email from AuthService (available after login)
      let customer = this.customerStore.customer();
      if (!customer) {
        const userEmail = this.authService.userData()?.email;
        if (userEmail) {
          await this.customerStore.loadCustomer(userEmail);
          customer = this.customerStore.customer();
          
          // If customer still doesn't exist (new user), create one from auth data
          if (!customer) {
            const userData = this.authService.userData();
            if (userData) {
              await this.customerStore.createCustomerFromAuth(userData);
              customer = this.customerStore.customer();
            }
          }
        }
      }
      
      const customerId = customer?.customer_id;
      await this.createCart(customerId || undefined);
      cartId = this.state().cartId;
    }
    
    return cartId;
  }

  /**
   * Reloads the current cart to refresh data
   */
  private async reloadCart(): Promise<void> {
    const cartId = this.state().cartId;
    if (cartId) {
      const cart = await firstValueFrom(this.cartService.getCart(cartId));
      this.state.update(s => ({ ...s, cart }));
    }
  }

  /**
   * Persists the cart ID to localStorage
   * @param cartId The cart ID to persist
   */
  private persistCartId(cartId: string): void {
    localStorage.setItem(this.STORAGE_KEY, cartId);
  }

  /**
   * Clears the persisted cart ID from localStorage
   */
  private clearPersistedCart(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Loads a persisted cart from localStorage on initialization
   */
  private loadPersistedCart(): void {
    const cartId = localStorage.getItem(this.STORAGE_KEY);
    if (cartId) {
      this.loadCart(cartId);
    }
  }

  /**
   * Sets the loading state
   * @param loading Whether the store is loading
   */
  private setLoading(loading: boolean): void {
    this.state.update(s => ({ ...s, loading }));
  }

  /**
   * Sets the error state
   * @param error The error message or null
   */
  private setError(error: string | null): void {
    this.state.update(s => ({ ...s, error }));
  }

  /**
   * Handles errors from API calls
   * @param error The error object
   * @param defaultMessage Default message if error has no message
   */
  private handleError(error: unknown, defaultMessage: string): void {
    const errorMessage = this.errorHandler.handleError(error);
    this.setError(errorMessage.message || defaultMessage);
    this.notificationService.showError(errorMessage.message || defaultMessage);
  }
}
