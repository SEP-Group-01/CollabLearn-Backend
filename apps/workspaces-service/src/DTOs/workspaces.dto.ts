import {
  IsString,
  IsOptional,
  IsEnum,
  IsNotEmpty,
  IsArray,
} from 'class-validator';

export enum JoinPolicy {
  OPEN = 'open',
  REQUEST = 'request',
  INVITE_ONLY = 'invite_only',
}

export class CreateWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(JoinPolicy)
  @IsOptional()
  join_policy?: JoinPolicy = JoinPolicy.REQUEST;

  @IsString()
  @IsNotEmpty()
  user_id: string; // This will be set from the authenticated user

  @IsArray()
  @IsOptional()
  tags?: string[];

  // Image handling will be implemented separately with file storage
  // @IsString()
  // @IsOptional()
  // image?: string; // For file uploads
}

export class UpdateWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  workspace_id: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsEnum(JoinPolicy)
  @IsOptional()
  join_policy?: JoinPolicy;
}

export class WorkspaceResponseDto {
  id: string;
  title: string;
  description?: string;
  join_policy: JoinPolicy;
  admin_ids: string[];
  tags?: string[];
  // image?: string; // Will be added when image storage is implemented
  created_at: string;
  updated_at: string;
}

export class JoinWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  workspaceId: string;
}

export class RequestWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  workspaceId: string;
}
