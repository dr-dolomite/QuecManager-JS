# Test script for websocat bandwidth monitoring server
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

Write-Host ""
Write-Host "3. Connection summary:" -ForegroundColor Yellow

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
Write-Host "Your websocat server is running and accepting connections." -ForegroundColor Green
Write-Host ""
Write-Host "To send bandwidth data to your websocat server, use:" -ForegroundColor Yellow
Write-Host 'echo ''{"downloadSpeed": 1048576, "uploadSpeed": 262144, "timestamp": "2025-09-24T12:00:00.000Z"}'' | websocat ws://192.168.224.1:8838' -ForegroundColor Cyan
Write-Host "Or:" -ForegroundColor Yellow  
Write-Host 'echo "download:1048576,upload:262144" | websocat ws://192.168.224.1:8838' -ForegroundColor Cyan