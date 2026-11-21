@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Open-Admin.ps1"
if errorlevel 1 (
  echo.
  echo RMS Admin failed to start. See admin-launch.log in the RMS folder.
  pause
)
endlocal
