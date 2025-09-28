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
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller('quiz')
export class QuizController {
  constructor(
    @Inject('QUIZ_SERVICE') private readonly quizService: ClientProxy,
  ) {}

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
    @Body()
    body: {
      title: string;
      description: string;
      timeAllocated: number;
      topics?: string;
      selectedResources?: string[];
      questions: any[];
      tags?: string[];
      resourceTags?: string[];
      userId?: string;
      workspaceId?: string;
    },
  ) {
    console.log('Creating quiz:', body);

    try {
      // Transform the request to match what the quiz service expects
      const createQuizData = {
        createQuizDto: {
          title: body.title,
          description: body.description,
          timeAllocated: body.timeAllocated,
          questions: body.questions,
          tags: body.tags || [],
          resourceTags: body.resourceTags || [],
        },
        userId: body.userId || '19644cb1-58ef-48c2-b01f-0545bf77cc12', // TODO: Get from auth
        workspaceId: body.workspaceId || '19644cb1-58ef-48c2-b01f-0545bf77cc13', // TODO: Get from auth
      };

      const result = await firstValueFrom(
        this.quizService.send({ cmd: 'create_quiz' }, createQuizData),
      );
      return {
        success: true,
        quizId: result.id,
        message: 'Quiz created successfully',
        ...result,
      };
    } catch (error) {
      console.error('Error creating quiz:', error);
      throw new HttpException(
        error?.message || 'Failed to create quiz',
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
      throw new HttpException(
        error?.message || 'Quiz not found',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  // Submit quiz attempt
  @Post(':id/attempt')
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
      return await firstValueFrom(
        this.quizService.send(
          { cmd: 'submit_quiz_attempt' },
          { quizId, ...body },
        ),
      );
    } catch (error) {
      console.error('Error submitting quiz attempt:', error);
      throw new HttpException(
        error?.message || 'Failed to submit quiz attempt',
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
