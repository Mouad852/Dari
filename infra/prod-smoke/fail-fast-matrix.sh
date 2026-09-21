#!/usr/bin/env bash
# Fail-fast matrix for the production configuration contract.
#
# For each case, derives an env file from smoke.env with one variable removed or
# made unsafe, then runs BOTH:
#   - the API image (production profile), which must exit non-zero naming it
#   - infra/scripts/validate-production-config.sh inside the same image, with
#     the same env file and the same mounted key, which must agree
# and checks that no secret value from smoke.env appears in either output.
#
# The API container runs with --network none: the configuration check fails
# before anything is contacted, and this proves it.
#
#   docker build -t dari-api:smoke apps/api
#   bash infra/prod-smoke/fail-fast-matrix.sh
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
image=${SMOKE_IMAGE:-dari-api:smoke}
key=${FIREBASE_SERVICE_ACCOUNT_FILE:-$root/infra/firebase/service-account.json}
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# Docker Desktop on Windows wants native paths for bind mounts; Git Bash must
# not rewrite the container-side paths.
host_path() { if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else printf '%s' "$1"; fi; }
export MSYS_NO_PATHCONV=1
mounts=(-v "$(host_path "$key"):/run/secrets/firebase-service-account.json:ro"
        -v "$(host_path "$root/infra/scripts"):/opt/dari-scripts:ro")

secrets=()
for name in POSTGRES_PASSWORD DARI_LOCATION_FUZZ_SECRET DARI_MEDIA_S3_ACCESS_KEY DARI_MEDIA_S3_SECRET_KEY SMTP_PASSWORD; do
    secrets+=("$(grep -E "^$name=" "$here/smoke.env" | cut -d= -f2-)")
done

# case id | variable the failure must name | sed expression applied to smoke.env
cases=(
    "missing DB_URL|DB_URL|/^DB_URL=/d"
    "missing POSTGRES_USER|POSTGRES_USER|/^POSTGRES_USER=/d"
    "missing POSTGRES_PASSWORD|POSTGRES_PASSWORD|/^POSTGRES_PASSWORD=/d"
    "missing DARI_WEB_ORIGIN|DARI_WEB_ORIGIN|/^DARI_WEB_ORIGIN=/d"
    "missing FIREBASE_CREDENTIALS_PATH|FIREBASE_CREDENTIALS_PATH|/^FIREBASE_CREDENTIALS_PATH=/d"
    "missing DARI_LOCATION_FUZZ_SECRET|DARI_LOCATION_FUZZ_SECRET|/^DARI_LOCATION_FUZZ_SECRET=/d"
    "missing DARI_MEDIA_PROVIDER|DARI_MEDIA_PROVIDER|/^DARI_MEDIA_PROVIDER=/d"
    "missing DARI_MEDIA_PUBLIC_BASE_URL|DARI_MEDIA_PUBLIC_BASE_URL|/^DARI_MEDIA_PUBLIC_BASE_URL=/d"
    "missing DARI_MEDIA_S3_ENDPOINT|DARI_MEDIA_S3_ENDPOINT|/^DARI_MEDIA_S3_ENDPOINT=/d"
    "missing DARI_MEDIA_S3_REGION|DARI_MEDIA_S3_REGION|/^DARI_MEDIA_S3_REGION=/d"
    "missing DARI_MEDIA_S3_BUCKET|DARI_MEDIA_S3_BUCKET|/^DARI_MEDIA_S3_BUCKET=/d"
    "missing DARI_MEDIA_S3_ACCESS_KEY|DARI_MEDIA_S3_ACCESS_KEY|/^DARI_MEDIA_S3_ACCESS_KEY=/d"
    "missing DARI_MEDIA_S3_SECRET_KEY|DARI_MEDIA_S3_SECRET_KEY|/^DARI_MEDIA_S3_SECRET_KEY=/d"
    "missing DARI_NOTIFICATIONS_FROM|DARI_NOTIFICATIONS_FROM|/^DARI_NOTIFICATIONS_FROM=/d"
    "missing SMTP_HOST|SMTP_HOST|/^SMTP_HOST=/d"
    "missing SMTP_USERNAME|SMTP_USERNAME|/^SMTP_USERNAME=/d"
    "missing SMTP_PASSWORD|SMTP_PASSWORD|/^SMTP_PASSWORD=/d"
    "DARI_NOTIFICATIONS_ENABLED=false|DARI_NOTIFICATIONS_ENABLED|\$a DARI_NOTIFICATIONS_ENABLED=false"
    "DARI_MEDIA_PROVIDER=local|DARI_MEDIA_PROVIDER|s/^DARI_MEDIA_PROVIDER=.*/DARI_MEDIA_PROVIDER=local/"
    "http media base URL|DARI_MEDIA_PUBLIC_BASE_URL|s|^DARI_MEDIA_PUBLIC_BASE_URL=.*|DARI_MEDIA_PUBLIC_BASE_URL=http://media.smoke.dari.invalid|"
    "http web origin|DARI_WEB_ORIGIN|s|^DARI_WEB_ORIGIN=.*|DARI_WEB_ORIGIN=http://localhost:3000|"
    "web origin with trailing slash|DARI_WEB_ORIGIN|s|^DARI_WEB_ORIGIN=.*|DARI_WEB_ORIGIN=https://smoke.dari.invalid/|"
    "Firebase key file absent|FIREBASE_CREDENTIALS_PATH|s|^FIREBASE_CREDENTIALS_PATH=.*|FIREBASE_CREDENTIALS_PATH=/run/secrets/absent.json|"
    "non-PostgreSQL DB_URL|DB_URL|s|^DB_URL=.*|DB_URL=jdbc:mysql://db:3306/dari|"
    "SMTP_PORT not a number|SMTP_PORT|s/^SMTP_PORT=.*/SMTP_PORT=smtp/"
    "sender not an address|DARI_NOTIFICATIONS_FROM|s/^DARI_NOTIFICATIONS_FROM=.*/DARI_NOTIFICATIONS_FROM=no-reply/"
    "location fuzz secret too short|DARI_LOCATION_FUZZ_SECRET|s/^DARI_LOCATION_FUZZ_SECRET=.*/DARI_LOCATION_FUZZ_SECRET=too-short/"
)

