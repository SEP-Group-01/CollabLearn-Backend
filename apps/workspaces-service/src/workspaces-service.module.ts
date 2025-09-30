import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WorkspacesController } from './controllers/workspaces-service.controller';
import { WorkspacesService } from './services/workspaces.service';
import { SupabaseService } from './services/supabase.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      // Load environment variables
      isGlobal: true, // Make env accessible globally without importing again
    }),
  ],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, SupabaseService],
})
export class WorkspacesServiceModule {}
