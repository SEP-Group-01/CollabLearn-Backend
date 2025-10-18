"""
Database operations for Study Plan Service
Handles all database interactions using Supabase
"""
import os
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, date, time, timedelta
from uuid import UUID
from supabase import create_client, Client

from models.study_slot import StudySlotCreate, StudySlotResponse
from models.study_plan import StudyPlanCreate, StudyPlanResponse, ResourceInput
from models.scheduled_task import ScheduledTaskCreate, ScheduledTaskResponse

logger = logging.getLogger(__name__)

# Initialize Supabase client
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    logger.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables")
    raise ValueError("Supabase credentials not configured")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ============================================
# Study Slots Operations
# ============================================

async def create_study_slot(slot_data: StudySlotCreate) -> Dict[str, Any]:
    """Create a new study slot"""
    try:
        # Check for overlapping slots
        overlap = await check_slot_overlap(
            str(slot_data.user_id),
            slot_data.day_of_week,
            slot_data.start_time,
            slot_data.end_time
        )
        
        if overlap:
            raise ValueError("Slot overlaps with existing slot")
        
        # Insert slot
        result = supabase.table('study_slots').insert({
            'user_id': str(slot_data.user_id),
            'day_of_week': slot_data.day_of_week,
            'start_time': slot_data.start_time,
            'end_time': slot_data.end_time,
            'is_free': True
        }).execute()
        
        logger.info(f"Created study slot: {result.data[0]['id']}")
        return result.data[0]
    
    except Exception as e:
        logger.error(f"Error creating study slot: {e}")
        raise


async def get_user_slots(user_id: str, is_free: Optional[bool] = None) -> List[Dict[str, Any]]:
    """Get all slots for a user"""
    try:
        query = supabase.table('study_slots').select('*').eq('user_id', user_id)
        
        if is_free is not None:
            query = query.eq('is_free', is_free)
        
        result = query.order('day_of_week').order('start_time').execute()
        return result.data
    
    except Exception as e:
        logger.error(f"Error fetching user slots: {e}")
        raise


async def get_free_slots(user_id: str) -> List[Dict[str, Any]]:
    """Get all free slots for a user"""
    return await get_user_slots(user_id, is_free=True)


async def update_study_slot(slot_id: str, update_data: Dict[str, Any]) -> Dict[str, Any]:
    """Update a study slot"""
    try:
        result = supabase.table('study_slots').update(update_data).eq('id', slot_id).execute()
        
        if not result.data:
            raise ValueError(f"Slot not found: {slot_id}")
        
        logger.info(f"Updated study slot: {slot_id}")
        return result.data[0]
    
    except Exception as e:
        logger.error(f"Error updating study slot: {e}")
        raise


async def delete_study_slot(slot_id: str, user_id: str) -> bool:
    """Delete a study slot (only if it's free)"""
    try:
        # Check if slot is free
        slot = supabase.table('study_slots').select('is_free').eq('id', slot_id).eq('user_id', user_id).execute()
        
        if not slot.data:
            raise ValueError(f"Slot not found: {slot_id}")
        
        if not slot.data[0]['is_free']:
            raise ValueError("Cannot delete occupied slot. Drop the study plan first.")
        
        # Delete slot
        result = supabase.table('study_slots').delete().eq('id', slot_id).eq('user_id', user_id).execute()
        
        logger.info(f"Deleted study slot: {slot_id}")
        return True
    
    except Exception as e:
        logger.error(f"Error deleting study slot: {e}")
        raise


