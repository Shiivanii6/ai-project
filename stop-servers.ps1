foreach ($port in 3000, 8000) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object {
            Write-Host "Stopping PID $($_.OwningProcess) on port $port"
            Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
        }
}
Start-Sleep -Seconds 2
