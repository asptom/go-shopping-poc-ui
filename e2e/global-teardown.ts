import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { deleteKeycloakUser, KeycloakUser } from './helpers/api';

export default async function globalTeardown(): Promise<void> {
  const userPath = resolve(__dirname, '.runtime/keycloak-user.json');

  if (!existsSync(userPath)) {
    // eslint-disable-next-line no-console
    console.warn('[global-teardown] No keycloak-user.json found, skipping user deletion');
    return;
  }

  let user: KeycloakUser;
  try {
    user = JSON.parse(readFileSync(userPath, 'utf-8')) as KeycloakUser;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[global-teardown] Failed to parse keycloak-user.json: ${err}`);
    return;
  }

  try {
    await deleteKeycloakUser(user.id);
    // eslint-disable-next-line no-console
    console.log(`[global-teardown] Deleted Keycloak user: ${user.username} (id: ${user.id})`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[global-teardown] Failed to delete Keycloak user ${user.id}: ${err}`);
  }

  // Clean up runtime files
  const debugPath = resolve(__dirname, '.runtime/test-user.json');
  if (existsSync(userPath)) unlinkSync(userPath);
  if (existsSync(debugPath)) unlinkSync(debugPath);
}