async def check_slot_overlap(user_id: str, day_of_week: int, start_time: str, end_time: str, slot_id: Optional[str] = None) -> bool:
    """Check if a time slot overlaps with existing slots"""
    try:
        query = supabase.table('study_slots').select('id').eq('user_id', user_id).eq('day_of_week', day_of_week)
        
        if slot_id:
            query = query.neq('id', slot_id)
        
        slots = query.execute()
        
        start = time.fromisoformat(start_time)
        end = time.fromisoformat(end_time)
        
        for slot in slots.data:
            existing_start = time.fromisoformat(slot['start_time'])
            existing_end = time.fromisoformat(slot['end_time'])
            
            # Check overlap
            if (start < existing_end and end > existing_start):
                return True
        
        return False
    
    except Exception as e:
        logger.error(f"Error checking slot overlap: {e}")
        return False


# ============================================
# Study Plans Operations
# ============================================

async def create_study_plan(plan_data: StudyPlanCreate) -> Dict[str, Any]:
    """Create a new study plan"""
    try:
        result = supabase.table('study_plans').insert({
            'user_id': str(plan_data.user_id),
            'max_weeks': plan_data.max_weeks,
            'revision_ratio': float(plan_data.revision_ratio),
            'scheduling_rules': plan_data.scheduling_rules,
            'plan_start_date': plan_data.plan_start_date.isoformat(),
            'plan_end_date': plan_data.plan_end_date.isoformat(),
            'status': plan_data.status
        }).execute()
        
        logger.info(f"Created study plan: {result.data[0]['id']}")
        return result.data[0]
    
    except Exception as e:
        logger.error(f"Error creating study plan: {e}")
        raise


