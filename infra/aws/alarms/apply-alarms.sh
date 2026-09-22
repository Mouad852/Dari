#!/usr/bin/env bash
# Renders the six Dari alarms in this folder with this deployment's identifiers
# and, only with --apply, creates or updates them with
#   aws cloudwatch put-metric-alarm --cli-input-json file://...
#
# OWNER-RUN. Without --apply nothing is sent anywhere: the rendered JSON is
# printed (or written to --out DIR) for review. put-metric-alarm overwrites an
# alarm of the same name, so re-running is how a changed definition is applied.
# Standard CloudWatch alarms are billed per alarm-month; see the ops doc.
#
# Required environment (no defaults; these identify real resources):
#   AWS_REGION               region of the ALB, the API and the backup vault (alarms 2-6)
#   SNS_TOPIC_ARN            topic in AWS_REGION with the confirmed email subscription
#   SNS_TOPIC_ARN_US_EAST_1  topic in us-east-1 (Route 53 health-check metrics exist only there)
#   API_HEALTH_CHECK_ID      Route 53 health check on https://<api domain>/actuator/health/liveness
#   ALB_ARN_SUFFIX           the ALB's CloudWatch dimension, app/<name>/<id> (its ARN after "loadbalancer/")
#   BACKUP_VAULT_NAME        vault the daily AWS Backup rule writes to
# Optional thresholds for alarm 2 (defaults shown):
#   FIVE_XX_RATE_PERCENT=5   5xx share of responses, in percent
#   FIVE_XX_MIN_REQUESTS=20  minimum responses in a 5-minute period before the rate counts
#
#   bash infra/aws/alarms/apply-alarms.sh                   # render and print, no AWS call
#   bash infra/aws/alarms/apply-alarms.sh --out /tmp/alarms # render to files, no AWS call
#   bash infra/aws/alarms/apply-alarms.sh --apply           # create/update all six
#
# Every placeholder the JSON files may use is listed in PLACEHOLDERS below;
# AlarmDefinitionsTest fails if the two drift apart.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
apply=0
out=''
while [ $# -gt 0 ]; do
    case "$1" in
        --apply) apply=1 ;;
        --out) out=${2:?--out needs a directory}; shift ;;
        -h | --help) sed -n '2,28p' "$0"; exit 0 ;;
        *) echo "Unknown argument: $1" >&2; exit 2 ;;
    esac
    shift
done

FIVE_XX_RATE_PERCENT=${FIVE_XX_RATE_PERCENT:-5}
FIVE_XX_MIN_REQUESTS=${FIVE_XX_MIN_REQUESTS:-20}

PLACEHOLDERS=(
    __SNS_TOPIC_ARN__
    __SNS_TOPIC_ARN_US_EAST_1__
    __API_HEALTH_CHECK_ID__
    __ALB_ARN_SUFFIX__
    __BACKUP_VAULT_NAME__
    __FIVE_XX_RATE_PERCENT__
    __FIVE_XX_MIN_REQUESTS__
)

problems=()
check() { # name, regex, rule
    local value=${!1-}
    if [ -z "$value" ]; then problems+=("$1 is not set"); return; fi
    [[ $value =~ $2 ]] || problems+=("$1 $3")
}
check AWS_REGION '^[a-z]{2}(-[a-z]+)+-[0-9]$' 'must be a region code such as eu-west-3'
check SNS_TOPIC_ARN '^arn:aws[a-z-]*:sns:[a-z0-9-]+:[0-9]{12}:[A-Za-z0-9_-]+$' 'must be an SNS topic ARN'
check SNS_TOPIC_ARN_US_EAST_1 '^arn:aws[a-z-]*:sns:us-east-1:[0-9]{12}:[A-Za-z0-9_-]+$' 'must be an SNS topic ARN in us-east-1'
check API_HEALTH_CHECK_ID '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 'must be a Route 53 health check id'
check ALB_ARN_SUFFIX '^app/[A-Za-z0-9-]{1,32}/[0-9a-f]{16}$' 'must look like app/<name>/<16 hex digits>'
check BACKUP_VAULT_NAME '^[A-Za-z0-9_.-]{2,50}$' 'must be an AWS Backup vault name'
check FIVE_XX_RATE_PERCENT '^([1-9]|[1-9][0-9]|100)$' 'must be a whole percentage from 1 to 100'
check FIVE_XX_MIN_REQUESTS '^[1-9][0-9]{0,5}$' 'must be a positive whole number'
if [ "${SNS_TOPIC_ARN-}" != '' ] && [[ ${SNS_TOPIC_ARN-} != *":sns:${AWS_REGION-}:"* ]]; then
    problems+=("SNS_TOPIC_ARN must be in AWS_REGION: alarm actions cannot cross regions")
fi
if [ ${#problems[@]} -gt 0 ]; then
    printf 'Cannot render the alarms:\n' >&2
    printf ' - %s\n' "${problems[@]}" >&2
    exit 1
fi

# Values are validated above and contain none of sed's specials for the '|'
# delimiter, so a plain substitution is safe.
render() {
    local file=$1 expression='' name value
    for name in "${PLACEHOLDERS[@]}"; do
        value=${name#__}; value=${value%__}; value=${!value}
        expression+="s|${name}|${value}|g;"
    done
    sed "$expression" "$file"
}

files=("$here"/[0-9][0-9]-*.json)
if [ ${#files[@]} -ne 6 ]; then
    echo "Expected exactly six alarm files, found ${#files[@]}" >&2
    exit 1
fi

[ -n "$out" ] && mkdir -p "$out"
for file in "${files[@]}"; do
    name=$(basename "$file")
    rendered=$(render "$file")
    if leftover=$(grep -oE '__[A-Z0-9_]+__' <<< "$rendered"); then
        echo "$name still has placeholders: $leftover" >&2
        exit 1
    fi
    # Route 53 publishes health-check metrics only in us-east-1.
    region=$AWS_REGION
    if grep -q '"AWS/Route53"' <<< "$rendered"; then region=us-east-1; fi

    if [ -n "$out" ]; then
        printf '%s\n' "$rendered" > "$out/$name"
        echo "rendered $name ($region) -> $out/$name"
    elif [ "$apply" -eq 0 ]; then
        echo "### $name (region $region)"
        printf '%s\n' "$rendered"
    fi
    if [ "$apply" -eq 1 ]; then
        tmp=$(mktemp)
        printf '%s\n' "$rendered" > "$tmp"
        # Git Bash on Windows: aws.exe needs a native path.
        input=$tmp
        if command -v cygpath >/dev/null 2>&1; then input=$(cygpath -w "$tmp"); fi
        aws cloudwatch put-metric-alarm --region "$region" --cli-input-json "file://$input"
        rm -f "$tmp"
        echo "applied $name in $region"
    fi
done

if [ "$apply" -eq 0 ]; then
    echo "Rendered ${#files[@]} alarms. Nothing was sent; re-run with --apply to create or update them." >&2
fi
