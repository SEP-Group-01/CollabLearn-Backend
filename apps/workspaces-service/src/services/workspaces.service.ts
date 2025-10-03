import { Injectable } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { RpcException } from '@nestjs/microservices';
import {
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  WorkspaceResponseDto,
  JoinWorkspaceDto,
  RequestWorkspaceDto,
} from '../DTOs/workspaces.dto';
import { title } from 'process';

@Injectable()
export class WorkspacesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  // Helper method to fetch tags for a workspace
  private async getWorkspaceTags(workspaceId: string): Promise<string[]> {
    console.log(
      `🔍 [WorkspaceService] Fetching tags for workspace ID: ${workspaceId}`,
    );

    const { data: tagsData, error: tagsError } = await this.supabaseService
      .getClient()
      .from('tags')
      .select('tag')
      .eq('workspace_id', workspaceId);

    if (tagsError) {
      console.warn('⚠️ [WorkspaceService] Error fetching tags:', tagsError);
      return [];
    }

    const tags = tagsData ? tagsData.map((tag) => tag.tag) : [];
    console.log('✅ [WorkspaceService] Fetched tags:', tags);
    return tags;
  }

  private async getWorkspaceAdmins(workspace_id: string): Promise<string[]> {
    console.log('getting admin ids for workspace id:', workspace_id);
    const { data: adminData, error: adminError } = await this.supabaseService
      .getClient()
      .from('workspace_admins')
      .select('user_id')
      .eq('workspace_id', workspace_id);

    if (adminError) {
      console.warn('[WorkspaceService] Error fetching admins:', adminError);
    }
    const admins = adminData ? adminData.map((admin) => admin.user_id) : [];
    console.log('✅ [WorkspaceService] Fetched admins:', admins);
    return admins;
  }

  // Helper method to get workspace members count
  private async getWorkspaceMembersCount(workspaceId: string): Promise<number> {
    console.log(
      `🔢 [WorkspaceService] Counting members for workspace ID: ${workspaceId}`,
    );

    const { count, error } = await this.supabaseService
      .getClient()
      .from('workspace_members')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);

    if (error) {
      console.warn('⚠️ [WorkspaceService] Error counting members:', error);
      return 0;
    }

    console.log('✅ [WorkspaceService] Members count:', count || 0);
    return count || 0;
  }

  // Helper method to determine user role in workspace
  private async getUserRoleInWorkspace(
    userId: string,
    workspaceId: string,
  ): Promise<string> {
    console.log(
      `👤 [WorkspaceService] Determining role for user ${userId} in workspace ${workspaceId}`,
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
      console.log('✅ [WorkspaceService] User is admin');
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
      console.log('✅ [WorkspaceService] User is member');
      return 'member';
    }

    // Check if user is invited
    // Get the user's email
    const userEmail = await this.getUserEmailById(userId);
    if (!userEmail) {
      console.log('❌ [WorkspaceService] User email not found');
      return 'user';
    }

    // Check for invite using the email
    const { data: inviteData, error: inviteError } = await this.supabaseService
      .getClient()
      .from('invites')
      .select('status')
      .eq('email', userEmail)
      .eq('workspace_id', workspaceId)
      .single();

    if (!inviteError && inviteData && inviteData.status != 'Accepted') {
      console.log('✅ [WorkspaceService] User is invited');
      return 'invited';
    }

    // Check if user has requested to join
    const { data: requestData, error: requestError } =
      await this.supabaseService
        .getClient()
        .from('requests')
        .select('user_id')
        .eq('user_id', userId)
        .eq('workspace_id', workspaceId)
        .single();

    if (!requestError && requestData) {
      console.log('✅ [WorkspaceService] User has requested');
      return 'requested';
    }

    console.log('✅ [WorkspaceService] User is regular user');
    return 'user';
  }

  // Helper method to check if user is admin of workspace
  private async isUserWorkspaceAdmin(
    userId: string,
    workspaceId: string,
  ): Promise<boolean> {
    console.log(
      `🔐 [WorkspaceService] Checking admin status for user ${userId} in workspace ${workspaceId}`,
    );

    const { data: adminData, error: adminError } = await this.supabaseService
      .getClient()
      .from('workspace_admins')
      .select('user_id')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .single();

    if (adminError && adminError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is fine
      console.error(
        '❌ [WorkspaceService] Error checking admin status:',
        adminError,
      );
      throw new RpcException({
        status: 500,
        message: 'Error checking admin status',
      });
    }

    const isAdmin = !adminError && !!adminData;
    console.log(
      `${isAdmin ? '✅' : '❌'} [WorkspaceService] User ${isAdmin ? 'is' : 'is not'} admin`,
    );
    return isAdmin;
  }

  // Helper method to get user email by ID
  private async getUserEmailById(userId: string): Promise<string | null> {
    console.log(`📧 [WorkspaceService] Getting email for user ID: ${userId}`);

    const { data: userData, error: userError } = await this.supabaseService
      .getClient()
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    if (userError) {
      if (userError.code === 'PGRST116') {
        console.log('❌ [WorkspaceService] User not found');
        return null;
      }
      console.error(
        '❌ [WorkspaceService] Error fetching user email:',
        userError,
      );
      throw new RpcException({
        status: 500,
        message: 'Error fetching user email',
      });
    }

    console.log('✅ [WorkspaceService] User email retrieved:', userData.email);
    return userData.email;
  }

  async getWorkspaceById(id: string, userId?: string) {
    console.log(
      '📋 [WorkspaceService] getWorkspaceById called with id:',
      id,
      'userId:',
      userId,
    );
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

      if (!data) {
        console.error('❌ [WorkspaceService] Workspace not found');
        throw new RpcException({
          status: 404,
          message: 'Workspace not found',
        });
      }

      // Fetch tags for this workspace
      const workspaceTags = await this.getWorkspaceTags(data.id);
      const workspaceAdmins = await this.getWorkspaceAdmins(data.id);

      // Get members count
      const membersCount = await this.getWorkspaceMembersCount(data.id);

      // Get user role if userId is provided
      let userRole = 'user'; // default role
      if (userId) {
        userRole = await this.getUserRoleInWorkspace(userId, data.id);
      }

      const response = {
        id: data.id,
        title: data.title,
        description: data.description,
        join_policy: data.join_policy,
        admin_ids: workspaceAdmins,
        tags: workspaceTags, // Use tags from tags table
        image_url: data.image_url || null, // Include image_url from database
        members_count: membersCount, // Add members count
        role: userRole, // Add user role
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      console.log(
        '✅ [WorkspaceService] getWorkspaceById successful, returning workspace:',
        response,
      );
      return response;
    } catch (error) {
      console.error('❌ [WorkspaceService] Error fetching workspace:', error);
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Error fetching workspace',
      });
    }
  }

  async getWorkspacesByUserId(userId: string) {
    console.log(
      '📋 [WorkspaceService] getWorkspacesByUserId called with userId:',
      userId,
    );
    const supabase = this.supabaseService.getClient();
    try {
      const { data, error } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      //Fetch workspaces
      const workspaces = await Promise.all(
        (data || []).map(async (membership) => {
          const { data: workspace, error: workspaceError } =
            await this.supabaseService
              .getClient()
              .from('workspaces')
              .select('*')
              .eq('id', membership.workspace_id)
              .single();

          if (workspaceError) {
            console.warn(
              '[WorkspaceService] Error fetching workspace:',
              workspaceError,
            );
            return null;
          }

          return workspace;
        }),
      );

      console.log(
        '✅ [WorkspaceService] getWorkspacesByUserId successful, found',
        workspaces?.length || 0,
        'workspaces',
      );
      return workspaces;
    } catch (error) {
      console.error(
        '❌ [WorkspaceService] Error fetching workspaces by user ID:',
        error,
      );
      throw new RpcException({
        status: 500,
        message: 'Error fetching workspaces by user ID',
      });
    }
  }

  async getWorkspacesBySearchTerm(searchTerm: string) {
    console.log(
      '🔍 [WorkspaceService] getWorkspacesBySearchTerm called with searchTerm:',
      searchTerm,
    );
    // I need to replace this with a Stored procedure later
    const supabase = this.supabaseService.getClient();
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .ilike('title', `%${searchTerm}%`);

      if (error) {
        throw error;
      }

      // Fetch tags for each workspace
      const workspacesWithTags = await Promise.all(
        (data || []).map(async (workspace) => {
          const workspaceTags = await this.getWorkspaceTags(workspace.id);
          const workspaceAdmins = await this.getWorkspaceAdmins(workspace.id);
          return {
            id: workspace.id,
            title: workspace.title,
            description: workspace.description,
            join_policy: workspace.join_policy,
            admin_ids: workspaceAdmins,
            tags: workspaceTags, // Use tags from tags table
            // image: workspace.image, // Commented out since image column doesn't exist in DB
            created_at: workspace.created_at,
            updated_at: workspace.updated_at,
          };
        }),
      );

      console.log(
        '✅ [WorkspaceService] getWorkspacesBySearchTerm successful, found',
        workspacesWithTags?.length || 0,
        'workspaces',
      );
      return workspacesWithTags;
    } catch (error) {
      console.error(
        '❌ [WorkspaceService] Error fetching workspaces by search term:',
        error,
      );
      throw new RpcException({
        status: 500,
        message: 'Error fetching workspaces by search term',
      });
    }
  }

  async createWorkspace(
    workspaceData: CreateWorkspaceDto,
  ): Promise<WorkspaceResponseDto> {
    console.log(
      '🆕 [WorkspaceService] createWorkspace called with data:',
      JSON.stringify(workspaceData, null, 2),
    );
    const supabase = this.supabaseService.getClient();

    // Validate required fields
    if (!workspaceData.title || !workspaceData.user_id) {
      console.error(
        '❌ [WorkspaceService] Missing required fields - title or user_id',
      );
      throw new RpcException({
        status: 400,
        message: 'Title and user_id are required fields',
      });
    }

    try {
      console.log(
        '📝 [WorkspaceService] Attempting to insert workspace into database...',
      );
      // Create the workspace
      const { data, error } = await supabase
        .from('workspaces')
        .insert([
          {
            title: workspaceData.title,
            description: workspaceData.description || '',
            join_policy: workspaceData.join_policy || 'request',
            // Note: tags will be inserted separately into tags table
            // Note: Excluding 'image' field as it doesn't exist in the database schema
            // Image handling should be implemented separately with file storage
          },
        ])
        .select()
        .single();

      if (error) {
        console.error(
          '❌ [WorkspaceService] Database error creating workspace:',
          error,
        );
        throw new RpcException({
          status: 500,
          message: `Error creating workspace: ${error.message}`,
        });
      }

      console.log(
        '✅ [WorkspaceService] Workspace created successfully:',
        data,
      );

      // Insert tags into the tags table if any tags are provided
      if (workspaceData.tags && workspaceData.tags.length > 0) {
        console.log('🏷️ [WorkspaceService] Adding tags to tags table...');

        const tagInserts = workspaceData.tags.map((tag) => ({
          workspace_id: data.id,
          tag: tag,
        }));

        const { error: tagsError } = await supabase
          .from('tags')
          .insert(tagInserts);

        if (tagsError) {
          console.error(
            '⚠️ [WorkspaceService] Error adding tags (non-critical):',
            tagsError,
          );
          // Don't fail the workspace creation if tags insertion fails
          // Just log the error and continue
        } else {
          console.log(
            '✅ [WorkspaceService] Tags added successfully:',
            workspaceData.tags,
          );
        }
      } else {
        console.log('📝 [WorkspaceService] No tags to add');
      }

      console.log('👑 [WorkspaceService] Adding user as admin...');

      // Add the creator as an admin
      const { error: adminError } = await supabase
        .from('workspace_admins')
        .insert([{ user_id: workspaceData.user_id, workspace_id: data.id }]);

      if (adminError) {
        console.error(
          '⚠️ [WorkspaceService] Error adding admin (non-critical):',
          adminError,
        );
        // Don't fail the workspace creation if admin insertion fails
        // Just log the error and continue
      } else {
        console.log(
          '✅ [WorkspaceService] Admin relationship created successfully',
        );
      }

      // Fetch the tags for the workspace from the tags table
      console.log('🔍 [WorkspaceService] Fetching tags for workspace...');
      const workspaceTags = await this.getWorkspaceTags(data.id);
      const workspaceAdmins = await this.getWorkspaceAdmins(data.id);

      const response = {
        id: data.id,
        title: data.title,
        description: data.description,
        join_policy: data.join_policy,
        admin_ids: workspaceAdmins,
        tags: workspaceTags, // Use tags from tags table
        // image: data.image, // Commented out since image column doesn't exist in DB
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      console.log(
        '🎉 [WorkspaceService] createWorkspace completed successfully, returning:',
        response,
      );
      return response;
    } catch (error) {
      console.error(
        '💥 [WorkspaceService] Unexpected error in createWorkspace:',
        error,
      );
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Error creating workspace',
      });
    }
  }

  async updateWorkspace(
    updateData: UpdateWorkspaceDto,
  ): Promise<WorkspaceResponseDto> {
    console.log(
      '✏️ [WorkspaceService] updateWorkspace called with data:',
      JSON.stringify(updateData, null, 2),
    );
    const supabase = this.supabaseService.getClient();

    if (!updateData.workspace_id) {
      console.error(
        '❌ [WorkspaceService] Missing workspace_id in updateWorkspace',
      );
      throw new RpcException({
        status: 400,
        message: 'Workspace ID is required',
      });
    }

    try {
      // Build update object with only provided fields (excluding tags since they're handled separately)
      const updateFields: any = {};
      if (updateData.title !== undefined) updateFields.title = updateData.title;
      if (updateData.description !== undefined)
        updateFields.description = updateData.description;
      if (updateData.join_policy !== undefined)
        updateFields.join_policy = updateData.join_policy;

      // Add updated timestamp
      updateFields.updated_at = new Date().toISOString();

      console.log(
        '📝 [WorkspaceService] Updating workspace with fields:',
        updateFields,
      );

      const { data, error } = await supabase
        .from('workspaces')
        .update(updateFields)
        .eq('id', updateData.workspace_id)
        .select()
        .single();

      if (error) {
        console.error(
          '❌ [WorkspaceService] Database error updating workspace:',
          error,
        );
        throw new RpcException({
          status: 500,
          message: `Error updating workspace: ${error.message}`,
        });
      }

      if (!data) {
        console.error('❌ [WorkspaceService] Workspace not found for update');
        throw new RpcException({
          status: 404,
          message: 'Workspace not found',
        });
      }

      // Handle tags update if provided
      if (updateData.tags !== undefined) {
        console.log('🏷️ [WorkspaceService] Updating tags for workspace...');

        // First, delete existing tags for this workspace
        const { error: deleteTagsError } = await supabase
          .from('tags')
          .delete()
          .eq('workspace_id', updateData.workspace_id);

        if (deleteTagsError) {
          console.error(
            '⚠️ [WorkspaceService] Error deleting existing tags:',
            deleteTagsError,
          );
        } else {
          console.log('✅ [WorkspaceService] Existing tags deleted');
        }

        // Insert new tags if any are provided
        if (updateData.tags && updateData.tags.length > 0) {
          const tagInserts = updateData.tags.map((tag) => ({
            workspace_id: updateData.workspace_id,
            tag_name: tag,
          }));

          const { error: tagsError } = await supabase
            .from('tags')
            .insert(tagInserts);

          if (tagsError) {
            console.error(
              '⚠️ [WorkspaceService] Error updating tags (non-critical):',
              tagsError,
            );
          } else {
            console.log(
              '✅ [WorkspaceService] Tags updated successfully:',
              updateData.tags,
            );
          }
        } else {
          console.log('📝 [WorkspaceService] No new tags to add');
        }
      }

      // Fetch the current tags for the workspace
      const workspaceTags = await this.getWorkspaceTags(data.id);

      const response = {
        id: data.id,
        title: data.title,
        description: data.description,
        join_policy: data.join_policy,
        admin_ids: data.user_id,
        tags: workspaceTags, // Use tags from tags table
        // image: data.image, // Commented out since image column doesn't exist in DB
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      console.log(
        '✅ [WorkspaceService] updateWorkspace completed successfully, returning:',
        response,
      );
      return response;
    } catch (error) {
      console.error(
        '💥 [WorkspaceService] Unexpected error in updateWorkspace:',
        error,
      );
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Error updating workspace',
      });
    }
  }

  async validateEmail(userId: string, workspaceId: string, email: string) {
    console.log(
      '🔍 [WorkspaceService] validateEmail called with userId:',
      userId,
      'workspaceId:',
      workspaceId,
      'email:',
      email,
    );

    try {
      // Check if the user is an admin of the workspace
      const isAdmin = await this.isUserWorkspaceAdmin(userId, workspaceId);
      if (!isAdmin) {
        console.log('❌ [WorkspaceService] User is not admin, access denied');
        throw new RpcException({
          status: 403,
          message: 'Only workspace admins can validate emails for invites',
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
          '❌ [WorkspaceService] Error checking workspace:',
          workspaceError,
        );
        throw new RpcException({
          status: 404,
          message: 'Workspace not found',
        });
      }

      // Validate the email
      const validationResult = await this.validateSingleEmail(
        email,
        workspaceId,
      );

      const result = {
        success: true,
        ...validationResult,
        workspaceId,
        workspaceTitle: workspaceData.title,
      };

      console.log('✅ [WorkspaceService] validateEmail completed:', result);
      return result;
    } catch (error) {
      console.error('❌ [WorkspaceService] Error validating email:', error);
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Error validating email',
      });
    }
  }

  // Helper method to validate a single email
  private async validateSingleEmail(email: string, workspaceId: string) {
    const result = {
      email,
      isValid: this.isValidEmail(email),
      existsInOrganization: false,
      isWorkspaceMember: false,
      canInvite: false,
      warning: '',
    };

    if (!result.isValid) {
      result.warning = 'Invalid email format';
      return result;
    }

    // Check if email exists in users table
    const { data: userData, error: userError } = await this.supabaseService
      .getClient()
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      console.error('❌ [WorkspaceService] Error checking user:', userError);
      result.warning = 'Error checking user existence';
      return result;
    }

    if (!userData) {
      result.warning = 'Email is not in the organization';
      return result;
    }

    result.existsInOrganization = true;

    // Check if user is already a workspace member
    const { data: memberData, error: memberError } = await this.supabaseService
      .getClient()
      .from('workspace_members')
      .select('user_id')
      .eq('user_id', userData.id)
      .eq('workspace_id', workspaceId)
      .single();

    if (memberError && memberError.code !== 'PGRST116') {
      console.error(
        '❌ [WorkspaceService] Error checking membership:',
        memberError,
      );
      result.warning = 'Error checking workspace membership';
      return result;
    }

    if (memberData) {
      result.isWorkspaceMember = true;
      result.warning = 'Email is already a member of the workspace';
      return result;
    }

    // Check if user already has a pending invite
    const { data: inviteData, error: inviteError } = await this.supabaseService
      .getClient()
      .from('invites')
      .select('*')
      .eq('email', email)
      .eq('workspace_id', workspaceId)
      .single();

    if (inviteError && inviteError.code !== 'PGRST116') {
      console.error(
        '❌ [WorkspaceService] Error checking existing invite:',
        inviteError,
      );
      result.warning = 'Error checking existing invites';
      return result;
    }

    if (inviteData) {
      result.warning = 'Email already has a pending invite';
      return result;
    }

    // Email can be invited
    result.canInvite = true;
    return result;
  }

  // Helper method to validate email format
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async sendBulkInvites(userId: string, workspaceId: string, emails: string[]) {
    console.log(
      '📧 [WorkspaceService] sendBulkInvites called with userId:',
      userId,
      'workspaceId:',
      workspaceId,
      'emails:',
      emails,
    );

    try {
      // Check if the user is an admin of the workspace
      const isAdmin = await this.isUserWorkspaceAdmin(userId, workspaceId);
      if (!isAdmin) {
        console.log('❌ [WorkspaceService] User is not admin, access denied');
        throw new RpcException({
          status: 403,
          message: 'Only workspace admins can send bulk invites',
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
          '❌ [WorkspaceService] Error checking workspace:',
          workspaceError,
        );
        throw new RpcException({
          status: 404,
          message: 'Workspace not found',
        });
      }

      // First validate all emails to ensure they can be invited
      const validationResults = await Promise.all(
        emails.map(async (email) => {
          return this.validateSingleEmail(email, workspaceId);
        }),
      );

      const invitableEmails = validationResults
        .filter((result) => result.canInvite)
        .map((result) => result.email);

      if (invitableEmails.length === 0) {
        return {
          success: false,
          message: 'No valid emails to invite',
          sentInvites: [],
          failedInvites: validationResults,
          workspaceId,
          workspaceTitle: workspaceData.title,
        };
      }

      // Create invites for valid emails
      const invitePromises = invitableEmails.map(async (email) => {
        try {
          const { data: inviteData, error: insertError } =
            await this.supabaseService
              .getClient()
              .from('invites')
              .insert([
                {
                  workspace_id: workspaceId,
                  email: email,
                  invited_by: userId,
                  status: 'Pending',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              ])
              .select()
              .single();

          if (insertError) {
            console.error(
              `❌ [WorkspaceService] Error creating invite for ${email}:`,
              insertError,
            );
            return {
              email,
              success: false,
              error: 'Failed to create invite',
            };
          }

          return {
            email,
            success: true,
            invite: inviteData,
          };
        } catch (error) {
          console.error(
            `❌ [WorkspaceService] Unexpected error for ${email}:`,
            error,
          );
          return {
            email,
            success: false,
            error: 'Unexpected error occurred',
          };
        }
      });

      const inviteResults = await Promise.all(invitePromises);
      const sentInvites = inviteResults.filter((result) => result.success);
      const failedInvites = inviteResults.filter((result) => !result.success);

      // Combine validation failures with invite creation failures
      const allFailedInvites = [
        ...validationResults.filter((result) => !result.canInvite),
        ...failedInvites.map((result) => ({
          email: result.email,
          isValid: true,
          existsInOrganization: true,
          isWorkspaceMember: false,
          canInvite: false,
          warning: result.error,
        })),
      ];

      const result = {
        success: sentInvites.length > 0,
        message: `Successfully sent ${sentInvites.length} invites`,
        sentInvites: sentInvites.map((invite) => invite.invite),
        failedInvites: allFailedInvites,
        workspaceId,
        workspaceTitle: workspaceData.title,
        stats: {
          total: emails.length,
          sent: sentInvites.length,
          failed: allFailedInvites.length,
        },
      };

      console.log('✅ [WorkspaceService] sendBulkInvites completed:', {
        ...result,
        sentInvites: `${result.sentInvites.length} invites`,
        failedInvites: `${result.failedInvites.length} failed`,
      });
      return result;
    } catch (error) {
      console.error('❌ [WorkspaceService] Error sending bulk invites:', error);
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Error sending bulk invites',
      });
    }
  }

  async getWorkspaceInvites(userId: string, workspaceId: string) {
    console.log(
      '📋 [WorkspaceService] getWorkspaceInvites called with userId:',
      userId,
      'workspaceId:',
      workspaceId,
    );

    try {
      // Check if the user is an admin of the workspace
      const isAdmin = await this.isUserWorkspaceAdmin(userId, workspaceId);
      if (!isAdmin) {
        console.log('❌ [WorkspaceService] User is not admin, access denied');
        throw new RpcException({
          status: 403,
          message: 'Only workspace admins can view invites',
        });
      }

      // Get all invites for the workspace
      const { data: invitesData, error: fetchError } =
        await this.supabaseService
          .getClient()
          .from('invites')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false });

      if (fetchError) {
        console.error(
          '❌ [WorkspaceService] Error fetching invites:',
          fetchError,
        );
        throw new RpcException({
          status: 500,
          message: 'Error fetching workspace invites',
        });
      }

      const result = {
        success: true,
        invites: invitesData || [],
        workspaceId,
        count: invitesData?.length || 0,
      };

      console.log(
        '✅ [WorkspaceService] getWorkspaceInvites completed, found',
        result.count,
        'invites',
      );
      return result;
    } catch (error) {
      console.error(
        '❌ [WorkspaceService] Error getting workspace invites:',
        error,
      );
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Error getting workspace invites',
      });
    }
  }

  async deleteInvite(userId: string, inviteId: string) {
    console.log(
      '🗑️ [WorkspaceService] deleteInvite called with userId:',
      userId,
      'inviteId:',
      inviteId,
    );

    try {
      // First, get the invite to check workspace ownership
      const { data: inviteData, error: fetchError } = await this.supabaseService
        .getClient()
        .from('invites')
        .select('workspace_id, email')
        .eq('id', inviteId)
        .single();

      if (fetchError) {
        console.error(
          '❌ [WorkspaceService] Error fetching invite:',
          fetchError,
        );
        if (fetchError.code === 'PGRST116') {
          throw new RpcException({
            status: 404,
            message: 'Invite not found',
          });
        }
        throw new RpcException({
          status: 500,
          message: 'Error fetching invite',
        });
      }

      // Check if the user is an admin of the workspace
      const isAdmin = await this.isUserWorkspaceAdmin(
        userId,
        inviteData.workspace_id,
      );
      if (!isAdmin) {
        console.log('❌ [WorkspaceService] User is not admin, access denied');
        throw new RpcException({
          status: 403,
          message: 'Only workspace admins can delete invites',
        });
      }

      // Delete the invite
      const { error: deleteError } = await this.supabaseService
        .getClient()
        .from('invites')
        .delete()
        .eq('id', inviteId);

      if (deleteError) {
        console.error(
          '❌ [WorkspaceService] Error deleting invite:',
          deleteError,
        );
        throw new RpcException({
          status: 500,
          message: 'Error deleting invite',
        });
      }

      const result = {
        success: true,
        message: 'Invite deleted successfully',
        inviteId,
        workspaceId: inviteData.workspace_id,
      };

      console.log('✅ [WorkspaceService] deleteInvite completed:', result);
      return result;
    } catch (error) {
      console.error('❌ [WorkspaceService] Error deleting invite:', error);
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Error deleting invite',
      });
    }
  }

  // Helper method to get thread subscriber count
  private async getThreadSubscriberCount(threadId: string): Promise<number> {
    console.log(
      `🔢 [WorkspaceService] Counting subscribers for thread ID: ${threadId}`,
    );

    const { count, error } = await this.supabaseService
      .getClient()
      .from('thread_subscribers')
      .select('*', { count: 'exact', head: true })
      .eq('thread_id', threadId);

    if (error) {
      console.warn(
        '⚠️ [WorkspaceService] Error counting thread subscribers:',
        error,
      );
      return 0;
    }

    console.log('✅ [WorkspaceService] Thread subscribers count:', count || 0);
    return count || 0;
  }

  // Helper method to get thread resource count
  private async getThreadResourceCount(threadId: string): Promise<number> {
    console.log(
      `📚 [WorkspaceService] Counting resources for thread ID: ${threadId}`,
    );

    const { count, error } = await this.supabaseService
      .getClient()
      .from('study_resources')
      .select('*', { count: 'exact', head: true })
      .eq('thread_id', threadId);

    if (error) {
      console.warn(
        '⚠️ [WorkspaceService] Error counting thread resources:',
        error,
      );
      return 0;
    }

    console.log('✅ [WorkspaceService] Thread resources count:', count || 0);
    return count || 0;
  }

  async getThreadsByWorkspaceId(workspaceId: string) {
    console.log(
      '🧵 [WorkspaceService] getThreadsByWorkspaceId called with workspaceId:',
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
          '❌ [WorkspaceService] Error fetching threads:',
          threadsError,
        );
        throw new RpcException({
          status: 500,
          message: `Error fetching threads: ${threadsError.message}`,
        });
      }

      if (!threadsData || threadsData.length === 0) {
        console.log('📋 [WorkspaceService] No threads found for workspace');
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
            title: thread.title,
            description: thread.description,
            created_by: thread.created_by,
            created_at: thread.created_at,
            updated_at: thread.updated_at,
            subscriber_count: subscriberCount,
            resource_count: resourceCount,
          };
        }),
      );

      console.log(
        '✅ [WorkspaceService] getThreadsByWorkspaceId successful, found',
        threadsWithCounts.length,
        'threads',
      );
      return threadsWithCounts;
    } catch (error) {
      console.error(
        '❌ [WorkspaceService] Error in getThreadsByWorkspaceId:',
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

  getHello(): string {
    console.log('👋 [WorkspaceService] getHello called');
    const response = 'Hello World! from Workspaces Service';
    console.log('✅ [WorkspaceService] getHello returning:', response);
    return response;
  }
}
