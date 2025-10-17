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

  // Helper method to format milliseconds to PostgreSQL INTERVAL format
  private formatTimeInterval(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // Method to auto-expire attempts that have passed their expiration time
  private async autoExpireAttempts(): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const now = new Date();

    // Find all incomplete attempts where expires_at is in the past
    const { data: expiredAttempts, error } = await supabase
      .from('quiz_attempt')
      .select('id, created_at, expires_at')
      .eq('completed', false)
      .lt('expires_at', now.toISOString());

    if (error) {
      console.error('Error finding expired attempts:', error);
      return;
    }

    if (expiredAttempts && expiredAttempts.length > 0) {
      console.log(`Auto-expiring ${expiredAttempts.length} attempts`);
      
      // Auto-complete each expired attempt
      for (const attempt of expiredAttempts) {
        const timeTakenMs = new Date(attempt.expires_at).getTime() - new Date(attempt.created_at).getTime();
        const timeTakenInterval = this.formatTimeInterval(timeTakenMs);
        
        await supabase
          .from('quiz_attempt')
          .update({
            time_taken: timeTakenInterval,
            marks: 0,
            completed: true,
          })
          .eq('id', attempt.id);
      }
    }
  }

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
    console.log('[createQuiz] Creating quiz with timeAllocated:', createQuizDto.timeAllocated);
    
    const insertPayload: Record<string, unknown> = {
      title: createQuizDto.title,
      description: createQuizDto.description,
      allocated_time: createQuizDto.timeAllocated || 30, // Default to 30 minutes if not provided
      creator_id: userId,
      thread_id: threadId,
    };
    
    console.log('[createQuiz] Insert payload:', insertPayload);

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
    
    console.log('[QuizService.listQuizzes] Called with threadId:', threadId, 'userId:', userId);
    console.log('[QuizService.listQuizzes] userId type:', typeof userId);
    console.log('[QuizService.listQuizzes] userId truthiness:', !!userId);
    
    if (!threadId) {
      throw new BadRequestException('Thread ID is required');
    }

    // Auto-expire any attempts that have passed their expiration time
    await this.autoExpireAttempts();

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
              const hours = parseInt(timeParts[0]) || 0;
              const minutes = parseInt(timeParts[1]) || 0;
              const seconds = parseInt(timeParts[2]) || 0;
              const totalMinutes = hours * 60 + minutes + seconds / 60;
              return sum + totalMinutes;
            }
            return sum;
          }, 0);
          averageTime = Math.round(totalTimeSum / totalAttempts); // Round to whole minutes
        }

        // Get student's attempts if userId is provided
        if (userId) {
          console.log(`[QuizService.listQuizzes] Processing attempts for userId: ${userId}`);
          console.log(`[QuizService.listQuizzes] Total attempts for quiz ${q.id}:`, attempts.length);
          const userAttempts = attempts.filter((attempt: any) => attempt.user_id === userId);
          console.log(`[QuizService.listQuizzes] User attempts filtered:`, userAttempts.length);
          if (userAttempts.length === 0) {
            console.log(`[QuizService.listQuizzes] No attempts found for user ${userId} on quiz ${q.id}`);
          }
          studentAttempts = userAttempts.map((attempt: any) => {
            let timeTaken = 0;
            if (attempt.time_taken) {
              const timeParts = attempt.time_taken.split(':');
              const hours = parseInt(timeParts[0]) || 0;
              const minutes = parseInt(timeParts[1]) || 0;
              const seconds = parseInt(timeParts[2]) || 0;
              timeTaken = Math.round(hours * 60 + minutes + seconds / 60); // Round to whole minutes
            }

            return {
              attemptNumber: attempt.attempt_nummber || 1,
              marksObtained: attempt.marks || 0,
              timeTaken: timeTaken,
              completed: attempt.marks !== null,
              date: new Date(attempt.created_at).toLocaleDateString(),
            };
          });
          console.log(`[QuizService.listQuizzes] Final studentAttempts for quiz ${q.id}:`, studentAttempts);
        } else {
          console.log(`[QuizService.listQuizzes] No userId provided, studentAttempts will be empty`);
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
    
    console.log('[startQuiz] Retrieved quiz data:', {
      id: quiz.id,
      title: quiz.title,
      allocated_time: quiz.allocated_time,
      questions_count: quiz.quiz_questions?.length || 0
    });

    // Check if user already has an incomplete attempt
    const { data: existingAttempt } = await supabase
      .from('quiz_attempt')
      .select('*')
      .eq('quiz_id', startQuizDto.quizId)
      .eq('user_id', startQuizDto.userId)
      .eq('completed', false) // Not completed yet
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingAttempt) {
      const now = new Date();
      let expiresAt: Date;
      
      // Check if expires_at exists (new schema) or calculate from created_at (legacy)
      if (existingAttempt.expires_at) {
        expiresAt = new Date(existingAttempt.expires_at);
      } else {
        // Fallback for legacy attempts without expires_at
        const createdAt = new Date(existingAttempt.created_at);
        expiresAt = new Date(createdAt.getTime() + quiz.allocated_time * 60 * 1000);
        
        // Update the attempt with expires_at for future use
        await supabase
          .from('quiz_attempt')
          .update({ expires_at: expiresAt.toISOString() })
          .eq('id', existingAttempt.id);
      }

      if (now > expiresAt) {
        // Attempt has expired, auto-complete it
        const timeTakenMs = expiresAt.getTime() - new Date(existingAttempt.created_at).getTime();
        const timeTakenInterval = this.formatTimeInterval(timeTakenMs);
        
        await supabase
          .from('quiz_attempt')
          .update({
            time_taken: timeTakenInterval,
            marks: 0,
            completed: true,
          })
          .eq('id', existingAttempt.id);

        console.log('Previous attempt expired and auto-completed, creating new attempt');
      } else {
        // Active attempt exists and hasn't expired - return resume data
        const timeRemaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));

        const timeAllocated = quiz.allocated_time || 30; // Default to 30 minutes if not set
        console.log('[startQuiz] Resuming existing attempt with timeAllocated:', timeAllocated);
        return {
          attemptId: existingAttempt.id,
          startedAt: existingAttempt.created_at,
          timeAllocated: timeAllocated,
          expiresAt: expiresAt.toISOString(),
          timeRemaining,
          isResume: true,
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
                sequence_letter: opt.sequence_letter,
              })),
            })),
          },
        };
      }
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
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to start quiz attempt: ${error.message}`);
    }

    console.log('[startQuiz] Creating new attempt with quiz allocated_time:', quiz.allocated_time);
    console.log('[startQuiz] Calculated expiresAt:', expiresAt.toISOString());
    console.log('[startQuiz] Time remaining in seconds:', quiz.allocated_time * 60);
    
    // Ensure timeAllocated is properly set
    const timeAllocated = quiz.allocated_time || 30; // Default to 30 minutes if not set
    const timeRemainingSeconds = timeAllocated * 60;
    
    return {
      attemptId: attempt.id,
      startedAt: attempt.created_at,
      timeAllocated: timeAllocated,
      expiresAt: expiresAt.toISOString(),
      timeRemaining: timeRemainingSeconds, // in seconds
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
            sequence_letter: opt.sequence_letter,
          })),
        })),
      },
    };
  }

  async getActiveAttempt(userId: string, quizId: string) {
    console.log('[getActiveAttempt] Called with userId:', userId, 'quizId:', quizId);
    const supabase = this.supabaseService.getClient();

    // Get the most recent attempt that hasn't been completed yet
    const { data: attempt, error } = await supabase
      .from('quiz_attempt')
      .select('*')
      .eq('quiz_id', quizId)
      .eq('user_id', userId)
      .eq('completed', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    console.log('[getActiveAttempt] Query result - attempt:', attempt, 'error:', error);

    if (error || !attempt) {
      console.log('[getActiveAttempt] No active attempt found or error occurred');
      throw new NotFoundException('No active attempt found');
    }

    const now = new Date();
    let expiresAt: Date;
    
    // Check if expires_at exists (new schema) or calculate from created_at (legacy)
    if (attempt.expires_at) {
      expiresAt = new Date(attempt.expires_at);
    } else {
      // Fallback for legacy attempts - get quiz and calculate expiration
      const quiz = await this.getQuiz(quizId);
      const createdAt = new Date(attempt.created_at);
      expiresAt = new Date(createdAt.getTime() + quiz.allocated_time * 60 * 1000);
      
      // Update the attempt with expires_at for future use
      await supabase
        .from('quiz_attempt')
        .update({ expires_at: expiresAt.toISOString() })
        .eq('id', attempt.id);
    }

    // Check if attempt has expired
    if (now > expiresAt) {
      // Attempt has expired, auto-complete it
      const timeTakenMs = expiresAt.getTime() - new Date(attempt.created_at).getTime();
      const timeTakenInterval = this.formatTimeInterval(timeTakenMs);
      
      await supabase
        .from('quiz_attempt')
        .update({
          time_taken: timeTakenInterval,
          marks: 0,
          completed: true,
        })
        .eq('id', attempt.id);
        
      throw new NotFoundException('Active attempt has expired and was auto-submitted');
    }

    // Calculate remaining time
    const timeRemaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));

    // Get quiz details for resume
    const quiz = await this.getQuiz(quizId);

    return {
      attemptId: attempt.id,
      startedAt: attempt.created_at,
      expiresAt: expiresAt.toISOString(),
      timeRemaining,
      timeAllocated: quiz.allocated_time,
      status: 'active',
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
            sequence_letter: opt.sequence_letter,
          })),
        })),
      },
    };
  }

  async attemptQuiz(attemptQuizDto: AttemptQuizDto) {
    const supabase = this.supabaseService.getClient();

    console.log('[attemptQuiz] Starting attempt submission:', attemptQuizDto);

    // Get the attempt
    const { data: attempt, error: attemptError } = await supabase
      .from('quiz_attempt')
      .select('*')
      .eq('id', attemptQuizDto.attemptId)
      .single();

    if (attemptError) {
      console.error('[attemptQuiz] Error fetching attempt:', attemptError);
      throw new BadRequestException(`Database error fetching attempt: ${attemptError.message}`);
    }

    if (!attempt) {
      console.error('[attemptQuiz] Attempt not found for ID:', attemptQuizDto.attemptId);
      throw new BadRequestException('Invalid attempt ID');
    }

    console.log('[attemptQuiz] Found attempt:', {
      id: attempt.id,
      quiz_id: attempt.quiz_id,
      user_id: attempt.user_id,
      completed: attempt.completed,
      created_at: attempt.created_at,
      expires_at: attempt.expires_at
    });

    // Check if already completed
    if (attempt.completed) {
      console.log('[attemptQuiz] Attempt already completed');
      throw new BadRequestException('Quiz attempt already completed');
    }

    const currentTime = new Date();
    let expiresAt: Date;
    
    // Check expiration time
    if (attempt.expires_at) {
      expiresAt = new Date(attempt.expires_at);
      console.log('[attemptQuiz] Using expires_at from attempt:', expiresAt);
    } else {
      // Fallback for legacy attempts
      console.log('[attemptQuiz] No expires_at, calculating from created_at');
      const quiz = await this.getQuiz(attempt.quiz_id);
      const createdAt = new Date(attempt.created_at);
      expiresAt = new Date(createdAt.getTime() + (quiz.allocated_time || 30) * 60 * 1000);
      console.log('[attemptQuiz] Calculated expires_at:', expiresAt);
    }

    console.log('[attemptQuiz] Time check - Current:', currentTime, 'Expires:', expiresAt, 'Expired:', currentTime > expiresAt);

    // Check if attempt has expired
    if (currentTime > expiresAt) {
      console.log('[attemptQuiz] Attempt has expired, auto-completing');
      // Auto-complete expired attempt with 0 marks
      const timeTakenMs = expiresAt.getTime() - new Date(attempt.created_at).getTime();
      const timeTakenInterval = this.formatTimeInterval(timeTakenMs);
      
      await supabase
        .from('quiz_attempt')
        .update({
          time_taken: timeTakenInterval,
          marks: 0,
          completed: true,
        })
        .eq('id', attempt.id);
        
      throw new BadRequestException('Quiz attempt has expired and was auto-submitted with 0 marks');
    }

    // Get quiz to calculate marks
    console.log('[attemptQuiz] Fetching quiz data for quiz_id:', attempt.quiz_id);
    const quiz = await this.getQuiz(attempt.quiz_id);
    
    if (!quiz) {
      console.error('[attemptQuiz] Quiz not found for ID:', attempt.quiz_id);
      throw new BadRequestException('Quiz not found');
    }
    
    console.log('[attemptQuiz] Quiz loaded successfully, questions:', quiz.quiz_questions?.length || 0);
    let marksObtained = 0;

    // Insert user answers and calculate marks
    console.log('[attemptQuiz] Processing answers:', attemptQuizDto.answers);
    console.log('[attemptQuiz] Quiz questions structure:', JSON.stringify(quiz.quiz_questions, null, 2));
    
    for (const answer of attemptQuizDto.answers) {
      console.log('[attemptQuiz] Processing answer:', answer);
      
      const question = quiz.quiz_questions.find(
        (q) => q.id === answer.questionId,
      );

      if (question) {
        console.log('[attemptQuiz] Found question:', question.id);
        console.log('[attemptQuiz] Question options:', question.quiz_options);
        
        // Convert selected option IDs to sequence letters for storage
        const selectedLetters: string[] = [];
        for (const optionId of answer.selectedOptionIds) {
          console.log('[attemptQuiz] Looking for option ID:', optionId);
          const option = question.quiz_options.find(
            (opt) => opt.id === optionId,
          );
          console.log('[attemptQuiz] Found option:', option);
          if (option && option.sequence_letter) {
            selectedLetters.push(option.sequence_letter);
            console.log('[attemptQuiz] Added sequence letter:', option.sequence_letter);
          }
        }

        // Store answer in user_answer table
        const answerString = selectedLetters.sort().join(',');
        console.log('[attemptQuiz] Answer string for storage:', answerString);
        
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
          .filter(letter => letter) // Filter out null/undefined letters
          .sort();

        console.log('[attemptQuiz] Correct letters:', correctLetters);
        console.log('[attemptQuiz] Selected letters:', selectedLetters.sort());
        console.log('[attemptQuiz] User answer string:', answerString);
        console.log('[attemptQuiz] Expected correct answer:', correctLetters.join(','));

        // Compare sorted arrays directly to handle empty cases properly
        const userAnswerSorted = selectedLetters.sort();
        const isCorrect = userAnswerSorted.length === correctLetters.length &&
                         userAnswerSorted.every((letter, index) => letter === correctLetters[index]);

        if (isCorrect) {
          marksObtained += question.marks;
          console.log('[attemptQuiz] ✅ Correct answer! Added', question.marks, 'marks. Total:', marksObtained);
        } else {
          console.log('[attemptQuiz] ❌ Wrong answer. Expected:', correctLetters, 'Got:', userAnswerSorted);
        }
      } else {
        console.log('[attemptQuiz] ⚠️ Question not found for ID:', answer.questionId);
      }
    }

    // Calculate time taken (from creation to submission)
    const submissionTime = new Date();
    const startTime = new Date(attempt.created_at);
    const timeTakenMs = submissionTime.getTime() - startTime.getTime();
    const timeFormatted = this.formatTimeInterval(timeTakenMs);

    // Update attempt with completion data
    const { data: updatedAttempt, error: updateError } = await supabase
      .from('quiz_attempt')
      .update({
        time_taken: timeFormatted,
        marks: marksObtained,
        completed: true,
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

    // Get attempts with user answers
    const { data: attempts, error } = await supabase
      .from('quiz_attempt')
      .select(`
        *,
        user_answer (
          question_id,
          answer
        )
      `)
      .eq('quiz_id', quizId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch results: ${error.message}`);
    }

    // Get quiz details to convert sequence letters back to option IDs
    const quiz = await this.getQuiz(quizId);

    // Transform the data to group answers by attempt
    const transformedAttempts = (attempts || []).map((attempt: any) => {
      // Group user answers by question for this attempt
      const answersByQuestion: { [questionId: string]: string[] } = {};
      
      if (attempt.user_answer && Array.isArray(attempt.user_answer)) {
        attempt.user_answer.forEach((userAnswer: any) => {
          const questionId = userAnswer.question_id;
          const answerLetters = userAnswer.answer; // This is sequence letters like 'a,b'
          
          if (answerLetters) {
            // Find the question in quiz data
            const question = quiz.quiz_questions?.find(q => q.id === questionId);
            if (question) {
              // Convert sequence letters back to option IDs
              const letters = answerLetters.split(',');
              const selectedOptionIds = letters.map(letter => {
                const option = question.quiz_options?.find(opt => opt.sequence_letter === letter);
                return option?.id;
              }).filter(Boolean); // Remove any undefined values
              
              answersByQuestion[questionId] = selectedOptionIds;
            }
          }
        });
      }
      
      // Convert to the format expected by frontend
      const answers = Object.entries(answersByQuestion).map(([questionId, selectedOptionIds]) => ({
        questionId,
        selectedOptionIds
      }));

      return {
        id: attempt.id,
        attemptNumber: attempt.attempt_nummber,
        marksObtained: attempt.marks || 0,
        totalMarks: quiz.quiz_questions?.reduce((sum, q) => sum + q.marks, 0) || 0,
        timeTaken: attempt.time_taken || '00:00:00',
        completed: attempt.completed,
        created_at: attempt.created_at,
        answers,
      };
    });

    return transformedAttempts;
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
