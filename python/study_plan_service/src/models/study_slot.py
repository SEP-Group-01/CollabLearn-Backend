"""
Study Slot Models
Represents user's available time slots for studying (recurring weekly)
"""
from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import time
from uuid import UUID


class StudySlotBase(BaseModel):
    """Base model for study slot"""
    day_of_week: int = Field(..., ge=0, le=6, description="Day of week: 0=Sunday, 1=Monday, ..., 6=Saturday")
    start_time: str = Field(..., description="Start time in HH:MM format")
    end_time: str = Field(..., description="End time in HH:MM format")
    
    @validator('start_time', 'end_time')
    def validate_time_format(cls, v):
        """Validate time format"""
        try:
            time.fromisoformat(v)
            return v
        except ValueError:
            raise ValueError(f"Invalid time format: {v}. Expected HH:MM format")
    
    @validator('end_time')
    def validate_time_range(cls, v, values):
        """Validate that end_time is after start_time and minimum 1 hour"""
        if 'start_time' in values:
            start = time.fromisoformat(values['start_time'])
            end = time.fromisoformat(v)
            
            # Convert to minutes for comparison
            start_minutes = start.hour * 60 + start.minute
            end_minutes = end.hour * 60 + end.minute
            
            if end_minutes <= start_minutes:
                raise ValueError("end_time must be after start_time")
            
            duration = end_minutes - start_minutes
            if duration < 60:
                raise ValueError("Minimum slot duration is 60 minutes")
        
        return v


class StudySlotCreate(StudySlotBase):
    """Model for creating a new study slot"""
    user_id: UUID


class StudySlotUpdate(BaseModel):
    """Model for updating a study slot"""
    day_of_week: Optional[int] = Field(None, ge=0, le=6)
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    is_free: Optional[bool] = None


class StudySlotResponse(StudySlotBase):
    """Model for study slot response"""
    id: UUID
    user_id: UUID
    is_free: bool = True
    duration_minutes: Optional[int] = None
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


class StudySlotWithTasks(StudySlotResponse):
    """Study slot with scheduled tasks information"""
    scheduled_tasks: list = Field(default_factory=list)


class DayOfWeekEnum:
    """Helper class for day of week mappings"""
    SUNDAY = 0
    MONDAY = 1
    TUESDAY = 2
    WEDNESDAY = 3
    THURSDAY = 4
    FRIDAY = 5
    SATURDAY = 6
    
    @classmethod
    def get_name(cls, day: int) -> str:
        """Get day name from number"""
        names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        return names[day] if 0 <= day <= 6 else "Unknown"
    
    @classmethod
    def get_number(cls, name: str) -> int:
        """Get day number from name"""
        names = {
            "sunday": 0, "monday": 1, "tuesday": 2, "wednesday": 3,
            "thursday": 4, "friday": 5, "saturday": 6
        }
        return names.get(name.lower(), -1)
