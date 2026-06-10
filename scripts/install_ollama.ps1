#Requires -Version 5.1
<#
.SYNOPSIS
    Установка Ollama и модели Gemma 4 для Connor RK800.
.DESCRIPTION
    1. Проверяет / ставит Ollama (OllamaSetup.exe с ollama.com)
    2. Ждёт запуск API на http://127.0.0.1:11434
    3. Скачивает модель gemma4:e4b (ollama pull)
.PARAMETER Model
    Имя модели Ollama (по умолчанию gemma4:e4b из config.json).
.PARAMETER SkipInstall
    Не скачивать Ollama — только pull модели, если CLI уже есть.
.PARAMETER ForcePull
    Перекачать модель, даже если уже установлена.
.EXAMPLE
    PowerShell -ExecutionPolicy Bypass -File scripts\install_ollama.ps1
#>

[CmdletBinding()]
param(
    [string]$Model = "",
    [switch]$SkipInstall,
    [switch]$ForcePull
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ROOT = Split-Path $PSScriptRoot -Parent
$OLLAMA_SETUP_URL = "https://ollama.com/download/OllamaSetup.exe"
$OLLAMA_API = "http://127.0.0.1:11434"
$DEFAULT_MODEL = "gemma4:e4b"

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

function Refresh-PathEnv {
    $machine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machine;$userPath"
}

function Get-ConfigModel {
    $cfgPath = Join-Path $ROOT "config.json"
    if (-not (Test-Path $cfgPath)) { return $DEFAULT_MODEL }
    try {
        $cfg = Get-Content $cfgPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $m = [string]$cfg.ollama_model
        if ($m.Trim()) { return $m.Trim() }
    } catch {}
    return $DEFAULT_MODEL
}

function Find-OllamaExe {
    Refresh-PathEnv
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"),
        (Join-Path ${env:ProgramFiles} "Ollama\ollama.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Ollama\ollama.exe")
    )
    foreach ($p in $candidates) {
        if ($p -and (Test-Path $p)) { return $p }
    }
    try {
        $found = & where.exe ollama 2>$null | Select-Object -First 1
        if ($found -and (Test-Path $found)) { return $found }
    } catch {}
    return $null
}

function Test-OllamaApi {
    param([int]$TimeoutSec = 3)
    try {
        $r = Invoke-WebRequest -Uri "$OLLAMA_API/api/tags" -UseBasicParsing -TimeoutSec $TimeoutSec
        return ($r.StatusCode -eq 200)
    } catch {
        return $false
    }
}

function Wait-OllamaApi {
    param([int]$MaxSec = 90)
    Write-Step "Ожидание Ollama API ($OLLAMA_API)…"
    for ($i = 0; $i -lt $MaxSec; $i += 2) {
        if (Test-OllamaApi) {
            Write-OK "Ollama API отвечает"
            return $true
        }
        Start-Sleep -Seconds 2
    }
    return $false
}

function Start-OllamaApp {
    $appExe = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama app.exe"
    if (Test-Path $appExe) {
        Write-Step "Запуск Ollama в фоне…"
        Start-Process -FilePath $appExe -WindowStyle Hidden
        return
    }
    $ollama = Find-OllamaExe
    if ($ollama) {
        Write-Step "Запуск ollama serve…"
        Start-Process -FilePath $ollama -ArgumentList "serve" -WindowStyle Hidden
    }
}

function Install-OllamaSetup {
    $tmp = Join-Path $env:TEMP "OllamaSetup.exe"
    Write-Step "Скачивание Ollama ($OLLAMA_SETUP_URL)…"
    Write-Warn "Установщик ~200 МБ; модель gemma4:e4b — ещё несколько ГБ."
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $OLLAMA_SETUP_URL -OutFile $tmp -UseBasicParsing

    Write-Step "Установка Ollama (может занять несколько минут)…"
    $proc = Start-Process -FilePath $tmp -ArgumentList "/SILENT", "/NORESTART" -Wait -PassThru
    if ($proc.ExitCode -ne 0) {
        Write-Warn "Код выхода установщика: $($proc.ExitCode) — проверяем наличие ollama.exe…"
    }
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    Refresh-PathEnv
}

function Test-ModelInstalled {
    param([string]$OllamaExe, [string]$ModelName)
    try {
        $list = & $OllamaExe list 2>&1 | Out-String
        $base = ($ModelName -split ':')[0]
        return ($list -match [regex]::Escape($ModelName) -or $list -match "$base\s")
    } catch {
        return $false
    }
}

function Pull-OllamaModel {
    param([string]$OllamaExe, [string]$ModelName)
    if (-not $ForcePull -and (Test-ModelInstalled -OllamaExe $OllamaExe -ModelName $ModelName)) {
        Write-OK "Модель уже установлена: $ModelName"
        return $true
    }
    Write-Step "Скачивание модели $ModelName (ollama pull)…"
    Write-Warn "Первый раз может занять 10–30+ минут в зависимости от интернета."
    & $OllamaExe pull $ModelName
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "ollama pull завершился с кодом $LASTEXITCODE"
        return $false
    }
    Write-OK "Модель $ModelName установлена"
    return $true
}

