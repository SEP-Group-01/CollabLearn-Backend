import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthController } from './auth/auth.controller';
import { WorkspacesController } from './workspaces.controller';
import { QueryController } from './query.controller';
import { KafkaService } from './kafka.service';
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
        options: { host: '0.0.0.0', port: 3002 }
      }
    ]),
    ClientsModule.register([
      {
        name: 'WORKSPACES_SERVICE',
        transport: Transport.TCP,
        options: { host: '0.0.0.0', port: 3003 }
      }
    ]),
    ClientsModule.register([
      {
        name: 'KAFKA_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'api-gateway-client',
            brokers: ['localhost:9093']
          },
          consumer: {
            groupId: 'nestjs-group-client'
          }
        }
      }
    ]),
  ],
  controllers: [AppController, AuthController, WorkspacesController, QueryController],
  providers: [AppService, KafkaService],
})
export class AppModule {}
