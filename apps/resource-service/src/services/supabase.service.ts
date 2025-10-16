// This implementation should check for optimization if connection exhaustion happens
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    console.log('🔧 [Supabase Service] Initializing Supabase client...');
    
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseServiceKey = this.configService.get<string>(
      'SUPABASE_SERVICE_KEY',
    );
    
    console.log('🔍 [Supabase Service] Config check:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      urlPreview: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'undefined'
    });
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ [Supabase Service] Missing environment variables!');
      throw new Error(
        'SUPABASE_URL or SUPABASE_SERVICE_KEY is not defined in environment variables',
      );
    }
    
    this.supabase = createClient(
      supabaseUrl,
      supabaseServiceKey, // Use service key for admin operations
    );
    
    console.log('✅ [Supabase Service] Supabase client created successfully');
  }

  getClient(): SupabaseClient {
    console.log('📦 [Supabase Service] getClient() called');
    if (!this.supabase) {
      console.error('❌ [Supabase Service] Supabase client is not initialized!');
      throw new Error('Supabase client is not initialized');
    }
    return this.supabase;
  }
}
