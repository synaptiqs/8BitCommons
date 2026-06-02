@echo off
REM ================================================
REM FlopSource - Root Level Site Launcher (RECOMMENDED)
REM Double-click this file from the FlopSource root folder.
REM 
REM This serves the marketing landing page (index.html) as the main page.
REM The directory app is available at /website/flopsourcedirectory.html
REM ================================================

setlocal

echo.
echo ================================================
echo   Starting FlopSource Local Server from PROJECT ROOT
echo ================================================
echo.
echo Marketing landing page (MAIN PAGE) : http://127.0.0.1:5500/
echo Directory tool                     : http://127.0.0.1:5500/website/flopsourcedirectory.html
echo.
echo IMPORTANT: This must be run from the FlopSource root folder.
echo.

cd /d "%~dp0"

REM ================================================
REM Robust Python detection
REM ================================================
set "PYTHON_EXE="

where py >nul 2>nul
if %errorlevel% equ 0 (
    for /f "delims=" %%i in ('py -3 -c "import sys; print(sys.executable)" 2^>nul') do (
        if exist "%%i" set "PYTHON_EXE=%%i"
    )
)

if not defined PYTHON_EXE (
    set "SCAN_PATHS=%LOCALAPPDATA%\Programs\Python\Python3* %ProgramFiles%\Python3* %ProgramFiles(x86)%\Python3* C:\Python3*"
    for %%P in (%SCAN_PATHS%) do (
        if exist "%%P\python.exe" (
            set "PYTHON_EXE=%%P\python.exe"
        )
    )
)

if not defined PYTHON_EXE (
    where python >nul 2>nul
    if %errorlevel% equ 0 set "PYTHON_EXE=python"
)

if not defined PYTHON_EXE (
    echo.
    echo ============================================================
    echo [ERROR] Python was not found.
    echo ============================================================
    echo.
    echo This is almost always caused by the Microsoft Store Python alias.
    echo.
    echo STRONGLY RECOMMENDED:
    echo   1. Go to the data-pipeline folder
    echo   2. Double-click "check-python.bat"
    echo   3. Follow the instructions it gives you.
    echo.
    echo.
    pause
    cmd /k
    exit /b 1
)

echo Using Python: %PYTHON_EXE%
echo.
echo Starting local dev server for FlopSource (no-cache mode)...
echo.
echo Marketing landing page (MAIN PAGE) : http://127.0.0.1:5500/
echo Directory tool                     : http://127.0.0.1:5500/website/flopsourcedirectory.html
echo.
echo Press Ctrl+C in this window to stop the server.
echo.

REM Write server to temp file (reliable method)
set "TMP_SERVER=%TEMP%\flopsource_root_server_%RANDOM%.py"

(
echo import http.server
echo import socketserver
echo import os
echo.
echo PORT = 5500
echo.
echo class NoCacheHandler(http.server.SimpleHTTPRequestHandler^):
echo     def end_headers(self^):
echo         self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0'^)
echo         self.send_header('Pragma', 'no-cache'^)
echo         self.send_header('Expires', '0'^)
echo         super().end_headers()
echo.
echo     def log_message(self, format, *args^):
echo         if 'GET' in args[0] and 'favicon' not in args[0]:
echo             super().log_message(format, *args)
echo.
echo     def do_GET(self^):
echo         if self.path in ('/website/', '/website/index.html'^):
echo             self.send_response(302^)
echo             self.send_header('Location', '/website/flopsourcedirectory.html'^)
echo             self.end_headers()
echo             return
echo         super().do_GET()
echo.
echo os.chdir(os.path.dirname(os.path.abspath(__file__^^^)^)^)
echo.
echo print('Serving from:', os.getcwd())
echo print('If you see a directory listing instead of the landing page, you may be running the wrong serve.bat.')
echo.
echo with socketserver.TCPServer(('', PORT^), NoCacheHandler^) as httpd:
echo     print(f'Serving on http://127.0.0.1:{PORT} with no-cache headers'^)
echo     print('Marketing landing (main page) should be at http://127.0.0.1:5500/'^)
echo     try:
echo         httpd.serve_forever()
echo     except KeyboardInterrupt:
echo         print('\nServer stopped.'^)
) > "%TMP_SERVER%"

"%PYTHON_EXE%" "%TMP_SERVER%"

echo.
echo.
echo ============================================================
echo Server has stopped or failed to start.
echo Check the messages above for any errors.
echo ============================================================
echo.
pause

del "%TMP_SERVER%" 2>nul 2>nul

echo.
pause

REM ================================================
REM SAFETY NET - Keeps window open for double-click users
REM ================================================
echo.
echo ============================================================
echo   Script finished or was interrupted.
echo   Press any key to close this window...
echo ============================================================
pause >nul 2>&1
