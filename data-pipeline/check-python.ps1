<#
.SYNOPSIS
    FlopSource - Advanced Python Diagnostic (PowerShell)

.DESCRIPTION
    More detailed diagnostic than the .bat version.
    Run this if you're still having issues after using check-python.bat.
#>

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  FlopSource - Python Diagnostic (Advanced)" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$results = @()

# Function to test a python command
function Test-PythonCommand {
    param($Command, $Args = "--version")

    try {
        $output = & $Command $Args 2>&1
        if ($LASTEXITCODE -eq 0 -or $output -match "Python") {
            return @{
                Command = $Command
                Working = $true
                Output  = $output.Trim()
            }
        }
    } catch {}
    return @{
        Command = $Command
        Working = $false
        Output  = $null
    }
}

Write-Host "[1] Testing Python Launcher (py.exe)..." -ForegroundColor Yellow
$pyTest = Test-PythonCommand "py" "-3 --version"
if ($pyTest.Working) {
    Write-Host "    [GOOD] py -3 works → $($pyTest.Output)" -ForegroundColor Green
    $results += $pyTest
} else {
    Write-Host "    [MISSING] py -3 not working" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "[2] Testing 'python' command..." -ForegroundColor Yellow
$pythonTest = Test-PythonCommand "python"
if ($pythonTest.Working) {
    Write-Host "    [GOOD] python works → $($pythonTest.Output)" -ForegroundColor Green
    $results += $pythonTest
} else {
    Write-Host "    [MISSING] python command not working" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "[3] Testing 'python3' command..." -ForegroundColor Yellow
$python3Test = Test-PythonCommand "python3"
if ($python3Test.Working) {
    Write-Host "    [GOOD] python3 works → $($python3Test.Output)" -ForegroundColor Green
    $results += $python3Test
} else {
    Write-Host "    [MISSING] python3 command not working" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "[4] Checking common Python installation paths (bypasses aliases)..." -ForegroundColor Yellow

$commonPaths = @(
    "$env:LOCALAPPDATA\Programs\Python",
    "$env:ProgramFiles\Python*",
    "$env:ProgramFiles (x86)\Python*",
    "C:\Python*"
)

$foundInstalls = @()
foreach ($path in $commonPaths) {
    $matches = Get-ChildItem -Path $path -Directory -ErrorAction SilentlyContinue
    foreach ($match in $matches) {
        $pythonExe = Join-Path $match.FullName "python.exe"
        if (Test-Path $pythonExe) {
            try {
                $ver = & $pythonExe --version 2>&1
                $foundInstalls += [PSCustomObject]@{
                    Path    = $match.FullName
                    Exe     = $pythonExe
                    Version = $ver.Trim()
                }
            } catch {}
        }
    }
}

if ($foundInstalls.Count -gt 0) {
    Write-Host "    Found these Python installations:" -ForegroundColor Green
    $foundInstalls | ForEach-Object {
        Write-Host "      $($_.Version) at $($_.Path)" -ForegroundColor White
    }

    # Test the first real installation found
    $best = $foundInstalls[0]
    try {
        $test = & $best.Exe --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "    [SUCCESS] Real Python at $($best.Exe) is working!" -ForegroundColor Green
        }
    } catch {}
} else {
    Write-Host "    No standard Python installations found in common locations." -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "RECOMMENDATION:" -ForegroundColor Yellow
Write-Host "If none of the above show a working Python, run:" -ForegroundColor White
Write-Host "  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser" -ForegroundColor Cyan
Write-Host "in PowerShell, then disable the Microsoft Store aliases." -ForegroundColor White
Write-Host "=====================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan

if ($results.Count -gt 0) {
    Write-Host "  RESULT: Working Python command(s) detected" -ForegroundColor Green
    Write-Host "=====================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Best command to use:" -ForegroundColor Green
    Write-Host "   $($results[0].Command)" -ForegroundColor White
    Write-Host ""
    Write-Host "You should be able to run:" -ForegroundColor Cyan
    Write-Host "   .\run-pipeline.bat" -ForegroundColor White
} else {
    Write-Host "  RESULT: No working Python found" -ForegroundColor Red
    Write-Host "=====================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "This is almost always the Microsoft Store alias problem." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "FIX (do this once):" -ForegroundColor Cyan
    Write-Host "  1. Press Windows key and type:" -ForegroundColor White
    Write-Host "     Manage app execution aliases" -ForegroundColor White
    Write-Host "  2. Open the top result" -ForegroundColor White
    Write-Host "  3. Turn OFF the two toggles for App Installer" -ForegroundColor White
    Write-Host "     (python.exe and python3.exe)" -ForegroundColor White
    Write-Host ""
    Write-Host "Then install Python 3.10+ from:" -ForegroundColor Cyan
    Write-Host "  https://www.python.org/downloads/" -ForegroundColor White
    Write-Host ""
    Write-Host "After installing, run this diagnostic again." -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Press Enter to close"
