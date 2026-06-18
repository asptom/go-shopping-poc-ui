import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { TEST_USER } from './fixtures/test-data';
import { createKeycloakUser, KeycloakUser } from './helpers/api';

export default async function globalSetup(): Promise<void> {
  // Retrieve and persist Keycloak admin credentials before anything else.
  // If this step fails, the test run will terminate immediately.
  execSync('bash scripts/keycloak-admin-credentials.sh', { stdio: 'inherit' });

  const user = await createKeycloakUser({
    username: TEST_USER.username,
    email: TEST_USER.email,
    given_name: TEST_USER.given_name,
    family_name: TEST_USER.family_name,
    password: TEST_USER.password,
  });

  const outputPath = resolve(__dirname, '.runtime/keycloak-user.json');
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(user, null, 2));

// Write the full TEST_USER snapshot for the test process to read. Without this,
  // the test process captures a different Date.now() and uses a username that
  // Keycloak has never seen.
  const debugPath = resolve(__dirname, '.runtime/test-user.json');
  writeFileSync(debugPath, JSON.stringify(TEST_USER, null, 2));

  // eslint-disable-next-line no-console
  console.log(`[global-setup] Created Keycloak user: ${user.username} (id: ${user.id})`);
}
