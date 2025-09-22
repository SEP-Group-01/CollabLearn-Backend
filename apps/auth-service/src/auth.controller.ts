import { Controller, UseFilters, Get } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
// import { throwError } from 'rxjs';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  GoogleLoginDto,
} from './dto/auth.dto';
import { AllExceptionsFilter } from './all-exceptions.filter';

@Controller()
@UseFilters(AllExceptionsFilter)
export class AuthController {
  constructor(private authService: AuthService) {}

  @MessagePattern({ cmd: 'sign_up' })
  async sign_up(@Payload() registerDto: RegisterDto) {
    return this.authService.sign_up(registerDto);
  }

  @MessagePattern({ cmd: 'login' })
  async login(@Payload() loginDto: LoginDto) {
    console.log('Login attempt:', loginDto); // Log the login attempt for debugging
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
      resetPasswordDto.newPassword,
    );
  }

  @MessagePattern({ cmd: 'validate_user' })
  async validateUser(@Payload() data: { userId: string }) {
    return this.authService.validateUser(data.userId);
  }

  @Get()
  getHello(): string {
    return this.authService.getHello();
  }
}
