@echo off
setlocal
"%~dp0GLSMAC.exe" --prefix "%~dp0profile-preview" --windowed
if errorlevel 1 pause
endlocal
