// import { Controller, Get } from '@nestjs/common';
// import { AppService } from './auth.service';

// @Controller()
// export class AppController {
//   constructor(private readonly appService: AppService) {}

//   @Get()
//   getHello(): string {
//     return this.appService.getHello();
//   }
// }

// apps/auth-service/src/auth.controller.ts
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto, GoogleLoginDto } from './dto/auth.dto';

@Controller()
export class AuthController {
  constructor(private authService: AuthService) {}

  @MessagePattern({ cmd: 'register' })
  async register(@Payload() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @MessagePattern({ cmd: 'login' })
  async login(@Payload() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @MessagePattern({ cmd: 'google_login' })
  async googleLogin(@Payload() googleLoginDto: GoogleLoginDto) {
    return this.authService.googleLogin(googleLoginDto);
  }

  @MessagePattern({ cmd: 'verify_email' })
  async verifyEmail(@Payload() data: { token: string }) {
    return this.authService.verifyEmail(data.token);
  }

  @MessagePattern({ cmd: 'forgot_password' })
  async forgotPassword(@Payload() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @MessagePattern({ cmd: 'reset_password' })
  async resetPassword(@Payload() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.new_password,
    );
  }

  @MessagePattern({ cmd: 'validate_user' })
  async validateUser(@Payload() data: { userId: string }) {
    return this.authService.validateUser(data.userId);
  }
}