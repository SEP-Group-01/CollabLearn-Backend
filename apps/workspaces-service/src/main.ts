import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { WorkspacesServiceModule } from './workspaces-service.module';
import { Logger } from '@nestjs/common';

const logger = new Logger('WorkspacesService');

async function bootstrap() {
  console.log('🚀 [WorkspaceService] Starting workspace service...');
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    WorkspacesServiceModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: 3003,
      },
    },
  );

  await app.listen();
  logger.log(
    '✅ Workspaces Service is running and ready to accept connections',
  );
  logger.log('🔌 Workspaces Service is listening on port 3003');
  console.log('📋 [WorkspaceService] Available message patterns:');
  console.log('   - get-hello');
  console.log('   - create-workspace');
  console.log('   - get-workspace-by-id');
  console.log('   - get-workspaces-by-user-id');
  console.log('   - get-workspaces-by-search-term');
  console.log('   - update-workspace');
  console.log('   - join-workspace');
  console.log('   - leave-workspace');
  console.log('   - request-workspace');
  console.log('   - cancel-join-request');
  console.log('   - validate-email');
  console.log('   - bulk-invite');
  console.log('   - accept-invite');
  console.log('   - decline-invite');
  console.log('   - get-workspace-invites');
  console.log('   - delete-invite');
  console.log('   - get-threads-by-workspace-id');
  console.log('   - get-workspace-forum-messages');
  console.log('   - create-workspace-forum-message');
  console.log('   - toggle-workspace-forum-message-like');
  console.log('   - pin-workspace-forum-message');
}
bootstrap();
