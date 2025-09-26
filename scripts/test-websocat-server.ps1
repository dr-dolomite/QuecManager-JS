# Test script for websocat bandwidth monitoring server
# This script tests the websocat server: websocat -t ws-l:0.0.0.0:8838 log:broadcast:mirror:

Write-Host "Testing websocat bandwidth monitoring server..." -ForegroundColor Green
Write-Host "Server command: websocat -t ws-l:0.0.0.0:8838 log:broadcast:mirror:" -ForegroundColor Cyan
Write-Host ""

# Test basic connectivity first
Write-Host "1. Testing basic connectivity to 192.168.224.1..." -ForegroundColor Yellow
$ping = Test-Connection -ComputerName 192.168.224.1 -Count 1 -Quiet
if ($ping) {
    Write-Host "   ✓ Host is reachable" -ForegroundColor Green
}
else {
    Write-Host "   ✗ Host is not reachable" -ForegroundColor Red
    exit 1
}

# Test port connectivity
Write-Host "2. Testing port 8838..." -ForegroundColor Yellow
$portTest = Test-NetConnection -ComputerName 192.168.224.1 -Port 8838 -InformationLevel Quiet
if ($portTest) {
    Write-Host "   ✓ Port 8838 is open and accepting connections" -ForegroundColor Green
}
else {
    Write-Host "   ✗ Port 8838 is not accessible" -ForegroundColor Red
    exit 1
}

# Check for websocat
Write-Host "3. Checking for websocat..." -ForegroundColor Yellow
$websocat = Get-Command websocat -ErrorAction SilentlyContinue
if (-not $websocat) {
    Write-Host "   ⚠ websocat not found in PATH" -ForegroundColor Yellow
    Write-Host "   Trying to find websocat.exe in current directory..." -ForegroundColor Yellow
    
    if (Test-Path "websocat.exe") {
        $websocat = ".\websocat.exe"
        Write-Host "   ✓ Found websocat.exe in current directory" -ForegroundColor Green
    }
    else {
        Write-Host "   Please download websocat from:" -ForegroundColor Red
        Write-Host "   https://github.com/vi/websocat/releases" -ForegroundColor Yellow
        Write-Host "   Or run in bash: sudo apt install websocat" -ForegroundColor Yellow
        exit 1
    }
}
else {
    Write-Host "   ✓ websocat found at $($websocat.Source)" -ForegroundColor Green
}

# Test WebSocket connection
Write-Host "4. Testing WebSocket connection..." -ForegroundColor Yellow
Write-Host "   Connecting to ws://192.168.224.1:8838" -ForegroundColor Cyan

try {
    # Create a simple test with timeout
    $job = Start-Job -ScriptBlock {
        param($websocatPath)
        try {
            # Test connection and send a simple message
            $process = Start-Process -FilePath $websocatPath -ArgumentList "ws://192.168.224.1:8838" -PassThru -NoNewWindow -RedirectStandardInput "test-input.txt" -RedirectStandardOutput "test-output.txt" -RedirectStandardError "test-error.txt"
            
            # Send test data
            "ping" | Out-File -FilePath "test-input.txt" -Encoding ASCII
            Start-Sleep -Seconds 3
            
            if (-not $process.HasExited) {
                $process.Kill()
                return "Connected successfully, killed after 3 seconds"
            }
            else {
                $exitCode = $process.ExitCode
                return "Process exited with code: $exitCode"
            }
        }
        catch {
            return "Error: $_"
        }
    } -ArgumentList $websocat

    $result = Wait-Job $job -Timeout 10 | Receive-Job
    Remove-Job $job -Force
    
    Write-Host "   Result: $result" -ForegroundColor Green
    
    # Check if any output files were created
    if (Test-Path "test-output.txt") {
        $output = Get-Content "test-output.txt" -Raw
        if ($output) {
            Write-Host "   Output received: $output" -ForegroundColor Green
        }
        Remove-Item "test-output.txt" -ErrorAction SilentlyContinue
    }
    
    if (Test-Path "test-error.txt") {
        $errors = Get-Content "test-error.txt" -Raw
        if ($errors) {
            Write-Host "   Errors: $errors" -ForegroundColor Yellow
        }
        Remove-Item "test-error.txt" -ErrorAction SilentlyContinue
    }
    
    # Cleanup
    Remove-Item "test-input.txt" -ErrorAction SilentlyContinue

}
catch {
    Write-Host "   Error testing WebSocket: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "5. Connection summary:" -ForegroundColor Yellow

# Show existing connections to the server
$connections = netstat -an | findstr "192.168.224.1:8838"
if ($connections) {
    Write-Host "   Active connections to websocat server:" -ForegroundColor Cyan
    $connections | ForEach-Object { Write-Host "   $_" -ForegroundColor White }
}
else {
    Write-Host "   No active connections to websocat server" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Test complete!" -ForegroundColor Green
Write-Host ""
Write-Host "To send bandwidth data to your websocat server, use:" -ForegroundColor Yellow
$timestamp = [datetime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
Write-Host "  echo '{`"downloadSpeed`": 1048576, `"uploadSpeed`": 262144, `"timestamp`": `"$timestamp`"}' | websocat ws://192.168.224.1:8838" -ForegroundColor Cyan
Write-Host "Or:" -ForegroundColor Yellow  
Write-Host '  echo "download:1048576,upload:262144" | websocat ws://192.168.224.1:8838' -ForegroundColor Cyan