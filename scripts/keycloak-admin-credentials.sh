#!/usr/bin/env bash
set -euo pipefail

ANGULAR_ROOT=$(git rev-parse --show-toplevel)
RUNTIME_DIR="$ANGULAR_ROOT/e2e/.runtime"
OUTPUT_FILE="$RUNTIME_DIR/keycloak-admin.json"

mkdir -p "$RUNTIME_DIR"

NAMESPACE="keycloak"
SECRET="keycloak-secret"
USERNAME_FIELD="KC_BOOTSTRAP_ADMIN_USERNAME"
PASSWORD_FIELD="KC_BOOTSTRAP_ADMIN_PASSWORD"

USERNAME=$(kubectl -n "$NAMESPACE" get secret "$SECRET" -o jsonpath="{.data.$USERNAME_FIELD}" | base64 --decode)
PASSWORD=$(kubectl -n "$NAMESPACE" get secret "$SECRET" -o jsonpath="{.data.$PASSWORD_FIELD}" | base64 --decode)

cat > "$OUTPUT_FILE" <<EOF
{
  "base": "https://keycloak.local",
  "username": "$USERNAME",
  "password": "$PASSWORD",
  "realm": "pocstore-realm"
}
EOF
