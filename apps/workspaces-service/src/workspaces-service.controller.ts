import { Controller, Get } from '@nestjs/common';
import { WorkspacesServiceService } from './workspaces-service.service';

@Controller()
export class WorkspacesServiceController {
  constructor(private readonly workspacesServiceService: WorkspacesServiceService) {}

  @Get()
  getHello(): string {
    return this.workspacesServiceService.getHello();
  }
}