async def get_user_study_plans(user_id: str, status: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get all study plans for a user"""
    try:
        query = supabase.table('study_plans').select('*').eq('user_id', user_id)
        
        if status:
            query = query.eq('status', status)
        
        result = query.order('created_at', desc=True).execute()
        return result.data
    
    except Exception as e:
        logger.error(f"Error fetching user study plans: {e}")
        raise


async def get_active_study_plan(user_id: str) -> Optional[Dict[str, Any]]:
    """Get the active study plan for a user"""
    try:
        result = supabase.table('study_plans').select('*').eq('user_id', user_id).eq('status', 'active').execute()
        
        return result.data[0] if result.data else None
    
    except Exception as e:
        logger.error(f"Error fetching active study plan: {e}")
        raise


async def update_study_plan(plan_id: str, update_data: Dict[str, Any]) -> Dict[str, Any]:
    """Update a study plan"""
    try:
        result = supabase.table('study_plans').update(update_data).eq('id', plan_id).execute()
        
        if not result.data:
            raise ValueError(f"Study plan not found: {plan_id}")
        
        logger.info(f"Updated study plan: {plan_id}")
        return result.data[0]
    
    except Exception as e:
        logger.error(f"Error updating study plan: {e}")
        raise


async def drop_study_plan(plan_id: str, user_id: str) -> bool:
    """Drop a study plan and free all associated slots"""
    try:
        # First, get all tasks to free the slots
        tasks_result = supabase.table('scheduled_tasks').select('study_slot_id').eq('study_plan_id', plan_id).execute()
        task_slot_ids = list(set([task['study_slot_id'] for task in tasks_result.data]))
        
        logger.info(f"Dropping study plan {plan_id}, found {len(tasks_result.data)} tasks using {len(task_slot_ids)} unique slots")
        
        # Delete all scheduled tasks for this plan
        delete_result = supabase.table('scheduled_tasks').delete().eq('study_plan_id', plan_id).execute()
        logger.info(f"Deleted {len(delete_result.data) if delete_result.data else 0} scheduled tasks for plan {plan_id}")
        
        # Free all slots that were used by this plan
        if task_slot_ids:
            for slot_id in task_slot_ids:
                supabase.table('study_slots').update({'is_free': True}).eq('id', slot_id).execute()
            logger.info(f"Freed {len(task_slot_ids)} study slots")
        
        # Finally, update plan status
        await update_study_plan(plan_id, {
            'status': 'dropped',
            'dropped_at': datetime.utcnow().isoformat()
        })
        
        logger.info(f"Successfully dropped study plan: {plan_id}")
        return True
    
    except Exception as e:
        logger.error(f"Error dropping study plan: {e}")
        raise


async def save_study_plan(plan_data: Dict[str, Any], tasks_data: List[Dict[str, Any]]) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """Save study plan and scheduled tasks"""
    try:
        # Create study plan
        plan = await create_study_plan(StudyPlanCreate(**plan_data))
        
        # Create scheduled tasks
        tasks = []
        for task_data in tasks_data:
            task_data['study_plan_id'] = plan['id']
            task = await create_scheduled_task(task_data)
            tasks.append(task)
        
        logger.info(f"Saved study plan {plan['id']} with {len(tasks)} tasks")
        return plan, tasks
    
    except Exception as e:
        logger.error(f"Error saving study plan: {e}")
        raise


# ============================================
# Scheduled Tasks Operations
# ============================================

async def create_scheduled_task(task_data: Dict[str, Any]) -> Dict[str, Any]:
    """Create a scheduled task"""
    try:
        result = supabase.table('scheduled_tasks').insert(task_data).execute()
        
        logger.info(f"Created scheduled task: {result.data[0]['id']}")
        return result.data[0]
    
    except Exception as e:
        logger.error(f"Error creating scheduled task: {e}")
        raise


async def get_plan_tasks(plan_id: str) -> List[Dict[str, Any]]:
    """Get all tasks for a study plan"""
    try:
        result = supabase.table('scheduled_tasks').select('*').eq('study_plan_id', plan_id).order('scheduled_date').order('start_time').execute()
        
        return result.data
    
    except Exception as e:
        logger.error(f"Error fetching plan tasks: {e}")
        raise


async def get_user_tasks(user_id: str, start_date: Optional[date] = None, end_date: Optional[date] = None) -> List[Dict[str, Any]]:
    """Get all tasks for a user within a date range"""
    try:
        query = supabase.table('scheduled_tasks').select('*').eq('user_id', user_id)
        
        if start_date:
            query = query.gte('scheduled_date', start_date.isoformat())
        
        if end_date:
            query = query.lte('scheduled_date', end_date.isoformat())
        
        result = query.order('scheduled_date').order('start_time').execute()
        
        return result.data
    
    except Exception as e:
        logger.error(f"Error fetching user tasks: {e}")
        raise


async def update_task_progress(task_id: str, progress_data: Dict[str, Any]) -> Dict[str, Any]:
    """Update task progress"""
    try:
        result = supabase.table('scheduled_tasks').update(progress_data).eq('id', task_id).execute()
        
        if not result.data:
            raise ValueError(f"Task not found: {task_id}")
        
        logger.info(f"Updated task progress: {task_id}")
        return result.data[0]
    
    except Exception as e:
        logger.error(f"Error updating task progress: {e}")
        raise


async def update_resource_progress(user_id: str, resource_id: str, time_spent: int, completion_percentage: int) -> Dict[str, Any]:
    """Update user progress on a resource"""
    try:
        # Check if progress record exists
        existing = supabase.table('user_progress').select('*').eq('user_id', user_id).eq('resource_id', resource_id).execute()
        
        if existing.data:
            # Update existing record
            result = supabase.table('user_progress').update({
                'time_spent_minutes': time_spent,
                'completion_percentage': completion_percentage,
                'last_accessed_at': datetime.utcnow().isoformat()
            }).eq('user_id', user_id).eq('resource_id', resource_id).execute()
        else:
            # Create new record
            result = supabase.table('user_progress').insert({
                'user_id': user_id,
                'resource_id': resource_id,
                'time_spent_minutes': time_spent,
                'completion_percentage': completion_percentage,
                'last_accessed_at': datetime.utcnow().isoformat()
            }).execute()
        
        logger.info(f"Updated resource progress for user {user_id}, resource {resource_id}")
        return result.data[0]
    
    except Exception as e:
        logger.error(f"Error updating resource progress: {e}")
        raise


# ============================================
# Workspace and Resource Operations
# ============================================

async def get_workspace_resources(workspace_id: str, thread_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get all resources in a workspace or thread"""
    try:
        logger.info(f"🔍 [Database] Fetching resources for workspace {workspace_id}, thread {thread_id}")
        
        # Join through threads table since thread_resources doesn't have direct workspace_id
        # Select thread_resources and join with threads to filter by workspace_id
        query = supabase.table('thread_resources').select('*, threads!inner(workspace_id)')
        
        # Filter by workspace_id through the threads join
        query = query.eq('threads.workspace_id', workspace_id)
        
        if thread_id:
            query = query.eq('thread_id', thread_id)
        
        result = query.execute()
        
        # Clean up the nested threads data from results (we only needed it for filtering)
        resources = []
        for item in result.data:
            # Remove the nested threads object, keep only thread_resources fields
            resource = {k: v for k, v in item.items() if k != 'threads'}
            resources.append(resource)
        
        logger.info(f"✅ [Database] Found {len(resources)} resources")
        logger.debug(f"📊 [Database] Resources: {resources}")
        
        return resources
    
    except Exception as e:
        logger.error(f"❌ [Database] Error fetching workspace resources: {e}", exc_info=True)
        raise


async def get_user_workspace_threads(user_id: str, workspace_id: str) -> List[Dict[str, Any]]:
    """Get all threads in a workspace that user is subscribed to"""
    try:
        logger.info(f"🔍 [Database] Fetching threads for user {user_id} in workspace {workspace_id}")
        
        result = supabase.table('thread_subscribers').select('thread_id, threads(*)').eq('user_id', user_id).eq('threads.workspace_id', workspace_id).execute()
        
        logger.info(f"📊 [Database] Query returned {len(result.data)} thread subscriptions")
        logger.debug(f"📊 [Database] Raw result: {result.data}")
        
        threads = [item['threads'] for item in result.data if item.get('threads')]
        
        logger.info(f"✅ [Database] Extracted {len(threads)} threads")
        
        return threads
    
    except Exception as e:
        logger.error(f"❌ [Database] Error fetching user workspace threads: {e}", exc_info=True)
        raise


async def get_user_workspaces(user_id: str) -> List[Dict[str, Any]]:
    """Get all workspaces where user is a member"""
    try:
        logger.info(f"🔍 [Database] Fetching workspaces for user: {user_id}")
        
        result = supabase.table('workspace_members').select('workspace_id, workspaces(*)').eq('user_id', user_id).execute()
        
        logger.info(f"📊 [Database] Query returned {len(result.data)} workspace memberships")
        logger.debug(f"📊 [Database] Raw result: {result.data}")
        
        workspaces = [item['workspaces'] for item in result.data if item.get('workspaces')]
        
        logger.info(f"✅ [Database] Extracted {len(workspaces)} workspaces")
        
        return workspaces
    
    except Exception as e:
        logger.error(f"❌ [Database] Error fetching user workspaces: {e}", exc_info=True)
        raise


async def get_user_progress_for_resources(user_id: str, resource_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """Get user progress for multiple resources"""
    try:
        result = supabase.table('user_progress').select('*').eq('user_id', user_id).in_('resource_id', resource_ids).execute()
        
        # Convert to dictionary keyed by resource_id
        progress_dict = {item['resource_id']: item for item in result.data}
        return progress_dict
    
    except Exception as e:
        logger.error(f"Error fetching user progress: {e}")
        raise


async def get_resource_details(resource_id: str) -> Dict[str, Any]:
    """Get details of a specific resource"""
    try:
        result = supabase.table('thread_resources').select('*, threads(name), workspaces(title)').eq('id', resource_id).execute()
        
        if not result.data:
            raise ValueError(f"Resource not found: {resource_id}")
        
        return result.data[0]
    
    except Exception as e:
        logger.error(f"Error fetching resource details: {e}")
        raise
