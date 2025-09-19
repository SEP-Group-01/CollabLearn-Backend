import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import { KafkaService } from '../services/kafka.service';

@Controller()
export class KafkaReplyController {
  constructor(private readonly kafkaService: KafkaService) {}

  /**
   * Message pattern handlers for reply topics
   */
  @MessagePattern('document-query.chats.reply')
  handleChatsReply(@Payload() message: any, @Ctx() context: KafkaContext) {
    console.log('[KafkaReplyController] Received chats reply:', message);
    this.kafkaService.handleReply('document-query.chats.reply', message, context);
  }

  @MessagePattern('document-query.search-documents.reply')
  handleSearchDocumentsReply(@Payload() message: any, @Ctx() context: KafkaContext) {
    console.log('[KafkaReplyController] Received search documents reply:', message);
    this.kafkaService.handleReply('document-query.search-documents.reply', message, context);
  }

  @MessagePattern('document-query.get-document-summary.reply')
  handleDocumentSummaryReply(@Payload() message: any, @Ctx() context: KafkaContext) {
    console.log('[KafkaReplyController] Received document summary reply:', message);
    this.kafkaService.handleReply('document-query.get-document-summary.reply', message, context);
  }

  @MessagePattern('document-query.documents.reply')
  handleDocumentsReply(@Payload() message: any, @Ctx() context: KafkaContext) {
    console.log('[KafkaReplyController] Received documents reply:', message);
    this.kafkaService.handleReply('document-query.documents.reply', message, context);
  }
}