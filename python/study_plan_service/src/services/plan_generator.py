# from models.study_plan import StudyPlanRequest, StudyPlanResult

# def generate_study_plan(request: StudyPlanRequest, free_slots):
#     # Simple logic: fill slots, calculate weeks required
#     total_tasks = len(request.focus_areas)
#     slots_per_week = len(free_slots)
#     if slots_per_week == 0:
#         return None, "No free slots available. Please add slots."
#     weeks_required = (total_tasks + slots_per_week - 1) // slots_per_week
#     schedule = []
#     for i, slot in enumerate(free_slots):
#         if i < total_tasks:
#             schedule.append({
#                 "day": slot[0],
#                 "start_time": slot[1],
#                 "end_time": slot[2],
#                 "task": request.focus_areas[i]
#             })
#     result = StudyPlanResult(
#         schedule=schedule,
#         focus=request.focus_areas,
#         method=request.learning_style,
#         mode=request.study_mode,
#         resources=[],
#         weeks_required=weeks_required,
#         message=f"With your current slots, you need {weeks_required} weeks."
#     )
#     return result, None


from pulp import LpProblem, LpVariable, LpMinimize, lpSum, LpBinary
from models.study_plan import StudyPlanRequest, StudyPlanResult

def generate_study_plan_optimized(request: StudyPlanRequest, free_slots):
    # Each task can be assigned to one slot per week
    tasks = request.focus_areas
    slots = free_slots
    n_tasks = len(tasks)
    n_slots = len(slots)

    # Create the problem
    prob = LpProblem("StudyPlanScheduling", LpMinimize)

    # Decision variables: x[i][j] = 1 if task i is assigned to slot j
    x = [[LpVariable(f"x_{i}_{j}", cat=LpBinary) for j in range(n_slots)] for i in range(n_tasks)]

    # Objective: minimize the number of weeks required
    # (You can customize this for priorities, etc.)
    prob += lpSum(x[i][j] for i in range(n_tasks) for j in range(n_slots))

    # Constraints: Each task assigned to at most one slot
    for i in range(n_tasks):
        prob += lpSum(x[i][j] for j in range(n_slots)) <= 1

    # Each slot gets at most one task
    for j in range(n_slots):
        prob += lpSum(x[i][j] for i in range(n_tasks)) <= 1

    # Solve
    prob.solve()

    # Build schedule
    schedule = []
    for i in range(n_tasks):
        for j in range(n_slots):
            if x[i][j].varValue == 1:
                slot = slots[j]
                schedule.append({
                    "day": slot[0],
                    "start_time": slot[1],
                    "end_time": slot[2],
                    "task": tasks[i]
                })

    weeks_required = (n_tasks + n_slots - 1) // n_slots
    result = StudyPlanResult(
        schedule=schedule,
        focus=request.focus_areas,
        method=request.learning_style,
        mode=request.study_mode,
        resources=[],
        weeks_required=weeks_required,
        message=f"Optimized: You need {weeks_required} weeks."
    )
    return result, None