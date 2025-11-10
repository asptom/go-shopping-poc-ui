import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export class CustomValidators {
  
  // Required field validator
  static required(message: string = 'This field is required'): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value || (typeof control.value === 'string' && control.value.trim() === '')) {
        return { required: { message } };
      }
      return null;
    };
  }

  // Email validator
  static email(message: string = 'Please enter a valid email address'): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      
      const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      const isValid = emailPattern.test(control.value);
      
      return isValid ? null : { email: { message } };
    };
  }

  // Phone number validator
  static phone(message: string = 'Please enter a valid phone number'): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      
      const phonePattern = /^\+?[\d\s\-\(\)]+$/;
      const isValid = phonePattern.test(control.value);
      
      return isValid ? null : { phone: { message } };
    };
  }

  // ZIP code validator
  static zipCode(message: string = 'Please enter a valid ZIP code'): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      
      const zipPattern = /^\d{5}(-\d{4})?$/;
      const isValid = zipPattern.test(control.value);
      
      return isValid ? null : { zipCode: { message } };
    };
  }

  // Credit card number validator
  static creditCard(message: string = 'Please enter a valid credit card number'): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      
      // Remove spaces and dashes
      const cleaned = control.value.replace(/[\s-]/g, '');
      
      // Basic validation: 13-19 digits
      if (!/^\d{13,19}$/.test(cleaned)) {
        return { creditCard: { message } };
      }
      
      // Luhn algorithm check
      let sum = 0;
      let isEven = false;
      
      for (let i = cleaned.length - 1; i >= 0; i--) {
        let digit = parseInt(cleaned.charAt(i), 10);
        
        if (isEven) {
          digit *= 2;
          if (digit > 9) {
            digit -= 9;
          }
        }
        
        sum += digit;
        isEven = !isEven;
      }
      
      return sum % 10 === 0 ? null : { creditCard: { message } };
    };
  }

  // Credit card expiration validator
  static cardExpiration(message: string = 'Please enter a valid expiration date'): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      
      const match = control.value.match(/^(\d{2})\/(\d{2})$/);
      if (!match) {
        return { cardExpiration: { message } };
      }
      
      const month = parseInt(match[1], 10);
      const year = parseInt(match[2], 10) + 2000;
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      if (month < 1 || month > 12) {
        return { cardExpiration: { message } };
      }
      
      if (year < currentYear || (year === currentYear && month < currentMonth)) {
        return { cardExpiration: { message } };
      }
      
      return null;
    };
  }

  // CVV validator
  static cvv(message: string = 'Please enter a valid CVV'): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      
      const cvvPattern = /^\d{3,4}$/;
      const isValid = cvvPattern.test(control.value);
      
      return isValid ? null : { cvv: { message } };
    };
  }

  // Minimum length validator
  static minLength(min: number, message?: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      
      const actualMessage = message || `Minimum length is ${min} characters`;
      const isValid = control.value.length >= min;
      
      return isValid ? null : { minLength: { message: actualMessage, requiredLength: min } };
    };
  }

  // Maximum length validator
  static maxLength(max: number, message?: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      
      const actualMessage = message || `Maximum length is ${max} characters`;
      const isValid = control.value.length <= max;
      
      return isValid ? null : { maxLength: { message: actualMessage, requiredLength: max } };
    };
  }

  // Pattern validator
  static pattern(pattern: string | RegExp, message: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      
      const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
      const isValid = regex.test(control.value);
      
      return isValid ? null : { pattern: { message } };
    };
  }

  // Cross-field validator for matching passwords
  static matchField(matchControlName: string, message: string = 'Fields must match'): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.parent) return null;
      
      const matchControl = control.parent.get(matchControlName);
      if (!matchControl) return null;
      
      const isValid = control.value === matchControl.value;
      return isValid ? null : { matchField: { message } };
    };
  }

  // Sanitize input validator
  static sanitize(message: string = 'Invalid characters detected'): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      
      // Check for potentially dangerous characters
      const dangerousPattern = /[<>\"'&]/;
      const hasInvalidChars = dangerousPattern.test(control.value);
      
      return hasInvalidChars ? { sanitize: { message } } : null;
    };
  }
}