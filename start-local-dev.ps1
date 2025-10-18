# Run Document Query Service Locally (No Docker Issues)
# This script runs everything you need without Docker build problems

Write-Host "🚀 Starting Document Query Service (Local Mode)" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Python is installed
Write-Host "📋 Checking prerequisites..." -ForegroundColor Yellow
$pythonVersion = python --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Python not found. Please install Python 3.9+" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Python: $pythonVersion" -ForegroundColor Green

# Check if Node is installed
$nodeVersion = node --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Node.js not found. Please install Node.js" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green

# Install Python dependencies
Write-Host ""
Write-Host "📦 Installing Python dependencies..." -ForegroundColor Yellow
Set-Location -Path "python\document-query-service"
pip install -r requirements.txt -q
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install Python dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Python dependencies installed" -ForegroundColor Green
Set-Location -Path "..\..\"

# Check environment variables
Write-Host ""
Write-Host "🔑 Checking environment variables..." -ForegroundColor Yellow
$envPath = ".env"
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
    
    $hasOpenAI = $envContent -match "OPENAI_API_KEY"
    $hasSupabase = $envContent -match "SUPABASE_SERVICE_KEY"
    
    if ($hasOpenAI) {
        Write-Host "✅ OPENAI_API_KEY found" -ForegroundColor Green
    } else {
        Write-Host "⚠️  OPENAI_API_KEY not found in .env" -ForegroundColor Yellow
    }
    
    if ($hasSupabase) {
        Write-Host "✅ SUPABASE_SERVICE_KEY found" -ForegroundColor Green
    } else {
        Write-Host "⚠️  SUPABASE_SERVICE_KEY not found in .env" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  .env file not found" -ForegroundColor Yellow
}

# Start Kafka with Docker
Write-Host ""
Write-Host "🐳 Starting Kafka (Docker)..." -ForegroundColor Yellow
docker-compose up -d kafka zookeeper 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Kafka started" -ForegroundColor Green
    Write-Host "⏳ Waiting for Kafka to be ready (15 seconds)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 15
} else {
    Write-Host "⚠️  Kafka may already be running or Docker not available" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "✅ Setup Complete! Now starting services..." -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📝 Opening 4 terminal windows..." -ForegroundColor Yellow
Write-Host ""

# Terminal 1: Python Document Query Service
Write-Host "Terminal 1: Python Document Query Service (Port 8000)" -ForegroundColor Cyan
$pythonScript = @"
Write-Host '🐍 Starting Python Document Query Service...' -ForegroundColor Green
Write-Host '================================================' -ForegroundColor Green
Write-Host ''
Set-Location -Path 'python\document-query-service\app'
`$env:KAFKA_BROKERS='localhost:9093'
Write-Host '✅ Service starting on http://localhost:8000' -ForegroundColor Green
Write-Host '✅ Health check: http://localhost:8000/health' -ForegroundColor Green
Write-Host ''
uvicorn main:app --reload --host 0.0.0.0 --port 8000
"@
$pythonScriptPath = "$env:TEMP\start-python-service.ps1"
$pythonScript | Out-File -FilePath $pythonScriptPath -Encoding UTF8
Start-Process powershell -ArgumentList "-NoExit", "-File", $pythonScriptPath

Start-Sleep -Seconds 2

# Terminal 2: API Gateway
Write-Host "Terminal 2: API Gateway (Port 3000)" -ForegroundColor Cyan
$gatewayScript = @"
Write-Host '🌐 Starting API Gateway...' -ForegroundColor Green
Write-Host '===========================' -ForegroundColor Green
Write-Host ''
Set-Location -Path '.'
Write-Host '✅ API Gateway starting on http://localhost:3000' -ForegroundColor Green
Write-Host ''
npm run start:dev api-gateway
"@
$gatewayScriptPath = "$env:TEMP\start-api-gateway.ps1"
$gatewayScript | Out-File -FilePath $gatewayScriptPath -Encoding UTF8
Start-Process powershell -ArgumentList "-NoExit", "-File", $gatewayScriptPath

Start-Sleep -Seconds 2

# Terminal 3: Frontend
Write-Host "Terminal 3: Frontend (Port 5173)" -ForegroundColor Cyan
$frontendScript = @"
Write-Host '⚛️  Starting Frontend...' -ForegroundColor Green
Write-Host '========================' -ForegroundColor Green
Write-Host ''
Set-Location -Path '..\CollabLearn-Frontend\client'
Write-Host '✅ Frontend starting on http://localhost:5173' -ForegroundColor Green
Write-Host ''
npm run dev
"@
$frontendScriptPath = "$env:TEMP\start-frontend.ps1"
$frontendScript | Out-File -FilePath $frontendScriptPath -Encoding UTF8
Start-Process powershell -ArgumentList "-NoExit", "-File", $frontendScriptPath

Start-Sleep -Seconds 2

# Terminal 4: Logs Monitor
Write-Host "Terminal 4: Service Monitor" -ForegroundColor Cyan
$monitorScript = @"
Write-Host '📊 Service Monitor' -ForegroundColor Green
Write-Host '==================' -ForegroundColor Green
Write-Host ''
Write-Host 'Waiting for services to start (30 seconds)...' -ForegroundColor Yellow
Start-Sleep -Seconds 30

Write-Host ''
Write-Host '🔍 Checking service health...' -ForegroundColor Cyan
Write-Host ''

# Check Python service
try {
    `$response = Invoke-WebRequest -Uri 'http://localhost:8000/health' -TimeoutSec 5 -UseBasicParsing
    Write-Host '✅ Python Service: HEALTHY' -ForegroundColor Green
} catch {
    Write-Host '❌ Python Service: NOT RESPONDING' -ForegroundColor Red
    Write-Host '   Check Terminal 1 for errors' -ForegroundColor Yellow
}

