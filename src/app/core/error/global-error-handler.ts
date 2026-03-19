import { ErrorHandler, inject } from '@angular/core';
import { ErrorHandlerService } from './error-handler.service';
import { NotificationService } from '../notification/notification.service';
import { ErrorSeverity } from './error.types';

export class GlobalErrorHandler implements ErrorHandler {
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly notificationService = inject(NotificationService);

  handleError(error: unknown): void {
    const appError = this.errorHandler.handleError(error, 'Global Error Handler');
    this.errorHandler.logError(appError);

    if (
      appError.severity === ErrorSeverity.CRITICAL ||
      appError.severity === ErrorSeverity.HIGH
    ) {
      this.notificationService.showError(appError.userMessage);
    }
  }
}
