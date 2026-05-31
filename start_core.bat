@echo off
cd /d "%~dp0"

call "%~dp0find_pythonw.bat"
if errorlevel 1 (
  echo.
  pause
  exit /b 1
)

cd /d "%~dp0python-core"
taskkill /F /IM python.exe /T  >nul 2>&1
taskkill /F /IM pythonw.exe /T >nul 2>&1
timeout /t 1 /nobreak >nul
"%PYTHONW%" main.py
