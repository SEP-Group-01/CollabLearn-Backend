import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpException,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { StudyPlanService } from '../services/study-plan.service';

@Controller('study-plan')
export class StudyPlanController {
  constructor(private readonly studyPlanService: StudyPlanService) {}

  @Get('health')
  async getHealth() {
    try {
      return await this.studyPlanService.getHealth();
    } catch (error) {
      throw new HttpException(
        error?.message || 'Study plan service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Get('users/:userId/time-slots')
  async getUserTimeSlots(@Param('userId') userId: string) {
    try {
      return await this.studyPlanService.getUserTimeSlots(userId);
    } catch (error) {
      throw new HttpException(
        error?.message || 'Error fetching user time slots',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('users/:userId/workspaces/:workspaceId/resources')
  async getWorkspaceResources(
    @Param('userId') userId: string,
    @Param('workspaceId') workspaceId: string,
  ) {
    try {
      return await this.studyPlanService.getWorkspaceResources(
        userId,
        workspaceId,
      );
    } catch (error) {
      throw new HttpException(
        error?.message || 'Error fetching workspace resources',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('users/:userId/workspaces/:workspaceId/threads')
  async getWorkspaceThreads(
    @Param('userId') userId: string,
    @Param('workspaceId') workspaceId: string,
  ) {
    try {
      return await this.studyPlanService.getWorkspaceThreads(
        userId,
        workspaceId,
      );
    } catch (error) {
      throw new HttpException(
        error?.message || 'Error fetching workspace threads',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('users/:userId/study-plans')
  async getUserStudyPlans(@Param('userId') userId: string) {
    try {
      return await this.studyPlanService.getUserStudyPlans(userId);
    } catch (error) {
      throw new HttpException(
        error?.message || 'Error fetching user study plans',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('users/:userId/progress')
  async updateProgress(
    @Param('userId') userId: string,
    @Body() progressUpdate: any,
  ) {
    try {
      return await this.studyPlanService.updateProgress(userId, progressUpdate);
    } catch (error) {
      throw new HttpException(
        error?.message || 'Error updating progress',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('analytics/feasibility')
  async analyzeFeasibility(@Body() request: any) {
    try {
      return await this.studyPlanService.analyzeFeasibility(request);
    } catch (error) {
      throw new HttpException(
        error?.message || 'Error analyzing feasibility',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Frontend compatibility endpoints
  @Post('generate-study-plan')
  async generateStudyPlan(@Body() request: any, @Headers() headers: any) {
    console.log('[StudyPlanController] Generate study plan request:', request);
    try {
      // Map frontend request format to backend format
      const backendRequest = {
        user_id: request.userId,
        workspace_ids: request.workspaceId ? [request.workspaceId] : [],
        thread_ids: request.threadId ? [request.threadId] : [],
        priority_level:
          request.preferences?.difficulty === 'beginner'
            ? 'low'
            : request.preferences?.difficulty === 'advanced'
              ? 'high'
              : 'medium',
        learning_style: 'reading', // default
        difficulty_preference: request.preferences?.difficulty || 'medium',
        session_duration_preference: request.preferences?.studyHours * 60 || 60, // convert to minutes
      };

      return await this.studyPlanService.analyzeFeasibility(backendRequest);
    } catch (error) {
      throw new HttpException(
        error?.message || 'Error generating study plan',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('users/:userId/workspaces-with-threads')
  async getUserWorkspacesWithThreads(@Param('userId') userId: string) {
    try {
      // This would need to be implemented to fetch from workspaces service
      // For now, return a placeholder response
      return {
        success: true,
        workspaces: [],
      };
    } catch (error) {
      throw new HttpException(
        error?.message || 'Error fetching workspaces with threads',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
