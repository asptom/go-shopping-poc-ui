import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ErrorHandlerService } from '../core/error/error-handler.service';
import { NotificationService } from '../core/notification/notification.service';
import { 
  Cart, 
  CartItem,
  CartAddress,
  CreateCartRequest, 
  AddItemRequest, 
  UpdateItemRequest,
  SetContactRequest,
  AddAddressRequest,
  SetPaymentRequest 
} from '../models/cart';

/**
 * Service for managing shopping cart operations via the Cart API
 */
@Injectable({
  providedIn: 'root'
})
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/carts`;
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly notificationService = inject(NotificationService);

  /**
   * Creates a new shopping cart
   * @param customerId Optional customer ID for authenticated users
   * @returns Observable of the created Cart
   */
  createCart(customerId?: string): Observable<Cart> {
    const body: CreateCartRequest = customerId ? { customer_id: customerId } : {};
    return this.http.post<Cart>(this.apiUrl, body).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'createCart');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  /**
   * Retrieves a cart by its ID
   * @param cartId The UUID of the cart
   * @returns Observable of the Cart
   */
  getCart(cartId: string): Observable<Cart> {
    return this.http.get<Cart>(`${this.apiUrl}/${cartId}`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'getCart');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  /**
   * Deletes a cart and all its associated data
   * @param cartId The UUID of the cart
   * @returns Observable of void
   */
  deleteCart(cartId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${cartId}`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'deleteCart');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  /**
   * Adds an item to the cart
   * @param cartId The UUID of the cart
   * @param productId The product identifier
   * @param quantity The quantity to add
   * @returns Observable of the created CartItem
   */
  addItem(cartId: string, productId: string, quantity: number): Observable<CartItem> {
    const body: AddItemRequest = { product_id: productId, quantity };
    return this.http.post<CartItem>(`${this.apiUrl}/${cartId}/items`, body).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'addItem');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  /**
   * Updates the quantity of an existing cart item
   * @param cartId The UUID of the cart
   * @param lineNumber The 3-digit line number of the item
   * @param quantity The new quantity
   * @returns Observable of void
   */
  updateItem(cartId: string, lineNumber: string, quantity: number): Observable<void> {
    const body: UpdateItemRequest = { quantity };
    return this.http.put<void>(`${this.apiUrl}/${cartId}/items/${lineNumber}`, body).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'updateItem');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  /**
   * Removes an item from the cart
   * @param cartId The UUID of the cart
   * @param lineNumber The 3-digit line number of the item
   * @returns Observable of void
   */
  removeItem(cartId: string, lineNumber: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${cartId}/items/${lineNumber}`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'removeItem');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  /**
   * Sets or updates contact information for the cart
   * @param cartId The UUID of the cart
   * @param contact The contact information
   * @returns Observable of void
   */
  setContact(cartId: string, contact: SetContactRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${cartId}/contact`, contact).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'setContact');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  /**
   * Adds an address to the cart (shipping or billing)
   * @param cartId The UUID of the cart
   * @param address The address information
   * @returns Observable of the created CartAddress
   */
  addAddress(cartId: string, address: AddAddressRequest): Observable<CartAddress> {
    return this.http.post<CartAddress>(`${this.apiUrl}/${cartId}/addresses`, address).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'addAddress');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  /**
   * Sets or updates payment information for the cart
   * @param cartId The UUID of the cart
   * @param payment The payment information
   * @returns Observable of void
   */
  setPayment(cartId: string, payment: SetPaymentRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${cartId}/payment`, payment).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'setPayment');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  /**
   * Initiates the checkout process
   * @param cartId The UUID of the cart
   * @returns Observable of the updated Cart after checkout
   */
  checkout(cartId: string): Observable<Cart> {
    return this.http.post<Cart>(`${this.apiUrl}/${cartId}/checkout`, {}).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'checkout');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }
}
