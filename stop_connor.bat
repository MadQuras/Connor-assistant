@echo off
chcp 65001 > nul
echo Останавливаем Connor RK800...

taskkill /F /IM connor-tray-v2.exe /T >nul 2>&1
taskkill /F /IM connor-tray.exe /T >nul 2>&1

:: Python-ядро: в диспетчере задач это pythonw.exe, не Connor
powershell -NoProfile -Command ^
  "Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'pythonw.exe' -or $_.Name -eq 'python.exe') -and $_.CommandLine -match 'python-core\\main\.py' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

echo Готово. Connor остановлен.
pause
