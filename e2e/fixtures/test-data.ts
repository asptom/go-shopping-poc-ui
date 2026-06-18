import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sharedUserFile = resolve(process.cwd(), 'e2e/.runtime/test-user.json');

const TIMESTAMP = Date.now();
const localUsername = `e2e-user-${TIMESTAMP}`;
const localEmail = `e2e-user-${TIMESTAMP}@example.com`;

const sharedUser = existsSync(sharedUserFile)
  ? (JSON.parse(readFileSync(sharedUserFile, 'utf-8')) as { username: string; email: string })
  : { username: localUsername, email: localEmail };

export const TEST_USER = {
  username: sharedUser.username,
  email: sharedUser.email,
  password: 'E2eTestPassword123!',
  given_name: 'E2E',
  family_name: 'TestUser',
  phone: '555-010-0100',

  shippingAddress: {
    first_name: 'E2E',
    last_name: 'TestUser',
    address_1: '123 Main Street',
    address_2: 'Apt 4B',
    city: 'Seattle',
    state: 'WA',
    zip: '98101',
  },
  billingAddress: {
    first_name: 'E2E',
    last_name: 'TestUser',
    address_1: '456 Oak Avenue',
    address_2: '',
    city: 'Portland',
    state: 'OR',
    zip: '97201',
  },

  creditCard: {
    card_type: 'visa' as const,
    card_number: '4111111111111111',
    card_holder_name: 'E2E TestUser',
    card_expires: '12/28',
    card_cvv: '123',
  },
} as const;

export const BACKEND_BASE = 'https://pocstore.local/api/v1';
export const KEYCLOAK_ISSUER = 'https://keycloak.local/realms/pocstore-realm';
export const KEYCLOAK_ADMIN_BASE = 'https://keycloak.local/admin/realms/pocstore-realm';

let _admin: { base: string; username: string; password: string; realm: string } | null = null;

export function getKeycloakAdmin(): { base: string; username: string; password: string; realm: string } {
  if (!_admin) {
    const adminFile = resolve(process.cwd(), 'e2e/.runtime/keycloak-admin.json');
    if (!existsSync(adminFile)) {
      throw new Error('Missing Keycloak admin credentials in e2e/.runtime/keycloak-admin.json');
    }
    _admin = JSON.parse(readFileSync(adminFile, 'utf-8'));
  }
  return _admin!;
}
