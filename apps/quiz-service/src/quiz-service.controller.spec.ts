import { Test, TestingModule } from '@nestjs/testing';
import { QuizServiceController } from './quiz-service.controller';
import { QuizServiceService } from './quiz-service.service';

describe('QuizServiceController', () => {
  let quizServiceController: QuizServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [QuizServiceController],
      providers: [QuizServiceService],
    }).compile();

    quizServiceController = app.get<QuizServiceController>(QuizServiceController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(quizServiceController.getHello()).toBe('Hello World!');
    });
  });
});
