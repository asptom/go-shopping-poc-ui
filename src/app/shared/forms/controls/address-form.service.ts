import { Injectable, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Address } from '../../../models/customer';
import { getAddressFormConfig, createAddressFromForm, validateForm } from '../config/form-configs';

@Injectable({
  providedIn: 'root'
})
export class AddressFormService {
  private readonly fb = inject(FormBuilder);

  createAddressForm(): FormGroup {
    // Temporarily use Angular built-in validators to test form functionality
    return this.fb.group({
      address_id: [''],
      address_type: ['shipping', Validators.required],
      first_name: ['', [Validators.required, Validators.maxLength(50)]],
      last_name: ['', [Validators.required, Validators.maxLength(50)]],
      address_1: ['', [Validators.required, Validators.maxLength(100)]],
      address_2: ['', Validators.maxLength(100)],
      city: ['', [Validators.required, Validators.maxLength(50)]],
      state: ['', [Validators.required, Validators.maxLength(2)]],
      zip: ['', [Validators.required, Validators.pattern(/^\d{5}(-\d{4})?$/)]],
      is_default: [false]
    });
  }

  getAddressFormData(form: FormGroup): Address {
    return createAddressFromForm(form.value);
  }

  validateAddressForm(form: FormGroup): { isValid: boolean; errors: string[] } {
    return validateForm(form);
  }

  resetAddressForm(form: FormGroup): void {
    form.reset({
      address_id: '',
      address_type: 'shipping',
      first_name: '',
      last_name: '',
      address_1: '',
      address_2: '',
      city: '',
      state: '',
      zip: '',
      is_default: false
    });
  }
}