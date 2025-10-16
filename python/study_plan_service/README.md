# Study Plan Service

An advanced microservice for generating optimized study plans across multiple workspaces using Operations Research (OR) algorithms. This service supports multi-workspace planning, progress tracking, and intelligent time allocation.

## Features

### 🎯 Core Functionality

- **Multi-workspace study planning** - Generate plans across multiple learning workspaces
- **OR-based optimization** - Uses Integer Linear Programming (PuLP) for optimal resource allocation
- **Progress tracking** - Track completion status and time spent on each resource
- **Intelligent scheduling** - Maintains sequence order within threads while optimizing across workspaces
- **Deadline-aware planning** - Considers user deadlines and available time slots

### 📊 Advanced Analytics

- **Feasibility analysis** - Determines if study goals are achievable within time constraints
- **Workload balancing** - Distributes study load evenly across available weeks
- **Priority-based scheduling** - Prioritizes quizzes and important content
- **Time estimation** - Smart time estimation based on resource types and user progress

### 🔄 Real-time Features

- **Kafka-based messaging** - Asynchronous processing of study plan requests
- **Progress updates** - Real-time progress tracking and plan adjustments
- **Multi-message support** - Handles both study plan generation and progress updates

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend UI   │    │   API Gateway    │    │ Other Services  │
└─────────┬───────┘    └─────────┬────────┘    └─────────┬───────┘
          │                      │                       │
          └──────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────▼──────────────┐
                    │      Kafka Broker          │
                    └─────────────┬──────────────┘
                                 │
                    ┌─────────────▼──────────────┐
                    │   Study Plan Service       │
                    │  ┌──────────────────────┐  │
                    │  │   OR Optimization    │  │
                    │  │     (PuLP/ILP)       │  │
                    │  └──────────────────────┘  │
                    │  ┌──────────────────────┐  │
                    │  │  Progress Tracking   │  │
                    │  └──────────────────────┘  │
                    │  ┌──────────────────────┐  │
                    │  │   Analytics Engine   │  │
                    │  └──────────────────────┘  │
                    └─────────────┬──────────────┘
                                 │
                    ┌─────────────▼──────────────┐
                    │    PostgreSQL Database     │
                    └────────────────────────────┘
```

## Algorithm Details

### Integer Linear Programming (ILP) Optimization

The service uses a sophisticated ILP model with the following components:

#### Decision Variables

- `x[r,s,w]` = 1 if resource `r` is assigned to time slot `s` in week `w`

#### Objective Function

Maximize weighted coverage: `∑(w_r * x[r,s,w])` where `w_r` is the priority weight for resource `r`

#### Constraints

1. **Resource Assignment**: Each resource assigned to at most one slot
2. **Slot Capacity**: Each time slot can have at most one resource per week
3. **Time Feasibility**: Resource duration must fit within slot duration
4. **Sequence Preservation**: Maintain order within threads (prerequisite constraints)
5. **Workload Balancing**: Even distribution across weeks (optional)

#### Priority Weights

- Quizzes: 3.0 (highest priority)
- Videos: 2.0
- Documents: 1.5
- Readings/Links: 1.0

## API Endpoints

### Study Plan Management

- `GET /api/users/{user_id}/study-plans` - Get user's study plan history
- `POST /api/analytics/feasibility` - Analyze plan feasibility

### Resource Management

- `GET /api/users/{user_id}/time-slots` - Get available time slots
- `GET /api/users/{user_id}/workspaces/{workspace_id}/resources` - Get workspace resources
- `GET /api/users/{user_id}/workspaces/{workspace_id}/threads` - Get workspace threads

### Progress Tracking

- `POST /api/users/{user_id}/progress` - Update resource completion progress

### Health & Monitoring

- `GET /health` - Service health check
- `GET /env-check` - Environment configuration (dev only)

## Database Schema

### Core Tables

- `thread_resources` - Learning materials (videos, documents, quizzes)
- `user_progress` - User completion tracking
- `study_slots` - User available time slots
- `study_plans` - Generated study plans
- `scheduled_tasks` - Individual scheduled learning tasks

### Relationship Tables

- `user_workspace_threads` - User access to workspace threads
- `workspaces` - Workspace metadata
- `threads` - Learning thread information

## Installation & Setup

### Prerequisites

- Python 3.10+
- PostgreSQL 12+
- Apache Kafka 2.8+
- Redis (optional, for caching)

### Environment Variables

Create a `.env` file:

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Kafka
KAFKA_BROKER_URL=localhost:9092
KAFKA_REQUEST_TOPIC=study-plan-requests
KAFKA_RESULT_TOPIC=study-plan-results

# Service Configuration
SERVICE_NAME=study-plan-service
LOG_LEVEL=INFO
MAX_OPTIMIZATION_TIME_SECONDS=30
DEFAULT_WEEKLY_HOURS=10
```

### Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Set up database
psql -d your_database -f database_schema.sql

# Run the service
uvicorn src.main:app --host 0.0.0.0 --port 8000
```

### Docker Deployment

```bash
# Build image
docker build -t study-plan-service .

# Run container
docker run -p 8000:8000 --env-file .env study-plan-service
```

## Usage Examples

### Study Plan Request Format

```json
{
  "type": "study_plan_request",
  "user_id": "user123",
  "workspace_ids": ["workspace1", "workspace2"],
  "selected_threads": {
    "workspace1": ["thread1", "thread2"],
    "workspace2": ["thread3"]
  },
  "deadline": "2025-01-15",
  "weekly_hours_available": 15,
  "learning_style": "visual",
  "study_mode": "intensive",
  "include_quizzes": true,
  "balance_workload": true
}
```

### Progress Update Format

```json
{
  "type": "progress_update",
  "user_id": "user123",
  "resource_id": "resource456",
  "completion_status": "in_progress",
  "progress_percentage": 75.0,
  "actual_time_spent": 45
}
```

### Study Plan Result

```json
{
    "user_id": "user123",
    "total_weeks": 4,
    "total_hours_allocated": 48.5,
    "total_hours_required": 52.0,
    "coverage_percentage": 93.2,
    "workspaces_included": ["workspace1", "workspace2"],
    "schedule": [
        {
            "resource": {
                "id": "res1",
                "name": "Introduction to Python",
                "type": "video",
                "estimated_time_minutes": 60
            },
            "time_slot": {
                "day_of_week": "Monday",
                "start_time": "09:00",
                "end_time": "10:00"
            },
            "week_number": 1,
            "workspace_id": "workspace1",
            "thread_id": "thread1"
        }
    ],
    "optimization_details": {
        "algorithm": "Integer Linear Programming (PuLP)",
        "solver_status": "Optimal",
        "resources_scheduled": 48,
        "resources_total": 52
    },
    "unscheduled_resources": [...]
}
```

## Performance Optimization

### Caching Strategy

- Cache workspace resources for 1 hour
- Cache user progress for 15 minutes
- Cache time slots for 30 minutes

### Database Optimization

- Indexed queries on user_id, workspace_id, thread_id
- Partitioned tables for large datasets
- Connection pooling for high concurrency

### Algorithm Optimization

- Time-limited optimization (30 seconds max)
- Heuristic fallback for large problem instances
- Parallel processing for independent workspaces

## Monitoring & Logging

### Health Metrics

- Plan generation success rate
- Average optimization time
- Database connection health
- Kafka message processing rate

### Logging Levels

- `INFO`: Service status, plan generation completion
- `WARNING`: Optimization timeouts, access denied
- `ERROR`: Database errors, Kafka failures
- `DEBUG`: Detailed algorithm steps

## Contributing

### Development Setup

```bash
# Clone repository
git clone <repository-url>
cd study-plan-service

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Run tests
pytest tests/

# Code formatting
black src/
isort src/
```

### Code Quality

- Type hints required for all functions
- Comprehensive docstrings
- Unit test coverage > 80%
- Integration tests for critical paths

## License

MIT License - see LICENSE file for details.

## Support

For issues and feature requests, please create an issue in the repository or contact the development team.
