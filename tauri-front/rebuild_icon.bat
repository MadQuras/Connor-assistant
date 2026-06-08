@echo off
chcp 65001 > nul
echo [1/3] Останавливаем старый процесс...
taskkill /F /IM connor-tray.exe /T 2>nul
taskkill /F /IM connor-tray-v2.exe /T 2>nul
timeout /t 1 /nobreak > nul

echo [2/3] Пересобираем бинарь с новой иконкой (tauri build)...
cd /d "%~dp0"
call npm run tauri build
if %ERRORLEVEL% neq 0 (
    echo ОШИБКА: tauri build упал. Исправь ошибки выше.
    pause
    exit /b 1
)

echo [3/3] Готово. Запускай start.bat для старта приложения.
pause
