@echo off
cd /d "%~dp0"
echo [Connor] Python 3.11...
py -3.11 -m pip install -r python-core\requirements-3.11.txt
echo [Connor] Python 3.14...
py -3.14 -m pip install -r python-core\requirements-3.14.txt
echo Done.
pause
