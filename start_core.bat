@echo off
cd /d "%~dp0python-core"
taskkill /F /IM python.exe /T  >nul 2>&1
taskkill /F /IM pythonw.exe /T >nul 2>&1
timeout /t 1 /nobreak >nul
"C:\Users\CompX\AppData\Local\Programs\Python\Python311\pythonw.exe" main.py
