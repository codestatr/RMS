Option Explicit

Dim shell, fso, root, backendDir, adminDir
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

root = fso.GetParentFolderName(WScript.ScriptFullName)
backendDir = root & "\backend"
adminDir = root & "\admin-client"

' Kill stale Electron/admin processes so the next launch starts fresh.
shell.Run "cmd.exe /c taskkill /F /IM electron.exe >nul 2>&1", 0, True
shell.Run "cmd.exe /c taskkill /F /IM ""RMS Admin.exe"" >nul 2>&1", 0, True

' Stop the previous backend without showing a console window.
shell.Run "cmd.exe /c for /f ""tokens=5"" %P in ('netstat -ano ^| findstr /R /C:"":3000 .*LISTENING""') do taskkill /PID %P /F >nul 2>&1", 0, True

' Start the backend hidden.
shell.CurrentDirectory = backendDir
shell.Run "cmd.exe /c npm.cmd start", 0, False

' Allow the backend time to initialize without spawning console checks.
WScript.Sleep 8000

' Rebuild the Electron renderer silently, then launch Electron silently.
shell.CurrentDirectory = adminDir
shell.Run "cmd.exe /c npm.cmd run build:electron", 0, True
shell.Run "cmd.exe /c npm.cmd exec electron .", 0, False
