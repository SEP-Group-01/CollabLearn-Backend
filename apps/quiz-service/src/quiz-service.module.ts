import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QuizServiceController } from './controllers/quiz-service.controller';
import { QuizService } from './services/quiz-service.service';
import { SupabaseService } from './services/supabase.service';
import { FirebaseService } from './services/firebase.service';
import { AllExceptionsFilter } from './strategies/all-exceptions.filter';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [QuizServiceController],
  providers: [QuizService, SupabaseService, FirebaseService, AllExceptionsFilter],
})
export class QuizServiceModule {}
