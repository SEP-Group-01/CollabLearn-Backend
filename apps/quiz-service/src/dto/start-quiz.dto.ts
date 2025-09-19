import { IsString } from 'class-validator';

export class StartQuizDto {
  @IsString()
  quizId: string;

  @IsString()
  userId: string;

  @IsString()
  workspaceId: string;
}

export class StartQuizResponseDto {
  attemptId: string;
  startedAt: string;
  timeAllocated: number; // in minutes
  expiresAt: string;
  quiz: {
    id: string;
    title: string;
    description: string;
    questions: any[];
  };
}
