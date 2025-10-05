import { Controller, Get } from '@nestjs/common';
import { ForumAndNotificationServiceService } from './forum-and-notification-service.service';

@Controller()
export class ForumAndNotificationServiceController {
  constructor(
    private readonly forumAndNotificationServiceService: ForumAndNotificationServiceService,
  ) {}
  @Get()
  getHello(): string {
    return this.forumAndNotificationServiceService.getHello();
  }
}
