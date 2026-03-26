/**
 * Order model interfaces for SSE events, order confirmation, and order history
 */

/**
 * A single line item within an order from the order history API
 */
export interface OrderLineItem {
  line_number?: string;
  product_id?: string;
  product_name?: string;
  description?: string;
  quantity: number;
  unit_price?: number;
  price?: number;
}

/**
 * Status history entry for order tracking
 */
export interface StatusHistoryEntry {
  status: string;
  timestamp: string;
}

/**
 * An order as returned by GET /orders/customer/{customerId}
 */
export interface OrderHistoryItem {
  order_id: string;
  order_number: string;
  created_at?: string;
  status?: string;
  total_price?: number;
  total?: number;
  net_price?: number;
  items: OrderLineItem[];
  status_history: StatusHistoryEntry[];
}

/**
 * Order data received from SSE order.created event
 * Matches backend payload structure (snake_case)
 */
export interface OrderCreatedEvent {
  order_id: string;
  order_number: string;
  cart_id: string;
  total: number;
}

/**
 * Order confirmation data stored in state
 */
export interface OrderConfirmation {
  orderId: string;
  orderNumber: string;
  cartId: string;
  total: number;
  createdAt: Date;
}

/**
 * SSE connection states
 */
export type SSEConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'closed';

/**
 * SSE connection state with signals
 */
export interface SSEConnectionState {
  status: SSEConnectionStatus;
  error: string | null;
  lastEventId: string | null;
}

/**
 * Checkout process states
 */
export type CheckoutStatus = 
  | 'idle' 
  | 'submitting' 
  | 'awaiting_order' 
  | 'order_received' 
  | 'error';

/**
 * Order store state interface
 */
export interface OrderStoreState {
  orderConfirmation: OrderConfirmation | null;
  checkoutStatus: CheckoutStatus;
  connectionState: SSEConnectionState;
  error: string | null;
}
