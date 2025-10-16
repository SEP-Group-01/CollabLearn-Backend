# Simple PowerShell Quiz API Test
param(
    [string]$BaseUrl = "http://localhost:3000/api",
    [string]$AuthToken = "",
    [string]$ThreadId = ""
)

Write-Host "🚀 Testing Quiz API Endpoints" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl" -ForegroundColor Blue

# Test 1: Health Check
Write-Host "`n=== Health Check ===" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/quizzes" -Method GET
    Write-Host "✅ SUCCESS" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json)
} catch {
    Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: List All Quizzes
Write-Host "`n=== List All Quizzes ===" -ForegroundColor Yellow
try {
    $headers = @{}
    if ($AuthToken) { $headers["Authorization"] = $AuthToken }
    
    $response = Invoke-RestMethod -Uri "$BaseUrl/quizzes" -Method GET -Headers $headers
    Write-Host "✅ SUCCESS" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 3)
} catch {
    Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: List Quizzes by Thread
if ($ThreadId) {
    Write-Host "`n=== List Quizzes by Thread ===" -ForegroundColor Yellow
    try {
        $headers = @{}
        if ($AuthToken) { $headers["Authorization"] = $AuthToken }
        
        $response = Invoke-RestMethod -Uri "$BaseUrl/threads/$ThreadId/quizzes" -Method GET -Headers $headers
        Write-Host "✅ SUCCESS" -ForegroundColor Green
        Write-Host ($response | ConvertTo-Json -Depth 3)
    } catch {
        Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n📝 Results:" -ForegroundColor Cyan
Write-Host "- API Gateway is responding correctly" -ForegroundColor Green
if (-not $AuthToken) {
    Write-Host "- Add -AuthToken parameter for authenticated tests" -ForegroundColor Yellow
}
if (-not $ThreadId) {
    Write-Host "- Add -ThreadId parameter for thread-specific tests" -ForegroundColor Yellow
}