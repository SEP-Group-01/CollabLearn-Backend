import { Injectable } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class WorkspaceUserService {
  constructor(private readonly supabaseService: SupabaseService) {}

  // Helper method to get user email by ID
  private async getUserEmailById(userId: string): Promise<string | null> {
    console.log(
      `📧 [WorkspaceUserService] Getting email for user ID: ${userId}`,
    );

    const { data: userData, error: userError } = await this.supabaseService
      .getClient()
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    if (userError) {
      if (userError.code === 'PGRST116') {
        console.log('❌ [WorkspaceUserService] User not found');
        return null;
      }
      console.error(
        '❌ [WorkspaceUserService] Error fetching user email:',
        userError,
      );
      throw new RpcException({
        status: 500,
        message: 'Error fetching user email',
      });
    }

    console.log(
      '✅ [WorkspaceUserService] User email retrieved:',
      userData.email,
    );
    return userData.email;
  }

  async joinWorkspace(userId: string, workspaceId: string) {
    console.log(
      '🚪 [WorkspaceUserService] joinWorkspace called with userId:',
      userId,
      'workspaceId:',
      workspaceId,
    );
    // join workspace logic Implement krla na thama
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('workspace_members')
        .insert([{ user_id: userId, workspace_id: workspaceId }])
        .select()
        .single();
      console.log(
        '✅ [WorkspaceUserService] joinWorkspace completed (placeholder):',
        data,
      );
      return {
        success: true,
        message: 'User joined workspace successfully',
        data,
      };
    } catch (error) {
      console.error(
        '❌ [WorkspaceUserService] Error joining workspace:',
        error,
      );
      throw new RpcException({
        status: 500,
        message: 'Error joining workspace',
      });
    }
  }

  async requestWorkspace(userId: string, workspaceId: string) {
    console.log(
      '📨 [WorkspaceUserService] requestWorkspace called with userId:',
      userId,
      'workspaceId:',
      workspaceId,
    );
    // request workspace logic Implement krla na thama
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('requests')
        .insert([{ user_id: userId, workspace_id: workspaceId }])
        .select()
        .single();
      const result = {
        success: true,
        message: 'Join request sent successfully',
        data,
      };
      console.log(
        '✅ [WorkspaceUserService] requestWorkspace completed (placeholder):',
        result,
      );
      return result;
    } catch (error) {
      console.error(
        '❌ [WorkspaceUserService] Error requesting workspace:',
        error,
      );
      throw new RpcException({
        status: 500,
        message: 'Error requesting workspace',
      });
    }
  }

  async cancelJoinRequest(userId: string, workspaceId: string) {
    console.log(
      '🚫 [WorkspaceUserService] cancelJoinRequest called with userId:',
      userId,
      'workspaceId:',
      workspaceId,
    );

    try {
      // Check if the user has an existing join request
      const { data: existingRequest, error: fetchError } =
        await this.supabaseService
          .getClient()
          .from('requests')
          .select('*')
          .eq('user_id', userId)
          .eq('workspace_id', workspaceId)
          .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 means no rows found, which is fine
        console.error(
          '❌ [WorkspaceUserService] Error checking existing request:',
          fetchError,
        );
        throw new RpcException({
          status: 500,
          message: 'Error checking existing request',
        });
      }

      if (!existingRequest) {
        console.log(
          'ℹ️ [WorkspaceUserService] No existing request found to cancel',
        );
        return {
          success: false,
          message: 'No join request found to cancel',
          userId,
          workspaceId,
        };
      }

      // Delete the join request
      const { error: deleteError } = await this.supabaseService
        .getClient()
        .from('requests')
        .delete()
        .eq('user_id', userId)
        .eq('workspace_id', workspaceId);

      if (deleteError) {
        console.error(
          '❌ [WorkspaceUserService] Error deleting join request:',
          deleteError,
        );
        throw new RpcException({
          status: 500,
          message: 'Error canceling join request',
        });
      }

      const result = {
        success: true,
        message: 'Join request canceled successfully',
        userId,
        workspaceId,
      };

      console.log(
        '✅ [WorkspaceUserService] cancelJoinRequest completed:',
        result,
      );
      return result;
    } catch (error) {
      console.error(
        '❌ [WorkspaceUserService] Error canceling join request:',
        error,
      );
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Error canceling join request',
      });
    }
  }

  async acceptInvite(userId: string, workspaceId: string) {
    console.log(
      '✅ [WorkspaceUserService] acceptInvite called with userId:',
      userId,
      'workspaceId:',
      workspaceId,
    );

    try {
      // Get the user's email using the helper function
      const userEmail = await this.getUserEmailById(userId);
      if (!userEmail) {
        console.log('❌ [WorkspaceUserService] User email not found');
        return {
          success: false,
          message: 'User email not found',
          userId,
          workspaceId,
        };
      }

      // Check if the user has an invite for this workspace
      const { data: inviteData, error: fetchError } = await this.supabaseService
        .getClient()
        .from('invites')
        .select('id, email')
        .eq('email', userEmail)
        .eq('workspace_id', workspaceId)
        .single();

      if (fetchError) {
        console.error(
          '❌ [WorkspaceUserService] Error checking invite:',
          fetchError,
        );
        if (fetchError.code === 'PGRST116') {
          throw new RpcException({
            status: 404,
            message: 'No invite found for this workspace',
          });
        }
        throw new RpcException({
          status: 500,
          message: 'Error checking invite',
        });
      }

      // Check if user is already a member
      const { data: memberData, error: memberError } =
        await this.supabaseService
          .getClient()
          .from('workspace_members')
          .select('user_id')
          .eq('user_id', userId)
          .eq('workspace_id', workspaceId)
          .single();

      if (!memberError && memberData) {
        console.log('ℹ️ [WorkspaceUserService] User is already a member');
        return {
          success: false,
          message: 'You are already a member of this workspace',
          userId,
          workspaceId,
        };
      }

      // Add user to workspace members
      const { error: insertError } = await this.supabaseService
        .getClient()
        .from('workspace_members')
        .insert([{ user_id: userId, workspace_id: workspaceId }]);

      if (insertError) {
        console.error(
          '❌ [WorkspaceUserService] Error adding user to workspace:',
          insertError,
        );
        throw new RpcException({
          status: 500,
          message: 'Error accepting invite',
        });
      }

      // Delete the invite after successful acceptance
      const { error: deleteError } = await this.supabaseService
        .getClient()
        .from('invites')
        .delete()
        .eq('id', inviteData.id);

      if (deleteError) {
        console.error(
          '❌ [WorkspaceUserService] Error deleting invite:',
          deleteError,
        );
        // Don't throw error here as the main action (joining) succeeded
        console.log(
          '⚠️ [WorkspaceUserService] Invite deletion failed but user joined successfully',
        );
      }

      const result = {
        success: true,
        message: 'Successfully joined workspace',
        userId,
        workspaceId,
      };

      console.log('✅ [WorkspaceUserService] acceptInvite completed:', result);
      return result;
    } catch (error) {
      console.error('❌ [WorkspaceUserService] Error accepting invite:', error);
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Error accepting invite',
      });
    }
  }

  async declineInvite(userId: string, workspaceId: string) {
    console.log(
      '❌ [WorkspaceUserService] declineInvite called with userId:',
      userId,
      'workspaceId:',
      workspaceId,
    );

    try {
      // Get the user's email using the helper function
      const userEmail = await this.getUserEmailById(userId);
      if (!userEmail) {
        console.log('❌ [WorkspaceUserService] User email not found');
        return {
          success: false,
          message: 'User email not found',
          userId,
          workspaceId,
        };
      }

      // Check if the user has an invite for this workspace
      const { data: inviteData, error: fetchError } = await this.supabaseService
        .getClient()
        .from('invites')
        .select('id, email')
        .eq('email', userEmail)
        .eq('workspace_id', workspaceId)
        .single();

      if (fetchError) {
        console.error(
          '❌ [WorkspaceUserService] Error checking invite:',
          fetchError,
        );
        if (fetchError.code === 'PGRST116') {
          throw new RpcException({
            status: 404,
            message: 'No invite found for this workspace',
          });
        }
        throw new RpcException({
          status: 500,
          message: 'Error checking invite',
        });
      }

      // Delete the invite
      const { error: deleteError } = await this.supabaseService
        .getClient()
        .from('invites')
        .delete()
        .eq('id', inviteData.id);

      if (deleteError) {
        console.error(
          '❌ [WorkspaceUserService] Error deleting invite:',
          deleteError,
        );
        throw new RpcException({
          status: 500,
          message: 'Error declining invite',
        });
      }

      const result = {
        success: true,
        message: 'Invite declined successfully',
        userId,
        workspaceId,
      };

      console.log('✅ [WorkspaceUserService] declineInvite completed:', result);
      return result;
    } catch (error) {
      console.error('❌ [WorkspaceUserService] Error declining invite:', error);
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Error declining invite',
      });
    }
  }

  async leaveWorkspace(userId: string, workspaceId: string) {
    console.log(
      '🚪 [WorkspaceUserService] leaveWorkspace called with userId:',
      userId,
      'workspaceId:',
      workspaceId,
    );

    try {
      // Check if the user is actually a member of the workspace
      const { data: memberData, error: fetchError } = await this.supabaseService
        .getClient()
        .from('workspace_members')
        .select('user_id')
        .eq('user_id', userId)
        .eq('workspace_id', workspaceId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 means no rows found, which is fine
        console.error(
          '❌ [WorkspaceUserService] Error checking membership:',
          fetchError,
        );
        throw new RpcException({
          status: 500,
          message: 'Error checking workspace membership',
        });
      }

      if (!memberData) {
        console.log(
          'ℹ️ [WorkspaceUserService] User is not a member of this workspace',
        );
        return {
          success: false,
          message: 'You are not a member of this workspace',
          userId,
          workspaceId,
        };
      }

      // Remove the user from workspace members
      const { error: deleteError } = await this.supabaseService
        .getClient()
        .from('workspace_members')
        .delete()
        .eq('user_id', userId)
        .eq('workspace_id', workspaceId);

      if (deleteError) {
        console.error(
          '❌ [WorkspaceUserService] Error removing user from workspace:',
          deleteError,
        );
        throw new RpcException({
          status: 500,
          message: 'Error leaving workspace',
        });
      }

      const result = {
        success: true,
        message: 'Successfully left workspace',
        userId,
        workspaceId,
      };

      console.log(
        '✅ [WorkspaceUserService] leaveWorkspace completed:',
        result,
      );
      return result;
    } catch (error) {
      console.error(
        '❌ [WorkspaceUserService] Error leaving workspace:',
        error,
      );
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Error leaving workspace',
      });
    }
  }
}
