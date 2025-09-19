import psycopg2
import json
from config import DATABASE_URL
from models.study_plan import StudyResource, TimeSlot, ResourceType, CompletionStatus
from typing import List, Dict

def get_free_slots(user_id: str) -> List[TimeSlot]:
    """Get user's available time slots"""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT day_of_week, start_time, end_time, 
                   EXTRACT(EPOCH FROM (end_time::time - start_time::time))/60 as duration_minutes
            FROM study_slots 
            WHERE user_id=%s AND is_free=true
            ORDER BY 
                CASE day_of_week 
                    WHEN 'Monday' THEN 1
                    WHEN 'Tuesday' THEN 2
                    WHEN 'Wednesday' THEN 3
                    WHEN 'Thursday' THEN 4
                    WHEN 'Friday' THEN 5
                    WHEN 'Saturday' THEN 6
                    WHEN 'Sunday' THEN 7
                END,
                start_time
        """, (user_id,))
        
        slots = []
        for row in cur.fetchall():
            slot = TimeSlot(
                day_of_week=row[0],
                start_time=str(row[1]),
                end_time=str(row[2]),
                duration_minutes=int(row[3]),
                is_available=True
            )
            slots.append(slot)
        
        return slots
    finally:
        cur.close()
        conn.close()

def calculate_weekly_hours_from_slots(user_id: str) -> float:
    """
    Calculate total weekly hours based on user's daily time slots
    
    Args:
        user_id: User ID to calculate for
        
    Returns:
        float: Total weekly hours available
    """
    time_slots = get_free_slots(user_id)
    total_weekly_minutes = sum(slot.duration_minutes for slot in time_slots)
    weekly_hours = total_weekly_minutes / 60.0
    
    # Log for debugging
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"User {user_id} has {len(time_slots)} time slots totaling {weekly_hours:.2f} hours per week")
    
    return weekly_hours

def get_daily_time_breakdown(user_id: str) -> Dict[str, float]:
    """
    Get breakdown of available time by day of week
    
    Args:
        user_id: User ID
        
    Returns:
        dict: Day -> hours mapping
    """
    time_slots = get_free_slots(user_id)
    daily_breakdown = {}
    
    for slot in time_slots:
        day = slot.day_of_week
        hours = slot.duration_minutes / 60.0
        daily_breakdown[day] = daily_breakdown.get(day, 0) + hours
    
    return daily_breakdown

def get_workspace_resources(user_id: str, workspace_ids: List[str]) -> Dict[str, List[StudyResource]]:
    """Get all study resources for user's workspaces with progress tracking"""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    try:
        workspace_resources = {}
        
        for workspace_id in workspace_ids:
            # Get resources with user progress
            cur.execute("""
                SELECT 
                    r.id, r.name, r.type, r.thread_id, r.sequence_number,
                    r.estimated_time_minutes, r.workspace_id,
                    COALESCE(up.completion_status, 'not_started') as completion_status,
                    COALESCE(up.progress_percentage, 0) as progress_percentage,
                    COALESCE(up.actual_time_spent, 0) as actual_time_spent
                FROM study_resources r
                LEFT JOIN user_progress up ON r.id = up.resource_id AND up.user_id = %s
                WHERE r.workspace_id = %s
                ORDER BY r.thread_id, r.sequence_number
            """, (user_id, workspace_id))
            
            resources = []
            for row in cur.fetchall():
                resource = StudyResource(
                    id=row[0],
                    name=row[1],
                    type=ResourceType(row[2]),
                    thread_id=row[3],
                    sequence_number=row[4],
                    estimated_time_minutes=row[5],
                    workspace_id=row[6],
                    completion_status=CompletionStatus(row[7]),
                    progress_percentage=row[8],
                    actual_time_spent=row[9]
                )
                resources.append(resource)
            
            workspace_resources[workspace_id] = resources
        
        return workspace_resources
    finally:
        cur.close()
        conn.close()

def get_user_workspace_threads(user_id: str, workspace_id: str) -> List[str]:
    """Get thread IDs that user has access to in a workspace"""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT DISTINCT thread_id 
            FROM study_resources 
            WHERE workspace_id = %s
            AND thread_id IN (
                SELECT thread_id FROM user_workspace_threads 
                WHERE user_id = %s AND workspace_id = %s
            )
        """, (workspace_id, user_id, workspace_id))
        
        return [row[0] for row in cur.fetchall()]
    finally:
        cur.close()
        conn.close()

def save_study_plan(user_id: str, input_data: dict, result: dict, status: str, 
                   total_weeks: int, error_message: str = None) -> str:
    """Save study plan with enhanced tracking"""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    try:
        # Insert main study plan record
        cur.execute("""
            INSERT INTO study_plans 
            (user_id, input_data, result, status, total_weeks, error_message, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
            RETURNING id
        """, (user_id, json.dumps(input_data), json.dumps(result), status, total_weeks, error_message))
        
        plan_id = cur.fetchone()[0]
        
        # If successful, save scheduled tasks
        if status == "done" and result and "schedule" in result:
            for task in result["schedule"]:
                cur.execute("""
                    INSERT INTO scheduled_tasks 
                    (plan_id, user_id, resource_id, workspace_id, thread_id, 
                     week_number, day_of_week, start_time, end_time, allocated_time_minutes)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    plan_id, user_id, task["resource"]["id"], task["workspace_id"], 
                    task["thread_id"], task["week_number"], task["time_slot"]["day_of_week"],
                    task["time_slot"]["start_time"], task["time_slot"]["end_time"],
                    task["allocated_time_minutes"]
                ))
        
        conn.commit()
        return str(plan_id)
    finally:
        cur.close()
        conn.close()

def update_resource_progress(user_id: str, resource_id: str, 
                           completion_status: str, progress_percentage: float,
                           actual_time_spent: int):
    """Update user's progress on a resource"""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    try:
        cur.execute("""
            INSERT INTO user_progress 
            (user_id, resource_id, completion_status, progress_percentage, actual_time_spent, updated_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
            ON CONFLICT (user_id, resource_id) 
            DO UPDATE SET 
                completion_status = EXCLUDED.completion_status,
                progress_percentage = EXCLUDED.progress_percentage,
                actual_time_spent = EXCLUDED.actual_time_spent,
                updated_at = NOW()
        """, (user_id, resource_id, completion_status, progress_percentage, actual_time_spent))
        
        conn.commit()
    finally:
        cur.close()
        conn.close()

def get_user_study_plans(user_id: str) -> List[dict]:
    """Get user's study plan history"""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT id, status, total_weeks, created_at, 
                   (result->>'coverage_percentage')::float as coverage_percentage,
                   result->>'workspaces_included' as workspaces_included
            FROM study_plans 
            WHERE user_id = %s 
            ORDER BY created_at DESC
        """, (user_id,))
        
        plans = []
        for row in cur.fetchall():
            plans.append({
                "id": row[0],
                "status": row[1],
                "total_weeks": row[2],
                "created_at": row[3].isoformat(),
                "coverage_percentage": row[4],
                "workspaces_included": json.loads(row[5]) if row[5] else []
            })
        
        return plans
    finally:
        cur.close()
        conn.close()

# Legacy function for backward compatibility
def get_free_slots_legacy(user_id):
    """Legacy function - returns old format"""
    slots = get_free_slots(user_id)
    return [(slot.day_of_week, slot.start_time, slot.end_time) for slot in slots]