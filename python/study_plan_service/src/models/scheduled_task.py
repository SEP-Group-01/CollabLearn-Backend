"""
Scheduled Task Models
Represents individual study/revision tasks scheduled in time slots
"""
from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import date, time, datetime
from uuid import UUID


class ScheduledTaskCreate(BaseModel):
    """Model for creating a scheduled task"""
    study_plan_id: UUID
    study_slot_id: UUID
    user_id: UUID
    resource_id: UUID
    workspace_id: UUID
    thread_id: UUID
    task_title: str = Field(..., max_length=500)
    task_type: str = Field(..., pattern="^(study|revision)$")
    week_number: int = Field(..., ge=1)
    day_of_week: int = Field(..., ge=0, le=6)
    scheduled_date: date
    start_time: str
    end_time: str
    allocated_minutes: int = Field(..., gt=0)
    
    @validator('start_time', 'end_time')
    def validate_time_format(cls, v):
        """Validate time format"""
        try:
            time.fromisoformat(v)
            return v
        except ValueError:
            raise ValueError(f"Invalid time format: {v}. Expected HH:MM format")


class ScheduledTaskUpdate(BaseModel):
    """Model for updating a scheduled task"""
    status: Optional[str] = Field(None, pattern="^(pending|in_progress|completed|skipped)$")
    completion_percentage: Optional[int] = Field(None, ge=0, le=100)
    actual_time_spent: Optional[int] = Field(None, ge=0)
    rating: Optional[int] = Field(None, ge=1, le=5)
    notes: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class ScheduledTaskResponse(BaseModel):
    """Model for scheduled task response"""
    id: UUID
    study_plan_id: UUID
    study_slot_id: UUID
    user_id: UUID
    resource_id: UUID
    workspace_id: UUID
    thread_id: UUID
    task_title: str
    task_type: str
    week_number: int
    day_of_week: int
    scheduled_date: str
    start_time: str
    end_time: str
    allocated_minutes: int
    actual_time_spent: int
    status: str
    completion_percentage: int
    rating: Optional[int] = None
    notes: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


class ScheduledTaskWithDetails(ScheduledTaskResponse):
    """Scheduled task with workspace, thread, and resource details"""
    workspace_title: Optional[str] = None
    thread_title: Optional[str] = None
    resource_title: Optional[str] = None
    resource_type: Optional[str] = None


class TaskProgressUpdate(BaseModel):
    """Model for updating task progress"""
    task_id: UUID
    user_id: UUID
    completion_percentage: Optional[int] = Field(None, ge=0, le=100)
    actual_time_spent: Optional[int] = Field(None, ge=0)
    status: Optional[str] = None
    rating: Optional[int] = Field(None, ge=1, le=5)
    notes: Optional[str] = None
