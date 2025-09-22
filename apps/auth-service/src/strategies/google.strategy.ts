// apps/auth-service/src/strategies/google.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
//custom strategy class that extends Passport’s built-in Google strategy
//name 'google' is used to call the stratergy
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private configService: ConfigService) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID') || 'dummy_client_id';
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET') || 'dummy_client_secret';
    const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL') || 'http://localhost:3000/auth/google/callback';
    
    super({
      clientID,
      clientSecret,
      callbackURL, //google will redirect the user to this URL after they log in
      scope: ['email', 'profile'], //requests access to user's email and profile info from Google
      passReqToCallback: true,
    });
  }

  async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, name, emails, photos } = profile;
    const user = {
      google_id: id,
      email: emails[0].value,
      first_name: name.givenName,
      last_name: name.familyName,
      picture: photos[0].value,
    };
    done(null, user);
  }
}
