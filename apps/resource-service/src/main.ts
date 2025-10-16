import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { ResourceServiceModule } from './resource-service.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  console.log('🚀 Starting Resource Service...');

  // Create HTTP application
  const app = await NestFactory.create(ResourceServiceModule);

  // Enable CORS for frontend access
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001'], // Frontend URLs
    credentials: true,
  });

  // Enable validation pipes
  app.useGlobalPipes(new ValidationPipe());

  // Start HTTP server on port 3007 (for direct HTTP access if needed)
  await app.listen(3007);
  console.log('📡 Resource Service HTTP server running on port 3007');

  // Create TCP microservice
  console.log('🔧 Creating TCP microservice for Resource Service...');
  const microservice =
    await NestFactory.createMicroservice<MicroserviceOptions>(
      ResourceServiceModule,
      {
        transport: Transport.TCP,
        options: {
          host: '0.0.0.0', // Listen on all interfaces so Docker can connect
          port: 3008, // TCP port for microservice communication
        },
      },
    );

  // Start TCP microservice
  console.log('🔗 Starting TCP microservice listener on 0.0.0.0:3008...');
  await microservice.listen();
  console.log('✅ Resource Service TCP microservice running on port 3008');
  console.log('📡 Ready to accept TCP connections from API Gateway on host.docker.internal:3008');
}

bootstrap().catch((error) => {
  console.error('❌ Error starting Resource Service:', error);
  process.exit(1);
});
