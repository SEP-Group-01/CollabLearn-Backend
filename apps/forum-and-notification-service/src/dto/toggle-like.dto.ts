import { IsNumber, IsNotEmpty, IsString } from 'class-validator';

export class ToggleLikeDto {
  @IsNumber()
  @IsNotEmpty()
  messageId: number;

  @IsString()
  @IsNotEmpty()
  userId: string; // UUID string

  @IsNumber()
  replyId?: number;
}
