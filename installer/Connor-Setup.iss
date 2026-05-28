; Connor RK800 — Inno Setup Script
; Компилировать: ISCC.exe Connor-Setup.iss
; Результат: Output\Connor-Setup.exe

#define AppName      "Connor RK800"
#define AppVersion   "1.0.0"
#define AppPublisher "MadQuras"
#define AppURL       "https://github.com/MadQuras/Connor-assistant"
#define AppExeName   "Connor.vbs"
#define SrcRoot      ".."

[Setup]
AppId={{7A3F1B2C-9D4E-4F56-A7B8-C9D0E1F23456}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}/releases
DefaultDirName={autopf}\Connor RK800
DefaultGroupName={#AppName}
AllowNoIcons=yes
; Compression
Compression=lzma2/ultra64
SolidCompression=yes
LZMAUseSeparateProcess=yes
; Output
OutputDir=Output
OutputBaseFilename=Connor-Setup
; Visual
WizardStyle=modern
WizardSizePercent=120
; Icon
SetupIconFile={#SrcRoot}\tauri-front\src-tauri\icons\icon.ico
UninstallDisplayIcon={app}\tauri-front\src-tauri\icons\icon.ico
; Privileges
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
; Min OS
MinVersion=10.0.17763

[Languages]
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Messages]
russian.BeveledLabel=Connor RK800 · CyberLife Systems

[Tasks]
Name: "desktopicon";    Description: "Создать ярлык на рабочем столе";    GroupDescription: "Дополнительно:"
Name: "startmenuicon";  Description: "Добавить в меню Пуск";              GroupDescription: "Дополнительно:"

[Files]
; ── Tauri UI (pre-built) ────────────────────────────────────────────────────
Source: "{#SrcRoot}\tauri-front\src-tauri\target\release\connor-tray-v2.exe"; \
  DestDir: "{app}\tauri-front\src-tauri\target\release"; \
  Flags: ignoreversion

; ── Icons ───────────────────────────────────────────────────────────────────
Source: "{#SrcRoot}\tauri-front\src-tauri\icons\*"; \
  DestDir: "{app}\tauri-front\src-tauri\icons"; \
  Flags: ignoreversion recursesubdirs

; ── Launchers ───────────────────────────────────────────────────────────────
Source: "{#SrcRoot}\Connor.vbs";    DestDir: "{app}"; Flags: ignoreversion
Source: "{#SrcRoot}\start.bat";     DestDir: "{app}"; Flags: ignoreversion
Source: "{#SrcRoot}\start_core.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SrcRoot}\start_tray.bat"; DestDir: "{app}"; Flags: ignoreversion

; ── Config template ─────────────────────────────────────────────────────────
Source: "{#SrcRoot}\config.example.json"; DestDir: "{app}"; Flags: ignoreversion

; ── Docs ────────────────────────────────────────────────────────────────────
Source: "{#SrcRoot}\README.md";      DestDir: "{app}"; Flags: ignoreversion
Source: "{#SrcRoot}\TUTORIAL_VAD";   DestDir: "{app}"; Flags: ignoreversion
Source: "{#SrcRoot}\TUTORIAL_VAD.md"; DestDir: "{app}"; Flags: ignoreversion

; ── Python core: источники ──────────────────────────────────────────────────
Source: "{#SrcRoot}\python-core\main.py";         DestDir: "{app}\python-core"; Flags: ignoreversion
Source: "{#SrcRoot}\python-core\requirements.txt"; DestDir: "{app}\python-core"; Flags: ignoreversion

; ── Python core: core/ ──────────────────────────────────────────────────────
Source: "{#SrcRoot}\python-core\core\*"; \
  DestDir: "{app}\python-core\core"; \
  Flags: ignoreversion recursesubdirs

; ── Python core: openjarvis/ ────────────────────────────────────────────────
Source: "{#SrcRoot}\python-core\openjarvis\*"; \
  DestDir: "{app}\python-core\openjarvis"; \
  Flags: ignoreversion recursesubdirs

; ── Audio files ─────────────────────────────────────────────────────────────
Source: "{#SrcRoot}\python-core\models\audio\*"; \
  DestDir: "{app}\python-core\models\audio"; \
  Flags: ignoreversion recursesubdirs

; ── Playlist ────────────────────────────────────────────────────────────────
Source: "{#SrcRoot}\python-core\models\playlist.json"; \
  DestDir: "{app}\python-core\models"; \
  Flags: ignoreversion

; ── UI references ───────────────────────────────────────────────────────────
Source: "{#SrcRoot}\python-core\models\UI-references\*"; \
  DestDir: "{app}\python-core\models\UI-references"; \
  Flags: ignoreversion recursesubdirs

[Dirs]
Name: "{app}\python-core\models\audio\commands"
Name: "{app}\python-core\models\audio\errors"
Name: "{app}\python-core\models\audio\music"
Name: "{app}\python-core\models\audio\plans"
Name: "{app}\python-core\models\audio\search"
Name: "{app}\python-core\models\audio\shutdown"
Name: "{app}\python-core\models\audio\startup"
Name: "{app}\python-core\models\audio\system"
Name: "{app}\python-core\models\audio\weather"

[Icons]
; Desktop shortcut
Name: "{autodesktop}\Connor RK800"; \
  Filename: "{sys}\wscript.exe"; \
  Parameters: """{app}\Connor.vbs"""; \
  WorkingDir: "{app}"; \
  IconFilename: "{app}\tauri-front\src-tauri\icons\icon.ico"; \
  Tasks: desktopicon

; Start Menu shortcut
Name: "{group}\Connor RK800"; \
  Filename: "{sys}\wscript.exe"; \
  Parameters: """{app}\Connor.vbs"""; \
  WorkingDir: "{app}"; \
  IconFilename: "{app}\tauri-front\src-tauri\icons\icon.ico"; \
  Tasks: startmenuicon

; Start Menu — Uninstall
Name: "{group}\Удалить Connor RK800"; \
  Filename: "{uninstallexe}"

[Run]
; Step 1 — Check Python 3.11 (show message if missing)
Filename: "{app}\installer_scripts\check_python.bat"; \
  Description: "Проверка Python 3.11"; \
  Flags: runhidden waituntilterminated; \
  StatusMsg: "Проверяю Python 3.11..."

; Step 2 — Install pip packages
Filename: "{app}\installer_scripts\install_pip.bat"; \
  Description: "Установка Python пакетов"; \
  Flags: runhidden waituntilterminated; \
  StatusMsg: "Устанавливаю зависимости (может занять 5–15 мин)..."

; Step 3 — Create config.json from template
Filename: "{app}\installer_scripts\setup_config.bat"; \
  Description: "Настройка конфигурации"; \
  Flags: runhidden waituntilterminated; \
  StatusMsg: "Настраиваю конфигурацию..."

; Step 4 — Create python_ready.flag
Filename: "{app}\installer_scripts\create_flag.bat"; \
  Flags: runhidden waituntilterminated; \
  StatusMsg: "Финализация..."

; After install — offer to open config
Filename: "notepad.exe"; \
  Parameters: """{app}\config.json"""; \
  Description: "Открыть config.json (вставьте Gemini API ключ)"; \
  Flags: postinstall nowait skipifsilent unchecked

[UninstallRun]
; Kill processes before uninstall
Filename: "{sys}\taskkill.exe"; Parameters: "/F /IM connor-tray-v2.exe /T"; Flags: runhidden; RunOnceId: "KillTray"
Filename: "{sys}\taskkill.exe"; Parameters: "/F /IM pythonw.exe /T";        Flags: runhidden; RunOnceId: "KillPython"

[Code]
var
  PythonPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  PythonPage := CreateInputQueryPage(wpWelcome,
    'Python 3.11 требуется',
    'Connor использует Python 3.11 для голосового ядра.',
    '');
  PythonPage.Add(
    'Путь к python.exe (оставьте пустым для автопоиска):',
    False
  );
end;

function FindPython: String;
var
  Candidates: TArrayOfString;
  I: Integer;
begin
  SetArrayLength(Candidates, 5);
  Candidates[0] := ExpandConstant('{localappdata}') + '\Programs\Python\Python311\python.exe';
  Candidates[1] := 'C:\Python311\python.exe';
  Candidates[2] := 'C:\Program Files\Python311\python.exe';
  Candidates[3] := 'C:\Program Files (x86)\Python311\python.exe';
  Candidates[4] := ExpandConstant('{pf}') + '\Python311\python.exe';
  for I := 0 to GetArrayLength(Candidates) - 1 do
  begin
    if FileExists(Candidates[I]) then
    begin
      Result := Candidates[I];
      Exit;
    end;
  end;
  Result := '';
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  PythonExe, AppDir, ScriptsDir: String;
  Lines: TArrayOfString;
begin
  if CurStep = ssPostInstall then
  begin
    AppDir := ExpandConstant('{app}');
    ScriptsDir := AppDir + '\installer_scripts';

    // Determine python path
    PythonExe := PythonPage.Values[0];
    if (PythonExe = '') or (not FileExists(PythonExe)) then
      PythonExe := FindPython;
    if PythonExe = '' then
      PythonExe := 'python';

    // Write install_pip.bat with resolved python path
    SetArrayLength(Lines, 4);
    Lines[0] := '@echo off';
    Lines[1] := 'cd /d "' + AppDir + '"';
    Lines[2] := '"' + PythonExe + '" -m pip install --upgrade pip -q';
    Lines[3] := '"' + PythonExe + '" -m pip install -r "' + AppDir + '\python-core\requirements.txt"';
    SaveStringsToFile(ScriptsDir + '\install_pip.bat', Lines, False);

    // Write check_python.bat
    SetArrayLength(Lines, 6);
    Lines[0] := '@echo off';
    Lines[1] := '"' + PythonExe + '" --version > nul 2>&1';
    Lines[2] := 'if errorlevel 1 (';
    Lines[3] := '  start "" "https://www.python.org/downloads/release/python-3119/"';
    Lines[4] := ')';
    Lines[5] := 'exit 0';
    SaveStringsToFile(ScriptsDir + '\check_python.bat', Lines, False);

    // Write setup_config.bat
    SetArrayLength(Lines, 5);
    Lines[0] := '@echo off';
    Lines[1] := 'if not exist "' + AppDir + '\config.json" (';
    Lines[2] := '  copy "' + AppDir + '\config.example.json" "' + AppDir + '\config.json"';
    Lines[3] := ')';
    Lines[4] := 'exit 0';
    SaveStringsToFile(ScriptsDir + '\setup_config.bat', Lines, False);

    // Write create_flag.bat
    SetArrayLength(Lines, 4);
    Lines[0] := '@echo off';
    Lines[1] := 'if not exist "' + AppDir + '\python-core\models" mkdir "' + AppDir + '\python-core\models"';
    Lines[2] := 'echo 0> "' + AppDir + '\python-core\models\python_ready.flag"';
    Lines[3] := 'exit 0';
    SaveStringsToFile(ScriptsDir + '\create_flag.bat', Lines, False);
  end;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
end;
