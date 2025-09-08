from pydantic import BaseModel

class StudySlot(BaseModel):
    day_of_week: str
    start_time: str
    end_time: str
    is_free: bool