import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from './user.service';
import { EmailService } from './email.service';
import { RegisterDto, LoginDto, GoogleLoginDto } from './dto/auth.dto';
import { User } from './entities/user.entity';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';
import { createDecipheriv } from 'crypto';
import { FirebaseStorageService } from './services/firebase-storage.service';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private configService: ConfigService,
    private firebaseStorageService: FirebaseStorageService,
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
      // throw new BadRequestException('Email verification token is missing.');
      throw new RpcException({
        status: 400,
        message: 'Email verification token is missing.',
      });
    }
    await this.emailService.sendEmailVerification(
      user.email,
      user.email_verification_token,
    );

    return {
      message:
        'User registered successfully. Please check your email to verify your account.',
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        email_verified: user.email_verified, // This will be false until the user verifies their email
      },
    };
  }

  async login(loginDto: LoginDto & { remember_me?: boolean }) {
    const user = await this.userService.findUserByEmail(loginDto.email);

    console.log('User:', user); // Log the user found for debugging

    if (!user || !user.password_hash) {
      // throw new UnauthorizedException('Invalid credentials');
      throw new RpcException({ status: 401, message: 'User not found' });
    }

    const isPasswordValid = await this.userService.verifyPassword(
      loginDto.password,
      user.password_hash,
    );

    if (!isPasswordValid) {
      // throw new UnauthorizedException('Invalid credentials');
      throw new RpcException({ status: 401, message: 'Invalid credentials' });
    }

    if (!user.email_verified) {
      // throw new UnauthorizedException('Please verify your email address first');
      throw new RpcException({
        status: 401,
        message: 'Please verify your email address first',
      });
    }

    // Determine token expiration based on remember_me
    const expiresIn = loginDto.remember_me ? '30d' : '24h';
    const refreshExpiresIn = loginDto.remember_me ? '90d' : '7d';

    const payload = { sub: user.id, email: user.email };
    const access_token = this.jwtService.sign(payload, { expiresIn });
    const refresh_token = this.jwtService.sign(payload, { expiresIn: refreshExpiresIn });

    return {
      access_token,
      refresh_token,
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
      throw new RpcException({
        status: 401,
        message: 'Google authentication failed',
      });
    }
  }

  async verifyEmail(token: string) {
    const user = await this.userService.verifyEmail(token);

    if (!user) {
      throw new RpcException({
        status: 400,
        message: 'Invalid or expired email verification token',
      });
    }

    const jwtPayload = { sub: user.id, email: user.email };
    const access_token = this.jwtService.sign(jwtPayload);
    return {
      message: 'Email verified successfully',
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

  async forgotPassword(email: string) {
    const resetToken = await this.userService.generateResetToken(email);
    await this.emailService.sendPasswordReset(email, resetToken);

    return {
      message: 'Password reset link sent to your email',
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.userService.resetPassword(token, newPassword);

    if (!user) {
      throw new RpcException({
        status: 400,
        message: 'Invalid or expired password reset token',
      });
    }

    const jwtPayload = { sub: user.id, email: user.email };
    const access_token = this.jwtService.sign(jwtPayload);

    return {
      message: 'Password reset successfully',
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

  async validateUser(userId: string): Promise<User | null> {
    //methana awlk ynn puluwn null return karla
    return this.userService.findUserById(userId);
  }

  async validateToken(token: string) {
    try {
      // Verify and decode the JWT token
      const payload = this.jwtService.verify(token);

      // Optionally, you can also validate if the user still exists
      const user = await this.userService.findUserById(payload.sub);
      if (!user) {
        throw new RpcException({
          status: 401,
          message: 'User not found',
        });
      }

      return {
        valid: true,
        payload,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          created_at: user.created_at,
          email_verified: user.email_verified,
          image_url: user.image_url,
        },
      };
    } catch (error) {
      throw new RpcException({
        status: 401,
        message: 'Invalid or expired token',
      });
    }
  }

  async refreshToken(refreshToken: string) {
    try {
      // Verify the refresh token
      const payload = this.jwtService.verify(refreshToken);
      
      // Check if user still exists
      const user = await this.userService.findUserById(payload.sub);
      if (!user) {
        throw new RpcException({
          status: 401,
          message: 'User not found',
        });
      }

      // Generate new tokens
      const newPayload = { sub: user.id, email: user.email };
      const access_token = this.jwtService.sign(newPayload, { expiresIn: '24h' });
      const refresh_token = this.jwtService.sign(newPayload, { expiresIn: '7d' });

      return {
        access_token,
        refresh_token,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          email_verified: user.email_verified,
        },
      };
    } catch (error) {
      throw new RpcException({
        status: 401,
        message: 'Invalid or expired refresh token',
      });
    }
  }

  getHello(): string {
    return 'Hello World!';
  }

  async getUserDetails(token: string) {
    try {
      // First validate the token and get basic user info
      const tokenValidation = await this.validateToken(token);
      
      if (!tokenValidation.valid) {
        throw new RpcException({
          status: 401,
          message: 'Invalid token',
        });
      }

      const userId = tokenValidation.user.id;

      // Get user stats
      const stats = await this.userService.getUserStats(userId);

      return {
        user: {
          ...tokenValidation.user,
          image_url: tokenValidation.user.image_url,
          stats: {
            workspaceCount: stats.workspaceCount,
            studyHours: stats.totalStudyHours,
            completedTasks: stats.completedTasks,
          },
        },
      };
    } catch (error) {
      throw new RpcException({
        status: error.status || 401,
        message: error.message || 'Failed to get user details',
      });
    }
  }

  async editUser(data: {
    token: string;
    first_name?: string;
    last_name?: string;
    image_file?: string; // base64 encoded image
    remove_image?: boolean;
  }) {
    try {
      // Validate token first
      const tokenValidation = await this.validateToken(data.token);
      
      if (!tokenValidation.valid) {
        throw new RpcException({
          status: 401,
          message: 'Invalid token',
        });
      }

      const userId = tokenValidation.user.id;
      const updateData: any = {};

      // Update names if provided
      if (data.first_name !== undefined) {
        updateData.first_name = data.first_name;
      }
      if (data.last_name !== undefined) {
        updateData.last_name = data.last_name;
      }

      // Handle image upload/removal
      if (data.remove_image) {
        // Remove current image if exists
        const currentUser = await this.userService.findUserById(userId);
        if (currentUser?.image_url) {
          // Extract file path from URL and delete from Firebase
          const urlParts = currentUser.image_url.split('/');
          const pathIndex = urlParts.findIndex(part => part === 'users');
          if (pathIndex !== -1) {
            const filePath = urlParts.slice(pathIndex).join('/');
            await this.firebaseStorageService.deleteUserImage(filePath);
          }
        }
        updateData.image_url = null;
      } else if (data.image_file) {
        // Upload new image
        try {
          // Convert base64 to buffer
          const base64Data = data.image_file.replace(/^data:image\/[a-z]+;base64,/, '');
          const imageBuffer = Buffer.from(base64Data, 'base64');
          
          // Determine MIME type from data URL
          const mimeTypeMatch = data.image_file.match(/^data:(image\/[a-z]+);base64,/);
          const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';

          // Delete old image if exists
          const currentUser = await this.userService.findUserById(userId);
          if (currentUser?.image_url) {
            const urlParts = currentUser.image_url.split('/');
            const pathIndex = urlParts.findIndex(part => part === 'users');
            if (pathIndex !== -1) {
              const filePath = urlParts.slice(pathIndex).join('/');
              await this.firebaseStorageService.deleteUserImage(filePath);
            }
          }

          // Upload new image
          const uploadResult = await this.firebaseStorageService.uploadUserImage(
            imageBuffer,
            userId,
            mimeType,
          );
          
          updateData.image_url = uploadResult.downloadUrl;
        } catch (error) {
          throw new RpcException({
            status: 400,
            message: 'Failed to upload image',
          });
        }
      }

      // Update user in database
      const updatedUser = await this.userService.updateUser(userId, updateData);

      return {
        message: 'User updated successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          first_name: updatedUser.first_name,
          last_name: updatedUser.last_name,
          image_url: updatedUser.image_url,
          email_verified: updatedUser.email_verified,
          created_at: updatedUser.created_at,
        },
      };
    } catch (error) {
      throw new RpcException({
        status: error.status || 500,
        message: error.message || 'Failed to update user',
      });
    }
  }
}
