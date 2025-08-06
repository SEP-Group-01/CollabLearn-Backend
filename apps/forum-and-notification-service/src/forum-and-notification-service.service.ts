import { Injectable } from '@nestjs/common';

@Injectable()
export class ForumAndNotificationServiceService {
  getHello(): string {
    return 'Hello World!';
  }
}
