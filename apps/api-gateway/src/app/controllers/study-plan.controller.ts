import { 
  Controller, 
  Post, 
  Get, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query,
  Req,
  HttpException,
  HttpStatus,
  Headers,
  Inject
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { KafkaService } from '../services/kafka.service';

@Controller('study-plan')
export class StudyPlanController {
  constructor(
    private readonly kafkaService: KafkaService,
    @Inject('AUTH_SERVICE') private readonly authService: ClientProxy,
  ) {}

  // Helper method to validate token
  private async validateAuthToken(authHeader: string) {
    console.log('🔐 [Study Plan] Validating auth token...');
    
    if (!authHeader) {
      console.error('❌ [Study Plan] Authorization header is missing');
      throw new HttpException(
        'Authorization header is required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    try {
      const validation = await firstValueFrom(
        this.authService.send({ cmd: 'validate_token' }, { token }),
      );
      console.log('✅ [Study Plan] Token validated for user:', validation.user?.id);
      return validation;
    } catch (error) {
      console.error('❌ [Study Plan] Token validation failed:', error);
      throw new HttpException(
        'Invalid or expired token',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  // ============================================
  // Slot Management Endpoints
  // ============================================

  @Post('slots')
  async createSlot(@Headers('authorization') authHeader: string, @Body() body: any) {
    try {
      console.log('📝 [Study Plan] Creating study slot...');
      
      const tokenValidation = await this.validateAuthToken(authHeader);
      const userId = tokenValidation.user?.id || tokenValidation.user?.userId;

      if (!userId) {
        throw new HttpException('User ID not found in token', HttpStatus.UNAUTHORIZED);
      }

      console.log('📤 [Study Plan] Sending create slot request for user:', userId);
      
      const response = await this.kafkaService.sendMessage('study-plan-slots.create-slot', {
        user_id: userId,
        day_of_week: body.day_of_week,
        start_time: body.start_time,
        end_time: body.end_time
      });

      if (!response.success) {
        console.error('❌ [Study Plan] Create slot failed:', response.error);
        throw new HttpException(
          response.error || 'Failed to create slot',
          HttpStatus.BAD_REQUEST
        );
      }

      console.log('✅ [Study Plan] Slot created successfully');
      return response;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('❌ [Study Plan] Error creating slot:', error);
      throw new HttpException(
        'Failed to create study slot',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('slots')
  async getSlots(@Headers('authorization') authHeader: string, @Query('is_free') isFree?: string) {
    try {
      console.log('🔍 [Study Plan] Fetching study slots...');
      
      const tokenValidation = await this.validateAuthToken(authHeader);
      const userId = tokenValidation.user?.id || tokenValidation.user?.userId;

      if (!userId) {
        throw new HttpException('User ID not found in token', HttpStatus.UNAUTHORIZED);
      }

      console.log('📤 [Study Plan] Sending get slots request for user:', userId);
      
      const response = await this.kafkaService.sendMessage('study-plan-slots.get-slots', {
        user_id: userId,
        is_free: isFree !== undefined ? isFree === 'true' : undefined
      });

      if (!response.success) {
        console.error('❌ [Study Plan] Get slots failed:', response.error);
        throw new HttpException(
          response.error || 'Failed to fetch slots',
          HttpStatus.BAD_REQUEST
        );
      }

      console.log('✅ [Study Plan] Slots fetched successfully:', response.slots?.length || 0, 'slots');
      return response;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('❌ [Study Plan] Error fetching slots:', error);
      throw new HttpException(
        'Failed to fetch study slots',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Put('slots/:slotId')
  async updateSlot(@Headers('authorization') authHeader: string, @Param('slotId') slotId: string, @Body() body: any) {
    try {
      console.log('✏️ [Study Plan] Updating study slot:', slotId);
      
      const tokenValidation = await this.validateAuthToken(authHeader);
      const userId = tokenValidation.user?.id || tokenValidation.user?.userId;

      console.log('📤 [Study Plan] Sending update slot request');
      
      const response = await this.kafkaService.sendMessage('study-plan-slots.update-slot', {
        slot_id: slotId,
        user_id: userId,
        update_data: body
      });

      if (!response.success) {
        console.error('❌ [Study Plan] Update slot failed:', response.error);
        throw new HttpException(
          response.error || 'Failed to update slot',
          HttpStatus.BAD_REQUEST
        );
      }

      console.log('✅ [Study Plan] Slot updated successfully');
      return response;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('❌ [Study Plan] Error updating slot:', error);
      throw new HttpException(
        'Failed to update study slot',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete('slots/:slotId')
  async deleteSlot(@Headers('authorization') authHeader: string, @Param('slotId') slotId: string) {
    try {
      console.log('🗑️ [Study Plan] Deleting study slot:', slotId);
      
      const tokenValidation = await this.validateAuthToken(authHeader);
      const userId = tokenValidation.user?.id || tokenValidation.user?.userId;

      if (!userId) {
        throw new HttpException('User ID not found in token', HttpStatus.UNAUTHORIZED);
      }

      console.log('📤 [Study Plan] Sending delete slot request for user:', userId);
      
      const response = await this.kafkaService.sendMessage('study-plan-slots.delete-slot', {
        slot_id: slotId,
        user_id: userId
      });

      if (!response.success) {
        console.error('❌ [Study Plan] Delete slot failed:', response.error);
        throw new HttpException(
          response.error || 'Failed to delete slot',
          HttpStatus.BAD_REQUEST
        );
      }

      console.log('✅ [Study Plan] Slot deleted successfully');
      return response;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('❌ [Study Plan] Error deleting slot:', error);
      throw new HttpException(
        'Failed to delete study slot',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ============================================
  // Study Plan Generation Endpoints
  // ============================================

  @Post('generate')
  async generatePlan(@Headers('authorization') authHeader: string, @Body() body: any) {
    try {
      console.log('🎯 [Study Plan] Generating study plan...');
      
      const tokenValidation = await this.validateAuthToken(authHeader);
      const userId = tokenValidation.user?.id || tokenValidation.user?.userId;

      if (!userId) {
        throw new HttpException('User ID not found in token', HttpStatus.UNAUTHORIZED);
      }

      console.log('📤 [Study Plan] Sending generate plan request for user:', userId);
      
      const response = await this.kafkaService.sendMessage('study-plan-requests.generate', {
        user_id: userId,
        max_weeks: body.max_weeks,
        revision_ratio: body.revision_ratio || 0.25,
        scheduling_rules: body.scheduling_rules || {
          max_consecutive_same_resource: 2,
          mix_threads_across_workspaces: true,
          balance_workspace_focus: true
        },
        slots: body.slots,
        resources: body.resources
      });

      if (!response.success) {
        console.error('❌ [Study Plan] Generate plan failed:', response.error);
        throw new HttpException(
          response.error || 'Failed to generate study plan',
          HttpStatus.BAD_REQUEST
        );
      }

      console.log('✅ [Study Plan] Study plan generated successfully');
      return response;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('❌ [Study Plan] Error generating plan:', error);
      throw new HttpException(
        'Failed to generate study plan',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('analyze-feasibility')
  async analyzeFeasibility(@Headers('authorization') authHeader: string, @Body() body: any) {
    try {
      console.log('📊 [Study Plan] Analyzing feasibility...');
      
      await this.validateAuthToken(authHeader);

      console.log('📤 [Study Plan] Sending feasibility analysis request');
      
      const response = await this.kafkaService.sendMessage('study-plan-analysis.feasibility', {
        max_weeks: body.max_weeks,
        slots: body.slots,
        resources: body.resources
      });

      if (!response.success) {
        console.error('❌ [Study Plan] Feasibility analysis failed:', response.error);
        throw new HttpException(
          response.error || 'Failed to analyze feasibility',
          HttpStatus.BAD_REQUEST
        );
      }

      console.log('✅ [Study Plan] Feasibility analysis completed');
      return response;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('❌ [Study Plan] Error analyzing feasibility:', error);
      throw new HttpException(
        'Failed to analyze feasibility',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('history')
  async getPlanHistory(@Headers('authorization') authHeader: string, @Query('status') status?: string) {
    try {
      console.log('📜 [Study Plan] Fetching plan history...');
      
      const tokenValidation = await this.validateAuthToken(authHeader);
      const userId = tokenValidation.user?.id || tokenValidation.user?.userId;

      if (!userId) {
        throw new HttpException('User ID not found in token', HttpStatus.UNAUTHORIZED);
      }

      console.log('📤 [Study Plan] Sending get history request for user:', userId);
      
      const response = await this.kafkaService.sendMessage('study-plan-requests.history', {
        user_id: userId,
        status: status
      });

      if (!response.success) {
        console.error('❌ [Study Plan] Get history failed:', response.error);
        throw new HttpException(
          response.error || 'Failed to fetch plan history',
          HttpStatus.BAD_REQUEST
        );
      }

      console.log('✅ [Study Plan] Plan history fetched successfully');
      return response;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('❌ [Study Plan] Error fetching history:', error);
      throw new HttpException(
        'Failed to fetch plan history',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete('plans/:planId')
  async dropPlan(@Headers('authorization') authHeader: string, @Param('planId') planId: string) {
    try {
      console.log('🗑️ [Study Plan] Dropping study plan:', planId);
      
      const tokenValidation = await this.validateAuthToken(authHeader);
      const userId = tokenValidation.user?.id || tokenValidation.user?.userId;

      if (!userId) {
        throw new HttpException('User ID not found in token', HttpStatus.UNAUTHORIZED);
      }

      console.log('📤 [Study Plan] Sending drop plan request for user:', userId);
      
      const response = await this.kafkaService.sendMessage('study-plan-requests.drop-plan', {
        plan_id: planId,
        user_id: userId
      });

      if (!response.success) {
        console.error('❌ [Study Plan] Drop plan failed:', response.error);
        throw new HttpException(
          response.error || 'Failed to drop study plan',
          HttpStatus.BAD_REQUEST
        );
      }

      console.log('✅ [Study Plan] Study plan dropped successfully');
      return response;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('❌ [Study Plan] Error dropping plan:', error);
      throw new HttpException(
        'Failed to drop study plan',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ============================================
  // Task Management Endpoints
  // ============================================

  @Get('tasks')
  async getTasks(@Headers('authorization') authHeader: string, @Query('plan_id') planId?: string) {
    try {
      console.log('📋 [Study Plan] Fetching tasks...');
      
      const tokenValidation = await this.validateAuthToken(authHeader);
      const userId = tokenValidation.user?.id || tokenValidation.user?.userId;

      if (!userId) {
        throw new HttpException('User ID not found in token', HttpStatus.UNAUTHORIZED);
      }

      console.log('📤 [Study Plan] Sending get tasks request for user:', userId);
      
      const response = await this.kafkaService.sendMessage('study-plan-tasks.get-tasks', {
        user_id: userId,
        plan_id: planId
      });

      if (!response.success) {
        console.error('❌ [Study Plan] Get tasks failed:', response.error);
        throw new HttpException(
          response.error || 'Failed to fetch tasks',
          HttpStatus.BAD_REQUEST
        );
      }

      console.log('✅ [Study Plan] Tasks fetched successfully');
      return response;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('❌ [Study Plan] Error fetching tasks:', error);
      throw new HttpException(
        'Failed to fetch tasks',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Put('tasks/:taskId')
  async updateTask(@Headers('authorization') authHeader: string, @Param('taskId') taskId: string, @Body() body: any) {
    try {
      console.log('✏️ [Study Plan] Updating task:', taskId);
      
      const tokenValidation = await this.validateAuthToken(authHeader);
      const userId = tokenValidation.user?.id || tokenValidation.user?.userId;

      if (!userId) {
        throw new HttpException('User ID not found in token', HttpStatus.UNAUTHORIZED);
      }

      console.log('📤 [Study Plan] Sending update task request');
      
      const response = await this.kafkaService.sendMessage('study-plan-tasks.update-task', {
        task_id: taskId,
        user_id: userId,
        status: body.status,
        completion_percentage: body.completion_percentage,
        actual_time_spent: body.actual_time_spent,
        rating: body.rating,
        notes: body.notes
      });

      if (!response.success) {
        console.error('❌ [Study Plan] Update task failed:', response.error);
        throw new HttpException(
          response.error || 'Failed to update task',
          HttpStatus.BAD_REQUEST
        );
      }

      console.log('✅ [Study Plan] Task updated successfully');
      return response;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('❌ [Study Plan] Error updating task:', error);
      throw new HttpException(
        'Failed to update task',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ============================================
  // Workspace/Resource Endpoints
  // ============================================

  @Get('workspaces')
  async getWorkspaces(@Headers('authorization') authHeader: string) {
    try {
      console.log('🏢 [Study Plan] Fetching workspaces...');
      
      const tokenValidation = await this.validateAuthToken(authHeader);
      const userId = tokenValidation.user?.id || tokenValidation.user?.userId;

      if (!userId) {
        throw new HttpException('User ID not found in token', HttpStatus.UNAUTHORIZED);
      }

      console.log('📤 [Study Plan] Sending get workspaces request for user:', userId);
      
      const response = await this.kafkaService.sendMessage('study-plan-workspaces.get-workspaces', {
        user_id: userId
      });

      if (!response.success) {
        console.error('❌ [Study Plan] Get workspaces failed:', response.error);
        throw new HttpException(
          response.error || 'Failed to fetch workspaces',
          HttpStatus.BAD_REQUEST
        );
      }

      console.log('✅ [Study Plan] Workspaces fetched successfully');
      return response;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('❌ [Study Plan] Error fetching workspaces:', error);
      throw new HttpException(
        'Failed to fetch workspaces',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
