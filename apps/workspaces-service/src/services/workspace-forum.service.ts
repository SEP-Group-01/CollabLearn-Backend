import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class WorkspaceForumService {
  constructor(
    @Inject('FORUM_SERVICE')
    private readonly forumService: ClientProxy,
  ) {}

  // Forum-related methods that proxy to the forum service
  async getWorkspaceForumMessages(workspaceId: string) {
    try {
      // Use workspace ID as group ID for forum service
      const result = await firstValueFrom(
        this.forumService.send(
          { cmd: 'get_group_messages' },
          { groupId: workspaceId, userId: 'system' },
        ),
      );
      return result;
    } catch (error) {
      console.error('Error fetching workspace forum messages:', error);
      throw new RpcException({
        status: 500,
        message: 'Error fetching workspace forum messages',
      });
    }
  }

  async createWorkspaceForumMessage(data: {
    workspaceId: string;
    authorId: string;
    content: string;
    parentMessageId?: string;
  }) {
    try {
      // Use workspace ID as group ID for forum service
      const result = await firstValueFrom(
        this.forumService.send(
          { cmd: 'create_message' },
          {
            groupId: data.workspaceId,
            authorId: data.authorId,
            content: data.content,
            parentMessageId: data.parentMessageId,
          },
        ),
      );
      return result;
    } catch (error) {
      console.error('Error creating workspace forum message:', error);
      throw new RpcException({
        status: 500,
        message: 'Error creating workspace forum message',
      });
    }
  }

  async toggleWorkspaceForumMessageLike(data: {
    workspaceId: string;
    messageId: string;
    userId: string;
  }) {
    try {
      const result = await firstValueFrom(
        this.forumService.send(
          { cmd: 'toggle_message_like' },
          {
            messageId: data.messageId,
            userId: data.userId,
          },
        ),
      );
      return result;
    } catch (error) {
      console.error('Error toggling workspace forum message like:', error);
      throw new RpcException({
        status: 500,
        message: 'Error toggling workspace forum message like',
      });
    }
  }

  async pinWorkspaceForumMessage(data: {
    workspaceId: string;
    messageId: string;
    userId: string;
  }) {
    try {
      const result = await firstValueFrom(
        this.forumService.send(
          { cmd: 'pin_message' },
          {
            messageId: data.messageId,
            userId: data.userId,
          },
        ),
      );
      return result;
    } catch (error) {
      console.error('Error pinning workspace forum message:', error);
      throw new RpcException({
        status: 500,
        message: 'Error pinning workspace forum message',
      });
    }
  }
}
