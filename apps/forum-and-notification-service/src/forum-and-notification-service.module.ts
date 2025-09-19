import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ForumService } from './services/forum.service';
import { SupabaseService } from './services/supabase.service';
import { HealthController } from './health.controller';
import { ForumGateway } from './gateways/forum.gateway';
import { ForumTcpController } from './controllers/forum-tcp.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [
    HealthController,
    ForumTcpController, // Add TCP controller
  ],
  providers: [ForumService, SupabaseService, ForumGateway],
})
export class ForumAndNotificationServiceModule {}
