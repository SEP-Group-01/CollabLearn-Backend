# PowerShell script to test quiz attempt endpoints
$API_BASE = "http://localhost:3000/api"
$QUIZ_ID = "699d4602-a0fa-4505-90ab-4a75af875b34"

Write-Host "🧪 Testing Quiz Attempt Backend Flow..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Test get quiz
Write-Host "1️⃣ Testing GET quiz..." -ForegroundColor Yellow
try {
    $quizResponse = Invoke-WebRequest -Uri "$API_BASE/quizzes/$QUIZ_ID" -Method GET
    $quizData = $quizResponse.Content | ConvertFrom-Json
    Write-Host "✅ Quiz fetch successful: $($quizData.title)" -ForegroundColor Green
    Write-Host "   Questions: $($quizData.questions.Count)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Quiz fetch failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Step 2: Test start quiz attempt
Write-Host "2️⃣ Testing POST start quiz attempt..." -ForegroundColor Yellow
try {
    $startResponse = Invoke-WebRequest -Uri "$API_BASE/quizzes/$QUIZ_ID/start" -Method POST -ContentType "application/json" -Body "{}"
    $startData = $startResponse.Content | ConvertFrom-Json
    Write-Host "✅ Start attempt successful" -ForegroundColor Green
    Write-Host "   Attempt ID: $($startData.attemptId)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Start attempt failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
}

Write-Host ""

# Step 3: Test get active attempt
Write-Host "3️⃣ Testing GET active attempt..." -ForegroundColor Yellow
try {
    $activeResponse = Invoke-WebRequest -Uri "$API_BASE/quizzes/$QUIZ_ID/active-attempt" -Method GET
    $activeData = $activeResponse.Content | ConvertFrom-Json
    Write-Host "✅ Get active attempt successful" -ForegroundColor Green
    Write-Host "   Attempt ID: $($activeData.attemptId)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Get active attempt failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
}

Write-Host ""

# Step 4: Test submit attempt (with dummy data)
Write-Host "4️⃣ Testing POST submit attempt..." -ForegroundColor Yellow
try {
    $submitData = @{
        attemptId = "test-attempt-id"
        answers = @(
            @{
                questionId = "0413e308-c040-4e9c-ab96-5f7f4bbabdde"
                selectedOptionIds = @("8c0bb81d-7358-4f18-af35-59754555e23d")
            }
        )
    } | ConvertTo-Json -Depth 3
    
    $submitResponse = Invoke-WebRequest -Uri "$API_BASE/quizzes/$QUIZ_ID/attempts" -Method POST -ContentType "application/json" -Body $submitData
    Write-Host "✅ Submit attempt successful" -ForegroundColor Green
} catch {
    Write-Host "❌ Submit attempt failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
}

Write-Host ""
Write-Host "🔍 Test completed. Check the results above." -ForegroundColor Cyan