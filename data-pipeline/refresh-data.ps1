<#
.SYNOPSIS
    FlopSource - Automated Data Refresh (for Task Scheduler)

.DESCRIPTION
    Fully non-interactive data refresh script.
    Intended to be run by Windows Task Scheduler every 10 minutes.
#>

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$logFile = Join-Path $scriptDir "refresh-log.txt"

function Write-Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$ts - $msg" | Out-File -FilePath $logFile -Append -Encoding UTF8
}

Write-Log "=== Automated data refresh started ==="

# Force modern UTF-8 console + Python encoding (prevents Rich unicode crashes on Windows)
try { chcp 65001 | Out-Null } catch {}
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

# --- Find Python robustly ---
$pythonExe = $null

try {
    $exe = & py -3 -c "import sys; print(sys.executable)" 2>$null
    if ($exe -and (Test-Path $exe)) { $pythonExe = $exe }
} catch {}

if (-not $pythonExe) {
    $search = @(
        "$env:LOCALAPPDATA\Programs\Python\Python3*",
        "$env:ProgramFiles\Python3*",
        "C:\Python3*"
    )
    foreach ($pattern in $search) {
        Get-ChildItem $pattern -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $candidate = Join-Path $_.FullName "python.exe"
            if (Test-Path $candidate -and -not $pythonExe) {
                $pythonExe = $candidate
            }
        }
    }
}

if (-not $pythonExe) {
    Write-Log "[ERROR] Python executable not found."
    exit 1
}

Write-Log "Using Python: $pythonExe"

# --- Ensure venv ---
$venvPython = Join-Path $scriptDir ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    Write-Log "Creating virtual environment..."
    & $pythonExe -m venv .venv 2>&1 | ForEach-Object { Write-Log $_ }
    if ($LASTEXITCODE -ne 0) {
        Write-Log "[ERROR] Failed to create venv"
        exit 1
    }
}

$pythonExe = $venvPython
Write-Log "Using venv Python: $pythonExe"

# --- Install deps ---
Write-Log "Upgrading pip and installing requirements..."
& $pythonExe -m pip install --upgrade pip --quiet 2>&1 | Out-Null
& $pythonExe -m pip install -r requirements.txt --quiet 2>&1 | ForEach-Object { Write-Log $_ }

if ($LASTEXITCODE -ne 0) {
    Write-Log "[ERROR] Failed to install requirements"
    exit 1
}

# --- Run pipeline ---
Write-Log "Running pipeline.py full ..."
& $pythonExe pipeline.py full 2>&1 | ForEach-Object { Write-Log $_ }

Write-Log "=== Data refresh completed ==="
Write-Log ""
