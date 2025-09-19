import {
  IsString,
  IsArray,
  IsInt,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

class QuizQuestionOptionDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  isCorrect?: boolean;
}

class QuizQuestionDto {
  @IsString()
  questionText: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionOptionDto)
  options: QuizQuestionOptionDto[];

  @IsInt()
  marks: number;
}

export class CreateQuizDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsInt()
  timeAllocated: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionDto)
  questions: QuizQuestionDto[];

  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @IsArray()
  @IsString({ each: true })
  resourceTags: string[];
}
