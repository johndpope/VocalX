@echo off
setlocal

powershell -NoProfile -Command "$ports=@(3000,3001); foreach($p in $ports){ try { $conns = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue; foreach($c in ($conns | Select-Object -Unique OwningProcess)) { if ($null -ne $c.OwningProcess -and $c.OwningProcess -gt 0) { Write-Host ('Killing PID ' + $c.OwningProcess + ' on :' + $p); Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue } } } catch {} }"

endlocal
