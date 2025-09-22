from pydantic import BaseModel
from typing import List, Optional, Dict, Union
from datetime import datetime, date
from enum import Enum

class CompletionStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress" 
    COMPLETED = "completed"
    NEEDS_REVISION = "needs_revision"

class ResourceType(str, Enum):
    VIDEO = "video"
    DOCUMENT = "document"
    QUIZ = "quiz"
    LINK = "link"
    READING = "reading"

class StudyResource(BaseModel):
    id: str
    name: str
    type: ResourceType
    thread_id: str
    sequence_number: int
    estimated_time_minutes: int
    actual_time_spent: Optional[int] = 0
    completion_status: CompletionStatus = CompletionStatus.NOT_STARTED
    progress_percentage: Optional[float] = 0.0
    workspace_id: str

class WorkspaceThread(BaseModel):
    thread_id: str
    workspace_id: str
    name: str
    resources: List[StudyResource]
    total_estimated_hours: float

class StudyPlanRequest(BaseModel):
    user_id: str
    workspace_ids: List[str]  # Multiple workspaces
    selected_threads: Dict[str, List[str]]  # workspace_id -> thread_ids
    deadline: Optional[date] = None  # Target completion date
    weekly_hours_available: Optional[int] = None  # Will be calculated from time slots if not provided
    learning_style: str
    study_mode: str
    custom_goal: Optional[str] = None
    include_quizzes: bool = True
    balance_workload: bool = True  # Distribute work evenly across weeks
    
    def calculate_weekly_hours_from_database(self) -> float:
        """
        Calculate weekly hours from user's time slots in database
        This method should be called after object creation with database access
        """
        from database import calculate_weekly_hours_from_slots
        return calculate_weekly_hours_from_slots(self.user_id)

class TimeSlot(BaseModel):
    day_of_week: str
    start_time: str
    end_time: str
    duration_minutes: int
    is_available: bool = True

class ScheduledTask(BaseModel):
    resource: StudyResource
    time_slot: TimeSlot
    week_number: int
    allocated_time_minutes: int
    workspace_id: str
    thread_id: str

class StudyPlanResult(BaseModel):
    user_id: str
    schedule: List[ScheduledTask]
    total_weeks: int
    total_hours_allocated: float
    total_hours_required: float
    coverage_percentage: float  # How much content can be covered
    workspaces_included: List[str]
    message: str
    optimization_details: Dict[str, Union[str, float, int]]
    unscheduled_resources: List[StudyResource] = []