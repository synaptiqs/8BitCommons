<#
.SYNOPSIS
    FlopSource - Data Pipeline Launcher (PowerShell)

.DESCRIPTION
    Robust launcher that handles the common Microsoft Store alias problem.
#>

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  FlopSource - Data Pipeline" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Force UTF-8 so Rich checkmarks and international text don't crash on legacy Windows consoles
try { chcp 65001 | Out-Null } catch {}
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

function Find-Python {
    <#
    Defensive Python detection that works even when Microsoft Store aliases
    have broken the normal PATH resolution.
    #>

    # Method 1: Python Launcher (preferred)
    $py = Get-Command py -ErrorAction SilentlyContinue
    if ($py) {
        try {
            $exe = & py -3 -c "import sys; print(sys.executable)" 2>$null
            if ($exe -and (Test-Path $exe)) {
                return $exe
            }
        } catch {}
    }

    # Method 2: Manual path scanning (bypasses broken PATH/aliases)
    $searchPaths = @(
        "$env:LOCALAPPDATA\Programs\Python\Python3*",
        "$env:ProgramFiles\Python3*",
        "$env:ProgramFiles(x86)\Python3*",
        "C:\Python3*"
    )

    foreach ($pattern in $searchPaths) {
        $matches = Get-ChildItem -Path $pattern -Directory -ErrorAction SilentlyContinue
        foreach ($dir in $matches) {
            $pythonExe = Join-Path $dir.FullName "python.exe"
            if (Test-Path $pythonExe) {
                return $pythonExe
            }
        }
    }

    # Method 3: Last resort - check PATH (least reliable)
    $candidates = @("python", "python3")
    foreach ($cmd in $candidates) {
        $command = Get-Command $cmd -ErrorAction SilentlyContinue
        if ($command) {
            try {
                $exe = & $command.Source -c "import sys; print(sys.executable)" 2>$null
                if ($exe -and (Test-Path $exe)) {
                    return $exe
                }
            } catch {}
        }
    }

    return $null
}

$pythonExe = Find-Python

if (-not $pythonExe) {
    Write-Host "[ERROR] Python was not found or is being blocked by Windows." -ForegroundColor Red
    Write-Host ""
    Write-Host "This is an extremely common issue on Windows." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "RECOMMENDED: Run the diagnostic tool first:" -ForegroundColor Cyan
    Write-Host "   Double-click check-python.ps1 (or check-python.bat)" -ForegroundColor White
    Write-Host ""
    Write-Host "Quick manual fix:" -ForegroundColor Cyan
    Write-Host "  1. Press the Windows key and type:" -ForegroundColor White
    Write-Host "     Manage app execution aliases" -ForegroundColor White
    Write-Host "  2. Turn OFF the two toggles for App Installer" -ForegroundColor White
    Write-Host "     (python.exe and python3.exe)" -ForegroundColor White
    Write-Host ""
    Write-Host "Then install Python 3.10+ from:" -ForegroundColor Cyan
    Write-Host "  https://www.python.org/downloads/" -ForegroundColor White
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[1/4] Using Python: $pythonExe" -ForegroundColor Green

# --- Validate that this Python actually has a working pip ---
try {
    & $pythonExe -m pip --version | Out-Null
    $pipWorks = ($LASTEXITCODE -eq 0)
} catch {
    $pipWorks = $false
}

if (-not $pipWorks) {
    Write-Host ""
    Write-Host "[WARNING] This Python installation is missing the pip module." -ForegroundColor Yellow
    Write-Host "          Attempting automatic recovery using ensurepip..." -ForegroundColor Yellow

    & $pythonExe -m ensurepip --upgrade 2>&1 | Out-Null

    try {
        & $pythonExe -m pip --version | Out-Null
        $pipWorks = ($LASTEXITCODE -eq 0)
    } catch {
        $pipWorks = $false
    }

    if (-not $pipWorks) {
        Write-Host ""
        Write-Host "[ERROR] Could not recover pip for the Python at:" -ForegroundColor Red
        Write-Host "        $pythonExe" -ForegroundColor White
        Write-Host ""
        Write-Host "This Python installation appears incomplete or corrupted." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "*** RECOMMENDED ACTIONS ***" -ForegroundColor Cyan
        Write-Host "1. Double-click 'check-python.ps1' (or check-python.bat) in this folder." -ForegroundColor White
        Write-Host "2. Install a fresh Python from:" -ForegroundColor White
        Write-Host "   https://www.python.org/downloads/" -ForegroundColor White
        Write-Host "   (Important: Check 'Add Python to PATH' during installation)" -ForegroundColor White
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "[INFO] pip successfully bootstrapped via ensurepip." -ForegroundColor Green
}

# Create venv if needed
if (-not (Test-Path ".venv")) {
    Write-Host ""
    Write-Host "[2/4] Creating virtual environment..." -ForegroundColor Yellow
    & $pythonExe -m venv .venv
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to create virtual environment." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
} else {
    Write-Host ""
    Write-Host "[2/4] Virtual environment already exists." -ForegroundColor Green
}

# From this point on, use the venv's Python (isolated and reliable)
$pythonExe = Join-Path $scriptDir ".venv\Scripts\python.exe"
Write-Host ""
Write-Host "[INFO] Switching to virtual environment Python:" -ForegroundColor Green
Write-Host "       $pythonExe" -ForegroundColor DarkGray

Write-Host ""
Write-Host "[3/4] Installing / upgrading dependencies..." -ForegroundColor Yellow

& $pythonExe -m pip install --upgrade pip
& $pythonExe -m pip install -r requirements.txt

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] Failed to install packages into the virtual environment." -ForegroundColor Red
    Write-Host ""
    Write-Host "Possible causes: no internet, corporate firewall, or permission issues." -ForegroundColor Yellow
    Write-Host "Try running the diagnostic: check-python.ps1" -ForegroundColor White
    Read-Host "Press Enter to exit"
    exit 1
}

# Run pipeline using full path
Write-Host ""
Write-Host "[4/4] Running the full pipeline..." -ForegroundColor Yellow
Write-Host ""

& $pythonExe pipeline.py full

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Pipeline completed!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Generated file:" -ForegroundColor Cyan
Write-Host "  ..\website\data\data_centers.json" -ForegroundColor White
Write-Host ""

Read-Host "Press Enter to close"

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Pipeline completed!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Generated file:" -ForegroundColor Cyan
Write-Host "  ..\website\data\data_centers.json" -ForegroundColor White
Write-Host ""

Read-Host "Press Enter to close"
