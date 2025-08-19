import { Controller, Inject, Post, Get, Query, Body} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller('auth')
export class AuthController {

    constructor(@Inject("AUTH_SERVICE") private readonly authService: ClientProxy) {}

    // Example of a potential HTTP endpoint
    @Get()
    getHello(): string {
      return 'This is the Auth Service';
    }

    @Post('login')
    async login(
        @Body()
        body:{
            email: string;  //DTOs are in the auth-service
            password: string;
        }
    ) {
        console.log('Login attempt:', body);
        // Implement login logic here
        return await firstValueFrom(this.authService.send({ cmd: 'login' }, body)); //can't await does not return a Promise, it returns an RxJS Observable.
        // converts the first emitted value from that stream into a Promise. then it can be safely awaited.
    }

    @Post('signup')
    async signUp(
        @Body()
        body: {
            email: string;
            password: string;
            first_name: string;
            last_name: string;
        }
    ) {
        console.log('Sign up attempt:', body);
        return await firstValueFrom(this.authService.send({ cmd: 'sign_up' }, body));
    }

    @Get('verify-email')
    async verifyEmail(
        @Query('token') token: string
    ) {
        if (!token) {
            return { message: 'Token is missing!' };
        }

        console.log('Email verification attempt:', token);
        return await firstValueFrom(this.authService.send({ cmd: 'verify_email' }, { token }));
    }

    @Post('forgot-password')
    async forgotPassword(
        @Body('email') email: string
    ) {
        if (!email) {
            return { message: 'Email is missing!' };
        }

        console.log('Forgot password attempt:', email);
        return await firstValueFrom(this.authService.send({ cmd: 'forgot_password' }, { email }));
    }

    @Post('reset-password')
    async resetPassword(
        @Query('token') token: string,
        @Body() { newPassword }: { newPassword: string }
    ) {
        if (!token || !newPassword) {
            return { message: 'Token and new password are required!' };
        }

        console.log('Reset password attempt:', { token, newPassword });
        return await firstValueFrom(this.authService.send({ cmd: 'reset_password' }, { token, newPassword }));
    }
}
