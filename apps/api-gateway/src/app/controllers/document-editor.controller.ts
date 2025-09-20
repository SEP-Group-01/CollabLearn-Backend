import { Controller, Get, Post, Put, Delete, Body, Param, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Controller('documents')
export class DocumentEditorController {
  constructor(
    @Inject('DOCUMENT_EDITOR_SERVICE')
    private readonly documentEditorService: ClientProxy,
  ) {}

  @Get(':id')
  async getDocument(@Param('id') documentId: string) {
    return this.documentEditorService.send('document.get', { documentId });
  }

  @Post()
  async createDocument(@Body() createDocumentDto: any) {
    return this.documentEditorService.send('document.create', createDocumentDto);
  }

  @Put(':id')
  async updateDocument(@Param('id') documentId: string, @Body() updateDocumentDto: any) {
    return this.documentEditorService.send('document.update', {
      documentId,
      ...updateDocumentDto,
    });
  }

  @Delete(':id')
  async deleteDocument(@Param('id') documentId: string) {
    return this.documentEditorService.send('document.delete', { documentId });
  }

  @Get(':id/collaborators')
  async getCollaborators(@Param('id') documentId: string) {
    return this.documentEditorService.send('document.collaborators', { documentId });
  }

  @Post(':id/share')
  async shareDocument(@Param('id') documentId: string, @Body() shareDto: any) {
    return this.documentEditorService.send('document.share', {
      documentId,
      ...shareDto,
    });
  }
}