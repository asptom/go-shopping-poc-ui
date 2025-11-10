import { Injectable, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CreditCard } from '../../../models/customer';
import { CustomValidators } from '../validators/custom-validators';

@Injectable({
  providedIn: 'root'
})
export class CreditCardFormService {
  private readonly fb = inject(FormBuilder);

  createCreditCardForm(card?: Partial<CreditCard>): FormGroup {
    return this.fb.group({
      card_id: [card?.card_id || ''],
      card_type: [card?.card_type || 'visa', Validators.required],
      card_number: [
        card?.card_number || '', 
        [CustomValidators.required('Card number is required'), CustomValidators.creditCard()]
      ],
      card_holder_name: [
        card?.card_holder_name || '', 
        [CustomValidators.required('Cardholder name is required'), CustomValidators.sanitize()]
      ],
      card_expires: [
        card?.card_expires || '', 
        [CustomValidators.required('Expiration date is required'), CustomValidators.cardExpiration()]
      ],
      card_cvv: [
        card?.card_cvv || '', 
        [CustomValidators.required('CVV is required'), CustomValidators.cvv()]
      ],
      is_default: [card?.is_default || false]
    });
  }

  getCreditCardFormData(form: FormGroup): CreditCard {
    const formValue = form.value;
    return {
      ...formValue,
      card_id: formValue.card_id || undefined
    };
  }

  validateCreditCardForm(form: FormGroup): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (form.invalid) {
      Object.keys(form.controls).forEach(key => {
        const control = form.get(key);
        if (control?.invalid && control?.errors) {
          Object.values(control.errors).forEach((error: any) => {
            if (error?.message) {
              errors.push(error.message);
            }
          });
        }
      });
    }

    return {
      isValid: form.valid && errors.length === 0,
      errors
    };
  }

  resetCreditCardForm(form: FormGroup): void {
    form.reset({
      card_id: '',
      card_type: 'visa',
      card_number: '',
      card_holder_name: '',
      card_expires: '',
      card_cvv: '',
      is_default: false
    });
  }

  maskCardNumber(cardNumber: string): string {
    if (!cardNumber || cardNumber.length < 4) return cardNumber;
    const last4 = cardNumber.slice(-4);
    return '**** **** **** ' + last4;
  }

  formatCardNumber(cardNumber: string): string {
    // Remove all non-digit characters
    const cleaned = cardNumber.replace(/\D/g, '');
    
    // Add spaces every 4 digits
    const formatted = cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
    
    return formatted.trim();
  }

  formatExpiration(expiration: string): string {
    // Remove all non-digit characters
    const cleaned = expiration.replace(/\D/g, '');
    
    // Add slash after 2 digits
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
    }
    
    return cleaned;
  }
}