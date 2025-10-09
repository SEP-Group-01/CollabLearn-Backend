import { Controller, Post, Get, Put, Delete, Param, Body, UploadedFile, UseInterceptors, Res, HttpStatus, Inject, Headers, HttpException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClientProxy } from '@nestjs/microservices';
import { Response } from 'express';
import { firstValueFrom, timeout } from 'rxjs';

@Controller('documents')
export class DocumentEditorController {
  constructor(
    @Inject('DOCUMENT_EDITOR_SERVICE')
    private readonly documentEditorService: ClientProxy,
    @Inject('AUTH_SERVICE') 
    private readonly authService: ClientProxy,
    @Inject('WORKSPACES_SERVICE')
    private readonly workspacesService: ClientProxy,
  ) {}

  // Helper method to validate token
  private async validateAuthToken(authHeader: string) {
    if (!authHeader) {
      throw new HttpException(
        'Authorization header is required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    try {
      return await firstValueFrom(
        this.authService.send({ cmd: 'validate_token' }, { token }),
      );
    } catch (error) {
      throw new HttpException(
        'Invalid or expired token',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  // Basic CRUD operations
  @Get(':documentId')
  async getDocument(
    @Param('documentId') documentId: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      // Validate token and get user information
      const tokenValidation = await this.validateAuthToken(authHeader);
      const userId = tokenValidation.user?.id || tokenValidation.user?.userId;

      if (!userId) {
        throw new HttpException(
          'User ID not found in token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      console.log('🔍 [Gateway] Getting document:', documentId, 'for user:', userId);

      // Get document from service
      const result = await this.documentEditorService.send('document.get', { 
        documentId,
        userId // Pass userId for permission checking
      }).toPromise();

      console.log('✅ [Gateway] Document retrieved successfully:', documentId);
      return result;
    } catch (error) {
      console.error('❌ [Gateway] Error getting document:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to get document',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post()
  async createDocument(
    @Body() data: any,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      console.log('📝 [Gateway] Creating document with data:', { 
        title: data.title, 
        threadId: data.threadId,
        hasContent: !!data.content 
      });

      // Validate token and get user information
      const tokenValidation = await this.validateAuthToken(authHeader);
      const userId = tokenValidation.user?.id || tokenValidation.user?.userId;

      if (!userId) {
        throw new HttpException(
          'Unable to extract user ID from token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      if (!data.threadId) {
        throw new HttpException(
          'Thread ID is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!data.title || data.title.trim().length === 0) {
        throw new HttpException(
          'Document title is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      console.log('🔍 [Gateway] Checking admin/moderator permissions for user:', userId, 'thread:', data.threadId);

      // Check if user is admin or moderator for this thread
      const permissionCheck = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'check-admin-or-moderator' },
          { threadId: data.threadId, userId }
        ).pipe(timeout(10000))
      );

      if (!permissionCheck.isAdminOrModerator) {
        throw new HttpException(
          'Only admins and moderators can create documents',
          HttpStatus.FORBIDDEN,
        );
      }

      console.log('✅ [Gateway] Permission check passed, creating document');

      // Prepare document data for the service
      const documentData = {
        title: data.title.trim(),
        content: data.content || '',
        threadId: data.threadId,
        userId: userId,
        isPublic: data.isPublic || false,
      };

      // Send to document service
      const result = await this.documentEditorService.send('document.create', documentData).toPromise();

      console.log('✅ [Gateway] Document created successfully:', result.id);

      return result;
    } catch (error) {
      console.error('❌ [Gateway] Error creating document:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        `Error creating document: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':documentId')
  async updateDocument(@Param('documentId') documentId: string, @Body() data: any) {
    return this.documentEditorService.send('document.update', { ...data, documentId }).toPromise();
  }

  @Delete(':documentId')
  async deleteDocument(@Param('documentId') documentId: string) {
    return this.documentEditorService.send('document.delete', { documentId }).toPromise();
  }

  // Version Control
  @Post(':documentId/versions')
  async saveVersion(@Param('documentId') documentId: string, @Body() data: any) {
    return this.documentEditorService.send('document.version.save', { 
      documentId, 
      ...data 
    }).toPromise();
  }

  @Get(':documentId/versions')
  async getVersionHistory(@Param('documentId') documentId: string) {
    return this.documentEditorService.send('document.version.history', { documentId }).toPromise();
  }

  @Post(':documentId/versions/:versionId/restore')
  async restoreVersion(
    @Param('documentId') documentId: string,
    @Param('versionId') versionId: string,
    @Body() data: any
  ) {
    return this.documentEditorService.send('document.version.restore', {
      documentId,
      versionId,
      ...data
    }).toPromise();
  }

  // Permissions
  @Get(':documentId/permissions')
  async getPermissions(@Param('documentId') documentId: string) {
    return this.documentEditorService.send('document.permission.get', { documentId }).toPromise();
  }

  @Put(':documentId/permissions')
  async updatePermissions(@Param('documentId') documentId: string, @Body() data: any) {
    return this.documentEditorService.send('document.permission.set', {
      documentId,
      ...data
    }).toPromise();
  }

  @Post(':documentId/permissions/check')
  async checkPermission(@Param('documentId') documentId: string, @Body() data: any) {
    return this.documentEditorService.send('document.permission.check', {
      documentId,
      ...data
    }).toPromise();
  }

  // Export
  @Post(':documentId/export/:format')
  async exportDocument(
    @Param('documentId') documentId: string,
    @Param('format') format: 'pdf' | 'docx' | 'html',
    @Body() data: any,
    @Res() res: Response
  ) {
    try {
      const exportResult = await this.documentEditorService.send('document.export', {
        documentId,
        format,
        ...data
      }).toPromise();

      const buffer = Buffer.from(exportResult);
      
      // Set appropriate headers
      const mimeTypes = {
        pdf: 'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        html: 'text/html'
      };

      res.setHeader('Content-Type', mimeTypes[format]);
      res.setHeader('Content-Disposition', `attachment; filename="document.${format}"`);
      res.setHeader('Content-Length', buffer.length);
      
      res.send(buffer);
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Export failed',
        error: error.message
      });
    }
  }

  @Post(':documentId/backup')
  async createBackup(
    @Param('documentId') documentId: string,
    @Res() res: Response
  ) {
    try {
      const backupResult = await this.documentEditorService.send('document.backup', {
        documentId
      }).toPromise();

      const buffer = Buffer.from(backupResult);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="document-backup-${documentId}.zip"`);
      res.setHeader('Content-Length', buffer.length);
      
      res.send(buffer);
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Backup creation failed',
        error: error.message
      });
    }
  }

  // Media Management
  @Post(':documentId/media')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMedia(
    @Param('documentId') documentId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() data: any
  ) {
    return this.documentEditorService.send('document.media.upload', {
      file,
      documentId,
      ...data
    }).toPromise();
  }

  @Get(':documentId/media')
  async getDocumentMedia(@Param('documentId') documentId: string) {
    return this.documentEditorService.send('document.media.list', { documentId }).toPromise();
  }

  @Delete('media/:fileId')
  async deleteMedia(@Param('fileId') fileId: string, @Body() data: any) {
    return this.documentEditorService.send('document.media.delete', {
      fileId,
      ...data
    }).toPromise();
  }

  // Collaboration
  @Post(':documentId/join')
  async joinDocument(@Param('documentId') documentId: string, @Body() data: any) {
    return this.documentEditorService.send('document.join', {
      documentId,
      ...data
    }).toPromise();
  }

  @Post(':documentId/leave')
  async leaveDocument(@Param('documentId') documentId: string, @Body() data: any) {
    return this.documentEditorService.send('document.leave', {
      documentId,
      ...data
    }).toPromise();
  }

  @Get(':documentId/collaborators')
  async getCollaborators(@Param('documentId') documentId: string) {
    return this.documentEditorService.send('document.collaborators', { documentId }).toPromise();
  }

  @Post(':documentId/share')
  async shareDocument(@Param('documentId') documentId: string, @Body() data: any) {
    return this.documentEditorService.send('document.share', {
      documentId,
      ...data
    }).toPromise();
  }

  // Get documents by thread ID
  @Get('thread/:threadId')
  async getDocumentsByThread(
    @Param('threadId') threadId: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      // Validate token and get user information
      const user = await this.validateAuthToken(authHeader);

      // Get documents for the thread with user permission info
      const result = await firstValueFrom(
        this.documentEditorService.send('document.getByThread', {
          threadId,
          userId: user.id
        }).pipe(timeout(10000))
      );

      return result;
    } catch (error) {
      console.error('Error fetching documents by thread:', error);
      throw new HttpException(
        error.message || 'Failed to fetch documents',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}