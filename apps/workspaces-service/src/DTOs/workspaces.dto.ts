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

  // Image handling - the actual file will be passed separately via multer
  @IsOptional()
  image?: any; // This will be the multer file object

  @IsString()
  @IsOptional()
  image_url?: string; // For storing the final image URL after upload
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

  @IsString()
  @IsNotEmpty()
  user_id: string; // User making the update

  // Image handling
  @IsOptional()
  image?: any; // Multer file object for new image

  @IsString()
  @IsOptional()
  image_url?: string; // For storing the final image URL after upload
}

export class WorkspaceResponseDto {
  id: string;
  title: string;
  description?: string;
  join_policy: JoinPolicy;
  admin_ids: string[];
  tags?: string[];
  image_url?: string; // Added image URL to response
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
