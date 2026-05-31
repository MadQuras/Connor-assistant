; ╔══════════════════════════════════════════════════════════════╗
; ║   Connor RK800 — Full Installer with auto-download           ║
; ║   Compile:  ISCC.exe Connor-Setup.iss                        ║
; ║   Output:   Output\Connor-Setup.exe                          ║
; ╚══════════════════════════════════════════════════════════════╝

#define AppName      "Connor RK800"
#define AppVersion   "1.1.0"
#define AppPublisher "MadQuras"
#define AppURL       "https://github.com/MadQuras/Connor-assistant"
#define SrcRoot      ".."

; ── Download URLs ────────────────────────────────────────────────────────────
#define URL_Python    "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe"
#define URL_VCREDIST  "https://aka.ms/vs/17/release/vc_redist.x64.exe"
#define URL_TESSERACT "https://github.com/UB-Mannheim/tesseract/releases/download/v5.4.0.20240606/tesseract-ocr-w64-setup-5.4.0.20240606.exe"
#define URL_RUST      "https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe"

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
Compression=lzma2/ultra64
SolidCompression=yes
LZMAUseSeparateProcess=yes
OutputDir=Output
OutputBaseFilename=Connor-Setup
WizardStyle=modern
WizardSizePercent=120
SetupIconFile={#SrcRoot}\tauri-front\src-tauri\icons\icon.ico
UninstallDisplayIcon={app}\tauri-front\src-tauri\icons\icon.ico
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
MinVersion=10.0.17763

[Languages]
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Messages]
russian.BeveledLabel=Connor RK800 · CyberLife Systems · v1.0.0

[CustomMessages]
russian.CompTitle=Компоненты для установки
russian.CompSub=Выберите компоненты. Уже установленные помечены автоматически.
russian.PythonDesc=Python 3.11.9 — язык ядра Connor (обязателен)
russian.VCDesc=Visual C++ Redistributable 2022 — нужен для torch / CTranSate2
russian.TessDesc=Tesseract OCR 5.4 — распознавание текста на экране
russian.RustDesc=Rust (rustup) — нужен для пересборки Tauri UI из исходников
russian.DlTitle=Загрузка компонентов
russian.DlSub=Пожалуйста подождите, идёт загрузка выбранных компонентов...
russian.PipTitle=Установка Python-пакетов
russian.PipSub=Устанавливаются зависимости Connor. Это может занять 5–15 минут...
russian.ApiNote=После завершения откройте config.json и вставьте ваш Gemini API ключ.

english.CompTitle=Components to install
english.CompSub=Select components. Already-installed items are detected automatically.
english.PythonDesc=Python 3.11.9 — Connor core language (required)
english.VCDesc=Visual C++ Redistributable 2022 — required for torch / CTranSate2
english.TessDesc=Tesseract OCR 5.4 — on-screen text recognition
english.RustDesc=Rust (rustup) — only needed to rebuild Tauri UI from source
english.DlTitle=Downloading components
english.DlSub=Please wait while selected components are being downloaded...
english.PipTitle=Installing Python packages
english.PipSub=Installing Connor dependencies. This may take 5–15 minutes...
english.ApiNote=After setup completes, open config.json and insert your Gemini API key.

[Tasks]
Name: "desktopicon";   Description: "Создать ярлык на рабочем столе"; GroupDescription: "Дополнительно:"
Name: "startmenuicon"; Description: "Добавить в меню Пуск";            GroupDescription: "Дополнительно:"

[Files]
; Tauri UI (pre-built — Rust not required to run)
Source: "{#SrcRoot}\tauri-front\src-tauri\target\release\connor-tray-v2.exe"; \
  DestDir: "{app}\tauri-front\src-tauri\target\release"; Flags: ignoreversion
Source: "{#SrcRoot}\tauri-front\src-tauri\icons\*"; \
  DestDir: "{app}\tauri-front\src-tauri\icons"; Flags: ignoreversion recursesubdirs

