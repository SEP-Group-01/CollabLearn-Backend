import {
  Controller,
  Inject,
  Post,
  Get,
  Delete,
  Query,
  Body,
  Param,
  HttpException,
  HttpStatus,
  Headers,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
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
  // private async validateAuthToken(authHeader: string) {
  //   if (!authHeader) {
  //     throw new HttpException(
  //       'Authorization header is required',
  //       HttpStatus.UNAUTHORIZED,
  //     );
  //   }

  //   const token = authHeader.startsWith('Bearer ')
  //     ? authHeader.substring(7)
  //     : authHeader;

  //   try {
  //     const result = await firstValueFrom(
  //       this.authService.send({ cmd: 'validate_token' }, { token }),
  //     );

  //     console.log('Auth service response:', result);

  //     // Handle different response structures
  //     if (result && (result.valid || result.success)) {
  //       return {
  //         valid: true,
  //         success: true,
  //         user: result.user ||
  //           result.data || { id: result.userId || result.sub },
  //       };
  //     }

  //     throw new Error('Token validation failed');
  //   } catch (error) {
  //     console.error('Token validation error:', error);
  //     throw new HttpException(
  //       'Invalid or expired token',
  //       HttpStatus.UNAUTHORIZED,
  //     );
  //   }
  // }

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
      console.log('Sending token validation request to auth service...');
      const result = await firstValueFrom(
        this.authService.send({ cmd: 'validate_token' }, { token }),
      );
      
      console.log('Auth service raw response:', result);
      
      // Handle different response structures and normalize
      if (result && (result.valid || result.success)) {
        const normalizedResponse = {
          valid: true,
          success: true,
          user: result.user || result.data || { 
            id: result.userId || result.sub || result.id 
          }
        };
        console.log('Normalized auth response:', normalizedResponse);
        return normalizedResponse;
      } else {
        console.log('Auth service returned unsuccessful validation');
        throw new Error('Token validation failed by auth service');
      }
    } catch (error) {
      console.error('Auth service validation error:', error.message);
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

      // 3. Check user permissions - require thread_id for permission check
      if (!body.thread_id) {
        throw new HttpException(
          'Thread ID is required to create a quiz',
          HttpStatus.BAD_REQUEST,
        );
      }

      console.log('Checking user permissions for thread:', body.thread_id);
      const permissionResult = await firstValueFrom(
        this.quizService.send(
          { cmd: 'check-admin-or-moderator' },
          { userId, threadId: body.thread_id },
        ),
      );

      console.log('Permission check result:', permissionResult);

      if (!permissionResult?.success) {
        throw new HttpException(
          'Permission denied. Only workspace admins and thread moderators can create quizzes.',
          HttpStatus.FORBIDDEN,
        );
      }

      console.log('Permission granted for workspace:', permissionResult.workspaceId);

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

      // Check if user has admin or moderator permissions for this thread
      console.log('[createQuizInThread] Checking permissions for user:', userId, 'thread:', threadId);
      
      const permissionResult = await firstValueFrom(
        this.quizService.send(
          { cmd: 'check-admin-or-moderator' },
          { userId, threadId },
        ),
      );

      console.log('[createQuizInThread] Permission check result:', permissionResult);

      if (!permissionResult?.success) {
        throw new HttpException(
          'Permission denied. Only workspace admins and thread moderators can create quizzes.',
          HttpStatus.FORBIDDEN,
        );
      }

      const workspaceId = permissionResult.workspaceId;

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
      console.error('Error creating quiz in thread:', err);
      
      // If it's already an HttpException, preserve the original status
      if (err instanceof HttpException) {
        throw err;
      }
      
      // Otherwise, wrap unknown errors as 500
      const error = err as Error;
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
  async getQuizzesByThread(
    @Param('threadId') threadId: string,
    @Headers('authorization') authorizationHeader: string,
  ) {
    console.log('🔍 [API Gateway] Fetching quizzes for thread:', threadId);
    console.log('🔍 [API Gateway] Authorization header received:', authorizationHeader ? 'Present' : 'Missing');
    
    let userId: string | undefined;
    
    // Try to get userId from auth token if present
    if (authorizationHeader) {
      try {
        console.log('🔍 [API Gateway] Attempting auth service validation...');
        const authResult = await this.validateAuthToken(authorizationHeader);
        console.log('🔍 [API Gateway] Auth service response:', JSON.stringify(authResult, null, 2));
        
        // Handle different response structures from auth service
        if (authResult && (authResult.valid || authResult.success)) {
          userId = authResult.user?.id;
          console.log('✅ [API Gateway] Auth service validated, userId:', userId);
        } else {
          console.log('⚠️  [API Gateway] Auth service validation failed, trying JWT decode backup...');
          
          // Fallback: Try to decode JWT directly
          const token = authorizationHeader.startsWith('Bearer ') 
            ? authorizationHeader.substring(7) 
            : authorizationHeader;
          
          try {
            // Simple base64 decode of JWT payload (not secure validation, just extraction)
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            userId = payload.id || payload.sub || payload.userId;
            console.log('✅ [API Gateway] JWT decode backup successful, userId:', userId);
            console.log('🔍 [API Gateway] JWT payload:', JSON.stringify(payload, null, 2));
          } catch (jwtError) {
            console.log('❌ [API Gateway] JWT decode backup failed:', jwtError.message);
          }
        }
      } catch (error) {
        console.log('❌ [API Gateway] Auth validation error, trying JWT decode backup...');
        console.log('❌ [API Gateway] Auth error details:', error);
        
        // Fallback: Try to decode JWT directly
        try {
          const token = authorizationHeader.startsWith('Bearer ') 
            ? authorizationHeader.substring(7) 
            : authorizationHeader;
          
          const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
          userId = payload.id || payload.sub || payload.userId;
          console.log('✅ [API Gateway] JWT decode backup successful after error, userId:', userId);
        } catch (jwtError) {
          console.log('❌ [API Gateway] JWT decode backup also failed:', jwtError.message);
        }
      }
    } else {
      console.log('⚠️  [API Gateway] No authorization header provided');
    }
    
    console.log('🚀 [API Gateway] Final userId for quiz service:', userId);
    
    try {
      const result = await firstValueFrom(
        this.quizService.send({ cmd: 'list_quizzes' }, { threadId, userId }),
      );
      console.log('✅ [API Gateway] Quiz service response received');
      return result;
    } catch (error) {
      console.error('❌ [API Gateway] Error fetching quizzes by thread:', error);
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
      if (!authResult || !(authResult.valid || authResult.success)) {
        throw new HttpException(
          'Invalid or expired token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const userId = authResult.user?.id;

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
      if (!authResult || !(authResult.valid || authResult.success)) {
        throw new HttpException(
          'Invalid or expired token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const userId = authResult.user?.id;

      const result = await firstValueFrom(
        this.quizService.send(
          { cmd: 'get_active_attempt' },
          { userId, quizId },
        ),
      );
      
      // Handle case where no active attempt exists
      if (result && result.success === false) {
        throw new HttpException(
          result.message || 'No active attempt found',
          HttpStatus.NOT_FOUND,
        );
      }
      
      return result;
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
      if (!authResult || !(authResult.valid || authResult.success)) {
        throw new HttpException(
          'Invalid or expired token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      console.log("User ID:", authResult.user?.id);

      // The quiz service listens for 'attempt_quiz' message
      return await firstValueFrom(
        this.quizService.send(
          { cmd: 'attempt_quiz' },
          {
            attemptQuizDto: {
              userId: authResult.user.id,
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
    console.log('🔍 [API Gateway] Fetching my quiz attempts:', { quizId });

    try {
      const authResult = await this.validateAuthToken(authorizationHeader);
      console.log('🔍 [API Gateway] Auth result for attempts:', authResult);
      
      if (!authResult || !(authResult.valid || authResult.success)) {
        throw new HttpException(
          'Invalid or expired token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const userId = authResult.user?.id;
      console.log('🔍 [API Gateway] UserId for attempts:', userId);

      if (!userId) {
        throw new HttpException(
          'User ID not found in token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      return await firstValueFrom(
        this.quizService.send({ cmd: 'view_results' }, { quizId, userId }),
      );
    } catch (error) {
      console.error('❌ [API Gateway] Error fetching my quiz attempts:', error);
      if (error instanceof HttpException) {
        throw error;
      }
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
      if (!authResult || !(authResult.valid || authResult.success)) {
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
    console.log('🔍 [ThreadController] Fetching quizzes for thread:', threadId);
    console.log('🔍 [ThreadController] Auth header:', authorizationHeader ? 'Present' : 'Missing');

    let userId: string | undefined;

    // Try to get userId from auth token if present
    if (authorizationHeader) {
      try {
        console.log('🔍 [ThreadController] Attempting auth service validation...');
        const authResult = await this.validateAuthToken(authorizationHeader);
        console.log('🔍 [ThreadController] Auth service response:', JSON.stringify(authResult, null, 2));
        
        if (authResult && (authResult.valid || authResult.success)) {
          userId = authResult.user?.id;
          console.log('✅ [ThreadController] Auth service validated, userId:', userId);
        } else {
          console.log('⚠️  [ThreadController] Auth service validation failed, trying JWT decode backup...');
          
          // Fallback: Try to decode JWT directly
          const token = authorizationHeader.startsWith('Bearer ') 
            ? authorizationHeader.substring(7) 
            : authorizationHeader;
          
          try {
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            userId = payload.id || payload.sub || payload.userId;
            console.log('✅ [ThreadController] JWT decode backup successful, userId:', userId);
          } catch (jwtError) {
            console.log('❌ [ThreadController] JWT decode backup failed:', jwtError.message);
          }
        }
      } catch (error) {
        console.log('❌ [ThreadController] Auth validation error, trying JWT decode backup...');
        
        // Fallback: Try to decode JWT directly
        try {
          const token = authorizationHeader.startsWith('Bearer ') 
            ? authorizationHeader.substring(7) 
            : authorizationHeader;
          
          const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
          userId = payload.id || payload.sub || payload.userId;
          console.log('✅ [ThreadController] JWT decode backup successful after error, userId:', userId);
        } catch (jwtError) {
          console.log('❌ [ThreadController] JWT decode backup also failed:', jwtError.message);
        }
      }
    }

    console.log('🚀 [ThreadController] Final userId for quiz service:', userId);

    try {
      const result = await firstValueFrom(
        this.quizService.send({ cmd: 'list_quizzes' }, { threadId, userId }),
      );
      console.log('✅ [ThreadController] Quiz service response received');
      return result;
    } catch (error) {
      console.error('❌ [ThreadController] Error fetching quizzes by thread:', error);
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

      // Check if user has admin or moderator permissions for this thread
      console.log('[ThreadQuizController.createQuizInThread] Checking permissions for user:', userId, 'thread:', threadId);
      
      const permissionResult = await firstValueFrom(
        this.quizService.send(
          { cmd: 'check-admin-or-moderator' },
          { userId, threadId },
        ),
      );

      console.log('[ThreadQuizController.createQuizInThread] Permission check result:', permissionResult);

      if (!permissionResult?.success) {
        throw new HttpException(
          'Permission denied. Only workspace admins and thread moderators can create quizzes.',
          HttpStatus.FORBIDDEN,
        );
      }

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
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'questionImages', maxCount: 50 },
    { name: 'optionImages', maxCount: 200 },
  ]))
  async createQuizInThreadWithCreate(
    @Param('threadId') threadId: string,
    @Headers('authorization') authorizationHeader: string,
    @Body()
    body: {
      quizData: string; // JSON stringified quiz data
      workspaceId?: string;
    },
    @UploadedFiles() files: {
      questionImages?: Express.Multer.File[];
      optionImages?: Express.Multer.File[];
    },
  ) {
    console.log('[ThreadQuizController.createQuizInThreadWithCreate] Creating quiz in thread:', threadId);
    console.log('[ThreadQuizController.createQuizInThreadWithCreate] Files received:', {
      questionImages: files?.questionImages?.length || 0,
      optionImages: files?.optionImages?.length || 0,
    });

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

      // Parse the quiz data from the stringified JSON
      let quizData;
      try {
        quizData = JSON.parse(body.quizData);
      } catch (error) {
        throw new HttpException(
          'Invalid quiz data format',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Check if user has admin or moderator permissions for this thread
      console.log('[ThreadQuizController.createQuizInThreadWithCreate] Checking permissions for user:', userId, 'thread:', threadId);
      
      const permissionResult = await firstValueFrom(
        this.quizService.send(
          { cmd: 'check-admin-or-moderator' },
          { userId, threadId },
        ),
      );

      console.log('[ThreadQuizController.createQuizInThreadWithCreate] Permission check result:', permissionResult);

      if (!permissionResult?.success) {
        throw new HttpException(
          'Permission denied. Only workspace admins and thread moderators can create quizzes.',
          HttpStatus.FORBIDDEN,
        );
      }

      const workspaceId = body.workspaceId || permissionResult.workspaceId;

      // Get image mapping from quiz data
      const imageMapping = quizData.imageMapping || { questions: {}, options: {} };

      // Prepare image files data to send to quiz service
      const imageFilesData: any = {
        questionImages: {},
        optionImages: {},
      };

      // Process question images using the mapping
      if (files?.questionImages && files.questionImages.length > 0) {
        // Create reverse mapping: index -> questionId
        const indexToQuestionId: Record<number, string> = {};
        for (const [questionId, index] of Object.entries(imageMapping.questions)) {
          indexToQuestionId[index as number] = questionId;
        }
        
        files.questionImages.forEach((file, index) => {
          const questionId = indexToQuestionId[index];
          if (questionId) {
            imageFilesData.questionImages[questionId] = {
              buffer: file.buffer.toString('base64'), // Convert buffer to base64 for TCP transmission
              mimeType: file.mimetype,
              size: file.size,
              originalName: file.originalname,
            };
          }
        });
      }

      // Process option images using the mapping
      if (files?.optionImages && files.optionImages.length > 0) {
        // Create reverse mapping: index -> optionId
        const indexToOptionId: Record<number, string> = {};
        for (const [optionId, index] of Object.entries(imageMapping.options)) {
          indexToOptionId[index as number] = optionId;
        }
        
        files.optionImages.forEach((file, index) => {
          const optionId = indexToOptionId[index];
          if (optionId) {
            imageFilesData.optionImages[optionId] = {
              buffer: file.buffer.toString('base64'), // Convert buffer to base64 for TCP transmission
              mimeType: file.mimetype,
              size: file.size,
              originalName: file.originalname,
            };
          }
        });
      }

      const createQuizData = {
        createQuizDto: {
          title: quizData.title,
          description: quizData.description,
          timeAllocated: quizData.timeAllocated,
          questions: quizData.questions || [],
          selectedResources: quizData.selectedResources || [],
          workspaceId: workspaceId,
        },
        userId,
        threadId,
        workspaceId,
        imageFiles: imageFilesData,
      };

      console.log('[ThreadQuizController.createQuizInThreadWithCreate] Sending to quiz service with', 
        Object.keys(imageFilesData.questionImages).length, 'question images and',
        Object.keys(imageFilesData.optionImages).length, 'option images');

      const result = await firstValueFrom(
        this.quizService.send({ cmd: 'create_quiz' }, createQuizData),
      );

      return {
        success: true,
        quiz: result.quiz,
        message: 'Quiz created successfully in thread',
      };
    } catch (error) {
      console.error('[ThreadQuizController.createQuizInThreadWithCreate] Error creating quiz in thread:', error);
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

  // DELETE /api/threads/:threadId/quizzes/:quizId - Delete a quiz
  @Delete(':threadId/quizzes/:quizId')
  async deleteQuiz(
    @Param('threadId') threadId: string,
    @Param('quizId') quizId: string,
    @Headers('authorization') authorizationHeader: string,
    @Body() body: { workspaceId: string },
  ) {
    console.log('[ThreadQuizController.deleteQuiz] Deleting quiz:', quizId, 'from thread:', threadId);

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

      // Check if user has admin or moderator permissions for this thread
      console.log('[ThreadQuizController.deleteQuiz] Checking permissions for user:', userId, 'thread:', threadId);
      
      const permissionResult = await firstValueFrom(
        this.quizService.send(
          { cmd: 'check-admin-or-moderator' },
          { userId, threadId },
        ),
      );

      console.log('[ThreadQuizController.deleteQuiz] Permission check result:', permissionResult);

      if (!permissionResult?.success) {
        throw new HttpException(
          'Permission denied. Only workspace admins and thread moderators can delete quizzes.',
          HttpStatus.FORBIDDEN,
        );
      }

      const workspaceId = body.workspaceId || permissionResult.workspaceId;

      if (!workspaceId) {
        throw new HttpException(
          'Workspace ID is required for quiz deletion',
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await firstValueFrom(
        this.quizService.send(
          { cmd: 'delete_quiz' },
          { quizId, userId, threadId, workspaceId },
        ),
      );

      return {
        success: true,
        message: 'Quiz deleted successfully',
        ...result,
      };
    } catch (error) {
      console.error('[ThreadQuizController.deleteQuiz] Error deleting quiz:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error?.message || 'Failed to delete quiz',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
