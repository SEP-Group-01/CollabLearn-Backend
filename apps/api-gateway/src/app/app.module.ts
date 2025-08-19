import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthController } from './auth/auth.controller';
import { ClientsModule, Transport} from '@nestjs/microservices' 

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'AUTH_SERVICE',
        transport: Transport.TCP,
        options: { host: '0.0.0.0', port: 3001 }
      }
    ])
  ],
  controllers: [AppController, AuthController],
  providers: [AppService],
})
export class AppModule {}
