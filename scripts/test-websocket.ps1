# Test WebSocket connection using PowerShell and websocat
Write-Host "Testing WebSocket connection to ws://192.168.224.1:8838/bandwidth-monitor" -ForegroundColor Green
Write-Host "This will show WebSocket close codes and reasons..." -ForegroundColor Yellow
Write-Host ""

# Check if websocat is available
$websocat = Get-Command websocat -ErrorAction SilentlyContinue
if (-not $websocat) {
    Write-Host "websocat not found. Please install it first:" -ForegroundColor Red
    Write-Host "Download from: https://github.com/vi/websocat/releases" -ForegroundColor Yellow
    exit 1
}

# Test basic connectivity first
Write-Host "Testing basic connectivity to 192.168.224.1..." -ForegroundColor Cyan
$ping = Test-Connection -ComputerName 192.168.224.1 -Count 1 -Quiet
if ($ping) {
    Write-Host "✓ Host is reachable" -ForegroundColor Green
}
else {
    Write-Host "✗ Host is not reachable" -ForegroundColor Red
    exit 1
}

# Test WebSocket connection
Write-Host "Testing WebSocket connection..." -ForegroundColor Cyan
$startTime = Get-Date

try {
    # Connect to WebSocket and send a test message
    $process = Start-Process -FilePath "websocat" -ArgumentList "-v", "ws://192.168.224.1:8838/bandwidth-monitor" -PassThru -NoNewWindow -RedirectStandardOutput "websocket-test.log" -RedirectStandardError "websocket-error.log"
    
    Write-Host "WebSocket connection started (PID: $($process.Id))" -ForegroundColor Green
    Write-Host "Press Ctrl+C to stop the test..." -ForegroundColor Yellow
    
    # Wait for process and monitor logs
    while (-not $process.HasExited) {
        Start-Sleep -Milliseconds 500
        
        # Check if log files exist and show recent content
        if (Test-Path "websocket-test.log") {
            $content = Get-Content "websocket-test.log" -Tail 5 -ErrorAction SilentlyContinue
            if ($content) {
                $content | ForEach-Object { Write-Host "[LOG] $_" -ForegroundColor White }
            }
        }
        
        if (Test-Path "websocket-error.log") {
            $errorContent = Get-Content "websocket-error.log" -Tail 5 -ErrorAction SilentlyContinue  
            if ($errorContent) {
                $errorContent | ForEach-Object { Write-Host "[ERROR] $_" -ForegroundColor Red }
            }
        }
    }
    
    $endTime = Get-Date
    $duration = $endTime - $startTime
    Write-Host "Connection lasted: $($duration.TotalSeconds) seconds" -ForegroundColor Cyan
    Write-Host "Process exit code: $($process.ExitCode)" -ForegroundColor Cyan
    
}
catch {
    Write-Host "Error testing WebSocket: $_" -ForegroundColor Red
}
finally {
    # Cleanup log files
    if (Test-Path "websocket-test.log") { Remove-Item "websocket-test.log" -ErrorAction SilentlyContinue }
    if (Test-Path "websocket-error.log") { Remove-Item "websocket-error.log" -ErrorAction SilentlyContinue }
}