import { Injectable } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { RpcException } from '@nestjs/microservices';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from './workspaces.dto';
import { title } from 'process';

@Injectable()
export class WorkspacesService {
  constructor(private readonly supabaseService: SupabaseService) {}

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
}
