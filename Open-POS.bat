@echo off
setlocal
cd /d "%~dp0"
title RMS POS Launcher

set "POS_PROJECT=%~dp0pos-system\POSSystem\POSSystem.csproj"
set "POS_EXE=%~dp0pos-system\POSSystem\bin\Release\net7.0-windows\win-x64\publish-fixed\RMS.POSSystem.exe"

echo Starting RMS POS...

rem Start the API required for staff authentication when it is not already running.
netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul
if errorlevel 1 (
    echo Starting RMS Backend API...
    start "RMS Backend API" /D "%~dp0backend" cmd /c "npm.cmd start"
    for /L %%I in (1,1,15) do (
        netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul
        if not errorlevel 1 goto backend_ready
        timeout /t 1 /nobreak >nul
    )
    echo.
    echo Warning: Backend API is not responding on port 3000.
    echo POS login and synchronization may fail.
)
:backend_ready

if not exist "%POS_EXE%" (
    echo POS executable not found. Publishing it now...
    dotnet publish "%POS_PROJECT%" -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o "%~dp0pos-system\POSSystem\bin\Release\net7.0-windows\win-x64\publish-fixed"
    if errorlevel 1 (
        echo.
        echo POS publish failed. Make sure the .NET SDK is installed.
        pause
        exit /b 1
    )
)

if not exist "%POS_EXE%" (
    echo.
    echo Error: POS executable is still missing after publishing.
    pause
    exit /b 1
)

rem Always close any stale POS process before relaunching so the next start lands on the login screen.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$processes = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'RMS.POSSystem.exe' -or ($_.Name -eq 'dotnet.exe' -and $_.CommandLine -match 'POSSystem') }; if ($processes) { $processes | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } }"
start "RMS POS" "%POS_EXE%"
endlocal
