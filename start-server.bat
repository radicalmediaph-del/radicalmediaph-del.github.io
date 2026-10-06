@echo off
setlocal
title RadicalMediaPh - local server
cd /d "%~dp0"

set PORT=8000
if not "%~1"=="" set PORT=%~1

echo.
echo   Starting the RadicalMediaPh website on http://localhost:%PORT%/
echo.

rem ---- 1. Use a real Python install if there is one -----------------------
set PYEXE=
py -3 -c "print(1)" >nul 2>nul
if not errorlevel 1 set PYEXE=py -3
if defined PYEXE goto usepython

python -c "print(1)" >nul 2>nul
if not errorlevel 1 set PYEXE=python
if defined PYEXE goto usepython

goto usepowershell

:usepython
%PYEXE% serve.py %PORT%
goto done

rem ---- 2. Otherwise use PowerShell, which every Windows PC already has ----
:usepowershell
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-server.ps1" -Port %PORT%
if errorlevel 1 goto openfile
goto done

rem ---- 3. Last resort: just open the site from the folder -----------------
:openfile
echo.
echo   Could not start a local server, so the site is opening directly instead.
echo   Everything still works this way.
start "" "%~dp0index.html"

:done
echo.
pause
