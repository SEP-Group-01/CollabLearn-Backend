import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ResourceController } from './controllers/resource.controller';
import { ResourceTcpController } from './controllers/resource-tcp.controller';
import { ResourceService } from './services/resource.service';
import { SupabaseService } from './services/supabase.service';
import { FirebaseAdminService } from './services/firebase-admin.service';
import * as path from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      // Load environment variables from project root
      envFilePath: path.join(__dirname, '../../../.env'),
      isGlobal: true, // Make env accessible globally without importing again
    }),
  ],
  controllers: [ResourceController, ResourceTcpController],
  providers: [ResourceService, SupabaseService, FirebaseAdminService],
})
export class ResourceServiceModule {
  constructor() {
    console.log('🔧 ResourceServiceModule initialized');
    console.log('📋 Controllers registered: ResourceController, ResourceTcpController');
    console.log('📋 Providers registered: ResourceService, SupabaseService, FirebaseAdminService');
  }
}
