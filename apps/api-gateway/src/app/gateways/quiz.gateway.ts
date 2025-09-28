import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, Inject } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

interface JoinQuizAttemptData {
  attemptId: string;
  userId: string;
  quizId: string;
}

interface LeaveQuizAttemptData {
  attemptId: string;
  userId: string;
}

interface SubmitAnswerData {
  attemptId: string;
  userId: string;
  questionId: string;
  selectedOptions: string[];
}

interface SubmitQuizData {
  attemptId: string;
  userId: string;
}

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://collab-learn-frontend.vercel.app',
    ],
    credentials: true,
  },
  namespace: '/quiz',
})
export class QuizGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(QuizGateway.name);
  private userSockets = new Map<string, Socket>();
  private attemptClients = new Map<string, Set<Socket>>();
  private activeAttempts = new Map<string, NodeJS.Timeout>();

  constructor(
    @Inject('QUIZ_SERVICE')
    private readonly quizService: ClientProxy,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Quiz client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Quiz client disconnected: ${client.id}`);

    // Clean up client from all attempt rooms
    this.attemptClients.forEach((clients, attemptId) => {
      clients.delete(client);
      if (clients.size === 0) {
        this.attemptClients.delete(attemptId);
        this.clearAttemptTimer(attemptId);
      }
    });

    // Remove from user socket mapping
    for (const [userId, socket] of this.userSockets.entries()) {
      if (socket === client) {
        this.userSockets.delete(userId);
        break;
      }
    }
  }

  private addClientToAttempt(attemptId: string, client: Socket) {
    if (!this.attemptClients.has(attemptId)) {
      this.attemptClients.set(attemptId, new Set());
    }
    this.attemptClients.get(attemptId)!.add(client);
  }

  private removeClientFromAttempt(attemptId: string, client: Socket) {
    if (this.attemptClients.has(attemptId)) {
      this.attemptClients.get(attemptId)!.delete(client);
      if (this.attemptClients.get(attemptId)!.size === 0) {
        this.attemptClients.delete(attemptId);
        this.clearAttemptTimer(attemptId);
      }
    }
  }

  private broadcastToAttempt(
    attemptId: string,
    event: string,
    data: any,
    excludeClient?: Socket,
  ) {
    const clients = this.attemptClients.get(attemptId);
    if (clients) {
      clients.forEach((client) => {
        if (client !== excludeClient) {
          try {
            client.emit(event, data);
          } catch (error) {
            this.logger.error(`Error broadcasting to client:`, error);
          }
        }
      });
    }
  }

  // User joins a quiz attempt
  @SubscribeMessage('join-quiz-attempt')
  async handleJoinQuizAttempt(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinQuizAttemptData,
  ) {
    try {
      this.logger.log(
        `User ${data.userId} joining quiz attempt ${data.attemptId}`,
      );

      // Store user socket mapping
      this.userSockets.set(data.userId, client);

      // Add client to attempt room
      this.addClientToAttempt(data.attemptId, client);

      // Get current attempt status from quiz service
      const activeAttempt = await firstValueFrom(
        this.quizService.send(
          { cmd: 'get_active_attempt' },
          { userId: data.userId, quizId: data.quizId },
        ),
      );

      if (activeAttempt && activeAttempt.timeRemaining > 0) {
        // Send current time remaining
        client.emit('time-update', {
          attemptId: data.attemptId,
          timeRemaining: activeAttempt.timeRemaining,
        });

        // Start/resume timer for this attempt
        this.startAttemptTimer(
          data.attemptId,
          activeAttempt.timeRemaining,
          data.userId,
        );
      }

      client.emit('quiz-attempt-joined', {
        attemptId: data.attemptId,
        quizId: data.quizId,
        userId: data.userId,
      });
    } catch (error) {
      this.logger.error('Error joining quiz attempt:', error);
      client.emit('error', { message: 'Failed to join quiz attempt' });
    }
  }

  // User leaves a quiz attempt
  @SubscribeMessage('leave-quiz-attempt')
  async handleLeaveQuizAttempt(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LeaveQuizAttemptData,
  ) {
    try {
      this.logger.log(
        `User ${data.userId} leaving quiz attempt ${data.attemptId}`,
      );

      this.removeClientFromAttempt(data.attemptId, client);

      client.emit('quiz-attempt-left', {
        attemptId: data.attemptId,
        userId: data.userId,
      });
    } catch (error) {
      this.logger.error('Error leaving quiz attempt:', error);
      client.emit('error', { message: 'Failed to leave quiz attempt' });
    }
  }

  // Handle quiz answer submission
  @SubscribeMessage('submit-answer')
  async handleSubmitAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SubmitAnswerData,
  ) {
    try {
      this.logger.log(
        `Answer submitted for attempt ${data.attemptId}, question ${data.questionId}`,
      );

      // Forward to quiz service for processing
      const result = await firstValueFrom(
        this.quizService.send({ cmd: 'submit_answer' }, data),
      );

      if (result.success) {
        client.emit('answer-submitted', {
          attemptId: data.attemptId,
          questionId: data.questionId,
          success: true,
        });
      } else {
        throw new Error(result.error || 'Failed to submit answer');
      }
    } catch (error) {
      this.logger.error('Error submitting answer:', error);
      client.emit('error', { message: 'Failed to submit answer' });
    }
  }

  // Handle quiz submission
  @SubscribeMessage('submit-quiz')
  async handleSubmitQuiz(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SubmitQuizData,
  ) {
    try {
      this.logger.log(`Quiz submitted for attempt ${data.attemptId}`);

      // Clear the timer for this attempt
      this.clearAttemptTimer(data.attemptId);

      // Forward to quiz service for processing
      const result = await firstValueFrom(
        this.quizService.send({ cmd: 'submit_quiz' }, data),
      );

      if (result.success) {
        // Broadcast to all clients in the attempt
        this.broadcastToAttempt(data.attemptId, 'quiz-submitted', {
          attemptId: data.attemptId,
          success: true,
          message: 'Quiz submitted successfully',
          results: result.data,
        });
      } else {
        throw new Error(result.error || 'Failed to submit quiz');
      }
    } catch (error) {
      this.logger.error('Error submitting quiz:', error);
      client.emit('error', { message: 'Failed to submit quiz' });
    }
  }

  // Timer management methods
  private startAttemptTimer(
    attemptId: string,
    timeRemaining: number,
    userId: string,
  ) {
    // Clear existing timer if any
    this.clearAttemptTimer(attemptId);

    let remainingSeconds = timeRemaining;

    const timer = setInterval(() => {
      remainingSeconds -= 1;

      // Broadcast time update to all clients in the attempt
      this.broadcastToAttempt(attemptId, 'time-update', {
        attemptId,
        timeRemaining: remainingSeconds,
      });

      // Warning notifications
      if (remainingSeconds === 300) {
        // 5 minutes remaining
        this.broadcastToAttempt(attemptId, 'time-warning', {
          attemptId,
          message: '5 minutes remaining!',
          timeRemaining: remainingSeconds,
        });
      } else if (remainingSeconds === 60) {
        // 1 minute remaining
        this.broadcastToAttempt(attemptId, 'time-warning', {
          attemptId,
          message: '1 minute remaining!',
          timeRemaining: remainingSeconds,
        });
      } else if (remainingSeconds <= 10 && remainingSeconds > 0) {
        // Final countdown
        this.broadcastToAttempt(attemptId, 'time-critical', {
          attemptId,
          message: `${remainingSeconds} seconds remaining!`,
          timeRemaining: remainingSeconds,
        });
      }

      // Time's up - auto submit
      if (remainingSeconds <= 0) {
        this.broadcastToAttempt(attemptId, 'time-expired', {
          attemptId,
          message: 'Time is up! Quiz will be auto-submitted.',
        });

        // Auto-submit the quiz
        void this.autoSubmitQuiz(attemptId, userId);
        this.clearAttemptTimer(attemptId);
      }
    }, 1000);

    this.activeAttempts.set(attemptId, timer);
  }

  private clearAttemptTimer(attemptId: string) {
    const timer = this.activeAttempts.get(attemptId);
    if (timer) {
      clearInterval(timer);
      this.activeAttempts.delete(attemptId);
    }
  }

  private async autoSubmitQuiz(attemptId: string, userId: string) {
    try {
      this.logger.log(`Auto-submitting quiz for attempt ${attemptId}`);

      // Call quiz service to auto-submit
      const result = await firstValueFrom(
        this.quizService.send(
          { cmd: 'auto_submit_quiz' },
          { attemptId, userId },
        ),
      );

      // Broadcast auto-submission to all clients in the attempt
      this.broadcastToAttempt(attemptId, 'quiz-auto-submitted', {
        attemptId,
        message: 'Quiz has been automatically submitted due to time expiry',
        results: result.success ? result.data : null,
      });
    } catch (error) {
      this.logger.error('Error auto-submitting quiz:', error);
    }
  }

  // Method to send notifications to specific users
  sendNotificationToUser(userId: string, notification: any) {
    const socket = this.userSockets.get(userId);
    if (socket) {
      socket.emit('quiz-notification', notification);
    }
  }

  // Method to broadcast quiz updates to all participants
  broadcastQuizUpdate(quizId: string, update: any) {
    this.server.emit('quiz-updated', {
      quizId,
      ...update,
    });
  }

  // Clean up on module destroy
  onModuleDestroy() {
    // Clear all active timers
    this.activeAttempts.forEach((timer) => {
      clearInterval(timer);
    });
    this.activeAttempts.clear();
  }
}
