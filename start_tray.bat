@echo off
cd /d "%~dp0"
taskkill /F /IM connor-tray.exe /T    >nul 2>&1
taskkill /F /IM connor-tray-v2.exe /T >nul 2>&1
timeout /t 1 /nobreak >nul
start "" "%~dp0tauri-front\src-tauri\target\release\connor-tray-v2.exe"
