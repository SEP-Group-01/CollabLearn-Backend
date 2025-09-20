import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'forum-and-notification-service',
      timestamp: new Date().toISOString(),
      message: 'Forum service is running successfully!',
    };
  }
}
