import { Injectable, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CreditCard } from '../../../models/customer';
import { getCreditCardFormConfig, createCreditCardFromForm, validateForm } from '../config/form-configs';
import { CustomValidators } from '../validators/custom-validators';

@Injectable({
  providedIn: 'root'
})
export class CreditCardFormService {
  private readonly fb = inject(FormBuilder);

  createCreditCardForm(): FormGroup {
    return this.fb.group({
      card_id: [''],
      card_type: ['visa', Validators.required],
      card_number: ['', [Validators.required, CustomValidators.creditCard()]],
      card_holder_name: ['', [Validators.required, Validators.maxLength(100)]],
      card_expires: ['', [Validators.required, CustomValidators.cardExpiration()]],
      card_cvv: ['', [Validators.required, CustomValidators.cvv()]],
      is_default: [false]
    });
  }

  getCreditCardFormData(form: FormGroup): CreditCard {
    return createCreditCardFromForm(form.value);
  }

  validateCreditCardForm(form: FormGroup): { isValid: boolean; errors: string[] } {
    return validateForm(form);
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
}