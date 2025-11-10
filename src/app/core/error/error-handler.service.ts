import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AppError, ErrorType, ErrorSeverity, ApiError, ValidationError } from './error.types';

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

    let type: ErrorType;
    let severity: ErrorSeverity;
    let userMessage: string;

    switch (error.status) {
      case 400:
        type = ErrorType.VALIDATION;
        severity = ErrorSeverity.MEDIUM;
        userMessage = 'Please check your input and try again.';
        break;
      case 401:
        type = ErrorType.AUTHENTICATION;
        severity = ErrorSeverity.HIGH;
        userMessage = 'Please sign in to continue.';
        break;
      case 403:
        type = ErrorType.AUTHENTICATION;
        severity = ErrorSeverity.HIGH;
        userMessage = 'You do not have permission to perform this action.';
        break;
      case 404:
        type = ErrorType.NOT_FOUND;
        severity = ErrorSeverity.MEDIUM;
        userMessage = 'The requested resource was not found.';
        break;
      case 422:
        type = ErrorType.VALIDATION;
        severity = ErrorSeverity.MEDIUM;
        userMessage = 'The provided data is invalid.';
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        type = ErrorType.SERVER_ERROR;
        severity = ErrorSeverity.HIGH;
        userMessage = 'Server error occurred. Please try again later.';
        break;
      default:
        type = ErrorType.NETWORK;
        severity = ErrorSeverity.MEDIUM;
        userMessage = 'Network error occurred. Please check your connection.';
    }

    return {
      type,
      severity,
      message: error.message,
      userMessage,
      code: error.status.toString(),
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
}