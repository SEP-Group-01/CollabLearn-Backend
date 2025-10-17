# PowerShell script to build and push all CollabLearn microservices to Amazon ECR
# Usage: .\build-and-push-ecr.ps1 -Region us-east-1

param(
    [string]$Region = "us-east-1",
    [string]$AccountId = ""
)

$ErrorActionPreference = "Stop"

# Get AWS Account ID if not provided
if ([string]::IsNullOrEmpty($AccountId)) {
    Write-Host "Getting AWS Account ID..." -ForegroundColor Cyan
    $AccountId = (aws sts get-caller-identity --query Account --output text)
}

$EcrUri = "$AccountId.dkr.ecr.$Region.amazonaws.com"
$RepoPrefix = "collablearn"

Write-Host "==========================================" -ForegroundColor Green
Write-Host "CollabLearn ECR Build & Push Script" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host "AWS Region: $Region"
Write-Host "AWS Account: $AccountId"
Write-Host "ECR URI: $EcrUri"
Write-Host "==========================================" -ForegroundColor Green

# Login to ECR
Write-Host "`nLogging in to Amazon ECR..." -ForegroundColor Cyan
aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $EcrUri

# Function to create ECR repo if it doesn't exist
function New-EcrRepoIfNotExists {
    param([string]$RepoName)
    
    Write-Host "Checking repository: $RepoName" -ForegroundColor Yellow
    
    try {
        aws ecr describe-repositories --repository-names $RepoName --region $Region 2>&1 | Out-Null
        Write-Host "   Repository exists: $RepoName" -ForegroundColor Gray
    }
    catch {
        Write-Host "   Creating repository: $RepoName" -ForegroundColor Yellow
        aws ecr create-repository --repository-name $RepoName --region $Region --image-scanning-configuration scanOnPush=true --encryption-configuration encryptionType=AES256 | Out-Null
    }
}

# Function to build, tag and push image
function Build-AndPush {
    param(
        [string]$ServiceName,
        [string]$DockerfilePath
    )
    
    $RepoName = "$RepoPrefix/$ServiceName"
    $Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    
    Write-Host "`nBuilding $ServiceName..." -ForegroundColor Cyan
    
    # Create repo if needed
    New-EcrRepoIfNotExists -RepoName $RepoName
    
    # Build image
    docker build -f $DockerfilePath -t "${ServiceName}:latest" .
    
    # Tag for ECR
    docker tag "${ServiceName}:latest" "${EcrUri}/${RepoName}:latest"
    docker tag "${ServiceName}:latest" "${EcrUri}/${RepoName}:${Timestamp}"
    
    # Push to ECR
    Write-Host "Pushing $ServiceName to ECR..." -ForegroundColor Cyan
    docker push "${EcrUri}/${RepoName}:latest"
    docker push "${EcrUri}/${RepoName}:${Timestamp}"
    
    Write-Host "$ServiceName pushed successfully" -ForegroundColor Green
}

# Build and push all Node.js microservices
Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "Building Node.js Microservices" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

Build-AndPush -ServiceName "api-gateway" -DockerfilePath "apps/api-gateway/Dockerfile"
Build-AndPush -ServiceName "auth-service" -DockerfilePath "apps/auth-service/Dockerfile"
Build-AndPush -ServiceName "workspaces-service" -DockerfilePath "apps/workspaces-service/Dockerfile"
Build-AndPush -ServiceName "resource-service" -DockerfilePath "apps/resource-service/Dockerfile"
Build-AndPush -ServiceName "document-editor-service" -DockerfilePath "apps/document-editor-service/Dockerfile"

# Build and push Python services
Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "Building Python Microservices" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

Build-AndPush -ServiceName "document-query-service" -DockerfilePath "python/document-query-service/Dockerfile"
Build-AndPush -ServiceName "study-plan-service" -DockerfilePath "python/study_plan_service/Dockerfile"

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "All images built and pushed successfully!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host "`nTo deploy on EC2, run:" -ForegroundColor Cyan
Write-Host "  export AWS_ACCOUNT_ID=$AccountId" -ForegroundColor Yellow
Write-Host "  export AWS_REGION=$Region" -ForegroundColor Yellow
Write-Host "  docker compose -f docker-compose.prod.yml pull" -ForegroundColor Yellow
Write-Host "  docker compose -f docker-compose.prod.yml up -d" -ForegroundColor Yellow
