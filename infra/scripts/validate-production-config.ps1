<##
.SYNOPSIS
    Validate the non-secret production configuration contract.

.DESCRIPTION
    Checks variable presence and safe shape only. It never prints values and
    never contacts Firebase, SMTP, object storage, or a production database.
    Run it in the deployment environment before starting a release.
##>
param()

$ErrorActionPreference = 'Stop'

function Require-Value([string]$Name) {
    $value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value)) { $script:missing += $Name }
}

$missing = @()
@(
    'DB_URL',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'DARI_WEB_ORIGIN',
    'FIREBASE_CREDENTIALS_PATH',
    'DARI_MEDIA_PROVIDER',
    'DARI_MEDIA_PUBLIC_BASE_URL'
) | ForEach-Object { Require-Value $_ }

if ($env:DARI_MEDIA_PROVIDER -eq 's3') {
    @('DARI_MEDIA_S3_ENDPOINT', 'DARI_MEDIA_S3_REGION', 'DARI_MEDIA_S3_ACCESS_KEY', 'DARI_MEDIA_S3_SECRET_KEY', 'DARI_MEDIA_S3_BUCKET') |
        ForEach-Object { Require-Value $_ }
}

if ($env:DARI_NOTIFICATIONS_ENABLED -eq 'true') {
    @('SMTP_HOST', 'SMTP_USERNAME', 'SMTP_PASSWORD', 'DARI_NOTIFICATIONS_FROM') |
        ForEach-Object { Require-Value $_ }
}

if ($missing.Count -gt 0) {
    throw "Production configuration is missing required variables: $($missing -join ', ')"
}

try {
    $db = [Uri]$env:DB_URL.Replace('jdbc:', '')
    if ($db.Scheme -ne 'postgresql' -or [string]::IsNullOrWhiteSpace($db.Host)) { throw 'DB_URL must be a PostgreSQL URL with a host' }
} catch {
    throw "DB_URL must be a valid PostgreSQL URL"
}

foreach ($origin in ($env:DARI_WEB_ORIGIN -split ',')) {
    try {
        $uri = [Uri]$origin.Trim()
        if ($uri.Scheme -ne 'https' -or $uri.AbsolutePath -ne '/') { throw 'not https origin' }
    } catch {
        throw 'DARI_WEB_ORIGIN must contain only HTTPS origins in production'
    }
}

if (-not (Test-Path -LiteralPath $env:FIREBASE_CREDENTIALS_PATH -PathType Leaf)) {
    throw 'FIREBASE_CREDENTIALS_PATH does not point to a readable file'
}

Write-Host 'Production configuration shape is valid. Secret values were not printed.'
