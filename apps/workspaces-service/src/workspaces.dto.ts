import { IsString, MinLength, IsOptional, IsEnum } from 'class-validator';

export class CreateWorkspaceDto {

  @IsString()
  user_id: string;

  @IsString()
  @MinLength(2)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString({ each: true })
  tags?: string[];

  @IsEnum(['Anyone can join', 'Request to join', 'Invite only'])
  join_policy: 'Anyone can join' | 'Request to join' | 'Invite only';  
}

export class UpdateWorkspaceDto {

    @IsString()
    user_id: string;

    @IsString()
    workspace_id: string;

    @IsOptional()
    @IsString()
    @MinLength(2)
    title?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString({ each: true })
    tags?: string[];


    @IsOptional()
    @IsEnum(['Anyone can join', 'Request to join', 'Invite only'])
    join_policy?: 'Anyone can join' | 'Request to join' | 'Invite only';
}
