"""
Study Plan Analytics Service
Provides analytics and feasibility analysis for study plans
"""
import logging
from typing import Dict, Any, List
from datetime import datetime, date, timedelta

logger = logging.getLogger(__name__)


class StudyPlanAnalytics:
    """Analytics service for study plans"""
    
    @staticmethod
    def analyze_feasibility(
        total_study_minutes_needed: int,
        total_available_minutes: int,
        resources: List[Dict[str, Any]],
        slots: List[Dict[str, Any]],
        max_weeks: int
    ) -> Dict[str, Any]:
        """
        Analyze if a study plan is feasible
        
        Returns:
            Dictionary with feasibility analysis
        """
        # Calculate basic metrics
        utilization_ratio = total_study_minutes_needed / total_available_minutes if total_available_minutes > 0 else float('inf')
        
        is_feasible = utilization_ratio <= 1.0
        
        # Calculate warnings
        warnings = []
        recommendations = []
        
        if utilization_ratio > 1.0:
            deficit = total_study_minutes_needed - total_available_minutes
            warnings.append(f"Insufficient time: Need {deficit} more minutes ({deficit/60:.1f} hours)")
            recommendations.append(f"Consider adding {int((deficit / 60) / max_weeks) + 1} more hours per week")
        
        elif utilization_ratio > 0.9:
            warnings.append("Very tight schedule: 90%+ time utilization")
            recommendations.append("Consider adding buffer time for flexibility")
        
        elif utilization_ratio < 0.5:
            warnings.append("Underutilized schedule: Less than 50% time usage")
            recommendations.append("You have extra time for additional resources or deeper study")
        
        # Check resource distribution
        resource_times = [r.get('remaining_minutes', 0) for r in resources]
        if max(resource_times) > total_available_minutes * 0.5:
            warnings.append("One resource requires >50% of total time")
            recommendations.append("Consider breaking down large resources into smaller chunks")
        
        # Check weekly load
        weekly_slots = {}
        for slot in slots:
            week = slot.get('week_number', 1)
            if week not in weekly_slots:
                weekly_slots[week] = []
            weekly_slots[week].append(slot)
        
        weekly_loads = []
        for week, week_slots in weekly_slots.items():
            week_minutes = sum(
                calculate_slot_duration(s.get('start_time', '00:00'), s.get('end_time', '00:00'))
                for s in week_slots
            )
            weekly_loads.append(week_minutes)
        
        if weekly_loads:
            avg_weekly_load = sum(weekly_loads) / len(weekly_loads)
            if max(weekly_loads) > avg_weekly_load * 1.5:
                warnings.append("Uneven weekly distribution detected")
                recommendations.append("Consider balancing study time more evenly across weeks")
        
        return {
            'is_feasible': is_feasible,
            'utilization_ratio': round(utilization_ratio, 2),
            'total_study_hours_needed': round(total_study_minutes_needed / 60, 2),
            'total_available_hours': round(total_available_minutes / 60, 2),
            'deficit_hours': round(max(0, total_study_minutes_needed - total_available_minutes) / 60, 2),
            'surplus_hours': round(max(0, total_available_minutes - total_study_minutes_needed) / 60, 2),
            'resources_count': len(resources),
            'slots_count': len(slots),
            'max_weeks': max_weeks,
            'average_weekly_hours': round(sum(weekly_loads) / len(weekly_loads) / 60, 2) if weekly_loads else 0,
            'warnings': warnings,
            'recommendations': recommendations,
            'details': {
                'weekly_loads': [round(w / 60, 2) for w in weekly_loads],
                'resource_distribution': calculate_resource_distribution(resources)
            }
        }
    
    @staticmethod
    def calculate_completion_statistics(tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate statistics about task completion"""
        if not tasks:
            return {
                'total_tasks': 0,
                'completed_tasks': 0,
                'completion_rate': 0,
                'average_rating': 0
            }
        
        completed = [t for t in tasks if t.get('status') == 'completed']
        rated = [t for t in tasks if t.get('rating') is not None]
        
        return {
            'total_tasks': len(tasks),
            'completed_tasks': len(completed),
            'pending_tasks': len([t for t in tasks if t.get('status') == 'pending']),
            'in_progress_tasks': len([t for t in tasks if t.get('status') == 'in_progress']),
            'skipped_tasks': len([t for t in tasks if t.get('status') == 'skipped']),
            'completion_rate': round(len(completed) / len(tasks) * 100, 2) if tasks else 0,
            'average_rating': round(sum(t['rating'] for t in rated) / len(rated), 2) if rated else 0,
            'total_time_allocated': sum(t.get('allocated_minutes', 0) for t in tasks),
            'total_time_spent': sum(t.get('actual_time_spent', 0) for t in tasks),
            'time_efficiency': calculate_time_efficiency(tasks)
        }
    
    @staticmethod
    def generate_progress_report(
        plan: Dict[str, Any],
        tasks: List[Dict[str, Any]],
        resources: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Generate a comprehensive progress report"""
        completion_stats = StudyPlanAnalytics.calculate_completion_statistics(tasks)
        
        # Calculate per-resource progress
        resource_progress = {}
        for resource in resources:
            resource_id = str(resource.get('resource_id', resource.get('id')))
            resource_tasks = [t for t in tasks if str(t.get('resource_id')) == resource_id]
            
            if resource_tasks:
                completed = len([t for t in resource_tasks if t.get('status') == 'completed'])
                resource_progress[resource_id] = {
                    'resource_title': resource.get('title', 'Unknown'),
                    'total_tasks': len(resource_tasks),
                    'completed_tasks': completed,
                    'completion_rate': round(completed / len(resource_tasks) * 100, 2),
                    'total_time_allocated': sum(t.get('allocated_minutes', 0) for t in resource_tasks),
                    'total_time_spent': sum(t.get('actual_time_spent', 0) for t in resource_tasks)
                }
        
        return {
            'plan_id': plan.get('id'),
            'plan_status': plan.get('status'),
            'generated_at': plan.get('generated_at'),
            'days_active': (datetime.utcnow().date() - datetime.fromisoformat(plan.get('plan_start_date', str(date.today()))).date()).days,
            'completion_statistics': completion_stats,
            'resource_progress': resource_progress,
            'recommendations': generate_recommendations(completion_stats, tasks)
        }


def calculate_slot_duration(start_time: str, end_time: str) -> int:
    """Calculate duration between start and end times in minutes"""
    try:
        from datetime import time as dt_time
        start = dt_time.fromisoformat(start_time)
        end = dt_time.fromisoformat(end_time)
        
        start_minutes = start.hour * 60 + start.minute
        end_minutes = end.hour * 60 + end.minute
        
        return max(0, end_minutes - start_minutes)
    except:
        return 0


def calculate_resource_distribution(resources: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate how study time is distributed across resources"""
    if not resources:
        return {}
    
    total_minutes = sum(r.get('remaining_minutes', 0) for r in resources)
    
    distribution = {}
    for resource in resources:
        resource_id = str(resource.get('resource_id', resource.get('id')))
        minutes = resource.get('remaining_minutes', 0)
        distribution[resource_id] = {
            'title': resource.get('title', 'Unknown'),
            'minutes': minutes,
            'percentage': round(minutes / total_minutes * 100, 2) if total_minutes > 0 else 0
        }
    
    return distribution


def calculate_time_efficiency(tasks: List[Dict[str, Any]]) -> float:
    """Calculate time efficiency (actual vs allocated time)"""
    total_allocated = sum(t.get('allocated_minutes', 0) for t in tasks)
    total_spent = sum(t.get('actual_time_spent', 0) for t in tasks)
    
    if total_allocated == 0:
        return 0
    
    return round(total_spent / total_allocated * 100, 2)


def generate_recommendations(completion_stats: Dict[str, Any], tasks: List[Dict[str, Any]]) -> List[str]:
    """Generate recommendations based on completion statistics"""
    recommendations = []
    
    completion_rate = completion_stats.get('completion_rate', 0)
    
    if completion_rate < 50:
        recommendations.append("Your completion rate is below 50%. Consider adjusting your schedule or breaking tasks into smaller chunks.")
    
    elif completion_rate >= 80:
        recommendations.append("Great job! You're maintaining a high completion rate.")
    
    time_efficiency = completion_stats.get('time_efficiency', 0)
    
    if time_efficiency > 120:
        recommendations.append("You're spending more time than allocated. Consider adding buffer time to your schedule.")
    
    elif time_efficiency < 80:
        recommendations.append("You're finishing tasks faster than expected. You might be able to take on more material.")
    
    average_rating = completion_stats.get('average_rating', 0)
    
    if average_rating > 0 and average_rating < 3:
        recommendations.append("Your average task rating is low. Consider adjusting difficulty or adding more preparation time.")
    
    return recommendations


# Export main class
__all__ = ['StudyPlanAnalytics']
