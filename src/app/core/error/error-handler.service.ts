import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AppError, ErrorType, ErrorSeverity, ApiError, ValidationError, ApiErrorResponse } from './error.types';

@Injectable({
  providedIn: 'root'
})
export class ErrorHandlerService {
  
  handleError(error: any, context?: string): AppError {
    console.error('Error occurred:', error, 'Context:', context);

    if (error instanceof HttpErrorResponse) {
      return this.handleHttpError(error);
    }

    if (this.isValidationError(error)) {
      return this.handleValidationError(error);
    }

    if (this.isNetworkError(error)) {
      return this.handleNetworkError(error);
    }

    return this.handleUnknownError(error);
  }

  private handleHttpError(error: HttpErrorResponse): AppError {
    const apiError: ApiError = {
      status: error.status,
      statusText: error.statusText,
      url: error.url || '',
      message: error.message,
      details: error.error
    };

    // Parse new API error response format
    const apiErrorResponse = this.parseApiErrorResponse(error.error);

    let type: ErrorType;
    let severity: ErrorSeverity;
    let userMessage: string;
    let errorCode: string;

    // First check for specific API error types
    if (apiErrorResponse) {
      type = this.mapApiErrorType(apiErrorResponse.error);
      userMessage = apiErrorResponse.message;
      errorCode = apiErrorResponse.code || error.status.toString();
      severity = this.getSeverityForApiError(type);
    } else {
      // Fallback to HTTP status-based error handling
      const statusBasedError = this.getStatusBasedError(error.status);
      type = statusBasedError.type;
      severity = statusBasedError.severity;
      userMessage = statusBasedError.userMessage;
      errorCode = error.status.toString();
    }

    return {
      type,
      severity,
      message: apiErrorResponse?.message || error.message,
      userMessage,
      code: errorCode,
      details: apiError,
      timestamp: new Date(),
      originalError: error
    };
  }

  private handleValidationError(error: any): AppError {
    return {
      type: ErrorType.VALIDATION,
      severity: ErrorSeverity.MEDIUM,
      message: 'Validation failed',
      userMessage: 'Please correct the highlighted fields and try again.',
      details: error,
      timestamp: new Date(),
      originalError: error
    };
  }

  private handleNetworkError(error: any): AppError {
    return {
      type: ErrorType.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      message: 'Network error',
      userMessage: 'Unable to connect. Please check your internet connection.',
      details: error,
      timestamp: new Date(),
      originalError: error
    };
  }

  private handleUnknownError(error: any): AppError {
    return {
      type: ErrorType.UNKNOWN,
      severity: ErrorSeverity.MEDIUM,
      message: error?.message || 'An unexpected error occurred',
      userMessage: 'Something went wrong. Please try again.',
      details: error,
      timestamp: new Date(),
      originalError: error
    };
  }

  private isValidationError(error: any): boolean {
    return error && (
      error.validationErrors ||
      error.fieldErrors ||
      (Array.isArray(error) && error.some(e => e.field))
    );
  }

  private isNetworkError(error: any): boolean {
    return error && (
      error.name === 'NetworkError' ||
      error.message?.includes('NetworkError') ||
      error.message?.includes('Failed to fetch') ||
      !navigator.onLine
    );
  }

  createUserMessage(error: AppError): string {
    // Additional context-specific messages can be added here
    return error.userMessage;
  }

  logError(error: AppError): void {
    const logLevel = this.getLogLevel(error.severity);
    const logMessage = `[${error.type}] ${error.message}`;
    
    switch (logLevel) {
      case 'error':
        console.error(logMessage, error.details, error.originalError);
        break;
      case 'warn':
        console.warn(logMessage, error.details);
        break;
      default:
        console.log(logMessage, error.details);
    }
  }

  private getLogLevel(severity: ErrorSeverity): 'error' | 'warn' | 'log' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      default:
        return 'log';
    }
  }

  private parseApiErrorResponse(error: any): ApiErrorResponse | null {
    if (error && typeof error === 'object' && error.error && error.message) {
      return {
        error: error.error,
        message: error.message,
        code: error.code
      };
    }
    return null;
  }

  private mapApiErrorType(apiErrorType: string): ErrorType {
    switch (apiErrorType) {
      case 'invalid_request':
        return ErrorType.INVALID_REQUEST;
      case 'validation_error':
        return ErrorType.VALIDATION;
      case 'not_found':
        return ErrorType.NOT_FOUND;
      case 'internal_error':
        return ErrorType.SERVER_ERROR;
      default:
        return ErrorType.UNKNOWN;
    }
  }

  private getSeverityForApiError(errorType: ErrorType): ErrorSeverity {
    switch (errorType) {
      case ErrorType.INVALID_REQUEST:
      case ErrorType.VALIDATION:
        return ErrorSeverity.MEDIUM;
      case ErrorType.NOT_FOUND:
        return ErrorSeverity.MEDIUM;
      case ErrorType.SERVER_ERROR:
        return ErrorSeverity.HIGH;
      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  private getStatusBasedError(status: number): { type: ErrorType; severity: ErrorSeverity; userMessage: string } {
    switch (status) {
      case 400:
        return {
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.MEDIUM,
          userMessage: 'Please check your input and try again.'
        };
      case 401:
        return {
          type: ErrorType.AUTHENTICATION,
          severity: ErrorSeverity.HIGH,
          userMessage: 'Please sign in to continue.'
        };
      case 403:
        return {
          type: ErrorType.AUTHENTICATION,
          severity: ErrorSeverity.HIGH,
          userMessage: 'You do not have permission to perform this action.'
        };
      case 404:
        return {
          type: ErrorType.NOT_FOUND,
          severity: ErrorSeverity.MEDIUM,
          userMessage: 'The requested resource was not found.'
        };
      case 422:
        return {
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.MEDIUM,
          userMessage: 'The provided data is invalid.'
        };
      case 500:
      case 502:
      case 503:
      case 504:
        return {
          type: ErrorType.SERVER_ERROR,
          severity: ErrorSeverity.HIGH,
          userMessage: 'Server error occurred. Please try again later.'
        };
      default:
        return {
          type: ErrorType.NETWORK,
          severity: ErrorSeverity.MEDIUM,
          userMessage: 'Network error occurred. Please check your connection.'
        };
    }
  }
}