import {
  Controller,
  Inject,
  Post,
  Get,
  Query,
  Body,
  HttpException,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject('AUTH_SERVICE') private readonly authService: ClientProxy,
  ) {}

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
      email: string; //DTOs are in the auth-service
      password: string;
    },
  ) {
    console.log('Login attempt:', body);
    // Implement login logic here

    try {
      return await firstValueFrom(
        this.authService.send({ cmd: 'login' }, body),
      ); //can't await does not return a Promise, it returns an RxJS Observable.
      // converts the first emitted value from that stream into a Promise. then it can be safely awaited.
    } catch (error) {
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
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
  ) {
    console.log('Sign up attempt:', body);
    try {
      return await firstValueFrom(
        this.authService.send({ cmd: 'sign_up' }, body),
      );
    } catch (error) {
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    if (!token) {
      return { message: 'Token is missing!' };
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

  @Post('validate-token')
  async validateToken(
    @Headers('authorization') authHeader: string,
    @Body() body?: { token?: string },
  ) {
    let token: string;

    // Extract token from Authorization header or body
    if (authHeader) {
      // Remove 'Bearer ' prefix if present
      token = authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : authHeader;
    } else if (body?.token) {
      token = body.token;
    } else {
      throw new HttpException(
        'Token is required in Authorization header or request body',
        HttpStatus.BAD_REQUEST,
      );
    }

    console.log('Token validation attempt');
    try {
      return await firstValueFrom(
        this.authService.send({ cmd: 'validate_token' }, { token }),
      );
    } catch (error) {
      throw new HttpException(
        error.message,
        error.status || HttpStatus.UNAUTHORIZED,
      );
    }
  }
}
