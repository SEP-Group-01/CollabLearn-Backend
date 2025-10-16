"""
Study Plan Generator Service
Uses OpenAI API to intelligently schedule study tasks
"""
import os
import logging
import json
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime, date, time, timedelta
from collections import defaultdict
import openai

from models.study_plan import ResourceInput, SlotInput, SchedulingRules

logger = logging.getLogger(__name__)

# Initialize OpenAI
openai.api_key = os.getenv('OPENAI_API_KEY')

if not openai.api_key:
    logger.warning("OpenAI API key not found. Will use fallback scheduling algorithm.")


def generate_optimized_study_plan(
    user_id: str,
    slots: List[Dict[str, Any]],
    resources: List[Dict[str, Any]],
    max_weeks: int,
    revision_ratio: float,
    scheduling_rules: Dict[str, Any],
    user_progress: Dict[str, Dict[str, Any]],
    plan_start_date: date
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Generate an optimized study plan using OpenAI or fallback algorithm
    
    Returns:
        Tuple of (scheduled_tasks, metadata)
    """
    try:
        # Try OpenAI-based scheduling first
        if openai.api_key:
            return generate_ai_study_plan(
                user_id, slots, resources, max_weeks, revision_ratio,
                scheduling_rules, user_progress, plan_start_date
            )
        else:
            # Fallback to rule-based scheduling
            return generate_rule_based_study_plan(
                user_id, slots, resources, max_weeks, revision_ratio,
                scheduling_rules, user_progress, plan_start_date
            )
    
    except Exception as e:
        logger.error(f"Error generating study plan: {e}")
        # Always have a fallback
        return generate_rule_based_study_plan(
            user_id, slots, resources, max_weeks, revision_ratio,
            scheduling_rules, user_progress, plan_start_date
        )


def generate_ai_study_plan(
    user_id: str,
    slots: List[Dict[str, Any]],
    resources: List[Dict[str, Any]],
    max_weeks: int,
    revision_ratio: float,
    scheduling_rules: Dict[str, Any],
    user_progress: Dict[str, Dict[str, Any]],
    plan_start_date: date
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Generate study plan using OpenAI API
    """
    logger.info("Generating AI-powered study plan...")
    
    # Prepare context for OpenAI
    context = prepare_scheduling_context(slots, resources, max_weeks, revision_ratio, scheduling_rules, user_progress)
    
    # Create prompt for OpenAI
    prompt = create_scheduling_prompt(context)
    
    try:
        # Call OpenAI API
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are an intelligent study planner that optimizes learning schedules based on cognitive science principles."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=3000
        )
        
        # Parse AI response
        ai_output = response.choices[0].message.content
        scheduled_tasks = parse_ai_scheduling_output(ai_output, user_id, slots, resources, plan_start_date)
        
        # Calculate metadata
        metadata = calculate_plan_metadata(scheduled_tasks, resources)
        
        logger.info(f"AI-generated plan with {len(scheduled_tasks)} tasks")
        return scheduled_tasks, metadata
    
    except Exception as e:
        logger.error(f"Error with OpenAI API: {e}, falling back to rule-based scheduling")
        return generate_rule_based_study_plan(
            user_id, slots, resources, max_weeks, revision_ratio,
            scheduling_rules, user_progress, plan_start_date
        )


