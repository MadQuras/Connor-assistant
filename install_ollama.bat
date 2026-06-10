@echo off
cd /d "%~dp0"
echo [Connor] Ollama + Gemma 4...
PowerShell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install_ollama.ps1" %*
if errorlevel 1 (
  echo [Connor] Ollama setup failed.
  pause
  exit /b 1
)
echo [Connor] Done.
pause
