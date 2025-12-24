@echo off
setlocal
cd /d "%~dp0.."

echo Starting webapp dev...
call scripts\start-webapp-dev-detached.cmd

echo.
echo Open in browser:
echo   Webapp:    http://localhost:3001
echo.
echo Logs:
echo   webapp-dev-task.out.log    / webapp-dev-task.err.log

endlocal
