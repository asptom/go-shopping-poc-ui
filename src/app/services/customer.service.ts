import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Customer, Address, CreditCard } from '../models/customer';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'https://pocstore.local/customers';

  getCustomer(email: string): Observable<Customer | null> {
    return this.http.get<Customer>(`${this.apiUrl}/${encodeURIComponent(email)}`).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          // Customer not found, return null
          return [null];
        }
        return throwError(() => error);
      })
    );
  }

  createCustomer(customer: Customer): Observable<Customer> {
    return this.http.post<Customer>(this.apiUrl, customer).pipe(
      catchError((error: HttpErrorResponse) => throwError(() => error))
    );
  }

  updateCustomer(customer: Customer): Observable<Customer> {
    return this.http.put<Customer>(this.apiUrl, customer).pipe(
      catchError((error: HttpErrorResponse) => throwError(() => error))
    );
  }

  addAddress(customerId: string, address: Address): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${customerId}/addresses`, address).pipe(
      catchError((error: HttpErrorResponse) => throwError(() => error))
    );
  }

  updateAddress(addressId: string, address: Address): Observable<Address> {
    return this.http.put<Address>(`${this.apiUrl}/addresses/${addressId}`, address).pipe(
      catchError((error: HttpErrorResponse) => throwError(() => error))
    );
  }

  deleteAddress(addressId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/addresses/${addressId}`).pipe(
      catchError((error: HttpErrorResponse) => throwError(() => error))
    );
  }

  addCreditCard(customerId: string, card: CreditCard): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${customerId}/credit-cards`, card).pipe(
      catchError((error: HttpErrorResponse) => throwError(() => error))
    );
  }

  updateCreditCard(cardId: string, card: CreditCard): Observable<CreditCard> {
    return this.http.put<CreditCard>(`${this.apiUrl}/credit-cards/${cardId}`, card).pipe(
      catchError((error: HttpErrorResponse) => throwError(() => error))
    );
  }

  deleteCreditCard(cardId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/credit-cards/${cardId}`).pipe(
      catchError((error: HttpErrorResponse) => throwError(() => error))
    );
  }
}