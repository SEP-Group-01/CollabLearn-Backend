import { Module } from '@nestjs/common';
import { ForumAndNotificationServiceController } from './forum-and-notification-service.controller';
import { ForumAndNotificationServiceService } from './forum-and-notification-service.service';

@Module({
  imports: [],
  controllers: [ForumAndNotificationServiceController],
  providers: [ForumAndNotificationServiceService],
})
export class ForumAndNotificationServiceModule {}
