import { Injectable, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Customer } from '../../../models/customer';
import { CustomValidators } from '../validators/custom-validators';

@Injectable({
  providedIn: 'root'
})
export class CustomerFormService {
  private readonly fb = inject(FormBuilder);

  createCustomerForm(customer?: Partial<Customer>): FormGroup {
    return this.fb.group({
      customer_id: [customer?.customer_id || ''],
      user_name: [customer?.user_name || '', Validators.required],
      email: [
        customer?.email || '', 
        [CustomValidators.required('Email is required'), CustomValidators.email()]
      ],
      first_name: [
        customer?.first_name || '', 
        [CustomValidators.required('First name is required'), CustomValidators.sanitize()]
      ],
      last_name: [
        customer?.last_name || '', 
        [CustomValidators.required('Last name is required'), CustomValidators.sanitize()]
      ],
      phone: [
        customer?.phone || '', 
        [CustomValidators.phone()]
      ]
    });
  }

  getCustomerFormData(form: FormGroup): Customer {
    const formValue = form.value;
    return {
      ...formValue,
      addresses: [],
      credit_cards: [],
      customer_statuses: []
    };
  }

  validateCustomerForm(form: FormGroup): { isValid: boolean; errors: string[] } {
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

  resetCustomerForm(form: FormGroup): void {
    form.reset({
      customer_id: '',
      user_name: '',
      email: '',
      first_name: '',
      last_name: '',
      phone: ''
    });
  }

  patchCustomerForm(form: FormGroup, customer: Customer): void {
    form.patchValue({
      customer_id: customer.customer_id,
      user_name: customer.user_name,
      email: customer.email,
      first_name: customer.first_name,
      last_name: customer.last_name,
      phone: customer.phone
    });
  }
}