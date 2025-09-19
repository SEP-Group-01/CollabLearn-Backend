from pulp import LpProblem, LpVariable, LpMaximize, lpSum, LpBinary, LpStatus, value
from models.study_plan import (
    StudyPlanRequest, StudyPlanResult, StudyResource, TimeSlot, 
    ScheduledTask, CompletionStatus, ResourceType
)
from typing import List, Dict, Tuple
from datetime import datetime, timedelta
import math

def calculate_adjusted_time(resource: StudyResource) -> int:
    """Calculate time needed based on completion status and resource type"""
    base_time = resource.estimated_time_minutes
    
    if resource.completion_status == CompletionStatus.COMPLETED:
        return 0
    elif resource.completion_status == CompletionStatus.NEEDS_REVISION:
        return int(base_time * 0.5)  # Half time for revision
    elif resource.completion_status == CompletionStatus.IN_PROGRESS:
        remaining = 1.0 - (resource.progress_percentage / 100.0)
        return int(base_time * remaining)
    else:  # NOT_STARTED
        # Add buffer time for different resource types
        if resource.type == ResourceType.VIDEO:
            return int(base_time * 1.2)  # 20% buffer for pausing
        elif resource.type == ResourceType.QUIZ:
            return int(base_time * 1.5)  # 50% buffer for thinking
        else:
            return base_time

