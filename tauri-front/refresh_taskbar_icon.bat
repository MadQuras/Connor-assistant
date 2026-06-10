@echo off
chcp 65001 > nul
echo [1/3] Иконки из source-rk800.raw.png (один кадр, resize)...
cd /d "%~dp0\.."
py -3 scripts\gen_app_icons.py
if %ERRORLEVEL% neq 0 (
    echo ОШИБКА: gen_app_icons.py
    pause
    exit /b 1
)

echo [2/3] Останавливаем Connor и пересобираем exe (ярлык НЕ трогаем)...
taskkill /F /IM connor-tray-v2.exe /T 2>nul
taskkill /F /IM connor-tray.exe /T 2>nul
timeout /t 1 /nobreak > nul

cd /d "%~dp0"
call npm run tauri build
if %ERRORLEVEL% neq 0 (
    echo ОШИБКА: tauri build
    pause
    exit /b 1
)

echo [3/3] Сброс кэша иконок Windows...
ie4uinit.exe -ClearIconCache 2>nul
taskkill /F /IM explorer.exe 2>nul
timeout /t 2 /nobreak > nul
start explorer.exe

set "INST=%LOCALAPPDATA%\Programs\Connor RK800"
if exist "%INST%\tauri-front\src-tauri\target\release\" (
    copy /Y "%~dp0src-tauri\target\release\connor-tray-v2.exe" "%INST%\tauri-front\src-tauri\target\release\" >nul 2>&1
)

echo.
echo Готово. Desktop ярлык НЕ менялся.
echo ОБЯЗАТЕЛЬНО: сними Connor с таскбара -^> запусти Connor RK800 -^> закрепи снова.
echo Exe: %~dp0src-tauri\target\release\connor-tray-v2.exe
pause
