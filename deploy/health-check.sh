#!/bin/bash
# Health check script for CollabLearn services
# Run this on EC2 to verify all services are healthy

echo "================================================"
echo "CollabLearn Backend Health Check"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if docker compose is running
if ! docker compose -f docker-compose.prod.yml ps &> /dev/null; then
    echo -e "${RED}❌ Docker Compose not found or not running${NC}"
    exit 1
fi

echo "📦 Container Status:"
docker compose -f docker-compose.prod.yml ps

echo ""
echo "================================================"
echo "🔍 Service Health Checks"
echo "================================================"
echo ""

# Function to check service
check_service() {
    local name=$1
    local url=$2
    local expected=$3
    
    printf "%-30s" "$name:"
    
    if curl -s -f "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Healthy${NC}"
        return 0
    else
        echo -e "${RED}❌ Unhealthy${NC}"
        return 1
    fi
}

# Check API Gateway
check_service "API Gateway" "http://localhost:3000/auth/health" "200"

# Check Redis
printf "%-30s" "Redis:"
if docker exec redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Healthy${NC}"
else
    echo -e "${RED}❌ Unhealthy${NC}"
fi

# Check Kafka
printf "%-30s" "Kafka:"
if docker exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Healthy${NC}"
else
    echo -e "${RED}❌ Unhealthy${NC}"
fi

# Check Zookeeper
printf "%-30s" "Zookeeper:"
if docker exec zookeeper sh -c 'echo ruok | nc localhost 2181' 2>/dev/null | grep -q imok; then
    echo -e "${GREEN}✅ Healthy${NC}"
else
    echo -e "${RED}❌ Unhealthy${NC}"
fi

echo ""
echo "================================================"
echo "💾 Resource Usage"
echo "================================================"
echo ""

# Memory usage
echo "System Memory:"
free -h | grep -E "^Mem|^Swap"

echo ""
echo "Container Memory Usage:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

echo ""
echo "================================================"
echo "💿 Disk Usage"
echo "================================================"
echo ""

df -h / | grep -v Filesystem

echo ""
echo "Docker Disk Usage:"
docker system df

echo ""
echo "================================================"
echo "📊 Service Logs (Last 5 lines each)"
echo "================================================"
echo ""

for service in api-gateway auth-service workspaces-service resource-service document-editor-service; do
    echo "--- $service ---"
    docker compose -f docker-compose.prod.yml logs --tail=5 $service 2>/dev/null | tail -5
    echo ""
done

echo "================================================"
echo "✅ Health check complete!"
echo "================================================"
echo ""
echo "For detailed logs: docker compose -f docker-compose.prod.yml logs -f"
echo "For live stats: docker stats"
