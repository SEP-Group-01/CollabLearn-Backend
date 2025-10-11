import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsNotEmpty()
  workspaceId: string; // Changed from groupId number to workspaceId string

  @IsString()
  @IsNotEmpty()
  authorId: string; // UUID string

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  isPinned?: boolean = false;
}
