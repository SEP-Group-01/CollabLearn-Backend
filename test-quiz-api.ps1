# PowerShell script to test Quiz API endpoints
param(
    [string]$BaseUrl = "http://localhost:3000/api",
    [string]$AuthToken = "",
    [string]$ThreadId = "",
    [string]$UserId = ""
)

function Write-TestResult {
    param($TestName, $Success, $Response, $Error)
    
    Write-Host "`n=== $TestName ===" -ForegroundColor Yellow
    
    if ($Success) {
        Write-Host "✅ SUCCESS" -ForegroundColor Green
        if ($Response) {
            Write-Host "Response:" -ForegroundColor Cyan
            $Response | ConvertTo-Json -Depth 4
        }
    } else {
        Write-Host "❌ FAILED" -ForegroundColor Red
        Write-Host "Error: $Error" -ForegroundColor Red
    }
}

function Test-Endpoint {
    param($Method, $Endpoint, $Body = $null, $Headers = @{})
    
    try {
        $uri = "$BaseUrl$Endpoint"
        Write-Host "Testing: $Method $uri" -ForegroundColor Blue
        
        $params = @{
            Uri = $uri
            Method = $Method
            Headers = $Headers
            ContentType = "application/json"
        }
        
        if ($Body) {
            $params.Body = $Body | ConvertTo-Json -Depth 4
        }
        
        $response = Invoke-RestMethod @params
        return @{ Success = $true; Response = $response }
    }
    catch {
        return @{ Success = $false; Error = $_.Exception.Message }
    }
}

