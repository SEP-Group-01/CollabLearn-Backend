# Document Query Service Setup Script
# Run this from CollabLearn-Backend directory

Write-Host "🚀 Document Query Service Setup" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Install Python dependencies
Write-Host "📦 Step 1: Installing Python dependencies..." -ForegroundColor Yellow
cd python\document-query-service
pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install Python dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Python dependencies installed" -ForegroundColor Green
cd ..\..

# Step 2: Check environment variables
Write-Host ""
Write-Host "🔑 Step 2: Checking environment variables..." -ForegroundColor Yellow
if (Test-Path .env) {
    $envContent = Get-Content .env -Raw
    if ($envContent -match "OPENAI_API_KEY") {
        Write-Host "✅ OPENAI_API_KEY found" -ForegroundColor Green
    } else {
        Write-Host "⚠️  OPENAI_API_KEY not found in .env" -ForegroundColor Yellow
        Write-Host "   Please add: OPENAI_API_KEY=sk-..." -ForegroundColor Yellow
    }
    
    if ($envContent -match "SUPABASE_SERVICE_KEY") {
        Write-Host "✅ SUPABASE_SERVICE_KEY found" -ForegroundColor Green
    } else {
        Write-Host "⚠️  SUPABASE_SERVICE_KEY not found in .env" -ForegroundColor Yellow
        Write-Host "   Please add: SUPABASE_SERVICE_KEY=eyJ..." -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ .env file not found" -ForegroundColor Red
    Write-Host "   Please create .env file with required keys" -ForegroundColor Yellow
}

# Step 3: Backup and replace frontend file
Write-Host ""
Write-Host "📝 Step 3: Updating frontend DocumentQuery.tsx..." -ForegroundColor Yellow
$frontendPath = "..\CollabLearn-Frontend\client\src\pages"
if (Test-Path "$frontendPath\DocumentQuery.tsx") {
    if (-not (Test-Path "$frontendPath\DocumentQuery_OLD.tsx")) {
        Copy-Item "$frontendPath\DocumentQuery.tsx" "$frontendPath\DocumentQuery_OLD.tsx"
        Write-Host "✅ Backed up original DocumentQuery.tsx" -ForegroundColor Green
    }
    
    if (Test-Path "$frontendPath\DocumentQuery_NEW.tsx") {
        Copy-Item "$frontendPath\DocumentQuery_NEW.tsx" "$frontendPath\DocumentQuery.tsx" -Force
        Write-Host "✅ Updated DocumentQuery.tsx with new implementation" -ForegroundColor Green
    } else {
        Write-Host "⚠️  DocumentQuery_NEW.tsx not found" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  Frontend path not found: $frontendPath" -ForegroundColor Yellow
}

# Step 4: Check if Kafka is running
Write-Host ""
Write-Host "🐳 Step 4: Checking Docker services..." -ForegroundColor Yellow
$kafkaRunning = docker-compose ps kafka 2>$null | Select-String "Up"
if ($kafkaRunning) {
    Write-Host "✅ Kafka is running" -ForegroundColor Green
} else {
    Write-Host "⚠️  Kafka is not running" -ForegroundColor Yellow
    Write-Host "   Starting Kafka and Zookeeper..." -ForegroundColor Yellow
    docker-compose up -d kafka zookeeper
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Kafka started successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to start Kafka" -ForegroundColor Red
    }
}

# Summary
Write-Host ""
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "✨ Setup Complete!" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Run database migration in Supabase SQL Editor" -ForegroundColor White
Write-Host "   Copy SQL from: database\Full_database_exept_editor.sql" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Start the services in separate terminals:" -ForegroundColor White
Write-Host "   Terminal 1: cd python\document-query-service\app ; uvicorn main:app --reload" -ForegroundColor Gray
Write-Host "   Terminal 2: npm run start:dev api-gateway" -ForegroundColor Gray
Write-Host "   Terminal 3: cd ..\CollabLearn-Frontend\client ; npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Navigate to:" -ForegroundColor White
Write-Host "   http://localhost:5173/workspace/{workspaceId}/threads/{threadId}/query" -ForegroundColor Gray
Write-Host ""
Write-Host "📖 For detailed instructions, see:" -ForegroundColor Yellow
Write-Host "   - SETUP_DOCUMENT_QUERY.md" -ForegroundColor Gray
Write-Host "   - DOCUMENT_QUERY_IMPLEMENTATION_GUIDE.md" -ForegroundColor Gray
Write-Host ""
