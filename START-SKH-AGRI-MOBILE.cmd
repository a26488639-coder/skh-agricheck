@echo off
setlocal
cd /d "%~dp0"
start "SKH AgriCheck Local Server" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve-local.ps1"
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:8765/"
endlocal
