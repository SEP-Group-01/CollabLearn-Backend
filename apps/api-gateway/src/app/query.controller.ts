import { Controller, Inject, Post, Get, Query, Body, HttpException, HttpStatus, OnModuleInit} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

@Controller('query')
export class QueryController implements OnModuleInit {
    constructor(@Inject('QUERY_SERVICE') private readonly kafkaClient: ClientKafka,) {}

    async onModuleInit() {
    // Subscribe to response topics (for request-response)
    this.kafkaClient.subscribeToResponseOf('document-query');
    await this.kafkaClient.connect();
    }

    @Post('get-chats')
    async getChats(@Body() body: any) {
        try {
            const response = await this.kafkaClient
            .send('document-query.get-chats', body)
            .toPromise();
            return response;
        } catch (error) {
            throw new HttpException(
                error?.message || 'Error fetching chats',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}