#!/usr/bin/env bash
# Writes a syntactically valid Firebase service-account file around a freshly
# generated RSA key, for runs that need the production profile to start but
# must never reach Firebase: CI, and local runs of the same gates.
#
# The API only parses this file at startup (GoogleCredentials.fromStream); it
# contacts Google when a token is verified or an account deleted, which the
# readiness check and the fail-fast matrix never do. The key authorises
# nothing and is not kept.
#
#   bash infra/prod-smoke/throwaway-service-account.sh /tmp/dari-ci/service-account.json
set -euo pipefail

[ $# -eq 1 ] || { echo "usage: $0 <output file>" >&2; exit 2; }
out=$1
command -v openssl >/dev/null 2>&1 || { echo "openssl is not on PATH" >&2; exit 1; }

umask 077
key=$(mktemp)
trap 'rm -f "$key"' EXIT
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$key" 2>/dev/null
pem=$(awk '{ printf "%s\\n", $0 }' "$key")

cat > "$out" <<EOF
{
  "type": "service_account",
  "project_id": "dari-throwaway",
  "private_key_id": "throwaway",
  "private_key": "$pem",
  "client_email": "throwaway@dari-throwaway.iam.gserviceaccount.com",
  "client_id": "000000000000000000000",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
EOF
echo "throwaway service account written to $out"
