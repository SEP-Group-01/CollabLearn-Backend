import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { WorkspacesController } from './workspaces-service.controller';
import { WorkspacesService } from './workspaces.service';
import { SupabaseService } from './supabase.service';
import * as path from 'path';

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
  providers: [WorkspacesService, SupabaseService],
})
export class WorkspacesServiceModule {}
