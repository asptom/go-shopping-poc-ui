import { Injectable, inject } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Customer } from '../../../models/customer';
import { getCustomerFormConfig, createCustomerFromForm, validateForm } from '../config/form-configs';

@Injectable({
  providedIn: 'root'
})
export class CustomerFormService {
  private readonly fb = inject(FormBuilder);

  createCustomerForm(customer?: Partial<Customer>): FormGroup {
    const config = getCustomerFormConfig(customer);
    
    return this.fb.group({
      customer_id: [config.customer_id.value],
      user_name: [config.user_name.value, config.user_name.validators],
      email: [config.email.value, config.email.validators],
      first_name: [config.first_name.value, config.first_name.validators],
      last_name: [config.last_name.value, config.last_name.validators],
      phone: [config.phone.value, config.phone.validators]
    });
  }

  getCustomerFormData(form: FormGroup): Customer {
    return createCustomerFromForm(form.value);
  }

  validateCustomerForm(form: FormGroup): { isValid: boolean; errors: string[] } {
    return validateForm(form);
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