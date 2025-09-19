import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { KafkaService } from '../services/kafka.service';

@Controller('query')
export class QueryController {
  constructor(private readonly kafkaService: KafkaService) {}

  @Post('get-chats')
  async getChats(@Body() body: Record<string, unknown>): Promise<unknown> {
    console.log('[QueryController] Get chats request:', body);
    console.log(this.kafkaService.getSubscribedTopics());

    try {
      const response: unknown = await this.kafkaService.sendMessage(
        'document-query.chats',
        body,
      );
      return response;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error fetching chats';
      throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('search-documents')
  async searchDocuments(
    @Body() body: Record<string, unknown>,
  ): Promise<unknown> {
    console.log('[QueryController] Search documents request:', body);

    try {
      const response: unknown = await this.kafkaService.sendMessage(
        'document-query.search-documents',
        body,
      );
      return response;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error searching documents';
      throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('get-document-summary')
  async getDocumentSummary(
    @Body() body: Record<string, unknown>,
  ): Promise<unknown> {
    console.log('[QueryController] Get document summary request:', body);

    try {
      const response: unknown = await this.kafkaService.sendMessage(
        'document-query.get-document-summary',
        body,
      );
      return response;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Error getting document summary';
      throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
