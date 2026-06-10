@echo off
chcp 65001 > nul
echo [0/4] Генерация иконок (прозрачный фон)...
cd /d "%~dp0\.."
py -3 scripts\gen_app_icons.py
if %ERRORLEVEL% neq 0 (
    echo ОШИБКА: gen_app_icons.py — нужен Pillow: pip install Pillow
    pause
    exit /b 1
)

echo [1/4] Останавливаем старый процесс...
taskkill /F /IM connor-tray.exe /T 2>nul
taskkill /F /IM connor-tray-v2.exe /T 2>nul
timeout /t 1 /nobreak > nul

echo [2/4] Пересобираем бинарь с новой иконкой (tauri build)...
cd /d "%~dp0"
call npm run tauri build
if %ERRORLEVEL% neq 0 (
    echo ОШИБКА: tauri build упал. Исправь ошибки выше.
    pause
    exit /b 1
)

echo [3/4] Обновляем ярлык на рабочем столе...
cd /d "%~dp0\.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0\..\scripts\create_shortcut.ps1" -SkipGen
if %ERRORLEVEL% neq 0 (
    echo WARN: не удалось создать ярлык — запустите create_shortcut.bat вручную
)

echo [4/4] Готово.
echo   - Запускайте через ярлык "Connor RK800" или Connor.vbs
echo   - УДАЛИТЕ старый "Connor Assistant" с рабочего стола — это другая программа
echo   - Снимите Connor с таскбара, запустите, закрепите снова
echo   - Одна иконка RK800: desktop = exe = taskbar (source-rk800.raw.png)
pause
