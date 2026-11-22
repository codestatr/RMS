$ErrorActionPreference = 'Stop'
$launcher = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'Open-Admin.bat'
if (-not (Test-Path -LiteralPath $launcher)) {
  throw "Admin launcher not found: $launcher"
}

& $launcher
exit $LASTEXITCODE
