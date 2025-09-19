"""
Study Plan Controller for Study Plan Service
Handles all study plan related business logic
"""

import json
import logging
from typing import Dict, Any
from datetime import datetime, timedelta

from models.study_plan import StudyPlanRequest, CompletionStatus
from database import (
    get_free_slots, get_workspace_resources, get_user_workspace_threads,
    save_study_plan, update_resource_progress, get_user_study_plans
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
        
        # Extract the action from the topic (e.g., 'generate' from 'study-plan-requests.generate')
        topic_parts = topic.split('.')
        if len(topic_parts) >= 2:
            raw_action = topic_parts[1].replace('-', '_')
            action_mapping = {
                'requests': 'generate_plan',
                'generate': 'generate_plan',
                'progress': 'update_progress',
                'update_progress': 'update_progress',
                'feasibility': 'analyze_feasibility',
                'history': 'get_plan_history'
            }
            action = action_mapping.get(raw_action, raw_action)
        else:
            # Default action based on topic base name
            if 'progress' in topic:
                action = 'update_progress'
            elif 'requests' in topic:
                action = 'generate_plan'
            else:
                action = 'unknown'
        
        logger.info(f"[{self.service_name}] Processing action: {action} with payload keys: {list(payload.keys())}")
        
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
                "available_actions": ["generate_plan", "update_progress", "analyze_feasibility", "get_plan_history"],
                "service": self.service_name
            }

    async def handle_generate_plan(self, payload: dict) -> dict:
        """
        Handle study plan generation requests
        
        Args:
            payload: Study plan request data
            
        Returns:
            dict: Generated study plan or error response
        """
        try:
            logger.info(f"[{self.service_name}] Generating study plan for payload: {payload}")
            
            # Check if this is a legacy request format
            is_legacy = "focus_areas" in payload and "workspace_ids" not in payload
            
            if is_legacy:
                # Handle legacy format for backward compatibility
                logger.info(f"[{self.service_name}] Processing legacy format request")
                return await self._handle_legacy_request(payload)
            
            # Validate required fields
            required_fields = ["user_id", "workspace_ids", "selected_threads"]
            missing_fields = [field for field in required_fields if field not in payload]
            if missing_fields:
                return {
                    "success": False,
                    "error": f"Missing required fields: {missing_fields}",
                    "service": self.service_name
                }
            
            # Create StudyPlanRequest object
            request = StudyPlanRequest(**payload)
            
            # Calculate weekly hours from time slots if not provided
            if not hasattr(request, 'weekly_hours_available') or not request.weekly_hours_available:
                time_slots = get_free_slots(request.user_id)
                total_weekly_minutes = sum(slot.duration_minutes for slot in time_slots)
                request.weekly_hours_available = int(total_weekly_minutes / 60)
                logger.info(f"[{self.service_name}] Calculated weekly hours from time slots: {request.weekly_hours_available}")
            
            # Get user's available time slots
            time_slots = get_free_slots(request.user_id)
            if not time_slots:
                return {
                    "success": False,
                    "error": "No available time slots found. Please add your free time slots first.",
                    "service": self.service_name
                }
            
            # Validate workspace access and get available threads
            validated_workspace_ids = []
            validated_selected_threads = {}
            
            for workspace_id in request.workspace_ids:
                try:
                    available_threads = get_user_workspace_threads(request.user_id, workspace_id)
                    requested_threads = request.selected_threads.get(workspace_id, [])
                    
                    # Filter to only threads user has access to
                    valid_threads = [t for t in requested_threads if t in available_threads]
                    
                    if valid_threads:
                        validated_workspace_ids.append(workspace_id)
                        validated_selected_threads[workspace_id] = valid_threads
                    else:
                        logger.warning(f"User {request.user_id} has no access to threads in workspace {workspace_id}")
                except Exception as e:
                    logger.warning(f"Error checking workspace {workspace_id}: {str(e)}")
            
            if not validated_workspace_ids:
                return {
                    "success": False,
                    "error": "No accessible workspaces or threads found",
                    "service": self.service_name
                }
            
            # Update request with validated data
            request.workspace_ids = validated_workspace_ids
            request.selected_threads = validated_selected_threads
            
            # Get workspace resources with user progress
            workspace_resources = get_workspace_resources(request.user_id, validated_workspace_ids)
            
            # Generate optimized study plan
            result, error = generate_optimized_study_plan(request, time_slots, workspace_resources)
            
            if error:
                return {
                    "success": False,
                    "error": error,
                    "service": self.service_name
                }
            
            # Save study plan
            plan_id = save_study_plan(
                request.user_id, payload,
                result.dict() if result else None,
                "done", result.total_weeks if result else 0, None
            )
            
            # Prepare response
            response = {
                "success": True,
                "plan_id": plan_id,
                "study_plan": result.dict(),
                "message": "Study plan generated successfully",
                "service": self.service_name
            }
            
            logger.info(f"[{self.service_name}] Study plan generated successfully for user {request.user_id}")
            return response
            
        except Exception as e:
            logger.error(f"[{self.service_name}] Error generating study plan: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "service": self.service_name
            }

    async def handle_update_progress(self, payload: dict) -> dict:
        """
        Handle progress update requests
        
        Args:
            payload: Progress update data
            
        Returns:
            dict: Update result
        """
        try:
            logger.info(f"[{self.service_name}] Updating progress for payload: {payload}")
            
            # Validate required fields
            required_fields = ["user_id", "resource_id", "completion_status", "progress_percentage"]
            missing_fields = [field for field in required_fields if field not in payload]
            if missing_fields:
                return {
                    "success": False,
                    "error": f"Missing required fields: {missing_fields}",
                    "service": self.service_name
                }
            
            # Update progress
            update_resource_progress(
                user_id=payload["user_id"],
                resource_id=payload["resource_id"],
                completion_status=payload["completion_status"],
                progress_percentage=float(payload["progress_percentage"]),
                actual_time_spent=payload.get("actual_time_spent", 0)
            )
            
            response = {
                "success": True,
                "user_id": payload["user_id"],
                "resource_id": payload["resource_id"],
                "message": "Progress updated successfully",
                "service": self.service_name
            }
            
            logger.info(f"[{self.service_name}] Progress updated successfully for user {payload['user_id']}")
            return response
            
        except Exception as e:
            logger.error(f"[{self.service_name}] Error updating progress: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "service": self.service_name
            }

    async def handle_analyze_feasibility(self, payload: dict) -> dict:
        """
        Handle feasibility analysis requests
        
        Args:
            payload: Study plan request data for analysis
            
        Returns:
            dict: Feasibility analysis result
        """
        try:
            logger.info(f"[{self.service_name}] Analyzing feasibility for payload: {payload}")
            
            # Create StudyPlanRequest object
            request = StudyPlanRequest(**payload)
            
            # Get workspace resources
            workspace_resources = get_workspace_resources(request.user_id, request.workspace_ids)
            
            # Calculate total required hours
            all_resources = []
            for workspace_id, resources in workspace_resources.items():
                if workspace_id in request.workspace_ids:
                    selected_threads = request.selected_threads.get(workspace_id, [])
                    for resource in resources:
                        if resource.thread_id in selected_threads:
                            all_resources.append(resource)
            
            estimates = StudyPlanAnalytics.estimate_completion_time(all_resources)
            total_required_hours = sum(estimates.values())
            
            # Calculate weeks until deadline
            if request.deadline:
                weeks_until_deadline = max(1, (request.deadline - datetime.now().date()).days // 7)
            else:
                weeks_until_deadline = 4  # Default to 4 weeks
            
            # Generate feasibility report
            report = StudyPlanAnalytics.generate_feasibility_report(
                total_required_hours,
                request.weekly_hours_available,
                weeks_until_deadline
            )
            
            # Add optimization suggestions
            suggestions = StudyPlanAnalytics.suggest_schedule_optimizations(
                all_resources, request.weekly_hours_available
            )
            report["optimization_suggestions"] = suggestions
            
            response = {
                "success": True,
                "feasibility_report": report,
                "total_resources": len(all_resources),
                "service": self.service_name
            }
            
            logger.info(f"[{self.service_name}] Feasibility analysis completed for user {request.user_id}")
            return response
            
        except Exception as e:
            logger.error(f"[{self.service_name}] Error analyzing feasibility: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "service": self.service_name
            }

    async def handle_get_plan_history(self, payload: dict) -> dict:
        """
        Handle study plan history requests
        
        Args:
            payload: Request data containing user_id
            
        Returns:
            dict: User's study plan history
        """
        try:
            logger.info(f"[{self.service_name}] Getting plan history for payload: {payload}")
            
            user_id = payload.get("user_id")
            if not user_id:
                return {
                    "success": False,
                    "error": "Missing user_id",
                    "service": self.service_name
                }
            
            plans = get_user_study_plans(user_id)
            
            response = {
                "success": True,
                "user_id": user_id,
                "study_plans": plans,
                "total_plans": len(plans),
                "service": self.service_name
            }
            
            logger.info(f"[{self.service_name}] Retrieved {len(plans)} plans for user {user_id}")
            return response
            
        except Exception as e:
            logger.error(f"[{self.service_name}] Error getting plan history: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "service": self.service_name
            }

    async def _handle_legacy_request(self, payload: dict) -> dict:
        """
        Handle legacy format requests for backward compatibility
        
        Args:
            payload: Legacy format request data
            
        Returns:
            dict: Study plan result
        """
        try:
            from services.plan_generator import generate_study_plan
            from database import get_free_slots_legacy
            
            # Create legacy format request
            request = StudyPlanRequest(**payload)
            free_slots = get_free_slots_legacy(request.user_id)
            result, error = generate_study_plan(request, free_slots)
            
            if error:
                return {
                    "success": False,
                    "error": error,
                    "service": self.service_name
                }
            
            # Save legacy plan
            plan_id = save_study_plan(
                request.user_id, payload,
                result.dict() if result else None,
                "done", getattr(result, 'weeks_required', 0), None
            )
            
            response = {
                "success": True,
                "plan_id": plan_id,
                "study_plan": result.dict(),
                "message": "Legacy study plan generated successfully",
                "service": self.service_name
            }
            
            logger.info(f"[{self.service_name}] Legacy study plan generated for user {request.user_id}")
            return response
            
        except Exception as e:
            logger.error(f"[{self.service_name}] Error in legacy request handler: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "service": self.service_name
            }