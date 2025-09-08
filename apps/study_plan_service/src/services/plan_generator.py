from models.study_plan import StudyPlanRequest, StudyPlanResult

def generate_study_plan(request: StudyPlanRequest, free_slots):
    # Simple logic: fill slots, calculate weeks required
    total_tasks = len(request.focus_areas)
    slots_per_week = len(free_slots)
    if slots_per_week == 0:
        return None, "No free slots available. Please add slots."
    weeks_required = (total_tasks + slots_per_week - 1) // slots_per_week
    schedule = []
    for i, slot in enumerate(free_slots):
        if i < total_tasks:
            schedule.append({
                "day": slot[0],
                "start_time": slot[1],
                "end_time": slot[2],
                "task": request.focus_areas[i]
            })
    result = StudyPlanResult(
        schedule=schedule,
        focus=request.focus_areas,
        method=request.learning_style,
        mode=request.study_mode,
        resources=[],
        weeks_required=weeks_required,
        message=f"With your current slots, you need {weeks_required} weeks."
    )
    return result, None