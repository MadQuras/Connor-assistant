' Connor RK800 — Silent Launcher
' Запускает Python-ядро и Tauri без видимых окон терминала.
' pythonw.exe ищется автоматически (не привязан к конкретному пользователю/ПК).

Option Explicit

Dim WshShell, FSO, root, pythonw
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

root = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))

pythonw = FindPythonw(root)
If pythonw = "" Then
  MsgBox "Python не найден." & vbCrLf & vbCrLf & _
         "Установите Python 3.11+ или переустановите Connor Setup.", _
         vbCritical, "Connor RK800"
  WScript.Quit 1
End If

' Kill old processes (silent)
WshShell.Run "taskkill /F /IM python.exe /T",    0, True
WshShell.Run "taskkill /F /IM pythonw.exe /T",   0, True
WshShell.Run "taskkill /F /IM connor-tray-v2.exe /T", 0, True
WshShell.Run "taskkill /F /IM connor-tray.exe /T",    0, True

WScript.Sleep 800

' Start Python core silently (pythonw = no console window)
WshShell.Run """" & pythonw & """ """ & root & "python-core\main.py""", 0, False

WScript.Sleep 400

' Start Tauri UI silently
WshShell.Run """" & root & "tauri-front\src-tauri\target\release\connor-tray-v2.exe""", 0, False


Function FindPythonw(rootDir)
  Dim localAppData, pf, pf32, paths, i, p, tmpFile, ts, line, subfolder

  ' 1. Path written by Connor Setup
  p = rootDir & "python_path.txt"
  If FSO.FileExists(p) Then
    Set ts = FSO.OpenTextFile(p, 1)
    line = Trim(ts.ReadLine())
    ts.Close
    If Len(line) > 0 And FSO.FileExists(line) Then
      FindPythonw = line
      Exit Function
    End If
  End If

  localAppData = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%")
  pf = WshShell.ExpandEnvironmentStrings("%ProgramFiles%")
  pf32 = WshShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%")

  ' 2. Common install locations
  paths = Array( _
    localAppData & "\Programs\Python\Python311\pythonw.exe", _
    localAppData & "\Programs\Python\Python312\pythonw.exe", _
    localAppData & "\Programs\Python\Python313\pythonw.exe", _
    localAppData & "\Programs\Python\Python310\pythonw.exe", _
    "C:\Python311\pythonw.exe", _
    "C:\Python312\pythonw.exe", _
    pf & "\Python311\pythonw.exe", _
    pf32 & "\Python311\pythonw.exe" _
  )

  For i = 0 To UBound(paths)
    If FSO.FileExists(paths(i)) Then
      FindPythonw = paths(i)
      Exit Function
    End If
  Next

  ' 3. Any Python* folder under %LOCALAPPDATA%\Programs\Python\
  p = localAppData & "\Programs\Python\"
  If FSO.FolderExists(p) Then
    For Each subfolder In FSO.GetFolder(p).SubFolders
      line = subfolder.Path & "\pythonw.exe"
      If FSO.FileExists(line) Then
        FindPythonw = line
        Exit Function
      End If
    Next
  End If

  ' 4. where pythonw (PATH)
  tmpFile = WshShell.ExpandEnvironmentStrings("%TEMP%") & "\connor_pythonw.txt"
  WshShell.Run "cmd /c where pythonw > """ & tmpFile & """ 2>nul", 0, True
  If FSO.FileExists(tmpFile) Then
    Set ts = FSO.OpenTextFile(tmpFile, 1)
    Do While Not ts.AtEndOfStream
      line = Trim(ts.ReadLine())
      If Len(line) > 0 And FSO.FileExists(line) Then
        FindPythonw = line
        ts.Close
        FSO.DeleteFile tmpFile
        Exit Function
      End If
    Loop
    ts.Close
    FSO.DeleteFile tmpFile
  End If

  ' 5. py launcher
  tmpFile = WshShell.ExpandEnvironmentStrings("%TEMP%") & "\connor_pyexe.txt"
  WshShell.Run "cmd /c py -3 -c ""import sys,os;print(os.path.join(os.path.dirname(sys.executable),'pythonw.exe'))"" > """ & tmpFile & """ 2>nul", 0, True
  If FSO.FileExists(tmpFile) Then
    Set ts = FSO.OpenTextFile(tmpFile, 1)
    line = Trim(ts.ReadLine())
    ts.Close
    FSO.DeleteFile tmpFile
    If Len(line) > 0 And FSO.FileExists(line) Then
      FindPythonw = line
      Exit Function
    End If
  End If

  FindPythonw = ""
End Function
