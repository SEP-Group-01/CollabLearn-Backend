// apps/auth-service/src/user.service.ts
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class UserService {
  constructor(private supabaseService: SupabaseService) {}

  async createUser(userData: Partial<User>): Promise<User> {
    const supabase = this.supabaseService.getClient();
    
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', userData.email)
      .single();

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password if provided
    if (userData.password_hash) {
      userData.password_hash = await bcrypt.hash(userData.password_hash, 12);
    }

    // Generate email verification token
    userData.email_verification_token = crypto.randomBytes(32).toString('hex');
    // userData.email_verified = false;
    // userData.created_at = new Date();
    // userData.updated_at = new Date();

    const { data, error } = await supabase
      .from('users')
      .insert([userData])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }

    return data;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const supabase = this.supabaseService.getClient();
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      throw new Error(`Failed to find user: ${error.message}`);
    }

    return data;
  }

  async findUserById(id: string): Promise<User | null> {
    const supabase = this.supabaseService.getClient();
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to find user: ${error.message}`);
    }

    return data;
  }

  async findUserByGoogleId(googleId: string): Promise<User | null> {
    const supabase = this.supabaseService.getClient();
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('google_id', googleId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to find user by Google ID: ${error.message}`);
    }

    return data;
  }

  async updateUser(id: string, updateData: Partial<User>): Promise<User> {
    const supabase = this.supabaseService.getClient();
    
    updateData.updated_at = new Date();

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }

    return data;
  }

  async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  async verifyEmail(token: string): Promise<User> {
    const supabase = this.supabaseService.getClient();
    
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email_verification_token', token)
      .single();

    if (error || !user) {
      throw new NotFoundException('Invalid verification token');
    }

    return this.updateUser(user.id, {
      email_verified: true,
      email_verification_token: undefined, //methana mokak hari awlk thiynwa
    });
  }

  async generateResetToken(email: string): Promise<string> {
    const user = await this.findUserByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    await this.updateUser(user.id, {
      reset_password_token: resetToken,
      reset_password_expires: resetExpires,
    });

    return resetToken;
  }

  async resetPassword(token: string, newPassword: string): Promise<User> {
    const supabase = this.supabaseService.getClient();
    
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('reset_password_token', token)
      .gt('reset_password_expires', new Date().toISOString())
      .single();

    if (error || !user) {
      throw new NotFoundException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    return this.updateUser(user.id, {
      password_hash: hashedPassword,
      reset_password_token: undefined,
      reset_password_expires: undefined,
    });
  }
}
