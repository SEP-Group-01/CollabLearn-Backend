import { Test, TestingModule } from '@nestjs/testing';
import { ForumAndNotificationServiceController } from './forum-and-notification-service.controller';
import { ForumAndNotificationServiceService } from './forum-and-notification-service.service';

describe('ForumAndNotificationServiceController', () => {
  let forumAndNotificationServiceController: ForumAndNotificationServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ForumAndNotificationServiceController],
      providers: [ForumAndNotificationServiceService],
    }).compile();

    forumAndNotificationServiceController =
      app.get<ForumAndNotificationServiceController>(
        ForumAndNotificationServiceController,
      );
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(forumAndNotificationServiceController.getHello()).toBe(
        'Hello World!',
      );
    });
  });
});
