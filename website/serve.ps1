<#
.SYNOPSIS
    FlopSource - Local Development Server (PowerShell)
    Serves the directory app (flopsourcedirectory.html) with aggressive no-cache headers.

NOTE: The main marketing landing page lives at the project root (index.html).
      Run the root serve.bat / serve.ps1 instead if you want the full experience
      (landing page at / + directory at /website/).
#>

Write-Host ""
Write-Host "Starting local dev server for FlopSource (flopsourcedirectory.html) - no-cache mode..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Directory tool available at: http://127.0.0.1:5500/flopsourcedirectory.html" -ForegroundColor Yellow
Write-Host "For the marketing landing page, run serve from the project root instead." -ForegroundColor Yellow
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

function Find-PythonExe {
    $py = Get-Command py -ErrorAction SilentlyContinue
    if ($py) {
        try {
            $exe = & py -3 -c "import sys; print(sys.executable)" 2>$null
            if ($exe -and (Test-Path $exe)) { return $exe }
        } catch {}
    }

    $searchPaths = @(
        "$env:LOCALAPPDATA\Programs\Python\Python3*",
        "$env:ProgramFiles\Python3*",
        "$env:ProgramFiles(x86)\Python3*",
        "C:\Python3*"
    )

    foreach ($pattern in $searchPaths) {
        $dirs = Get-ChildItem -Path $pattern -Directory -ErrorAction SilentlyContinue
        foreach ($dir in $dirs) {
            $exe = Join-Path $dir.FullName "python.exe"
            if (Test-Path $exe) {
                return $exe
            }
        }
    }

    foreach ($cmd in @("python", "python3")) {
        $command = Get-Command $cmd -ErrorAction SilentlyContinue
        if ($command) {
            try {
                $exe = & $command.Source -c "import sys; print(sys.executable)" 2>$null
                if ($exe -and (Test-Path $exe)) { return $exe }
            } catch {}
        }
    }

    return $null
}

$pythonExe = Find-PythonExe

if (-not $pythonExe) {
    Write-Host "[ERROR] Python was not found." -ForegroundColor Red
    Write-Host ""
    Write-Host "This is usually the Microsoft Store alias problem." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "FIX:" -ForegroundColor Cyan
    Write-Host "  1. Press Windows key and type: Manage app execution aliases"
    Write-Host "  2. Turn OFF the two toggles for App Installer (python.exe and python3.exe)"
    Write-Host "  3. Install Python 3.10+ from https://www.python.org/downloads/"
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Using Python: $pythonExe" -ForegroundColor Green
Write-Host ""
Write-Host "Server will run on http://127.0.0.1:5500" -ForegroundColor Yellow
Write-Host "Cache headers are disabled for development (data will always reload on refresh)." -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop the server." -ForegroundColor DarkGray
Write-Host ""

# Launch Python with a custom no-cache HTTP server
& $pythonExe -c "
import http.server
import socketserver
import os
import sys

PORT = 5500

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        # Reduce noise
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