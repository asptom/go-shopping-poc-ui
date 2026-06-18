# Plan: Automate Keycloak Admin Credentials for E2E Tests (Version 2)

## 1.  Context & Goals

The Angular e2e tests require the current Keycloak admin password.  The password is generated every time the platform (the Go repo) restarts, so a static value in the repo would become invalid immediately.  The goal is to ensure the e2e test process always reads the live password without any manual copy‑paste, while keeping the Angular repo free of secrets and without hard‑coded fallbacks.

## 2.  High‑level Strategy

* **Leverage the existing Make target** `keycloak-admin-credentials` that already extracts the username and password from the Kubernetes secret in the Go repo.
* **Wrap that target in a small shell script** located in the Angular repo.  The script merely changes to the Go repo directory and invokes the Make target.
* **Call the script from the e2e `global-setup.ts`** before any test modules import the credentials.  The script will write a JSON file to `e2e/.runtime/keycloak-admin.json`.
* **Keep the e2e fixtures unchanged** – `test-data.ts` reads the runtime file; if the file is absent the tests simply fail, because no valid password exists.

This approach has no hard‑coded fallbacks, no change to the TypeScript code that reads the credentials, and relies only on the external tooling (`make`, `kubectl`) that the CI already uses for provisioning.

## 3.  Detailed Implementation Steps

### 3.1  Create the Shell Wrapper

1. **File path**: `scripts/keycloak-admin-credentials.sh` in the Angular repo root.
2. **Contents**:
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   # Resolve the Angular repo root (ensures script works when called from any sub‑directory)
   ANGULAR_ROOT=$(git rev-parse --show-toplevel)
   # Navigate to the Go repo Makefile location
   cd "$ANGULAR_ROOT/../Go/go-shopping-poc/resources/make"
   # Run the existing Make target
   gmake keycloak-admin-credentials
   ```
3. **Make executable**: `chmod +x scripts/keycloak-admin-credentials.sh`.

### 3.2  Modify `e2e/global-setup.ts`

1. **Import** the Node `execSync` helper (if not already imported):
   ```ts
   import { execSync } from 'node:child_process';
   ```
2. **Add a call** *before* any test data are written and *before* `console.log` that signals setup completion:
```ts
// Retrieve and persist Keycloak admin credentials for the e2e test process.
// If this step fails, the test run will terminate immediately.
execSync('bash scripts/keycloak-admin-credentials.sh', { stdio: 'inherit' });
```
   Place the block immediately after `writeFileSync(debugPath, JSON.stringify(TEST_USER, null, 2));` and before the existing `console.log`.

### 3.3  Verify `test-data.ts`

* No changes are required.  The file already implements the pattern used for the test user: it checks `e2e/.runtime/keycloak-admin.json` at module‑load time and exports `KEYCLOAK_ADMIN` from that file.

### 3.4  CI / Local Testing

1. **Ensure CI image** has:
   * `make` (GNU Make)
   * `kubectl` configured with access to the Keycloak namespace
2. **Run a full e2e cycle locally** after a clean `gmake platform`:
   ```bash
   npm run test:e2e
   ```
   * Verify that `e2e/.runtime/keycloak-admin.json` contains the current credentials.
   * Verify that the tests succeed.
3. **Simulate a Keycloak restart** (by deleting the secret or restarting the pod) and rerun the tests to confirm that the wrapper fetches the new password.

## 4.  Failure Handling

* **Missing `make` or `kubectl`** – the `execSync` call throws; the catch block logs a warning, but the tests will likely fail due to a missing admin password.
* **Relative path changes** – if the Go repo layout changes, update the `cd` command in the shell script.  The wrapper is a single location for this dependency.
* **Permission issues on `.runtime`** – ensure that the CI job runs as a user with write permission to `e2e/.runtime`.

## 5.  Summary

1. Add a tiny bash wrapper in `scripts/` that invokes the Go Makefile target.
2. Call that wrapper from `e2e/global-setup.ts` before test data is written.
3. Rely on the existing runtime JSON pattern in `test-data.ts`.
4. No hard‑coded fallbacks or secrets remain in the Angular repo.

With this plan the e2e tests will automatically use the current Keycloak admin credentials each time they run, keeping the process fully automated and secure.
