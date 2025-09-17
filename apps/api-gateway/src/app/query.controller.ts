import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { KafkaService } from './kafka.service';

@Controller('query')
export class QueryController {
  constructor(private readonly kafkaService: KafkaService) {}

  @Post('get-chats')
  async getChats(@Body() body: any) {
    console.log('[QueryController] Get chats request:', body);

    try {
      const response = await this.kafkaService.sendMessage(
        'document-query.get-chats',
        body,
      );
      return response;
    } catch (error) {
      throw new HttpException(
        error?.message || 'Error fetching chats',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('search-documents')
  async searchDocuments(@Body() body: any) {
    console.log('[QueryController] Search documents request:', body);

    try {
      const response = await this.kafkaService.sendMessage(
        'document-query.search-documents',
        body,
      );
      return response;
    } catch (error) {
      throw new HttpException(
        error?.message || 'Error searching documents',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('get-document-summary')
  async getDocumentSummary(@Body() body: any) {
    console.log('[QueryController] Get document summary request:', body);

    try {
      const response = await this.kafkaService.sendMessage(
        'document-query.get-document-summary',
        body,
      );
      return response;
    } catch (error) {
      throw new HttpException(
        error?.message || 'Error getting document summary',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
