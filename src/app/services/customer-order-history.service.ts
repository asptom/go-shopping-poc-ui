import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, timeout, catchError, throwError } from 'rxjs';
import { OrderHistoryItem } from '../models/order';
import { environment } from '../../environments/environment';
import { ErrorHandlerService } from '../core/error/error-handler.service';

@Injectable({
  providedIn: 'root'
})
export class CustomerOrderHistoryService {
  private readonly http = inject(HttpClient);
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly apiUrl = environment.apiUrl + "/orders/customer";

  getCustomerOrders(customerId: string): Observable<OrderHistoryItem[]> {
    return this.http.get<OrderHistoryItem[]>(`${this.apiUrl}/${customerId}`).pipe(
      timeout(10000),
      catchError((error: HttpErrorResponse | any) => {
        // 404 means no orders yet — return empty array (not an error)
        if (error instanceof HttpErrorResponse && error.status === 404) {
          return of([]);
        }
        // 401/403 means auth failure — re-throw so the component can show an error
        if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
          const appError = this.errorHandler.handleError(error, 'getCustomerOrders');
          return throwError(() => appError);
        }
        // Timeout or other errors — log and return empty to avoid breaking the page
        console.warn('[CustomerOrderHistoryService] getCustomerOrders failed:', error);
        return of([]);
      })
    );
  }
}