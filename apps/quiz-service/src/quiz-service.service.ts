import { Injectable } from '@nestjs/common';

@Injectable()
export class QuizServiceService {
  getHello(): string {
    return 'Hello World!';
  }
}
