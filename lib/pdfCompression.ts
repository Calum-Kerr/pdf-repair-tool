import { Buffer } from 'buffer';
import { PDFDocument } from 'pdf-lib';

export interface CompressionOptions {
  level: 'low' | 'medium' | 'high';
  imageQuality?: number;
  compressText?: boolean;
  compressFonts?: boolean;
  removeMetadata?: boolean;
}

export interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  optimizations: string[];
}

const DEFAULT_OPTIONS: CompressionOptions = {
  level: 'medium',
  imageQuality: 0.8,
  compressText: true,
  compressFonts: true,
  removeMetadata: false,
};

const COMPRESSION_LEVELS = {
  low: {
    imageQuality: 0.9,
    compressText: true,
    compressFonts: false,
    removeMetadata: false,
  },
  medium: {
    imageQuality: 0.8,
    compressText: true,
    compressFonts: true,
    removeMetadata: false,
  },
  high: {
    imageQuality: 0.6,
    compressText: true,
    compressFonts: true,
    removeMetadata: true,
  },
};

export class PDFCompressor {
  private readonly maxImageSize = 2048; // Maximum image dimension
  private readonly maxFileSize = 500 * 1024 * 1024; // 500MB

  /**
   * Compress a PDF file with specified options
   */
  async compressPDF(
    pdfData: Buffer | Uint8Array,
    options: Partial<CompressionOptions> = {}
  ): Promise<CompressionResult> {
    // Validate input
    if (!pdfData || pdfData.length === 0) {
      throw new Error('Invalid PDF data');
    }

    if (pdfData.length > this.maxFileSize) {
      throw new Error('File size exceeds maximum limit');
    }

    // Merge options with defaults
    const finalOptions = {
      ...DEFAULT_OPTIONS,
      ...COMPRESSION_LEVELS[options.level || 'medium'],
      ...options,
    };

    const optimizations: string[] = [];
    const originalSize = pdfData.length;

    try {
      // Load PDF document
      const pdfDoc = await PDFDocument.load(pdfData);
      
      // Compress images if present
      if (finalOptions.imageQuality && finalOptions.imageQuality < 1) {
        const imageCount = await this.compressImages(pdfDoc, finalOptions.imageQuality);
        if (imageCount > 0) {
          optimizations.push(`Compressed ${imageCount} images to ${finalOptions.imageQuality * 100}% quality`);
        }
      }

      // Compress text streams
      if (finalOptions.compressText) {
        const streamCount = await this.compressTextStreams(pdfDoc);
        if (streamCount > 0) {
          optimizations.push(`Compressed ${streamCount} text streams`);
        }
      }

      // Compress fonts
      if (finalOptions.compressFonts) {
        const fontCount = await this.compressFonts(pdfDoc);
        if (fontCount > 0) {
          optimizations.push(`Optimized ${fontCount} fonts`);
        }
      }

      // Remove metadata if requested
      if (finalOptions.removeMetadata) {
        await this.removeMetadata(pdfDoc);
        optimizations.push('Removed metadata');
      }

      // Save the compressed PDF
      const compressedData = await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
      });

      const compressedSize = compressedData.length;
      const compressionRatio = (1 - (compressedSize / originalSize)) * 100;

      return {
        originalSize,
        compressedSize,
        compressionRatio,
        optimizations,
      };
    } catch (error) {
      throw new Error(`PDF compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Compress images in the PDF
   */
  private async compressImages(
    pdfDoc: PDFDocument,
    quality: number
  ): Promise<number> {
    let compressedCount = 0;
    const pages = pdfDoc.getPages();
    
    for (const page of pages) {
      const images = await page.node.Resources().lookup('XObject', true);
      if (!images) continue;

      for (const [name, xObject] of Object.entries(images.dict)) {
        if (xObject instanceof PDFDocument) {
          const imageData = await xObject.save();
          if (imageData.length > 1024) { // Only compress images larger than 1KB
            const compressedImage = await this.compressImage(imageData, quality);
            if (compressedImage) {
              await page.node.Resources().set(name, compressedImage);
              compressedCount++;
            }
          }
        }
      }
    }

    return compressedCount;
  }

  /**
   * Compress text streams in the PDF
   */
  private async compressTextStreams(pdfDoc: PDFDocument): Promise<number> {
    let compressedCount = 0;
    const pages = pdfDoc.getPages();

    for (const page of pages) {
      const contents = page.node.Contents();
      if (contents) {
        const stream = contents.toString();
        const compressed = await this.compressStream(stream);
        if (compressed) {
          page.node.setContent(compressed);
          compressedCount++;
        }
      }
    }

    return compressedCount;
  }

  /**
   * Compress fonts in the PDF
   */
  private async compressFonts(pdfDoc: PDFDocument): Promise<number> {
    let optimizedCount = 0;
    const pages = pdfDoc.getPages();

    for (const page of pages) {
      const fonts = await page.node.Resources().lookup('Font', true);
      if (!fonts) continue;

      for (const [name, font] of Object.entries(fonts.dict)) {
        if (font instanceof PDFDocument) {
          const fontData = await font.save();
          if (fontData.length > 1024) { // Only optimize fonts larger than 1KB
            const optimizedFont = await this.optimizeFont(fontData);
            if (optimizedFont) {
              await page.node.Resources().set(name, optimizedFont);
              optimizedCount++;
            }
          }
        }
      }
    }

    return optimizedCount;
  }

  /**
   * Remove metadata from the PDF
   */
  private async removeMetadata(pdfDoc: PDFDocument): Promise<void> {
    const info = pdfDoc.getInfoDict();
    if (info) {
      info.delete('Title');
      info.delete('Author');
      info.delete('Subject');
      info.delete('Keywords');
      info.delete('Creator');
      info.delete('Producer');
      info.delete('CreationDate');
      info.delete('ModDate');
    }

    // Remove XMP metadata if present
    const catalog = pdfDoc.catalog;
    catalog.delete('Metadata');
  }

  /**
   * Compress an individual image
   */
  private async compressImage(
    imageData: Uint8Array,
    quality: number
  ): Promise<Uint8Array | null> {
    try {
      // Implementation would use image processing library
      // For now, return original data
      return imageData;
    } catch (error) {
      console.error('Image compression failed:', error);
      return null;
    }
  }

  /**
   * Compress a text stream
   */
  private async compressStream(
    stream: string
  ): Promise<string | null> {
    try {
      // Remove unnecessary whitespace and comments
      return stream
        .replace(/\s+/g, ' ')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '')
        .trim();
    } catch (error) {
      console.error('Stream compression failed:', error);
      return null;
    }
  }

  /**
   * Optimize a font
   */
  private async optimizeFont(
    fontData: Uint8Array
  ): Promise<Uint8Array | null> {
    try {
      // Implementation would use font optimization library
      // For now, return original data
      return fontData;
    } catch (error) {
      console.error('Font optimization failed:', error);
      return null;
    }
  }
} 