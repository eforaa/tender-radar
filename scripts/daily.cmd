@echo off
REM Daily refresh for Tender Radar. Wrapper so Windows Task Scheduler can run
REM the pipeline with the right working directory and keep a log.
setlocal
cd /d "%~dp0.."
if not exist "logs" mkdir "logs"
for /f "tokens=1-3 delims=/.- " %%a in ("%DATE%") do set STAMP=%%c-%%b-%%a
node scripts\daily.ts >> "logs\daily-%STAMP%.log" 2>&1
exit /b %ERRORLEVEL%
