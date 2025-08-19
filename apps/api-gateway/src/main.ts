import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { MicroserviceOptions, Transport} from '@nestjs/microservices';
import { Logger } from '@nestjs/common';

const logger = new Logger('API-Gateway');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: { host: '0.0.0.0', port: 3000 }
  });
  await app.startAllMicroservices();
  await app.listen(3000);
  logger.log('API Gateway is running');
  logger.log('API Gateway is listening on port 3000');
}
bootstrap();
