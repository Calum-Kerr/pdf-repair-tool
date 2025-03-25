import { PDFStreamProcessor } from '../../lib/largeFileProcessing';
import { join } from 'path';
import { writeFile, mkdir, rm, readdir } from 'fs/promises';
import { existsSync } from 'fs';

describe('PDF Stream Processing Tests', () => {
  const TEST_DIR = join(__dirname, '..', 'fixtures', 'large-files');
  const TEMP_DIR = join(TEST_DIR, 'temp');
  let processor: PDFStreamProcessor;

  beforeAll(async () => {
    // Create test directories if they don't exist
    if (!existsSync(TEST_DIR)) {
      await mkdir(TEST_DIR, { recursive: true });
    }
    if (!existsSync(TEMP_DIR)) {
      await mkdir(TEMP_DIR, { recursive: true });
    }
    processor = new PDFStreamProcessor(TEMP_DIR);
  });

  afterAll(async () => {
    // Clean up test directories
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Clear temp directory before each test
    await rm(TEMP_DIR, { recursive: true, force: true });
    await mkdir(TEMP_DIR);
  });

  describe('Large File Processing', () => {
    test('should process large PDF file in chunks', async () => {
      // Create a large test PDF file (10MB)
      const testFilePath = join(TEST_DIR, 'large-test.pdf');
      const outputPath = join(TEST_DIR, 'processed-large-test.pdf');
      
      // Generate PDF content
      const header = '%PDF-1.7\n';
      const content = '1 0 obj\n<<>>\nendobj\n'.repeat(100000); // Repeat to create large file
      const trailer = 'trailer\n<<>>\nstartxref\n0\n%%EOF';
      const testContent = header + content + trailer;
      
      await writeFile(testFilePath, testContent);

      // Process the file
      const result = await processor.processLargeFile(testFilePath, outputPath);

      // Verify results
      expect(result.isValid).toBe(true);
      expect(result.processedChunks).toBeGreaterThan(0);
      expect(result.totalSize).toBeGreaterThan(1024 * 1024 * 9); // Should be > 9MB
    });

    test('should handle memory limits correctly', async () => {
      // Create a test file larger than MAX_MEMORY_USAGE
      const testFilePath = join(TEST_DIR, 'memory-test.pdf');
      const outputPath = join(TEST_DIR, 'processed-memory-test.pdf');
      
      // Generate large PDF content (150MB)
      const header = '%PDF-1.7\n';
      const content = '1 0 obj\n<<>>\nendobj\n'.repeat(1500000);
      const trailer = 'trailer\n<<>>\nstartxref\n0\n%%EOF';
      const testContent = header + content + trailer;
      
      await writeFile(testFilePath, testContent);

      // Process the file
      const result = await processor.processLargeFile(testFilePath, outputPath);

      // Verify results
      expect(result.isValid).toBe(true);
      expect(result.processedChunks).toBeGreaterThan(100); // Should have many chunks
      
      // Check temp files were created
      const tempFiles = await readdir(TEMP_DIR);
      expect(tempFiles.length).toBeGreaterThan(0);
    });

    test('should validate PDF content in chunks', async () => {
      const testFilePath = join(TEST_DIR, 'invalid-chunks.pdf');
      const outputPath = join(TEST_DIR, 'processed-invalid-chunks.pdf');
      
      // Create PDF with invalid content
      const invalidContent = 'Not a PDF file\n'.repeat(1000);
      await writeFile(testFilePath, invalidContent);

      // Process should fail for invalid PDF
      await expect(processor.processLargeFile(testFilePath, outputPath))
        .rejects.toThrow('Invalid PDF content in chunk');
    });
  });

  describe('Chunk Processing', () => {
    test('should process PDF in configurable chunk sizes', async () => {
      const testFilePath = join(TEST_DIR, 'chunk-test.pdf');
      const customChunkSize = 512 * 1024; // 512KB chunks
      
      // Create test PDF
      const header = '%PDF-1.7\n';
      const content = '1 0 obj\n<<>>\nendobj\n'.repeat(10000);
      const trailer = 'trailer\n<<>>\nstartxref\n0\n%%EOF';
      await writeFile(testFilePath, header + content + trailer);

      // Process with custom chunk size
      const chunks = await processor.processInChunks(testFilePath, customChunkSize);
      
      // Verify chunk processing
      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(customChunkSize);
      });
    });
  });

  describe('Cleanup Operations', () => {
    test('should clean up temporary files after processing', async () => {
      // Create some test temporary files
      const testFiles = ['temp_chunk_1.pdf', 'temp_chunk_2.pdf', 'other_file.pdf'];
      
      for (const file of testFiles) {
        await writeFile(join(TEMP_DIR, file), 'test content');
      }
      
      // Verify files were created
      let files = await readdir(TEMP_DIR);
      expect(files).toContain('temp_chunk_1.pdf');
      expect(files).toContain('temp_chunk_2.pdf');
      expect(files).toContain('other_file.pdf');
      
      // Run cleanup
      await processor.cleanup(2);
      
      // Verify only non-temp files remain
      files = await readdir(TEMP_DIR);
      expect(files).not.toContain('temp_chunk_1.pdf');
      expect(files).not.toContain('temp_chunk_2.pdf');
      expect(files).toContain('other_file.pdf');
    });

    test('should handle cleanup with no temporary files', async () => {
      // Create a non-temp file
      await writeFile(join(TEMP_DIR, 'regular_file.pdf'), 'test content');
      
      // Run cleanup
      await expect(processor.cleanup(0)).resolves.not.toThrow();
      
      // Verify non-temp file still exists
      const files = await readdir(TEMP_DIR);
      expect(files).toContain('regular_file.pdf');
    });
  });
}); 