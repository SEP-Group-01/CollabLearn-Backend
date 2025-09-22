export interface Quiz {
  id: string;
  title: string;
  description: string;
  timeAllocated: number;
  totalMarks: number;
  tags: string[];
  resourceTags: string[];
  creatorId: string;
  workspaceId: string;
  createdAt?: string;
  updatedAt?: string;
  questions?: Question[];
}

export interface Question {
  id: string;
  quizId: string;
  questionText: string;
  image?: string;
  marks: number;
  options: Option[];
}

export interface Option {
  id: string;
  questionId: string;
  text: string;
  image?: string;
  isCorrect: boolean;
}

export interface Attempt {
  id: string;
  quizId: string;
  userId: string;
  workspaceId: string;
  answers: any;
  startedAt: string;
  finishedAt?: string; // Optional until submitted
  expiresAt: string; // Server-calculated expiry time
  marksObtained?: number; // Calculated after submission
  status: 'active' | 'submitted' | 'expired'; // Track attempt status
  createdAt?: string;
}

export interface ActiveAttempt {
  id: string;
  quizId: string;
  userId: string;
  workspaceId: string;
  startedAt: string;
  expiresAt: string;
  timeRemaining: number; // in seconds
  quiz: Quiz;
}
