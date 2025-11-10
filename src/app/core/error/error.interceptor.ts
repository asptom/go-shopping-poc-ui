import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError, catchError } from 'rxjs';
import { ErrorHandlerService } from './error-handler.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(
    private readonly errorHandler: ErrorHandlerService,
    private readonly notificationService: NotificationService
  ) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, `HTTP ${request.method} ${request.url}`);
        
        // Log the error
        this.errorHandler.logError(appError);
        
        // Show user notification for client errors
        if (error.status && error.status >= 400 && error.status < 500) {
          this.notificationService.showError(appError.userMessage);
        }
        
        // Show server error notification
        if (error.status && error.status >= 500) {
          this.notificationService.showError(appError.userMessage);
        }
        
        return throwError(() => appError);
      })
    );
  }
}