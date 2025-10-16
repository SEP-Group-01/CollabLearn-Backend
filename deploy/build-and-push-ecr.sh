#!/bin/bash
# Build and push all CollabLearn microservices to Amazon ECR
# Usage: ./build-and-push-ecr.sh <aws-region> <aws-account-id>

set -e

# Configuration
AWS_REGION="${1:-us-east-1}"
AWS_ACCOUNT_ID="${2}"

if [ -z "$AWS_ACCOUNT_ID" ]; then
  echo "Getting AWS Account ID..."
  AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
fi

ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
REPO_PREFIX="collablearn"

echo "=========================================="
echo "CollabLearn ECR Build & Push Script"
echo "=========================================="
echo "AWS Region: $AWS_REGION"
echo "AWS Account: $AWS_ACCOUNT_ID"
echo "ECR URI: $ECR_URI"
echo "=========================================="

# Login to ECR
echo "🔐 Logging in to Amazon ECR..."
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_URI"

# Function to create ECR repo if it doesn't exist
create_repo_if_not_exists() {
  local repo_name=$1
  echo "📦 Checking repository: $repo_name"
  
  if ! aws ecr describe-repositories --repository-names "$repo_name" --region "$AWS_REGION" >/dev/null 2>&1; then
    echo "   Creating repository: $repo_name"
    aws ecr create-repository --repository-name "$repo_name" --region "$AWS_REGION" \
      --image-scanning-configuration scanOnPush=true \
      --encryption-configuration encryptionType=AES256 >/dev/null
  else
    echo "   Repository exists: $repo_name"
  fi
}

# Function to build, tag and push image
build_and_push() {
  local service_name=$1
  local dockerfile_path=$2
  local repo_name="${REPO_PREFIX}/${service_name}"
  
  echo ""
  echo "🏗️  Building $service_name..."
  
  # Create repo if needed
  create_repo_if_not_exists "$repo_name"
  
  # Build image
  docker build -f "$dockerfile_path" -t "${service_name}:latest" .
  
  # Tag for ECR
  docker tag "${service_name}:latest" "${ECR_URI}/${repo_name}:latest"
  docker tag "${service_name}:latest" "${ECR_URI}/${repo_name}:$(date +%Y%m%d-%H%M%S)"
  
  # Push to ECR
  echo "📤 Pushing ${service_name} to ECR..."
  docker push "${ECR_URI}/${repo_name}:latest"
  docker push "${ECR_URI}/${repo_name}:$(date +%Y%m%d-%H%M%S)"
  
  echo "✅ ${service_name} pushed successfully"
}

# Build and push all Node.js microservices
echo ""
echo "=========================================="
echo "Building Node.js Microservices"
echo "=========================================="

build_and_push "api-gateway" "apps/api-gateway/Dockerfile"
build_and_push "auth-service" "apps/auth-service/Dockerfile"
build_and_push "workspaces-service" "apps/workspaces-service/Dockerfile"
build_and_push "resource-service" "apps/resource-service/Dockerfile"
build_and_push "document-editor-service" "apps/document-editor-service/Dockerfile"

# Build and push Python services
echo ""
echo "=========================================="
echo "Building Python Microservices"
echo "=========================================="

build_and_push "document-query-service" "python/document-query-service/Dockerfile"
build_and_push "study-plan-service" "python/study_plan_service/Dockerfile"

echo ""
echo "=========================================="
echo "✅ All images built and pushed successfully!"
echo "=========================================="
echo ""
echo "To deploy on EC2, run:"
echo "  export AWS_ACCOUNT_ID=$AWS_ACCOUNT_ID"
echo "  export AWS_REGION=$AWS_REGION"
echo "  docker compose -f docker-compose.prod.yml pull"
echo "  docker compose -f docker-compose.prod.yml up -d"
