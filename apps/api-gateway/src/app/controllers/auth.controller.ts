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

  private handleError(error: unknown, defaultMessage: string): never {
    const message = error instanceof Error ? error.message : defaultMessage;
    throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
  }

  // Health check endpoint
  @Get('health')
  health(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  // Example of a potential HTTP endpoint
  @Get()
  getHello(): string {
    return 'This is the Auth Service';
  }

  @Post('login')
  async login(
    @Body()
    body: {
      email: string;
      password: string;
    },
  ): Promise<any> {
    console.log('Login attempt:', body);
    try {
      return await firstValueFrom(
        this.authService.send({ cmd: 'login' }, body),
      );
    } catch (error) {
      this.handleError(error, 'Login failed');
    }
  }

  @Post('signup')
  async signUp(
    @Body()
    body: {
      email: string;
      password: string;
      first_name: string;
      last_name: string;
    },
  ): Promise<any> {
    console.log('Sign up attempt:', body);
    try {
      return await firstValueFrom(
        this.authService.send({ cmd: 'sign_up' }, body),
      );
    } catch (error) {
      this.handleError(error, 'Sign up failed');
    }
  }

  @Get('verify-email')
  async verifyEmail(@Query('token') token: string): Promise<any> {
    if (!token) {
      return { message: 'Token is missing!' };
    }

    console.log('Email verification attempt:', token);
    try {
      return await firstValueFrom(
        this.authService.send({ cmd: 'verify_email' }, { token }),
      );
    } catch (error) {
      this.handleError(error, 'Email verification failed');
    }
  }

  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string): Promise<any> {
    if (!email) {
      return { message: 'Email is missing!' };
    }

    console.log('Forgot password attempt:', email);
    try {
      return await firstValueFrom(
        this.authService.send({ cmd: 'forgot_password' }, { email }),
      );
    } catch (error) {
      this.handleError(error, 'Forgot password failed');
    }
  }

  @Post('reset-password')
  async resetPassword(
    @Query('token') token: string,
    @Body() { newPassword }: { newPassword: string },
  ): Promise<any> {
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
      this.handleError(error, 'Reset password failed');
    }
  }
}
