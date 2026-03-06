import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { OrderConfirmation } from '../models/order';
import { environment } from '../../environments/environment';
import { ErrorHandlerService } from '../core/error/error-handler.service';
import { NotificationService } from '../core/notification/notification.service';

@Injectable({
  providedIn: 'root'
})
export class CustomerOrderHistoryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl + "/orders/customer";
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly notificationService = inject(NotificationService);

  getCustomerOrders(customerId: string): Observable<OrderConfirmation[]> {
    return this.http.get<OrderConfirmation[]>(`${this.apiUrl}/${customerId}`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'getCustomerOrders');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }
}