[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$backendDirectory = Join-Path $projectRoot "services\api"
$mobileDirectory = Join-Path $projectRoot "apps\member-app"
$infrastructureDirectory = Join-Path $projectRoot "infrastructure\local"
$backendEnvironment = Join-Path $backendDirectory ".env"
$composeBase = Join-Path $infrastructureDirectory "compose.yml"
$composePreview = Join-Path $infrastructureDirectory "compose.free-preview.yml"
$mobileEnvironment = Join-Path $mobileDirectory ".env.local"
$expoCli = Join-Path $projectRoot "node_modules\expo\bin\cli"
$adcPath = Join-Path $env:APPDATA "gcloud\application_default_credentials.json"
$projectName = "gogymgo-free-preview"
$previewPort = 8081
$apiHostPort = 3002

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker is required to start the free preview."
}
if (-not (Test-Path -LiteralPath $backendEnvironment)) {
  throw "services/api/.env is missing. Create it from services/api/.env.example first."
}
if (-not (Test-Path -LiteralPath $adcPath)) {
  throw "Google application-default credentials are missing. Run: gcloud auth application-default login"
}

$env:GOGYMGO_GOOGLE_ADC_PATH = (Resolve-Path -LiteralPath $adcPath).Path
$env:GOGYMGO_API_HOST_PORT = "$apiHostPort"
$lanAddress = Get-NetIPAddress `
  -AddressFamily IPv4 `
  -PrefixOrigin Dhcp `
  -ErrorAction SilentlyContinue |
  Where-Object {
    $_.IPAddress -notlike "127.*" -and
    $_.InterfaceAlias -notmatch "vEthernet|Loopback"
  } |
  Select-Object -ExpandProperty IPAddress -First 1
$previewOrigins = [Collections.Generic.List[string]]::new()
foreach ($origin in @(
  "http://localhost:$previewPort",
  "http://localhost:19006",
  "http://localhost:19000"
)) {
  $previewOrigins.Add($origin)
}
if ($lanAddress) {
  $previewOrigins.Add("http://${lanAddress}:$previewPort")
}
$env:GOGYMGO_PREVIEW_CORS_ORIGINS = $previewOrigins -join ","
$composeArguments = @(
  "compose",
  "--project-name", $projectName,
  "--env-file", $backendEnvironment,
  "-f", $composeBase,
  "-f", $composePreview
)

function Invoke-Compose {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

  & docker @composeArguments @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose failed with exit code $LASTEXITCODE."
  }
}

function Wait-ForTunnelUrl {
  param(
    [Parameter(Mandatory = $true)][string]$ServiceName,
    [int]$TimeoutSeconds = 120
  )

  $tunnelDeadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $tunnelDeadline) {
    $logs = & docker @composeArguments logs --no-color $ServiceName 2>&1
    $matches = [regex]::Matches(
      ($logs -join "`n"),
      "https://[a-z0-9-]+\.trycloudflare\.com"
    )
    if ($matches.Count -gt 0) {
      return $matches[$matches.Count - 1].Value
    }
    Start-Sleep -Seconds 2
  }

  throw "$ServiceName did not publish an HTTPS URL within $TimeoutSeconds seconds."
}

Write-Host "Starting GoGymGo database..."
Invoke-Compose up --detach database

Write-Host "Building and starting migrations, API, worker, and tunnel..."
Invoke-Compose up --detach --build --force-recreate migrate api worker tunnel

$tunnelUrl = Wait-ForTunnelUrl -ServiceName "tunnel"

$environmentLines = if (Test-Path -LiteralPath $mobileEnvironment) {
  [Collections.Generic.List[string]]::new(
    [string[]](Get-Content -LiteralPath $mobileEnvironment)
  )
} else {
  [Collections.Generic.List[string]]::new()
}
$apiLineIndex = -1
for ($index = 0; $index -lt $environmentLines.Count; $index += 1) {
  if ($environmentLines[$index] -match "^EXPO_PUBLIC_API_URL=") {
    $apiLineIndex = $index
    break
  }
}
$apiLine = "EXPO_PUBLIC_API_URL=$tunnelUrl"
if ($apiLineIndex -ge 0) {
  $environmentLines[$apiLineIndex] = $apiLine
} else {
  $environmentLines.Insert(0, $apiLine)
}
[IO.File]::WriteAllLines(
  $mobileEnvironment,
  $environmentLines,
  [Text.UTF8Encoding]::new($false)
)

