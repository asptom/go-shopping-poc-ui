import { Injectable, signal, computed, inject } from '@angular/core';
import { CartService } from '../../services/cart.service';
import { 
  Cart, 
  CartStoreState,
  SetContactRequest,
  AddAddressRequest,
  SetPaymentRequest 
} from '../../models/cart';
import { NotificationService } from '../../core/notification/notification.service';
import { ErrorHandlerService } from '../../core/error/error-handler.service';
import { firstValueFrom } from 'rxjs';

/**
 * CartStore manages shopping cart state using Angular signals
 * Follows the same pattern as ProductStore and CustomerStore
 */
@Injectable({
  providedIn: 'root'
})
export class CartStore {
  private readonly cartService = inject(CartService);
  private readonly notificationService = inject(NotificationService);
  private readonly errorHandler = inject(ErrorHandlerService);
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
  readonly canCheckout = computed(() => 
    !this.isEmpty() && 
    this.hasContact() && 
    this.hasShippingAddress() && 
    this.hasPayment()
  );

  constructor() {
    // Try to load persisted cart on initialization
    this.loadPersistedCart();
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
   * @param quantity The quantity to add (default: 1)
   */
  async addItem(productId: string, quantity: number = 1): Promise<void> {
    const cartId = await this.ensureCart();
    if (!cartId) return;

    this.setLoading(true);

    try {
      await firstValueFrom(this.cartService.addItem(cartId, productId, quantity));
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
    const cartId = this.state().cartId;
    if (!cartId) return;

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
    
    // If still no cart, create one
    if (!cartId) {
      await this.createCart();
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
