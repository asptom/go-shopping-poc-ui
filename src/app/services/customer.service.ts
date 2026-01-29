import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Customer, Address, CreditCard, CreateAddressRequest, CreateCreditCardRequest } from '../models/customer';
import { environment } from '../../environments/environment';
import { ErrorHandlerService } from '../core/error/error-handler.service';
import { NotificationService } from '../core/notification/notification.service';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl + "/customers";
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly notificationService = inject(NotificationService);

  getCustomer(email: string): Observable<Customer | null> {
    return this.http.get<Customer>(`${this.apiUrl}/${encodeURIComponent(email)}`).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          // Customer not found, return null
          return of(null);
        }
        const appError = this.errorHandler.handleError(error, 'getCustomer');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  createCustomer(customer: Customer): Observable<Customer> {
    return this.http.post<Customer>(this.apiUrl, customer).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'createCustomer');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  updateCustomer(customer: Customer): Observable<Customer> {
    return this.http.put<Customer>(this.apiUrl, customer).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'updateCustomer');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  patchCustomer(customerId: string, updates: Partial<Customer>): Observable<Customer> {
    return this.http.patch<Customer>(`${this.apiUrl}/${customerId}`, updates).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'patchCustomer');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  addAddress(customerId: string, address: CreateAddressRequest): Observable<Address> {
    return this.http.post<Address>(`${this.apiUrl}/${customerId}/addresses`, address).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'addAddress');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  updateAddress(addressId: string, address: Address): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/addresses/${addressId}`, address).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'updateAddress');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  deleteAddress(addressId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/addresses/${addressId}`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'deleteAddress');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  addCreditCard(customerId: string, card: CreateCreditCardRequest): Observable<CreditCard> {
    return this.http.post<CreditCard>(`${this.apiUrl}/${customerId}/credit-cards`, card).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'addCreditCard');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  updateCreditCard(cardId: string, card: CreditCard): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/credit-cards/${cardId}`, card).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'updateCreditCard');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  deleteCreditCard(cardId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/credit-cards/${cardId}`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'deleteCreditCard');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  // Default management methods
  setDefaultShippingAddress(customerId: string, addressId: string): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${customerId}/default-shipping-address/${addressId}`, {}).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'setDefaultShippingAddress');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  setDefaultBillingAddress(customerId: string, addressId: string): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${customerId}/default-billing-address/${addressId}`, {}).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'setDefaultBillingAddress');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  setDefaultCreditCard(customerId: string, cardId: string): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${customerId}/default-credit-card/${cardId}`, {}).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'setDefaultCreditCard');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  clearDefaultShippingAddress(customerId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${customerId}/default-shipping-address`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'clearDefaultShippingAddress');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  clearDefaultBillingAddress(customerId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${customerId}/default-billing-address`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'clearDefaultBillingAddress');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  clearDefaultCreditCard(customerId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${customerId}/default-credit-card`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'clearDefaultCreditCard');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }
}