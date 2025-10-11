import {
  Controller,
  Inject,
  Get,
  Param,
  HttpException,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller('threads')
export class ThreadsController {
  constructor(
    @Inject('WORKSPACES_SERVICE')
    private readonly workspacesService: ClientProxy,
    @Inject('AUTH_SERVICE') private readonly authService: ClientProxy,
  ) {}

  // Helper method to validate token
  private async validateAuthToken(authHeader: string) {
    if (!authHeader) {
      throw new HttpException(
        'Authorization header is required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    try {
      return await firstValueFrom(
        this.authService.send({ cmd: 'validate_token' }, { token }),
      );
    } catch (error) {
      throw new HttpException(
        'Invalid or expired token',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  @Get(':threadId/role')
  async getUserRoleInThread(
    @Param('threadId') threadId: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'get-user-role-in-thread' },
          { userId: tokenValidation.user.id, threadId },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error getting user role in thread',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
