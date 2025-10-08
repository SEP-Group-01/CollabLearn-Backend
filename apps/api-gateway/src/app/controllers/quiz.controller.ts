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
      return await firstValueFrom(
        this.authService.send({ cmd: 'validate_token' }, { token }),
      );
    } catch (error) {
      throw new HttpException(
        'Invalid or expired token',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  // Health check endpoint
  @Get('health')
  health(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
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

  // Create a new quiz scoped to a thread (frontend expects this path)
  @Post('/threads/:threadId/quizzes/create')
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

      const { userId } = authResult.user;

      const permissionResult = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'check_user_permission' },
          { userId, threadId },
        ),
      );

      if (!permissionResult?.success) {
        throw new HttpException('Permission denied', HttpStatus.FORBIDDEN);
      }

      const { workspaceId } = permissionResult;

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
  @Get()
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

  // Thread scoped quizzes (frontend calls /threads/:threadId/quizzes)
  @Get('/threads/:threadId/quizzes')
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

  // Submit quiz attempt (plural path expected by frontend)
  @Post(':id/attempt')
  @Post(':id/attempts')
  async submitQuizAttempt(
    @Param('id') quizId: string,
    @Body()
    body: {
      userId: string;
      answers: any[];
      timeTaken: number;
    },
  ) {
    console.log('Submitting quiz attempt:', { quizId, ...body });

    try {
      // The quiz service listens for 'attempt_quiz' message
      return await firstValueFrom(
        this.quizService.send(
          { cmd: 'attempt_quiz' },
          {
            attemptQuizDto: {
              attemptId: body['attemptId'],
              quizId,
              userId: body.userId,
              answers: body.answers,
              timeTaken: body.timeTaken,
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

  // Get quiz attempts for a user
  @Get(':id/attempts')
  async getQuizAttempts(
    @Param('id') quizId: string,
    @Query('userId') userId: string,
  ) {
    console.log('Fetching quiz attempts:', { quizId, userId });

    try {
      return await firstValueFrom(
        this.quizService.send({ cmd: 'get_quiz_attempts' }, { quizId, userId }),
      );
    } catch (error) {
      console.error('Error fetching quiz attempts:', error);
      throw new HttpException(
        error?.message || 'Failed to fetch quiz attempts',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
