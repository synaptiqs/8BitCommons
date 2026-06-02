@echo off
REM ================================================
REM FlopSource - All-in-One Launcher
REM Double-click this from the project root to easily
REM run the data pipeline and/or start the website.
REM ================================================

setlocal

cd /d "%~dp0"

echo.
echo ================================================
echo   FlopSource - All-in-One Launcher
echo ================================================
echo.
echo 1. Run Data Pipeline only (rebuild provider data)
echo 2. Start Website Server only
echo 3. Run Pipeline, then start Website Server
echo 4. Exit
echo.

set /p choice="Select an option (1-4): "

if "%choice%"=="1" (
    call :run_pipeline
) else if "%choice%"=="2" (
    call :start_website
) else if "%choice%"=="3" (
    call :run_pipeline
    call :start_website
) else if "%choice%"=="4" (
    echo Goodbye!
    exit /b 0
) else (
    echo Invalid selection.
    pause
    exit /b 1
)

goto :eof

:run_pipeline
echo.
echo [1] Running Data Pipeline...
echo.
if exist "data-pipeline\run-pipeline.bat" (
    call "data-pipeline\run-pipeline.bat"
) else (
    echo [ERROR] data-pipeline\run-pipeline.bat not found!
    pause
    exit /b 1
)
goto :eof

:start_website
echo.
echo [2] Starting Website Server...
echo.
if exist "website\serve.bat" (
    start "FlopSource Website" cmd /k "cd /d "%~dp0website" && serve.bat"
    echo Website server is starting in a new window...
    echo.
    echo Open your browser to: http://localhost:8080
) else (
    echo [ERROR] website\serve.bat not found!
    pause
    exit /b 1
)
goto :eof

:eof
echo.
pause
exit /b 0