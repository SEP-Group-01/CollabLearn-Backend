import { Controller, Get } from '@nestjs/common';
import { QuizServiceService } from './quiz-service.service';

@Controller()
export class QuizServiceController {
  constructor(private readonly quizServiceService: QuizServiceService) {}

  @Get()
  getHello(): string {
    return this.quizServiceService.getHello();
  }
}
