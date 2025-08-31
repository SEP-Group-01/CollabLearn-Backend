import { Module } from '@nestjs/common';
import { WorkspacesServiceController } from './workspaces-service.controller';
import { WorkspacesServiceService } from './workspaces-service.service';

@Module({
  imports: [],
  controllers: [WorkspacesServiceController],
  providers: [WorkspacesServiceService],
})
export class WorkspacesServiceModule {}
