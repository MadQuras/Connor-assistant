@echo off
set "PYTHONW="

:: 1. Path saved by Connor Setup (next to this script)
if exist "%~dp0python_path.txt" (
  for /f "usebackq delims=" %%P in ("%~dp0python_path.txt") do (
    if exist "%%P" set "PYTHONW=%%P"
  )
)
if defined PYTHONW goto :done

:: 2. Common per-user installs
for %%V in (311 312 313 310 314) do (
  if exist "%LOCALAPPDATA%\Programs\Python\Python%%V\pythonw.exe" (
    set "PYTHONW=%LOCALAPPDATA%\Programs\Python\Python%%V\pythonw.exe"
    goto :done
  )
)

:: 3. System-wide installs
if exist "C:\Python311\pythonw.exe" set "PYTHONW=C:\Python311\pythonw.exe" & goto :done
if exist "C:\Python312\pythonw.exe" set "PYTHONW=C:\Python312\pythonw.exe" & goto :done
if exist "%ProgramFiles%\Python311\pythonw.exe" set "PYTHONW=%ProgramFiles%\Python311\pythonw.exe" & goto :done
if exist "%ProgramFiles(x86)%\Python311\pythonw.exe" set "PYTHONW=%ProgramFiles(x86)%\Python311\pythonw.exe" & goto :done

:: 4. PATH
for /f "delims=" %%P in ('where pythonw 2^>nul') do (
  if not defined PYTHONW if exist "%%P" set "PYTHONW=%%P"
)
if defined PYTHONW goto :done

:: 5. py launcher
for /f "delims=" %%P in ('py -3 -c "import sys,os;print(os.path.join(os.path.dirname(sys.executable),'pythonw.exe'))" 2^>nul') do (
  if exist "%%P" set "PYTHONW=%%P" & goto :done
)

:done
if not defined PYTHONW (
  echo [Connor] pythonw.exe not found. Install Python 3.11+ or re-run Connor Setup.
  exit /b 1
)
exit /b 0
