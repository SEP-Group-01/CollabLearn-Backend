// This implementation should check for optimization if connection exhaustion happens
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseServiceKey = this.configService.get<string>(
      'SUPABASE_SERVICE_KEY',
    );
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        'SUPABASE_URL or SUPABASE_SERVICE_KEY is not defined in environment variables',
      );
    }
    this.supabase = createClient(
      supabaseUrl,
      supabaseServiceKey, // Use service key for admin operations
    );
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }
}
