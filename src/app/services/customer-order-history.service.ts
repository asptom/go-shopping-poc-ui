import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, timeout, catchError } from 'rxjs';
import { OrderHistoryItem } from '../models/order';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CustomerOrderHistoryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl + "/orders/customer";

  getCustomerOrders(customerId: string): Observable<OrderHistoryItem[]> {
    return this.http.get<OrderHistoryItem[]>(`${this.apiUrl}/${customerId}`).pipe(
      timeout(10000),
      catchError((error: HttpErrorResponse | any) => {
        return of([]);
      })
    );
  }
}