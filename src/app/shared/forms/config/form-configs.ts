import { FormControl, FormGroup } from '@angular/forms';
import { Customer, Address, CreditCard, CreateAddressRequest, CreateCreditCardRequest } from '../../../models/customer';
import * as validators from '../validators/pure-validators';

// Pure form configuration functions - no dependencies, pure input/output

export type FormFieldConfig = {
  value: any;
  validators: ((control: FormControl) => validators.ValidationResult)[];
};

export type CustomerFormConfig = {
  customer_id: FormFieldConfig;
  user_name: FormFieldConfig;
  email: FormFieldConfig;
  first_name: FormFieldConfig;
  last_name: FormFieldConfig;
  phone: FormFieldConfig;
};

export type AddressFormConfig = {
  address_type: FormFieldConfig;
  first_name: FormFieldConfig;
  last_name: FormFieldConfig;
  address_1: FormFieldConfig;
  address_2: FormFieldConfig;
  city: FormFieldConfig;
  state: FormFieldConfig;
  zip: FormFieldConfig;
};

export type CreditCardFormConfig = {
  card_type: FormFieldConfig;
  card_number: FormFieldConfig;
  card_holder_name: FormFieldConfig;
  card_expires: FormFieldConfig;
  card_cvv: FormFieldConfig;
};

// Customer form configuration
export const getCustomerFormConfig = (customer?: Partial<Customer>): CustomerFormConfig => ({
  customer_id: {
    value: customer?.customer_id || '',
    validators: []
  },
  user_name: {
    value: customer?.user_name || '',
    validators: [validators.required('Username is required')]
  },
  email: {
    value: customer?.email || '',
    validators: [
      validators.required('Email is required'),
      validators.email('Please enter a valid email address')
    ]
  },
  first_name: {
    value: customer?.first_name || '',
    validators: [
      validators.required('First name is required'),
      validators.sanitize('Invalid characters detected')
    ]
  },
  last_name: {
    value: customer?.last_name || '',
    validators: [
      validators.required('Last name is required'),
      validators.sanitize('Invalid characters detected')
    ]
  },
  phone: {
    value: customer?.phone || '',
    validators: [validators.phone('Please enter a valid phone number')]
  }
});

// Address form configuration
export const getAddressFormConfig = (): AddressFormConfig => ({
  address_type: {
    value: 'shipping',
    validators: [validators.required('Address type is required')]
  },
  first_name: {
    value: '',
    validators: [
      validators.required('First name is required'),
      validators.sanitize('Invalid characters detected')
    ]
  },
  last_name: {
    value: '',
    validators: [
      validators.required('Last name is required'),
      validators.sanitize('Invalid characters detected')
    ]
  },
  address_1: {
    value: '',
    validators: [
      validators.required('Address is required'),
      validators.sanitize('Invalid characters detected')
    ]
  },
  address_2: {
    value: '',
    validators: [validators.sanitize('Invalid characters detected')]
  },
  city: {
    value: '',
    validators: [
      validators.required('City is required'),
      validators.sanitize('Invalid characters detected')
    ]
  },
  state: {
    value: '',
    validators: [
      validators.required('State is required'),
      validators.minLength(2, 'State must be 2 characters'),
      validators.sanitize('Invalid characters detected')
    ]
  },
  zip: {
    value: '',
    validators: [
      validators.required('ZIP code is required'),
      validators.zipCode('Please enter a valid ZIP code')
    ]
  }
});

// Credit card form configuration
export const getCreditCardFormConfig = (): CreditCardFormConfig => ({
  card_type: {
    value: 'visa',
    validators: [validators.required('Card type is required')]
  },
  card_number: {
    value: '',
    validators: [
      validators.required('Card number is required'),
      validators.creditCard('Please enter a valid credit card number')
    ]
  },
  card_holder_name: {
    value: '',
    validators: [
      validators.required('Cardholder name is required'),
      validators.sanitize('Invalid characters detected')
    ]
  },
  card_expires: {
    value: '',
    validators: [
      validators.required('Expiration date is required'),
      validators.cardExpiration('Please enter a valid expiration date (MM/YY)')
    ]
  },
  card_cvv: {
    value: '',
    validators: [
      validators.required('CVV is required'),
      validators.cvv('Please enter a valid CVV')
    ]
  }
});

// Pure data transformation functions
export const createCustomerFromForm = (formValue: any): Customer => ({
  ...formValue,
  addresses: [],
  credit_cards: [],
  customer_statuses: []
});

export const createAddressFromForm = (formValue: any): CreateAddressRequest => ({
  ...formValue
  // customer_id omitted - not needed in request body, customer ID is in URL
});

export const createCreditCardFromForm = (formValue: any): CreateCreditCardRequest => ({
  ...formValue
  // customer_id omitted - not needed in request body, customer ID is in URL
});

// Pure validation result extractor
export const extractFormErrors = (form: FormGroup): string[] => {
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

  return errors;
};

// Pure form validation function
export const validateForm = (form: FormGroup): { isValid: boolean; errors: string[] } => ({
  isValid: form.valid && extractFormErrors(form).length === 0,
  errors: extractFormErrors(form)
});