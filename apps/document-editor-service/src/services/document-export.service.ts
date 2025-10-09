import { Injectable, Logger } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as archiver from 'archiver';

export interface ExportOptions {
  format: 'pdf' | 'docx' | 'html';
  includeMetadata?: boolean;
  includeVersionHistory?: boolean;
}

@Injectable()
export class DocumentExportService {
  private readonly logger = new Logger(DocumentExportService.name);

  async exportDocument(
    documentId: string,
    content: string,
    options: ExportOptions
  ): Promise<Buffer> {
    this.logger.log(`Exporting document ${documentId} as ${options.format}`);

    switch (options.format) {
      case 'pdf':
        return await this.exportToPDF(content, options);
      case 'docx':
        return await this.exportToDocx(content, options);
      case 'html':
        return await this.exportToHTML(content, options);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  private async exportToPDF(content: string, options: ExportOptions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument();
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Add metadata if requested
        if (options.includeMetadata) {
          doc.info.Title = 'Collaborative Document';
          doc.info.Author = 'CollabLearn';
          doc.info.Subject = 'Document Export';
          doc.info.CreationDate = new Date();
        }

        // Convert HTML content to plain text for PDF
        const plainText = this.htmlToPlainText(content);
        
        // Add content
        doc.fontSize(12);
        doc.text(plainText, {
          width: 500,
          align: 'left'
        });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private async exportToDocx(content: string, options: ExportOptions): Promise<Buffer> {
    // For a production implementation, you would use libraries like 'docx' or 'officegen'
    // This is a simplified implementation
    
    const docxTemplate = `
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>${this.htmlToPlainText(content)}</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;

    return Buffer.from(docxTemplate, 'utf-8');
  }

  private async exportToHTML(content: string, options: ExportOptions): Promise<Buffer> {
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Collaborative Document</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #fff;
        }
        h1, h2, h3 { color: #333; }
        img { max-width: 100%; height: auto; }
        .metadata {
            background-color: #f5f5f5;
            padding: 10px;
            border-left: 4px solid #007cba;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    ${options.includeMetadata ? `
    <div class="metadata">
        <h3>Document Information</h3>
        <p><strong>Exported:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Source:</strong> CollabLearn Collaborative Editor</p>
    </div>
    ` : ''}
    
    <div class="document-content">
        ${content}
    </div>
</body>
</html>`;

    return Buffer.from(htmlTemplate, 'utf-8');
  }

  private htmlToPlainText(html: string): string {
    // Simple HTML to plain text conversion
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  async createBackup(
    documentId: string,
    content: string,
    versions: any[],
    permissions: any[],
    auditLog: any[]
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const archive = archiver('zip', { zlib: { level: 9 } });
        const chunks: Buffer[] = [];

        archive.on('data', (chunk) => chunks.push(chunk));
        archive.on('end', () => resolve(Buffer.concat(chunks)));
        archive.on('error', (err) => reject(err));

        // Add current content
        archive.append(content, { name: 'current-content.html' });

        // Add metadata
        const metadata = {
          documentId,
          exportedAt: new Date().toISOString(),
          versionCount: versions.length,
          collaboratorCount: permissions.length,
          auditLogEntries: auditLog.length,
        };
        archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

        // Add version history
        if (versions.length > 0) {
          archive.append(JSON.stringify(versions, null, 2), { name: 'version-history.json' });
        }

        // Add permissions
        if (permissions.length > 0) {
          archive.append(JSON.stringify(permissions, null, 2), { name: 'permissions.json' });
        }

        // Add audit log
        if (auditLog.length > 0) {
          archive.append(JSON.stringify(auditLog, null, 2), { name: 'audit-log.json' });
        }

        archive.finalize();
      } catch (error) {
        reject(error);
      }
    });
  }

  getMimeType(format: string): string {
    switch (format) {
      case 'pdf':
        return 'application/pdf';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'html':
        return 'text/html';
      case 'zip':
        return 'application/zip';
      default:
        return 'application/octet-stream';
    }
  }

  getFileExtension(format: string): string {
    switch (format) {
      case 'pdf':
        return '.pdf';
      case 'docx':
        return '.docx';
      case 'html':
        return '.html';
      case 'zip':
        return '.zip';
      default:
        return '.bin';
    }
  }
}