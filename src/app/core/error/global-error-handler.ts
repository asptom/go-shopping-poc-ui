import { ErrorHandler, Injectable } from '@angular/core';
import { ErrorHandlerService } from './error-handler.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(
    private readonly errorHandler: ErrorHandlerService,
    private readonly notificationService: NotificationService
  ) {}

  handleError(error: any): void {
    const appError = this.errorHandler.handleError(error, 'Global Error Handler');
    
    // Log the error
    this.errorHandler.logError(appError);
    
    // Show user notification for critical errors
    if (appError.severity === 'CRITICAL' || appError.severity === 'HIGH') {
      this.notificationService.showError(appError.userMessage);
    }
    
    // Call default error handler for development
    if (typeof console !== 'undefined') {
      console.error('Global Error Handler caught:', error);
    }
  }
}