#Requires -Version 5.1
<#
.SYNOPSIS
    Connor RK800 — Installer
.DESCRIPTION
    Устанавливает все зависимости и настраивает систему Connor RK800.
    Требует подключения к интернету.
.NOTES
    Запускать из папки проекта:
        PowerShell -ExecutionPolicy Bypass -File Install-Connor.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── Colours & helpers ─────────────────────────────────────────────────────────

function Write-Header {
    Clear-Host
    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║        CONNOR RK800  —  CYBERLIFE INSTALLER          ║" -ForegroundColor Cyan
    Write-Host "  ║              Android RK800  v1.0.0                   ║" -ForegroundColor Cyan
    Write-Host "  ╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step([string]$text) {
    Write-Host "  [ · ] $text" -ForegroundColor DarkCyan
}

function Write-OK([string]$text) {
    Write-Host "  [ ✓ ] $text" -ForegroundColor Green
}

function Write-Warn([string]$text) {
    Write-Host "  [ ! ] $text" -ForegroundColor Yellow
}

function Write-Fail([string]$text) {
    Write-Host "  [ ✗ ] $text" -ForegroundColor Red
}

function Write-Section([string]$text) {
    Write-Host ""
    Write-Host "  ── $text ──────────────────────────────────────────────" -ForegroundColor DarkGray
}

# ── Root ──────────────────────────────────────────────────────────────────────

$ROOT = $PSScriptRoot
if (-not $ROOT) { $ROOT = Split-Path $MyInvocation.MyCommand.Path }

Write-Header

# ── Step 0: Check OS ──────────────────────────────────────────────────────────

Write-Section "СИСТЕМНЫЕ ТРЕБОВАНИЯ"

if ([System.Environment]::OSVersion.Platform -ne 'Win32NT') {
    Write-Fail "Connor поддерживает только Windows 10/11."
    exit 1
}
$build = [System.Environment]::OSVersion.Version.Build
if ($build -lt 19041) {
    Write-Warn "Windows build $build — рекомендуется 19041+ (Windows 10 2004)."
} else {
    Write-OK "Windows build $build"
}

# ── Step 1: Python 3.11 ───────────────────────────────────────────────────────

Write-Section "PYTHON 3.11"

$PYTHON = $null
$candidates = @(
    "C:\Users\$env:USERNAME\AppData\Local\Programs\Python\Python311\python.exe",
    "C:\Python311\python.exe",
    "C:\Program Files\Python311\python.exe"
)
foreach ($c in $candidates) {
    if (Test-Path $c) { $PYTHON = $c; break }
}
if (-not $PYTHON) {
    try {
        $found = & where.exe python 2>$null | Select-Object -First 1
        if ($found) {
            $ver = & $found --version 2>&1
            if ($ver -match "3\.11") { $PYTHON = $found }
        }
    } catch {}
}

if ($PYTHON) {
    $ver = & $PYTHON --version 2>&1
    Write-OK "Python найден: $ver  ($PYTHON)"
} else {
    Write-Warn "Python 3.11 не найден."
    Write-Host ""
    Write-Host "  Открываю страницу загрузки Python 3.11..." -ForegroundColor Yellow
    Start-Process "https://www.python.org/downloads/release/python-3119/"
    Write-Host ""
    Write-Host "  Установите Python 3.11, поставьте галочку 'Add to PATH'," -ForegroundColor White
    Write-Host "  затем запустите этот скрипт снова." -ForegroundColor White
    Write-Host ""
    Read-Host "  Нажмите Enter для выхода"
    exit 1
}

# ── Step 2: pip upgrade ───────────────────────────────────────────────────────

Write-Section "PIP"
Write-Step "Обновление pip..."
try {
    & $PYTHON -m pip install --upgrade pip --quiet
    Write-OK "pip обновлён"
} catch {
    Write-Warn "Не удалось обновить pip, продолжаем..."
}

# ── Step 3: Python packages ───────────────────────────────────────────────────

Write-Section "PYTHON ЗАВИСИМОСТИ"

$REQ = Join-Path $ROOT "python-core\requirements.txt"
if (-not (Test-Path $REQ)) {
    Write-Fail "Файл requirements.txt не найден: $REQ"
    exit 1
}

Write-Step "Установка пакетов из requirements.txt..."
Write-Warn "Это может занять 5–15 минут (torch ~2 ГБ)."
Write-Host ""

try {
    & $PYTHON -m pip install -r $REQ
    Write-OK "Все Python-пакеты установлены"
} catch {
    Write-Fail "Ошибка установки пакетов: $_"
    Write-Host "  Попробуйте запустить вручную:" -ForegroundColor Yellow
    Write-Host "  $PYTHON -m pip install -r python-core\requirements.txt" -ForegroundColor Gray
    exit 1
}

# ── Step 4: Tesseract OCR ─────────────────────────────────────────────────────

Write-Section "TESSERACT OCR"

