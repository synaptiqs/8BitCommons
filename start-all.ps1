<#
.SYNOPSIS
    FlopSource - All-in-One Launcher (PowerShell)

.DESCRIPTION
    Launches the data pipeline and/or the website server from the project root.
#>

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  FlopSource - All-in-One Launcher" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

function Show-Menu {
    Write-Host "1. Run Data Pipeline only (rebuild provider data)"
    Write-Host "2. Start Website Server only"
    Write-Host "3. Run Pipeline, then start Website Server"
    Write-Host "4. Exit"
    Write-Host ""
}

function Run-Pipeline {
    Write-Host ""
    Write-Host "[1] Running Data Pipeline..." -ForegroundColor Yellow
    Write-Host ""
    if (Test-Path "data-pipeline\run-pipeline.bat") {
        & "data-pipeline\run-pipeline.bat"
    } else {
        Write-Host "[ERROR] data-pipeline\run-pipeline.bat not found!" -ForegroundColor Red
        return $false
    }
    return $true
}

function Start-Website {
    Write-Host ""
    Write-Host "[2] Starting Website Server..." -ForegroundColor Yellow
    Write-Host ""
    if (Test-Path "website\serve.bat") {
        Start-Process -FilePath "cmd.exe" -ArgumentList "/k cd /d `"$scriptDir\website`" && serve.bat" -WindowStyle Normal
        Write-Host "Website server is starting in a new window..." -ForegroundColor Green
        Write-Host ""
        Write-Host "Open your browser to: http://localhost:8080" -ForegroundColor Cyan
    } else {
        Write-Host "[ERROR] website\serve.bat not found!" -ForegroundColor Red
        return $false
    }
    return $true
}

Show-Menu
$choice = Read-Host "Select an option (1-4)"

switch ($choice) {
    "1" { Run-Pipeline }
    "2" { Start-Website }
    "3" { 
        if (Run-Pipeline) {
            Start-Website
        }
    }
    "4" { 
        Write-Host "Goodbye!" 
        exit 
    }
    default { 
        Write-Host "Invalid selection." -ForegroundColor Red 
        exit 1
    }
}

Write-Host ""
Read-Host "Press Enter to close this window"