; Launchers
Source: "{#SrcRoot}\Connor.vbs";      DestDir: "{app}"; Flags: ignoreversion
Source: "{#SrcRoot}\start.bat";       DestDir: "{app}"; Flags: ignoreversion
Source: "{#SrcRoot}\start_core.bat";  DestDir: "{app}"; Flags: ignoreversion
Source: "{#SrcRoot}\start_tray.bat";  DestDir: "{app}"; Flags: ignoreversion

; Config
Source: "{#SrcRoot}\config.example.json"; DestDir: "{app}"; Flags: ignoreversion

; Docs
Source: "{#SrcRoot}\README.md";       DestDir: "{app}"; Flags: ignoreversion
Source: "{#SrcRoot}\TUTORIAL_VAD";    DestDir: "{app}"; Flags: ignoreversion
Source: "{#SrcRoot}\TUTORIAL_VAD.md"; DestDir: "{app}"; Flags: ignoreversion

; Python core
Source: "{#SrcRoot}\python-core\main.py";          DestDir: "{app}\python-core"; Flags: ignoreversion
Source: "{#SrcRoot}\python-core\requirements.txt"; DestDir: "{app}\python-core"; Flags: ignoreversion
Source: "{#SrcRoot}\python-core\core\*";       DestDir: "{app}\python-core\core";      Flags: ignoreversion recursesubdirs
Source: "{#SrcRoot}\python-core\openjarvis\*"; DestDir: "{app}\python-core\openjarvis"; Flags: ignoreversion recursesubdirs

; Audio + data
Source: "{#SrcRoot}\python-core\models\audio\*";          DestDir: "{app}\python-core\models\audio";          Flags: ignoreversion recursesubdirs
Source: "{#SrcRoot}\python-core\models\playlist.json";    DestDir: "{app}\python-core\models";                 Flags: ignoreversion
Source: "{#SrcRoot}\python-core\models\UI-references\*";  DestDir: "{app}\python-core\models\UI-references";  Flags: ignoreversion recursesubdirs

[Dirs]
Name: "{app}\python-core\models"
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
Name: "{autodesktop}\Connor RK800"; \
  Filename: "{sys}\wscript.exe"; Parameters: """{app}\Connor.vbs"""; \
  WorkingDir: "{app}"; IconFilename: "{app}\tauri-front\src-tauri\icons\icon.ico"; \
  Tasks: desktopicon
Name: "{group}\Connor RK800"; \
  Filename: "{sys}\wscript.exe"; Parameters: """{app}\Connor.vbs"""; \
  WorkingDir: "{app}"; IconFilename: "{app}\tauri-front\src-tauri\icons\icon.ico"; \
  Tasks: startmenuicon
Name: "{group}\Удалить Connor RK800"; Filename: "{uninstallexe}"

[Run]
; Open config after install
Filename: "notepad.exe"; Parameters: """{app}\config.json"""; \
  Description: "Открыть config.json (вставьте Gemini API ключ)"; \
  Flags: postinstall nowait skipifsilent unchecked

[UninstallRun]
Filename: "{sys}\taskkill.exe"; Parameters: "/F /IM connor-tray-v2.exe /T"; Flags: runhidden; RunOnceId: "KillTray"
Filename: "{sys}\taskkill.exe"; Parameters: "/F /IM pythonw.exe /T";        Flags: runhidden; RunOnceId: "KillPython"

; ═════════════════════════════════════════════════════════════════
; PASCAL SCRIPT
; ═════════════════════════════════════════════════════════════════
[Code]

// ── State ─────────────────────────────────────────────────────────────────────
var
  CompPage: TWizardPage;
  CbPython, CbVC, CbTess, CbRust: TCheckBox;
  LbPython, LbVC, LbTess, LbRust: TLabel;
  PythonExe: String;

// ── Detection helpers ─────────────────────────────────────────────────────────

function RegKeyExists(RootKey: Integer; const SubKey: String): Boolean;
var
  S: String;
begin
  Result := RegQueryStringValue(RootKey, SubKey, '', S);
end;

function PythonInstalled: Boolean;
var
  Candidates: TArrayOfString;
  I: Integer;
