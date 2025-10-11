import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { WorkspacesController } from './controllers/workspaces-service.controller';
import { WorkspacesService } from './services/workspaces.service';
import { WorkspaceUserService } from './services/workspace-user.service';
import { WorkspaceForumService } from './services/workspace-forum.service';
import { WorkspaceThreadsService } from './services/workspace-threads.service';
import { SupabaseService } from './services/supabase.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      // Load environment variables from project root
      envFilePath: path.join(__dirname, '../../../.env'),
      isGlobal: true, // Make env accessible globally without importing again
    }),
    ClientsModule.register([
      {
        name: 'FORUM_SERVICE',
        transport: Transport.TCP,
        options: {
          host: 'localhost',
          port: 3004, // Forum service port
        },
      },
    ]),
  ],
  controllers: [WorkspacesController],
  providers: [
    WorkspacesService,
    WorkspaceUserService,
    WorkspaceForumService,
    WorkspaceThreadsService,
    SupabaseService,
  ],
})
export class WorkspacesServiceModule {}