leaks() {
    local file=$1 secret
    for secret in "${secrets[@]}"; do
        if grep -qF -- "$secret" "$file"; then return 0; fi
    done
    return 1
}

printf '%-34s %-10s %-10s %-8s %s\n' CASE API SCRIPT LEAK VERDICT
failures=0

# Control: the unmodified file must pass the script (the running smoke stack
# is the control for the API itself).
sed '/^#/d; /^$/d' "$here/smoke.env" > "$work/control.env"
docker run --rm --network none --env-file "$(host_path "$work/control.env")" "${mounts[@]}" --entrypoint sh \
    "$image" /opt/dari-scripts/validate-production-config.sh > "$work/control.out" 2>&1
control=$?
verdict=PASS
if [ "$control" -ne 0 ]; then verdict=FAIL; failures=$((failures + 1)); fi
printf '%-34s %-10s %-10s %-8s %s\n' "control (complete smoke.env)" "-" "exit=$control" "-" "$verdict"

for entry in "${cases[@]}"; do
    IFS='|' read -r label variable expression <<< "$entry"
    env_file="$work/case.env"
    sed '/^#/d; /^$/d' "$here/smoke.env" | sed "$expression" > "$env_file"

    docker run --rm --network none --env-file "$(host_path "$env_file")" "${mounts[@]}" "$image" > "$work/api.out" 2>&1
    api_exit=$?
    docker run --rm --network none --env-file "$(host_path "$env_file")" "${mounts[@]}" --entrypoint sh \
        "$image" /opt/dari-scripts/validate-production-config.sh > "$work/script.out" 2>&1
    script_exit=$?

    api_ok=0; script_ok=0; leaked=no
    [ "$api_exit" -ne 0 ] && grep -q "Production configuration is invalid" "$work/api.out" \
        && grep -qE "^ - $variable " "$work/api.out" && api_ok=1
    [ "$script_exit" -ne 0 ] && grep -qE "^ - $variable " "$work/script.out" && script_ok=1
    if leaks "$work/api.out" || leaks "$work/script.out"; then leaked=YES; fi

    # Agreement: both must name exactly the same set of variables.
    api_names=$(grep -oE '^ - [A-Z_]+' "$work/api.out" | sort)
    script_names=$(grep -oE '^ - [A-Z_]+' "$work/script.out" | sort)

    verdict=PASS
    if [ "$api_ok" -ne 1 ] || [ "$script_ok" -ne 1 ] || [ "$leaked" != no ] \
        || [ "$api_names" != "$script_names" ]; then
        verdict=FAIL
        failures=$((failures + 1))
    fi
    printf '%-34s %-10s %-10s %-8s %s\n' "$label" "exit=$api_exit" "exit=$script_exit" "$leaked" "$verdict"
    if [ "$verdict" = FAIL ]; then
        echo "    api:    $(echo $api_names)"
        echo "    script: $(echo $script_names)"
    fi
done

echo
if [ "$failures" -eq 0 ]; then
    echo "All cases passed: both checks refused every case, named the variable, agreed, and leaked nothing."
else
    echo "$failures case(s) failed."
    exit 1
fi
