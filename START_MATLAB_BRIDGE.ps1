# ⚛️ Nuclear Plant - MATLAB Web Bridge
# This script starts your local Node.js server using the portable Node version.

Clear-Host
$ProjDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjDir

Write-Host "----------------------------------------------------" -ForegroundColor Cyan
Write-Host "⚛️  STARTING NUCLEAR PLANT WEB BRIDGE..." -ForegroundColor Cyan
Write-Host "----------------------------------------------------" -ForegroundColor Cyan

# 1. Locate Portable Node
$NodeExe = "$ProjDir\node-full\node-v20.12.2-win-x64\node.exe"

if (!(Test-Path $NodeExe)) {
    Write-Host "❌ ERROR: Portable Node.js not found at:" -ForegroundColor Red
    Write-Host "$NodeExe" -ForegroundColor Yellow
    Write-Host "Please check your project folder."
    pause
    exit
}

# 2. Check for server.js
if (!(Test-Path "$ProjDir\server.js")) {
    Write-Host "❌ ERROR: server.js not found in current folder!" -ForegroundColor Red
    pause
    exit
}

# 3. Start the Node.js Server
Write-Host "[1/2] Starting Node.js Server..." -ForegroundColor Yellow
Write-Host "System: Using portable Node at $NodeExe" -ForegroundColor Gray

# Set CLOUD_SYNC_URL so the local server knows where to push MATLAB data
$env:CLOUD_SYNC_URL = "https://nuclear-plant-sim.onrender.com"

# Start in a new window so the user can see logs
Start-Process $NodeExe -ArgumentList "server.js" -WorkingDirectory $ProjDir

Write-Host ""
Write-Host "✅ Server command sent." -ForegroundColor Green
Write-Host "✅ Website: http://localhost:3000" -ForegroundColor Green
Write-Host "✅ MATLAB: Connecting to port 3001" -ForegroundColor Green
Write-Host ""
Write-Host "----------------------------------------------------" -ForegroundColor Cyan
Write-Host "If the new window closed instantly, please tell me."
Write-Host "Otherwise, you can now run 'sahil.slx' in MATLAB."
Write-Host "----------------------------------------------------" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to close this manager window..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
