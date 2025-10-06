/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { AttemptQuizDto } from './dto/attempt-quiz.dto';
import { StartQuizDto } from './dto/start-quiz.dto';
import { SupabaseService } from './supabase.service';

@Injectable()
export class QuizService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async createQuiz(
    createQuizDto: CreateQuizDto,
    userId: string,
    workspaceId: string,
    threadId?: string,
  ) {
    const supabase = this.supabaseService.getClient();

    console.log('Creating quiz with data:', {
      createQuizDto,
      userId,
      workspaceId,
      threadId,
    });

    // Validate that questions exist
    if (!createQuizDto.questions || !Array.isArray(createQuizDto.questions)) {
      throw new Error('Questions array is required and must be an array');
    }

    // Calculate total marks
    const totalMarks = createQuizDto.questions.reduce(
      (sum, q) => sum + q.marks,
      0,
    );

    // Insert quiz into the new `quizzes` table
    const insertPayload: Record<string, unknown> = {
      title: createQuizDto.title,
      description: createQuizDto.description,
      time_allocated: createQuizDto.timeAllocated,
      total_marks: totalMarks,
      // keep optional arrays if present in schema
      tags: createQuizDto.tags,
      resource_tags: createQuizDto.resourceTags,
      creator_id: userId,
      workspace_id: workspaceId,
    };

    if (threadId) {
      insertPayload['thread_id'] = threadId;
    }

    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .insert(insertPayload)
      .select()
      .single();

    if (quizError) {
      throw new Error(`Failed to create quiz: ${quizError.message}`);
    }

    // Insert questions and options
    for (const questionDto of createQuizDto.questions) {
      // Insert question into the new `questions` table.
      // The DB column is named `question` in the target schema, so we map questionText -> question
      const { data: question, error: questionError } = await supabase
        .from('questions')
        .insert({
          quiz_id: quiz.id,
          question: questionDto.questionText,
          attachment_url: questionDto.image ?? null,
          marks: questionDto.marks,
        })
        .select()
        .single();

      if (questionError) {
        throw new Error(`Failed to create question: ${questionError.message}`);
      }

      // Insert options
      // Insert options (keep using quiz_options table)
      for (const optionDto of questionDto.options || []) {
        const { error: optionError } = await supabase
          .from('quiz_options')
          .insert({
            question_id: question.id,
            text: optionDto.text,
            image: optionDto.image,
            is_correct: optionDto.isCorrect || false,
          });

        if (optionError) {
          throw new Error(`Failed to create option: ${optionError.message}`);
        }
      }
    }

    return { success: true, quiz };
  }

  async listQuizzes(workspaceId?: string, threadId?: string) {
    const supabase = this.supabaseService.getClient();
    // Query quizzes from `quizzes` and include nested questions + options
    let query = supabase.from('quizzes').select(
      `
        *,
        questions (
          id,
          question,
          attachment_url,
          marks,
          quiz_options (
            id,
            text,
            is_correct
          )
        )
      `,
    );

    // Apply filters if provided. If both provided, filter by both.
    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }

    if (threadId) {
      query = query.eq('thread_id', threadId);
    }

    const { data: quizzes, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch quizzes: ${error.message}`);
    }

    // Normalize returned shape so frontend still sees quiz_questions.question_text
    const normalized = (quizzes || []).map((q: any) => {
      const questions = (q.questions || []).map((qq: any) => ({
        id: qq.id,
        question_text: qq.question ?? qq.question_text,
        image: qq.attachment_url ?? qq.image,
        marks: qq.marks,
        quiz_options: qq.quiz_options || [],
      }));

      return {
        ...q,
        quiz_questions: questions,
      };
    });

    return normalized;
  }

  async getQuiz(quizId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: quiz, error } = await supabase
      .from('quizzes')
      .select(
        `
        *,
        questions (
          id,
          question,
          attachment_url,
          marks,
          quiz_options (
            id,
            text,
            image,
            is_correct
          )
        )
      `,
      )
      .eq('id', quizId)
      .maybeSingle();

    if (error) {
      // Supabase error while querying
      throw new NotFoundException(`Quiz not found: ${error.message}`);
    }

    if (!quiz) {
      // No quiz found with that id
      throw new NotFoundException('Quiz not found');
    }

    // Normalize shape to previous API (quiz_questions with question_text)
    const normalizedQuestions = (quiz.questions || []).map((qq: any) => ({
      id: qq.id,
      question_text: qq.question ?? qq.question_text,
      image: qq.attachment_url ?? qq.image,
      marks: qq.marks,
      quiz_options: qq.quiz_options || [],
    }));

    return {
      ...quiz,
      quiz_questions: normalizedQuestions,
    };
  }

  async startQuiz(startQuizDto: StartQuizDto) {
    const supabase = this.supabaseService.getClient();

    // Get quiz details
    const quiz = await this.getQuiz(startQuizDto.quizId);
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    // Check if user already has an active attempt
    const { data: existingAttempt } = await supabase
      .from('quiz_attempt')
      .select('*')
      .eq('quiz_id', startQuizDto.quizId)
      .eq('user_id', startQuizDto.userId)
      .eq('status', 'active')
      .single();

    if (existingAttempt) {
      // Return existing active attempt
      const now = new Date();
      const expiresAt = new Date(existingAttempt.expires_at);

      if (now > expiresAt) {
        // Attempt has expired, mark as expired
        await supabase
          .from('quiz_attempt')
          .update({ status: 'expired' })
          .eq('id', existingAttempt.id);

        throw new BadRequestException(
          'Previous attempt has expired. Please start a new attempt.',
        );
      }

      const timeRemaining = Math.max(
        0,
        Math.floor((expiresAt.getTime() - now.getTime()) / 1000),
      );

      return {
        attemptId: existingAttempt.id,
        startedAt: existingAttempt.started_at,
        timeAllocated: quiz.time_allocated,
        expiresAt: existingAttempt.expires_at,
        timeRemaining,
        quiz: {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          questions: quiz.quiz_questions?.map((q) => ({
            ...q,
            options: q.quiz_options?.map((opt) => ({
              id: opt.id,
              text: opt.text,
              image: opt.image,
              // Don't send isCorrect to frontend
            })),
          })),
        },
      };
    }

    // Create new attempt
    const now = new Date();
    const expiresAt = new Date(now.getTime() + quiz.time_allocated * 60 * 1000); // Convert minutes to milliseconds

    const { data: attempt, error } = await supabase
      .from('quiz_attempt')
      .insert({
        quiz_id: startQuizDto.quizId,
        user_id: startQuizDto.userId,
        workspace_id: startQuizDto.workspaceId,
        started_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        status: 'active',
        answers: {},
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to start quiz attempt: ${error.message}`);
    }

    return {
      attemptId: attempt.id,
      startedAt: attempt.started_at,
      timeAllocated: quiz.time_allocated,
      expiresAt: attempt.expires_at,
      timeRemaining: quiz.time_allocated * 60, // in seconds
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        questions: quiz.quiz_questions?.map((q) => ({
          ...q,
          options: q.quiz_options?.map((opt) => ({
            id: opt.id,
            text: opt.text,
            image: opt.image,
            // Don't send isCorrect to frontend
          })),
        })),
      },
    };
  }

  async getActiveAttempt(userId: string, quizId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: attempt, error } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('quiz_id', quizId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error || !attempt) {
      return null;
    }

    const now = new Date();
    const expiresAt = new Date(attempt.expires_at);

    if (now > expiresAt) {
      // Attempt has expired
      await supabase
        .from('quiz_attempts')
        .update({ status: 'expired' })
        .eq('id', attempt.id);

      return null;
    }

    const timeRemaining = Math.max(
      0,
      Math.floor((expiresAt.getTime() - now.getTime()) / 1000),
    );

    return {
      attemptId: attempt.id,
      startedAt: attempt.started_at,
      expiresAt: attempt.expires_at,
      timeRemaining,
      status: attempt.status,
    };
  }

  async attemptQuiz(attemptQuizDto: AttemptQuizDto) {
    const supabase = this.supabaseService.getClient();

    // Get the active attempt
    const { data: attempt, error: attemptError } = await supabase
      .from('quiz_attempt')
      .select('*')
      .eq('id', attemptQuizDto.attemptId)
      .eq('status', 'active')
      .single();

    if (attemptError || !attempt) {
      throw new BadRequestException('Invalid or expired attempt');
    }

    // Check if attempt has expired
    const now = new Date();
    const expiresAt = new Date(attempt.expires_at);

    if (now > expiresAt) {
      // Mark as expired
      await supabase
        .from('quiz_attempts')
        .update({ status: 'expired' })
        .eq('id', attempt.id);

      throw new BadRequestException('Quiz attempt has expired');
    }

    // Get quiz to calculate marks
    const quiz = await this.getQuiz(attempt.quiz_id);
    let marksObtained = 0;

    // Calculate marks
    for (const answer of attemptQuizDto.answers) {
      const question = quiz.quiz_questions.find(
        (q) => q.id === answer.questionId,
      );
      if (question) {
        const correctOptions = question.quiz_options.filter(
          (opt) => opt.is_correct,
        );
        const selectedCorrect = answer.selectedOptionIds.filter((optId) =>
          correctOptions.some((correct) => correct.id === optId),
        );

        // Full marks only if all correct options selected and no incorrect ones
        if (
          selectedCorrect.length === correctOptions.length &&
          answer.selectedOptionIds.length === correctOptions.length
        ) {
          marksObtained += question.marks;
        }
      }
    }

    // Update attempt with submission
    const { data: updatedAttempt, error: updateError } = await supabase
      .from('quiz_attempt')
      .update({
        answers: attemptQuizDto.answers,
        finished_at: now.toISOString(),
        marks_obtained: marksObtained,
        status: 'submitted',
      })
      .eq('id', attempt.id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to save attempt: ${updateError.message}`);
    }

    return {
      success: true,
      attempt: updatedAttempt,
      marksObtained,
      totalMarks: quiz.total_marks,
      percentage: Math.round((marksObtained / quiz.total_marks) * 100),
    };
  }

  async viewResults(quizId: string, userId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: attempts, error } = await supabase
      .from('quiz_attempt')
      .select('*')
      .eq('quiz_id', quizId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch results: ${error.message}`);
    }

    return attempts;
  }

  async validateUser(userId: string) {
    // This could validate user exists or fetch user details
    // For now, just return the userId
    return { userId, valid: true };
  }
}
