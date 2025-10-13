import { IsString, IsOptional, IsIn, IsUUID } from 'class-validator';

export class CreateResourceDto {
  @IsUUID()
  thread_id: string;

  @IsUUID()
  user_id: string;

  @IsString()
  @IsIn(['document', 'video', 'link'])
  resource_type: 'document' | 'video' | 'link';

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  url?: string; // For link resources
}

export class UpdateResourceDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  url?: string;
}
