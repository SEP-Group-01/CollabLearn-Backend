import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { KafkaService } from '../services/kafka.service';
import { StudyPlanService } from '../services/study-plan.service';

@Controller('query')
export class QueryController {
  constructor(
    private readonly kafkaService: KafkaService,
    private readonly studyPlanService: StudyPlanService,
  ) {}

  @Post('get-chats')
  async getChats(@Body() body: any) {
    console.log('[QueryController] Get chats request:', body);
    console.log(this.kafkaService.getSubscribedTopics());

    try {
      const response = await this.kafkaService.sendMessage(
        'document-query.chats',
        body,
      );
      return response;
    } catch (error) {
      throw new HttpException(
        error?.message || 'Error fetching chats',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('search-documents')
  async searchDocuments(@Body() body: any) {
    console.log('[QueryController] Search documents request:', body);

    try {
      const response = await this.kafkaService.sendMessage(
        'document-query.search-documents',
        body,
      );
      return response;
    } catch (error) {
      throw new HttpException(
        error?.message || 'Error searching documents',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('get-document-summary')
  async getDocumentSummary(@Body() body: any) {
    console.log('[QueryController] Get document summary request:', body);

    try {
      const response = await this.kafkaService.sendMessage(
        'document-query.get-document-summary',
        body,
      );
      return response;
    } catch (error) {
      throw new HttpException(
        error?.message || 'Error getting document summary',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('generate-study-plan')
  async generateStudyPlan(@Body() body: any) {
    console.log('[QueryController] Generate study plan request:', body);

    try {
      // Map frontend request format to backend format
      const backendRequest = {
        user_id: body.userId,
        workspace_ids: body.workspaceId ? [body.workspaceId] : [],
        thread_ids: body.threadId ? [body.threadId] : [],
        priority_level:
          body.preferences?.difficulty === 'beginner'
            ? 'low'
            : body.preferences?.difficulty === 'advanced'
              ? 'high'
              : 'medium',
        learning_style: 'reading', // default
        difficulty_preference: body.preferences?.difficulty || 'medium',
        session_duration_preference: body.preferences?.studyHours * 60 || 60, // convert to minutes
      };

      const response =
        await this.studyPlanService.analyzeFeasibility(backendRequest);

      // Transform response to match frontend expectations
      return {
        success: true,
        studyPlan: {
          id: `plan_${Date.now()}`,
          title: 'Generated Study Plan',
          description:
            'Your personalized study plan based on selected content and preferences',
          duration: 28, // 4 weeks in days
          tasks: response.feasibility_report
            ? [
                {
                  id: `task_${Date.now()}`,
                  title: 'Study Plan Analysis',
                  description: `Coverage: ${response.feasibility_report.coverage_percentage || 0}%`,
                  type: 'reading',
                  estimatedTime: response.weekly_hours_calculated || 60,
                  difficulty: body.preferences?.difficulty || 'medium',
                  resources: body.workspaceId ? [body.workspaceId] : [],
                },
              ]
            : [],
        },
        message: 'Study plan generated successfully',
      };
    } catch (error) {
      console.error('[QueryController] Error generating study plan:', error);
      throw new HttpException(
        error?.message || 'Error generating study plan',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
