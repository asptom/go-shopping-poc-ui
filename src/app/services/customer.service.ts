import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Customer } from '../models/customer';

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

  // Placeholder for future update methods
  // updateCustomer(customer: Customer): Observable<Customer> {
  //   return this.http.put<Customer>(`${this.apiUrl}/${customer.customer_id}`, customer);
  // }

  // updateAddress(customerId: string, address: Address): Observable<Customer> {
  //   // Implementation for updating specific address
  // }

  // updateCreditCard(customerId: string, card: CreditCard): Observable<Customer> {
  //   // Implementation for updating specific credit card
  // }
}