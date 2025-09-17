import { IsString, IsOptional, IsNotEmpty, IsNumber } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsNumber()
  @IsNotEmpty()
  groupId: number;

  @IsString()
  @IsNotEmpty()
  authorId: string; // UUID string

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  isPinned?: boolean = false;
}
