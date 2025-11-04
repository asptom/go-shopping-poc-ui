export interface Customer {
  customer_id: string;
  user_name: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  addresses?: Address[];
  credit_cards?: CreditCard[];
  customer_statuses?: CustomerStatus[];
}

export interface Address {
  address_id?: string;
  address_type: string;
  first_name: string;
  last_name: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  zip: string;
  is_default: boolean;
}

export interface CreditCard {
  card_id?: string;
  card_type: string;
  card_number: string;
  card_holder_name: string;
  card_expires: string;
  card_cvv: string;
  is_default: boolean;
}

export interface CustomerStatus {
  customer_status: string;
  status_date_time: string;
}