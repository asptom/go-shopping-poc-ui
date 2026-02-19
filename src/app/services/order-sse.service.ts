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

function camelToSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function convertKeysToSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key in obj) {
    const snakeKey = camelToSnakeCase(key);
    result[snakeKey] = obj[key];
  }
  return result;
}

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
        console.log('[SSE] Reusing existing connection for cart:', cartId);
        resolve();
        return;
      }

      // Prevent multiple connections - disconnect if different cart
      if (this.eventSource) {
        console.log('[SSE] Disconnecting existing connection before creating new one');
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
      console.log(`[SSE] Connecting to: ${url}`);
      console.log(`[SSE] Cart ID: ${cartId}`);

      try {
        this.eventSource = new EventSource(url);
        console.log('[SSE] EventSource created successfully');
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
      console.log('[SSE] Connection opened for cart:', this.cartId);
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
        console.log('[SSE] Connected event received:', data);
        this.connected$.next(data.cartId);
      } catch (e) {
        console.error('[SSE] Failed to parse connected event:', e);
      }
    });

    // Handle order.created event
    this.eventSource.addEventListener('order.created', (event: MessageEvent) => {
      console.log('[SSE] ➡️ RAW order.created event received:', event.data);
      try {
        const data: OrderCreatedEvent = JSON.parse(event.data);
        console.log('[SSE] ✅ Parsed order.created event:', data);

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
      console.log('[SSE] ➡️ RAW cart.item.validated event received:');
      console.log('  - Event type:', event.type);
      console.log('  - Event lastEventId:', event.lastEventId);
      console.log('  - Raw event data:', event.data);

      try {
        const parsed = JSON.parse(event.data);
        const data: CartItemValidatedEvent = convertKeysToSnakeCase(parsed) as unknown as CartItemValidatedEvent;
        console.log('[SSE] ✅ Parsed cart.item.validated event:', data);
        console.log('  - line_number:', data.line_number);
        console.log('  - product_id:', data.product_id);
        console.log('  - status:', data.status);
        console.log('  - product_name:', data.product_name);

        this._connectionState.update(state => ({
          ...state,
          lastEventId: event.lastEventId || null
        }));

        this.cartItemValidated$.next(data);
        console.log('[SSE] 📤 Emitted cartItemValidated$ event');
      } catch (e) {
        console.error('[SSE] ❌ Failed to parse cart.item.validated event:', e);
        console.error('  - Raw data that failed:', event.data);
      }
    });

    // Handle cart.item.backorder event
    this.eventSource.addEventListener('cart.item.backorder', (event: MessageEvent) => {
      console.log('[SSE] ➡️ RAW cart.item.backorder event received:');
      console.log('  - Event type:', event.type);
      console.log('  - Event lastEventId:', event.lastEventId);
      console.log('  - Raw event data:', event.data);

      try {
        const parsed = JSON.parse(event.data);
        const data: CartItemBackorderEvent = convertKeysToSnakeCase(parsed) as unknown as CartItemBackorderEvent;
        console.log('[SSE] ✅ Parsed cart.item.backorder event:', data);
        console.log('  - line_number:', data.line_number);
        console.log('  - product_id:', data.product_id);
        console.log('  - status:', data.status);
        console.log('  - backorder_reason:', data.backorder_reason);

        this._connectionState.update(state => ({
          ...state,
          lastEventId: event.lastEventId || null
        }));

        this.cartItemBackorder$.next(data);
        console.log('[SSE] 📤 Emitted cartItemBackorder$ event');
      } catch (e) {
        console.error('[SSE] ❌ Failed to parse cart.item.backorder event:', e);
        console.error('  - Raw data that failed:', event.data);
      }
    });

    // Catch-all for any other events
    this.eventSource.onmessage = (event) => {
      console.log('[SSE] 📬 Unhandled message event:', event.type, event.data);
    };

    // Handle errors
    this.eventSource.onerror = (error) => {
      console.error('[SSE] ❌ Connection error occurred');
      console.error('  - Error object:', error);

      const readyState = this.eventSource?.readyState;
      const wasConnected = this._connectionState().status === 'connected';

      console.log(`[SSE] Connection state: readyState=${readyState}, wasConnected=${wasConnected}`);
      console.log(`[SSE] ReadyState meanings: CONNECTING=0, OPEN=1, CLOSED=2`);

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
      console.log('[SSE] Disconnecting...');
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
    
    console.log(`[SSE] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

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
