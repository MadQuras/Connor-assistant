' Connor RK800 — Silent Launcher
' Запускает Python-ядро и Tauri без каких-либо видимых окон терминала.

Option Explicit

Dim WshShell, root
Set WshShell = CreateObject("WScript.Shell")

root = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))

' Kill old processes (silent)
WshShell.Run "taskkill /F /IM python.exe /T",    0, True
WshShell.Run "taskkill /F /IM pythonw.exe /T",   0, True
WshShell.Run "taskkill /F /IM connor-tray-v2.exe /T", 0, True
WshShell.Run "taskkill /F /IM connor-tray.exe /T",    0, True

WScript.Sleep 800

' Start Python core silently (pythonw = no console window)
WshShell.Run """C:\Users\CompX\AppData\Local\Programs\Python\Python311\pythonw.exe"" """ & root & "python-core\main.py""", 0, False

WScript.Sleep 400

' Start Tauri UI silently
WshShell.Run """" & root & "tauri-front\src-tauri\target\release\connor-tray-v2.exe""", 0, False
