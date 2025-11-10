import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Customer, Address, CreditCard } from '../models/customer';
import { environment } from '../../environments/environment';
import { ErrorHandlerService } from '../core/error/error-handler.service';
import { NotificationService } from '../core/notification/notification.service';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly notificationService = inject(NotificationService);

  getCustomer(email: string): Observable<Customer | null> {
    return this.http.get<Customer>(`${this.apiUrl}/${encodeURIComponent(email)}`).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          // Customer not found, return null
          return [null];
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

  addAddress(customerId: string, address: Address): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${customerId}/addresses`, address).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'addAddress');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  updateAddress(addressId: string, address: Address): Observable<Address> {
    return this.http.put<Address>(`${this.apiUrl}/addresses/${addressId}`, address).pipe(
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

  addCreditCard(customerId: string, card: CreditCard): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${customerId}/credit-cards`, card).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'addCreditCard');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  updateCreditCard(cardId: string, card: CreditCard): Observable<CreditCard> {
    return this.http.put<CreditCard>(`${this.apiUrl}/credit-cards/${cardId}`, card).pipe(
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
}