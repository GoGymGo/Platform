[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$backendDirectory = Join-Path $projectRoot "services\api"
$mobileDirectory = Join-Path $projectRoot "apps\member-app"
$infrastructureDirectory = Join-Path $projectRoot "infrastructure\local"
$expoCli = Join-Path $projectRoot "node_modules\expo\bin\cli"
$backendEnvironment = Join-Path $backendDirectory ".env"
$composeBase = Join-Path $infrastructureDirectory "compose.yml"
$composePreview = Join-Path $infrastructureDirectory "compose.free-preview.yml"
$adcPath = Join-Path $env:APPDATA "gcloud\application_default_credentials.json"

$listener = Get-NetTCPConnection `
  -State Listen `
  -LocalPort 8081 `
  -ErrorAction SilentlyContinue |
  Select-Object -First 1
if ($listener) {
  $process = Get-CimInstance Win32_Process `
    -Filter "ProcessId=$($listener.OwningProcess)"
  if (
    $process.CommandLine.IndexOf(
      $expoCli,
      [StringComparison]::OrdinalIgnoreCase
    ) -ge 0 -or
    $process.CommandLine.IndexOf(
      $mobileDirectory,
      [StringComparison]::OrdinalIgnoreCase
    ) -ge 0
  ) {
    Stop-Process -Id $process.ProcessId -Force
  } else {
    Write-Warning "Port 8081 belongs to another workspace and was left running."
  }
}

if (Test-Path -LiteralPath $adcPath) {
  $env:GOGYMGO_GOOGLE_ADC_PATH = (Resolve-Path -LiteralPath $adcPath).Path
}

& docker compose `
  --project-name gogymgo-free-preview `
  --env-file $backendEnvironment `
  -f $composeBase `
  -f $composePreview `
  stop
if ($LASTEXITCODE -ne 0) {
  throw "Docker Compose failed with exit code $LASTEXITCODE."
}

Write-Host "GoGymGo free preview stopped. The local database volume was preserved."
