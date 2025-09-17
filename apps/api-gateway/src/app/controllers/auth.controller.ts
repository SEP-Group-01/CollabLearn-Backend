import {
  Controller,
  Inject,
  Post,
  Get,
  Query,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject('AUTH_SERVICE') private readonly authService: ClientProxy,
  ) {}

  // Example of a potential HTTP endpoint
  @Get()
  getHello(): string {
    return 'This is the Auth Service';
  }

    // Health check endpoint
    @Get('health')
    health(): { status: string; timestamp: string } {
      return {
        status: 'ok',
        timestamp: new Date().toISOString()
      };
    }

    // Example of a potential HTTP endpoint
    @Get()
    getHello(): string {
      return 'This is the Auth Service';
    }

    console.log('Email verification attempt:', token);
    try {
      return await firstValueFrom(
        this.authService.send({ cmd: 'verify_email' }, { token }),
      );
    } catch (error) {
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    if (!email) {
      return { message: 'Email is missing!' };
    }

    console.log('Forgot password attempt:', email);
    try {
      return await firstValueFrom(
        this.authService.send({ cmd: 'forgot_password' }, { email }),
      );
    } catch (error) {
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('reset-password')
  async resetPassword(
    @Query('token') token: string,
    @Body() { newPassword }: { newPassword: string },
  ) {
    if (!token || !newPassword) {
      return { message: 'Token and new password are required!' };
    }

    console.log('Reset password attempt:', { token, newPassword });
    try {
      return await firstValueFrom(
        this.authService.send(
          { cmd: 'reset_password' },
          { token, newPassword },
        ),
      );
    } catch (error) {
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
