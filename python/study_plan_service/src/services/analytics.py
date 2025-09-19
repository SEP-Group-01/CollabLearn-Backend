from typing import List, Dict, Tuple
from models.study_plan import StudyResource, CompletionStatus, ResourceType
from datetime import datetime, timedelta
import statistics

class StudyPlanAnalytics:
    """
    Advanced analytics for study plan optimization and tracking
    """
    
    @staticmethod
    def calculate_workload_distribution(resources: List[StudyResource], 
                                      weeks_available: int) -> Dict[int, List[str]]:
        """
        Distribute workload evenly across available weeks
        """
        # Group resources by thread to maintain sequence
        thread_groups = {}
        for resource in resources:
            if resource.thread_id not in thread_groups:
                thread_groups[resource.thread_id] = []
            thread_groups[resource.thread_id].append(resource)
        
        # Sort each thread by sequence number
        for thread_id in thread_groups:
            thread_groups[thread_id].sort(key=lambda x: x.sequence_number)
        
        # Distribute threads across weeks using round-robin
        week_assignments = {i: [] for i in range(1, weeks_available + 1)}
        thread_ids = list(thread_groups.keys())
        
        for i, thread_id in enumerate(thread_ids):
            week_num = (i % weeks_available) + 1
            week_assignments[week_num].append(thread_id)
        
        return week_assignments
    
    @staticmethod
    def estimate_completion_time(resources: List[StudyResource]) -> Dict[str, float]:
        """
        Estimate completion times based on resource types and user progress
        """
        type_multipliers = {
            ResourceType.VIDEO: 1.2,  # Extra time for pausing/rewinding
            ResourceType.QUIZ: 1.5,   # Extra time for thinking
            ResourceType.DOCUMENT: 1.1,
            ResourceType.READING: 1.0,
            ResourceType.LINK: 1.0
        }
        
        estimates = {}
        for resource in resources:
            base_time = resource.estimated_time_minutes
            multiplier = type_multipliers.get(resource.type, 1.0)
            
            # Adjust based on completion status
            if resource.completion_status == CompletionStatus.COMPLETED:
                adjusted_time = 0
            elif resource.completion_status == CompletionStatus.NEEDS_REVISION:
                adjusted_time = base_time * 0.5 * multiplier
            elif resource.completion_status == CompletionStatus.IN_PROGRESS:
                remaining = 1.0 - (resource.progress_percentage / 100.0)
                adjusted_time = base_time * remaining * multiplier
            else:  # NOT_STARTED
                adjusted_time = base_time * multiplier
            
            estimates[resource.id] = adjusted_time / 60.0  # Convert to hours
        
        return estimates
    
    @staticmethod
    def calculate_priority_scores(resources: List[StudyResource]) -> Dict[str, float]:
        """
        Calculate priority scores for resources based on various factors
        """
        priority_scores = {}
        
        # Base priorities by type
        type_priorities = {
            ResourceType.QUIZ: 3.0,      # Highest priority
            ResourceType.VIDEO: 2.0,
            ResourceType.DOCUMENT: 1.5,
            ResourceType.READING: 1.0,
            ResourceType.LINK: 1.0
        }
        
        for resource in resources:
            base_priority = type_priorities.get(resource.type, 1.0)
            
            # Boost priority for incomplete items
            completion_boost = {
                CompletionStatus.NOT_STARTED: 1.0,
                CompletionStatus.IN_PROGRESS: 1.2,  # Higher priority to finish
                CompletionStatus.NEEDS_REVISION: 0.8,
                CompletionStatus.COMPLETED: 0.0
            }
            
            # Sequence boost (earlier items get higher priority)
            sequence_boost = max(0.1, 1.0 - (resource.sequence_number * 0.1))
            
            final_priority = (base_priority * 
                            completion_boost.get(resource.completion_status, 1.0) * 
                            sequence_boost)
            
            priority_scores[resource.id] = final_priority
        
        return priority_scores
    
    @staticmethod
    def generate_feasibility_report(total_required_hours: float, 
                                  weekly_hours_available: int,
                                  weeks_until_deadline: int) -> Dict[str, any]:
        """
        Generate feasibility analysis for study plan
        """
        total_available_hours = weekly_hours_available * weeks_until_deadline
        coverage_ratio = min(1.0, total_available_hours / total_required_hours)
        
        report = {
            "feasible": coverage_ratio >= 0.95,  # 95% coverage considered feasible
            "coverage_percentage": coverage_ratio * 100,
            "total_required_hours": total_required_hours,
            "total_available_hours": total_available_hours,
            "weekly_intensity": total_required_hours / weeks_until_deadline,
            "recommendations": []
        }
        
        # Generate recommendations
        if coverage_ratio < 0.8:
            report["recommendations"].append(
                "Consider extending deadline or increasing weekly study hours"
            )
        elif coverage_ratio < 0.95:
            report["recommendations"].append(
                "Plan is tight - consider adding buffer time for unexpected delays"
            )
        
        if report["weekly_intensity"] > weekly_hours_available * 1.2:
            report["recommendations"].append(
                "Weekly workload exceeds available time - prioritize most important content"
            )
        
        if coverage_ratio >= 1.0:
            extra_hours = total_available_hours - total_required_hours
            report["recommendations"].append(
                f"You have {extra_hours:.1f} extra hours - consider adding additional practice or review time"
            )
        
        return report
    
    @staticmethod
    def suggest_schedule_optimizations(resources: List[StudyResource],
                                     weekly_hours: int) -> List[str]:
        """
        Suggest optimizations for the study schedule
        """
        suggestions = []
        
        # Analyze resource distribution
        type_counts = {}
        for resource in resources:
            type_counts[resource.type] = type_counts.get(resource.type, 0) + 1
        
        # Check for quiz clustering
        if type_counts.get(ResourceType.QUIZ, 0) > 0:
            quiz_ratio = type_counts[ResourceType.QUIZ] / len(resources)
            if quiz_ratio > 0.3:
                suggestions.append(
                    "Consider spacing out quizzes throughout the schedule for better retention"
                )
        
        # Check for video heavy sessions
        if type_counts.get(ResourceType.VIDEO, 0) > 0:
            video_ratio = type_counts[ResourceType.VIDEO] / len(resources)
            if video_ratio > 0.5:
                suggestions.append(
                    "Mix videos with interactive content to maintain engagement"
                )
        
        # Check weekly intensity
        total_hours = sum(r.estimated_time_minutes for r in resources) / 60
        if total_hours / weekly_hours > 4:  # More than 4 weeks of content
            suggestions.append(
                "Consider breaking longer threads into smaller, manageable chunks"
            )
        
        return suggestions