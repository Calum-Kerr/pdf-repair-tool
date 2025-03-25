import { BatchProcessor } from '../../lib/batchProcessing';
import { join } from 'path';
import { writeFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { PDFDocument } from 'pdf-lib';

describe('Batch Processing Tests', () => {
  const TEST_DIR = join(__dirname, '..', 'fixtures', 'batch-processing');
  let processor: BatchProcessor;
  const testFiles: string[] = [];

  beforeAll(async () => {
    // Create test directory if it doesn't exist
    if (!existsSync(TEST_DIR)) {
      await mkdir(TEST_DIR, { recursive: true });
    }

    // Create test PDF files
    for (let i = 0; i < 5; i++) {
      const filePath = join(TEST_DIR, `test_${i + 1}.pdf`);
      await generateTestPDF(filePath, i + 1);
      testFiles.push(filePath);
    }

    processor = new BatchProcessor();
  });

  afterAll(async () => {
    // Clean up test directory
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  // Helper to generate a test PDF
  async function generateTestPDF(path: string, pages: number): Promise<void> {
    const pdfDoc = await PDFDocument.create();
    
    for (let i = 0; i < pages; i++) {
      const page = pdfDoc.addPage([600, 800]);
      page.drawText(`Test Page ${i + 1}`, {
        x: 50,
        y: 750,
        size: 12
      });
    }

    const pdfBytes = await pdfDoc.save();
    await writeFile(path, pdfBytes);
  }

  describe('Queue Management', () => {
    test('should add jobs to queue', () => {
      const jobId = processor.addJob(testFiles[0]);
      
      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');
      
      const stats = processor.getStats();
      expect(stats.total).toBe(1);
      expect(stats.queued).toBe(1);
    });

    test('should track multiple jobs', () => {
      testFiles.forEach(file => processor.addJob(file));
      
      const stats = processor.getStats();
      expect(stats.total).toBe(5);
      expect(stats.queued).toBe(5);
    });

    test('should get job status', () => {
      const jobId = processor.addJob(testFiles[0]);
      const status = processor.getJobStatus(jobId);
      
      expect(status).toBeDefined();
      expect(status?.status).toBe('queued');
      expect(status?.progress).toBe(0);
    });
  });

  describe('Batch Processing', () => {
    test('should process jobs concurrently', async () => {
      const jobIds = testFiles.map(file => processor.addJob(file));
      
      const progressUpdates = new Map<string, number>();
      processor.on('progressUpdate', ({ jobId, progress }) => {
        progressUpdates.set(jobId, progress);
      });

      await processor.startProcessing();
      
      // Wait for all jobs to complete
      await new Promise(resolve => {
        processor.on('batchCompleted', resolve);
      });

      const stats = processor.getStats();
      expect(stats.completed + stats.failed).toBe(testFiles.length);
      
      // Check that all jobs made progress
      jobIds.forEach(jobId => {
        expect(progressUpdates.get(jobId)).toBe(100);
      });
    });

    test('should handle job failures and retries', async () => {
      // Add an invalid file
      const invalidPath = join(TEST_DIR, 'invalid.pdf');
      await writeFile(invalidPath, 'Not a PDF file');
      
      const jobId = processor.addJob(invalidPath);
      
      const retryEvents: any[] = [];
      processor.on('jobRetry', (event) => retryEvents.push(event));
      
      await processor.startProcessing();
      
      // Wait for job to fail
      await new Promise(resolve => {
        processor.on('jobFailed', resolve);
      });

      const stats = processor.getStats();
      expect(stats.failed).toBe(1);
      expect(retryEvents.length).toBeGreaterThan(0);
      
      const finalStatus = processor.getJobStatus(jobId);
      expect(finalStatus?.status).toBe('failed');
      expect(finalStatus?.error).toBeDefined();
    });
  });

  describe('Event Handling', () => {
    test('should emit progress events', (done) => {
      const jobId = processor.addJob(testFiles[0]);
      const progressEvents: number[] = [];
      
      processor.on('progressUpdate', ({ progress }) => {
        progressEvents.push(progress);
        if (progress === 100) {
          expect(progressEvents).toEqual([10, 30, 50, 80, 100]);
          done();
        }
      });

      processor.startProcessing();
    });

    test('should emit completion event', (done) => {
      testFiles.forEach(file => processor.addJob(file));
      
      processor.on('batchCompleted', (stats) => {
        expect(stats.completed + stats.failed).toBe(testFiles.length);
        expect(stats.inProgress).toBe(0);
        expect(stats.queued).toBe(0);
        done();
      });

      processor.startProcessing();
    });
  });
}); 