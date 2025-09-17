import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ForumAndNotificationServiceController } from './forum-and-notification-service.controller';
import { ForumAndNotificationServiceService } from './forum-and-notification-service.service';
import { ForumService } from './services/forum.service';
import { SupabaseService } from './services/supabase.service';
import { HealthController } from './health.controller';
import { ForumGateway } from './gateways/forum.gateway';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [ForumAndNotificationServiceController, HealthController],
  providers: [
    ForumAndNotificationServiceService,
    ForumService,
    SupabaseService,
    ForumGateway,
  ],
})
export class ForumAndNotificationServiceModule {}
