@echo off
cd /d "%~dp0"
echo [Connor] Sync config.json with config.example.json ...
py -3.11 "%~dp0python-core\scripts\merge_config.py" --write
if errorlevel 1 (
  echo [Connor] merge failed — is Python 3.11 installed?
  pause
  exit /b 1
)
echo [Connor] OK. Restart Connor: stop_connor.bat then launch.
pause
