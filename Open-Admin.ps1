$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$adminDir = Join-Path $repo 'admin-client'
$backendDir = Join-Path $repo 'backend'
$logPath = Join-Path $repo 'admin-launch.log'
$stdoutPath = Join-Path $repo 'admin-electron-output.log'
$stderrPath = Join-Path $repo 'admin-electron-error.log'
$npm = Get-Command npm.cmd -ErrorAction Stop
$node = Get-Command node.exe -ErrorAction Stop

Set-Content -LiteralPath $logPath -Value "RMS Admin launcher started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
try {
  if (-not (Test-Path -LiteralPath $adminDir)) { throw "Admin client folder not found: $adminDir" }

  $electronCli = Join-Path $repo 'node_modules\electron\cli.js'
  $electronExe = Join-Path $repo 'node_modules\electron\dist\electron.exe'
  if (-not (Test-Path -LiteralPath $electronCli) -or -not (Test-Path -LiteralPath $electronExe)) {
    Add-Content -LiteralPath $logPath -Value 'Installing missing Electron files...'
    Push-Location $repo
    try {
      & $npm.Source install --workspace @rms/admin-client --no-audit --no-fund >> $logPath 2>&1
      if ($LASTEXITCODE -ne 0) { throw "Electron dependency install failed with exit code $LASTEXITCODE." }
    } finally {
      Pop-Location
    }
    if (-not (Test-Path -LiteralPath $electronCli) -or -not (Test-Path -LiteralPath $electronExe)) {
      throw "Electron files are still missing after installation. See $logPath"
    }
  }

  Add-Content -LiteralPath $logPath -Value 'Building the admin client...'
  Push-Location $repo
  try {
    & $npm.Source run build --workspace @rms/admin-client >> $logPath 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Admin build failed with exit code $LASTEXITCODE." }
  } finally {
    Pop-Location
  }

  Add-Content -LiteralPath $logPath -Value 'Restarting backend API...'
  Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
  Start-Process -FilePath $env:ComSpec -ArgumentList @('/d', '/s', '/c', 'npm.cmd start') `
    -WorkingDirectory $backendDir -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $backendDir 'backend-launch.log') `
    -RedirectStandardError (Join-Path $backendDir 'backend-launch-error.log') | Out-Null

  $apiReady = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
      Invoke-RestMethod 'http://127.0.0.1:3000/health' -TimeoutSec 2 | Out-Null
      $apiReady = $true
      break
    } catch {
      Start-Sleep -Seconds 1
    }
  }
  if (-not $apiReady) { throw "Backend did not become ready. See $backendDir\backend-launch-error.log" }

  if (-not (Test-Path -LiteralPath (Join-Path $adminDir 'out\main\main.js'))) {
    throw 'Electron build did not create admin-client\out\main\main.js.'
  }

  Add-Content -LiteralPath $logPath -Value 'Starting Electron...'
  Start-Process -FilePath $node.Source -ArgumentList @($electronCli, '.') `
    -WorkingDirectory $adminDir -WindowStyle Normal `
    -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath | Out-Null
  Add-Content -LiteralPath $logPath -Value 'Electron launch process started.'
} catch {
  Add-Content -LiteralPath $logPath -Value "ERROR: $($_.Exception.Message)"
  Write-Host "RMS Admin failed to start: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
