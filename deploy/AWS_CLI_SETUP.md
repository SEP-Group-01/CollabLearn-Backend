# AWS CLI Installation Guide for Windows

## Quick Install (Recommended)

### Option 1: MSI Installer (Easiest)

1. **Download AWS CLI**:
   - Visit: https://awscli.amazonaws.com/AWSCLIV2.msi
   - Or download from: https://aws.amazon.com/cli/

2. **Run the Installer**:
   - Double-click the downloaded `AWSCLIV2.msi` file
   - Follow the installation wizard
   - Accept the license agreement
   - Click "Install"

3. **Verify Installation**:

   ```powershell
   # Close and reopen PowerShell, then run:
   aws --version
   # Should output: aws-cli/2.x.x Python/3.x.x Windows/...
   ```

4. **Configure AWS CLI**:
   ```powershell
   aws configure
   # AWS Access Key ID: [paste your access key]
   # AWS Secret Access Key: [paste your secret key]
   # Default region name: us-east-1
   # Default output format: json
   ```

### Option 2: Chocolatey (If you have Chocolatey installed)

```powershell
# Run PowerShell as Administrator
choco install awscli
```

### Option 3: Winget (Windows Package Manager)

```powershell
# Run PowerShell as Administrator
winget install Amazon.AWSCLI
```

---

## Getting AWS Credentials

If you don't have AWS credentials yet:

### Step 1: Create AWS Account

1. Go to: https://aws.amazon.com/
2. Click "Create an AWS Account"
3. Follow the signup process
4. You'll get $100 in credits (students) or 12 months free tier

### Step 2: Create IAM User with ECR Permissions

1. **Go to IAM Console**: https://console.aws.amazon.com/iam/

2. **Create User**:
   - Click "Users" → "Create user"
   - Username: `collablearn-deploy`
   - Select: "Provide user access to AWS Management Console" (optional)
   - Click "Next"

3. **Set Permissions**:
   - Select "Attach policies directly"
   - Add these policies:
     - ✅ `AmazonEC2ContainerRegistryFullAccess` (for ECR)
     - ✅ `AmazonEC2FullAccess` (for EC2 management - optional)
   - Or create custom policy (see below)
   - Click "Next" → "Create user"

4. **Create Access Keys**:
   - Click on the created user
   - Go to "Security credentials" tab
   - Click "Create access key"
   - Select "Command Line Interface (CLI)"
   - Check "I understand" and click "Next"
   - Add description tag: "CollabLearn deployment"
   - Click "Create access key"
   - **⚠️ IMPORTANT**: Download the CSV or copy the keys NOW!
     - Access Key ID: `AKIAIOSFODNN7EXAMPLE`
     - Secret Access Key: `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`

### Step 3: Configure AWS CLI

```powershell
aws configure
```

Enter when prompted:

- **AWS Access Key ID**: [paste Access Key ID from step 4]
- **AWS Secret Access Key**: [paste Secret Access Key from step 4]
- **Default region name**: `us-east-1`
- **Default output format**: `json`

---

## Custom IAM Policy (Minimum Permissions)

If you want to create a custom policy with minimum permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:CreateRepository",
        "ecr:DescribeRepositories",
        "ecr:ListImages"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["sts:GetCallerIdentity"],
      "Resource": "*"
    }
  ]
}
```

---

## Verify Installation & Configuration

After installing and configuring:

```powershell
# 1. Check AWS CLI version
aws --version

# 2. Verify credentials
aws sts get-caller-identity

# Should output:
# {
#     "UserId": "AIDAIOSFODNN7EXAMPLE",
#     "Account": "123456789012",
#     "Arn": "arn:aws:iam::123456789012:user/collablearn-deploy"
# }

# 3. Test ECR access
aws ecr describe-repositories --region us-east-1

# Should output: empty list [] or your existing repos
```

---

## Troubleshooting

### "aws: command not found" after installation

- **Solution**: Close and reopen PowerShell
- Or restart your computer
- Or add to PATH manually:
  ```powershell
  # Add to PATH (usually automatic)
  $env:Path += ";C:\Program Files\Amazon\AWSCLIV2"
  ```

### "The security token is invalid"

- **Solution**: Re-run `aws configure` with correct credentials

### "Access Denied" errors

- **Solution**: Add more permissions to your IAM user (see policies above)

---

## Next Steps After Installation

Once AWS CLI is installed and configured:

```powershell
# Navigate to your project
cd "C:\Users\94779\OneDrive\Desktop\SE Project\5-Org\CollabLearn-Backend"

# Run the build and push script
.\deploy\build-and-push-ecr.ps1 -Region us-east-1
```

This will:

1. Create ECR repositories
2. Build all 7 Docker images
3. Push images to ECR
4. Takes 20-30 minutes

---

## Quick Reference

```powershell
# Configure AWS CLI
aws configure

# Check configuration
aws configure list

# Get account ID
aws sts get-caller-identity --query Account --output text

# List ECR repositories
aws ecr describe-repositories --region us-east-1

# Login to ECR
$AccountId = (aws sts get-caller-identity --query Account --output text)
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin "$AccountId.dkr.ecr.us-east-1.amazonaws.com"
```

---

**Ready?** Install AWS CLI, configure credentials, then continue with deployment! 🚀
