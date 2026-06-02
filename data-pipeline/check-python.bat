@echo off
REM =====================================================
REM FlopSource - Python Diagnostic Tool
REM Run this if you're having trouble with run-pipeline.bat
REM =====================================================

setlocal enabledelayedexpansion

echo.
echo =====================================================
echo   FlopSource - Python Environment Diagnostic
echo =====================================================
echo.

cd /d "%~dp0"

echo [Step 1] Checking for Python Launcher (recommended on Windows)...
where py >nul 2>nul
if %errorlevel% equ 0 (
    echo   [FOUND] py.exe (Python Launcher)
    echo.
    echo   Testing py -3...
    py -3 --version 2>&1
    if %errorlevel% equ 0 (
        echo   [SUCCESS] py -3 is working!
        set "PYTHON_CMD=py -3"
        goto :found_python
    ) else (
        echo   [WARNING] py found but py -3 failed.
    )
) else (
    echo   [NOT FOUND] py.exe
)

echo.
echo [Step 2] Checking for 'python' command (PATH - may be broken by Store alias)...
where python >nul 2>nul
if %errorlevel% equ 0 (
    echo   [FOUND] python command in PATH
    echo.
    echo   Testing python --version...
    python --version 2>&1
    if %errorlevel% equ 0 (
        echo   [SUCCESS] python command is working!
        set "PYTHON_CMD=python"
        goto :found_python
    ) else (
        echo   [WARNING] 'python' command exists but returned an error (likely Store alias).
    )
) else (
    echo   [NOT FOUND] python command
)

echo.
echo [Step 3] Checking for 'python3' command (PATH)...
where python3 >nul 2>nul
if %errorlevel% equ 0 (
    echo   [FOUND] python3 command
    echo.
    echo   Testing python3 --version...
    python3 --version 2>&1
    if %errorlevel% equ 0 (
        echo   [SUCCESS] python3 command is working!
        set "PYTHON_CMD=python3"
        goto :found_python
    ) else (
        echo   [WARNING] 'python3' command exists but returned an error.
    )
) else (
    echo   [NOT FOUND] python3 command
)

echo.
echo [Step 4] Manual path scan (bypasses PATH and aliases)...
set "SCAN_PATHS=%LOCALAPPDATA%\Programs\Python\Python3* %ProgramFiles%\Python3* %ProgramFiles(x86)%\Python3* C:\Python3*"

for %%P in (%SCAN_PATHS%) do (
    if exist "%%P\python.exe" (
        echo   [FOUND] %%P\python.exe
        "%%P\python.exe" --version 2>&1
        if %errorlevel% equ 0 (
            echo   [SUCCESS] Working Python found via manual scan!
            set "PYTHON_CMD=%%P\python.exe"
            goto :found_python
        )
    )
)

echo.
echo =====================================================
echo   RESULT: No working Python found
echo =====================================================
echo.
echo This is almost always caused by the Microsoft Store alias.
echo.
echo FIX (do this now):
echo   1. Press the Windows key and type:
echo      Manage app execution aliases
echo   2. Open the top result
echo   3. Turn OFF both toggles under "App Installer"
echo      (python.exe and python3.exe)
echo   4. Close the window
echo.
echo After doing that, download and install Python from here:
echo   https://www.python.org/downloads/
echo   (Important: Check "Add Python to PATH")
echo.
echo Then run this diagnostic again.
echo.
pause
exit /b 1

:found_python
echo.
echo =====================================================
echo   SUCCESS! Working Python command found
echo =====================================================
echo.
echo Command to use: %PYTHON_CMD%
echo.
echo Recommended next step:
echo   Double-click "run-pipeline.bat" in this folder.
echo.
echo If run-pipeline.bat still fails, try running these commands manually:
echo.
echo   %PYTHON_CMD% -m venv .venv
echo   call .venv\Scripts\activate.bat
echo   pip install -r requirements.txt
echo   python pipeline.py full
echo.
echo =====================================================
echo.

pause