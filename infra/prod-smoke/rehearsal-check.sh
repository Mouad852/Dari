#!/usr/bin/env bash
# Non-destructive launch-rehearsal checks against a deployed Dari: the
# configuration half of audit section M.1 and the launch gate items that can be
# read from outside. Every check prints PASS, FAIL or SKIP; any FAIL makes the
# exit status non-zero. It only reads public URLs, sends no credentials, and
# prints status codes, header names and a few public fields, never a body.
#
#   API_ORIGIN=https://api.example.ma \
#   WEB_ORIGIN=https://www.example.ma \
#   MEDIA_ORIGIN=https://media.example.ma \
#     bash infra/prod-smoke/rehearsal-check.sh
#
# Optional:
#   LISTING_ID         a published listing to inspect (default: first search hit;
#                      it must have at least one photo)
#   LISTING_EXACT_LAT  the real coordinates of that listing, as entered by its
#   LISTING_EXACT_LNG  owner; without them the distance check is SKIP
#   INTERNAL_API_HOST  the API's private host name (the web's API_BASE_URL);
#                      searched for literally in public pages
#   RATE_LIMIT_PROBE=1 also sends 130 searches with rotating X-Forwarded-For and
#                      expects a 429. OFF by default: it spends this machine's
#                      search quota for a minute and shows up in the API metrics.
#   CA_FILE            a PEM file to trust in addition to the system store (a
#                      staging certificate); passed to curl as --cacert
#
# docs/LAUNCH_REHEARSAL.md says when to run it and where to record the result.
set -uo pipefail

: "${API_ORIGIN:?set API_ORIGIN, e.g. https://api.example.ma}"
: "${WEB_ORIGIN:?set WEB_ORIGIN, e.g. https://www.example.ma}"
: "${MEDIA_ORIGIN:?set MEDIA_ORIGIN, e.g. https://media.example.ma}"
API_ORIGIN=${API_ORIGIN%/}
WEB_ORIGIN=${WEB_ORIGIN%/}
MEDIA_ORIGIN=${MEDIA_ORIGIN%/}
# The fuzzer draws a point at most this far from the real one
# (dari.location.fuzz-radius-metres, application.yml).
FUZZ_RADIUS_M=200

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

passed=0
failed=0
skipped=0
pass() { passed=$((passed + 1)); printf 'PASS  %s\n' "$1"; }
fail() { failed=$((failed + 1)); printf 'FAIL  %s\n' "$1"; }
skip() { skipped=$((skipped + 1)); printf 'SKIP  %s\n' "$1"; }

curl_args=(-sS --max-time 20)
[ -z "${CA_FILE:-}" ] || curl_args+=(--cacert "$CA_FILE")

# fetch URL NAME: body to $work/NAME.body, headers to $work/NAME.head; prints
# the status code (curl writes 000 when the request itself failed).
fetch() {
    : > "$work/$2.body"
    : > "$work/$2.head"
    curl "${curl_args[@]}" -o "$work/$2.body" -D "$work/$2.head" -w '%{http_code}' "$1" 2>/dev/null
}
header() { grep -i "^$2:" "$work/$1.head" | tail -n 1 | cut -d: -f2- | tr -d '\r' | sed 's/^ *//'; }
host_of() { printf '%s' "$1" | sed -E 's#^[a-zA-Z]+://##; s#[/?].*$##' | tr '[:upper:]' '[:lower:]'; }
# The offset the pre-fix fuzzer added (audit P0-1): java.util.Random seeded
# with the id's two halves XORed, then angle and distance from two
# nextDouble() calls. Replayed with 64-bit shell arithmetic; prints the
# integers behind the two doubles, "n1 n2", each to be divided by 2^53.
unkeyed_draws() {
    local hex=${1//-/} mask=$(( (1 << 48) - 1 )) seed out='' a b _
    seed=$(( ((0x${hex:0:16} ^ 0x${hex:16:16}) ^ 0x5DEECE66D) & mask ))
    for _ in 1 2; do
        seed=$(( (seed * 0x5DEECE66D + 0xB) & mask )); a=$(( seed >> 22 ))
        seed=$(( (seed * 0x5DEECE66D + 0xB) & mask )); b=$(( seed >> 21 ))
        out="$out $(( (a << 27) + b ))"
    done
    printf '%s' "${out# }"
}
random_uuid() {
    printf '%08x-%04x-4%03x-a%03x-%06x%06x' $((RANDOM * RANDOM)) $RANDOM $((RANDOM % 4096)) \
        $((RANDOM % 4096)) $((RANDOM * 256 % 16777216)) $((RANDOM * 512 % 16777216))
}

echo "Dari launch rehearsal checks"
echo "  api    $API_ORIGIN"
echo "  web    $WEB_ORIGIN"
echo "  media  $MEDIA_ORIGIN"
echo

# --- Origins -----------------------------------------------------------------
for origin in "$API_ORIGIN" "$WEB_ORIGIN" "$MEDIA_ORIGIN"; do
    case "$origin" in
        https://*) pass "origin is HTTPS: $origin" ;;
        *) fail "origin is not HTTPS: $origin" ;;
    esac
