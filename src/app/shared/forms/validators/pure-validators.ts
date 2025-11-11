import { AbstractControl, ValidationErrors } from '@angular/forms';

// Pure validation functions - no dependencies, pure input/output
export type ValidationResult = ValidationErrors | null;

// Required field validation
export const required = (message?: string): (control: AbstractControl) => ValidationResult => {
  return (control: AbstractControl): ValidationResult => {
    if (!control.value || control.value.toString().trim() === '') {
      return { required: { message: message || 'This field is required' } };
    }
    return null;
  };
};

// Email validation
export const email = (message?: string): (control: AbstractControl) => ValidationResult => {
  return (control: AbstractControl): ValidationResult => {
    const value = control.value?.toString().trim();
    if (!value) return null;
    
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(value)) {
      return { email: { message: message || 'Please enter a valid email address' } };
    }
    return null;
  };
};

// Phone validation
export const phone = (message?: string): (control: AbstractControl) => ValidationResult => {
  return (control: AbstractControl): ValidationResult => {
    const value = control.value?.toString().trim();
    if (!value) return null;
    
    const phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
    if (!phoneRegex.test(value)) {
      return { phone: { message: message || 'Please enter a valid phone number' } };
    }
    return null;
  };
};

// ZIP code validation
export const zipCode = (message?: string): (control: AbstractControl) => ValidationResult => {
  return (control: AbstractControl): ValidationResult => {
    const value = control.value?.toString().trim();
    if (!value) return null;
    
    const zipRegex = /^\d{5}(-\d{4})?$/;
    if (!zipRegex.test(value)) {
      return { zipCode: { message: message || 'Please enter a valid ZIP code' } };
    }
    return null;
  };
};

// Credit card validation
export const creditCard = (message?: string): (control: AbstractControl) => ValidationResult => {
  return (control: AbstractControl): ValidationResult => {
    const value = control.value?.toString().replace(/\D/g, ''); // Remove non-digits
    if (!value) return null;
    
    // Luhn algorithm for credit card validation
    let sum = 0;
    let isEven = false;
    
    for (let i = value.length - 1; i >= 0; i--) {
      let digit = parseInt(value[i], 10);
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    if (sum % 10 !== 0 || value.length < 13 || value.length > 19) {
      return { creditCard: { message: message || 'Please enter a valid credit card number' } };
    }
    
    return null;
  };
};

// CVV validation
export const cvv = (message?: string): (control: AbstractControl) => ValidationResult => {
  return (control: AbstractControl): ValidationResult => {
    const value = control.value?.toString().replace(/\D/g, ''); // Remove non-digits
    if (!value) return null;
    
    if (value.length !== 3 && value.length !== 4) {
      return { cvv: { message: message || 'Please enter a valid CVV' } };
    }
    
    return null;
  };
};

// Card expiration validation
export const cardExpiration = (message?: string): (control: AbstractControl) => ValidationResult => {
  return (control: AbstractControl): ValidationResult => {
    const value = control.value?.toString().trim();
    if (!value) return null;
    
    // Parse MM/YY format
    const match = value.match(/^(\d{2})\/(\d{2})$/);
    if (!match) {
      return { cardExpiration: { message: message || 'Please enter a valid expiration date (MM/YY)' } };
    }
    
    const month = parseInt(match[1], 10);
    const year = parseInt(match[2], 10) + 2000; // Convert YY to YYYY
    
    if (month < 1 || month > 12) {
      return { cardExpiration: { message: message || 'Please enter a valid month (01-12)' } };
    }
    
    const now = new Date();
    const expiration = new Date(year, month - 1, 1); // month is 0-indexed in Date
    
    // Set to end of month for comparison
    expiration.setMonth(expiration.getMonth() + 1, 0);
    
    if (expiration < now) {
      return { cardExpiration: { message: message || 'Card has expired' } };
    }
    
    return null;
  };
};

// Minimum length validation
export const minLength = (min: number, message?: string): (control: AbstractControl) => ValidationResult => {
  return (control: AbstractControl): ValidationResult => {
    const value = control.value?.toString().trim();
    if (!value) return null;
    
    if (value.length < min) {
      return { minLength: { message: message || `Minimum length is ${min} characters` } };
    }
    
    return null;
  };
};

// Input sanitization
export const sanitize = (message?: string): (control: AbstractControl) => ValidationResult => {
  return (control: AbstractControl): ValidationResult => {
    const value = control.value?.toString().trim();
    if (!value) return null;
    
    // Check for potentially dangerous content
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(value)) {
        return { sanitize: { message: message || 'Invalid characters detected' } };
      }
    }
    
    return null;
  };
};