$tessPath = @(
    "C:\Program Files\Tesseract-OCR\tesseract.exe",
    "C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    "C:\tools\Tesseract-OCR\tesseract.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($tessPath) {
    $tessVer = & $tessPath --version 2>&1 | Select-Object -First 1
    Write-OK "Tesseract найден: $tessVer"
} else {
    Write-Warn "Tesseract OCR не найден (нужен для OCR-команд)."
    Write-Host ""
    Write-Host "  Скачать Tesseract 5.x для Windows:" -ForegroundColor White
    Write-Host "  https://github.com/UB-Mannheim/tesseract/wiki" -ForegroundColor Cyan
    Write-Host ""
    $ans = Read-Host "  Открыть страницу загрузки Tesseract? (y/n)"
    if ($ans -eq 'y') {
        Start-Process "https://github.com/UB-Mannheim/tesseract/wiki"
    }
    Write-Warn "OCR-функции будут недоступны без Tesseract. Продолжаем..."
}

# ── Step 5: Node.js (для пересборки Tauri, опционально) ──────────────────────

Write-Section "NODE.JS (ОПЦИОНАЛЬНО)"

$nodePath = & where.exe node 2>$null | Select-Object -First 1
if ($nodePath) {
    $nodeVer = & node --version 2>&1
    Write-OK "Node.js: $nodeVer"
} else {
    Write-Warn "Node.js не найден — нужен только если вы собираете Tauri из исходников."
    Write-Host "  Скачать: https://nodejs.org" -ForegroundColor Gray
}

# ── Step 6: config.json ───────────────────────────────────────────────────────

Write-Section "КОНФИГУРАЦИЯ"

$CFG     = Join-Path $ROOT "config.json"
$CFG_EX  = Join-Path $ROOT "config.example.json"

if (Test-Path $CFG) {
    Write-OK "config.json уже существует — не перезаписываю."
} elseif (Test-Path $CFG_EX) {
    Copy-Item $CFG_EX $CFG
    Write-OK "config.json создан из шаблона."
    Write-Warn "Откройте config.json и вставьте ваш Gemini API ключ в поле 'gemini_api_key'."
    Write-Host "  Получить ключ: https://aistudio.google.com/app/apikey" -ForegroundColor Cyan
} else {
    Write-Warn "config.example.json не найден. Создайте config.json вручную по образцу из README."
}

# ── Step 7: models папки ─────────────────────────────────────────────────────

Write-Section "ПАПКИ ДАННЫХ"

$modelsDir = Join-Path $ROOT "python-core\models"
$audioDir  = Join-Path $modelsDir "audio"
@($modelsDir, $audioDir) | ForEach-Object {
    if (-not (Test-Path $_)) {
        New-Item -ItemType Directory -Path $_ -Force | Out-Null
        Write-OK "Создана папка: $_"
    } else {
        Write-OK "Существует: $_"
    }
}

$flagFile = Join-Path $modelsDir "python_ready.flag"
if (-not (Test-Path $flagFile)) {
    Set-Content $flagFile "0"
    Write-OK "Создан python_ready.flag"
}

# ── Step 8: Desktop shortcut ──────────────────────────────────────────────────

Write-Section "ЯРЛЫК НА РАБОЧЕМ СТОЛЕ"

$vbsPath = Join-Path $ROOT "Connor.vbs"
if (Test-Path $vbsPath) {
    $desktop  = [System.Environment]::GetFolderPath('Desktop')
    $lnkPath  = Join-Path $desktop "Connor.lnk"
    try {
        $wsh = New-Object -ComObject WScript.Shell
        $lnk = $wsh.CreateShortcut($lnkPath)
        $lnk.TargetPath       = $vbsPath
        $lnk.WorkingDirectory = $ROOT
        $lnk.Description      = "Connor RK800 — Voice Assistant"
        # Use Tauri icon if available
        $icoSearch = Join-Path $ROOT "tauri-front\src-tauri\icons\icon.ico"
        if (Test-Path $icoSearch) { $lnk.IconLocation = $icoSearch }
        $lnk.Save()
        Write-OK "Ярлык создан: $lnkPath"
    } catch {
        Write-Warn "Не удалось создать ярлык: $_"
    }
} else {
    Write-Warn "Connor.vbs не найден — ярлык не создан."
}

# ── Step 9: Pre-built EXE check ───────────────────────────────────────────────

Write-Section "TAURI UI"

$tauriExe = Join-Path $ROOT "tauri-front\src-tauri\target\release\connor-tray-v2.exe"
if (Test-Path $tauriExe) {
    $exeDate = (Get-Item $tauriExe).LastWriteTime.ToString("dd.MM.yyyy HH:mm")
    Write-OK "connor-tray-v2.exe найден (сборка $exeDate)"
} else {
    Write-Warn "Готовый EXE не найден. Необходима сборка Tauri:"
    Write-Host "  cd tauri-front" -ForegroundColor Gray
    Write-Host "  npm install" -ForegroundColor Gray
    Write-Host "  npm run tauri build" -ForegroundColor Gray
}

# ── Finish ────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║             УСТАНОВКА ЗАВЕРШЕНА                      ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  Следующие шаги:" -ForegroundColor White
Write-Host "  1. Откройте config.json — вставьте Gemini API ключ" -ForegroundColor Gray
Write-Host "  2. Убедитесь что в models/audio/ есть WAV файлы Коннора" -ForegroundColor Gray
Write-Host "  3. Запустите Connor.vbs двойным кликом" -ForegroundColor Gray
Write-Host ""
Write-Host "  Документация: TUTORIAL_VAD  |  README.md" -ForegroundColor DarkGray
Write-Host ""

Read-Host "  Нажмите Enter для завершения"
