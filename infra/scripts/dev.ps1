<#
.SYNOPSIS
    Task runner for Dari. PowerShell rather than a Makefile, because make is not
    present on the machine this is developed on.

.EXAMPLE
    ./infra/scripts/dev.ps1 up        # start Postgres + MinIO
    ./infra/scripts/dev.ps1 api       # run the API on :8080
    ./infra/scripts/dev.ps1 web       # run the web app on :3000
    ./infra/scripts/dev.ps1 test      # API test suite (needs Docker)
    ./infra/scripts/dev.ps1 check     # compile + typecheck + token drift
#>
param(
    [Parameter(Position = 0)]
    [ValidateSet('up', 'down', 'api', 'web', 'test', 'check', 'psql', 'reset-db')]
    [string]$Task = 'check'
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '../..')

switch ($Task) {
    'up' {
        docker compose -f (Join-Path $root 'docker-compose.yml') up -d
        Write-Host 'Postgres :5432   MinIO :9000 (console :9001)'
    }

    'down' {
        docker compose -f (Join-Path $root 'docker-compose.yml') down
    }

    'api' {
        Push-Location (Join-Path $root 'apps/api')
        try { ./mvnw spring-boot:run '-Dspring-boot.run.profiles=local' }
        finally { Pop-Location }
    }

    'web' {
        Push-Location (Join-Path $root 'apps/web')
        try { npm run dev }
        finally { Pop-Location }
    }

    'test' {
        # Testcontainers needs a running Docker daemon; fail with a clear reason
        # rather than an opaque connection error thirty seconds in.
        docker info *> $null
        if ($LASTEXITCODE -ne 0) { throw 'Docker is not running. Integration tests need it.' }

        Push-Location (Join-Path $root 'apps/api')
        try { ./mvnw test }
        finally { Pop-Location }
    }

    'check' {
        Push-Location (Join-Path $root 'apps/api')
        try { ./mvnw -q test-compile }
        finally { Pop-Location }

        Push-Location (Join-Path $root 'apps/web')
        try {
            npm run typecheck
            node scripts/sync-tokens.mjs --check
        }
        finally { Pop-Location }
    }

    'psql' {
        docker exec -it dari-db psql -U dari -d dari
    }

    'reset-db' {
        # Drops the volume. Flyway rebuilds from V1 on the next API start.
        Write-Host 'This destroys all local data.' -ForegroundColor Yellow
        $answer = Read-Host 'Type the database name to confirm'
        if ($answer -ne 'dari') { throw 'Canceled.' }
        docker compose -f (Join-Path $root 'docker-compose.yml') down -v
    }
}
