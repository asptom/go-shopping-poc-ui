import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError, catchError } from 'rxjs';
import { ErrorHandlerService } from './error-handler.service';
import { NotificationService } from '../notification/notification.service';

export const ErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const errorHandler = inject(ErrorHandlerService);
  const notificationService = inject(NotificationService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 404) {
        return throwError(() => error);
      }

      const appError = errorHandler.handleError(error, `HTTP ${req.method} ${req.url}`);
      errorHandler.logError(appError);

      if (error.status >= 400) {
        notificationService.showError(appError.userMessage);
      }

      return throwError(() => appError);
    })
  );
};
