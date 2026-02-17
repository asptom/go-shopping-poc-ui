import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { OrderSseService } from '../../services/order-sse.service';
import { CartService } from '../../services/cart.service';
import { NotificationService } from '../../core/notification/notification.service';
import { 
  OrderConfirmation, 
  OrderCreatedEvent,
  OrderStoreState,
  CheckoutStatus 
} from '../../models/order';

/**
 * OrderStore manages order state and SSE connections
 * Separates order concerns from CartStore for better architecture
 */
@Injectable({
  providedIn: 'root'
})
export class OrderStore {
  private readonly orderSseService = inject(OrderSseService);
  private readonly cartService = inject(CartService);
  private readonly notificationService = inject(NotificationService);

  // Private state signal
  private readonly state = signal<OrderStoreState>({
    orderConfirmation: null,
    checkoutStatus: 'idle',
    connectionState: {
      status: 'idle',
      error: null,
      lastEventId: null
    },
    error: null
  });

  // Public computed selectors
  readonly orderConfirmation = computed(() => this.state().orderConfirmation);
  readonly checkoutStatus = computed(() => this.state().checkoutStatus);
  readonly connectionState = computed(() => this.state().connectionState);
  readonly error = computed(() => this.state().error);
  readonly isSubmitting = computed(() => this.state().checkoutStatus === 'submitting');
  readonly isAwaitingOrder = computed(() => this.state().checkoutStatus === 'awaiting_order');
  readonly hasOrder = computed(() => !!this.state().orderConfirmation);

  // Track active SSE subscriptions for cleanup
  private sseSubscriptions: (() => void)[] = [];

  /**
   * Initiates checkout and waits for order creation via SSE
   * @param cartId The cart ID to checkout
   * @returns Promise resolving to order confirmation or null
   */
  async checkout(cartId: string): Promise<OrderConfirmation | null> {
    // Reset state
    this.state.set({
      orderConfirmation: null,
      checkoutStatus: 'submitting',
      connectionState: {
        status: 'idle',
        error: null,
        lastEventId: null
      },
      error: null
    });

    try {
      // Step 1: Initiate checkout via HTTP
      console.log('[OrderStore] Initiating checkout for cart:', cartId);
      await firstValueFrom(this.cartService.checkout(cartId));
      
      console.log('[OrderStore] Checkout initiated, connecting to SSE stream...');
      
      // Step 2: Set awaiting state
      this.state.update(s => ({
        ...s,
        checkoutStatus: 'awaiting_order'
      }));

      // Step 3: Subscribe to SSE events before connecting
      this.subscribeToSseEvents();

      // Step 4: Connect to SSE
      await this.orderSseService.connect(cartId);
      
      // Step 5: Wait for order.created event with timeout
      const orderConfirmation = await this.waitForOrderCreated(30000);
      
      if (orderConfirmation) {
        this.state.update(s => ({
          ...s,
          orderConfirmation,
          checkoutStatus: 'order_received',
          error: null
        }));
        
        this.notificationService.showSuccess(
          `Order ${orderConfirmation.orderNumber} placed successfully!`
        );
      }
      
      return orderConfirmation;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Checkout failed';
      console.error('[OrderStore] Checkout error:', errorMessage);
      
      this.state.update(s => ({
        ...s,
        checkoutStatus: 'error',
        error: errorMessage
      }));
      
      this.notificationService.showError(errorMessage);
      return null;
    }
  }

  /**
   * Subscribe to SSE service events
   */
  private subscribeToSseEvents(): void {
    // Clear any existing subscriptions
    this.cleanupSseSubscriptions();

    // Subscribe to order created
    const orderSub = this.orderSseService.orderCreated.subscribe({
      next: (event: OrderCreatedEvent) => {
        console.log('[OrderStore] Order created event received:', event);
        // Order created - state will be updated by waitForOrderCreated
      },
      error: (error: Error) => {
        console.error('[OrderStore] Order created stream error:', error);
      }
    });

    // Subscribe to connection errors for retry logic
    const errorSub = this.orderSseService.connectionError.subscribe({
      next: (error: Error) => {
        console.warn('[OrderStore] SSE connection error:', error.message);
        this.state.update(s => ({
          ...s,
          connectionState: {
            ...s.connectionState,
            status: 'error',
            error: error.message
          }
        }));
        
        // Attempt reconnection
        this.orderSseService.attemptReconnect();
      }
    });

    this.sseSubscriptions.push(
      () => orderSub.unsubscribe(),
      () => errorSub.unsubscribe()
    );
  }

  /**
   * Waits for order.created event with timeout
   * @param timeoutMs Timeout in milliseconds
   * @returns Promise resolving to OrderConfirmation or null
   */
  private waitForOrderCreated(timeoutMs: number): Promise<OrderConfirmation | null> {
    return new Promise((resolve) => {
      let resolved = false;

      // Set timeout
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.warn('[OrderStore] Order creation timeout');
          this.cleanupSseSubscriptions();
          this.orderSseService.disconnect();
          resolve(null);
        }
      }, timeoutMs);

      // Subscribe to order created
      const subscription = this.orderSseService.orderCreated.subscribe({
        next: (event: OrderCreatedEvent) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            
            const confirmation: OrderConfirmation = {
              orderId: event.orderId,
              orderNumber: event.orderNumber,
              cartId: event.cartId,
              total: event.total,
              createdAt: new Date()
            };
            
            this.cleanupSseSubscriptions();
            resolve(confirmation);
          }
        },
        error: () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            this.cleanupSseSubscriptions();
            resolve(null);
          }
        }
      });

      this.sseSubscriptions.push(() => subscription.unsubscribe());
    });
  }

  /**
   * Clears order confirmation and resets state
   * Call after leaving confirmation page
   */
  clearOrder(): void {
    this.state.set({
      orderConfirmation: null,
      checkoutStatus: 'idle',
      connectionState: {
        status: 'idle',
        error: null,
        lastEventId: null
      },
      error: null
    });
    this.cleanupSseSubscriptions();
    this.orderSseService.disconnect();
  }

  /**
   * Retry checkout after error
   */
  async retryCheckout(cartId: string): Promise<OrderConfirmation | null> {
    this.clearOrder();
    return this.checkout(cartId);
  }

  /**
   * Clean up SSE subscriptions
   */
  private cleanupSseSubscriptions(): void {
    this.sseSubscriptions.forEach(unsub => unsub());
    this.sseSubscriptions = [];
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    this.cleanupSseSubscriptions();
    this.orderSseService.cleanup();
  }
}
