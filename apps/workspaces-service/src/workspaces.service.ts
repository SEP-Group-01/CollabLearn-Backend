import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { SupabaseService } from './supabase.service';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from './workspaces.dto';
import { firstValueFrom } from 'rxjs';
import { title } from 'process';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject('FORUM_SERVICE') private readonly forumService: ClientProxy,
  ) {}

  async getWorkspaceById(id: string) {
    const supabase = this.supabaseService.getClient();
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching workspace:', error);
      throw new RpcException({
        status: 500,
        message: 'Error fetching workspace',
      });
    }
  }

  async getWorkspacesByUserId(userId: string) {
    const supabase = this.supabaseService.getClient();
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching workspaces by user ID:', error);
      throw new RpcException({
        status: 500,
        message: 'Error fetching workspaces by user ID',
      });
    }
  }

  async getWorkspacesBySearchTerm(searchTerm: string) {
    // I need to replace this with a Stored procedure later
    const supabase = this.supabaseService.getClient();
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .ilike('name', `%${searchTerm}%`);

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching workspaces by search term:', error);
      throw new RpcException({
        status: 500,
        message: 'Error fetching workspaces by search term',
      });
    }
  }

  async createWorkspace(workspaceData: CreateWorkspaceDto) {
    // Implement your logic to create a new workspace
    const supabase = this.supabaseService.getClient();
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .insert([
          {
            title: workspaceData.title,
            description: workspaceData.description,
            join_policy: workspaceData.join_policy,
          },
        ])
        .select();

      let workspace_id;
      if (data && data.length > 0) {
        workspace_id = data[0].id;
      }

      try {
        const { data: adminData, error: adminError } = await supabase
          .from('admins')
          .insert([
            { user_id: workspaceData.user_id, workspace_id: workspace_id },
          ]);
      } catch (error) {
        console.error('Error adding admin:', error);
        throw new RpcException({ status: 500, message: 'Error adding admin' });
      }

      return data;
    } catch (error) {
      console.error('Error creating workspace:', error);
      throw new RpcException({
        status: 500,
        message: 'Error creating workspace',
      });
    }
  }

  async updateWorkspace(data: UpdateWorkspaceDto) {
    const supabase = this.supabaseService.getClient();

    // Mekath thaw hithla implement krnn oneee

    // try {
    //   const { data: updatedData, error } = await supabase
    //     .from('workspaces')
    //     .update({ ...data })
    //     .eq('id', data.workspace_id);

    //   if (error) {
    //     throw error;
    //   }

    //   return updatedData;
    // } catch (error) {
    //   console.error('Error updating workspace:', error);
    //   throw new RpcException({ status: 500, message: 'Error updating workspace' });
    // }
  }

  async joinWorkspace(userId: string, workspaceId: string) {
    // join workspace logic Implement krla na thama
    try {
      return {
        success: true,
        message: 'User joined workspace successfully',
        userId,
        workspaceId,
      };
    } catch (error) {
      console.error('Error joining workspace:', error);
      throw new RpcException({
        status: 500,
        message: 'Error joining workspace',
      });
    }
  }

  async requestWorkspace(userId: string, workspaceId: string) {
    // request workspace logic Implement krla na thama
    try {
      return {
        success: true,
        message: 'Workspace request sent successfully',
        userId,
        workspaceId,
      };
    } catch (error) {
      console.error('Error requesting workspace:', error);
      throw new RpcException({
        status: 500,
        message: 'Error requesting workspace',
      });
    }
  }

  getHello(): string {
    // for testing
    return 'Hello World! from Workspaces Service';
  }

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
