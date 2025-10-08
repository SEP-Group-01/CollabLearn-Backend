import {
  Controller,
  UseFilters,
  Get,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { WorkspacesService } from '../services/workspaces.service';
import { WorkspaceUserService } from '../services/workspace-user.service';
import { WorkspaceForumService } from '../services/workspace-forum.service';
import { WorkspaceThreadsService } from '../services/workspace-threads.service';
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
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly workspaceUserService: WorkspaceUserService,
    private readonly workspaceForumService: WorkspaceForumService,
    private readonly workspaceThreadsService: WorkspaceThreadsService,
  ) {}

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
  getWorkspacesBySearchTerm(
    @Payload() data: { searchTerm: string; userId?: string },
  ) {
    console.log(
      '🎯 [WorkspaceController] Received get-workspaces-by-search-term message with data:',
      data,
    );
    return this.workspacesService.getWorkspacesBySearchTerm(
      data.searchTerm,
      data.userId,
    );
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
    return this.workspaceUserService.joinWorkspace(
      data.userId,
      data.workspaceId,
    );
  }

  @MessagePattern({ cmd: 'leave-workspace' })
  leaveWorkspace(@Payload() data: { userId: string; workspaceId: string }) {
    console.log(
      '🎯 [WorkspaceController] Received leave-workspace message with data:',
      data,
    );
    return this.workspaceUserService.leaveWorkspace(
      data.userId,
      data.workspaceId,
    );
  }

  @MessagePattern({ cmd: 'request-workspace' })
  requestWorkspace(@Payload() data: RequestWorkspaceDto) {
    console.log(
      '🎯 [WorkspaceController] Received request-workspace message with data:',
      data,
    );
    return this.workspaceUserService.requestWorkspace(
      data.userId,
      data.workspaceId,
    );
  }

  @MessagePattern({ cmd: 'cancel-join-request' })
  cancelJoinRequest(@Payload() data: { userId: string; workspaceId: string }) {
    console.log(
      '🎯 [WorkspaceController] Received cancel-join-request message with data:',
      data,
    );
    return this.workspaceUserService.cancelJoinRequest(
      data.userId,
      data.workspaceId,
    );
  }

  @MessagePattern({ cmd: 'validate-email' })
  validateEmail(
    @Payload() data: { userId: string; workspaceId: string; email: string },
  ) {
    console.log(
      '🎯 [WorkspaceController] Received validate-email message with data:',
      data,
    );
    return this.workspacesService.validateEmail(
      data.userId,
      data.workspaceId,
      data.email,
    );
  }

  @MessagePattern({ cmd: 'bulk-invite' })
  sendBulkInvites(
    @Payload() data: { userId: string; workspaceId: string; emails: string[] },
  ) {
    console.log(
      '🎯 [WorkspaceController] Received bulk-invite message with data:',
      data,
    );
    return this.workspacesService.sendBulkInvites(
      data.userId,
      data.workspaceId,
      data.emails,
    );
  }

  @MessagePattern({ cmd: 'accept-invite' })
  acceptInvite(@Payload() data: { userId: string; workspaceId: string }) {
    console.log(
      '🎯 [WorkspaceController] Received accept-invite message with data:',
      data,
    );
    return this.workspaceUserService.acceptInvite(
      data.userId,
      data.workspaceId,
    );
  }

  @MessagePattern({ cmd: 'decline-invite' })
  declineInvite(@Payload() data: { userId: string; workspaceId: string }) {
    console.log(
      '🎯 [WorkspaceController] Received decline-invite message with data:',
      data,
    );
    return this.workspaceUserService.declineInvite(
      data.userId,
      data.workspaceId,
    );
  }

  @MessagePattern({ cmd: 'get-workspace-invites' })
  getWorkspaceInvites(
    @Payload() data: { userId: string; workspaceId: string },
  ) {
    console.log(
      '🎯 [WorkspaceController] Received get-workspace-invites message with data:',
      data,
    );
    return this.workspacesService.getWorkspaceInvites(
      data.userId,
      data.workspaceId,
    );
  }

  @MessagePattern({ cmd: 'delete-invite' })
  deleteInvite(@Payload() data: { userId: string; inviteId: string }) {
    console.log(
      '🎯 [WorkspaceController] Received delete-invite message with data:',
      data,
    );
    return this.workspacesService.deleteInvite(data.userId, data.inviteId);
  }

  @MessagePattern({ cmd: 'get-workspace-members' })
  getWorkspaceMembers(
    @Payload() data: { workspaceId: string; userId?: string },
  ) {
    console.log(
      '🎯 [WorkspaceController] Received get-workspace-members message with data:',
      data,
    );
    return this.workspacesService.getWorkspaceMembers(
      data.workspaceId,
      data.userId,
    );
  }

  @MessagePattern({ cmd: 'get-threads-by-workspace-id' })
  getThreadsByWorkspaceId(@Payload() data: { workspaceId: string }) {
    console.log(
      '🎯 [WorkspaceController] Received get-threads-by-workspace-id message with data:',
      data,
    );
    return this.workspaceThreadsService.getThreadsByWorkspaceId(
      data.workspaceId,
    );
  }

  @MessagePattern({ cmd: 'create-thread' })
  createThread(
    @Payload()
    data: {
      workspaceId: string;
      threadData: { name: string; description: string };
      createdBy: string;
    },
  ) {
    console.log(
      '🎯 [WorkspaceController] Received create-thread message with data:',
      data,
    );
    return this.workspaceThreadsService.createThread(
      data.workspaceId,
      data.threadData,
      data.createdBy,
    );
  }

  // Forum Messages related handlers
  @MessagePattern({ cmd: 'get-workspace-forum-messages' })
  getWorkspaceForumMessages(@Payload() data: { workspaceId: string }) {
    console.log(
      '🎯 [WorkspaceController] Received get-workspace-forum-messages message with data:',
      data,
    );
    return this.workspaceForumService.getWorkspaceForumMessages(
      data.workspaceId,
    );
  }

  @MessagePattern({ cmd: 'create-workspace-forum-message' })
  createWorkspaceForumMessage(
    @Payload()
    data: {
      workspaceId: string;
      authorId: string;
      content: string;
      parentMessageId?: string;
    },
  ) {
    console.log(
      '🎯 [WorkspaceController] Received create-workspace-forum-message message with data:',
      data,
    );
    return this.workspaceForumService.createWorkspaceForumMessage(data);
  }

  @MessagePattern({ cmd: 'toggle-workspace-forum-message-like' })
  toggleWorkspaceForumMessageLike(
    @Payload() data: { workspaceId: string; messageId: string; userId: string },
  ) {
    console.log(
      '🎯 [WorkspaceController] Received toggle-workspace-forum-message-like message with data:',
      data,
    );
    return this.workspaceForumService.toggleWorkspaceForumMessageLike(data);
  }

  @MessagePattern({ cmd: 'pin-workspace-forum-message' })
  pinWorkspaceForumMessage(
    @Payload() data: { workspaceId: string; messageId: string; userId: string },
  ) {
    console.log(
      '🎯 [WorkspaceController] Received pin-workspace-forum-message message with data:',
      data,
    );
    return this.workspaceForumService.pinWorkspaceForumMessage(data);
  }

  // Thread-specific operations
  @MessagePattern({ cmd: 'get-thread' })
  getThread(@Payload() data: { threadId: string; userId: string }) {
    console.log(
      '🎯 [WorkspaceController] Received get-thread message with data:',
      data,
    );
    return this.workspaceThreadsService.getThread(data.threadId, data.userId);
  }

  @MessagePattern({ cmd: 'check-admin-or-moderator' })
  checkAdminOrModerator(@Payload() data: { threadId: string; userId: string }) {
    console.log(
      '🎯 [WorkspaceController] Received check-admin-or-moderator message with data:',
      data,
    );
    return this.workspaceThreadsService.checkAdminOrModerator(
      data.threadId,
      data.userId,
    );
  }

  @MessagePattern({ cmd: 'update-thread' })
  updateThread(
    @Payload()
    data: {
      threadId: string;
      threadData: { name?: string; description?: string };
      userId: string;
    },
  ) {
    console.log(
      '🎯 [WorkspaceController] Received update-thread message with data:',
      data,
    );
    return this.workspaceThreadsService.updateThread(
      data.threadId,
      data.threadData,
      data.userId,
    );
  }

  @MessagePattern({ cmd: 'delete-thread' })
  deleteThread(@Payload() data: { threadId: string; userId: string }) {
    console.log(
      '🎯 [WorkspaceController] Received delete-thread message with data:',
      data,
    );
    return this.workspaceThreadsService.deleteThread(
      data.threadId,
      data.userId,
    );
  }

  @MessagePattern({ cmd: 'subscribe-to-thread' })
  subscribeToThread(@Payload() data: { threadId: string; userId: string }) {
    console.log(
      '🎯 [WorkspaceController] Received subscribe-to-thread message with data:',
      data,
    );
    return this.workspaceThreadsService.subscribeToThread(
      data.threadId,
      data.userId,
    );
  }

  @MessagePattern({ cmd: 'unsubscribe-from-thread' })
  unsubscribeFromThread(@Payload() data: { threadId: string; userId: string }) {
    console.log(
      '🎯 [WorkspaceController] Received unsubscribe-from-thread message with data:',
      data,
    );
    return this.workspaceThreadsService.unsubscribeFromThread(
      data.threadId,
      data.userId,
    );
  }

  @MessagePattern({ cmd: 'get-thread-subscribers' })
  getThreadSubscribers(@Payload() data: { threadId: string; userId: string }) {
    console.log(
      '🎯 [WorkspaceController] Received get-thread-subscribers message with data:',
      data,
    );
    return this.workspaceThreadsService.getThreadSubscribers(
      data.threadId,
      data.userId,
    );
  }

  @MessagePattern({ cmd: 'assign-thread-moderators' })
  assignThreadModerators(
    @Payload() data: { threadId: string; userIds: string[]; userId: string },
  ) {
    console.log(
      '🎯 [WorkspaceController] Received assign-thread-moderators message with data:',
      data,
    );
    return this.workspaceThreadsService.assignModerators(
      data.threadId,
      data.userIds,
      data.userId,
    );
  }

  @MessagePattern({ cmd: 'remove-thread-moderators' })
  removeThreadModerators(
    @Payload() data: { threadId: string; userIds: string[]; userId: string },
  ) {
    console.log(
      '🎯 [WorkspaceController] Received remove-thread-moderators message with data:',
      data,
    );
    return this.workspaceThreadsService.removeModerators(
      data.threadId,
      data.userIds,
      data.userId,
    );
  }

  @MessagePattern({ cmd: 'get-thread-stats' })
  getThreadStats(@Payload() data: { threadId: string; userId: string }) {
    console.log(
      '🎯 [WorkspaceController] Received get-thread-stats message with data:',
      data,
    );
    return this.workspaceThreadsService.getThreadStats(
      data.threadId,
      data.userId,
    );
  }

  @MessagePattern({ cmd: 'get-thread-resources' })
  getThreadResources(@Payload() data: { threadId: string; userId: string }) {
    console.log(
      '🎯 [WorkspaceController] Received get-thread-resources message with data:',
      data,
    );
    return this.workspaceThreadsService.getThreadResources(
      data.threadId,
      data.userId,
    );
  }

  @MessagePattern({ cmd: 'get-thread-quizzes' })
  getThreadQuizzes(@Payload() data: { threadId: string; userId: string }) {
    console.log(
      '🎯 [WorkspaceController] Received get-thread-quizzes message with data:',
      data,
    );
    return this.workspaceThreadsService.getThreadQuizzes(
      data.threadId,
      data.userId,
    );
  }

  @MessagePattern({ cmd: 'get-quiz-attempts' })
  getQuizAttempts(@Payload() data: { quizId: string; userId: string }) {
    console.log(
      '🎯 [WorkspaceController] Received get-quiz-attempts message with data:',
      data,
    );
    return this.workspaceThreadsService.getQuizAttempts(
      data.quizId,
      data.userId,
    );
  }

  @MessagePattern({ cmd: 'get-workspace-join-requests' })
  getWorkspaceJoinRequests(
    @Payload() data: { workspaceId: string; userId: string },
  ) {
    console.log(
      '🎯 [WorkspaceController] Received get-workspace-join-requests message with data:',
      data,
    );
    return this.workspacesService.getWorkspaceJoinRequests(
      data.workspaceId,
      data.userId,
    );
  }

  @MessagePattern({ cmd: 'approve-join-request' })
  approveJoinRequest(
    @Payload() data: { workspaceId: string; requestId: string; userId: string },
  ) {
    console.log(
      '🎯 [WorkspaceController] Received approve-join-request message with data:',
      data,
    );
    return this.workspacesService.approveJoinRequest(
      data.workspaceId,
      data.requestId,
      data.userId,
    );
  }

  @MessagePattern({ cmd: 'reject-join-request' })
  rejectJoinRequest(
    @Payload() data: { workspaceId: string; requestId: string; userId: string },
  ) {
    console.log(
      '🎯 [WorkspaceController] Received reject-join-request message with data:',
      data,
    );
    return this.workspacesService.rejectJoinRequest(
      data.workspaceId,
      data.requestId,
      data.userId,
    );
  }
}
