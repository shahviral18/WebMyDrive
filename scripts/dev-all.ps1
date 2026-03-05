#!/usr/bin/env pwsh
# Combined development environment starter
# Starts:
# 1. PHP backend on port 4000
# 2. Admin console (Vite) on port 6173
# 3. Cloud-Plan-Manager on port 3000

Write-Host "🚀 Starting WebMyDrive Full Development Environment..." -ForegroundColor Cyan
Write-Host ""

# Get the project directories
$adminConsoleDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$cloudPlanManagerDir = "C:\Users\admin\Downloads\Cloud-Plan-Manager\Cloud-Plan-Manager"

# Verify directories exist
if (-not (Test-Path $adminConsoleDir)) {
    Write-Host "❌ Admin console directory not found: $adminConsoleDir" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $cloudPlanManagerDir)) {
    Write-Host "❌ Cloud-Plan-Manager directory not found: $cloudPlanManagerDir" -ForegroundColor Red
    exit 1
}

Write-Host "📁 Admin Console: $adminConsoleDir" -ForegroundColor Yellow
Write-Host "📁 Cloud-Plan-Manager: $cloudPlanManagerDir" -ForegroundColor Yellow
Write-Host ""

# Array to store job IDs
$jobs = @()

# Start PHP Backend
Write-Host "Starting PHP Backend on port 4000..." -ForegroundColor Cyan
$phpJob = Start-Job -ScriptBlock {
    Set-Location "$using:adminConsoleDir"
    npm run backend:start
}
$jobs += $phpJob
Write-Host "✓ PHP Backend started (Job ID: $($phpJob.Id))" -ForegroundColor Green
Write-Host ""

# Wait a bit for PHP backend to start
Start-Sleep -Seconds 2

# Start Admin Console (Vite)
Write-Host "Starting Admin Console on port 6173..." -ForegroundColor Cyan
$adminJob = Start-Job -ScriptBlock {
    Set-Location "$using:adminConsoleDir"
    npm run dev
}
$jobs += $adminJob
Write-Host "✓ Admin Console started (Job ID: $($adminJob.Id))" -ForegroundColor Green
Write-Host ""

# Wait a bit for admin console to start
Start-Sleep -Seconds 2

# Start Cloud-Plan-Manager
Write-Host "Starting Cloud-Plan-Manager on port 5000..." -ForegroundColor Cyan
$cloudJob = Start-Job -ScriptBlock {
    Set-Location "$using:cloudPlanManagerDir"
    $env:PORT="5000"
    npm run dev
}
$jobs += $cloudJob
Write-Host "✓ Cloud-Plan-Manager started (Job ID: $($cloudJob.Id))" -ForegroundColor Green
Write-Host ""

Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "🎉 All Services Running!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Admin Console:       http://localhost:6173/" -ForegroundColor Cyan
Write-Host "🛒 Cloud-Plan-Manager: http://localhost:5000/" -ForegroundColor Cyan
Write-Host "🔌 PHP Backend:        http://localhost:4000/" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host ""

# Keep parent process alive
Get-Job | Wait-Job
