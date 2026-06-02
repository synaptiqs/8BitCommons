<#
.SYNOPSIS
    One-time setup for automatic data refresh every 10 minutes.

.DESCRIPTION
    Creates a Windows Task Scheduler job named "FlopSource-DataRefresh"
    that runs refresh-data.ps1 every 10 minutes.

    Run this script once as Administrator.
#>

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$refreshScript = Join-Path $scriptDir "refresh-data.ps1"

if (-not (Test-Path $refreshScript)) {
    Write-Error "refresh-data.ps1 not found next to this script."
    exit 1
}

$taskName = "FlopSource-DataRefresh"

# Remove existing task if it exists
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Removing existing task '$taskName'..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Create the action
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$refreshScript`"" `
    -WorkingDirectory $scriptDir

# Trigger every 10 minutes
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 10) -RepetitionDuration ([TimeSpan]::MaxValue)

# Settings: Run whether user is logged on or not, hidden, etc.
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 15)

# Principal - run as current user (or SYSTEM if you prefer)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest

# Register the task
Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Refreshes FlopSource provider data every 10 minutes" | Out-Null

Write-Host ""
Write-Host "✅ Scheduled task '$taskName' created successfully!" -ForegroundColor Green
Write-Host "   It will run every 10 minutes."
Write-Host ""
Write-Host "To manage it:"
Write-Host "  - Open Task Scheduler (taskschd.msc)"
Write-Host "  - Look under Task Scheduler Library for '$taskName'"
Write-Host ""
Write-Host "Logs are written to: $scriptDir\refresh-log.txt"
Write-Host ""
