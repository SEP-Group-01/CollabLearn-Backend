import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthController } from './auth/auth.controller';
import { WorkspacesController } from './workspaces.controller';
import { ClientsModule, Transport} from '@nestjs/microservices' 

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ClientsModule.register([
      {
        name: 'AUTH_SERVICE',
        transport: Transport.TCP,
        options: { host: '0.0.0.0', port: 3001 }
      }
    ]),
    ClientsModule.register([
      {
        name: 'WORKSPACES_SERVICE',
        transport: Transport.TCP,
        options: { host: '0.0.0.0', port: 3002 }
      }
    ]),
  ],
  controllers: [AppController, AuthController, WorkspacesController],
  providers: [AppService],
})
export class AppModule {}