begin
  SetArrayLength(Candidates, 6);
  Candidates[0] := ExpandConstant('{localappdata}') + '\Programs\Python\Python311\python.exe';
  Candidates[1] := 'C:\Python311\python.exe';
  Candidates[2] := 'C:\Program Files\Python311\python.exe';
  Candidates[3] := 'C:\Program Files (x86)\Python311\python.exe';
  Candidates[4] := ExpandConstant('{pf}') + '\Python311\python.exe';
  Candidates[5] := ExpandConstant('{pf32}') + '\Python311\python.exe';
  for I := 0 to GetArrayLength(Candidates) - 1 do
    if FileExists(Candidates[I]) then begin
      PythonExe := Candidates[I];
      Result := True;
      Exit;
    end;
  Result := False;
end;

function FindPython: String;
begin
  if PythonInstalled then
    Result := PythonExe
  else
    Result := '';
end;

function VCInstalled: Boolean;
begin
  // Check for VC++ 2015-2022 x64 redist key
  Result :=
    RegKeyExists(HKLM, 'SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64') or
    RegKeyExists(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64') or
    RegKeyExists(HKLM, 'SOFTWARE\Microsoft\DevDiv\VC\Servicing\14.0\RuntimeMinimum');
end;

function TesseractInstalled: Boolean;
begin
  Result := FileExists('C:\Program Files\Tesseract-OCR\tesseract.exe') or
            FileExists('C:\Program Files (x86)\Tesseract-OCR\tesseract.exe') or
            FileExists('C:\tools\Tesseract-OCR\tesseract.exe');
end;

function RustInstalled: Boolean;
begin
  Result := FileExists(ExpandConstant('{userappdata}') + '\.cargo\bin\cargo.exe') or
            FileExists(ExpandConstant('{localappdata}') + '\.cargo\bin\cargo.exe');
end;

// ── Component page ────────────────────────────────────────────────────────────

function CreateCheckRow(Page: TWizardPage; Top: Integer;
                        const LabelText, StatusText: String;
                        Checked, Enabled: Boolean;
                        out Cb: TCheckBox; out Lbl: TLabel): Integer;
var
  StatusLbl: TLabel;
begin
  Cb := TCheckBox.Create(Page);
  Cb.Parent  := Page.Surface;
  Cb.Left    := 0;
  Cb.Top     := Top;
  Cb.Width   := Page.SurfaceWidth - 100;
  Cb.Caption := LabelText;
  Cb.Checked := Checked;
  Cb.Enabled := Enabled;

  StatusLbl := TLabel.Create(Page);
  StatusLbl.Parent  := Page.Surface;
  StatusLbl.Left    := Page.SurfaceWidth - 95;
  StatusLbl.Top     := Top + 2;
  StatusLbl.Width   := 90;
  StatusLbl.Caption := StatusText;
  if StatusText = '✓ установлен' then
    StatusLbl.Font.Color := clGreen
  else if StatusText = '✓ installed' then
    StatusLbl.Font.Color := clGreen
  else
    StatusLbl.Font.Color := clRed;

  Lbl := StatusLbl;
  Result := Top + 28;
end;

procedure InitializeWizard;
var
  Top: Integer;
  LabelA: TLabel;
begin
  // Create component selection page
  CompPage := CreateCustomPage(wpSelectDir,
    ExpandConstant('{cm:CompTitle}'),
    ExpandConstant('{cm:CompSub}'));

  LabelA := TLabel.Create(CompPage);
  LabelA.Parent  := CompPage.Surface;
  LabelA.Left    := 0;
  LabelA.Top     := 0;
  LabelA.Width   := CompPage.SurfaceWidth;
  LabelA.Caption := 'Требуемые компоненты будут загружены автоматически с официальных сайтов.';
  LabelA.Font.Style := [fsBold];

  Top := 26;
  if PythonInstalled then
    Top := CreateCheckRow(CompPage, Top, ExpandConstant('{cm:PythonDesc}'),
      '✓ установлен', False, False, CbPython, LbPython)
  else
    Top := CreateCheckRow(CompPage, Top, ExpandConstant('{cm:PythonDesc}'),
      '✗ не найден', True, False, CbPython, LbPython);
  // Python checkbox is forced — always install if missing, can't deselect
  CbPython.Enabled := False;

  if VCInstalled then
    Top := CreateCheckRow(CompPage, Top, ExpandConstant('{cm:VCDesc}'),
      '✓ установлен', False, True, CbVC, LbVC)
  else
    Top := CreateCheckRow(CompPage, Top, ExpandConstant('{cm:VCDesc}'),
      '✗ не найден', True, True, CbVC, LbVC);

  if TesseractInstalled then
    Top := CreateCheckRow(CompPage, Top, ExpandConstant('{cm:TessDesc}'),
      '✓ установлен', False, True, CbTess, LbTess)
  else
    Top := CreateCheckRow(CompPage, Top, ExpandConstant('{cm:TessDesc}'),
      '✗ не найден', True, True, CbTess, LbTess);

  if RustInstalled then
    Top := CreateCheckRow(CompPage, Top, ExpandConstant('{cm:RustDesc}'),
      '✓ установлен', False, True, CbRust, LbRust)
  else
    Top := CreateCheckRow(CompPage, Top, ExpandConstant('{cm:RustDesc}'),
      '✗ не найден', False, True, CbRust, LbRust);
end;

// ── Download helper ───────────────────────────────────────────────────────────

function DownloadFile(const Url, FileName: String): Boolean;
var
  Dest: String;
begin
  Dest := ExpandConstant('{tmp}') + '\' + FileName;
  Result := True;
  try
    DownloadTemporaryFile(Url, FileName, '', nil);
  except
    MsgBox('Ошибка загрузки: ' + FileName + #13#10 + Url, mbError, MB_OK);
    Result := False;
  end;
end;

function ExecSilent(const Exe, Params: String): Boolean;
var
  Code: Integer;
begin
  Result := Exec(Exe, Params, '', SW_HIDE, ewWaitUntilTerminated, Code);
  if not Result then
    MsgBox('Не удалось запустить: ' + Exe, mbError, MB_OK);
end;

// ── PrepareToInstall — downloads & installs components ───────────────────────

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  TmpDir: String;
  Code: Integer;
begin
  Result := '';
  TmpDir := ExpandConstant('{tmp}');

  WizardForm.StatusLabel.Caption  := '';
  WizardForm.FilenameLabel.Caption := '';

  // ── Python 3.11 ────────────────────────────────────────────────────────────
  if CbPython.Checked then begin
    WizardForm.StatusLabel.Caption := 'Загружаю Python 3.11.9... (~25 МБ)';
    if DownloadTemporaryFile('{#URL_Python}', 'python-3.11.9-amd64.exe', '', nil) > 0 then begin
      WizardForm.StatusLabel.Caption := 'Устанавливаю Python 3.11.9...';
      Exec(TmpDir + '\python-3.11.9-amd64.exe',
        '/quiet InstallAllUsers=0 PrependPath=1 Include_launcher=0 Include_test=0',
        '', SW_HIDE, ewWaitUntilTerminated, Code);
      PythonInstalled; // refresh PythonExe global
    end else
      MsgBox('Не удалось скачать Python 3.11.' + #13#10 +
             'Скачайте вручную: python.org/downloads', mbError, MB_OK);
  end;

  // ── Visual C++ Redist ──────────────────────────────────────────────────────
  if CbVC.Checked then begin
    WizardForm.StatusLabel.Caption := 'Загружаю Visual C++ Redistributable... (~25 МБ)';
    if DownloadTemporaryFile('{#URL_VCREDIST}', 'vc_redist.x64.exe', '', nil) > 0 then begin
      WizardForm.StatusLabel.Caption := 'Устанавливаю Visual C++ Redist...';
      Exec(TmpDir + '\vc_redist.x64.exe', '/quiet /norestart', '', SW_HIDE, ewWaitUntilTerminated, Code);
    end else
      MsgBox('Не удалось скачать Visual C++ Redist.' + #13#10 +
             'torch/ctranslate2 могут не запуститься.', mbError, MB_OK);
  end;

  // ── Tesseract OCR ──────────────────────────────────────────────────────────
  if CbTess.Checked then begin
    WizardForm.StatusLabel.Caption := 'Загружаю Tesseract OCR 5.4... (~5 МБ)';
    if DownloadTemporaryFile('{#URL_TESSERACT}', 'tesseract-setup.exe', '', nil) > 0 then begin
      WizardForm.StatusLabel.Caption := 'Устанавливаю Tesseract OCR...';
      Exec(TmpDir + '\tesseract-setup.exe', '/S', '', SW_HIDE, ewWaitUntilTerminated, Code);
    end else
      MsgBox('Не удалось скачать Tesseract OCR.' + #13#10 +
             'OCR-функции будут недоступны.', mbError, MB_OK);
  end;

  // ── Rust ───────────────────────────────────────────────────────────────────
  if CbRust.Checked then begin
    WizardForm.StatusLabel.Caption := 'Загружаю Rust (rustup)... (~10 МБ)';
    if DownloadTemporaryFile('{#URL_RUST}', 'rustup-init.exe', '', nil) > 0 then begin
      WizardForm.StatusLabel.Caption := 'Устанавливаю Rust...';
      Exec(TmpDir + '\rustup-init.exe',
        '-y --default-toolchain stable', '', SW_SHOW, ewWaitUntilTerminated, Code);
    end else
      MsgBox('Не удалось скачать Rust.' + #13#10 +
             'Нужен только для пересборки Tauri из исходников.', mbError, MB_OK);
  end;

  WizardForm.StatusLabel.Caption := '';
end;

// ── After files are copied — write helper scripts and run pip ────────────────

procedure CurStepChanged(CurStep: TSetupStep);
var
  AppDir, PyExe, ScriptsDir: String;
  Lines: TArrayOfString;
  Code: Integer;
begin
  if CurStep <> ssPostInstall then Exit;

  AppDir     := ExpandConstant('{app}');
  ScriptsDir := AppDir + '\installer_scripts';
  ForceDirectories(ScriptsDir);

  // Resolve python executable (re-detect in case we just installed it)
  PyExe := FindPython;
  if PyExe = '' then PyExe := 'python';  // last resort — hope it's in PATH

  // Save pythonw path for Connor.vbs / start.bat (portable across PCs)
  if PyExe <> '' then begin
    SaveStringToFile(AppDir + '\python_path.txt',
      Copy(PyExe, 1, Length(PyExe) - Length('python.exe')) + 'pythonw.exe', False);
  end;

  // ── Write python_ready.flag ─────────────────────────────────────────────
  ForceDirectories(AppDir + '\python-core\models');
  SaveStringToFile(AppDir + '\python-core\models\python_ready.flag', '0', False);

  // ── Create config.json from template ────────────────────────────────────
  if not FileExists(AppDir + '\config.json') then
    FileCopy(AppDir + '\config.example.json', AppDir + '\config.json', False);

  // ── Write pip install batch ──────────────────────────────────────────────
  SetArrayLength(Lines, 5);
  Lines[0] := '@echo off';
  Lines[1] := 'cd /d "' + AppDir + '"';
  Lines[2] := '"' + PyExe + '" -m pip install --upgrade pip -q';
  Lines[3] := '"' + PyExe + '" -m pip install -r "' + AppDir + '\python-core\requirements.txt"';
  Lines[4] := 'exit 0';
  SaveStringsToFile(ScriptsDir + '\install_pip.bat', Lines, False);

  // ── Run pip install in a visible window so user sees progress ───────────
  WizardForm.StatusLabel.Caption := ExpandConstant('{cm:PipTitle}');
  Exec(ExpandConstant('{cmd}'),
    '/C "' + ScriptsDir + '\install_pip.bat"',
    AppDir, SW_SHOW, ewWaitUntilTerminated, Code);

  WizardForm.StatusLabel.Caption := '';
end;
