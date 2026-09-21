#!/bin/sh
# Validate the production configuration contract before starting a release.
#
# POSIX port of validate-production-config.ps1, for Linux hosts. Both scripts
# check the same variables, with the same rules, as the API's own startup check
# (apps/api/.../config/ProductionConfigValidator.java). If this passes, the
# API's configuration check will pass too; keep all three in step.
#
# Reports every problem at once, by variable name. Never prints values and
# never contacts Firebase, SMTP, object storage, or a database.
#
#   SPRING_PROFILES_ACTIVE=production ... sh infra/scripts/validate-production-config.sh
set -u

problems=''
count=0

add_problem() {
    problems="${problems}
 - $1"
    count=$((count + 1))
}

# Trimmed value of the named variable; empty when unset.
setting() {
    eval "printf '%s' \"\${$1-}\"" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//'
}

is_defined() {
    eval "[ -n \"\${$1+defined}\" ]"
}

lower() {
    printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

# Sets $value to the trimmed setting; records "is not set" and returns 1 when blank.
require() {
    value=$(setting "$1")
    if [ -z "$value" ]; then
        add_problem "$1 is not set"
        return 1
    fi
    return 0
}

https_origin() {
    case "$1" in
        https://?*) ;;
        *) return 1 ;;
    esac
    authority=${1#https://}
    case "$authority" in
        */* | *\?* | *\#*) return 1 ;;
    esac
    return 0
}

# Script-only: the API cannot check the profile that selects its own checks.
profiles=$(setting SPRING_PROFILES_ACTIVE | tr -d '[:space:]')
case ",$profiles," in
    *,production,*) ;;
    *) add_problem 'SPRING_PROFILES_ACTIVE must include production' ;;
esac

if require DB_URL; then
    case "$value" in
        jdbc:postgresql://[!/]*) ;;
        *) add_problem 'DB_URL must be a jdbc:postgresql:// URL with a host' ;;
    esac
fi
require POSTGRES_USER
require POSTGRES_PASSWORD

if require DARI_WEB_ORIGIN; then
    origins_ok=1
    # Field splitting drops a trailing empty field, so check empty entries first.
    case "$value" in
        ,* | *, | *,,*) origins_ok=0 ;;
    esac
    old_ifs=$IFS
    IFS=','
    set -f
    for origin in $value; do
        trimmed=$(printf '%s' "$origin" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')
        https_origin "$trimmed" || origins_ok=0
    done
    set +f
    IFS=$old_ifs
    if [ "$origins_ok" -ne 1 ]; then
        add_problem 'DARI_WEB_ORIGIN must be a comma-separated list of https origins with no path or trailing slash'
    fi
fi

if require FIREBASE_CREDENTIALS_PATH; then
    if [ ! -f "$value" ] || [ ! -r "$value" ]; then
        add_problem 'FIREBASE_CREDENTIALS_PATH must point to a readable file'
    fi
fi

if require DARI_MEDIA_PROVIDER; then
    [ "$(lower "$value")" = 's3' ] || add_problem 'DARI_MEDIA_PROVIDER must be s3 in production'
fi
if require DARI_MEDIA_PUBLIC_BASE_URL; then
    case "$(lower "$value")" in
        https://[!/]*) ;;
        *) add_problem 'DARI_MEDIA_PUBLIC_BASE_URL must be an https URL' ;;
    esac
fi
for name in DARI_MEDIA_S3_ENDPOINT DARI_MEDIA_S3_REGION DARI_MEDIA_S3_BUCKET \
            DARI_MEDIA_S3_ACCESS_KEY DARI_MEDIA_S3_SECRET_KEY; do
    require "$name"
done

# Unset means the production default, true. Set to anything else is an error.
if is_defined DARI_NOTIFICATIONS_ENABLED && require DARI_NOTIFICATIONS_ENABLED; then
    [ "$(lower "$value")" = 'true' ] || add_problem \
        'DARI_NOTIFICATIONS_ENABLED must not be false in production; notifications are the only channel to users'
fi
if require DARI_NOTIFICATIONS_FROM; then
    case "$value" in
        *@*) ;;
        *) add_problem 'DARI_NOTIFICATIONS_FROM must be an email address' ;;
    esac
fi
require SMTP_HOST
# Unset means the production default, 587.
if is_defined SMTP_PORT && require SMTP_PORT; then
    case "$value" in
        '' | *[!0-9]*) port_ok=0 ;;
        *) if [ "${#value}" -le 5 ] && [ "$value" -ge 1 ] && [ "$value" -le 65535 ]; then port_ok=1; else port_ok=0; fi ;;
    esac
    [ "$port_ok" -eq 1 ] || add_problem 'SMTP_PORT must be a port number between 1 and 65535'
fi
require SMTP_USERNAME
require SMTP_PASSWORD

if [ "$count" -gt 0 ]; then
    if [ "$count" -eq 1 ]; then noun=problem; else noun=problems; fi
    printf 'Production configuration is invalid (%s %s). Values are not shown.%s\n' \
        "$count" "$noun" "$problems" >&2
    exit 1
fi

echo 'Production configuration is valid. Values were not printed.'
