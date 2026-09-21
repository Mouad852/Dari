#!/usr/bin/env bash
# Exercise the production-like ingress after `docker compose ... up --wait`.
# Its append semantics must make rotating caller-supplied leftmost XFF values
# share the one source address nginx appends.
set -euo pipefail

base_url=${SMOKE_API_URL:-http://localhost:18080}
first_limited=0

for request in $(seq 1 130); do
    status=$(curl -sS -o /dev/null -w '%{http_code}' \
        -H "X-Forwarded-For: 198.51.100.$request" \
        "$base_url/api/v1/listings?city=Rabat")
    if [ "$status" = 429 ] && [ "$first_limited" -eq 0 ]; then
        first_limited=$request
    elif [ "$status" != 200 ] && [ "$status" != 429 ]; then
        echo "unexpected status $status on request $request" >&2
        exit 1
    fi
done

if [ "$first_limited" -lt 118 ] || [ "$first_limited" -gt 123 ]; then
    echo "expected first 429 near request 121, got ${first_limited:-none}" >&2
    exit 1
fi

echo "rate limit held across rotating forged XFF values; first 429: request $first_limited"
