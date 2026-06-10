param(
    [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [switch]$SkipGen
)

$ErrorActionPreference = "Stop"

function Set-ShortcutAppUserModelId {
    param([string]$Path, [string]$AppId)
    if (-not (Test-Path -LiteralPath $Path)) { return }
    try {
        if (-not ("ConnorShortcutAppId" -as [type])) {
            Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class ConnorShortcutAppId {
  [DllImport("propsys.dll", CharSet = CharSet.Unicode)]
  public static extern int InitPropVariantFromString(string s, out PropVariant p);
  [StructLayout(LayoutKind.Sequential)]
  public struct PropVariant { public ushort vt; public ushort w1,w2,w3; public IntPtr p; public int i; }
  [DllImport("ole32.dll")]
  public static extern int PropVariantClear(ref PropVariant p);
  [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IPropertyStore {
    int GetCount(out uint c); int GetAt(uint i, out PropertyKey k); int GetValue(ref PropertyKey k, out PropVariant v);
    int SetValue(ref PropertyKey k, ref PropVariant v); int Commit();
  }
  [StructLayout(LayoutKind.Sequential)]
  public struct PropertyKey { public Guid fmtid; public uint pid; }
  public static void Set(string lnk, string appId) {
    var iid = typeof(IPropertyStore).GUID;
    object storeObj;
    if (SHGetPropertyStoreFromParsingName(lnk, IntPtr.Zero, 2, ref iid, out storeObj) != 0) return;
    var store = (IPropertyStore)storeObj;
    var key = new PropertyKey { fmtid = new Guid("9F4C2855-D9CD-47A4-9529-5B5E8B0310C7"), pid = 5 };
    PropVariant pv; InitPropVariantFromString(appId, out pv);
    store.SetValue(ref key, ref pv); store.Commit(); PropVariantClear(ref pv);
  }
  [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
  static extern int SHGetPropertyStoreFromParsingName(string psz, IntPtr bc, uint mode, ref Guid riid, out object ppv);
}
"@
        }
        [ConnorShortcutAppId]::Set($Path, $AppId)
    } catch {
        Write-Host "  [ ! ] AppUserModelID: $_" -ForegroundColor Yellow
    }
}

function New-ConnorShortcut {
    param(
        [string]$LnkPath,
        [string]$VbsPath,
        [string]$IconPath,
        [string]$WorkDir,
        [string]$AppId
    )
    $dir = Split-Path $LnkPath -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    if (Test-Path $LnkPath) { Remove-Item $LnkPath -Force }

    $sh = New-Object -ComObject WScript.Shell
    $lnk = $sh.CreateShortcut($LnkPath)
    $lnk.TargetPath = "$env:SystemRoot\System32\wscript.exe"
    $lnk.Arguments = "`"$VbsPath`""
    $lnk.WorkingDirectory = $WorkDir
    $lnk.IconLocation = "$IconPath,0"
    $lnk.Description = "Connor RK800"
    $lnk.Save()

    Set-ShortcutAppUserModelId -Path $LnkPath -AppId $AppId
    Write-Host "  shortcut: $LnkPath"
    Write-Host "  icon:     $IconPath"
}

$vbs = Join-Path $Root "Connor.vbs"
$ico = Join-Path $Root "tauri-front\src-tauri\icons\icon.ico"
$exe = Join-Path $Root "tauri-front\src-tauri\target\release\connor-tray-v2.exe"
$gen = Join-Path $Root "scripts\gen_app_icons.py"
$appId = "com.connor.assistant"

if (-not (Test-Path $vbs)) { throw "Missing: $vbs" }

if (-not $SkipGen) {
    Write-Host "Regenerating icons from source-rk800.raw.png..."
    & py -3 $gen
    if ($LASTEXITCODE -ne 0) { throw "gen_app_icons.py failed" }
}
if (-not (Test-Path $ico)) { throw "Missing icon: $ico" }

$staleLnks = @(
    (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Connor Assistant.lnk"),
    (Join-Path $env:ProgramData "Microsoft\Windows\Start Menu\Programs\Connor Assistant.lnk")
)
foreach ($stale in $staleLnks) {
    if (Test-Path $stale) {
        try {
            Remove-Item $stale -Force -ErrorAction Stop
            Write-Host "  removed stale: $stale" -ForegroundColor Yellow
        } catch {
            Write-Host "  [ ! ] skip (need admin): $stale" -ForegroundColor Yellow
        }
    }
}

$desktop = [Environment]::GetFolderPath("Desktop")
if (-not $desktop) { $desktop = Join-Path $env:USERPROFILE "Desktop" }

New-ConnorShortcut -LnkPath (Join-Path $desktop "Connor RK800.lnk") -VbsPath $vbs -IconPath $ico -WorkDir $Root -AppId $appId

$smDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Connor RK800"
New-ConnorShortcut -LnkPath (Join-Path $smDir "Connor RK800.lnk") -VbsPath $vbs -IconPath $ico -WorkDir $Root -AppId $appId

$installed = Join-Path $env:LOCALAPPDATA "Programs\Connor RK800"
if (Test-Path $installed) {
    $iconDir = Join-Path $installed "tauri-front\src-tauri\icons"
    $dstExeDir = Join-Path $installed "tauri-front\src-tauri\target\release"
    New-Item -ItemType Directory -Path $iconDir -Force | Out-Null
    Copy-Item $ico $iconDir -Force
    foreach ($name in @("app-icon.ico", "window-icon.png", "taskbar-icon.png", "icon.png")) {
        $src = Join-Path $Root "tauri-front\src-tauri\icons\$name"
        if (Test-Path $src) { Copy-Item $src (Join-Path $iconDir $name) -Force }
    }
    foreach ($stale in @("tray-icon.png", "desktop-icon.ico", "desktop-icon.png", "bundle-icon.ico")) {
        $p = Join-Path $iconDir $stale
        if (Test-Path $p) { Remove-Item $p -Force; Write-Host "  removed stale installed: $stale" -ForegroundColor Yellow }
    }
    Write-Host "  synced icons: $iconDir"
    if (Test-Path $exe) {
        New-Item -ItemType Directory -Path $dstExeDir -Force | Out-Null
        Copy-Item $exe (Join-Path $dstExeDir "connor-tray-v2.exe") -Force
        Write-Host "  synced: $(Join-Path $dstExeDir 'connor-tray-v2.exe')"
    }
    Copy-Item $vbs (Join-Path $installed "Connor.vbs") -Force
}

try { ie4uinit.exe -show 2>$null | Out-Null } catch {}
try { ie4uinit.exe -ClearIconCache 2>$null | Out-Null } catch {}

Write-Host ""
Write-Host "Icon source: $ico"
Write-Host "Flow: Connor RK800.lnk -> Connor.vbs -> connor-tray-v2.exe"
Write-Host "Unpin from taskbar, launch shortcut, pin again."

if (Test-Path $exe) {
    Write-Host "Exe: $exe ($((Get-Item $exe).LastWriteTime))"
} else {
    Write-Host "WARN: run: cd tauri-front; npm run tauri build"
}
