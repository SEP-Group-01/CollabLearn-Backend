import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './controllers/auth.controller';
import { WorkspacesController } from './controllers/workspaces.controller';
import { QueryController } from './controllers/query.controller';
import { ForumController } from './controllers/forum.controller';
import { KafkaService } from './services/kafka.service';
import { KafkaReplyController } from './controllers/kafka-reply.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';

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
        options: { host: 'auth-service', port: 3002 }, // AUTH_SERVICE_PORT
      },
    ]),
    ClientsModule.register([
      {
        name: 'WORKSPACES_SERVICE',
        transport: Transport.TCP,
        options: { host: 'workspaces-service', port: 3005 }, // WORKSPACES_SERVICE_PORT
      },
    ]),
    ClientsModule.register([
      {
        name: 'FORUM_SERVICE',
        transport: Transport.TCP,
        options: { host: 'forum-service', port: 3004 }, // FORUM_TCP_PORT
      },
    ]),
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_SERVICE',
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'api-gateway',
              brokers: [configService.get('KAFKA_BROKERS') || 'kafka:9092'].map(
                (broker) => broker.trim(),
              ),
            },
            consumer: {
              groupId: 'gateway-consumer',
            },
          },
        }),
      },
    ]),
  ],
  controllers: [
    AuthController,
    WorkspacesController,
    QueryController,
    ForumController, // Add forum controller
    KafkaReplyController,
  ],
  providers: [KafkaService],
})
export class AppModule {}
