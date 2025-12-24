@echo off
setlocal
cd /d "%~dp0.."
set OUT=%CD%\probe-servers.txt
del "%OUT%" 2>nul
echo === Probe servers %DATE% %TIME% > "%OUT%"
echo Affiliate 127.0.0.1:3001 >> "%OUT%"
curl --max-time 5 -sS -i "http://127.0.0.1:3001/" >> "%OUT%" 2>&1 || echo curl_failed_3001 >> "%OUT%"
echo. >> "%OUT%"
echo Webapp 127.0.0.1:3000 >> "%OUT%"
curl --max-time 5 -sS -i "http://127.0.0.1:3000/" >> "%OUT%" 2>&1 || echo curl_failed_3000 >> "%OUT%"
echo. >> "%OUT%"
type "%OUT%"
endlocal
