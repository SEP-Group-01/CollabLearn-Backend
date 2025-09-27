# Study Plan Service API Usage Guide

## Overview
The updated Study Plan Service now follows the document-query-service pattern with async Kafka messaging and automatic weekly hours calculation from daily time slots.

## Key Changes

### 1. Weekly Hours Calculation
The service now automatically calculates `weekly_hours_available` by summing all daily time slots:

```http
GET /api/users/{user_id}/time-slots
```

**Response:**
```json
{
    "success": true,
    "user_id": "user123",
    "time_slots": [
        {
            "day_of_week": "Monday",
            "start_time": "09:00:00",
            "end_time": "11:00:00",
            "duration_minutes": 120,
            "is_available": true
        },
        {
            "day_of_week": "Wednesday",
            "start_time": "14:00:00",
            "end_time": "16:00:00",
            "duration_minutes": 120,
            "is_available": true
        }
    ],
    "total_slots": 2,
    "weekly_hours_total": 4.0,
    "daily_breakdown": {
        "Monday": 2.0,
        "Wednesday": 2.0
    }
}
```

### 2. Kafka Message Format

#### Study Plan Generation Request
**Topic:** `study-plan-requests`

```json
{
    "user_id": "user123",
    "workspace_ids": ["workspace1", "workspace2"],
    "selected_threads": {
        "workspace1": ["thread1", "thread2"],
        "workspace2": ["thread3"]
    },
    "deadline": "2025-01-15",
    "learning_style": "visual",
    "study_mode": "intensive",
    "include_quizzes": true,
    "balance_workload": true
}
```

**Reply Topic:** `study-plan-requests.reply`

```json
{
    "success": true,
    "plan_id": "plan_456",
    "study_plan": {
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
                    "estimated_time_minutes": 60,
                    "workspace_id": "workspace1",
                    "thread_id": "thread1",
                    "sequence_number": 1
                },
                "time_slot": {
                    "day_of_week": "Monday",
                    "start_time": "09:00:00",
                    "end_time": "11:00:00",
                    "duration_minutes": 120
                },
                "week_number": 1,
                "allocated_time_minutes": 60,
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
        "unscheduled_resources": [],
        "message": "Study plan generated successfully with 93.2% coverage"
    },
    "service": "StudyPlanService"
}
```

#### Progress Update Request
**Topic:** `study-plan-progress`

```json
{
    "user_id": "user123",
    "resource_id": "res1",
    "completion_status": "in_progress",
    "progress_percentage": 75.0,
    "actual_time_spent": 45
}
```

**Reply Topic:** `study-plan-progress.reply`

```json
{
    "success": true,
    "user_id": "user123",
    "resource_id": "res1",
    "message": "Progress updated successfully",
    "service": "StudyPlanService"
}
```

### 3. Algorithm Features

#### Optimization Objectives
1. **Maximize Coverage**: Prioritize fitting as many resources as possible
2. **Maintain Sequence**: Respect prerequisite order within threads
3. **Balance Workload**: Distribute work evenly across weeks (optional)
4. **Priority Weighting**: 
   - Quizzes: 3.0x priority
   - Videos: 2.0x priority
   - Documents: 1.5x priority
   - Readings/Links: 1.0x priority

#### Time Adjustments
- **Videos**: +20% buffer for pausing/rewinding
- **Quizzes**: +50% buffer for thinking time
- **In Progress**: Calculated based on progress percentage
- **Needs Revision**: 50% of original time
- **Completed**: 0 time required

### 4. Multi-Workspace Support

Users can generate study plans across multiple workspaces:

```json
{
    "workspace_ids": ["data-science-basics", "web-dev-bootcamp"],
    "selected_threads": {
        "data-science-basics": ["python-fundamentals", "data-analysis"],
        "web-dev-bootcamp": ["html-css", "javascript-basics"]
    }
}
```

The algorithm will:
- Validate user access to each workspace/thread
- Maintain sequence within each thread
- Balance workload across all selected content
- Provide unified scheduling across workspaces

### 5. Feasibility Analysis

**Endpoint:** `POST /api/analytics/feasibility`

```json
{
    "success": true,
    "feasibility_report": {
        "feasible": true,
        "coverage_percentage": 95.5,
        "total_required_hours": 48.0,
        "total_available_hours": 50.0,
        "weekly_intensity": 12.0,
        "recommendations": [
            "You have 2.0 extra hours - consider adding additional practice time"
        ]
    },
    "optimization_suggestions": [
        "Consider spacing out quizzes throughout the schedule for better retention",
        "Mix videos with interactive content to maintain engagement"
    ],
    "total_resources": 45,
    "weekly_hours_calculated": 12.5
}
```

### 6. Database Schema Updates

#### New Tables
- `study_resources`: Learning materials with metadata
- `user_progress`: Completion tracking per resource
- `scheduled_tasks`: Generated schedule items
- `user_workspace_threads`: Access control
- `workspaces` & `threads`: Organizational structure

#### Enhanced `study_slots` Table
```sql
SELECT day_of_week, start_time, end_time, 
       EXTRACT(EPOCH FROM (end_time::time - start_time::time))/60 as duration_minutes
FROM study_slots 
WHERE user_id = ? AND is_free = true
ORDER BY 
    CASE day_of_week 
        WHEN 'Monday' THEN 1
        WHEN 'Tuesday' THEN 2
        -- ... etc
    END,
    start_time
```

### 7. Error Handling

All responses include consistent error format:

```json
{
    "success": false,
    "error": "No accessible workspaces or threads found",
    "service": "StudyPlanService",
    "action": "generate_plan"
}
```

### 8. Backward Compatibility

Legacy requests with `focus_areas` are still supported:

```json
{
    "user_id": "user123",
    "focus_areas": ["Python", "Data Analysis"],
    "learning_style": "visual",
    "study_mode": "intensive"
}
```

These are automatically converted to the new format internally.

## Development Notes

1. **Async Architecture**: All Kafka operations are now async using `aiokafka`
2. **NestJS Compatibility**: Proper correlation ID handling for request-reply pattern
3. **Logging**: Comprehensive logging at INFO/DEBUG levels
4. **Health Checks**: Multiple endpoints for monitoring service health
5. **CORS**: Configured for frontend integration

## Testing

Use the health endpoint to verify service status:
```http
GET /health
```

Test database connectivity and time slot calculation:
```http
GET /db-test/{user_id}
```

Check environment configuration:
```http
GET /env-check
```