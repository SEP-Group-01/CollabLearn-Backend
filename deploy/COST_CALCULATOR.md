# AWS Cost Calculator for CollabLearn Backend

## Instance Type Comparison

| Instance Type      | vCPU | RAM  | Cost/Hour | Cost/Month | Suitable?                       |
| ------------------ | ---- | ---- | --------- | ---------- | ------------------------------- |
| **t3.micro**       | 1    | 1 GB | $0.0104   | $7.49      | ❌ Too small for all services   |
| **t3.small** ✅    | 2    | 2 GB | $0.0208   | $15.00     | ✅ Minimum recommended          |
| **t3.medium**      | 2    | 4 GB | $0.0416   | $30.00     | ✅ Comfortable for all services |
| **c7i-flex.large** | 2    | 4 GB | $0.0765   | $55.13     | ⚠️ Expensive, compute optimized |
| **m7i-flex.large** | 2    | 8 GB | $0.0918   | $66.10     | ⚠️ Too expensive for budget     |

## Memory Requirements Breakdown

| Service                 | Memory Limit | Notes                                 |
| ----------------------- | ------------ | ------------------------------------- |
| Kafka                   | 512 MB       | Heavy, needs 256-512MB                |
| Zookeeper               | 256 MB       | Coordinator for Kafka                 |
| Redis                   | 192 MB       | In-memory cache with 128MB data limit |
| API Gateway             | 256 MB       | Main entry point                      |
| Auth Service            | 256 MB       | Authentication/authorization          |
| Workspaces Service      | 256 MB       | Workspace management                  |
| Resource Service        | 256 MB       | Resource handling                     |
| Document Editor         | 256 MB       | Real-time collaboration               |
| Document Query (Python) | 256 MB       | FastAPI service                       |
| Study Plan (Python)     | 256 MB       | FastAPI service                       |
| **Total**               | **~2.5 GB**  | Plus OS overhead (~200-300MB)         |

## Recommendation: t3.small

### Why t3.small?

- ✅ **2 GB RAM**: Just enough for all services with memory limits
- ✅ **2 vCPU**: Sufficient for microservices workload
- ✅ **$15/month**: Fits in your budget
- ✅ **Baseline + Burst**: Can handle traffic spikes

### Why NOT t3.micro?

- ❌ **1 GB RAM**: Not enough for 2.5GB total requirement
- ❌ **Will OOM**: Out of memory errors guaranteed
- ❌ **Poor performance**: Constant swapping and crashes

### If You Need to Use t3.micro (Not Recommended)

You would need to disable services:

```yaml
# In docker-compose.prod.yml, comment out:
# - document-query-service (saves 256MB)
# - study-plan-service (saves 256MB)
# - resource-service (saves 256MB)
```

This saves ~768MB but loses functionality.

## Cost Breakdown (t3.small)

### Monthly Costs

| Item               | Cost        | Details                         |
| ------------------ | ----------- | ------------------------------- |
| EC2 Instance       | $15.05      | t3.small 730 hours              |
| EBS Storage (30GB) | $3.00       | gp3 volume                      |
| Data Transfer Out  | $0-5        | First 100GB free, then $0.09/GB |
| **Subtotal**       | **~$18-23** |                                 |
| **With Free Tier** | **~$15-20** | 30GB EBS free first year        |

### With Your $100 Credit

```
$100 / $20 per month = 5 months continuous operation
```

Or extend to **8-10 months** by:

- Stopping instance during nights/weekends
- Stopping when not actively developing
- Using Reserved Instance (1-year commitment saves 30%)

## Cost Optimization Strategies

### 1. Stop Instance When Not In Use 💰

```bash
# Stop (saves ~$0.50/day = $15/month)
aws ec2 stop-instances --instance-ids i-xxxxxxxxx

# Start when needed
aws ec2 start-instances --instance-ids i-xxxxxxxxx

# Note: EBS storage still charges $3/month when stopped
```

**Savings**: If you stop 50% of the time, your $100 lasts 10 months instead of 5!

### 2. Reduce Storage Size

- 30GB → 20GB = Save $1/month
- 30GB → 10GB = Save $2/month

Only if you don't need much file storage.

### 3. Use Spot Instances (Advanced)

- 70% cheaper than on-demand
- Risk: Can be terminated with 2-minute notice
- Not recommended for production

### 4. Reserved Instances (If Running 24/7)

- 1-year commitment: Save 30% (~$4.50/month)
- 3-year commitment: Save 50% (~$7.50/month)
- Only worth it if you'll run continuously

## Scaling Up Later (When Budget Allows)

### When to Upgrade to t3.medium ($30/month)?

- ⚠️ Memory usage consistently > 90%
- ⚠️ Frequent OOM errors
- ⚠️ Slow response times
- ⚠️ Adding more services

### When to Move to Managed Services?

**If you get more budget (>$100/month):**

- Use Amazon MSK for Kafka: $72/month (no maintenance!)
- Use ElastiCache for Redis: $12/month (auto backups!)
- Use ECS/EKS for orchestration: $70+/month (better scaling!)

But stick with Docker Compose on t3.small for now with your budget.

## Cost Monitoring

### Set Up Billing Alerts

1. AWS Console → Billing Dashboard
2. Budgets → Create Budget
3. Set alerts:
   - $50 (50% of credit)
   - $75 (75% of credit)
   - $90 (90% of credit)

### Track Usage

```bash
# On EC2, check resources
docker stats
free -h
df -h

# Check AWS costs
aws ce get-cost-and-usage \
  --time-period Start=2025-10-01,End=2025-10-31 \
  --granularity MONTHLY \
  --metrics BlendedCost
```

## Example: 6 Month Budget Plan

With $100 credit and t3.small:

| Month | Strategy               | Cost | Remaining |
| ----- | ---------------------- | ---- | --------- |
| 1     | Running 24/7 (testing) | $20  | $80       |
| 2     | Stop nights (16h/day)  | $13  | $67       |
| 3     | Stop nights (16h/day)  | $13  | $54       |
| 4     | Stop nights (16h/day)  | $13  | $41       |
| 5     | Stop nights (16h/day)  | $13  | $28       |
| 6     | Stop nights (16h/day)  | $13  | $15       |
| 7     | Critical demos only    | $8   | $7        |

This gets you through a full 6-7 month project!

## Daily Cost Breakdown

| Scenario                 | Hours/Day | Cost/Day | Cost/Month |
| ------------------------ | --------- | -------- | ---------- |
| 24/7 Always On           | 24        | $0.67    | $20        |
| Business Hours Only (8h) | 8         | $0.22    | $7         |
| Half Day (12h)           | 12        | $0.33    | $10        |
| Most of Day (16h)        | 16        | $0.44    | $13        |

## Final Recommendation

### For Your $100 Budget:

1. **Use t3.small** - Don't try to squeeze into t3.micro
2. **Stop when not in use** - Develop locally, deploy for testing/demos
3. **Set billing alerts** - At $50, $75, $90
4. **Monitor daily** - Check AWS billing dashboard weekly
5. **Plan your demos** - Know when you need it running vs offline

This strategy will get you **6-7 months** of usage, perfect for a semester project!

### Daily Checklist

```bash
# Morning: Start instance
aws ec2 start-instances --instance-ids i-xxxxxxxxx

# Evening: Stop instance (if not needed)
aws ec2 stop-instances --instance-ids i-xxxxxxxxx
```

### Automation (Optional)

Create a Lambda function to auto-stop at midnight and auto-start at 8 AM on weekdays.

---

**Need Help?** See `deploy/DEPLOYMENT_GUIDE.md` for full instructions!
