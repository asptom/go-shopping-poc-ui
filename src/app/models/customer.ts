export interface Customer {
  customer_id: string;
  user_name: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  default_shipping_address_id: string | null;
  default_billing_address_id: string | null;
  default_credit_card_id: string | null;
  customer_since: string;
  customer_status: string;
  status_date_time: string;
  addresses?: Address[];
  credit_cards?: CreditCard[];
  status_history?: CustomerStatus[];
}

export interface Address {
  address_id?: string;
  customer_id: string;
  address_type: string;
  first_name: string;
  last_name: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface CreditCard {
  card_id?: string;
  customer_id: string;
  card_type: string;
  card_number: string;
  card_holder_name: string;
  card_expires: string;
  card_cvv: string;
}

export interface CustomerStatus {
  id: number;
  customer_id: string;
  old_status: string;
  new_status: string;
  changed_at: string;
}

// Request types for API operations (without generated fields)
export interface CreateAddressRequest {
  address_type: string;
  first_name: string;
  last_name: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface CreateCreditCardRequest {
  card_type: string;
  card_number: string;
  card_holder_name: string;
  card_expires: string;
  card_cvv: string;
}