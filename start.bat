@echo off
cd /d "%~dp0"

call "%~dp0find_pythonw.bat"
if errorlevel 1 (
  echo.
  pause
  exit /b 1
)

:: Kill old processes
taskkill /F /IM python.exe /T    >nul 2>&1
taskkill /F /IM pythonw.exe /T   >nul 2>&1
taskkill /F /IM connor-tray.exe /T    >nul 2>&1
taskkill /F /IM connor-tray-v2.exe /T >nul 2>&1
timeout /t 1 /nobreak >nul

:: Start Python core (no console window)
start "" /b "%PYTHONW%" "%~dp0python-core\main.py"

timeout /t 1 /nobreak >nul

:: Start Tauri UI
start "" "%~dp0tauri-front\src-tauri\target\release\connor-tray-v2.exe"

:: Sync fresh build into installed Connor RK800 (if Setup was used)
if exist "%LOCALAPPDATA%\Programs\Connor RK800\tauri-front\src-tauri\target\release\" (
  copy /Y "%~dp0tauri-front\src-tauri\target\release\connor-tray-v2.exe" "%LOCALAPPDATA%\Programs\Connor RK800\tauri-front\src-tauri\target\release\" >nul 2>&1
  copy /Y "%~dp0tauri-front\src-tauri\icons\icon.ico" "%LOCALAPPDATA%\Programs\Connor RK800\tauri-front\src-tauri\icons\" >nul 2>&1
)
