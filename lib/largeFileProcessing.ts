import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import { PDFDocument } from 'pdf-lib';
import { join } from 'path';
import { Buffer } from 'buffer';
import { unlink, readdir } from 'fs/promises';

const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
const MAX_MEMORY_USAGE = 1024 * 1024 * 100; // 100MB memory limit

interface StreamProcessingResult {
  isValid: boolean;
  error?: string;
  processedChunks: number;
  totalSize: number;
}

export class PDFStreamProcessor {
  private tempDir: string;
  private currentMemoryUsage: number = 0;

  constructor(tempDir: string) {
    this.tempDir = tempDir;
  }

  /**
   * Process a large PDF file in chunks using streams
   * @param inputPath Path to input PDF file
   * @param outputPath Path to save processed PDF
   */
  async processLargeFile(inputPath: string, outputPath: string): Promise<StreamProcessingResult> {
    try {
      const chunks: Buffer[] = [];
      let processedChunks = 0;
      let totalSize = 0;

      // Create transform stream for PDF processing
      const processingStream = new Transform({
        transform: async (chunk: Buffer, encoding, callback) => {
          try {
            // Update memory tracking
            this.currentMemoryUsage += chunk.length;
            totalSize += chunk.length;
            processedChunks++;

            // Check memory limits
            if (this.currentMemoryUsage > MAX_MEMORY_USAGE) {
              await this.flushToTempFile(Buffer.concat(chunks), processedChunks);
              chunks.length = 0;
              this.currentMemoryUsage = chunk.length;
            }

            chunks.push(chunk);
            callback(null, chunk);
          } catch (error) {
            callback(error as Error);
          }
        }
      });

      // Process the file in chunks
      await pipeline(
        createReadStream(inputPath),
        processingStream,
        createWriteStream(outputPath)
      );

      return {
        isValid: true,
        processedChunks,
        totalSize
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error during streaming',
        processedChunks: 0,
        totalSize: 0
      };
    }
  }

  /**
   * Process PDF in chunks for repair
   * @param inputPath Path to input PDF file
   * @param chunkSize Size of each chunk in bytes
   */
  async processInChunks(inputPath: string, chunkSize: number = CHUNK_SIZE): Promise<Buffer[]> {
    const chunks: Buffer[] = [];
    const readStream = createReadStream(inputPath, { highWaterMark: chunkSize });

    for await (const chunk of readStream) {
      // Process each chunk
      const processedChunk = await this.processChunk(chunk as Buffer);
      chunks.push(processedChunk);

      // Check memory usage and flush if needed
      if (this.currentMemoryUsage > MAX_MEMORY_USAGE) {
        await this.flushToTempFile(Buffer.concat(chunks), chunks.length);
        chunks.length = 0;
        this.currentMemoryUsage = 0;
      }
    }

    return chunks;
  }

  /**
   * Process a single chunk of PDF data
   * @param chunk Buffer containing PDF data
   */
  private async processChunk(chunk: Buffer): Promise<Buffer> {
    try {
      // Here we'll add specific PDF processing logic
      // For now, we just validate the chunk has PDF content
      if (this.isPDFContent(chunk)) {
        return chunk;
      }
      throw new Error('Invalid PDF content in chunk');
    } catch (error) {
      throw new Error(`Chunk processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Basic validation of PDF content in a chunk
   * @param chunk Buffer to validate
   */
  private isPDFContent(chunk: Buffer): boolean {
    // Check for PDF signatures or validate structure
    // This is a basic check - we'll enhance this later
    return chunk.includes(Buffer.from('%PDF-')) || 
           chunk.includes(Buffer.from('stream')) ||
           chunk.includes(Buffer.from('endstream')) ||
           chunk.includes(Buffer.from('obj')) ||
           chunk.includes(Buffer.from('endobj'));
  }

  /**
   * Flush processed chunks to temporary file to free memory
   * @param data Buffer to write to temp file
   * @param chunkNumber Current chunk number for filename
   */
  private async flushToTempFile(data: Buffer, chunkNumber: number): Promise<void> {
    const tempFilePath = join(this.tempDir, `temp_chunk_${chunkNumber}.pdf`);
    await pipeline(
      Buffer.from(data),
      createWriteStream(tempFilePath)
    );
  }

  /**
   * Clean up temporary files
   * @param chunkCount Number of chunks to clean up
   */
  async cleanup(chunkCount: number): Promise<void> {
    try {
      // Get all temporary files in the directory
      const files = await readdir(this.tempDir);
      
      // Filter for our temp chunk files
      const tempFiles = files.filter(file => file.startsWith('temp_chunk_'));
      
      // Delete each temporary file
      const deletionPromises = tempFiles.map(async (file) => {
        const filePath = join(this.tempDir, file);
        try {
          await unlink(filePath);
        } catch (error) {
          console.error(`Failed to delete temporary file ${file}:`, error);
        }
      });
      
      // Wait for all deletions to complete
      await Promise.all(deletionPromises);
    } catch (error) {
      throw new Error(`Failed to clean up temporary files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 