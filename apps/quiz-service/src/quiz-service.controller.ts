/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { QuizService } from './quiz-service.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { AttemptQuizDto } from './dto/attempt-quiz.dto';
import { StartQuizDto } from './dto/start-quiz.dto';
import { AllExceptionsFilter } from './strategies/all-exceptions.filter';

@Controller()
@UseFilters(AllExceptionsFilter)
export class QuizServiceController {
  constructor(private quizService: QuizService) {}

  @MessagePattern({ cmd: 'create_quiz' })
  async createQuiz(
    @Payload()
    data: {
      createQuizDto: CreateQuizDto;
      userId: string;
      workspaceId: string;
      threadId: string;
    },
  ) {
    return this.quizService.createQuiz(
      data.createQuizDto,
      data.userId,
      data.workspaceId,
      data.threadId,
    );
  }

  @MessagePattern({ cmd: 'list_quizzes' })
  async listQuizzes(
    @Payload() data: { workspaceId?: string; threadId?: string },
  ) {
    return this.quizService.listQuizzes(data.workspaceId, data.threadId);
  }

  @MessagePattern({ cmd: 'get_quiz' })
  async getQuiz(@Payload() data: { quizId: string }) {
    return this.quizService.getQuiz(data.quizId);
  }

  @MessagePattern({ cmd: 'start_quiz' })
  async startQuiz(@Payload() data: { startQuizDto: StartQuizDto }) {
    return this.quizService.startQuiz(data.startQuizDto);
  }

  @MessagePattern({ cmd: 'get_active_attempt' })
  async getActiveAttempt(@Payload() data: { userId: string; quizId: string }) {
    return this.quizService.getActiveAttempt(data.userId, data.quizId);
  }

  @MessagePattern({ cmd: 'attempt_quiz' })
  async attemptQuiz(@Payload() data: { attemptQuizDto: AttemptQuizDto }) {
    return this.quizService.attemptQuiz(data.attemptQuizDto);
  }

  @MessagePattern({ cmd: 'view_results' })
  async viewResults(@Payload() data: { quizId: string; userId: string }) {
    return this.quizService.viewResults(data.quizId, data.userId);
  }

  // Backwards-compatible handler: API gateway sends 'get_quiz_attempts'
  // forward to the same service method that returns attempts/results
  @MessagePattern({ cmd: 'get_quiz_attempts' })
  async getQuizAttempts(@Payload() data: { quizId: string; userId: string }) {
    return this.quizService.viewResults(data.quizId, data.userId);
  }

  @MessagePattern({ cmd: 'validate_user' })
  async validateUser(@Payload() data: { userId: string }) {
    return this.quizService.validateUser(data.userId);
  }
}
