import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class CreateReplyDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsNumber()
  @IsNotEmpty()
  messageId: number;

  @IsString()
  @IsNotEmpty()
  authorId: string; // UUID string
}
