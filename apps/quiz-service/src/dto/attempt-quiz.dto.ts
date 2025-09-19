import { IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class AttemptAnswerDto {
  @IsString()
  questionId: string;

  @IsArray()
  @IsString({ each: true })
  selectedOptionIds: string[];
}

export class AttemptQuizDto {
  @IsString()
  attemptId: string; // Reference to the started attempt

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttemptAnswerDto)
  answers: AttemptAnswerDto[];
}
