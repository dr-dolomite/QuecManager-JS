# Test script to send bandwidth data to websocat server
# This script sends sample bandwidth data in bytes/sec format
# The client should convert it to bits/sec for display

Write-Host "Sending test bandwidth data to websocat server..." -ForegroundColor Green
Write-Host "Data will be sent in bytes/sec and converted to bits/sec by client" -ForegroundColor Yellow
Write-Host ""

# Sample data points (bytes per second)
$testData = @(
    @{ download = 1048576; upload = 262144 },    # 1 MB/s down, 256 KB/s up = 8 Mbps down, 2 Mbps up
    @{ download = 2097152; upload = 524288 },    # 2 MB/s down, 512 KB/s up = 16 Mbps down, 4 Mbps up
    @{ download = 5242880; upload = 1048576 },   # 5 MB/s down, 1 MB/s up = 40 Mbps down, 8 Mbps up
    @{ download = 10485760; upload = 2097152 }   # 10 MB/s down, 2 MB/s up = 80 Mbps down, 16 Mbps up
)

Write-Host "Test data (bytes/sec -> expected bits/sec):" -ForegroundColor Cyan
foreach ($data in $testData) {
    $downBits = $data.download * 8
    $upBits = $data.upload * 8
    Write-Host "  Download: $($data.download) bytes/sec -> $($downBits) bits/sec ($($downBits/1000000) Mbps)" -ForegroundColor White
    Write-Host "  Upload:   $($data.upload) bytes/sec -> $($upBits) bits/sec ($($upBits/1000000) Mbps)" -ForegroundColor White
    Write-Host ""
}

# Check if websocat is available
$websocat = Get-Command websocat -ErrorAction SilentlyContinue
if (-not $websocat) {
    Write-Host "websocat not found in PATH. Please install it first." -ForegroundColor Red
    exit 1
}

# Test server connectivity
Write-Host "Testing connection to websocat server..." -ForegroundColor Yellow
$connection = Test-NetConnection -ComputerName 192.168.224.1 -Port 8838 -InformationLevel Quiet
if (-not $connection) {
    Write-Host "Cannot connect to websocat server at 192.168.224.1:8838" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Server is reachable" -ForegroundColor Green

# Send test data
Write-Host ""
Write-Host "Sending test data points..." -ForegroundColor Yellow

foreach ($data in $testData) {
    $timestamp = [datetime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    $jsonData = @{
        download = $data.download
        upload = $data.upload
        timestamp = $timestamp
    } | ConvertTo-Json -Compress

    Write-Host "Sending: $jsonData" -ForegroundColor Cyan
    
    try {
        $jsonData | websocat ws://192.168.224.1:8838 --one-message
        Write-Host "✓ Sent successfully" -ForegroundColor Green
    } catch {
        Write-Host "✗ Failed to send: $_" -ForegroundColor Red
    }
    
    # Wait between sends
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "Test data sent! Check your dashboard to see the converted values." -ForegroundColor Green
Write-Host "Expected conversions:" -ForegroundColor Yellow
Write-Host "  1 MB/s = 8 Mbps" -ForegroundColor White
Write-Host "  2 MB/s = 16 Mbps" -ForegroundColor White  
Write-Host "  5 MB/s = 40 Mbps" -ForegroundColor White
Write-Host "  10 MB/s = 80 Mbps" -ForegroundColor White