<##
.SYNOPSIS
    Validate the production configuration contract before starting a release.

.DESCRIPTION
    Checks the same variables, with the same rules, as the API's own startup
    check (apps/api/.../config/ProductionConfigValidator.java) and the POSIX
    port (validate-production-config.sh). If this script passes, the API's
    configuration check will pass too; keep all three in step.

    Reports every problem at once, by variable name. It never prints values
    and never contacts Firebase, SMTP, object storage, or a database.
##>
param()

$ErrorActionPreference = 'Stop'
$problems = [System.Collections.Generic.List[string]]::new()

function Get-Setting([string]$Name) {
    $value = [Environment]::GetEnvironmentVariable($Name)
    if ($null -eq $value) { return $null }
    return $value.Trim()
}

# Returns the trimmed value, or $null after recording "is not set".
function Require-Setting([string]$Name) {
    $value = Get-Setting $Name
    if ([string]::IsNullOrEmpty($value)) {
        $problems.Add("$Name is not set")
        return $null
    }
    return $value
}

function Test-HttpsOrigin([string]$Origin) {
    $o = $Origin.Trim()
    if (-not $o.StartsWith('https://', [StringComparison]::Ordinal)) { return $false }
    $authority = $o.Substring(8)
    if ($authority.Length -eq 0) { return $false }
    return -not ($authority.Contains('/') -or $authority.Contains('?') -or $authority.Contains('#'))
}

# Script-only: the API cannot check the profile that selects its own checks.
$profiles = Get-Setting 'SPRING_PROFILES_ACTIVE'
if ([string]::IsNullOrEmpty($profiles) -or -not (($profiles -replace '\s', '') -split ',' -contains 'production')) {
    $problems.Add('SPRING_PROFILES_ACTIVE must include production')
}

$dbUrl = Require-Setting 'DB_URL'
if ($null -ne $dbUrl -and -not ($dbUrl -cmatch '^jdbc:postgresql://[^/]')) {
    $problems.Add('DB_URL must be a jdbc:postgresql:// URL with a host')
}
$null = Require-Setting 'POSTGRES_USER'
$null = Require-Setting 'POSTGRES_PASSWORD'

$origins = Require-Setting 'DARI_WEB_ORIGIN'
if ($null -ne $origins) {
    $bad = @($origins.Split(',') | Where-Object { -not (Test-HttpsOrigin $_) })
    if ($bad.Count -gt 0) {
        $problems.Add('DARI_WEB_ORIGIN must be a comma-separated list of https origins with no path or trailing slash')
    }
}

$credentials = Require-Setting 'FIREBASE_CREDENTIALS_PATH'
if ($null -ne $credentials) {
    $readable = $false
    if (Test-Path -LiteralPath $credentials -PathType Leaf) {
        try { [System.IO.File]::OpenRead($credentials).Dispose(); $readable = $true } catch { }
    }
    if (-not $readable) { $problems.Add('FIREBASE_CREDENTIALS_PATH must point to a readable file') }
}

$fuzzSecret = Require-Setting 'DARI_LOCATION_FUZZ_SECRET'
if ($null -ne $fuzzSecret -and $fuzzSecret.Length -lt 32) {
    $problems.Add('DARI_LOCATION_FUZZ_SECRET must be at least 32 characters long')
}
$ssrSecret = Require-Setting 'DARI_SSR_SHARED_SECRET'
if ($null -ne $ssrSecret -and $ssrSecret.Length -lt 32) {
    $problems.Add('DARI_SSR_SHARED_SECRET must be at least 32 characters long')
}
$null = Require-Setting 'DARI_TRUSTED_PROXY_IPS'

# The deployed image tag; latest moves and development is the non-production default.
$release = Require-Setting 'DARI_RELEASE_VERSION'
if ($null -ne $release -and (-not ($release -cmatch '^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$') -or
        @('latest', 'development') -contains $release.ToLowerInvariant())) {
    $problems.Add('DARI_RELEASE_VERSION must be the deployed image tag (letters, digits, . _ + - only; not latest or development)')
}

$provider = Require-Setting 'DARI_MEDIA_PROVIDER'
if ($null -ne $provider -and $provider.ToLowerInvariant() -ne 's3') {
    $problems.Add('DARI_MEDIA_PROVIDER must be s3 in production')
}
$publicBaseUrl = Require-Setting 'DARI_MEDIA_PUBLIC_BASE_URL'
if ($null -ne $publicBaseUrl -and -not ($publicBaseUrl.ToLowerInvariant() -cmatch '^https://[^/]')) {
    $problems.Add('DARI_MEDIA_PUBLIC_BASE_URL must be an https URL')
}
'DARI_MEDIA_S3_ENDPOINT', 'DARI_MEDIA_S3_REGION', 'DARI_MEDIA_S3_BUCKET',
'DARI_MEDIA_S3_ACCESS_KEY', 'DARI_MEDIA_S3_SECRET_KEY' | ForEach-Object { $null = Require-Setting $_ }

# Unset means the production default, true. Set to anything else is an error.
if ($null -ne [Environment]::GetEnvironmentVariable('DARI_NOTIFICATIONS_ENABLED')) {
    $enabled = Require-Setting 'DARI_NOTIFICATIONS_ENABLED'
    if ($null -ne $enabled -and $enabled.ToLowerInvariant() -ne 'true') {
        $problems.Add('DARI_NOTIFICATIONS_ENABLED must not be false in production; notifications are the only channel to users')
    }
}
$from = Require-Setting 'DARI_NOTIFICATIONS_FROM'
if ($null -ne $from -and -not $from.Contains('@')) {
    $problems.Add('DARI_NOTIFICATIONS_FROM must be an email address')
}
$null = Require-Setting 'SMTP_HOST'
# Unset means the production default, 587.
if ($null -ne [Environment]::GetEnvironmentVariable('SMTP_PORT')) {
    $port = Require-Setting 'SMTP_PORT'
    $number = 0
    if ($null -ne $port -and -not ([int]::TryParse($port, [ref]$number) -and $number -ge 1 -and $number -le 65535)) {
        $problems.Add('SMTP_PORT must be a port number between 1 and 65535')
    }
}
$null = Require-Setting 'SMTP_USERNAME'
$null = Require-Setting 'SMTP_PASSWORD'

if ($problems.Count -gt 0) {
    $noun = if ($problems.Count -eq 1) { 'problem' } else { 'problems' }
    Write-Host "Production configuration is invalid ($($problems.Count) $noun). Values are not shown."
    $problems | ForEach-Object { Write-Host " - $_" }
    exit 1
}

Write-Host 'Production configuration is valid. Values were not printed.'
