@echo off
REM ================================================
REM FlopSource - Data Pipeline Launcher (Windows)
REM Double-click this file or run from Command Prompt
REM
REM This script is intentionally defensive against common Windows Python problems:
REM - Microsoft Store App Execution Aliases
REM - Broken PATH after venv activation
REM - Missing py launcher
REM ================================================

setlocal enabledelayedexpansion

echo.
echo ================================================
echo   FlopSource - Data Pipeline
echo ================================================
echo.

cd /d "%~dp0"

REM ============================================
REM DEFENSIVE Python Detection (handles broken Windows aliases)
REM ============================================
set "PYTHON_EXE="
set "PYTHON_DISPLAY="

echo Detecting Python installation (defensive mode)...

REM --- Method 1: Python Launcher (preferred) ---
where py >nul 2>nul
if %errorlevel% equ 0 (
    for /f "delims=" %%i in ('py -3 -c "import sys; print(sys.executable)" 2^>nul') do (
        if exist "%%i" (
            set "PYTHON_EXE=%%i"
            set "PYTHON_DISPLAY=py -3"
            goto :python_found
        )
    )
)

REM --- Method 2: Manual path scan (bypasses PATH aliases completely) ---
set "PYTHON_PATHS="
set "PYTHON_PATHS=%PYTHON_PATHS% %LOCALAPPDATA%\Programs\Python\Python3*"
set "PYTHON_PATHS=%PYTHON_PATHS% %ProgramFiles%\Python3*"
set "PYTHON_PATHS=%PYTHON_PATHS% %ProgramFiles(x86)%\Python3*"
set "PYTHON_PATHS=%PYTHON_PATHS% C:\Python3*"

for %%P in (%PYTHON_PATHS%) do (
    if exist "%%P\python.exe" (
        set "PYTHON_EXE=%%P\python.exe"
        set "PYTHON_DISPLAY=%%P\python.exe"
        goto :python_found
    )
)

REM --- Method 3: Fallback to PATH (least reliable) ---
where python >nul 2>nul
if %errorlevel% equ 0 (
    for /f "delims=" %%i in ('python -c "import sys; print(sys.executable)" 2^>nul') do (
        if exist "%%i" (
            set "PYTHON_EXE=%%i"
            set "PYTHON_DISPLAY=python (from PATH)"
            goto :python_found
        )
    )
)

where python3 >nul 2>nul
if %errorlevel% equ 0 (
    for /f "delims=" %%i in ('python3 -c "import sys; print(sys.executable)" 2^>nul') do (
        if exist "%%i" (
            set "PYTHON_EXE=%%i"
            set "PYTHON_DISPLAY=python3 (from PATH)"
            goto :python_found
        )
    )
)

REM --- Nothing found ---
echo.
echo ================================================
echo   [ERROR] Python was not found on this system
echo ================================================
echo.
echo This is an extremely common Windows problem caused by Microsoft Store aliases.
echo.
echo *** BEST NEXT STEP ***
echo Double-click this file right now:
echo     check-python.bat
echo.
echo It will give you the exact fix for your machine.
echo.
echo Manual fix:
echo   1. Press Windows key and type: Manage app execution aliases
echo   2. Turn OFF python.exe and python3.exe under App Installer
echo   3. Install Python from https://www.python.org/downloads/ (check "Add Python to PATH")
echo.
pause
exit /b 1

:python_found
echo [1/4] Using Python: %PYTHON_DISPLAY%
echo       Full path : "%PYTHON_EXE%"

REM --- Validate that this Python actually has pip (common with broken/Store installs) ---
"%PYTHON_EXE%" -m pip --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [WARNING] This Python installation is missing the pip module.
    echo           Attempting automatic recovery using ensurepip...
    "%PYTHON_EXE%" -m ensurepip --upgrade >nul 2>&1
    "%PYTHON_EXE%" -m pip --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Could not recover pip for the Python at:
        echo         %PYTHON_EXE%
        echo.
        echo This Python installation appears incomplete or corrupted.
        echo.
        echo *** RECOMMENDED ACTIONS ***
        echo 1. Double-click "check-python.bat" in this folder for a full diagnosis.
        echo 2. Install a fresh, clean Python from:
        echo    https://www.python.org/downloads/
        echo    (Check the box "Add Python to PATH" during install)
        echo.
        pause
        exit /b 1
    )
    echo [INFO] pip successfully bootstrapped via ensurepip.
)

REM Create virtual environment if it doesn't exist
if not exist ".venv" (
    echo.
    echo [2/4] Creating virtual environment...
    "%PYTHON_EXE%" -m venv .venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment.
        echo.
        echo If you see errors about venv, try installing Python from python.org
        echo instead of the Microsoft Store version.
        pause
        exit /b 1
    )
) else (
    echo.
    echo [2/4] Virtual environment already exists.
)

REM From this point forward, use the venv's Python (much more reliable)
set "PYTHON_EXE=%~dp0.venv\Scripts\python.exe"
echo.
echo [INFO] Using virtual environment Python for all remaining steps:
echo       %PYTHON_EXE%

echo.
echo [3/4] Installing / upgrading dependencies...
"%PYTHON_EXE%" -m pip install --upgrade pip
"%PYTHON_EXE%" -m pip install -r requirements.txt

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to install dependencies into the virtual environment.
    echo.
    echo This can happen if your internet connection is blocked or if there are
    echo permission issues with the .venv folder.
    echo.
    echo Try running "check-python.bat" for more diagnostics.
    pause
    exit /b 1
)

echo.
echo [4/4] Running the full pipeline (scrape + build)...
echo.

"%PYTHON_EXE%" pipeline.py full

echo.
echo ================================================
echo   Pipeline finished successfully!
echo ================================================
echo.
echo The directory data has been written to:
echo   ..\website\data\data_centers.json
echo.
echo You can now open the frontend to see the results:
echo   website\index.html
echo.

pause
exit /b 0