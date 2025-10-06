import { Injectable } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class WorkspaceThreadsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  // Helper method to determine user role in workspace (copied from WorkspacesService)
  private async getUserRoleInWorkspace(
    userId: string,
    workspaceId: string,
  ): Promise<string> {
    console.log(
      `👤 [WorkspaceThreadsService] Determining role for user ${userId} in workspace ${workspaceId}`,
    );

    // Check if user is admin
    const { data: adminData, error: adminError } = await this.supabaseService
      .getClient()
      .from('workspace_admins')
      .select('user_id')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .single();

    if (!adminError && adminData) {
      console.log('✅ [WorkspaceThreadsService] User is admin');
      return 'admin';
    }

    // Check if user is member
    const { data: memberData, error: memberError } = await this.supabaseService
      .getClient()
      .from('workspace_members')
      .select('user_id')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .single();

    if (!memberError && memberData) {
      console.log('✅ [WorkspaceThreadsService] User is member');
      return 'member';
    }

    console.log('✅ [WorkspaceThreadsService] User is regular user');
    return 'user';
  }

  // Helper method to get thread subscriber count
  private async getThreadSubscriberCount(threadId: string): Promise<number> {
    console.log(
      `🔢 [WorkspaceThreadsService] Counting subscribers for thread ID: ${threadId}`,
    );

    const { count, error } = await this.supabaseService
      .getClient()
      .from('thread_subscribers')
      .select('*', { count: 'exact', head: true })
      .eq('thread_id', threadId);

    if (error) {
      console.warn(
        '⚠️ [WorkspaceThreadsService] Error counting thread subscribers:',
        error,
      );
      return 0;
    }

    console.log(
      '✅ [WorkspaceThreadsService] Thread subscribers count:',
      count || 0,
    );
    return count || 0;
  }

  // Helper method to get thread resource count
  private async getThreadResourceCount(threadId: string): Promise<number> {
    console.log(
      `📚 [WorkspaceThreadsService] Counting resources for thread ID: ${threadId}`,
    );

    const { count, error } = await this.supabaseService
      .getClient()
      .from('thread_resources')
      .select('*', { count: 'exact', head: true })
      .eq('thread_id', threadId);

    if (error) {
      console.warn(
        '⚠️ [WorkspaceThreadsService] Error counting thread resources:',
        error,
      );
      return 0;
    }

    console.log(
      '✅ [WorkspaceThreadsService] Thread resources count:',
      count || 0,
    );
    return count || 0;
  }

  async createThread(
    workspaceId: string,
    threadData: { name: string; description: string },
    createdBy: string,
  ) {
    console.log(
      '🧵 [WorkspaceThreadsService] createThread called for workspace:',
      workspaceId,
      'by user:',
      createdBy,
      'with data:',
      threadData,
    );

    try {
      // Check if the user has access to create threads in this workspace (must be admin or member)
      const userRole = await this.getUserRoleInWorkspace(
        createdBy,
        workspaceId,
      );
      if (userRole !== 'admin' && userRole !== 'member') {
        console.log(
          '❌ [WorkspaceThreadsService] User does not have access to create threads in this workspace',
        );
        throw new RpcException({
          status: 403,
          message:
            'Access denied. You must be a member to create threads in this workspace.',
        });
      }

      // Validate required fields
      if (!threadData.name || !threadData.name.trim()) {
        console.error('❌ [WorkspaceThreadsService] Thread name is required');
        throw new RpcException({
          status: 400,
          message: 'Thread name is required',
        });
      }

      // Check if workspace exists
      const { data: workspaceData, error: workspaceError } =
        await this.supabaseService
          .getClient()
          .from('workspaces')
          .select('id, title')
          .eq('id', workspaceId)
          .single();

      if (workspaceError) {
        console.error(
          '❌ [WorkspaceThreadsService] Error checking workspace:',
          workspaceError,
        );
        throw new RpcException({
          status: 404,
          message: 'Workspace not found',
        });
      }

      // Create the thread (without created_by field since it's not in the schema)
      const { data: threadResult, error: createError } =
        await this.supabaseService
          .getClient()
          .from('threads')
          .insert([
            {
              workspace_id: workspaceId,
              name: threadData.name.trim(),
              description: threadData.description?.trim() || '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ])
          .select()
          .single();

      if (createError) {
        console.error(
          '❌ [WorkspaceThreadsService] Error creating thread:',
          createError,
        );
        throw new RpcException({
          status: 500,
          message: 'Error creating thread',
        });
      }

      const result = {
        id: threadResult.id,
        workspace_id: threadResult.workspace_id,
        name: threadResult.name,
        description: threadResult.description,
        total_estimated_hours: threadResult.total_estimated_hours || 0,
        created_at: threadResult.created_at,
        updated_at: threadResult.updated_at,
        subscriber_count: 0, // New thread has no subscribers yet
        resource_count: 0, // New thread has no resources yet
      };

      console.log(
        '✅ [WorkspaceThreadsService] createThread completed:',
        result,
      );
      return result;
    } catch (error) {
      console.error(
        '❌ [WorkspaceThreadsService] Error in createThread:',
        error,
      );
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Error creating thread',
      });
    }
  }

  async getThreadsByWorkspaceId(workspaceId: string) {
    console.log(
      '🧵 [WorkspaceThreadsService] getThreadsByWorkspaceId called with workspaceId:',
      workspaceId,
    );
    const supabase = this.supabaseService.getClient();

    try {
      // Fetch threads for the workspace
      const { data: threadsData, error: threadsError } = await supabase
        .from('threads')
        .select('*')
        .eq('workspace_id', workspaceId);

      if (threadsError) {
        console.error(
          '❌ [WorkspaceThreadsService] Error fetching threads:',
          threadsError,
        );
        throw new RpcException({
          status: 500,
          message: `Error fetching threads: ${threadsError.message}`,
        });
      }

      if (!threadsData || threadsData.length === 0) {
        console.log(
          '📋 [WorkspaceThreadsService] No threads found for workspace',
        );
        return [];
      }

      // For each thread, get subscriber count and resource count
      const threadsWithCounts = await Promise.all(
        threadsData.map(async (thread) => {
          const subscriberCount = await this.getThreadSubscriberCount(
            thread.id,
          );
          const resourceCount = await this.getThreadResourceCount(thread.id);

          return {
            id: thread.id,
            workspace_id: thread.workspace_id,
            name: thread.name,
            description: thread.description,
            total_estimated_hours: thread.total_estimated_hours || 0,
            created_at: thread.created_at,
            updated_at: thread.updated_at,
            subscriber_count: subscriberCount,
            resource_count: resourceCount,
          };
        }),
      );

      console.log(
        '✅ [WorkspaceThreadsService] getThreadsByWorkspaceId successful, found',
        threadsWithCounts.length,
        'threads',
      );
      return threadsWithCounts;
    } catch (error) {
      console.error(
        '❌ [WorkspaceThreadsService] Error in getThreadsByWorkspaceId:',
        error,
      );
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Error fetching threads by workspace ID',
      });
    }
  }

  async getThread(threadId: string, userId: string) {
    console.log(
      `🧵 [WorkspaceThreadsService] getThread called for thread: ${threadId} by user: ${userId}`,
    );

    try {
      // Get thread details
      const { data: threadData, error: threadError } =
        await this.supabaseService
          .getClient()
          .from('threads')
          .select('*')
          .eq('id', threadId)
          .single();

      if (threadError || !threadData) {
        console.error(
          '❌ [WorkspaceThreadsService] Thread not found:',
          threadError,
        );
        throw new RpcException({
          status: 404,
          message: 'Thread not found',
        });
      }

      // Check if user has access to this thread (must be member of workspace)
      const userRole = await this.getUserRoleInWorkspace(
        userId,
        threadData.workspace_id,
      );
      if (userRole === 'user') {
        throw new RpcException({
          status: 403,
          message: 'Access denied. You must be a member of the workspace.',
        });
      }

      // Get subscriber and resource counts
      const subscriberCount = await this.getThreadSubscriberCount(threadId);
      const resourceCount = await this.getThreadResourceCount(threadId);

      const result = {
        id: threadData.id,
        workspace_id: threadData.workspace_id,
        name: threadData.name,
        description: threadData.description,
        total_estimated_hours: threadData.total_estimated_hours || 0,
        created_at: threadData.created_at,
        updated_at: threadData.updated_at,
        subscriber_count: subscriberCount,
        resource_count: resourceCount,
      };

      console.log('✅ [WorkspaceThreadsService] getThread successful:', result);
      return result;
    } catch (error) {
      console.error('❌ [WorkspaceThreadsService] Error in getThread:', error);
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Error fetching thread',
      });
    }
  }

  async updateThread(
    threadId: string,
    threadData: { name?: string; description?: string },
    userId: string,
  ) {
    console.log(
      `🧵 [WorkspaceThreadsService] updateThread called for thread: ${threadId} by user: ${userId}`,
    );

    try {
      // Get thread details first
      const { data: existingThread, error: threadError } =
        await this.supabaseService
          .getClient()
          .from('threads')
          .select('*')
          .eq('id', threadId)
          .single();

      if (threadError || !existingThread) {
        throw new RpcException({
          status: 404,
          message: 'Thread not found',
        });
      }

      // Check if user has permission to update (must be admin or moderator)
      const userRole = await this.getUserRoleInWorkspace(
        userId,
        existingThread.workspace_id,
      );

      // Check if user is thread moderator
      const { data: moderatorData } = await this.supabaseService
        .getClient()
        .from('thread_moderators')
        .select('user_id')
        .eq('user_id', userId)
        .eq('thread_id', threadId)
        .single();

      if (userRole !== 'admin' && !moderatorData) {
        throw new RpcException({
          status: 403,
          message: 'Access denied. You must be an admin or thread moderator.',
        });
      }

      // Update thread
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (threadData.name !== undefined) {
        updateData.name = threadData.name.trim();
      }
      if (threadData.description !== undefined) {
        updateData.description = threadData.description.trim();
      }

      const { data: updatedThread, error: updateError } =
        await this.supabaseService
          .getClient()
          .from('threads')
          .update(updateData)
          .eq('id', threadId)
          .select()
          .single();

      if (updateError) {
        console.error(
          '❌ [WorkspaceThreadsService] Error updating thread:',
          updateError,
        );
        throw new RpcException({
          status: 500,
          message: 'Error updating thread',
        });
      }

      console.log('✅ [WorkspaceThreadsService] updateThread successful');
      return updatedThread;
    } catch (error) {
      console.error(
        '❌ [WorkspaceThreadsService] Error in updateThread:',
        error,
      );
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Error updating thread',
      });
    }
  }

  async deleteThread(threadId: string, userId: string) {
    console.log(
      `🧵 [WorkspaceThreadsService] deleteThread called for thread: ${threadId} by user: ${userId}`,
    );

    try {
      // Get thread details first
      const { data: existingThread, error: threadError } =
        await this.supabaseService
          .getClient()
          .from('threads')
          .select('*')
          .eq('id', threadId)
          .single();

      if (threadError || !existingThread) {
        throw new RpcException({
          status: 404,
          message: 'Thread not found',
        });
      }

      // Check if user has permission to delete (must be admin)
      const userRole = await this.getUserRoleInWorkspace(
        userId,
        existingThread.workspace_id,
      );
      if (userRole !== 'admin') {
        throw new RpcException({
          status: 403,
          message: 'Access denied. Only workspace admins can delete threads.',
        });
      }

      // Delete thread (CASCADE will handle related records)
      const { error: deleteError } = await this.supabaseService
        .getClient()
        .from('threads')
        .delete()
        .eq('id', threadId);

      if (deleteError) {
        console.error(
          '❌ [WorkspaceThreadsService] Error deleting thread:',
          deleteError,
        );
        throw new RpcException({
          status: 500,
          message: 'Error deleting thread',
        });
      }

      console.log('✅ [WorkspaceThreadsService] deleteThread successful');
      return { message: 'Thread deleted successfully', threadId };
    } catch (error) {
      console.error(
        '❌ [WorkspaceThreadsService] Error in deleteThread:',
        error,
      );
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Error deleting thread',
      });
    }
  }

  async subscribeToThread(threadId: string, userId: string) {
    console.log(
      `🧵 [WorkspaceThreadsService] subscribeToThread called for thread: ${threadId} by user: ${userId}`,
    );

    try {
      // Check if thread exists and get workspace
      const { data: threadData, error: threadError } =
        await this.supabaseService
          .getClient()
          .from('threads')
          .select('workspace_id')
          .eq('id', threadId)
          .single();

      if (threadError || !threadData) {
        throw new RpcException({
          status: 404,
          message: 'Thread not found',
        });
      }

      // Check if user has access to workspace
      const userRole = await this.getUserRoleInWorkspace(
        userId,
        threadData.workspace_id,
      );
      if (userRole === 'user') {
        throw new RpcException({
          status: 403,
          message: 'Access denied. You must be a member of the workspace.',
        });
      }

      // Check if already subscribed
      const { data: existingSubscription } = await this.supabaseService
        .getClient()
        .from('thread_subscribers')
        .select('id')
        .eq('user_id', userId)
        .eq('thread_id', threadId)
        .single();

      if (existingSubscription) {
        throw new RpcException({
          status: 400,
          message: 'Already subscribed to this thread',
        });
      }

      // Subscribe to thread
      const { data: subscription, error: subscribeError } =
        await this.supabaseService
          .getClient()
          .from('thread_subscribers')
          .insert([
            {
              user_id: userId,
              thread_id: threadId,
              subscribed_at: new Date().toISOString(),
            },
          ])
          .select()
          .single();

      if (subscribeError) {
        console.error(
          '❌ [WorkspaceThreadsService] Error subscribing to thread:',
          subscribeError,
        );
        throw new RpcException({
          status: 500,
          message: 'Error subscribing to thread',
        });
      }

      console.log('✅ [WorkspaceThreadsService] subscribeToThread successful');
      return { message: 'Successfully subscribed to thread', subscription };
    } catch (error) {
      console.error(
        '❌ [WorkspaceThreadsService] Error in subscribeToThread:',
        error,
      );
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Error subscribing to thread',
      });
    }
  }

  async unsubscribeFromThread(threadId: string, userId: string) {
    console.log(
      `🧵 [WorkspaceThreadsService] unsubscribeFromThread called for thread: ${threadId} by user: ${userId}`,
    );

    try {
      // Check if subscribed
      const { data: existingSubscription } = await this.supabaseService
        .getClient()
        .from('thread_subscribers')
        .select('id')
        .eq('user_id', userId)
        .eq('thread_id', threadId)
        .single();

      if (!existingSubscription) {
        throw new RpcException({
          status: 400,
          message: 'Not subscribed to this thread',
        });
      }

      // Unsubscribe from thread
      const { error: unsubscribeError } = await this.supabaseService
        .getClient()
        .from('thread_subscribers')
        .delete()
        .eq('user_id', userId)
        .eq('thread_id', threadId);

      if (unsubscribeError) {
        console.error(
          '❌ [WorkspaceThreadsService] Error unsubscribing from thread:',
          unsubscribeError,
        );
        throw new RpcException({
          status: 500,
          message: 'Error unsubscribing from thread',
        });
      }

      console.log(
        '✅ [WorkspaceThreadsService] unsubscribeFromThread successful',
      );
      return { message: 'Successfully unsubscribed from thread' };
    } catch (error) {
      console.error(
        '❌ [WorkspaceThreadsService] Error in unsubscribeFromThread:',
        error,
      );
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Error unsubscribing from thread',
      });
    }
  }

  async getThreadSubscribers(threadId: string, userId: string) {
    console.log(
      `🧵 [WorkspaceThreadsService] getThreadSubscribers called for thread: ${threadId} by user: ${userId}`,
    );

    try {
      // Check if thread exists and get workspace
      const { data: threadData, error: threadError } =
        await this.supabaseService
          .getClient()
          .from('threads')
          .select('workspace_id')
          .eq('id', threadId)
          .single();

      if (threadError || !threadData) {
        throw new RpcException({
          status: 404,
          message: 'Thread not found',
        });
      }

      // Check if user has access to workspace
      const userRole = await this.getUserRoleInWorkspace(
        userId,
        threadData.workspace_id,
      );
      if (userRole === 'user') {
        throw new RpcException({
          status: 403,
          message: 'Access denied. You must be a member of the workspace.',
        });
      }

      // Get subscribers with user details
      const { data: subscribers, error: subscribersError } =
        await this.supabaseService
          .getClient()
          .from('thread_subscribers')
          .select(
            `
          id,
          user_id,
          subscribed_at,
          users:user_id (
            id,
            email,
            first_name,
            last_name
          )
        `,
          )
          .eq('thread_id', threadId);

      if (subscribersError) {
        console.error(
          '❌ [WorkspaceThreadsService] Error getting thread subscribers:',
          subscribersError,
        );
        throw new RpcException({
          status: 500,
          message: 'Error getting thread subscribers',
        });
      }

      // Get all thread moderators for this thread
      const { data: moderators, error: moderatorsError } =
        await this.supabaseService
          .getClient()
          .from('thread_moderators')
          .select('user_id')
          .eq('thread_id', threadId);

      if (moderatorsError) {
        console.warn(
          '⚠️ [WorkspaceThreadsService] Error getting thread moderators:',
          moderatorsError,
        );
      }

      // Create a set of moderator user IDs for quick lookup
      const moderatorUserIds = new Set(
        (moderators || []).map((mod) => mod.user_id),
      );

      // Add isModerator field to each subscriber
      const subscribersWithModeratorStatus = (subscribers || []).map(
        (subscriber) => ({
          ...subscriber,
          isModerator: moderatorUserIds.has(subscriber.user_id),
        }),
      );

      console.log(
        '✅ [WorkspaceThreadsService] getThreadSubscribers successful',
      );
      return subscribersWithModeratorStatus;
    } catch (error) {
      console.error(
        '❌ [WorkspaceThreadsService] Error in getThreadSubscribers:',
        error,
      );
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Error getting thread subscribers',
      });
    }
  }

  async assignModerators(threadId: string, userIds: string[], userId: string) {
    console.log(
      `🧵 [WorkspaceThreadsService] assignModerators called for thread: ${threadId} by user: ${userId}`,
    );

    try {
      // Check if thread exists and get workspace
      const { data: threadData, error: threadError } =
        await this.supabaseService
          .getClient()
          .from('threads')
          .select('workspace_id')
          .eq('id', threadId)
          .single();

      if (threadError || !threadData) {
        throw new RpcException({
          status: 404,
          message: 'Thread not found',
        });
      }

      // Check if user has permission (must be admin)
      const userRole = await this.getUserRoleInWorkspace(
        userId,
        threadData.workspace_id,
      );
      if (userRole !== 'admin') {
        throw new RpcException({
          status: 403,
          message:
            'Access denied. Only workspace admins can assign moderators.',
        });
      }

      // Verify all users exist and are members of workspace
      for (const assigneeId of userIds) {
        const assigneeRole = await this.getUserRoleInWorkspace(
          assigneeId,
          threadData.workspace_id,
        );
        if (assigneeRole === 'user') {
          throw new RpcException({
            status: 400,
            message: `User ${assigneeId} is not a member of the workspace`,
          });
        }
      }

      // Insert moderators (use upsert to avoid duplicates)
      const moderatorData = userIds.map((assigneeId) => ({
        user_id: assigneeId,
        thread_id: threadId,
        subscribed_at: new Date().toISOString(),
      }));

      const { data: moderators, error: moderatorError } =
        await this.supabaseService
          .getClient()
          .from('thread_moderators')
          .upsert(moderatorData)
          .select();

      if (moderatorError) {
        console.error(
          '❌ [WorkspaceThreadsService] Error assigning moderators:',
          moderatorError,
        );
        throw new RpcException({
          status: 500,
          message: 'Error assigning moderators',
        });
      }

      console.log('✅ [WorkspaceThreadsService] assignModerators successful');
      return {
        message: 'Moderators assigned successfully',
        moderators: moderators || [],
        assigned_count: userIds.length,
      };
    } catch (error) {
      console.error(
        '❌ [WorkspaceThreadsService] Error in assignModerators:',
        error,
      );
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Error assigning moderators',
      });
    }
  }

  async removeModerators(threadId: string, userIds: string[], userId: string) {
    console.log(
      `🧵 [WorkspaceThreadsService] removeModerators called for thread: ${threadId} by user: ${userId}`,
    );

    try {
      // Check if thread exists and get workspace
      const { data: threadData, error: threadError } =
        await this.supabaseService
          .getClient()
          .from('threads')
          .select('workspace_id')
          .eq('id', threadId)
          .single();

      if (threadError || !threadData) {
        throw new RpcException({
          status: 404,
          message: 'Thread not found',
        });
      }

      // Check if user has permission (must be admin)
      const userRole = await this.getUserRoleInWorkspace(
        userId,
        threadData.workspace_id,
      );
      if (userRole !== 'admin') {
        throw new RpcException({
          status: 403,
          message:
            'Access denied. Only workspace admins can remove moderators.',
        });
      }

      // Remove moderators
      const { error: removeError } = await this.supabaseService
        .getClient()
        .from('thread_moderators')
        .delete()
        .eq('thread_id', threadId)
        .in('user_id', userIds);

      if (removeError) {
        console.error(
          '❌ [WorkspaceThreadsService] Error removing moderators:',
          removeError,
        );
        throw new RpcException({
          status: 500,
          message: 'Error removing moderators',
        });
      }

      console.log('✅ [WorkspaceThreadsService] removeModerators successful');
      return {
        message: 'Moderators removed successfully',
        removed_count: userIds.length,
      };
    } catch (error) {
      console.error(
        '❌ [WorkspaceThreadsService] Error in removeModerators:',
        error,
      );
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Error removing moderators',
      });
    }
  }

  async getThreadStats(threadId: string, userId: string) {
    console.log(
      `🧵 [WorkspaceThreadsService] getThreadStats called for thread: ${threadId} by user: ${userId}`,
    );

    try {
      // Check if thread exists and get workspace
      const { data: threadData, error: threadError } =
        await this.supabaseService
          .getClient()
          .from('threads')
          .select('workspace_id')
          .eq('id', threadId)
          .single();

      if (threadError || !threadData) {
        throw new RpcException({
          status: 404,
          message: 'Thread not found',
        });
      }

      // Check if user has access to workspace
      const userRole = await this.getUserRoleInWorkspace(
        userId,
        threadData.workspace_id,
      );
      if (userRole === 'user') {
        throw new RpcException({
          status: 403,
          message: 'Access denied. You must be a member of the workspace.',
        });
      }

      // Get subscriber count
      const subscriberCount = await this.getThreadSubscriberCount(threadId);

      // Get resource count
      const resourceCount = await this.getThreadResourceCount(threadId);

      // Get quiz count from the dedicated quizzes table
      const { count: quizCount, error: quizError } = await this.supabaseService
        .getClient()
        .from('quizzes')
        .select('*', { count: 'exact', head: true })
        .eq('thread_id', threadId);

      if (quizError) {
        console.warn(
          '⚠️ [WorkspaceThreadsService] Error counting quizzes:',
          quizError,
        );
      }

      const stats = {
        thread_id: threadId,
        subscriber_count: subscriberCount,
        resource_count: resourceCount,
        quiz_count: quizCount || 0,
        total_resources: resourceCount,
      };

      console.log(
        '✅ [WorkspaceThreadsService] getThreadStats successful:',
        stats,
      );
      return stats;
    } catch (error) {
      console.error(
        '❌ [WorkspaceThreadsService] Error in getThreadStats:',
        error,
      );
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Error getting thread stats',
      });
    }
  }

  async getThreadResources(threadId: string, userId: string) {
    console.log(
      `📚 [WorkspaceThreadsService] getThreadResources called for thread: ${threadId} by user: ${userId}`,
    );

    try {
      // Check if thread exists and get workspace
      const { data: threadData, error: threadError } =
        await this.supabaseService
          .getClient()
          .from('threads')
          .select('workspace_id')
          .eq('id', threadId)
          .single();

      if (threadError || !threadData) {
        throw new RpcException({
          status: 404,
          message: 'Thread not found',
        });
      }

      // Check if user has access to workspace
      const userRole = await this.getUserRoleInWorkspace(
        userId,
        threadData.workspace_id,
      );
      if (userRole === 'user') {
        throw new RpcException({
          status: 403,
          message: 'Access denied. You must be a member of the workspace.',
        });
      }

      // Get thread resources with creator details
      const { data: resources, error: resourcesError } =
        await this.supabaseService
          .getClient()
          .from('thread_resources')
          .select(
            `
            id,
            thread_id,
            user_id,
            resource_type,
            title,
            description,
            firebase_path,
            firebase_url,
            file_name,
            file_size,
            mime_type,
            created_at,
            updated_at,
            users:user_id (
              id,
              email,
              first_name,
              last_name
            )
          `,
          )
          .eq('thread_id', threadId)
          .order('created_at', { ascending: false });

      if (resourcesError) {
        console.error(
          '❌ [WorkspaceThreadsService] Error getting thread resources:',
          resourcesError,
        );
        throw new RpcException({
          status: 500,
          message: 'Error getting thread resources',
        });
      }

      console.log(
        '✅ [WorkspaceThreadsService] getThreadResources successful, found',
        resources?.length || 0,
        'resources',
      );
      return resources || [];
    } catch (error) {
      console.error(
        '❌ [WorkspaceThreadsService] Error in getThreadResources:',
        error,
      );
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Error getting thread resources',
      });
    }
  }

  async getThreadQuizzes(threadId: string, userId: string) {
    console.log(
      `🧩 [WorkspaceThreadsService] getThreadQuizzes called for thread: ${threadId} by user: ${userId}`,
    );

    try {
      // Check if thread exists and get workspace
      const { data: threadData, error: threadError } =
        await this.supabaseService
          .getClient()
          .from('threads')
          .select('workspace_id')
          .eq('id', threadId)
          .single();

      if (threadError || !threadData) {
        throw new RpcException({
          status: 404,
          message: 'Thread not found',
        });
      }

      // Check if user has access to workspace
      const userRole = await this.getUserRoleInWorkspace(
        userId,
        threadData.workspace_id,
      );
      if (userRole === 'user') {
        throw new RpcException({
          status: 403,
          message: 'Access denied. You must be a member of the workspace.',
        });
      }

      // Get thread quizzes with creator details
      const { data: quizzes, error: quizzesError } = await this.supabaseService
        .getClient()
        .from('quizzes')
        .select(
          `
            id,
            thread_id,
            creator_id,
            created_at,
            users:creator_id (
              id,
              email,
              first_name,
              last_name
            )
          `,
        )
        .eq('thread_id', threadId)
        .order('created_at', { ascending: false });

      if (quizzesError) {
        console.error(
          '❌ [WorkspaceThreadsService] Error getting thread quizzes:',
          quizzesError,
        );
        throw new RpcException({
          status: 500,
          message: 'Error getting thread quizzes',
        });
      }

      console.log(
        '✅ [WorkspaceThreadsService] getThreadQuizzes successful, found',
        quizzes?.length || 0,
        'quizzes',
      );
      return quizzes || [];
    } catch (error) {
      console.error(
        '❌ [WorkspaceThreadsService] Error in getThreadQuizzes:',
        error,
      );
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Error getting thread quizzes',
      });
    }
  }

  async getQuizAttempts(quizId: string, userId: string) {
    console.log(
      `📊 [WorkspaceThreadsService] getQuizAttempts called for quiz: ${quizId} by user: ${userId}`,
    );

    try {
      // Check if quiz exists and get thread/workspace info
      const { data: quizData, error: quizError } = await this.supabaseService
        .getClient()
        .from('quizzes')
        .select(
          `
            id,
            thread_id,
            creator_id,
            threads:thread_id (
              workspace_id
            )
          `,
        )
        .eq('id', quizId)
        .single();

      if (quizError || !quizData) {
        throw new RpcException({
          status: 404,
          message: 'Quiz not found',
        });
      }

      // Check if user has access to workspace
      const userRole = await this.getUserRoleInWorkspace(
        userId,
        quizData.threads[0].workspace_id,
      );
      if (userRole === 'user') {
        throw new RpcException({
          status: 403,
          message: 'Access denied. You must be a member of the workspace.',
        });
      }

      // Get quiz attempts with user details
      const { data: attempts, error: attemptsError } =
        await this.supabaseService
          .getClient()
          .from('quiz_attempt')
          .select(
            `
            id,
            quiz_id,
            user_id,
            attempt_nummber,
            time_taken,
            marks,
            created_at,
            users:user_id (
              id,
              email,
              first_name,
              last_name
            )
          `,
          )
          .eq('quiz_id', quizId)
          .order('created_at', { ascending: false });

      if (attemptsError) {
        console.error(
          '❌ [WorkspaceThreadsService] Error getting quiz attempts:',
          attemptsError,
        );
        throw new RpcException({
          status: 500,
          message: 'Error getting quiz attempts',
        });
      }

      console.log(
        '✅ [WorkspaceThreadsService] getQuizAttempts successful, found',
        attempts?.length || 0,
        'attempts',
      );
      return attempts || [];
    } catch (error) {
      console.error(
        '❌ [WorkspaceThreadsService] Error in getQuizAttempts:',
        error,
      );
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Error getting quiz attempts',
      });
    }
  }
}
