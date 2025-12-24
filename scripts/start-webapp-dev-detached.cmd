@echo off
setlocal
cd /d "%~dp0.."

call "%CD%\scripts\free-ports-3000-3001.cmd"

REM Avoid stale/corrupted Next.js artifacts causing runtime errors
if exist "%CD%\apps\webapp\.next" (
	rmdir /s /q "%CD%\apps\webapp\.next"
)

set LOG_OUT=%CD%\webapp-dev-task.out.log
set LOG_ERR=%CD%\webapp-dev-task.err.log
del "%LOG_OUT%" 2>nul
del "%LOG_ERR%" 2>nul
type nul > "%LOG_OUT%"
type nul > "%LOG_ERR%"

powershell -NoProfile -Command "$env:USE_MEMORY_MONGO=$null; $env:MONGO_URL='mongodb://127.0.0.1:27017'; $env:MONGO_DB_NAME='vocalx_webapp'; $env:NEXTAUTH_URL='http://localhost:3001'; $env:NEXTAUTH_SECRET='dev_secret_change_me'; $env:STRIPE_SECRET_KEY='sk_test_dummy'; $env:STRIPE_WEBHOOK_SECRET='whsec_dummy'; $p = Start-Process -FilePath 'C:\Program Files\nodejs\npm.cmd' -ArgumentList 'run -w apps/webapp dev -- -p 3001' -WorkingDirectory (Get-Location) -RedirectStandardOutput '%LOG_OUT%' -RedirectStandardError '%LOG_ERR%' -NoNewWindow -PassThru; Write-Host ('Started webapp dev pid=' + $p.Id)"

endlocal
