import { IsString, IsArray } from 'class-validator';

export class SubmitAnswerDto {
  @IsString()
  attemptId: string;

  @IsString()
  userId: string;

  @IsString()
  questionId: string;

  @IsArray()
  @IsString({ each: true })
  selectedOptions: string[];
}
