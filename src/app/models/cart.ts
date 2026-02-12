// Cart model interfaces matching the Cart Service API specification

/**
 * Core Cart entity representing a shopping cart
 */
export interface Cart {
  cart_id: string;
  customer_id: string | null;
  current_status: 'active' | 'checked_out' | 'completed' | 'cancelled';
  currency: string;
  net_price: number;
  tax: number;
  shipping: number;
  total_price: number;
  created_at: string;
  updated_at: string;
  version: number;
  contact: CartContact | null;
  addresses: CartAddress[];
  credit_card: CartCreditCard | null;
  items: CartItem[];
  status_history: CartStatus[];
}

/**
 * Individual item within a cart
 */
export interface CartItem {
  id: number;
  cart_id: string;
  line_number: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
}

/**
 * Contact information for the cart (required for checkout)
 */
export interface CartContact {
  id: number;
  cart_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
}

/**
 * Address entity for shipping or billing
 */
export interface CartAddress {
  id: number;
  cart_id: string;
  address_type: 'shipping' | 'billing';
  first_name: string;
  last_name: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  zip: string;
}

/**
 * Credit card payment information
 */
export interface CartCreditCard {
  id: number;
  cart_id: string;
  card_type?: string;
  card_number: string;
  card_holder_name: string;
  card_expires: string;
  card_cvv: string;
}

/**
 * Status history entry for the cart
 */
export interface CartStatus {
  id: number;
  cart_id: string;
  cart_status: string;
  status_date_time: string;
}

// Request DTOs for API operations

/**
 * Request body for creating a new cart
 */
export interface CreateCartRequest {
  customer_id?: string;
}

/**
 * Request body for adding an item to the cart
 */
export interface AddItemRequest {
  product_id: string;
  quantity: number;
}

/**
 * Request body for updating item quantity
 */
export interface UpdateItemRequest {
  quantity: number;
}

/**
 * Request body for setting contact information
 */
export interface SetContactRequest {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
}

/**
 * Request body for adding an address
 */
export interface AddAddressRequest {
  address_type: 'shipping' | 'billing';
  first_name: string;
  last_name: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  zip: string;
}

/**
 * Request body for setting payment information
 */
export interface SetPaymentRequest {
  card_type?: string;
  card_number: string;
  card_holder_name: string;
  card_expires: string;
  card_cvv: string;
}

// UI State interfaces

/**
 * Cart state interface for the CartStore
 */
export interface CartStoreState {
  cart: Cart | null;
  cartId: string | null;
  loading: boolean;
  error: string | null;
  checkoutStep: 'cart' | 'contact' | 'shipping' | 'payment' | 'review' | 'confirmation';
}