$existingListener = Get-NetTCPConnection `
  -State Listen `
  -LocalPort $previewPort `
  -ErrorAction SilentlyContinue |
  Select-Object -First 1
if ($existingListener) {
  $existingProcess = Get-CimInstance Win32_Process `
    -Filter "ProcessId=$($existingListener.OwningProcess)"
  if (
    $existingProcess.CommandLine.IndexOf(
      $mobileDirectory,
      [StringComparison]::OrdinalIgnoreCase
    ) -lt 0
  ) {
    throw "Port $previewPort is occupied by a process outside this GoGymGo workspace."
  }
  Stop-Process -Id $existingProcess.ProcessId -Force
}
$portReleaseDeadline = (Get-Date).AddSeconds(15)
do {
  $remainingListener = Get-NetTCPConnection `
    -State Listen `
    -LocalPort $previewPort `
    -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($remainingListener) {
    Start-Sleep -Milliseconds 500
  }
} while ($remainingListener -and (Get-Date) -lt $portReleaseDeadline)
if ($remainingListener) {
  throw "Port $previewPort did not become available after the previous Expo process stopped."
}

$expoStdout = Join-Path $mobileDirectory ".expo-web-free-preview.stdout.log"
$expoStderr = Join-Path $mobileDirectory ".expo-web-free-preview.stderr.log"
$nodeExecutable = (Get-Command node.exe -ErrorAction Stop).Source
$quotedExpoCli = '"{0}"' -f $expoCli
Start-Process `
  -FilePath $nodeExecutable `
  -ArgumentList @(
    "--max-old-space-size=512",
    $quotedExpoCli,
    "start",
    "--web",
    "--host",
    "lan",
    "--port",
    "$previewPort",
    "--clear"
  ) `
  -WorkingDirectory $mobileDirectory `
  -RedirectStandardOutput $expoStdout `
  -RedirectStandardError $expoStderr `
  -WindowStyle Hidden

$expoDeadline = (Get-Date).AddMinutes(2)
$expoListener = $null
while ((Get-Date) -lt $expoDeadline) {
  $expoListener = Get-NetTCPConnection `
    -State Listen `
    -LocalPort $previewPort `
    -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($expoListener) {
    break
  }
  Start-Sleep -Seconds 2
}
if (-not $expoListener) {
  throw "Expo did not begin listening on http://localhost:$previewPort within two minutes."
}

Write-Host "Publishing the secure browser preview..."
Invoke-Compose up --detach --force-recreate web-tunnel
$webTunnelUrl = Wait-ForTunnelUrl -ServiceName "web-tunnel"
$previewOrigins.Add($webTunnelUrl)
$env:GOGYMGO_PREVIEW_CORS_ORIGINS = $previewOrigins -join ","
Invoke-Compose up --detach --force-recreate api

$readinessDeadline = (Get-Date).AddMinutes(2)
$readiness = $null
while ((Get-Date) -lt $readinessDeadline) {
  try {
    $candidate = Invoke-RestMethod `
      -Uri "$tunnelUrl/v1/health/ready" `
      -TimeoutSec 15
    if (
      $candidate.status -eq "ok" -and
      $candidate.dependencies.database -eq "ok" -and
      $candidate.dependencies.worker -eq "healthy"
    ) {
      $readiness = $candidate
      break
    }
  } catch {
    # The API or tunnel may still be reconnecting after the CORS update.
  }
  Start-Sleep -Seconds 2
}
if (-not $readiness) {
  throw "The public GoGymGo API did not report a healthy database and worker."
}

Write-Host ""
Write-Host "GoGymGo free preview is ready."
Write-Host "App: http://localhost:$previewPort/"
Write-Host "App Tour: http://localhost:$previewPort/app-tour"
Write-Host "Phone (secure): $webTunnelUrl/"
if ($lanAddress) {
  Write-Host "LAN fallback: http://${lanAddress}:$previewPort/"
  Write-Host "LAN App Tour: http://${lanAddress}:$previewPort/app-tour"
} else {
  Write-Host "LAN fallback: No active DHCP Wi-Fi or Ethernet address was detected."
}
Write-Host "Public API: $tunnelUrl"
Write-Host "Database: healthy"
Write-Host "Worker: healthy"
