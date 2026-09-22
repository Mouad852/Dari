#!/usr/bin/env bash
# Exercise the production-like ingress after `docker compose ... up --wait`.
# Its append semantics must make rotating caller-supplied leftmost XFF values
# share the one source address nginx appends. Then checks that only the SSR key
# (DARI_SSR_SHARED_SECRET) moves a read off that address's quota.
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

# The same, now exhausted, client address: a wrong SSR key is just an unkeyed
# request (still 429), while the web runtime's key draws on the shared SSR
# ceiling instead of that address's quota. The key is a smoke-only placeholder
# read from smoke.env and never printed.
here=$(cd "$(dirname "$0")" && pwd)
ssr_key=$(grep -E '^DARI_SSR_SHARED_SECRET=' "$here/smoke.env" | cut -d= -f2-)
wrong=$(curl -sS -o /dev/null -w '%{http_code}' -H 'X-Dari-Ssr-Key: not-the-key' \
    "$base_url/api/v1/listings?city=Rabat")
keyed=$(curl -sS -o /dev/null -w '%{http_code}' -H "X-Dari-Ssr-Key: $ssr_key" \
    "$base_url/api/v1/listings?city=Rabat")
if [ "$wrong" != 429 ] || [ "$keyed" != 200 ]; then
    echo "expected wrong key 429 and SSR key 200 after exhaustion, got $wrong and $keyed" >&2
    exit 1
fi
echo "after exhaustion: wrong SSR key -> $wrong, valid SSR key -> $keyed (shared SSR ceiling, not the per-IP quota)"
