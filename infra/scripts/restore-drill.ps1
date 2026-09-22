<##
.SYNOPSIS
    Restore a supplied pg_dump archive into an isolated disposable PostGIS container.

.DESCRIPTION
    This script is intentionally explicit about the archive path and uses a
    throwaway container name. It never connects to the configured application
    database and never reads production credentials.
##>
param(
    [Parameter(Mandatory = $true)]
    [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
    [string]$BackupFile
)

$ErrorActionPreference = 'Stop'
$container = "dari-restore-validation-$PID"
$archive = Split-Path -Leaf $BackupFile

docker run --name $container `
    -e POSTGRES_DB=dari_restore `
    -e POSTGRES_USER=dari_restore `
    -e POSTGRES_PASSWORD=dari_restore_validation `
    -d postgis/postgis:16-3.4 | Out-Null

try {
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        docker exec $container pg_isready -U dari_restore -d dari_restore *> $null
        if ($LASTEXITCODE -eq 0) { break }
        Start-Sleep -Seconds 2
        if ($attempt -eq 30) { throw 'Restore validation container did not become ready' }
    }

    # pg_isready can report success while the PostGIS image is still running
    # its database initialization scripts. Wait for the image-provided
    # extensions before changing the target database, otherwise the init
    # script can race the restore and terminate the container.
    $postgisInitialized = $false
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        $extensionCount = docker exec $container psql -U dari_restore -d dari_restore -tAc "SELECT count(*) FROM pg_extension WHERE extname IN ('fuzzystrmatch', 'postgis', 'postgis_tiger_geocoder', 'postgis_topology');"
        if ($LASTEXITCODE -eq 0 -and ($extensionCount | Out-String).Trim() -eq '4') {
            $postgisInitialized = $true
            break
        }
        Start-Sleep -Seconds 2
    }
    if (-not $postgisInitialized) { throw 'PostGIS validation container initialization did not complete' }
    Start-Sleep -Seconds 3
    docker exec $container pg_isready -U dari_restore -d dari_restore *> $null
    if ($LASTEXITCODE -ne 0) { throw 'PostGIS validation container restarted unexpectedly during initialization' }

    docker cp $BackupFile "${container}:/tmp/$archive"
    # The PostGIS image pre-installs extensions in the target database. A full
    # pg_dump archive also contains extension definitions, so remove the image
    # defaults first and let the archive recreate the exact source state.
    $dropExtensions = "DROP EXTENSION IF EXISTS postgis_tiger_geocoder CASCADE; DROP EXTENSION IF EXISTS postgis_topology CASCADE; DROP EXTENSION IF EXISTS postgis CASCADE; DROP EXTENSION IF EXISTS fuzzystrmatch CASCADE; DROP SCHEMA IF EXISTS tiger CASCADE; DROP SCHEMA IF EXISTS tiger_data CASCADE; DROP SCHEMA IF EXISTS topology CASCADE;"
    docker exec $container psql -U dari_restore -d dari_restore -v ON_ERROR_STOP=1 -c $dropExtensions
    if ($LASTEXITCODE -ne 0) { throw 'Could not prepare the disposable database for restore' }
    docker exec $container pg_restore -U dari_restore -d dari_restore --no-owner --exit-on-error "/tmp/$archive"
    if ($LASTEXITCODE -ne 0) { throw 'Restore command failed' }
    $checks = docker exec $container psql -U dari_restore -d dari_restore -v ON_ERROR_STOP=1 -tAc "SELECT count(*) FROM flyway_schema_history; SELECT postgis_full_version();"
    if ($LASTEXITCODE -ne 0) { throw 'Restore validation queries failed' }
    Write-Host 'Restore drill passed. Archive restored into an isolated disposable PostGIS container.'
    $checks | ForEach-Object { if ($_ -match 'POSTGIS|^[ ]*[0-9]+[ ]*$') { Write-Host $_.Trim() } }
}
finally {
    # -v also removes the image's anonymous data volume, which would otherwise
    # keep a full copy of the restored data after every drill.
    docker rm -f -v $container *> $null
}
