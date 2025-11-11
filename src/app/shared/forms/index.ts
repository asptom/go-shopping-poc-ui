// Legacy validators (deprecated - use pure-validators instead)
export { CustomValidators } from './validators/custom-validators';

// Form services (refactored to use pure functions)
export { AddressFormService } from './controls/address-form.service';
export { CreditCardFormService } from './controls/credit-card-form.service';
export { CustomerFormService } from './controls/customer-form.service';

// Pure validation functions (new architecture)
export * from './validators/pure-validators';

// Form configuration utilities (new architecture)
export * from './config/form-configs';

// UI formatting utilities (for component layer)
export * from './utils/ui-formatters';