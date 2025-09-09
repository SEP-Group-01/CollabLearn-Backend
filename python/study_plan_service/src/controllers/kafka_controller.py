from models.study_plan import StudyPlanRequest
from database import get_free_slots, save_study_plan
from services.plan_generator import generate_study_plan
from kafka_service.producer import send_result

def handle_study_plan_request(data):
    request = StudyPlanRequest(**data)
    free_slots = get_free_slots(request.user_id)
    result, error = generate_study_plan(request, free_slots)
    status = "done" if result else "error"
    save_study_plan(request.user_id, data, result.dict() if result else None, status, result.weeks_required if result else 0, error)
    send_result(result.dict() if result else {"error": error})