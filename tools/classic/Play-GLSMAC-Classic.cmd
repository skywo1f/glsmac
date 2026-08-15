@echo off
setlocal
set "CLASSIC_SCRIPT=%~dp0Launch-GLSMACClassic.ps1"
if not exist "%CLASSIC_SCRIPT%" set "CLASSIC_SCRIPT=%~dp0classic\Launch-GLSMACClassic.ps1"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%CLASSIC_SCRIPT%" %*
if errorlevel 1 pause
endlocal
