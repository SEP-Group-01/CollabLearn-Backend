"""
Study Plan Controller for Study Plan Service
Handles all study plan related business logic including slots, plans, and tasks
"""

import json
import logging
from typing import Dict, Any, List
from datetime import datetime, timedelta, date
from uuid import UUID

from models.study_plan import (
    StudyPlanRequest, StudyPlanCreate, CompletionStatus,
    StudyPlanGenerationResponse, ScheduleSlotOutput, ScheduledResourceOutput
)
from models.study_slot import StudySlotCreate, DayOfWeekEnum
from models.scheduled_task import TaskProgressUpdate
from database import (
    get_free_slots, get_workspace_resources, get_user_workspace_threads,
    save_study_plan, update_resource_progress, get_user_study_plans,
    create_study_slot, get_user_slots, update_study_slot, delete_study_slot,
    drop_study_plan, get_active_study_plan, get_plan_tasks, update_task_progress,
    get_user_progress_for_resources, get_resource_details, get_user_workspaces
)
from services.plan_generator import generate_optimized_study_plan
from services.analytics import StudyPlanAnalytics

logger = logging.getLogger(__name__)

class StudyPlanController:
    """Controller for handling study plan operations"""
    
    def __init__(self):
        self.service_name = "StudyPlanService"
    
    async def handle_request(self, topic: str, payload: dict) -> dict:
        """
        Main handler that routes requests to appropriate methods
        
        Args:
            topic: The Kafka topic that received the message
            payload: The message payload
            
        Returns:
            dict: Response data to send back to the API Gateway
        """
        
        # Extract the action from the topic
        logger.info(f"🔍 [{self.service_name}] Received message on topic: {topic}")
        logger.info(f"📦 [{self.service_name}] Payload keys: {list(payload.keys())}")
        
        topic_parts = topic.split('.')
        
        # Map topic to action - handle different topic patterns
        action_mapping = {
            # Direct topic matches (with full topic name)
            'study-plan-requests.generate': 'generate_plan',
            'study-plan-requests.drop-plan': 'drop_plan',
            'study-plan-requests.history': 'get_plan_history',
            'study-plan-slots.create-slot': 'create_slot',
            'study-plan-slots.get-slots': 'get_slots',
            'study-plan-slots.update-slot': 'update_slot',
            'study-plan-slots.delete-slot': 'delete_slot',
            'study-plan-tasks.get-tasks': 'get_tasks',
            'study-plan-tasks.update-task': 'update_task',
            'study-plan-progress.update-progress': 'update_progress',
            'study-plan-analysis.feasibility': 'analyze_feasibility',
            'study-plan-workspaces.get-workspaces': 'get_workspaces',
            # Base topics (for backwards compatibility)
            'study-plan-requests': 'generate_plan',
            'study-plan-progress': 'update_progress',
            'study-plan-analysis': 'analyze_feasibility',
            'study-plan-workspaces': 'get_workspaces',
        }
        
        # Try exact match first
        action = action_mapping.get(topic)
        
        # If no exact match, try to parse from topic structure
        if not action and len(topic_parts) >= 2:
            # Try matching on last part (the actual action)
            last_part = topic_parts[-1]
            action = action_mapping.get(last_part, last_part.replace('-', '_'))
        
        if not action:
            action = 'unknown'
        
        logger.info(f"🎯 [{self.service_name}] Mapped topic '{topic}' to action: '{action}'")
        
        # Route to specific methods based on action
        method_name = f"handle_{action}"
        if hasattr(self, method_name):
            handler_method = getattr(self, method_name)
            try:
                return await handler_method(payload)
            except Exception as e:
                logger.error(f"[{self.service_name}] Error in {method_name}: {str(e)}", exc_info=True)
                return {
                    "success": False,
                    "error": str(e),
                    "action": action,
                    "service": self.service_name
                }
        else:
            logger.warning(f"[{self.service_name}] Unknown action: {action}")
            return {
                "success": False,
                "error": f"Unknown action: {action}",
                "service": self.service_name
            }

    # ============================================
    # Slot Management Handlers
    # ============================================

    async def handle_create_slot(self, payload: dict) -> dict:
        """Create a new study slot"""
        try:
            user_id = payload.get('user_id')
            day_of_week = payload.get('day_of_week')
            start_time = payload.get('start_time')
            end_time = payload.get('end_time')
            
            if not all([user_id, day_of_week is not None, start_time, end_time]):
                return {
                    "success": False,
                    "error": "Missing required fields: user_id, day_of_week, start_time, end_time"
                }
            
            slot_data = StudySlotCreate(
                user_id=user_id,
                day_of_week=day_of_week,
                start_time=start_time,
                end_time=end_time
            )
            
            slot = await create_study_slot(slot_data)
            
            logger.info(f"Created slot {slot['id']} for user {user_id}")
            
            return {
                "success": True,
                "slot": slot,
                "message": "Study slot created successfully"
            }
            
        except ValueError as e:
            return {
                "success": False,
                "error": str(e)
            }
        except Exception as e:
            logger.error(f"Error creating slot: {e}")
            raise

    async def handle_get_slots(self, payload: dict) -> dict:
        """Get all slots for a user"""
        try:
            user_id = payload.get('user_id')
            is_free = payload.get('is_free')  # Optional filter
            
            if not user_id:
                return {
                    "success": False,
                    "error": "Missing required field: user_id"
                }
            
            slots = await get_user_slots(user_id, is_free)
            
            return {
                "success": True,
                "slots": slots,
                "count": len(slots)
            }
            
        except Exception as e:
            logger.error(f"Error fetching slots: {e}")
            raise

    async def handle_update_slot(self, payload: dict) -> dict:
        """Update a study slot"""
        try:
            slot_id = payload.get('slot_id')
            update_data = payload.get('update_data', {})
            
            if not slot_id:
                return {
                    "success": False,
                    "error": "Missing required field: slot_id"
                }
            
            slot = await update_study_slot(slot_id, update_data)
            
            return {
                "success": True,
                "slot": slot,
                "message": "Study slot updated successfully"
            }
            
        except Exception as e:
            logger.error(f"Error updating slot: {e}")
            raise

    async def handle_delete_slot(self, payload: dict) -> dict:
        """Delete a study slot"""
        try:
            slot_id = payload.get('slot_id')
            user_id = payload.get('user_id')
            
            if not all([slot_id, user_id]):
                return {
                    "success": False,
                    "error": "Missing required fields: slot_id, user_id"
                }
            
            await delete_study_slot(slot_id, user_id)
            
            return {
                "success": True,
                "message": "Study slot deleted successfully"
            }
            
        except ValueError as e:
            return {
                "success": False,
                "error": str(e)
            }
        except Exception as e:
            logger.error(f"Error deleting slot: {e}")
            raise

    # ============================================
    # Study Plan Generation Handler
    # ============================================

    async def handle_generate_plan(self, payload: dict) -> dict:
        """
        Handle study plan generation requests
        """
        try:
            user_id = payload.get('user_id')
            
            if not user_id:
                return {
                    "success": False,
                    "error": "Missing required field: user_id"
                }
            
            max_weeks = payload.get('max_weeks', 1)
            revision_ratio = payload.get('revision_ratio', 0.25)
            scheduling_rules = payload.get('scheduling_rules', {
                'max_consecutive_same_resource': 2,
                'mix_threads_across_workspaces': True,
                'balance_workspace_focus': True
            })
            slots = payload.get('slots', [])
            resources = payload.get('resources', [])
            
            if not slots:
                return {
                    "success": False,
                    "error": "No time slots provided"
                }
            
            if not resources:
                return {
                    "success": False,
                    "error": "No resources provided"
                }
            
            # CHECK FOR RESOURCE CONFLICTS WITH EXISTING ACTIVE PLANS
            logger.info(f"Checking for resource conflicts in active plans for user {user_id}")
            existing_plans = await get_user_study_plans(user_id, status='active')
            
            if existing_plans and len(existing_plans) > 0:
                # Get all resource IDs from existing active plans
                existing_resource_ids = set()
                for plan in existing_plans:
                    plan_tasks = await get_plan_tasks(plan['id'])
                    for task in plan_tasks:
                        existing_resource_ids.add(str(task['resource_id']))
                
                # Check if any new resources are already in active plans
                new_resource_ids = set(str(r['resource_id']) for r in resources)
                conflicting_resources = new_resource_ids.intersection(existing_resource_ids)
                
                if conflicting_resources:
                    logger.warning(f"User {user_id} has {len(conflicting_resources)} conflicting resources in active plans")
                    return {
                        "success": False,
                        "error": f"Some selected resources are already in active study plans. Please deselect them or drop the existing plans first.",
                        "conflicting_resource_ids": list(conflicting_resources),
                        "existing_plans_count": len(existing_plans)
                    }
                else:
                    logger.info(f"✅ No resource conflicts found. User can have multiple plans with different resources.")
            
            logger.info(f"Generating study plan for user {user_id} with {len(slots)} slots and {len(resources)} resources")
            
            # Get user progress for all resources
            resource_ids = [str(r['resource_id']) for r in resources]
            user_progress = await get_user_progress_for_resources(user_id, resource_ids)
            
            # Adjust remaining minutes based on progress
            for resource in resources:
                resource_id = str(resource['resource_id'])
                if resource_id in user_progress:
                    progress_pct = user_progress[resource_id].get('completion_percentage', 0)
                    original_minutes = resource['remaining_minutes']
                    resource['remaining_minutes'] = int(original_minutes * (100 - progress_pct) / 100)
            
            # Set plan dates
            plan_start_date = date.today()
            plan_end_date = plan_start_date + timedelta(weeks=max_weeks)
            
            # Generate the optimized study plan
            scheduled_tasks, metadata = generate_optimized_study_plan(
                user_id=user_id,
                slots=slots,
                resources=resources,
                max_weeks=max_weeks,
                revision_ratio=revision_ratio,
                scheduling_rules=scheduling_rules,
                user_progress=user_progress,
                plan_start_date=plan_start_date
            )
            
            logger.info("=" * 80)
            logger.info("📊 GENERATED STUDY PLAN - RAW OUTPUT")
            logger.info("=" * 80)
            logger.info(f"\n✅ Total scheduled tasks: {len(scheduled_tasks)}")
            logger.info(f"\n📈 Plan Metadata:\n{json.dumps(metadata, indent=2)}")
            logger.info("\n📋 Scheduled Tasks Details:")
            for i, task in enumerate(scheduled_tasks, 1):
                logger.info(f"\n--- Task {i} ---")
                logger.info(f"  Title: {task.get('task_title')}")
                logger.info(f"  Type: {task.get('task_type')}")
                logger.info(f"  Week: {task.get('week_number')}")
                logger.info(f"  Date: {task.get('scheduled_date')}")
                logger.info(f"  Time: {task.get('start_time')} - {task.get('end_time')}")
                logger.info(f"  Duration: {task.get('allocated_minutes')} minutes")
                logger.info(f"  Resource ID: {task.get('resource_id')}")
                logger.info(f"  Slot ID: {task.get('study_slot_id')}")
            logger.info("\n" + "=" * 80)
            
            if not scheduled_tasks:
                return {
                    "success": False,
                    "error": "Failed to generate study plan. Please check your constraints.",
                    "metadata": metadata
                }
            
            # Create study plan in database
            plan_data = {
                'user_id': user_id,
                'max_weeks': max_weeks,
                'revision_ratio': revision_ratio,
                'scheduling_rules': scheduling_rules,
                'plan_start_date': plan_start_date,
                'plan_end_date': plan_end_date,
                'status': 'active'
            }
            
            # Save plan and tasks
            plan, tasks = await save_study_plan(plan_data, scheduled_tasks)
            
            logger.info(f"\n💾 SAVED TO DATABASE")
            logger.info(f"Plan ID: {plan['id']}")
            logger.info(f"Total tasks saved: {len(tasks)}")
            
            # Format response
            schedule = await format_schedule_output(tasks, resources)
            
            logger.info(f"\n📤 FORMATTED SCHEDULE FOR RESPONSE")
            logger.info(f"Schedule items: {len(schedule)}")
            for i, slot in enumerate(schedule, 1):
                logger.info(f"\n--- Schedule Slot {i} ---")
                logger.info(f"  Week: {slot.get('week_number')}")
                logger.info(f"  Day: {slot.get('day_of_week')}")
                logger.info(f"  Time: {slot.get('start_time')} - {slot.get('end_time')}")
                logger.info(f"  Resources: {len(slot.get('resources', []))}")
                for j, res in enumerate(slot.get('resources', []), 1):
                    logger.info(f"    Resource {j}: {res.get('title')} ({res.get('task_type')})")
            
            response = StudyPlanGenerationResponse(
                plan_id=plan['id'],
                user_id=user_id,
                max_weeks=max_weeks,
                revision_ratio=revision_ratio,
                plan_start_date=plan_start_date.isoformat(),
                plan_end_date=plan_end_date.isoformat(),
                generated_at=plan['generated_at'],
                total_study_hours=metadata.get('total_study_hours', 0),
                total_revision_hours=metadata.get('total_revision_hours', 0),
                schedule=schedule,
                warnings=[],
                success=True
            )
            
            logger.info(f"\n✅ Successfully generated study plan {plan['id']} with {len(tasks)} tasks")
            logger.info("=" * 80)
            
            return response.dict()
            
        except Exception as e:
            logger.error(f"Error generating study plan: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }

    # ============================================
    # Task and Progress Handlers
    # ============================================

    async def handle_update_progress(self, payload: dict) -> dict:
        """
        Handle progress update requests
        """
        try:
            task_id = payload.get('task_id')
            user_id = payload.get('user_id')
            
            if not all([task_id, user_id]):
                return {
                    "success": False,
                    "error": "Missing required fields: task_id, user_id"
                }
            
            # Extract progress data
            progress_data = {
                'status': payload.get('status'),
                'completion_percentage': payload.get('completion_percentage'),
                'actual_time_spent': payload.get('actual_time_spent'),
                'rating': payload.get('rating'),
                'notes': payload.get('notes')
            }
            
            # Remove None values
            progress_data = {k: v for k, v in progress_data.items() if v is not None}
            
            # Update completed_at if status is completed
            if progress_data.get('status') == 'completed':
                progress_data['completed_at'] = datetime.utcnow().isoformat()
            
            # Update task
            task = await update_task_progress(task_id, progress_data)
            
            # Update resource progress if task is completed
            if progress_data.get('status') == 'completed' and progress_data.get('actual_time_spent'):
                await update_resource_progress(
                    user_id=user_id,
                    resource_id=task['resource_id'],
                    time_spent=progress_data['actual_time_spent'],
                    completion_percentage=progress_data.get('completion_percentage', 100)
                )
            
            logger.info(f"Updated progress for task {task_id}")
            
            return {
                "success": True,
                "task": task,
                "message": "Task progress updated successfully"
            }
            
        except Exception as e:
            logger.error(f"Error updating progress: {e}")
            raise

    async def handle_update_task(self, payload: dict) -> dict:
        """Handle task update (alias for update_progress)"""
        return await self.handle_update_progress(payload)

    async def handle_get_tasks(self, payload: dict) -> dict:
        """Get tasks for a user or plan"""
        try:
            plan_id = payload.get('plan_id')
            user_id = payload.get('user_id')
            
            if plan_id:
                tasks = await get_plan_tasks(plan_id)
            elif user_id:
                # Get tasks for active plan
                active_plan = await get_active_study_plan(user_id)
                if not active_plan:
                    return {
                        "success": True,
                        "tasks": [],
                        "message": "No active study plan found"
                    }
                tasks = await get_plan_tasks(active_plan['id'])
            else:
                return {
                    "success": False,
                    "error": "Either plan_id or user_id required"
                }
            
            return {
                "success": True,
                "tasks": tasks,
                "count": len(tasks)
            }
            
        except Exception as e:
            logger.error(f"Error fetching tasks: {e}")
            raise

    # ============================================
    # Plan Management Handlers
    # ============================================

    async def handle_drop_plan(self, payload: dict) -> dict:
        """Drop a study plan and free all slots"""
        try:
            plan_id = payload.get('plan_id')
            user_id = payload.get('user_id')
            
            if not all([plan_id, user_id]):
                return {
                    "success": False,
                    "error": "Missing required fields: plan_id, user_id"
                }
            
            await drop_study_plan(plan_id, user_id)
            
            return {
                "success": True,
                "message": "Study plan dropped successfully"
            }
            
        except Exception as e:
            logger.error(f"Error dropping plan: {e}")
            raise

    async def handle_get_plan_history(self, payload: dict) -> dict:
        """Get study plan history for a user"""
        try:
            user_id = payload.get('user_id')
            status = payload.get('status')  # Optional filter
            
            if not user_id:
                return {
                    "success": False,
                    "error": "Missing required field: user_id"
                }
            
            plans = await get_user_study_plans(user_id, status)
            
            return {
                "success": True,
                "plans": plans,
                "count": len(plans)
            }
            
        except Exception as e:
            logger.error(f"Error fetching plan history: {e}")
            raise

    # ============================================
    # Analytics and Feasibility Handlers
    # ============================================

    async def handle_analyze_feasibility(self, payload: dict) -> dict:
        """
        Handle feasibility analysis requests
        """
        try:
            max_weeks = payload.get('max_weeks', 1)
            slots = payload.get('slots', [])
            resources = payload.get('resources', [])
            
            if not slots or not resources:
                return {
                    "success": False,
                    "error": "Missing slots or resources for analysis"
                }
            
            # Calculate totals
            total_available_minutes = sum(
                calculate_slot_duration(s.get('start_time', '00:00'), s.get('end_time', '00:00'))
                for s in slots
            )
            
            total_study_minutes_needed = sum(r.get('remaining_minutes', 0) for r in resources)
            
            # Perform feasibility analysis
            analysis = StudyPlanAnalytics.analyze_feasibility(
                total_study_minutes_needed=total_study_minutes_needed,
                total_available_minutes=total_available_minutes,
                resources=resources,
                slots=slots,
                max_weeks=max_weeks
            )
            
            return {
                "success": True,
                "analysis": analysis
            }
            
        except Exception as e:
            logger.error(f"Error analyzing feasibility: {e}")
            raise

    # ============================================
    # Workspace/Resource Handlers
    # ============================================

    async def handle_get_workspaces(self, payload: dict) -> dict:
        """Get workspaces and threads for a user"""
        try:
            logger.info(f"🏢 [StudyPlanController] Handling get_workspaces request")
            logger.info(f"📦 [StudyPlanController] Payload: {payload}")
            
            user_id = payload.get('user_id')
            
            if not user_id:
                logger.error(f"❌ [StudyPlanController] Missing user_id in payload")
                return {
                    "success": False,
                    "error": "Missing required field: user_id"
                }
            
            logger.info(f"👤 [StudyPlanController] Fetching workspaces for user: {user_id}")
            
            workspaces = await get_user_workspaces(user_id)
            logger.info(f"✅ [StudyPlanController] Found {len(workspaces)} workspaces for user {user_id}")
            
            # For each workspace, get threads user is subscribed to
            workspace_data = []
            for workspace in workspaces:
                logger.info(f"🔍 [StudyPlanController] Processing workspace: {workspace.get('id')} - {workspace.get('title')}")
                
                threads = await get_user_workspace_threads(user_id, workspace['id'])
                logger.info(f"📋 [StudyPlanController] Found {len(threads)} threads in workspace {workspace['id']}")
                
                # For each thread, get resources
                for thread in threads:
                    logger.info(f"🔗 [StudyPlanController] Fetching resources for thread: {thread.get('id')} - {thread.get('name')}")
                    resources = await get_workspace_resources(workspace['id'], thread['id'])
                    logger.info(f"📄 [StudyPlanController] Found {len(resources)} resources in thread {thread['id']}")
                    thread['resources'] = resources
                
                workspace['threads'] = threads
                workspace_data.append(workspace)
            
            logger.info(f"✅ [StudyPlanController] Successfully prepared {len(workspace_data)} workspaces with threads and resources")
            
            return {
                "success": True,
                "workspaces": workspace_data
            }
            
        except Exception as e:
            logger.error(f"❌ [StudyPlanController] Error fetching workspaces: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }


# ============================================
# Helper Functions
# ============================================

async def format_schedule_output(tasks: List[Dict[str, Any]], resources: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Format scheduled tasks into the output schedule structure"""
    # Group tasks by slot
    slot_groups = {}
    
    for task in tasks:
        key = (
            task['week_number'],
            task['day_of_week'],
            task['start_time'],
            task['end_time'],
            task['scheduled_date']
        )
        
        if key not in slot_groups:
            slot_groups[key] = {
                'slot_id': task.get('study_slot_id'),
                'week_number': task['week_number'],
                'day_of_week': task['day_of_week'],
                'day_name': DayOfWeekEnum.get_name(task['day_of_week']),
                'scheduled_date': task['scheduled_date'],
                'start_time': task['start_time'],
                'end_time': task['end_time'],
                'assigned_resources': []
            }
        
        # Add resource to slot
        slot_groups[key]['assigned_resources'].append({
            'resource_id': task['resource_id'],
            'title': task['task_title'],
            'workspace_id': task['workspace_id'],
            'thread_id': task['thread_id'],
            'allocated_minutes': task['allocated_minutes'],
            'task_type': task['task_type'],
            'task_id': task.get('id')
        })
    
    # Convert to list and sort
    schedule = sorted(slot_groups.values(), key=lambda x: (x['week_number'], x['day_of_week'], x['start_time']))
    
    return schedule


def calculate_slot_duration(start_time: str, end_time: str) -> int:
    """Calculate duration of a slot in minutes"""
    try:
        from datetime import time
        start = time.fromisoformat(start_time)
        end = time.fromisoformat(end_time)
        
        start_minutes = start.hour * 60 + start.minute
        end_minutes = end.hour * 60 + end.minute
        
        return max(0, end_minutes - start_minutes)
    except:
        return 0
