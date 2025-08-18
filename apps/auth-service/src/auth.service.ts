// import { Injectable } from '@nestjs/common';

// @Injectable()
// export class AppService {
//   getHello(): string {
//     return 'Hello World!';
//   }
// }

// apps/auth-service/src/auth.service.ts
import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from './user.service';
import { EmailService } from './email.service';
import { RegisterDto, LoginDto, GoogleLoginDto } from './dto/auth.dto';
import { User } from './entities/user.entity';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {
    this.googleClient = new OAuth2Client(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET'),
    );
  }

  async sign_up(registerDto: RegisterDto) {
    const user = await this.userService.createUser({
      email: registerDto.email,
      password_hash: registerDto.password, // This should be hashed in the UserService (Not yet hashed even though we call it password hash)
      first_name: registerDto.first_name,
      last_name: registerDto.last_name,
    });

    // Send email verification
    if (!user.email_verification_token) {
      throw new BadRequestException('Email verification token is missing.');
    }
    await this.emailService.sendEmailVerification(
      user.email,
      user.email_verification_token,
    );

    return {
      message: 'User registered successfully. Please check your email to verify your account.',
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        email_verified: user.email_verified, // This will be false until the user verifies their email
      },
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.userService.findUserByEmail(loginDto.email);

    console.log('User:', user); // Log the user found for debugging
    
    if (!user || !user.password_hash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.userService.verifyPassword(
      loginDto.password,
      user.password_hash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.email_verified) {
      throw new UnauthorizedException('Please verify your email address first');
    }

    const payload = { sub: user.id, email: user.email };
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        email_verified: user.email_verified,
      },
    };
  }

  async googleLogin(googleLoginDto: GoogleLoginDto) {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: googleLoginDto.google_token,
        audience: this.configService.get('GOOGLE_CLIENT_ID'),
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new UnauthorizedException('Invalid Google token');
      }

      let user = await this.userService.findUserByGoogleId(payload.sub);

      if (!user) {
        // Check if user exists with same email
        if (!payload.email) {
          throw new UnauthorizedException('Google account email is missing');
        }
        user = await this.userService.findUserByEmail(payload.email);
        
        if (user) {
          // Link Google account to existing user
          user = await this.userService.updateUser(user.id, {
            google_id: payload.sub,
            email_verified: true, // Google accounts are pre-verified
          });
        } else {
          // Create new user
          user = await this.userService.createUser({
            email: payload.email,
            first_name: payload.given_name || '',
            last_name: payload.family_name || '',
            google_id: payload.sub,
            email_verified: true,
          });
        }
      }

      const jwtPayload = { sub: user.id, email: user.email };
      const access_token = this.jwtService.sign(jwtPayload);

      return {
        access_token,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          email_verified: user.email_verified,
        },
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid Google token');
    }
  }

  async verifyEmail(token: string) {
    const user = await this.userService.verifyEmail(token);
    return {
      message: 'Email verified successfully',
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        email_verified: user.email_verified,
      },
    };
  }

  async forgotPassword(email: string) {
    const resetToken = await this.userService.generateResetToken(email);
    await this.emailService.sendPasswordReset(email, resetToken);
    
    return {
      message: 'Password reset link sent to your email',
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.userService.resetPassword(token, newPassword);
    
    return {
      message: 'Password reset successfully',
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        email_verified: user.email_verified,
      },
    };
  }

  async validateUser(userId: string): Promise<User | null> { //methana awlk ynn puluwn null return karla
    return this.userService.findUserById(userId);
  }

  getHello(): string {
    return 'Hello World!';
  }
}