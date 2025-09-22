import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QuizServiceController } from './quiz-service.controller';
import { QuizService } from './quiz-service.service';
import { SupabaseService } from './supabase.service';
import { AllExceptionsFilter } from './strategies/all-exceptions.filter';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [QuizServiceController],
  providers: [QuizService, SupabaseService, AllExceptionsFilter],
})
export class QuizServiceModule {}
