import { Injectable, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Address } from '../../../models/customer';
import { CustomValidators } from '../validators/custom-validators';

@Injectable({
  providedIn: 'root'
})
export class AddressFormService {
  private readonly fb = inject(FormBuilder);

  createAddressForm(address?: Partial<Address>): FormGroup {
    return this.fb.group({
      address_id: [address?.address_id || ''],
      address_type: [address?.address_type || 'shipping', Validators.required],
      first_name: [
        address?.first_name || '', 
        [CustomValidators.required('First name is required'), CustomValidators.sanitize()]
      ],
      last_name: [
        address?.last_name || '', 
        [CustomValidators.required('Last name is required'), CustomValidators.sanitize()]
      ],
      address_1: [
        address?.address_1 || '', 
        [CustomValidators.required('Address is required'), CustomValidators.sanitize()]
      ],
      address_2: [address?.address_2 || '', CustomValidators.sanitize()],
      city: [
        address?.city || '', 
        [CustomValidators.required('City is required'), CustomValidators.sanitize()]
      ],
      state: [
        address?.state || '', 
        [CustomValidators.required('State is required'), CustomValidators.minLength(2, 'State must be 2 characters')]
      ],
      zip: [
        address?.zip || '', 
        [CustomValidators.required('ZIP code is required'), CustomValidators.zipCode()]
      ],
      is_default: [address?.is_default || false]
    });
  }

  getAddressFormData(form: FormGroup): Address {
    const formValue = form.value;
    return {
      ...formValue,
      address_id: formValue.address_id || undefined
    };
  }

  validateAddressForm(form: FormGroup): { isValid: boolean; errors: string[] } {
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