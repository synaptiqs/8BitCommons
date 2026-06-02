@echo off
REM ================================================
REM FlopSource - Local Development Server (no-cache)
REM Double-click this file to serve the directory app.
REM 
REM NOTE: The main marketing landing page is at the project root (index.html).
REM This script only serves the directory tool (flopsourcedirectory.html).
REM 
REM For the full experience (landing + directory), run serve.bat from the project root instead.
REM ================================================

cd /d "%~dp0"

echo.
echo Starting local dev server for FlopSource (flopsourcedirectory.html) - no-cache mode...
echo.

REM Defensive Python detection
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
    echo [ERROR] Python was not found.
    echo.
    echo This is almost always caused by the Microsoft Store Python alias.
    echo.
    echo STRONGLY RECOMMENDED:
    echo   1. Go to the data-pipeline folder
    echo   2. Double-click "check-python.bat"
    echo   3. Follow the instructions it gives you.
    echo.
    pause
    exit /b 1
)

echo.
pause 2>nul || echo (Press any key to continue...)

echo Using Python: %PYTHON_EXE%
echo.
echo Server running on http://127.0.0.1:5500 with NO CACHE headers.
echo Directory tool: http://127.0.0.1:5500/flopsourcedirectory.html
echo (Run root serve.bat for the marketing landing page at /)
echo Data will reload immediately after you run the pipeline.
echo.
echo Press Ctrl+C to stop.
echo.

"%PYTHON_EXE%" -c "
import http.server
import socketserver
import os

PORT = 5500

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        if 'GET' in args[0] and 'favicon' not in args[0]:
            super().log_message(format, *args)

    def do_GET(self):
        # Redirect / and /index.html to the renamed directory file
        if self.path in ('/', '/index.html'):
            self.send_response(302)
            self.send_header('Location', '/flopsourcedirectory.html')
            self.end_headers()
            return
        super().do_GET()

os.chdir(os.path.dirname(os.path.abspath(__file__)))

with socketserver.TCPServer(('', PORT), NoCacheHandler) as httpd:
    print(f'Serving on http://127.0.0.1:{PORT} with no-cache headers')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nServer stopped.')
"