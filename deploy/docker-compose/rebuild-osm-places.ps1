param(
  [string]$ComposeFile = "deploy/docker-compose/docker-compose.yml",
  [string]$SqlFile = "apps/database/scripts/rebuild_osm_places.sql"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
$composePath = Join-Path $repoRoot $ComposeFile
$sqlPath = Join-Path $repoRoot $SqlFile

if (-not (Test-Path $composePath)) {
  throw "Compose file not found: $composePath"
}

if (-not (Test-Path $sqlPath)) {
  throw "SQL file not found: $sqlPath"
}

$sql = Get-Content -Raw -Path $sqlPath

$sql | docker compose -f $composePath exec -T db psql -U allplaces -d allplaces -v ON_ERROR_STOP=1