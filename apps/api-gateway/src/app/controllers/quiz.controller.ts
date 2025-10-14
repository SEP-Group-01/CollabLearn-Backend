import {
  Controller,
  Inject,
  Post,
  Get,
  Query,
  Body,
  Param,
  HttpException,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller('quizzes')
export class QuizController {
  constructor(
    @Inject('QUIZ_SERVICE') private readonly quizService: ClientProxy,
    @Inject('AUTH_SERVICE') private readonly authService: ClientProxy,
    @Inject('WORKSPACES_SERVICE')
    private readonly workspacesService: ClientProxy,
  ) {}

  // Helper method to validate token
  private async validateAuthToken(authHeader: string) {
    if (!authHeader) {
      throw new HttpException(
        'Authorization header is required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    try {
      const result = await firstValueFrom(
        this.authService.send({ cmd: 'validate_token' }, { token }),
      );

      console.log('Auth service response:', result);

      // Handle different response structures
      if (result && (result.valid || result.success)) {
        return {
          valid: true,
          success: true,
          user: result.user ||
            result.data || { id: result.userId || result.sub },
        };
      }

      throw new Error('Token validation failed');
    } catch (error) {
      console.error('Token validation error:', error);
      throw new HttpException(
        'Invalid or expired token',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  // Health check endpoint
  @Get('health')
  health(): { status: string; service: string; timestamp: string } {
    return {
      status: 'healthy',
      service: 'quiz-service',
      timestamp: new Date().toISOString(),
    };
  }

  // Root endpoint - made more specific to avoid conflict with :id route
  @Get('info')
  root(): { message: string; endpoints: string[] } {
    return {
      message: 'Quiz Service API Gateway',
      endpoints: [
        'GET /quizzes/health',
        'POST /quizzes/thread/:threadId',
        'GET /quizzes/thread/:threadId',
        'POST /quizzes/check-admin-or-moderator',
        'POST /quizzes/start',
        'GET /quizzes/:id',
      ],
    };
  }

  // Create a new quiz
  @Post('create')
  async createQuiz(
    @Headers('authorization') authorizationHeader: string,
    @Body()
    body: {
      title: string;
      description: string;
      timeAllocated: number;
      totalMarks?: number;
      topics?: string;
      selectedResources?: string[];
      questions: any[];
      tags?: string[];
      resourceTags?: string[];
      thread_id?: string;
    },
  ) {
    console.log('token:', authorizationHeader);
    console.log('Creating quiz:', body);

    try {
      // 1. Validate token with auth service and get decoded user data
      console.log('Validating token with auth service...');
      const authResult = await this.validateAuthToken(authorizationHeader);
      console.log(authResult);

      if (!authResult.valid) {
        throw new HttpException(
          'Invalid or expired token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const userId = authResult.user.id;
      console.log('Token validated for user:', userId);

      // 3. Check user permissions with workspace service
      // console.log('Checking user permissions for thread:', body.thread_id);
      // const permissionResult = await firstValueFrom(
      //   this.workspacesService.send(
      //     { cmd: 'check_moderator_or_admin' },
      //     { userId, threadId: body.thread_id },
      //   ),
      // );

      // if (!permissionResult.success) {
      //   throw new HttpException(
      //     'Permission denied: You must be a workspace admin or thread moderator to create quizzes',
      //     HttpStatus.FORBIDDEN,
      //   );
      // }

      // const { workspaceId } = permissionResult;
      // console.log('Permission granted for workspace:', workspaceId);

      // 4. Create quiz with validated user data
      const createQuizData = {
        createQuizDto: {
          title: body.title,
          description: body.description,
          timeAllocated: body.timeAllocated,
          questions: body.questions,
          tags: body.tags || [],
          resourceTags: body.resourceTags || [],
        },
        userId,
        threadId: body.thread_id,
      };

      const result = await firstValueFrom(
        this.quizService.send({ cmd: 'create_quiz' }, createQuizData),
      );

      return {
        success: true,
        quizId: result.quiz.id,
        message: 'Quiz created successfully',
        quiz: result.quiz,
      };
    } catch (error) {
      console.error('Error creating quiz:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        error?.message || 'Failed to create quiz',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Create a new quiz scoped to a thread (simpler path)
  @Post('thread/:threadId')
  async createQuizInThread(
    @Param('threadId') threadId: string,
    @Headers('authorization') authorizationHeader: string,
    @Body()
    body: {
      title: string;
      description: string;
      timeAllocated: number;
      totalMarks?: number;
      topics?: string;
      selectedResources?: string[];
      questions: any[];
      tags?: string[];
      resourceTags?: string[];
    },
  ) {
    try {
      const authResult = await this.validateAuthToken(authorizationHeader);

      if (!authResult?.success) {
        throw new HttpException(
          'Invalid or expired token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const userId =
        authResult.user.id || authResult.user.userId || authResult.user.sub;

      // For now, we'll skip the workspace permission check
      // and let the quiz service handle the workspace lookup from threadId
      // const permissionResult = await firstValueFrom(
      //   this.workspacesService.send(
      //     { cmd: 'check_user_permission' },
      //     { userId, threadId },
      //   ),
      // );

      // if (!permissionResult?.success) {
      //   throw new HttpException('Permission denied', HttpStatus.FORBIDDEN);
      // }

      // const { workspaceId } = permissionResult;
      const workspaceId = 'temp-workspace-id'; // Temporary fix

      const createQuizData = {
        createQuizDto: {
          title: body.title,
          description: body.description,
          timeAllocated: body.timeAllocated,
          questions: body.questions,
          tags: body.tags || [],
          resourceTags: body.resourceTags || [],
        },
        userId,
        workspaceId,
        threadId,
      };

      const result = await firstValueFrom(
        this.quizService.send({ cmd: 'create_quiz' }, createQuizData),
      );

      return {
        success: true,
        quizId: result.quiz.id,
        message: 'Quiz created successfully',
        quiz: result.quiz,
      };
    } catch (err) {
      const error = err as Error;
      console.error('Error creating quiz in thread:', err);
      throw new HttpException(
        error.message || 'Failed to create quiz',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Get all quizzes
  @Get('list')
  async getQuizzes(@Query('workspaceId') workspaceId?: string) {
    console.log('Fetching quizzes for workspace:', workspaceId);

    try {
      return await firstValueFrom(
        this.quizService.send({ cmd: 'list_quizzes' }, { workspaceId }),
      );
    } catch (error) {
      console.error('Error fetching quizzes:', error);
      throw new HttpException(
        error?.message || 'Failed to fetch quizzes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Thread scoped quizzes (simpler path)
  @Get('thread/:threadId')
  async getQuizzesByThread(@Param('threadId') threadId: string) {
    console.log('Fetching quizzes for thread:', threadId);
    try {
      return await firstValueFrom(
        this.quizService.send({ cmd: 'list_quizzes' }, { threadId }),
      );
    } catch (error) {
      console.error('Error fetching quizzes by thread:', error);
      throw new HttpException(
        error?.message || 'Failed to fetch quizzes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Get quiz by ID
  @Get(':id')
  async getQuizById(@Param('id') id: string) {
    console.log('Fetching quiz by ID:', id);

    try {
      return await firstValueFrom(
        this.quizService.send({ cmd: 'get_quiz' }, { quizId: id }),
      );
    } catch (error) {
      console.error('Error fetching quiz:', error);
      // If the microservice threw an HttpException-like structure, propagate message/status
      const err = error;
      const msg =
        err?.message ||
        (err?.error?.message ? err.error.message : 'Quiz not found');
      throw new HttpException(msg, HttpStatus.NOT_FOUND);
    }
  }

  // Start quiz attempt
  @Post(':id/start')
  async startQuiz(
    @Param('id') quizId: string,
    @Headers('authorization') authorizationHeader: string,
    @Body() body: { workspaceId?: string },
  ) {
    console.log('Starting quiz attempt:', { quizId, ...body });

    try {
      const authResult = await this.validateAuthToken(authorizationHeader);
      if (!authResult.valid) {
        throw new HttpException(
          'Invalid or expired token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const userId = authResult.user.id;

      return await firstValueFrom(
        this.quizService.send(
          { cmd: 'start_quiz' },
          {
            startQuizDto: {
              quizId,
              userId,
              workspaceId: body.workspaceId || 'default',
            },
          },
        ),
      );
    } catch (error) {
      console.error('Error starting quiz:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error?.message || 'Failed to start quiz',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Get active attempt
  @Get(':id/active-attempt')
  async getActiveAttempt(
    @Param('id') quizId: string,
    @Headers('authorization') authorizationHeader: string,
  ) {
    console.log('Getting active attempt:', { quizId });

    try {
      const authResult = await this.validateAuthToken(authorizationHeader);
      if (!authResult.valid) {
        throw new HttpException(
          'Invalid or expired token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const userId = authResult.user.id;

      return await firstValueFrom(
        this.quizService.send(
          { cmd: 'get_active_attempt' },
          { userId, quizId },
        ),
      );
    } catch (error) {
      console.error('Error getting active attempt:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error?.message || 'Failed to get active attempt',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Submit quiz attempt (plural path expected by frontend)
  @Post(':id/attempt')
  @Post(':id/attempts')
  async submitQuizAttempt(
    @Param('id') quizId: string,
    @Headers('authorization') authorizationHeader: string,
    @Body()
    body: {
      attemptId: string;
      answers: any[];
      timeTaken?: number;
    },
  ) {
    console.log('Submitting quiz attempt:', { quizId, ...body });

    try {
      const authResult = await this.validateAuthToken(authorizationHeader);
      if (!authResult.valid) {
        throw new HttpException(
          'Invalid or expired token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // The quiz service listens for 'attempt_quiz' message
      return await firstValueFrom(
        this.quizService.send(
          { cmd: 'attempt_quiz' },
          {
            attemptQuizDto: {
              attemptId: body.attemptId,
              answers: body.answers,
            },
          },
        ),
      );
    } catch (error) {
      console.error('Error submitting quiz attempt:', error);
      const e = error as Error;
      throw new HttpException(
        e.message || 'Failed to submit quiz attempt',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Get my attempts for a quiz
  @Get(':id/attempts/me')
  async getMyAttemptsForQuiz(
    @Param('id') quizId: string,
    @Headers('authorization') authorizationHeader: string,
  ) {
    console.log('Fetching my quiz attempts:', { quizId });

    try {
      const authResult = await this.validateAuthToken(authorizationHeader);
      if (!authResult.valid) {
        throw new HttpException(
          'Invalid or expired token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const userId = authResult.user.id;

      return await firstValueFrom(
        this.quizService.send({ cmd: 'view_results' }, { quizId, userId }),
      );
    } catch (error) {
      console.error('Error fetching my quiz attempts:', error);
      throw new HttpException(
        error?.message || 'Failed to fetch quiz attempts',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Get quiz attempts for a user (admin/moderator view)
  @Get(':id/attempts')
  async getQuizAttempts(
    @Param('id') quizId: string,
    @Query('userId') userId: string,
    @Headers('authorization') authorizationHeader: string,
  ) {
    console.log('Fetching quiz attempts:', { quizId, userId });

    try {
      const authResult = await this.validateAuthToken(authorizationHeader);
      if (!authResult.valid) {
        throw new HttpException(
          'Invalid or expired token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      return await firstValueFrom(
        this.quizService.send({ cmd: 'view_results' }, { quizId, userId }),
      );
    } catch (error) {
      console.error('Error fetching quiz attempts:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error?.message || 'Failed to fetch quiz attempts',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Check admin or moderator permissions
  @Post('check-admin-or-moderator')
  async checkAdminOrModerator(
    @Body() body: { userId: string; threadId: string },
    @Headers('authorization') authorizationHeader: string,
  ) {
    console.log('Checking admin/moderator permissions:', body);

    try {
      const authResult = await this.validateAuthToken(authorizationHeader);
      if (!authResult.valid) {
        throw new HttpException(
          'Invalid or expired token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      return await firstValueFrom(
        this.quizService.send(
          { cmd: 'check-admin-or-moderator' },
          { userId: body.userId, threadId: body.threadId },
        ),
      );
    } catch (error) {
      console.error('Error checking admin/moderator permissions:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error?.message || 'Failed to check permissions',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Simplified start quiz endpoint
  @Post('start')
  async startQuizSimple(
    @Body() body: { quizId: string; userId: string },
    @Headers('authorization') authorizationHeader: string,
  ) {
    console.log('Starting quiz (simple):', body);

    try {
      const authResult = await this.validateAuthToken(authorizationHeader);
      if (!authResult.valid) {
        throw new HttpException(
          'Invalid or expired token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      return await firstValueFrom(
        this.quizService.send(
          { cmd: 'start_quiz' },
          { startQuizDto: { quizId: body.quizId, userId: body.userId } },
        ),
      );
    } catch (error) {
      console.error('Error starting quiz:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error?.message || 'Failed to start quiz',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

// New separate controller for thread-based endpoints (matching frontend expectations)
@Controller('threads')
export class ThreadQuizController {
  constructor(
    @Inject('QUIZ_SERVICE') private readonly quizService: ClientProxy,
    @Inject('AUTH_SERVICE') private readonly authService: ClientProxy,
  ) {}

  // Helper method to validate token
  private async validateAuthToken(authHeader: string) {
    if (!authHeader) {
      throw new HttpException(
        'Authorization header is required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    try {
      const result = await firstValueFrom(
        this.authService.send({ cmd: 'validate_token' }, { token }),
      );

      console.log('Auth service response:', result);

      // Handle different response structures
      if (result && (result.valid || result.success)) {
        return {
          valid: true,
          success: true,
          user: result.user ||
            result.data || { id: result.userId || result.sub },
        };
      }

      throw new Error('Token validation failed');
    } catch (error) {
      console.error('Token validation error:', error);
      throw new HttpException(
        'Invalid or expired token',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  // GET /api/threads/:threadId/quizzes - List quizzes in thread
  @Get(':threadId/quizzes')
  async getQuizzesInThread(
    @Param('threadId') threadId: string,
    @Headers('authorization') authorizationHeader: string,
  ) {
    console.log('Fetching quizzes for thread:', threadId);
    console.log('Auth header:', authorizationHeader);

    try {
      // Validate token and check user permissions
      const authResult = await this.validateAuthToken(authorizationHeader);
      if (!authResult?.success) {
        throw new HttpException(
          'Invalid or expired token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const userId =
        authResult.user.id || authResult.user.userId || authResult.user.sub;
      console.log('User requesting quizzes:', userId);

      // TODO: Add permission check to verify user has access to this thread
      // This would check if user is workspace member and thread subscriber

      return await firstValueFrom(
        this.quizService.send({ cmd: 'list_quizzes' }, { threadId, userId }),
      );
    } catch (error) {
      console.error('Error fetching quizzes by thread:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error?.message || 'Failed to fetch quizzes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  } // POST /api/threads/:threadId/quizzes - Create quiz in thread
  @Post(':threadId/quizzes')
  async createQuizInThread(
    @Param('threadId') threadId: string,
    @Headers('authorization') authorizationHeader: string,
    @Body()
    body: {
      title: string;
      description: string;
      timeAllocated: number;
      questions: any[];
    },
  ) {
    console.log('Creating quiz in thread:', threadId, body);

    try {
      const authResult = await this.validateAuthToken(authorizationHeader);
      if (!authResult?.success) {
        throw new HttpException(
          'Invalid or expired token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const userId =
        authResult.user.id || authResult.user.userId || authResult.user.sub;

      const createQuizData = {
        createQuizDto: {
          title: body.title,
          description: body.description,
          timeAllocated: body.timeAllocated,
          questions: body.questions || [],
        },
        userId,
        threadId,
      };

      const result = await firstValueFrom(
        this.quizService.send({ cmd: 'create_quiz' }, createQuizData),
      );

      return {
        success: true,
        quiz: result.quiz,
        message: 'Quiz created successfully in thread',
      };
    } catch (error) {
      console.error('Error creating quiz in thread:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error?.message || 'Failed to create quiz in thread',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // POST /api/threads/:threadId/quizzes/create - Alternative endpoint for frontend compatibility
  @Post(':threadId/quizzes/create')
  async createQuizInThreadWithCreate(
    @Param('threadId') threadId: string,
    @Headers('authorization') authorizationHeader: string,
    @Body()
    body: {
      title: string;
      description: string;
      timeAllocated: number;
      questions: any[];
    },
  ) {
    console.log('Creating quiz in thread (with /create):', threadId, body);

    try {
      const authResult = await this.validateAuthToken(authorizationHeader);
      if (!authResult?.success) {
        throw new HttpException(
          'Invalid or expired token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const userId =
        authResult.user.id || authResult.user.userId || authResult.user.sub;

      const createQuizData = {
        createQuizDto: {
          title: body.title,
          description: body.description,
          timeAllocated: body.timeAllocated,
          questions: body.questions || [],
        },
        userId,
        threadId,
      };

      const result = await firstValueFrom(
        this.quizService.send({ cmd: 'create_quiz' }, createQuizData),
      );

      return {
        success: true,
        quiz: result.quiz,
        message: 'Quiz created successfully in thread',
      };
    } catch (error) {
      console.error('Error creating quiz in thread (with /create):', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error?.message || 'Failed to create quiz in thread',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // GET /api/threads/:threadId/resources - Get thread resources for quiz creation
  @Get(':threadId/resources')
  async getThreadResources(
    @Param('threadId') threadId: string,
    @Headers('authorization') authorizationHeader: string,
  ) {
    console.log('Fetching resources for thread:', threadId);

    try {
      // Validate token
      const authResult = await this.validateAuthToken(authorizationHeader);
      if (!authResult?.success) {
        throw new HttpException(
          'Invalid or expired token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      return await firstValueFrom(
        this.quizService.send({ cmd: 'get_thread_resources' }, { threadId }),
      );
    } catch (error) {
      console.error('Error fetching thread resources:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error?.message || 'Failed to fetch thread resources',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
