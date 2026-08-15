@echo off
setlocal
"%~dp0GLSMAC.exe" --datapath "%~dp0GLSMAC_data" --prefix "%~dp0profile-preview" --windowed
if errorlevel 1 pause
endlocal
