import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WorkspacesController } from './workspaces-service.controller';
import { WorkspacesService } from './workspaces.service';
import { SupabaseService } from './supabase.service';

@Module({
  imports: [
        ConfigModule.forRoot({ // Load environment variables
          isGlobal: true,      // Make env accessible globally without importing again
        }),
  ],
  controllers: [WorkspacesController],
  providers: [
    WorkspacesService,
    SupabaseService,
  ],
})
export class WorkspacesServiceModule {}
