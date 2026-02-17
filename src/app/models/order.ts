/**
 * Order model interfaces for SSE events and order confirmation
 */

/**
 * Order data received from SSE order.created event
 * Matches backend payload structure
 */
export interface OrderCreatedEvent {
  orderId: string;
  orderNumber: string;
  cartId: string;
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
