from pydantic import BaseModel
from typing import List, Optional

class StudyPlanRequest(BaseModel):
    user_id: str
    learning_goal: str
    custom_goal: Optional[str]
    focus_areas: List[str]
    hours_per_day: int
    available_days: List[str]
    learning_style: str
    study_mode: str

class StudyPlanResult(BaseModel):
    schedule: List[dict]
    focus: List[str]
    method: str
    mode: str
    resources: List[str]
    weeks_required: int
    message: str