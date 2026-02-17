import { Injectable, signal, computed } from '@angular/core';
import { environment } from '../../environments/environment';
import { 
  OrderCreatedEvent, 
  SSEConnectionState, 
  SSEConnectionStatus 
} from '../models/order';
import { Subject } from 'rxjs';

/**
 * Service for managing Server-Sent Events (SSE) connections
 * Uses native EventSource API with signals for reactive state
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
  private readonly connectionError$ = new Subject<Error>();
  private readonly connected$ = new Subject<string>();

  // Public observables for consumers
  readonly orderCreated = this.orderCreated$.asObservable();
  readonly connectionError = this.connectionError$.asObservable();
  readonly connected = this.connected$.asObservable();

  /**
   * Establishes SSE connection for a specific cart
   * @param cartId The cart ID to subscribe to
   * @returns Promise that resolves when connected, rejects on fatal error
   */
  connect(cartId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Prevent multiple connections
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
      try {
        const data: OrderCreatedEvent = JSON.parse(event.data);
        console.log('[SSE] Order created event received:', data);
        
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

    // Handle errors
    this.eventSource.onerror = (error) => {
      console.error('[SSE] Connection error:', error);
      
      const readyState = this.eventSource?.readyState;
      const wasConnected = this._connectionState().status === 'connected';
      
      // EventSource.CLOSED = 2
      if (readyState === EventSource.CLOSED) {
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
    this.connectionError$.complete();
    this.connected$.complete();
  }
}
