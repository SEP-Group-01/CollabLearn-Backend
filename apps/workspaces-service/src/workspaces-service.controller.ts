import { Controller, UseFilters, Get } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
@UseFilters(AllExceptionsFilter)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @MessagePattern({ cmd: 'get-workspace-by-id' })
  getWorkspaceById(data: { id: string }) {
    return this.workspacesService.getWorkspaceById(data.id);
  }

  @MessagePattern({ cmd: 'get-workspaces-by-user-id' })
  getWorkspacesByUserId(data: { userId: string }) {
    return this.workspacesService.getWorkspacesByUserId(data.userId);
  }

  @MessagePattern({ cmd: 'get-workspaces-by-search-term' })
  getWorkspacesBySearchTerm(data: { searchTerm: string }) {
    return this.workspacesService.getWorkspacesBySearchTerm(data.searchTerm);
  }

  @MessagePattern({ cmd: 'create-workspace' })
  createWorkspace(data) {
    return this.workspacesService.createWorkspace(data);
  }

  @MessagePattern({ cmd: 'update-workspace' })
  updateWorkspace(data) {
    return this.workspacesService.updateWorkspace(data);
  }

  @MessagePattern({ cmd: 'get-hello' })
  getHello() {
    return this.workspacesService.getHello();
  }

  @MessagePattern({ cmd: 'join-workspace' })
  joinWorkspace(data: { userId: string; workspaceId: string }) {
    return this.workspacesService.joinWorkspace(data.userId, data.workspaceId);
  }

  @MessagePattern({ cmd: 'request-workspace' })
  requestWorkspace(data: { userId: string; workspaceId: string }) {
    return this.workspacesService.requestWorkspace(
      data.userId,
      data.workspaceId,
    );
  }

  @MessagePattern({ cmd: 'get-workspace-forum-messages' })
  getWorkspaceForumMessages(data: { workspaceId: string }) {
    return this.workspacesService.getWorkspaceForumMessages(data.workspaceId);
  }

  @MessagePattern({ cmd: 'create-workspace-forum-message' })
  createWorkspaceForumMessage(data: {
    workspaceId: string;
    authorId: string;
    content: string;
    parentMessageId?: string;
  }) {
    return this.workspacesService.createWorkspaceForumMessage(data);
  }

  @MessagePattern({ cmd: 'toggle-workspace-forum-message-like' })
  toggleWorkspaceForumMessageLike(data: {
    workspaceId: string;
    messageId: string;
    userId: string;
  }) {
    return this.workspacesService.toggleWorkspaceForumMessageLike(data);
  }

  @MessagePattern({ cmd: 'pin-workspace-forum-message' })
  pinWorkspaceForumMessage(data: {
    workspaceId: string;
    messageId: string;
    userId: string;
  }) {
    return this.workspacesService.pinWorkspaceForumMessage(data);
  }
}
