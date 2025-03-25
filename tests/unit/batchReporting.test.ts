import { BatchReporter } from '../../lib/batchReporting';
import { BatchJob, BatchStats } from '../../lib/batchProcessing';
import { join } from 'path';
import { mkdir, readFile, rm } from 'fs/promises';
import { existsSync } from 'fs';

describe('Batch Reporting Tests', () => {
  const TEST_REPORTS_DIR = join(__dirname, '..', 'fixtures', 'batch-reports');
  let reporter: BatchReporter;

  beforeAll(async () => {
    if (!existsSync(TEST_REPORTS_DIR)) {
      await mkdir(TEST_REPORTS_DIR, { recursive: true });
    }
    reporter = new BatchReporter(TEST_REPORTS_DIR);
  });

  afterAll(async () => {
    await rm(TEST_REPORTS_DIR, { recursive: true, force: true });
  });

  beforeEach(() => {
    reporter.startNewBatch();
  });

  describe('Report Generation', () => {
    test('should generate basic report structure', async () => {
      const mockStats: BatchStats = {
        total: 5,
        completed: 3,
        failed: 2,
        inProgress: 0,
        queued: 0
      };

      const report = await reporter.generateReport(mockStats);

      expect(report).toMatchObject({
        id: expect.any(String),
        timestamp: expect.any(String),
        duration: expect.any(Number),
        stats: mockStats,
        jobs: expect.any(Array),
        summary: {
          successRate: 60, // (3/5) * 100
          averageProcessingTime: expect.any(Number),
          totalProcessedSize: expect.any(Number),
          errorCategories: expect.any(Object)
        }
      });
    });

    test('should track job reports correctly', async () => {
      const mockJob: BatchJob = {
        id: 'test_job_1',
        filePath: '/test/file.pdf',
        status: 'completed',
        progress: 100,
        retries: 0
      };

      reporter.updateJobReport(mockJob, 1500, 1024 * 1024, ['Header repair']);

      const report = await reporter.generateReport({
        total: 1,
        completed: 1,
        failed: 0,
        inProgress: 0,
        queued: 0
      });

      expect(report.jobs).toHaveLength(1);
      expect(report.jobs[0]).toMatchObject({
        id: 'test_job_1',
        filePath: '/test/file.pdf',
        status: 'completed',
        processingTime: 1500,
        fileSize: 1024 * 1024,
        repairActions: ['Header repair']
      });
    });

    test('should categorize errors correctly', async () => {
      const mockJobs: BatchJob[] = [
        {
          id: 'job1',
          filePath: '/test/file1.pdf',
          status: 'failed',
          progress: 0,
          retries: 3,
          error: 'Security validation failed'
        },
        {
          id: 'job2',
          filePath: '/test/file2.pdf',
          status: 'failed',
          progress: 0,
          retries: 3,
          error: 'Virus detected in file'
        },
        {
          id: 'job3',
          filePath: '/test/file3.pdf',
          status: 'failed',
          progress: 0,
          retries: 3,
          error: 'PDF structure is corrupted'
        }
      ];

      mockJobs.forEach(job => {
        reporter.updateJobReport(job, 1000, 1024, []);
      });

      const report = await reporter.generateReport({
        total: 3,
        completed: 0,
        failed: 3,
        inProgress: 0,
        queued: 0
      });

      expect(report.summary.errorCategories).toMatchObject({
        'Security Validation': 1,
        'Virus Detection': 1,
        'PDF Corruption': 1
      });
    });

    test('should save report to file', async () => {
      const mockStats: BatchStats = {
        total: 1,
        completed: 1,
        failed: 0,
        inProgress: 0,
        queued: 0
      };

      const report = await reporter.generateReport(mockStats);
      const reportPath = join(TEST_REPORTS_DIR, `${report.id}.json`);

      expect(existsSync(reportPath)).toBe(true);

      const savedReport = JSON.parse(await readFile(reportPath, 'utf-8'));
      expect(savedReport).toMatchObject({
        id: report.id,
        stats: mockStats
      });
    });

    test('should handle large number of jobs', async () => {
      const numJobs = 1500; // More than maxJobs limit
      const mockJob: BatchJob = {
        id: 'test_job',
        filePath: '/test/file.pdf',
        status: 'completed',
        progress: 100,
        retries: 0
      };

      for (let i = 0; i < numJobs; i++) {
        reporter.updateJobReport(
          { ...mockJob, id: `job_${i}` },
          1000,
          1024,
          ['Test repair']
        );
      }

      const report = await reporter.generateReport({
        total: numJobs,
        completed: numJobs,
        failed: 0,
        inProgress: 0,
        queued: 0
      });

      expect(report.jobs.length).toBeLessThanOrEqual(1000); // Bounded by maxJobs
      expect(report.summary.successRate).toBe(100);
    });
  });
}); 