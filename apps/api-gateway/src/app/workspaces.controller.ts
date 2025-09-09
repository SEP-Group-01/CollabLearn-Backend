import { Controller, Inject, Post, Get, Query, Body, HttpException, HttpStatus} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller('workspaces')
export class WorkspacesController {

    constructor(@Inject("WORKSPACES_SERVICE") private readonly workspacesService: ClientProxy) {}

    @Get()
    async getHello(): Promise<string> {
      return await firstValueFrom(this.workspacesService.send({ cmd: 'get-hello' }, {}));
    }

    @Post('get-workspace-by-id')
    async getWorkspaceById(@Body() body: { id: string }) {
      try {
        const workspace = await firstValueFrom(this.workspacesService.send({ cmd: 'get-workspace-by-id' }, body));
        return workspace;
      } catch (error) {
        throw new HttpException('Error fetching workspace', HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }

    @Post('get-workspaces-by-user-id')
    async getWorkspacesByUserId(@Body() body: { userId: string }) {
      try {
        const workspaces = await firstValueFrom(this.workspacesService.send({ cmd: 'get-workspaces-by-user-id' }, body));
        return workspaces;
      } catch (error) {
        throw new HttpException('Error fetching workspaces by user ID', HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }

    @Post('get-workspaces-by-search-term')
    async getWorkspacesBySearchTerm(@Body() body: { searchTerm: string }) {
      try {
        const workspaces = await firstValueFrom(this.workspacesService.send({ cmd: 'get-workspaces-by-search-term' }, body));
        return workspaces;
      } catch (error) {
        throw new HttpException('Error fetching workspaces by search term', HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }

    @Post('create-workspace')
    async createWorkspace(@Body() body: { title: string; description?: string; user_id: string; tags?: string[] }) {
        //Will check with dto in the service
      try {
        const workspace = await firstValueFrom(this.workspacesService.send({ cmd: 'create-workspace' }, body));
        return workspace;
      } catch (error) {
        throw new HttpException('Error creating workspace', HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }

    @Post('update-workspace')
    async updateWorkspace(@Body() body: { workspace_id: string; title?: string; description?: string; tags?: string[] }) {
        //Will check with dto in the service
      try {
        const workspace = await firstValueFrom(this.workspacesService.send({ cmd: 'update-workspace' }, body));
        return workspace;
      } catch (error) {
        throw new HttpException('Error updating workspace', HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }

    @Post('join-workspace')
    async joinWorkspace(@Body() body: { userId: string; workspaceId: string }) {
      try {
        const result = await firstValueFrom(this.workspacesService.send({ cmd: 'join-workspace' }, body));
        return result;
      } catch (error) {
        throw new HttpException('Error joining workspace', HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }

    @Post('request-workspace')
    async requestWorkspace(@Body() body: { userId: string; workspaceId: string }) {
      try {
        const result = await firstValueFrom(this.workspacesService.send({ cmd: 'request-workspace' }, body));
        return result;
      } catch (error) {
        throw new HttpException('Error requesting workspace', HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
}