import { createWorker } from 'tesseract.js';
import { PDFDocument, PDFPage } from 'pdf-lib';
import { fileToArrayBuffer } from '../utils/fileUtils';
import { AuditLogger } from './auditLogger';

export interface OCRResult {
  text: string;
  confidence: number;
  pageNumber: number;
}

export interface OCROptions {
  language?: string;
  pageRange?: {
    start: number;
    end: number;
  };
  minConfidence?: number;
}

const DEFAULT_OPTIONS: OCROptions = {
  language: 'eng',
  minConfidence: 75
};

export class OCRService {
  private worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  private readonly maxPageSize = 4096; // Maximum image dimension for OCR
  private readonly supportedLanguages = ['eng', 'fra', 'deu', 'spa', 'ita'];
  private readonly auditLogger: AuditLogger;

  constructor(auditLogger: AuditLogger) {
    this.auditLogger = auditLogger;
  }

  /**
   * Initialize OCR worker
   */
  private async initWorker(language: string): Promise<void> {
    if (this.worker) {
      return;
    }

    this.worker = await createWorker();
    await this.worker.loadLanguage(language);
    await this.worker.initialize(language);
  }

  /**
   * Extract text from a PDF file
   */
  async extractText(
    pdfFile: File | Uint8Array,
    options: Partial<OCROptions> = {},
    requestInfo?: { ipAddress: string; userAgent: string }
  ): Promise<OCRResult[]> {
    const finalOptions = { ...DEFAULT_OPTIONS, ...options };
    const fileSize = pdfFile instanceof File ? pdfFile.size : pdfFile.length;
    const fileName = pdfFile instanceof File ? pdfFile.name : 'document.pdf';

    if (!this.supportedLanguages.includes(finalOptions.language!)) {
      throw new Error('Unsupported language');
    }

    try {
      // Log start of OCR processing
      await this.auditLogger.logEvent({
        eventType: 'OCR_PROCESSING_START',
        actor: {
          ipAddress: requestInfo?.ipAddress || 'unknown',
          userAgent: requestInfo?.userAgent || 'unknown'
        },
        resource: {
          type: 'PDF',
          name: fileName,
          size: fileSize
        },
        action: {
          type: 'EXTRACT_TEXT',
          status: 'success',
          details: `Starting OCR processing with language: ${finalOptions.language}`
        }
      });

      // Initialize OCR worker
      await this.initWorker(finalOptions.language!);

      // Load PDF document
      const pdfData = pdfFile instanceof File
        ? await fileToArrayBuffer(pdfFile)
        : pdfFile;
      const pdfDoc = await PDFDocument.load(pdfData);

      // Get page range
      const pageCount = pdfDoc.getPageCount();
      const startPage = finalOptions.pageRange?.start ?? 0;
      const endPage = Math.min(
        finalOptions.pageRange?.end ?? pageCount - 1,
        pageCount - 1
      );

      const results: OCRResult[] = [];

      // Process each page
      for (let i = startPage; i <= endPage; i++) {
        const page = pdfDoc.getPage(i);
        const images = await this.extractImagesFromPage(page);

        // Process each image on the page
        for (const image of images) {
          if (!this.worker) continue;

          const { data } = await this.worker.recognize(image);
          
          if (data.confidence >= finalOptions.minConfidence!) {
            results.push({
              text: data.text,
              confidence: data.confidence,
              pageNumber: i
            });
          }
        }
      }

      // Log successful completion
      await this.auditLogger.logEvent({
        eventType: 'OCR_PROCESSING_COMPLETE',
        actor: {
          ipAddress: requestInfo?.ipAddress || 'unknown',
          userAgent: requestInfo?.userAgent || 'unknown'
        },
        resource: {
          type: 'PDF',
          name: fileName,
          size: fileSize
        },
        action: {
          type: 'EXTRACT_TEXT',
          status: 'success',
          details: `Successfully processed ${results.length} text regions`
        },
        metadata: {
          pageCount: endPage - startPage + 1,
          totalConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length
        }
      });

      return results;
    } catch (error) {
      // Log error
      await this.auditLogger.logEvent({
        eventType: 'OCR_PROCESSING_ERROR',
        actor: {
          ipAddress: requestInfo?.ipAddress || 'unknown',
          userAgent: requestInfo?.userAgent || 'unknown'
        },
        resource: {
          type: 'PDF',
          name: fileName,
          size: fileSize
        },
        action: {
          type: 'EXTRACT_TEXT',
          status: 'failure',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Extract images from a PDF page
   */
  private async extractImagesFromPage(page: PDFPage): Promise<Uint8Array[]> {
    const images: Uint8Array[] = [];
    const xObjects = await page.node.Resources().lookup('XObject', true);
    
    if (!xObjects) {
      return images;
    }

    for (const [_, xObject] of Object.entries(xObjects.dict)) {
      if (xObject && typeof xObject === 'object' && 'getImage' in xObject) {
        try {
          const imageData = await xObject.getImage();
          if (imageData && imageData.length > 0) {
            images.push(imageData);
          }
        } catch (error) {
          console.warn('Failed to extract image:', error);
        }
      }
    }

    return images;
  }

  /**
   * Clean up resources
   */
  private async cleanup(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
} 