function Update-ConfigOllama {
    param([string]$ModelName)
    $cfgPath = Join-Path $ROOT "config.json"
    if (-not (Test-Path $cfgPath)) { return }
    try {
        $raw = Get-Content $cfgPath -Raw -Encoding UTF8
        $cfg = $raw | ConvertFrom-Json
        $changed = $false
        if ([string]$cfg.llm_backend -ne "ollama") {
            $cfg | Add-Member -NotePropertyName llm_backend -NotePropertyValue "ollama" -Force
            $changed = $true
        }
        if ([string]$cfg.ollama_model -ne $ModelName) {
            $cfg | Add-Member -NotePropertyName ollama_model -NotePropertyValue $ModelName -Force
            $changed = $true
        }
        if (-not $cfg.ollama_url) {
            $cfg | Add-Member -NotePropertyName ollama_url -NotePropertyValue "http://127.0.0.1:11434" -Force
            $changed = $true
        }
        if ($changed) {
            $cfg | ConvertTo-Json -Depth 10 | Set-Content $cfgPath -Encoding UTF8
            Write-OK "config.json: llm_backend=ollama, ollama_model=$ModelName"
        }
    } catch {
        Write-Warn "Не удалось обновить config.json: $_"
    }
}

function Find-PythonExe {
    if ($env:CONNOR_PYTHON -and (Test-Path $env:CONNOR_PYTHON)) {
        return $env:CONNOR_PYTHON
    }
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA "Programs\Python\Python311\python.exe"),
        "C:\Python311\python.exe",
        (Join-Path ${env:ProgramFiles} "Python311\python.exe")
    )
    foreach ($c in $candidates) {
        if ($c -and (Test-Path $c)) { return $c }
    }
    try {
        $pyLauncher = & where.exe py 2>$null | Select-Object -First 1
        if ($pyLauncher) {
            $ver = & $pyLauncher -3.11 -c "import sys; print(sys.executable)" 2>$null
            if ($ver -and (Test-Path $ver.Trim())) { return $ver.Trim() }
        }
    } catch {}
    try {
        $found = & where.exe python 2>$null | Select-Object -First 1
        if ($found -and (Test-Path $found)) { return $found }
    } catch {}
    return $null
}

function Test-ConnorGemma {
    param([string]$PythonExe)
    if (-not $PythonExe -or -not (Test-Path $PythonExe)) { return }
    $verify = Join-Path $ROOT "python-core\scripts\verify_gemma.py"
    if (-not (Test-Path $verify)) { return }
    Write-Step "Proverka Gemma cherez Connor..."
    $prevEnc = $env:PYTHONIOENCODING
    $env:PYTHONIOENCODING = "utf-8"
    try {
        & $PythonExe $verify 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        if ($LASTEXITCODE -eq 0) {
            Write-OK "Gemma 4 podklyuchena k Connoru"
        } else {
            Write-Warn "verify_gemma.py: kod $LASTEXITCODE (II mozhet byt nedostupen do perezapuska Ollama)"
        }
    } catch {
        Write-Warn "Proverka Gemma propushchena: $_"
    } finally {
        if ($null -eq $prevEnc) { Remove-Item Env:PYTHONIOENCODING -ErrorAction SilentlyContinue }
        else { $env:PYTHONIOENCODING = $prevEnc }
    }
}

# ── Main ──────────────────────────────────────────────────────────────────────

if (-not $Model) { $Model = Get-ConfigModel }

Write-Host ""
Write-Host "  ── OLLAMA + GEMMA 4 ─────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "  Модель: $Model" -ForegroundColor White
Write-Host ""

$ollama = Find-OllamaExe
if (-not $ollama -and -not $SkipInstall) {
    Install-OllamaSetup
    $ollama = Find-OllamaExe
}

if (-not $ollama) {
    Write-Fail "ollama.exe не найден."
    Write-Host "  Установите вручную: https://ollama.com/download" -ForegroundColor Yellow
    exit 1
}
Write-OK "Ollama CLI: $ollama"

if (-not (Test-OllamaApi)) {
    Start-OllamaApp
    if (-not (Wait-OllamaApi)) {
        Write-Fail "Ollama API не отвечает на $OLLAMA_API"
        Write-Host "  Запустите «Ollama» из меню Пуск и повторите:" -ForegroundColor Yellow
        Write-Host "  PowerShell -File scripts\install_ollama.ps1" -ForegroundColor Gray
        exit 1
    }
} else {
    Write-OK "Ollama API уже работает"
}

if (-not (Pull-OllamaModel -OllamaExe $ollama -ModelName $Model)) {
    exit 1
}

Update-ConfigOllama -ModelName $Model

Test-ConnorGemma -PythonExe (Find-PythonExe)

Write-Host ""
Write-OK "Ollama + $Model готовы для Connor RK800"
exit 0