# Main testing function
function Test-QuizAPI {
    Write-Host "🚀 Starting Quiz API Tests" -ForegroundColor Cyan
    Write-Host "Base URL: $BaseUrl" -ForegroundColor Cyan
    
    $headers = @{}
    if ($AuthToken) {
        $headers["Authorization"] = $AuthToken
    }
    
    # Test 1: Health Check
    $result = Test-Endpoint -Method "GET" -Endpoint "/quizzes"
    Write-TestResult -TestName "Health Check" -Success $result.Success -Response $result.Response -Error $result.Error
    
    # Test 2: List All Quizzes
    $result = Test-Endpoint -Method "GET" -Endpoint "/quizzes" -Headers $headers
    Write-TestResult -TestName "List All Quizzes" -Success $result.Success -Response $result.Response -Error $result.Error
    
    # Test 3: List Quizzes by Thread (if ThreadId provided)
    if ($ThreadId) {
        $result = Test-Endpoint -Method "GET" -Endpoint "/threads/$ThreadId/quizzes" -Headers $headers
        Write-TestResult -TestName "List Quizzes by Thread" -Success $result.Success -Response $result.Response -Error $result.Error
    } else {
        Write-Host "`n=== List Quizzes by Thread ===" -ForegroundColor Yellow
        Write-Host "⏭️  SKIPPED - No ThreadId provided" -ForegroundColor Yellow
    }
    
    # Test 4: Create Quiz (if ThreadId and AuthToken provided)
    if ($ThreadId -and $AuthToken) {
        $quizData = @{
            title = "PowerShell Test Quiz"
            description = "Created via PowerShell testing script"
            timeAllocated = 30
            questions = @(
                @{
                    questionText = "What is PowerShell?"
                    marks = 10
                    options = @(
                        @{ text = "A scripting language"; isCorrect = $true }
                        @{ text = "A web browser"; isCorrect = $false }
                        @{ text = "A database"; isCorrect = $false }
                        @{ text = "An operating system"; isCorrect = $false }
                    )
                }
            )
            tags = @("powershell", "test")
            resourceTags = @("api-test")
        }
        
        $result = Test-Endpoint -Method "POST" -Endpoint "/threads/$ThreadId/quizzes/create" -Body $quizData -Headers $headers
        Write-TestResult -TestName "Create Quiz" -Success $result.Success -Response $result.Response -Error $result.Error
        
        # If quiz creation succeeded, store the quiz ID for further tests
        if ($result.Success -and $result.Response.quizId) {
            $script:CreatedQuizId = $result.Response.quizId
            Write-Host "Created Quiz ID: $script:CreatedQuizId" -ForegroundColor Green
        }
    } else {
        Write-Host "`n=== Create Quiz ===" -ForegroundColor Yellow
        Write-Host "⏭️  SKIPPED - ThreadId and AuthToken required" -ForegroundColor Yellow
    }
    
    # Test 5: Get Quiz by ID (if we have a quiz ID)
    if ($script:CreatedQuizId) {
        $result = Test-Endpoint -Method "GET" -Endpoint "/quizzes/$script:CreatedQuizId" -Headers $headers
        Write-TestResult -TestName "Get Quiz by ID" -Success $result.Success -Response $result.Response -Error $result.Error
    } else {
        Write-Host "`n=== Get Quiz by ID ===" -ForegroundColor Yellow
        Write-Host "⏭️  SKIPPED - No quiz ID available" -ForegroundColor Yellow
    }
    
    # Test 6: Start Quiz (if we have quiz ID and auth token)
    if ($script:CreatedQuizId -and $AuthToken) {
        $startData = @{ workspaceId = "test-workspace" }
        $result = Test-Endpoint -Method "POST" -Endpoint "/quizzes/$script:CreatedQuizId/start" -Body $startData -Headers $headers
        Write-TestResult -TestName "Start Quiz" -Success $result.Success -Response $result.Response -Error $result.Error
        
        if ($result.Success -and $result.Response.attemptId) {
            $script:AttemptId = $result.Response.attemptId
            Write-Host "Created Attempt ID: $script:AttemptId" -ForegroundColor Green
        }
    } else {
        Write-Host "`n=== Start Quiz ===" -ForegroundColor Yellow
        Write-Host "⏭️  SKIPPED - Quiz ID and AuthToken required" -ForegroundColor Yellow
    }
    
    # Test 7: Get Active Attempt
    if ($script:CreatedQuizId -and $AuthToken) {
        $result = Test-Endpoint -Method "GET" -Endpoint "/quizzes/$script:CreatedQuizId/active-attempt" -Headers $headers
        Write-TestResult -TestName "Get Active Attempt" -Success $result.Success -Response $result.Response -Error $result.Error
    } else {
        Write-Host "`n=== Get Active Attempt ===" -ForegroundColor Yellow
        Write-Host "⏭️  SKIPPED - Quiz ID and AuthToken required" -ForegroundColor Yellow
    }
    
    Write-Host "`n🎯 Test Summary:" -ForegroundColor Cyan
    Write-Host "- API Gateway is responding ✅" -ForegroundColor Green
    
    if ($AuthToken) {
        Write-Host "- Authentication token provided ✅" -ForegroundColor Green
    } else {
        Write-Host "- No authentication token (some tests skipped) ⚠️" -ForegroundColor Yellow
    }
    
    if ($ThreadId) {
        Write-Host "- Thread ID provided ✅" -ForegroundColor Green
    } else {
        Write-Host "- No Thread ID (thread-specific tests skipped) ⚠️" -ForegroundColor Yellow
    }
}

# Check if parameters are provided
if (-not $AuthToken) {
    Write-Host "⚠️  No AuthToken provided. Authentication-required endpoints will be skipped." -ForegroundColor Yellow
    Write-Host "Usage: .\test-quiz-api.ps1 -AuthToken 'Bearer your-jwt-token' -ThreadId 'thread-uuid' -UserId 'user-uuid'" -ForegroundColor Cyan
}

if (-not $ThreadId) {
    Write-Host "⚠️  No ThreadId provided. Thread-specific endpoints will be skipped." -ForegroundColor Yellow
}

# Run the tests
Test-QuizAPI

Write-Host "`n📝 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Get a valid JWT token from your frontend login" -ForegroundColor White
Write-Host "2. Get Thread ID and User ID from your database" -ForegroundColor White
Write-Host "3. Re-run with: .\test-quiz-api.ps1 -AuthToken 'Bearer your-token' -ThreadId 'thread-id' -UserId 'user-id'" -ForegroundColor White
Write-Host "4. Use the HTML test tool for interactive testing" -ForegroundColor White