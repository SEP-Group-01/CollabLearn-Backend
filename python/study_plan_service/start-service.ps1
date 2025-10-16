# PowerShell script to start the Study Plan Service
# This script ensures the service runs from the correct directory

Write-Host "Starting Study Plan Service..." -ForegroundColor Green
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 59) -ForegroundColor Cyan

# Navigate to the src directory
Set-Location -Path "$PSScriptRoot\src"

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& "$PSScriptRoot\.venv\Scripts\Activate.ps1"

# Run uvicorn from src directory (this fixes the import issue)
Write-Host "Starting uvicorn server..." -ForegroundColor Yellow
Write-Host "Service will be available at: http://localhost:8000" -ForegroundColor Green
Write-Host "Health check at: http://localhost:8000/health" -ForegroundColor Green
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 59) -ForegroundColor Cyan
Write-Host ""

uvicorn app:app --host 0.0.0.0 --port 8000 --reload