def generate_optimized_study_plan(
    request: StudyPlanRequest, 
    time_slots: List[TimeSlot],
    workspace_resources: Dict[str, List[StudyResource]]
) -> Tuple[StudyPlanResult, str]:
    """
    Advanced OR-based study plan generation with multi-workspace optimization
    """
    
    # Prepare all resources from selected workspaces/threads
    all_resources = []
    for workspace_id, resources in workspace_resources.items():
        if workspace_id in request.workspace_ids:
            selected_thread_ids = request.selected_threads.get(workspace_id, [])
            for resource in resources:
                if resource.thread_id in selected_thread_ids:
                    all_resources.append(resource)
    
    # Sort resources by sequence number within threads
    all_resources.sort(key=lambda x: (x.workspace_id, x.thread_id, x.sequence_number))
    
    # Calculate available time slots
    total_available_minutes = sum(slot.duration_minutes for slot in time_slots if slot.is_available)
    
    # Calculate required time for all resources
    total_required_minutes = sum(calculate_adjusted_time(r) for r in all_resources)
    
    if total_available_minutes == 0:
        return None, "No available time slots found"
    
    # Calculate weeks available
    if request.deadline:
        weeks_available = max(1, (request.deadline - datetime.now().date()).days // 7)
    else:
        weeks_available = math.ceil(total_required_minutes / (request.weekly_hours_available * 60))
    
    # Create optimization problem
    prob = LpProblem("MultiWorkspaceStudyPlan", LpMaximize)
    
    # Decision variables: x[r][s][w] = 1 if resource r is assigned to slot s in week w
    n_resources = len(all_resources)
    n_slots = len(time_slots)
    n_weeks = weeks_available
    
    # Binary variables for assignment
    x = {}
    for r in range(n_resources):
        for s in range(n_slots):
            for w in range(n_weeks):
                x[(r, s, w)] = LpVariable(f"x_{r}_{s}_{w}", cat=LpBinary)
    
    # Objective: Maximize coverage (weighted by priority and resource type)
    priority_weights = {
        ResourceType.QUIZ: 3.0,  # Higher priority for quizzes
        ResourceType.VIDEO: 2.0,
        ResourceType.DOCUMENT: 1.5,
        ResourceType.READING: 1.0,
        ResourceType.LINK: 1.0
    }
    
    objective = lpSum([
        x[(r, s, w)] * priority_weights.get(all_resources[r].type, 1.0)
        for r in range(n_resources)
        for s in range(n_slots)
        for w in range(n_weeks)
    ])
    prob += objective
    
    # Constraints
    
    # 1. Each resource can be assigned to at most one slot
    for r in range(n_resources):
        prob += lpSum([x[(r, s, w)] for s in range(n_slots) for w in range(n_weeks)]) <= 1
    
    # 2. Each time slot can have at most one resource per week
    for s in range(n_slots):
        for w in range(n_weeks):
            prob += lpSum([x[(r, s, w)] for r in range(n_resources)]) <= 1
    
    # 3. Time constraint: resource time must fit in slot
    for r in range(n_resources):
        for s in range(n_slots):
            for w in range(n_weeks):
                resource_time = calculate_adjusted_time(all_resources[r])
                if resource_time > time_slots[s].duration_minutes:
                    prob += x[(r, s, w)] == 0
    
    # 4. Sequence constraint: maintain order within threads
    for i in range(n_resources - 1):
        for j in range(i + 1, n_resources):
            res_i = all_resources[i]
            res_j = all_resources[j]
            
            # If same thread and sequence, maintain order
            if (res_i.thread_id == res_j.thread_id and 
                res_i.sequence_number < res_j.sequence_number):
                
                # res_i must be scheduled before res_j
                for w_i in range(n_weeks):
                    for w_j in range(w_i + 1):
                        prob += lpSum([x[(i, s, w_i)] for s in range(n_slots)]) >= \
                               lpSum([x[(j, s, w_j)] for s in range(n_slots)])
    
    # 5. Workload balancing constraint (if requested)
    if request.balance_workload:
        avg_resources_per_week = len(all_resources) / n_weeks
        for w in range(n_weeks):
            week_assignments = lpSum([x[(r, s, w)] for r in range(n_resources) for s in range(n_slots)])
            prob += week_assignments <= avg_resources_per_week * 1.5  # Allow 50% deviation
            prob += week_assignments >= avg_resources_per_week * 0.5
    
    # Solve the problem
    prob.solve()
    
    if LpStatus[prob.status] != 'Optimal':
        return None, f"Optimization failed: {LpStatus[prob.status]}"
    
    # Extract solution
    scheduled_tasks = []
    scheduled_resources = set()
    
    for r in range(n_resources):
        for s in range(n_slots):
            for w in range(n_weeks):
                if value(x[(r, s, w)]) == 1:
                    resource = all_resources[r]
                    time_slot = time_slots[s]
                    
                    scheduled_task = ScheduledTask(
                        resource=resource,
                        time_slot=time_slot,
                        week_number=w + 1,
                        allocated_time_minutes=calculate_adjusted_time(resource),
                        workspace_id=resource.workspace_id,
                        thread_id=resource.thread_id
                    )
                    scheduled_tasks.append(scheduled_task)
                    scheduled_resources.add(r)
    
    # Calculate metrics
    total_hours_allocated = sum(task.allocated_time_minutes for task in scheduled_tasks) / 60
    total_hours_required = total_required_minutes / 60
    coverage_percentage = (len(scheduled_resources) / len(all_resources)) * 100 if all_resources else 0
    
    # Find unscheduled resources
    unscheduled_resources = [
        all_resources[r] for r in range(n_resources) 
        if r not in scheduled_resources
    ]
    
    # Create optimization details
    optimization_details = {
        "algorithm": "Integer Linear Programming (PuLP)",
        "objective_value": value(prob.objective),
        "total_variables": len(x),
        "solver_status": LpStatus[prob.status],
        "resources_scheduled": len(scheduled_resources),
        "resources_total": len(all_resources)
    }
    
    # Generate message
    if coverage_percentage == 100:
        message = f"Perfect! All {len(all_resources)} resources scheduled across {n_weeks} weeks."
    elif coverage_percentage >= 80:
        message = f"Good coverage: {len(scheduled_resources)}/{len(all_resources)} resources scheduled. Consider adding more time slots for remaining {len(unscheduled_resources)} items."
    else:
        message = f"Limited coverage: Only {coverage_percentage:.1f}% of content can fit. Add more free slots or extend deadline to cover remaining {len(unscheduled_resources)} resources."
    
    result = StudyPlanResult(
        user_id=request.user_id,
        schedule=scheduled_tasks,
        total_weeks=n_weeks,
        total_hours_allocated=total_hours_allocated,
        total_hours_required=total_hours_required,
        coverage_percentage=coverage_percentage,
        workspaces_included=request.workspace_ids,
        message=message,
        optimization_details=optimization_details,
        unscheduled_resources=unscheduled_resources
    )
    
    return result, None

# Keep the old function for backward compatibility
def generate_study_plan(request: StudyPlanRequest, free_slots):
    """Legacy function - converts old format to new format"""
    # Convert old format to new format
    time_slots = []
    for slot in free_slots:
        time_slot = TimeSlot(
            day_of_week=slot[0],
            start_time=slot[1],
            end_time=slot[2],
            duration_minutes=60,  # Default 1 hour
            is_available=True
        )
        time_slots.append(time_slot)
    
    # Create dummy workspace resources from focus areas
    workspace_resources = {}
    if hasattr(request, 'focus_areas') and request.focus_areas:
        dummy_resources = []
        for i, area in enumerate(request.focus_areas):
            resource = StudyResource(
                id=f"legacy_{i}",
                name=area,
                type=ResourceType.READING,
                thread_id="legacy_thread",
                sequence_number=i,
                estimated_time_minutes=60,
                workspace_id="legacy_workspace"
            )
            dummy_resources.append(resource)
        workspace_resources["legacy_workspace"] = dummy_resources
        
        # Update request format
        request.workspace_ids = ["legacy_workspace"]
        request.selected_threads = {"legacy_workspace": ["legacy_thread"]}
        request.weekly_hours_available = getattr(request, 'hours_per_day', 2) * 7
    
    return generate_optimized_study_plan(request, time_slots, workspace_resources)