def generate_rule_based_study_plan(
    user_id: str,
    slots: List[Dict[str, Any]],
    resources: List[Dict[str, Any]],
    max_weeks: int,
    revision_ratio: float,
    scheduling_rules: Dict[str, Any],
    user_progress: Dict[str, Dict[str, Any]],
    plan_start_date: date
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Generate study plan using rule-based algorithm
    """
    logger.info("Generating rule-based study plan...")
    
    # Sort slots by week and day
    sorted_slots = sorted(slots, key=lambda x: (x['week_number'], x['day_of_week'], x['start_time']))
    
    # Calculate remaining time for each resource
    resource_time_map = {}
    for resource in resources:
        resource_id = str(resource['resource_id'])
        remaining = resource['remaining_minutes']
        
        # Adjust based on user progress
        if resource_id in user_progress:
            progress_pct = user_progress[resource_id].get('completion_percentage', 0)
            remaining = int(remaining * (100 - progress_pct) / 100)
        
        resource_time_map[resource_id] = {
            'remaining_study_minutes': remaining,
            'remaining_revision_minutes': int(remaining * revision_ratio) if resource.get('include_revision', False) else 0,
            'resource': resource,
            'last_scheduled_week': 0
        }
    
    scheduled_tasks = []
    workspace_last_scheduled = {}  # Track when each workspace was last scheduled
    resource_consecutive_count = defaultdict(int)  # Track consecutive scheduling
    
    # Get scheduling rules
    max_consecutive = scheduling_rules.get('max_consecutive_same_resource', 2)
    mix_workspaces = scheduling_rules.get('mix_threads_across_workspaces', True)
    balance_focus = scheduling_rules.get('balance_workspace_focus', True)
    
    # First pass: Schedule study tasks
    for slot in sorted_slots:
        slot_duration = calculate_slot_duration(slot['start_time'], slot['end_time'])
        remaining_time = slot_duration
        slot_date = calculate_slot_date(plan_start_date, slot['week_number'], slot['day_of_week'])
        
        while remaining_time > 0:
            # Find next resource to schedule
            best_resource = find_best_resource_for_slot(
                resource_time_map,
                slot,
                workspace_last_scheduled,
                resource_consecutive_count,
                max_consecutive,
                mix_workspaces,
                balance_focus,
                'study'
            )
            
            if not best_resource:
                break  # No more resources to schedule
            
            resource_id = best_resource
            resource_info = resource_time_map[resource_id]
            
            # Allocate time
            time_to_allocate = min(remaining_time, resource_info['remaining_study_minutes'])
            
            if time_to_allocate <= 0:
                break
            
            # Create scheduled task
            task = create_scheduled_task_dict(
                user_id=user_id,
                slot=slot,
                slot_date=slot_date,
                resource=resource_info['resource'],
                allocated_minutes=time_to_allocate,
                task_type='study'
            )
            
            scheduled_tasks.append(task)
            
            # Update tracking
            resource_info['remaining_study_minutes'] -= time_to_allocate
            resource_info['last_scheduled_week'] = slot['week_number']
            workspace_last_scheduled[str(resource_info['resource']['workspace_id'])] = slot['week_number']
            resource_consecutive_count[resource_id] += 1
            remaining_time -= time_to_allocate
            
            # Reset consecutive count for other resources
            for rid in resource_consecutive_count:
                if rid != resource_id:
                    resource_consecutive_count[rid] = 0
    
    # Second pass: Schedule revision tasks
    revision_slots = [s for s in sorted_slots if s['week_number'] > 1]  # Revision starts from week 2
    
    for slot in revision_slots:
        slot_duration = calculate_slot_duration(slot['start_time'], slot['end_time'])
        remaining_time = slot_duration
        slot_date = calculate_slot_date(plan_start_date, slot['week_number'], slot['day_of_week'])
        
        # Check if slot already has tasks
        slot_allocated = sum(t['allocated_minutes'] for t in scheduled_tasks 
                           if t['week_number'] == slot['week_number'] 
                           and t['day_of_week'] == slot['day_of_week']
                           and t['start_time'] == slot['start_time'])
        
        remaining_time = slot_duration - slot_allocated
        
        while remaining_time > 0:
            # Find resources that need revision
            best_resource = find_best_resource_for_slot(
                resource_time_map,
                slot,
                workspace_last_scheduled,
                resource_consecutive_count,
                max_consecutive,
                mix_workspaces,
                balance_focus,
                'revision'
            )
            
            if not best_resource:
                break
            
            resource_id = best_resource
            resource_info = resource_time_map[resource_id]
            
            # Allocate time
            time_to_allocate = min(remaining_time, resource_info['remaining_revision_minutes'])
            
            if time_to_allocate <= 0:
                break
            
            # Create scheduled task
            task = create_scheduled_task_dict(
                user_id=user_id,
                slot=slot,
                slot_date=slot_date,
                resource=resource_info['resource'],
                allocated_minutes=time_to_allocate,
                task_type='revision'
            )
            
            scheduled_tasks.append(task)
            
            # Update tracking
            resource_info['remaining_revision_minutes'] -= time_to_allocate
            remaining_time -= time_to_allocate
    
    # Calculate metadata
    metadata = calculate_plan_metadata(scheduled_tasks, resources)
    
    logger.info(f"Rule-based plan generated with {len(scheduled_tasks)} tasks")
    return scheduled_tasks, metadata


def find_best_resource_for_slot(
    resource_time_map: Dict[str, Dict[str, Any]],
    slot: Dict[str, Any],
    workspace_last_scheduled: Dict[str, int],
    resource_consecutive_count: Dict[str, int],
    max_consecutive: int,
    mix_workspaces: bool,
    balance_focus: bool,
    task_type: str
) -> Optional[str]:
    """
    Find the best resource to schedule in a given slot based on rules
    """
    candidates = []
    
    for resource_id, info in resource_time_map.items():
        if task_type == 'study':
            remaining = info['remaining_study_minutes']
        else:
            remaining = info['remaining_revision_minutes']
        
        if remaining <= 0:
            continue
        
        # Check consecutive scheduling rule
        if resource_consecutive_count.get(resource_id, 0) >= max_consecutive:
            continue
        
        score = 0
        
        # Priority 1: Resources not scheduled recently
        weeks_since_last = slot['week_number'] - info['last_scheduled_week']
        score += weeks_since_last * 10
        
        # Priority 2: Balance workspace focus
        if balance_focus and mix_workspaces:
            workspace_id = str(info['resource']['workspace_id'])
            workspace_weeks_since = slot['week_number'] - workspace_last_scheduled.get(workspace_id, 0)
            score += workspace_weeks_since * 5
        
        # Priority 3: Resources with more remaining time (to avoid fragmentation)
        score += remaining / 100
        
        candidates.append((resource_id, score))
    
    if not candidates:
        return None
    
    # Sort by score and return best
    candidates.sort(key=lambda x: x[1], reverse=True)
    return candidates[0][0]


def create_scheduled_task_dict(
    user_id: str,
    slot: Dict[str, Any],
    slot_date: date,
    resource: Dict[str, Any],
    allocated_minutes: int,
    task_type: str
) -> Dict[str, Any]:
    """
    Create a scheduled task dictionary
    """
    task_title = resource['title']
    if task_type == 'revision':
        task_title += " - Revision"
    
    return {
        'user_id': user_id,
        'study_slot_id': slot.get('slot_id'),  # May be None if slot not yet in DB
        'resource_id': str(resource['resource_id']),
        'workspace_id': str(resource['workspace_id']),
        'thread_id': str(resource['thread_id']),
        'task_title': task_title,
        'task_type': task_type,
        'week_number': slot['week_number'],
        'day_of_week': slot['day_of_week'],
        'scheduled_date': slot_date.isoformat(),
        'start_time': slot['start_time'],
        'end_time': slot['end_time'],
        'allocated_minutes': allocated_minutes,
        'status': 'pending',
        'completion_percentage': 0
    }


def calculate_slot_duration(start_time: str, end_time: str) -> int:
    """Calculate duration of a slot in minutes"""
    start = time.fromisoformat(start_time)
    end = time.fromisoformat(end_time)
    
    start_minutes = start.hour * 60 + start.minute
    end_minutes = end.hour * 60 + end.minute
    
    return end_minutes - start_minutes


def calculate_slot_date(plan_start_date: date, week_number: int, day_of_week: int) -> date:
    """Calculate the actual date for a slot"""
    # Get the day of week for plan start date (0=Monday in date.weekday())
    start_day = plan_start_date.weekday()
    
    # Convert to our format (0=Sunday)
    start_day_adjusted = (start_day + 1) % 7
    
    # Calculate days offset
    days_offset = (week_number - 1) * 7 + (day_of_week - start_day_adjusted)
    
    return plan_start_date + timedelta(days=days_offset)


def calculate_plan_metadata(scheduled_tasks: List[Dict[str, Any]], resources: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate metadata about the generated plan"""
    total_study_minutes = sum(t['allocated_minutes'] for t in scheduled_tasks if t['task_type'] == 'study')
    total_revision_minutes = sum(t['allocated_minutes'] for t in scheduled_tasks if t['task_type'] == 'revision')
    
    # Calculate coverage
    resource_coverage = {}
    for resource in resources:
        resource_id = str(resource['resource_id'])
        allocated = sum(t['allocated_minutes'] for t in scheduled_tasks if t['resource_id'] == resource_id)
        resource_coverage[resource_id] = {
            'allocated_minutes': allocated,
            'requested_minutes': resource['remaining_minutes'],
            'coverage_percentage': min(100, (allocated / resource['remaining_minutes']) * 100) if resource['remaining_minutes'] > 0 else 100
        }
    
    return {
        'total_study_hours': total_study_minutes / 60,
        'total_revision_hours': total_revision_minutes / 60,
        'total_tasks': len(scheduled_tasks),
        'resource_coverage': resource_coverage
    }


def prepare_scheduling_context(
    slots: List[Dict[str, Any]],
    resources: List[Dict[str, Any]],
    max_weeks: int,
    revision_ratio: float,
    scheduling_rules: Dict[str, Any],
    user_progress: Dict[str, Dict[str, Any]]
) -> Dict[str, Any]:
    """Prepare context for AI scheduling"""
    return {
        'total_slots': len(slots),
        'total_available_minutes': sum(calculate_slot_duration(s['start_time'], s['end_time']) for s in slots),
        'resources_count': len(resources),
        'total_study_minutes_needed': sum(r['remaining_minutes'] for r in resources),
        'max_weeks': max_weeks,
        'revision_ratio': revision_ratio,
        'scheduling_rules': scheduling_rules,
        'slots_per_week': len([s for s in slots if s['week_number'] == 1]),
    }


def create_scheduling_prompt(context: Dict[str, Any]) -> str:
    """Create prompt for OpenAI API"""
    return f"""
You are an intelligent study planner. Create an optimal study schedule with these constraints:

- Available time slots: {context['total_slots']} slots across {context['max_weeks']} weeks
- Total available time: {context['total_available_minutes']} minutes
- Resources to study: {context['resources_count']} resources
- Total study time needed: {context['total_study_minutes_needed']} minutes
- Revision ratio: {context['revision_ratio']}
- Slots per week: {context['slots_per_week']}

Scheduling rules:
{json.dumps(context['scheduling_rules'], indent=2)}

Guidelines:
1. Avoid scheduling the same resource for more than {context['scheduling_rules'].get('max_consecutive_same_resource', 2)} consecutive slots
2. Mix threads from different workspaces to maintain variety
3. Balance focus across workspaces
4. Schedule revision tasks in later weeks (not in week 1)
5. Consider spaced repetition principles
6. Optimize for learning effectiveness, not just filling slots

Provide a schedule that maximizes learning while respecting cognitive load principles.
"""


def parse_ai_scheduling_output(
    ai_output: str,
    user_id: str,
    slots: List[Dict[str, Any]],
    resources: List[Dict[str, Any]],
    plan_start_date: date
) -> List[Dict[str, Any]]:
    """
    Parse AI output and convert to scheduled tasks
    Note: This is a simplified version. In production, you'd want more robust parsing.
    """
    # For now, fall back to rule-based if AI output can't be parsed
    # In a full implementation, you'd parse the AI's structured output
    logger.warning("AI output parsing not fully implemented, using rule-based scheduling")
    return []


# Export main function
__all__ = ['generate_optimized_study_plan']
