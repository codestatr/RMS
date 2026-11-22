@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "LOG=%~dp0admin-launch.log"
set "ELECTRON_CLI=%~dp0node_modules\electron\cli.js"
set "ELECTRON_EXE=%~dp0node_modules\electron\dist\electron.exe"
set "ADMIN_DIR=%~dp0admin-client"

>"%LOG%" echo RMS Admin launcher started: %DATE% %TIME%

where npm.cmd >nul 2>&1
if errorlevel 1 goto npm_missing
where node.exe >nul 2>&1
if errorlevel 1 goto node_missing

if exist "%ELECTRON_CLI%" if exist "%ELECTRON_EXE%" goto build_admin

>>"%LOG%" echo Installing admin client dependencies...
call npm.cmd install --workspace @rms/admin-client --no-audit --no-fund >>"%LOG%" 2>&1
if errorlevel 1 goto install_failed
if not exist "%ELECTRON_CLI%" goto electron_missing
if not exist "%ELECTRON_EXE%" goto electron_missing

:build_admin
>>"%LOG%" echo Building the admin client...
call npm.cmd run build --workspace @rms/admin-client >>"%LOG%" 2>&1
if errorlevel 1 goto build_failed
if not exist "%ADMIN_DIR%\out\main\main.js" goto main_missing

>>"%LOG%" echo Checking backend API...
curl.exe --silent --fail http://127.0.0.1:3000/health >nul 2>&1
if not errorlevel 1 goto launch_electron

>>"%LOG%" echo Starting backend API...
pushd "%~dp0backend"
start "RMS Backend" /min cmd.exe /d /c "npm.cmd start >> backend-launch.log 2>&1"
popd

set /a ATTEMPTS=0
:wait_backend
curl.exe --silent --fail http://127.0.0.1:3000/health >nul 2>&1
if not errorlevel 1 goto launch_electron
set /a ATTEMPTS+=1
if %ATTEMPTS% GEQ 30 goto backend_failed
timeout /t 1 /nobreak >nul
goto wait_backend

:launch_electron
>>"%LOG%" echo Starting Electron...
start "RMS Admin" "%ELECTRON_EXE%" "%ADMIN_DIR%"
if errorlevel 1 goto electron_start_failed
>>"%LOG%" echo Electron started.
exit /b 0

:npm_missing
>>"%LOG%" echo ERROR: npm.cmd was not found. Install Node.js and reopen this file.
goto failed

:node_missing
>>"%LOG%" echo ERROR: node.exe was not found. Install Node.js and reopen this file.
goto failed

:install_failed
>>"%LOG%" echo ERROR: Admin dependency installation failed. See the npm output above.
goto failed

:electron_missing
>>"%LOG%" echo ERROR: Electron files are missing after dependency installation.
goto failed

:build_failed
>>"%LOG%" echo ERROR: Admin build failed. See the npm output above.
goto failed

:main_missing
>>"%LOG%" echo ERROR: Build did not create admin-client\out\main\main.js.
goto failed

:backend_failed
>>"%LOG%" echo ERROR: Backend did not respond at http://127.0.0.1:3000/health within 30 seconds. Check backend\backend-launch.log and backend\backend-launch-error.log.
goto failed

:electron_start_failed
>>"%LOG%" echo ERROR: Windows could not start Electron.

:failed
echo.
echo RMS Admin failed to start. Details are in:
echo %LOG%
echo.
pause
exit /b 1
