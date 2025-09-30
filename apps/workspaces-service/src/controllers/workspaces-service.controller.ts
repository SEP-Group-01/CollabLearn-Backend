import {
  Controller,
  UseFilters,
  Get,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { WorkspacesService } from '../services/workspaces.service';
import { AllExceptionsFilter } from '../utils/all-exceptions.filter';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  JoinWorkspaceDto,
  RequestWorkspaceDto,
} from '../DTOs/workspaces.dto';

@Controller()
@UseFilters(AllExceptionsFilter)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @MessagePattern({ cmd: 'get-workspace-by-id' })
  getWorkspaceById(@Payload() data: { id: string; userId?: string }) {
    console.log(
      '🎯 [WorkspaceController] Received get-workspace-by-id message with data:',
      data,
    );
    return this.workspacesService.getWorkspaceById(data.id, data.userId);
  }

  @MessagePattern({ cmd: 'get-workspaces-by-user-id' })
  getWorkspacesByUserId(@Payload() data: { userId: string }) {
    console.log(
      '🎯 [WorkspaceController] Received get-workspaces-by-user-id message with data:',
      data,
    );
    return this.workspacesService.getWorkspacesByUserId(data.userId);
  }

  @MessagePattern({ cmd: 'get-workspaces-by-search-term' })
  getWorkspacesBySearchTerm(@Payload() data: { searchTerm: string }) {
    console.log(
      '🎯 [WorkspaceController] Received get-workspaces-by-search-term message with data:',
      data,
    );
    return this.workspacesService.getWorkspacesBySearchTerm(data.searchTerm);
  }

  @MessagePattern({ cmd: 'create-workspace' })
  createWorkspace(@Payload() data: CreateWorkspaceDto) {
    console.log(
      '🎯 [WorkspaceController] Received create-workspace message with data:',
      JSON.stringify(data, null, 2),
    );
    console.log('🔍 [WorkspaceController] Data validation details:');
    console.log('  - title:', typeof data.title, data.title);
    console.log('  - user_id:', typeof data.user_id, data.user_id);
    console.log('  - join_policy:', typeof data.join_policy, data.join_policy);
    console.log('  - tags:', typeof data.tags, data.tags);

    try {
      const result = this.workspacesService.createWorkspace(data);
      console.log('📤 [WorkspaceController] Sending create-workspace response');
      return result;
    } catch (error) {
      console.error(
        '❌ [WorkspaceController] Error in create-workspace:',
        error,
      );
      throw error;
    }
  }

  @MessagePattern({ cmd: 'update-workspace' })
  updateWorkspace(@Payload() data: UpdateWorkspaceDto) {
    console.log(
      '🎯 [WorkspaceController] Received update-workspace message with data:',
      JSON.stringify(data, null, 2),
    );
    const result = this.workspacesService.updateWorkspace(data);
    console.log('📤 [WorkspaceController] Sending update-workspace response');
    return result;
  }

  @MessagePattern({ cmd: 'get-hello' })
  getHello() {
    console.log('🎯 [WorkspaceController] Received get-hello message');
    return this.workspacesService.getHello();
  }

  @MessagePattern({ cmd: 'join-workspace' })
  joinWorkspace(@Payload() data: JoinWorkspaceDto) {
    console.log(
      '🎯 [WorkspaceController] Received join-workspace message with data:',
      data,
    );
    return this.workspacesService.joinWorkspace(data.userId, data.workspaceId);
  }

  @MessagePattern({ cmd: 'request-workspace' })
  requestWorkspace(@Payload() data: RequestWorkspaceDto) {
    console.log(
      '🎯 [WorkspaceController] Received request-workspace message with data:',
      data,
    );
    return this.workspacesService.requestWorkspace(
      data.userId,
      data.workspaceId,
    );
  }

  @MessagePattern({ cmd: 'get-threads-by-workspace-id' })
  getThreadsByWorkspaceId(@Payload() data: { workspaceId: string }) {
    console.log(
      '🎯 [WorkspaceController] Received get-threads-by-workspace-id message with data:',
      data,
    );
    return this.workspacesService.getThreadsByWorkspaceId(data.workspaceId);
  }
}
