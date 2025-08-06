import { Module } from '@nestjs/common';
import { QuizServiceController } from './quiz-service.controller';
import { QuizServiceService } from './quiz-service.service';

@Module({
  imports: [],
  controllers: [QuizServiceController],
  providers: [QuizServiceService],
})
export class QuizServiceModule {}
