process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { getKeycloakAdmin, KEYCLOAK_ADMIN_BASE } from '../fixtures/test-data';

let adminToken: string | null = null;

export async function getKeycloakAdminToken(): Promise<string> {
  if (adminToken) return adminToken;

  const admin = getKeycloakAdmin();
  const tokenUrl = `${admin.base}/realms/master/protocol/openid-connect/token`;
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-cli',
    username: admin.username,
    password: admin.password,
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get Keycloak admin token: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { access_token: string };
  adminToken = data.access_token;
  return adminToken;
}

export interface KeycloakUser {
  id: string;
  username: string;
  email: string;
}

export interface CreateUserInput {
  username: string;
  email: string;
  given_name: string;
  family_name: string;
  password: string;
}

export async function createKeycloakUser(user: CreateUserInput): Promise<KeycloakUser> {
  const token = await getKeycloakAdminToken();
  const createUrl = `${KEYCLOAK_ADMIN_BASE}/users`;

  const res = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: user.username,
      email: user.email,
      firstName: user.given_name,
      lastName: user.family_name,
      enabled: true,
      emailVerified: true,
      credentials: [
        {
          type: 'password',
          value: user.password,
          temporary: false,
        },
      ],
    }),
  });

  if (res.status !== 201) {
    const text = await res.text();
    throw new Error(`Failed to create Keycloak user: ${res.status} ${text}`);
  }

  // Response body is empty on 201. Fetch the user by username to get the ID.
  const listUrl = `${KEYCLOAK_ADMIN_BASE}/users?username=${encodeURIComponent(user.username)}`;
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!listRes.ok) {
    const text = await listRes.text();
    throw new Error(`Failed to list Keycloak users: ${listRes.status} ${text}`);
  }

  const users = (await listRes.json()) as KeycloakUser[];
  const created = users.find((u) => u.username === user.username);
  if (!created) {
    throw new Error(`Created Keycloak user not found in list response`);
  }

  return created;
}

export async function deleteKeycloakUser(userId: string): Promise<void> {
  const token = await getKeycloakAdminToken();
  const deleteUrl = `${KEYCLOAK_ADMIN_BASE}/users/${userId}`;

  const res = await fetch(deleteUrl, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Failed to delete Keycloak user: ${res.status} ${text}`);
  }
}
