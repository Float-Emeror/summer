param(
  [switch]$SkipChecks,
  [switch]$SkipSeed,
  [switch]$SkipInstall,
  [switch]$SkipDocker
)

$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$ErrorActionPreference = "Stop"

function Run-Step {
  param(
    [string]$Title,
    [scriptblock]$Command
  )

  Write-Host ""
  Write-Host "==> $Title" -ForegroundColor Cyan
  $global:LASTEXITCODE = 0
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Step failed with exit code ${LASTEXITCODE}: $Title"
  }
}

function Ensure-FileFromExample {
  param(
    [string]$Target
  )

  if (-not (Test-Path -LiteralPath $Target)) {
    Copy-Item -LiteralPath ".env.example" -Destination $Target
    Write-Host "Created $Target from .env.example"
  }
}

function Test-TcpPort {
  param(
    [string]$TargetHost,
    [int]$Port,
    [int]$TimeoutMs = 1500
  )

  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect($TargetHost, $Port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) {
      return $false
    }

    $client.EndConnect($async)
    return $true
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Stop-ListeningPort {
  param(
    [int[]]$Ports
  )

  $listenLines = netstat -ano -p tcp | Select-String 'LISTENING'
  $pids = New-Object System.Collections.Generic.HashSet[int]

  foreach ($port in $Ports) {
    foreach ($line in $listenLines) {
      if ($line.Line -match "[:\[]$port\s") {
        $parts = ($line.Line -replace '\s+', ' ').Trim() -split ' '
        $pidText = $parts[-1]
        if ($pidText -match '^\d+$') {
          [void]$pids.Add([int]$pidText)
        }
      }
    }
  }

  if ($pids.Count -gt 0) {
    $pidList = @($pids)
    Write-Host "Stopping lingering listeners on ports $($Ports -join ', '): $($pidList -join ', ')"
    Stop-Process -Id $pidList -Force
    Start-Sleep -Seconds 1
  }
}

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
  Run-Step "Prepare local env files" {
    Ensure-FileFromExample ".env"
    Ensure-FileFromExample "backend\.env"
  }

  Run-Step "Install workspace dependencies" {
    if ($SkipInstall) {
      Write-Host "Skipped by -SkipInstall"
      return
    }

    $hasRootModules = Test-Path -LiteralPath "node_modules"
    $hasBackendModules = Test-Path -LiteralPath "backend\node_modules"
    $hasFrontendModules = Test-Path -LiteralPath "frontend\node_modules"

    if ($hasRootModules -and $hasBackendModules -and $hasFrontendModules) {
      Write-Host "Dependencies already exist. Skip install."
      return
    }

    corepack pnpm install --no-frozen-lockfile --prefer-offline
  }

  Run-Step "Start MySQL dependency" {
    if ($SkipDocker) {
      Write-Host "Skipped by -SkipDocker"
      return
    }

    Write-Host "About to start the MySQL container with Docker Compose."
    Write-Host "Please make sure Docker Desktop / Docker Engine is already running on this device."
    docker compose up -d mysql

    if ($LASTEXITCODE -ne 0) {
      if (Test-TcpPort -TargetHost '127.0.0.1' -Port 3307) {
        Write-Warning "Docker is unavailable, but MySQL is reachable on localhost:3307. Continue with the existing database instance."
        return
      }

      throw "Docker is unavailable and no MySQL instance was detected on localhost:3307. Start Docker Desktop first, or run this script with -SkipDocker after pointing DATABASE_URL to an available MySQL instance."
    }

    Start-Sleep -Seconds 10
  }

  Run-Step "Sync Prisma schema" {
    corepack pnpm prisma:push
  }

  if (-not $SkipSeed) {
    Run-Step "Seed test accounts" {
      corepack pnpm seed:test-user
    }
  }

  Run-Step "Export account snapshot" {
    corepack pnpm export:accounts-cache
    Write-Host "Editable seed accounts: cache/accounts.toml"
    Write-Host "Read-only database snapshot: cache/accounts.db.toml"
    Write-Host "Compare both files before migrating accounts; the snapshot is overwritten on each startup."
  }

  if (-not $SkipChecks) {
    Run-Step "Run build, tests and lint" {
      corepack pnpm build
      corepack pnpm test
      corepack pnpm lint
    }
  }

  Run-Step "Start backend and frontend dev servers" {
    Stop-ListeningPort -Ports @(3000, 4317, 5173)
    corepack pnpm dev
  }
} finally {
  Stop-ListeningPort -Ports @(3000, 4317, 5173)
  Pop-Location
}