done

# --- API health and info -----------------------------------------------------
for path in /actuator/health /actuator/health/readiness /actuator/health/liveness; do
    code=$(fetch "$API_ORIGIN$path" health)
    if [ "$code" = 200 ] && grep -q '"status":"UP"' "$work/health.body"; then
        pass "$path is UP"
    else
        fail "$path: HTTP $code, expected 200 with status UP"
    fi
done

code=$(fetch "$API_ORIGIN/actuator/info" info)
release=$(grep -oE '"release":\{"version":"[^"]*"' "$work/info.body" 2>/dev/null | sed -E 's/.*"version":"([^"]*)"/\1/')
if [ "$code" != 200 ]; then
    fail "/actuator/info: HTTP $code"
elif [ -z "$release" ] || [ "$release" = development ]; then
    fail "/actuator/info release is '${release:-missing}'; DARI_RELEASE_VERSION must be the deployed tag"
else
    pass "/actuator/info release is $release"
fi

for path in /actuator/prometheus /actuator/metrics /actuator/health/db; do
    code=$(fetch "$API_ORIGIN$path" actuator)
    case "$code" in
        401|403|404) pass "$path refused without an admin token (HTTP $code)" ;;
        *) fail "$path answered HTTP $code without a token; it must be refused" ;;
    esac
done

# --- Web security headers ----------------------------------------------------
for path in / /sign-in; do
    code=$(fetch "$WEB_ORIGIN$path" webpage)
    if [ "$code" != 200 ]; then
        fail "web $path: HTTP $code"
        continue
    fi
    missing=
    hsts=$(header webpage strict-transport-security)
    printf '%s' "$hsts" | grep -qE 'max-age=[1-9][0-9]{6,}' || missing="$missing HSTS(max-age>=1000000)"
    [ -n "$(header webpage content-security-policy)" ] || missing="$missing CSP"
    printf '%s' "$(header webpage x-frame-options)" | grep -qiE '^(DENY|SAMEORIGIN)$' || missing="$missing X-Frame-Options"
    printf '%s' "$(header webpage x-content-type-options)" | grep -qi '^nosniff$' || missing="$missing nosniff"
    [ -n "$(header webpage referrer-policy)" ] || missing="$missing Referrer-Policy"
    [ -n "$(header webpage permissions-policy)" ] || missing="$missing Permissions-Policy"
    if [ -z "$missing" ]; then
        pass "web $path sends HSTS, CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy"
    else
        fail "web $path is missing:$missing"
    fi
    cp "$work/webpage.body" "$work/page-$(printf '%s' "$path" | tr -c '[:lower:]' '_').html"
done

# --- robots.txt and sitemap --------------------------------------------------
code=$(fetch "$WEB_ORIGIN/robots.txt" robots)
if [ "$code" = 200 ] && grep -qi '^sitemap:' "$work/robots.body"; then
    pass "robots.txt is served and names a sitemap"
else
    fail "robots.txt: HTTP $code, or no Sitemap line"
