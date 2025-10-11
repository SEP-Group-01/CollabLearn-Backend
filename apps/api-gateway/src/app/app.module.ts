import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './controllers/auth.controller';
import { WorkspacesController } from './controllers/workspaces.controller';
import { ThreadsController } from './controllers/threads.controller';
import { QueryController } from './controllers/query.controller';
import { ForumController } from './controllers/forum.controller';
import { StudyPlanController } from './controllers/study-plan.controller';
import { KafkaService } from './services/kafka.service';
import { RedisBridgeService } from './services/redis-bridge.service';
import { KafkaReplyController } from './controllers/kafka-reply.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { DocumentEditorController } from './controllers/document-editor-enhanced.controller';
import { QuizController } from './controllers/quiz.controller';
import { DocumentEditorGateway } from './gateways/document-editor.gateway';
import { ForumGateway } from './gateways/forum.gateway';
import { QuizGateway } from './gateways/quiz.gateway';

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
        options: { host: 'localhost', port: 3002 }, // AUTH_SERVICE_PORT
      },
    ]),
    ClientsModule.register([
      {
        name: 'WORKSPACES_SERVICE',
        transport: Transport.TCP,
        options: { host: 'localhost', port: 3003 }, // WORKSPACES_SERVICE_PORT (corrected port)
      },
    ]),
    ClientsModule.register([
      {
        name: 'FORUM_SERVICE',
        transport: Transport.TCP,
        options: { host: 'localhost', port: 3004 }, // FORUM_TCP_PORT
      },
    ]),
    ClientsModule.register([
      {
        name: 'DOCUMENT_EDITOR_SERVICE',
        transport: Transport.TCP,
        options: { host: 'localhost', port: 3006 }, // DOCUMENT_EDITOR_SERVICE_PORT
      },
    ]),
    ClientsModule.register([
      {
        name: 'QUIZ_SERVICE',
        transport: Transport.TCP,
        options: { host: 'localhost', port: 3007 }, // QUIZ_SERVICE_PORT
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
              brokers: [
                configService.get('KAFKA_BROKERS') || 'localhost:9092',
              ].map((broker) => broker.trim()),
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
    ThreadsController,
    QueryController,
    ForumController,
    StudyPlanController,
    DocumentEditorController,
    QuizController,
    ThreadQuizController,
    KafkaReplyController,
  ],
  providers: [KafkaService, RedisBridgeService, DocumentEditorGateway, ForumGateway, QuizGateway],
})
export class AppModule {}
