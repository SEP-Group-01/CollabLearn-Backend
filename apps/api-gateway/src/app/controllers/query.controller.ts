import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { KafkaService } from '../services/kafka.service';

@Controller('query')
export class QueryController {
  constructor(
    private readonly kafkaService: KafkaService,
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

      const response = await this.kafkaService.sendMessage(
        'study-plan-analysis',
        backendRequest,
      );

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

  @Post('query-documents')
  async queryDocuments(@Body() body: any) {
    console.log('[QueryController] Query documents request:', body);

    try {
      const response = await this.kafkaService.sendMessage(
        'document-query.query-documents',
        body,
      );
      return response;
    } catch (error) {
      throw new HttpException(
        error?.message || 'Error querying documents',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('get-conversations')
  async getConversations(@Body() body: any) {
    console.log('[QueryController] Get conversations request:', body);

    try {
      const response = await this.kafkaService.sendMessage(
        'document-query.get-conversations',
        body,
      );
      return response;
    } catch (error) {
      throw new HttpException(
        error?.message || 'Error getting conversations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('get-conversation-messages')
  async getConversationMessages(@Body() body: any) {
    console.log('[QueryController] Get conversation messages request:', body);

    try {
      const response = await this.kafkaService.sendMessage(
        'document-query.get-conversation-messages',
        body,
      );
      return response;
    } catch (error) {
      throw new HttpException(
        error?.message || 'Error getting conversation messages',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('create-conversation')
  async createConversation(@Body() body: any) {
    console.log('[QueryController] Create conversation request:', body);

    try {
      const response = await this.kafkaService.sendMessage(
        'document-query.create-conversation',
        body,
      );
      return response;
    } catch (error) {
      throw new HttpException(
        error?.message || 'Error creating conversation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
