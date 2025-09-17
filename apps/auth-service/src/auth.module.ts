// apps/auth-service/src/auth.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { EmailService } from './email.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SupabaseService } from './supabase.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      // Load environment variables
      isGlobal: true, // Make env accessible globally without importing again
    }),
    JwtModule.registerAsync({
      // After reading env variables
      inject: [ConfigService], // Inject ConfigService to access env variables
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'), // Injected configService can be used like this
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN', '24h'),
        },
      }),
    }),
  ],
  controllers: [AuthController], // handle incoming TCP requests related to authentication
  providers: [
    // injectable classes/services that provide logic and utilities
    AuthService,
    UserService,
    EmailService,
    GoogleStrategy,
    JwtStrategy,
    SupabaseService,
  ],
})
export class AuthModule {}
