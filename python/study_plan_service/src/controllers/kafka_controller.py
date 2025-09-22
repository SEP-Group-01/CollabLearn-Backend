from models.study_plan import StudyPlanRequest
from database import (
    get_free_slots, get_workspace_resources, get_user_workspace_threads,
    save_study_plan, get_free_slots_legacy
)
from services.plan_generator import generate_optimized_study_plan, generate_study_plan
from kafka_service.producer import send_result
import logging

logger = logging.getLogger(__name__)

def handle_study_plan_request(data):
    """
    Handle study plan generation requests with multi-workspace support
    """
    try:
        # Check if this is a legacy request format
        is_legacy = "focus_areas" in data and "workspace_ids" not in data
        
        if is_legacy:
            # Handle legacy format
            request = StudyPlanRequest(**data)
            free_slots = get_free_slots_legacy(request.user_id)
            result, error = generate_study_plan(request, free_slots)
            status = "done" if result else "error"
            weeks_required = result.weeks_required if result else 0
            save_study_plan(
                request.user_id, data, 
                result.dict() if result else None, 
                status, weeks_required, error
            )
        else:
            # Handle new multi-workspace format
            request = StudyPlanRequest(**data)
            
            # Get user's available time slots
            time_slots = get_free_slots(request.user_id)
            
            # Validate workspace access and get available threads
            validated_workspace_ids = []
            validated_selected_threads = {}
            
            for workspace_id in request.workspace_ids:
                available_threads = get_user_workspace_threads(request.user_id, workspace_id)
                requested_threads = request.selected_threads.get(workspace_id, [])
                
                # Filter to only threads user has access to
                valid_threads = [t for t in requested_threads if t in available_threads]
                
                if valid_threads:
                    validated_workspace_ids.append(workspace_id)
                    validated_selected_threads[workspace_id] = valid_threads
                else:
                    logger.warning(f"User {request.user_id} has no access to threads in workspace {workspace_id}")
            
            if not validated_workspace_ids:
                error = "No accessible workspaces or threads found"
                save_study_plan(request.user_id, data, None, "error", 0, error)
                send_result({"error": error})
                return
            
            # Update request with validated data
            request.workspace_ids = validated_workspace_ids
            request.selected_threads = validated_selected_threads
            
            # Get workspace resources with user progress
            workspace_resources = get_workspace_resources(request.user_id, validated_workspace_ids)
            
            # Generate optimized study plan
            result, error = generate_optimized_study_plan(request, time_slots, workspace_resources)
            
            status = "done" if result else "error"
            total_weeks = result.total_weeks if result else 0
            
            # Save study plan
            plan_id = save_study_plan(
                request.user_id, data,
                result.dict() if result else None,
                status, total_weeks, error
            )
            
            # Add plan_id to result for tracking
            result_dict = result.dict() if result else {"error": error}
            result_dict["plan_id"] = plan_id
        
        # Send result via Kafka
        send_result(result_dict if not is_legacy else (result.dict() if result else {"error": error}))
        
        logger.info(f"Study plan generation completed for user {request.user_id}, status: {status}")
        
    except Exception as e:
        error_msg = f"Error processing study plan request: {str(e)}"
        logger.error(error_msg, exc_info=True)
        
        # Extract user_id for error response
        user_id = data.get("user_id", "unknown")
        save_study_plan(user_id, data, None, "error", 0, error_msg)
        send_result({"error": error_msg, "user_id": user_id})

def handle_progress_update(data):
    """
    Handle progress updates for study resources
    """
    try:
        from database import update_resource_progress
        
        required_fields = ["user_id", "resource_id", "completion_status", "progress_percentage"]
        if not all(field in data for field in required_fields):
            raise ValueError(f"Missing required fields: {required_fields}")
        
        update_resource_progress(
            user_id=data["user_id"],
            resource_id=data["resource_id"],
            completion_status=data["completion_status"],
            progress_percentage=data["progress_percentage"],
            actual_time_spent=data.get("actual_time_spent", 0)
        )
        
        send_result({
            "type": "progress_update",
            "user_id": data["user_id"],
            "resource_id": data["resource_id"],
            "status": "success"
        })
        
        logger.info(f"Progress updated for user {data['user_id']}, resource {data['resource_id']}")
        
    except Exception as e:
        error_msg = f"Error updating progress: {str(e)}"
        logger.error(error_msg, exc_info=True)
        send_result({
            "type": "progress_update",
            "error": error_msg,
            "user_id": data.get("user_id", "unknown")
        })