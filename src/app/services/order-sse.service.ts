import { Injectable, signal, computed } from '@angular/core';
import { environment } from '../../environments/environment';
import { 
  OrderCreatedEvent, 
  SSEConnectionState, 
  SSEConnectionStatus 
} from '../models/order';
import { 
  CartItemValidatedEvent, 
  CartItemBackorderEvent 
} from '../models/cart';
import { Subject } from 'rxjs';

/**
 * Service for managing Server-Sent Events (SSE) connections
 * Uses native EventSource API with signals for reactive state
 *
 * Handles both order completion events and cart item validation events
 * on a single SSE connection to /carts/{cartId}/stream
 */
@Injectable({
  providedIn: 'root'
})
export class OrderSseService {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3;
  private readonly reconnectDelay = 1000;
  private cartId: string | null = null;
  
  // Private state signals
  private readonly _connectionState = signal<SSEConnectionState>({
    status: 'idle',
    error: null,
    lastEventId: null
  });

  // Public computed state
  readonly connectionState = computed(() => this._connectionState());
  readonly isConnected = computed(() => this._connectionState().status === 'connected');
  readonly isConnecting = computed(() => this._connectionState().status === 'connecting');
  readonly hasError = computed(() => this._connectionState().status === 'error');

  // Event streams as Subjects for reactive handling
  private readonly orderCreated$ = new Subject<OrderCreatedEvent>();
  private readonly cartItemValidated$ = new Subject<CartItemValidatedEvent>();
  private readonly cartItemBackorder$ = new Subject<CartItemBackorderEvent>();
  private readonly connectionError$ = new Subject<Error>();
  private readonly connected$ = new Subject<string>();

  // Public observables for consumers
  readonly orderCreated = this.orderCreated$.asObservable();
  readonly cartItemValidated = this.cartItemValidated$.asObservable();
  readonly cartItemBackorder = this.cartItemBackorder$.asObservable();
  readonly connectionError = this.connectionError$.asObservable();
  readonly connected = this.connected$.asObservable();

  /**
   * Establishes SSE connection for a specific cart
   * @param cartId The cart ID to subscribe to
   * @returns Promise that resolves when connected, rejects on fatal error
   */
  connect(cartId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Reuse existing connection if already connected to the same cart
      if (this.eventSource && this.cartId === cartId && this._connectionState().status === 'connected') {
        resolve();
        return;
      }

      // Prevent multiple connections - disconnect if different cart
      if (this.eventSource) {
        this.disconnect();
      }

      this.cartId = cartId;
      this.reconnectAttempts = 0;

      this._connectionState.set({
        status: 'connecting',
        error: null,
        lastEventId: null
      });

      const url = `${environment.apiUrl}/carts/${cartId}/stream`;

      try {
        this.eventSource = new EventSource(url);
        this.setupEventHandlers(resolve, reject);
      } catch (error) {
        console.error('[SSE] Failed to create EventSource:', error);
        this._connectionState.set({
          status: 'error',
          error: 'Failed to create SSE connection',
          lastEventId: null
        });
        reject(error);
      }
    });
  }

  /**
   * Sets up EventSource event handlers
   */
  private setupEventHandlers(
    resolve: () => void, 
    reject: (error: Error) => void
  ): void {
    if (!this.eventSource) return;

    // Handle connection open
    this.eventSource.onopen = () => {
      this.reconnectAttempts = 0;
      this._connectionState.update(state => ({
        ...state,
        status: 'connected',
        error: null
      }));
      resolve();
    };

    // Handle connected event
    this.eventSource.addEventListener('connected', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        this.connected$.next(data.cart_id);
      } catch (e) {
        console.error('[SSE] Failed to parse connected event:', e);
      }
    });

    // Handle order.created event
    this.eventSource.addEventListener('order.created', (event: MessageEvent) => {
      try {
        const data: OrderCreatedEvent = JSON.parse(event.data);

        this._connectionState.update(state => ({
          ...state,
          lastEventId: event.lastEventId || null
        }));

        this.orderCreated$.next(data);

        // Auto-disconnect after receiving order
        this.disconnect();
      } catch (e) {
        console.error('[SSE] Failed to parse order.created event:', e);
      }
    });

    // Handle cart.item.validated event
    this.eventSource.addEventListener('cart.item.validated', (event: MessageEvent) => {

      try {
        const data: CartItemValidatedEvent = JSON.parse(event.data);

        this._connectionState.update(state => ({
          ...state,
          lastEventId: event.lastEventId || null
        }));

        this.cartItemValidated$.next(data);
      } catch (e) {
        console.error('[SSE] Failed to parse cart.item.validated event:', e);
      }
    });

    // Handle cart.item.backorder event
    this.eventSource.addEventListener('cart.item.backorder', (event: MessageEvent) => {

      try {
        const data: CartItemBackorderEvent = JSON.parse(event.data);

        this._connectionState.update(state => ({
          ...state,
          lastEventId: event.lastEventId || null
        }));

        this.cartItemBackorder$.next(data);
      } catch (e) {
        console.error('[SSE] Failed to parse cart.item.backorder event:', e);
      }
    });

    // Catch-all for any other events
    this.eventSource.onmessage = (event) => {
    };

    // Handle errors
    this.eventSource.onerror = (error) => {
      console.error('[SSE] ❌ Connection error occurred');

      const readyState = this.eventSource?.readyState;
      const wasConnected = this._connectionState().status === 'connected';

      // EventSource.CLOSED = 2
      if (readyState === EventSource.CLOSED) {
        console.error('[SSE] Connection was closed unexpectedly');
        this._connectionState.set({
          status: 'error',
          error: 'Connection closed unexpectedly',
          lastEventId: this._connectionState().lastEventId
        });

        this.connectionError$.next(new Error('Connection closed'));

        // Only reject if we haven't connected yet
        if (!wasConnected) {
          reject(new Error('Failed to establish SSE connection'));
        }
      }
    };
  }

  /**
   * Disconnects the SSE connection and cleans up
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    this.cartId = null;
    this.reconnectAttempts = 0;
    
    this._connectionState.set({
      status: 'closed',
      error: null,
      lastEventId: null
    });
  }

  /**
   * Attempts to reconnect with exponential backoff
   * Call this from OrderStore when connectionError is received
   */
  attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SSE] Max reconnection attempts reached');
      this._connectionState.set({
        status: 'error',
        error: 'Max reconnection attempts reached',
        lastEventId: this._connectionState().lastEventId
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    

    setTimeout(() => {
      if (this.cartId) {
        this.connect(this.cartId).catch(() => {
          // Reconnection failed, will try again if attempts remain
        });
      }
    }, delay);
  }

  /**
   * Clean up resources when service is destroyed
   */
  cleanup(): void {
    this.disconnect();
    this.orderCreated$.complete();
    this.cartItemValidated$.complete();
    this.cartItemBackorder$.complete();
    this.connectionError$.complete();
    this.connected$.complete();
  }
}
