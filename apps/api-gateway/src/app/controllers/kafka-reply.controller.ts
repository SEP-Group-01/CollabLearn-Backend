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

  @MessagePattern('study-plan-requests.reply')
  handleStudyPlanRequestsReply(@Payload() message: any, @Ctx() context: KafkaContext) {
    console.log('[KafkaReplyController] Received study plan requests reply:', message);
    this.kafkaService.handleReply('study-plan-requests.reply', message, context);
  }

  @MessagePattern('study-plan-slots.reply')
  handleStudyPlanSlotsReply(@Payload() message: any, @Ctx() context: KafkaContext) {
    console.log('[KafkaReplyController] Received study plan slots reply:', message);
    this.kafkaService.handleReply('study-plan-slots.reply', message, context);
  }

  @MessagePattern('study-plan-tasks.reply')
  handleStudyPlanTasksReply(@Payload() message: any, @Ctx() context: KafkaContext) {
    console.log('[KafkaReplyController] Received study plan tasks reply:', message);
    this.kafkaService.handleReply('study-plan-tasks.reply', message, context);
  }

  @MessagePattern('study-plan-analysis.reply')
  handleStudyPlanAnalysisReply(@Payload() message: any, @Ctx() context: KafkaContext) {
    console.log('[KafkaReplyController] Received study plan analysis reply:', message);
    this.kafkaService.handleReply('study-plan-analysis.reply', message, context);
  }

  @MessagePattern('study-plan-workspaces.reply')
  handleStudyPlanWorkspacesReply(@Payload() message: any, @Ctx() context: KafkaContext) {
    console.log('[KafkaReplyController] Received study plan workspaces reply:', message);
    this.kafkaService.handleReply('study-plan-workspaces.reply', message, context);
  }

  @MessagePattern('document-query.query-documents.reply')
  handleQueryDocumentsReply(@Payload() message: any, @Ctx() context: KafkaContext) {
    console.log('[KafkaReplyController] Received query documents reply:', message);
    this.kafkaService.handleReply('document-query.query-documents.reply', message, context);
  }

  @MessagePattern('document-query.get-conversations.reply')
  handleGetConversationsReply(@Payload() message: any, @Ctx() context: KafkaContext) {
    console.log('[KafkaReplyController] Received get conversations reply:', message);
    this.kafkaService.handleReply('document-query.get-conversations.reply', message, context);
  }

  @MessagePattern('document-query.get-conversation-messages.reply')
  handleGetConversationMessagesReply(@Payload() message: any, @Ctx() context: KafkaContext) {
    console.log('[KafkaReplyController] Received get conversation messages reply:', message);
    this.kafkaService.handleReply('document-query.get-conversation-messages.reply', message, context);
  }

  @MessagePattern('document-query.create-conversation.reply')
  handleCreateConversationReply(@Payload() message: any, @Ctx() context: KafkaContext) {
    console.log('[KafkaReplyController] Received create conversation reply:', message);
    this.kafkaService.handleReply('document-query.create-conversation.reply', message, context);
  }
}