fi
sitemap_url=$(grep -i '^sitemap:' "$work/robots.body" 2>/dev/null | head -n 1 | cut -d: -f2- | tr -d '\r' | sed 's/^ *//')
case "$sitemap_url" in
    "$WEB_ORIGIN"/*) pass "robots.txt points at a sitemap on WEB_ORIGIN" ;;
    *) fail "robots.txt sitemap '${sitemap_url:-none}' is not on WEB_ORIGIN (NEXT_PUBLIC_SITE_URL?)" ;;
esac
code=$(fetch "${sitemap_url:-$WEB_ORIGIN/sitemap/0.xml}" sitemap)
if [ "$code" = 200 ] && grep -q '<urlset' "$work/sitemap.body"; then
    pass "sitemap is served ($(grep -o '<loc>' "$work/sitemap.body" | wc -l | tr -d ' ') URLs)"
else
    fail "sitemap: HTTP $code, or not a <urlset>"
fi

# --- No internal host in public output ----------------------------------------
# Every absolute URL in the pages, robots.txt and the sitemap must be on one of
# the three public origins or on a public host; loopback, private ranges and
# .internal/.local names mean an internal address leaked (audit P0-11).
known_hosts=" $(host_of "$API_ORIGIN") $(host_of "$WEB_ORIGIN") $(host_of "$MEDIA_ORIGIN") "
leaks=
for f in "$work"/page-*.html "$work/robots.body" "$work/sitemap.body"; do
    [ -f "$f" ] || continue
    for url_host in $(grep -oE 'https?://[^/"'"'"' <>)\\]+' "$f" | sed -E 's#^[a-zA-Z]+://##' | tr '[:upper:]' '[:lower:]' | sort -u); do
        case "$known_hosts" in *" $url_host "*) continue ;; esac
        if printf '%s' "$url_host" | grep -qE '^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|0\.0\.0\.0|host\.docker\.internal)|\.(internal|local|localdomain)(:|$)'; then
            leaks="$leaks $url_host"
        fi
    done
    # Lowercase both sides instead of grep -i: Git for Windows' grep aborts on
    # -iF over these pages, which would read as "not found".
    if [ -n "${INTERNAL_API_HOST:-}" ] && tr '[:upper:]' '[:lower:]' < "$f" \
         | grep -qF "$(printf '%s' "$INTERNAL_API_HOST" | tr '[:upper:]' '[:lower:]')"; then
        leaks="$leaks $INTERNAL_API_HOST"
    fi
done
if [ -z "$leaks" ]; then
    pass "no internal host in /, /sign-in, robots.txt or the sitemap"
else
    fail "internal host(s) in public output:$(printf '%s' "$leaks" | tr ' ' '\n' | sort -u | tr '\n' ' ')"
fi
[ -n "${INTERNAL_API_HOST:-}" ] || skip "INTERNAL_API_HOST not set; only private-looking hosts were searched for"

# --- Missing resources are 404 ------------------------------------------------
missing_id=$(random_uuid)
for target in "api:$API_ORIGIN/api/v1/listings/$missing_id" "api:$API_ORIGIN/api/v1/users/$missing_id" \
              "web:$WEB_ORIGIN/listings/$missing_id" "web:$WEB_ORIGIN/profile/$missing_id"; do
    url=${target#*:}
    code=$(fetch "$url" missing)
    if [ "$code" = 404 ]; then
        pass "missing ${target%%:*} ${url#*//*/} is 404"
    elif [ "$code" = 200 ] && [ "${url#"$WEB_ORIGIN"/listings/}" != "$url" ] \
         && grep -q '<meta name="robots" content="noindex' "$work/missing.body"; then
        # Deliberate: the API's anonymous 404 means "not public", and the page
        # falls back to the owner/moderator preview (listings/[id]/page.tsx),
        # so it cannot answer 404; it is marked noindex instead.
        pass "missing web ${url#*//*/} is 200 + noindex (owner-preview fallback)"
    else
        fail "missing ${target%%:*} ${url#*//*/} answered HTTP $code, expected 404"
    fi
done

# --- A public listing leaks nothing --------------------------------------------
listing_id=${LISTING_ID:-}
if [ -z "$listing_id" ]; then
    fetch "$API_ORIGIN/api/v1/listings?size=1" search >/dev/null
    listing_id=$(grep -oE '"id":"[0-9a-f-]{36}"' "$work/search.body" 2>/dev/null | head -n 1 | cut -d'"' -f4)
fi
if [ -z "$listing_id" ]; then
    fail "no published listing to inspect (search is empty; publish a test listing or set LISTING_ID)"
else
    code=$(fetch "$API_ORIGIN/api/v1/listings/$listing_id" listing)
    if [ "$code" != 200 ]; then
        fail "listing $listing_id: HTTP $code"
    else
        pass "listing $listing_id is public"
        keys=$(grep -oE '"[A-Za-z_]+":' "$work/listing.body" | tr -d '":' | sort -u)
        bad_keys=$(printf '%s\n' "$keys" | grep -iE 'email|phone|firebase|owner|uid|exact|geom|location' | tr '\n' ' ')
        if [ -z "$bad_keys" ]; then
            pass "listing JSON has no owner, contact or exact-location field"
        else
            fail "listing JSON exposes: $bad_keys"
        fi
        lat=$(grep -oE '"latitude":-?[0-9.]+' "$work/listing.body" | head -n 1 | cut -d: -f2)
        lng=$(grep -oE '"longitude":-?[0-9.]+' "$work/listing.body" | head -n 1 | cut -d: -f2)
        if [ -z "${LISTING_EXACT_LAT:-}" ] || [ -z "${LISTING_EXACT_LNG:-}" ]; then
            skip "public coordinates vs exact: set LISTING_EXACT_LAT and LISTING_EXACT_LNG for this listing"
        elif [ -z "$lat" ] || [ -z "$lng" ]; then
            fail "listing JSON has no latitude/longitude to compare"
        else
            metres=$(awk -v a="$LISTING_EXACT_LAT" -v b="$LISTING_EXACT_LNG" -v c="$lat" -v d="$lng" 'BEGIN {
                r = 3.141592653589793 / 180; dl = (c - a) * r; dn = (d - b) * r
                h = sin(dl / 2) ^ 2 + cos(a * r) * cos(c * r) * sin(dn / 2) ^ 2
                printf "%.0f", 2 * 6371000 * atan2(sqrt(h), sqrt(1 - h)) }')
            if [ "$metres" -lt 1 ]; then
                fail "public coordinates equal the exact ones: location is not fuzzed"
            elif [ "$metres" -gt $((FUZZ_RADIUS_M + 1)) ]; then
                fail "public point is ${metres} m from the exact one, beyond the ${FUZZ_RADIUS_M} m radius"
            else
                pass "public point is ${metres} m from the exact one (radius ${FUZZ_RADIUS_M} m)"
            fi
            # P0-1: subtract the offset the unkeyed fuzzer would have added. With
            # the keyed fuzzer this lands anywhere up to twice the radius away.
            recovered_m=$(awk -v draws="$(unkeyed_draws "$listing_id")" -v a="$LISTING_EXACT_LAT" -v b="$LISTING_EXACT_LNG" \
                -v c="$lat" -v d="$lng" -v radius="$FUZZ_RADIUS_M" 'BEGIN {
                split(draws, n, " "); pi = 3.141592653589793; r = pi / 180
                angle = n[1] / 9007199254740992 * 2 * pi; dist = sqrt(n[2] / 9007199254740992) * radius
                rlat = c - dist * cos(angle) / 111320; rlng = d - dist * sin(angle) / (111320 * cos(c * r))
                dl = (rlat - a) * r; dn = (rlng - b) * r
                h = sin(dl / 2) ^ 2 + cos(a * r) * cos(rlat * r) * sin(dn / 2) ^ 2
                printf "%.0f", 2 * 6371000 * atan2(sqrt(h), sqrt(1 - h)) }')
            if [ "$recovered_m" -lt 5 ]; then
                fail "the pre-fix recovery attack (audit P0-1) finds the exact point (${recovered_m} m off)"
            else
                pass "the pre-fix recovery attack (audit P0-1) misses the exact point by ${recovered_m} m"
            fi
            code=$(fetch "$WEB_ORIGIN/listings/$listing_id" listingpage)
            exact4=$(printf '%.4f' "$LISTING_EXACT_LAT")
            if [ "$code" != 200 ]; then
                fail "web listing page: HTTP $code"
            elif grep -qF "$exact4" "$work/listingpage.body"; then
                fail "web listing page (HTML, JSON-LD or OG tags) contains the exact latitude"
            else
                pass "web listing page does not contain the exact latitude"
            fi
        fi

        photo=$(grep -oE '"url":"[^"]+"' "$work/listing.body" | head -n 1 | cut -d'"' -f4)
        if [ -z "$photo" ]; then
            fail "listing $listing_id has no photo URL to check; use a listing with a photo"
        else
            case "$photo" in
                "$MEDIA_ORIGIN"/*)
                    code=$(fetch "$photo" photo)
                    type=$(header photo content-type)
                    if [ "$code" = 200 ] && printf '%s' "$type" | grep -qi '^image/'; then
                        pass "photo is served from MEDIA_ORIGIN over HTTPS ($type)"
                    else
                        fail "photo on MEDIA_ORIGIN answered HTTP $code (${type:-no content type})"
                    fi ;;
                *) fail "photo URL is not on MEDIA_ORIGIN: $(host_of "$photo")" ;;
            esac
        fi
    fi
fi

# --- Optional rate-limit probe -------------------------------------------------
if [ "${RATE_LIMIT_PROBE:-0}" = 1 ]; then
    first_limited=
    for request in $(seq 1 130); do
        code=$(curl "${curl_args[@]}" -o /dev/null -w '%{http_code}' \
            -H "X-Forwarded-For: 198.51.100.$request" "$API_ORIGIN/api/v1/listings?size=1" 2>/dev/null)
        if [ "$code" = 429 ]; then first_limited=$request; break; fi
    done
    if [ -n "$first_limited" ]; then
        pass "rate limit held against rotating X-Forwarded-For (first 429 at request $first_limited)"
    else
        fail "130 searches with rotating X-Forwarded-For never got a 429"
    fi
else
    skip "rate-limit probe (RATE_LIMIT_PROBE=1 to run it)"
fi

echo
echo "$passed passed, $failed failed, $skipped skipped"
[ "$failed" -eq 0 ]
