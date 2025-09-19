from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import logging
import threading
import asyncio

from kafka_service.consumer import KafkaConsumerService
from kafka_service.producer import KafkaProducerService, get_producer
from controllers.study_plan_controller import StudyPlanController
from database import (
    get_free_slots, get_workspace_resources, get_user_study_plans,
    update_resource_progress, get_user_workspace_threads, calculate_weekly_hours_from_slots,
    get_daily_time_breakdown
)
from models.study_plan import StudyPlanRequest, CompletionStatus
from services.analytics import StudyPlanAnalytics
from config import KAFKA_BROKER_URL

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Study Plan Service",
    description="Advanced study plan generation with multi-workspace support and OR optimization",
    version="2.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ProgressUpdateRequest(BaseModel):
    resource_id: str
    completion_status: CompletionStatus
    progress_percentage: float
    actual_time_spent: Optional[int] = 0

# Global Kafka services
consumer_service = None
producer_service = None

async def start_kafka_services():
    """Start async Kafka services"""
    global consumer_service, producer_service
    
    try:
        # Initialize producer
        producer_service = await get_producer()
        
        # Initialize controller
        controller = StudyPlanController()
        
        # Topics to listen to
        topics = [
            "study-plan-requests",
            "study-plan-progress"
        ]
        
        # Initialize consumer
        consumer_service = KafkaConsumerService(
            brokers=KAFKA_BROKER_URL,
            group_id="study-plan-service-group",
            topics=topics,
            producer=producer_service,
            controller=controller
        )
        
        # Start consumer in background
        asyncio.create_task(consumer_service.start())
        logger.info("Kafka services started successfully")
        
    except Exception as e:
        logger.error(f"Error starting Kafka services: {e}")

@app.on_event("startup")
async def startup_event():
    """Start services on application startup"""
    logger.info("Starting Study Plan Service...")
    await start_kafka_services()
    logger.info("Study Plan Service started successfully")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on application shutdown"""
    logger.info("Shutting down Study Plan Service...")
    if producer_service:
        await producer_service.stop()
    logger.info("Study Plan Service shutdown complete")

@app.get("/health")
def health():
    """Health check endpoint"""
    return {"status": "ok", "service": "study-plan-service", "version": "2.0.0"}

@app.get("/api/users/{user_id}/time-slots")
def get_user_time_slots(user_id: str):
    """Get user's available time slots with calculated weekly hours"""
    try:
        slots = get_free_slots(user_id)
        weekly_hours = calculate_weekly_hours_from_slots(user_id)
        daily_breakdown = get_daily_time_breakdown(user_id)
        
        return {
            "success": True, 
            "user_id": user_id,
            "time_slots": [slot.dict() for slot in slots],
            "total_slots": len(slots),
            "weekly_hours_total": weekly_hours,
            "daily_breakdown": daily_breakdown
        }
    except Exception as e:
        logger.error(f"Error getting time slots for user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/users/{user_id}/workspaces/{workspace_id}/resources")
def get_workspace_resources_endpoint(user_id: str, workspace_id: str):
    """Get study resources for a specific workspace"""
    try:
        workspace_resources = get_workspace_resources(user_id, [workspace_id])
        resources = workspace_resources.get(workspace_id, [])
        
        return {
            "success": True,
            "user_id": user_id,
            "workspace_id": workspace_id,
            "resources": [resource.dict() for resource in resources],
            "total_resources": len(resources)
        }
    except Exception as e:
        logger.error(f"Error getting resources for workspace {workspace_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/users/{user_id}/workspaces/{workspace_id}/threads")
def get_workspace_threads_endpoint(user_id: str, workspace_id: str):
    """Get available threads for user in a workspace"""
    try:
        threads = get_user_workspace_threads(user_id, workspace_id)
        return {
            "success": True,
            "user_id": user_id,
            "workspace_id": workspace_id,
            "threads": threads,
            "total_threads": len(threads)
        }
    except Exception as e:
        logger.error(f"Error getting threads for workspace {workspace_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/users/{user_id}/study-plans")
def get_user_study_plans_endpoint(user_id: str):
    """Get user's study plan history"""
    try:
        plans = get_user_study_plans(user_id)
        return {
            "success": True,
            "user_id": user_id,
            "study_plans": plans,
            "total_plans": len(plans)
        }
    except Exception as e:
        logger.error(f"Error getting study plans for user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/users/{user_id}/progress")
def update_progress_endpoint(user_id: str, progress_update: ProgressUpdateRequest):
    """Update user's progress on a resource"""
    try:
        update_resource_progress(
            user_id=user_id,
            resource_id=progress_update.resource_id,
            completion_status=progress_update.completion_status.value,
            progress_percentage=progress_update.progress_percentage,
            actual_time_spent=progress_update.actual_time_spent
        )
        
        return {
            "success": True,
            "user_id": user_id,
            "resource_id": progress_update.resource_id,
            "message": "Progress updated successfully"
        }
    except Exception as e:
        logger.error(f"Error updating progress: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analytics/feasibility")
def analyze_feasibility(request: StudyPlanRequest):
    """Analyze feasibility of a study plan request"""
    try:
        # Calculate weekly hours if not provided
        if not request.weekly_hours_available:
            request.weekly_hours_available = int(calculate_weekly_hours_from_slots(request.user_id))
        
        # Get workspace resources
        workspace_resources = get_workspace_resources(request.user_id, request.workspace_ids)
        
        # Calculate total required hours
        all_resources = []
        for workspace_id, resources in workspace_resources.items():
            if workspace_id in request.workspace_ids:
                selected_threads = request.selected_threads.get(workspace_id, [])
                for resource in resources:
                    if resource.thread_id in selected_threads:
                        all_resources.append(resource)
        
        estimates = StudyPlanAnalytics.estimate_completion_time(all_resources)
        total_required_hours = sum(estimates.values())
        
        # Calculate weeks until deadline
        if request.deadline:
            from datetime import datetime
            weeks_until_deadline = max(1, (request.deadline - datetime.now().date()).days // 7)
        else:
            weeks_until_deadline = 4  # Default to 4 weeks
        
        # Generate feasibility report
        report = StudyPlanAnalytics.generate_feasibility_report(
            total_required_hours,
            request.weekly_hours_available,
            weeks_until_deadline
        )
        
        # Add optimization suggestions
        suggestions = StudyPlanAnalytics.suggest_schedule_optimizations(
            all_resources, request.weekly_hours_available
        )
        report["optimization_suggestions"] = suggestions
        
        return {
            "success": True,
            "feasibility_report": report,
            "total_resources": len(all_resources),
            "weekly_hours_calculated": request.weekly_hours_available
        }
        
    except Exception as e:
        logger.error(f"Error analyzing feasibility: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/env-check")
def env_check():
    """Environment configuration check (development only)"""
    from config import KAFKA_BROKER_URL, DATABASE_URL
    return {
        "KAFKA_BROKER_URL": KAFKA_BROKER_URL,
        "DATABASE_URL": DATABASE_URL[:50] + "..." if DATABASE_URL else None  # Truncate for security
    }

# Legacy endpoint for backward compatibility
@app.get("/db-test/{user_id}")
def db_test(user_id: str):
    """Legacy database test endpoint"""
    try:
        slots = get_free_slots(user_id)
        weekly_hours = calculate_weekly_hours_from_slots(user_id)
        return {
            "success": True, 
            "slots": [(slot.day_of_week, slot.start_time, slot.end_time) for slot in slots],
            "weekly_hours": weekly_hours
        }
    except Exception as e:
        return {"success": False, "error": str(e)}