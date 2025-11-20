import { createAddressFromForm, createCreditCardFromForm } from './form-configs';

describe('Form Configs', () => {
  describe('createAddressFromForm', () => {
    it('should create address request without customer_id', () => {
      const formValue = {
        address_type: 'shipping',
        first_name: 'John',
        last_name: 'Doe',
        address_1: '123 Main St',
        address_2: 'Apt 4B',
        city: 'New York',
        state: 'NY',
        zip: '10001'
      };

      const result = createAddressFromForm(formValue);

      expect(result).toEqual({
        address_type: 'shipping',
        first_name: 'John',
        last_name: 'Doe',
        address_1: '123 Main St',
        address_2: 'Apt 4B',
        city: 'New York',
        state: 'NY',
        zip: '10001'
      });

      // Verify customer_id is NOT included
      expect(result.hasOwnProperty('customer_id')).toBeFalse();
    });
  });

  describe('createCreditCardFromForm', () => {
    it('should create credit card request without customer_id', () => {
      const formValue = {
        card_type: 'visa',
        card_number: '4111111111111111',
        card_holder_name: 'John Doe',
        card_expires: '12/25',
        card_cvv: '123'
      };

      const result = createCreditCardFromForm(formValue);

      expect(result).toEqual({
        card_type: 'visa',
        card_number: '4111111111111111',
        card_holder_name: 'John Doe',
        card_expires: '12/25',
        card_cvv: '123'
      });

      // Verify customer_id is NOT included
      expect(result.hasOwnProperty('customer_id')).toBeFalse();
    });
  });
});