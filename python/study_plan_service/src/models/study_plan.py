"""
Study Plan Models
Represents generated study plans with scheduling rules and configurations
"""
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List
from datetime import datetime, date
from uuid import UUID
from enum import Enum


class PlanStatus(str, Enum):
    """Study plan status enumeration"""
    ACTIVE = "active"
    COMPLETED = "completed"
    DROPPED = "dropped"


class SchedulingRules(BaseModel):
    """Rules for scheduling study tasks"""
    max_consecutive_same_resource: int = Field(default=2, ge=1, le=5)
    mix_threads_across_workspaces: bool = Field(default=True)
    balance_workspace_focus: bool = Field(default=True)


class ResourceInput(BaseModel):
    """Resource information for study plan generation"""
    workspace_id: UUID
    thread_id: UUID
    resource_id: UUID
    title: str
    remaining_minutes: int = Field(..., gt=0)
    include_revision: bool = Field(default=False)
    resource_type: Optional[str] = None


class SlotInput(BaseModel):
    """Time slot information for study plan generation"""
    slot_id: Optional[UUID] = None  # If slot already exists in DB
    week_number: int = Field(..., ge=1)
    day_of_week: int = Field(..., ge=0, le=6)
    start_time: str
    end_time: str
    
    @validator('start_time', 'end_time')
    def validate_time_format(cls, v):
        """Validate time format"""
        from datetime import time
        try:
            time.fromisoformat(v)
            return v
        except ValueError:
            raise ValueError(f"Invalid time format: {v}. Expected HH:MM format")


class StudyPlanRequest(BaseModel):
    """Request model for generating study plan"""
    user_id: UUID
    max_weeks: int = Field(..., ge=1, le=52, description="Maximum number of weeks for the plan")
    revision_ratio: float = Field(default=0.25, ge=0.0, le=1.0, description="Ratio of time for revision")
    scheduling_rules: Optional[SchedulingRules] = Field(default_factory=SchedulingRules)
    slots: List[SlotInput] = Field(..., min_items=1, description="Available time slots")
    resources: List[ResourceInput] = Field(..., min_items=1, description="Resources to study")


class StudyPlanCreate(BaseModel):
    """Model for creating a new study plan"""
    user_id: UUID
    max_weeks: int = Field(..., ge=1)
    revision_ratio: float = Field(default=0.25, ge=0.0, le=1.0)
    scheduling_rules: Dict[str, Any] = Field(default_factory=dict)
    plan_start_date: date
    plan_end_date: date
    status: PlanStatus = PlanStatus.ACTIVE


class StudyPlanUpdate(BaseModel):
    """Model for updating study plan"""
    status: Optional[PlanStatus] = None
    completed_at: Optional[datetime] = None
    dropped_at: Optional[datetime] = None


class StudyPlanResponse(BaseModel):
    """Model for study plan response"""
    id: UUID
    user_id: UUID
    max_weeks: int
    revision_ratio: float
    scheduling_rules: Dict[str, Any]
    status: str
    plan_start_date: str
    plan_end_date: str
    generated_at: str
    completed_at: Optional[str] = None
    dropped_at: Optional[str] = None
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


class ScheduledResourceOutput(BaseModel):
    """Resource scheduled in a time slot"""
    resource_id: UUID
    title: str
    workspace_id: UUID
    thread_id: UUID
    workspace_title: Optional[str] = None
    thread_title: Optional[str] = None
    allocated_minutes: int
    task_type: str  # 'study' or 'revision'
    task_id: Optional[UUID] = None


class ScheduleSlotOutput(BaseModel):
    """Time slot with scheduled resources"""
    slot_id: UUID
    week_number: int
    day_of_week: int
    day_name: str
    scheduled_date: str
    start_time: str
    end_time: str
    assigned_resources: List[ScheduledResourceOutput] = Field(default_factory=list)


class StudyPlanGenerationResponse(BaseModel):
    """Response model for generated study plan"""
    plan_id: UUID
    user_id: UUID
    max_weeks: int
    revision_ratio: float
    plan_start_date: str
    plan_end_date: str
    generated_at: str
    total_study_hours: float
    total_revision_hours: float
    schedule: List[ScheduleSlotOutput] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    success: bool = True


class CompletionStatus(str, Enum):
    """Task completion status"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    SKIPPED = "skipped"
