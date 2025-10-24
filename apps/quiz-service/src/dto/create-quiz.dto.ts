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
  image?: string; // This will be the Firebase URL after upload

  @IsOptional()
  @IsString()
  optionId?: string; // Frontend-generated temporary ID for mapping

  @IsOptional()
  isCorrect?: boolean;
}

class QuizQuestionDto {
  @IsString()
  questionText: string;

  @IsOptional()
  @IsString()
  image?: string; // This will be the Firebase URL after upload

  @IsOptional()
  @IsString()
  questionId?: string; // Frontend-generated temporary ID for mapping

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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  resourceTags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedResources?: string[];

  @IsOptional()
  @IsString()
  workspaceId?: string; // Needed for Firebase storage paths
}

