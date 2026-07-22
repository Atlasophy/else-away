@echo off
setlocal
cd /d "%~dp0"

set "PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

if not exist "%PYTHON%" (
  echo Could not find Codex's bundled Python runtime.
  echo Please open this project in Codex once and try again.
  pause
  exit /b 1
)

echo Starting Else Away at http://localhost:8000
echo Keep this window open while viewing the site.
echo Press Ctrl+C to stop the server.
echo.

start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Milliseconds 900; Start-Process 'http://localhost:8000'"
"%PYTHON%" -m http.server 8000 --bind 127.0.0.1

endlocal
