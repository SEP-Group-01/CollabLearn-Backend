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
    threadId: string,
  ) {
    const supabase = this.supabaseService.getClient();

    console.log('Creating quiz with data:', {
      createQuizDto,
      userId,
      threadId,
    });

    // Validate that questions exist
    if (!createQuizDto.questions || !Array.isArray(createQuizDto.questions)) {
      throw new Error('Questions array is required and must be an array');
    }

    if (!threadId) {
      throw new Error('Thread ID is required to create a quiz');
    }

    // Calculate total marks
    const totalMarks = createQuizDto.questions.reduce(
      (sum, q) => sum + q.marks,
      0,
    );

    // Insert quiz into the quizzes table
    const insertPayload: Record<string, unknown> = {
      title: createQuizDto.title,
      description: createQuizDto.description,
      allocated_time: createQuizDto.timeAllocated,
      creator_id: userId,
      thread_id: threadId,
    };

    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .insert(insertPayload)
      .select()
      .single();

    if (quizError) {
      throw new Error(`Failed to create quiz: ${quizError.message}`);
    }

    // Insert linked resources if selectedResources are provided
    if (createQuizDto.selectedResources && Array.isArray(createQuizDto.selectedResources)) {
      for (const resourceName of createQuizDto.selectedResources) {
        const { error: linkError } = await supabase
          .from('linked_resources')
          .insert({
            quiz_id: quiz.id,
            resource_name: resourceName,
          });

        if (linkError) {
          console.error(`Failed to link resource ${resourceName}:`, linkError.message);
          // Don't throw error for linking resources, just log it
        }
      }
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

      // Insert options into answer_option table
      for (let i = 0; i < (questionDto.options || []).length; i++) {
        const optionDto = questionDto.options[i];
        const sequenceLetter = String.fromCharCode(97 + i); // 'a', 'b', 'c', etc.
        const { error: optionError } = await supabase
          .from('answer_option')
          .insert({
            question_id: question.id,
            answer_sequence_letter: sequenceLetter,
            answer: optionDto.text,
            image_url: optionDto.image,
            is_correct: optionDto.isCorrect || false,
          });

        if (optionError) {
          throw new Error(`Failed to create option: ${optionError.message}`);
        }
      }
    }

    return { success: true, quiz };
  }

  async listQuizzes(threadId?: string, userId?: string) {
    const supabase = this.supabaseService.getClient();
    
    if (!threadId) {
      throw new Error('Thread ID is required to fetch quizzes');
    }

    // Query quizzes from `quizzes` and include nested questions + options + user info + attempts
    const { data: quizzes, error } = await supabase.from('quizzes').select(
      `
        *,
        users!creator_id (
          id,
          email,
          first_name,
          last_name
        ),
        questions (
          id,
          question,
          attachment_url,
          marks,
          answer_option (
            id,
            answer_sequence_letter,
            answer,
            image_url,
            is_correct
          )
        ),
        linked_resources (
          id,
          resource_name
        )
      `,
    ).eq('thread_id', threadId);

    if (error) {
      throw new Error(`Failed to fetch quizzes: ${error.message}`);
    }

    // Fetch quiz attempts and calculate statistics for each quiz
    const normalizedQuizzes = await Promise.all((quizzes || []).map(async (q: any) => {
      const questions = (q.questions || []).map((qq: any) => ({
        id: qq.id,
        question_text: qq.question ?? qq.question_text,
        image: qq.attachment_url ?? qq.image,
        marks: qq.marks,
        quiz_options: (qq.answer_option || []).map((opt: any) => ({
          id: opt.id,
          text: opt.answer,
          image: opt.image_url,
          is_correct: opt.is_correct,
          sequence_letter: opt.answer_sequence_letter,
        })),
      }));

      // Calculate total marks from questions
      const totalMarks = questions.reduce(
        (sum, qq) => sum + (qq.marks || 0),
        0,
      );

      // Fetch all quiz attempts for statistics
      const { data: attempts, error: attemptsError } = await supabase
        .from('quiz_attempt')
        .select('*')
        .eq('quiz_id', q.id);

      let totalAttempts = 0;
      let averageMarks = 0;
      let averageTime = 0;
      let studentAttempts: any[] = [];

      if (!attemptsError && attempts) {
        totalAttempts = attempts.length;
        if (totalAttempts > 0) {
          const totalMarksSum = attempts.reduce((sum: number, attempt: any) => 
            sum + (attempt.marks || 0), 0);
          averageMarks = totalMarksSum / totalAttempts;

          // Convert time_taken from TIME format to minutes
          const totalTimeSum = attempts.reduce((sum: number, attempt: any) => {
            if (attempt.time_taken) {
              // Convert HH:MM:SS to minutes
              const timeParts = attempt.time_taken.split(':');
              const minutes = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]) + 
                             parseInt(timeParts[2]) / 60;
              return sum + minutes;
            }
            return sum;
          }, 0);
          averageTime = totalTimeSum / totalAttempts;
        }

        // Get student's attempts if userId is provided
        if (userId) {
          const userAttempts = attempts.filter((attempt: any) => attempt.user_id === userId);
          studentAttempts = userAttempts.map((attempt: any) => {
            let timeTaken = 0;
            if (attempt.time_taken) {
              const timeParts = attempt.time_taken.split(':');
              timeTaken = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]) + 
                         parseInt(timeParts[2]) / 60;
            }

            return {
              attemptNumber: attempt.attempt_nummber || 1,
              marksObtained: attempt.marks || 0,
              timeTaken: timeTaken,
              completed: attempt.marks !== null,
              date: new Date(attempt.created_at).toLocaleDateString(),
            };
          });
        }
      }

      // Get creator name
      const creator = q.users ? 
        `${q.users.first_name} ${q.users.last_name}` : 'Unknown';

      // Get resource tags from linked_resources
      const resourceTags = (q.linked_resources || []).map((lr: any) => lr.resource_name);

      return {
        id: q.id,
        title: q.title,
        description: q.description,
        timeAllocated: q.allocated_time,
        totalMarks: totalMarks,
        tags: [], // No tags field in database, return empty array
        resourceTags: resourceTags,
        creator: creator,
        totalAttempts: totalAttempts,
        averageMarks: averageMarks,
        averageTime: averageTime,
        studentAttempts: studentAttempts,
        thread_id: q.thread_id,
        creator_id: q.creator_id,
        created_at: q.created_at,
        questions: questions,
        // For backward compatibility
        quiz_questions: questions,
      };
    }));

    return normalizedQuizzes;
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
          answer_option (
            id,
            answer_sequence_letter,
            answer,
            image_url,
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
      quiz_options: (qq.answer_option || []).map((opt: any) => ({
        id: opt.id,
        text: opt.answer,
        image: opt.image_url,
        is_correct: opt.is_correct,
        sequence_letter: opt.answer_sequence_letter,
      })),
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

    // Check if user already has an incomplete attempt
    const { data: existingAttempt } = await supabase
      .from('quiz_attempt')
      .select('*')
      .eq('quiz_id', startQuizDto.quizId)
      .eq('user_id', startQuizDto.userId)
      .is('time_taken', null) // Not completed yet
      .is('marks', null) // Not graded yet
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingAttempt) {
      // Check if existing attempt has expired based on creation time + allocated time
      const now = new Date();
      const createdAt = new Date(existingAttempt.created_at);
      const expiresAt = new Date(
        createdAt.getTime() + quiz.allocated_time * 60 * 1000,
      );

      if (now > expiresAt) {
        // Attempt has expired, auto-complete it with 0 marks
        await supabase
          .from('quiz_attempt')
          .update({
            time_taken: quiz.allocated_time + ':00:00', // Set to full allocated time
            marks: 0,
          })
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
        startedAt: existingAttempt.created_at,
        timeAllocated: quiz.allocated_time,
        expiresAt: expiresAt.toISOString(),
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
    const expiresAt = new Date(now.getTime() + quiz.allocated_time * 60 * 1000); // Convert minutes to milliseconds

    // Get attempt number
    const { count } = await supabase
      .from('quiz_attempt')
      .select('*', { count: 'exact', head: true })
      .eq('quiz_id', startQuizDto.quizId)
      .eq('user_id', startQuizDto.userId);

    const attemptNumber = (count || 0) + 1;

    const { data: attempt, error } = await supabase
      .from('quiz_attempt')
      .insert({
        quiz_id: startQuizDto.quizId,
        user_id: startQuizDto.userId,
        attempt_nummber: attemptNumber,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to start quiz attempt: ${error.message}`);
    }

    return {
      attemptId: attempt.id,
      startedAt: attempt.created_at,
      timeAllocated: quiz.allocated_time,
      expiresAt: expiresAt.toISOString(),
      timeRemaining: quiz.allocated_time * 60, // in seconds
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

    // Get the most recent attempt that hasn't been completed yet
    // Since your schema doesn't have status tracking, we'll consider an attempt
    // active if it doesn't have time_taken and marks set
    const { data: attempt, error } = await supabase
      .from('quiz_attempt')
      .select('*')
      .eq('quiz_id', quizId)
      .eq('user_id', userId)
      .is('time_taken', null) // Not completed yet
      .is('marks', null) // Not graded yet
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !attempt) {
      return null;
    }

    // Since we don't have expires_at in schema, we'll use allocated time
    const quiz = await this.getQuiz(quizId);
    const createdAt = new Date(attempt.created_at);
    const expiresAt = new Date(
      createdAt.getTime() + quiz.allocated_time * 60 * 1000,
    );
    const now = new Date();

    if (now > expiresAt) {
      // Attempt has expired, we could mark it as completed with 0 marks
      // But for now, just return null
      return null;
    }

    const timeRemaining = Math.max(
      0,
      Math.floor((expiresAt.getTime() - now.getTime()) / 1000),
    );

    return {
      attemptId: attempt.id,
      startedAt: attempt.created_at,
      expiresAt: expiresAt.toISOString(),
      timeRemaining,
      status: 'active',
    };
  }

  async attemptQuiz(attemptQuizDto: AttemptQuizDto) {
    const supabase = this.supabaseService.getClient();

    // Get the attempt
    const { data: attempt, error: attemptError } = await supabase
      .from('quiz_attempt')
      .select('*')
      .eq('id', attemptQuizDto.attemptId)
      .single();

    if (attemptError || !attempt) {
      throw new BadRequestException('Invalid attempt');
    }

    // Check if already completed
    if (attempt.marks !== null || attempt.time_taken !== null) {
      throw new BadRequestException('Quiz attempt already completed');
    }

    // Get quiz to calculate marks
    const quiz = await this.getQuiz(attempt.quiz_id);
    let marksObtained = 0;

    // Insert user answers and calculate marks
    for (const answer of attemptQuizDto.answers) {
      const question = quiz.quiz_questions.find(
        (q) => q.id === answer.questionId,
      );

      if (question) {
        // Convert selected option IDs to sequence letters for storage
        const selectedLetters: string[] = [];
        for (const optionId of answer.selectedOptionIds) {
          const option = question.quiz_options.find(
            (opt) => opt.id === optionId,
          );
          if (option && option.sequence_letter) {
            selectedLetters.push(option.sequence_letter);
          }
        }

        // Store answer in user_answer table
        const answerString = selectedLetters.sort().join(',');
        await supabase.from('user_answer').insert({
          attempt_id: attempt.id,
          question_id: answer.questionId,
          answer: answerString,
        });

        // Calculate marks - check if all correct answers are selected
        const correctOptions = question.quiz_options.filter(
          (opt) => opt.is_correct,
        );
        const correctLetters = correctOptions
          .map((opt) => opt.sequence_letter)
          .sort();

        // Full marks only if answer matches exactly
        if (answerString === correctLetters.join(',')) {
          marksObtained += question.marks;
        }
      }
    }

    // Calculate time taken (from creation to now)
    const now = new Date();
    const startTime = new Date(attempt.created_at);
    const timeTakenMs = now.getTime() - startTime.getTime();
    const timeTakenMinutes = Math.floor(timeTakenMs / (1000 * 60));
    const timeTakenSeconds = Math.floor((timeTakenMs % (1000 * 60)) / 1000);
    const timeFormatted = `${String(Math.floor(timeTakenMinutes / 60)).padStart(2, '0')}:${String(timeTakenMinutes % 60).padStart(2, '0')}:${String(timeTakenSeconds).padStart(2, '0')}`;

    // Update attempt with completion data
    const { data: updatedAttempt, error: updateError } = await supabase
      .from('quiz_attempt')
      .update({
        time_taken: timeFormatted,
        marks: marksObtained,
      })
      .eq('id', attempt.id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to save attempt: ${updateError.message}`);
    }

    // Calculate total possible marks
    const totalMarks = quiz.quiz_questions.reduce((sum, q) => sum + q.marks, 0);

    return {
      success: true,
      attempt: updatedAttempt,
      marksObtained,
      totalMarks,
      percentage:
        totalMarks > 0 ? Math.round((marksObtained / totalMarks) * 100) : 0,
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

  async checkAdminOrModerator(threadId: string, userId: string) {
    const supabase = this.supabaseService.getClient();

    try {
      // Get thread details to find workspace_id
      const { data: thread, error: threadError } = await supabase
        .from('threads')
        .select('workspace_id')
        .eq('id', threadId)
        .single();

      if (threadError || !thread) {
        return { success: false, error: 'Thread not found' };
      }

      const workspaceId = thread.workspace_id;

      // Check if user is workspace admin
      const { data: adminCheck } = await supabase
        .from('workspace_admins')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .single();

      if (adminCheck) {
        return {
          success: true,
          role: 'admin',
          workspaceId,
          threadId,
        };
      }

      // Check if user is thread moderator
      const { data: moderatorCheck } = await supabase
        .from('thread_moderators')
        .select('id')
        .eq('thread_id', threadId)
        .eq('user_id', userId)
        .single();

      if (moderatorCheck) {
        return {
          success: true,
          role: 'moderator',
          workspaceId,
          threadId,
        };
      }

      return {
        success: false,
        error: 'User is not an admin or moderator',
        workspaceId,
        threadId,
      };
    } catch (error) {
      console.error('Error checking admin/moderator status:', error);
      return {
        success: false,
        error: 'Failed to check permissions',
      };
    }
  }

  async getThreadResources(threadId: string) {
    const supabase = this.supabaseService.getClient();

    if (!threadId) {
      throw new Error('Thread ID is required to fetch resources');
    }

    try {
      const { data: resources, error } = await supabase
        .from('thread_resources')
        .select('id, title, resource_type, description')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch thread resources: ${error.message}`);
      }

      return resources || [];
    } catch (error) {
      console.error('Error fetching thread resources:', error);
      throw error;
    }
  }
}