# Check API Gateway
try {
    `$response = Invoke-WebRequest -Uri 'http://localhost:3000/health' -TimeoutSec 5 -UseBasicParsing
    Write-Host '✅ API Gateway: HEALTHY' -ForegroundColor Green
} catch {
    Write-Host '⚠️  API Gateway: NOT RESPONDING (may not have /health endpoint)' -ForegroundColor Yellow
}

# Check Frontend
try {
    `$response = Invoke-WebRequest -Uri 'http://localhost:5173' -TimeoutSec 5 -UseBasicParsing
    Write-Host '✅ Frontend: HEALTHY' -ForegroundColor Green
} catch {
    Write-Host '❌ Frontend: NOT RESPONDING' -ForegroundColor Red
    Write-Host '   Check Terminal 3 for errors' -ForegroundColor Yellow
}

Write-Host ''
Write-Host '======================================' -ForegroundColor Cyan
Write-Host '✨ All Services Status Check Complete' -ForegroundColor Cyan
Write-Host '======================================' -ForegroundColor Cyan
Write-Host ''
Write-Host '📖 Access Points:' -ForegroundColor Yellow
Write-Host '   • Frontend: http://localhost:5173' -ForegroundColor White
Write-Host '   • API Gateway: http://localhost:3000' -ForegroundColor White
Write-Host '   • Python Service: http://localhost:8000' -ForegroundColor White
Write-Host '   • Kafka: localhost:9093' -ForegroundColor White
Write-Host ''
Write-Host '📚 To test document query:' -ForegroundColor Yellow
Write-Host '   Navigate to: http://localhost:5173/workspace/{workspaceId}/threads/{threadId}/query' -ForegroundColor Gray
Write-Host ''
Write-Host 'Press any key to close this monitor window...' -ForegroundColor Gray
`$null = `$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
"@
$monitorScriptPath = "$env:TEMP\service-monitor.ps1"
$monitorScript | Out-File -FilePath $monitorScriptPath -Encoding UTF8
Start-Process powershell -ArgumentList "-NoExit", "-File", $monitorScriptPath

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "🎉 All services are starting in separate windows!" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Services:" -ForegroundColor Yellow
Write-Host "   1. Python Document Query Service (Port 8000)" -ForegroundColor White
Write-Host "   2. API Gateway (Port 3000)" -ForegroundColor White
Write-Host "   3. Frontend (Port 5173)" -ForegroundColor White
Write-Host "   4. Service Monitor" -ForegroundColor White
Write-Host ""
Write-Host "⏳ Services will be ready in about 30-60 seconds" -ForegroundColor Yellow
Write-Host ""
Write-Host "🌐 Access the application:" -ForegroundColor Yellow
Write-Host "   http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Yellow
Write-Host "   • SETUP_DOCUMENT_QUERY.md" -ForegroundColor Gray
Write-Host "   • DOCKER_BUILD_TROUBLESHOOTING.md" -ForegroundColor Gray
Write-Host "   • QUICK_REFERENCE.md" -ForegroundColor Gray
Write-Host ""
Write-Host "💡 Tip: If any service fails, check its terminal window for errors" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to close this launcher window..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
