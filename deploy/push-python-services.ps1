# PowerShell script to push Python services to ECR
# Run this after document-query-service and study-plan-service are built locally

param(
    [string]$Region = "ap-southeast-2",
    [string]$AccountId = "314431973177"
)

$ErrorActionPreference = "Stop"

$EcrUri = "$AccountId.dkr.ecr.$Region.amazonaws.com"

Write-Host "==========================================" -ForegroundColor Green
Write-Host "Push Python Services to ECR" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

# Login to ECR
Write-Host "`nLogging in to ECR..." -ForegroundColor Cyan
aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $EcrUri

# Push document-query-service
Write-Host "`nPushing document-query-service..." -ForegroundColor Cyan
docker tag document-query-service:latest ${EcrUri}/collablearn/document-query-service:latest
docker push ${EcrUri}/collablearn/document-query-service:latest

# Push study-plan-service  
Write-Host "`nPushing study-plan-service..." -ForegroundColor Cyan
docker tag study-plan-service:latest ${EcrUri}/collablearn/study-plan-service:latest
docker push ${EcrUri}/collablearn/study-plan-service:latest

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "Python services pushed successfully!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
