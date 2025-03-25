import { EventEmitter } from 'events';
import { repairPDF } from './pdfRepair';
import { validateFileUpload } from './security';
import { scanFile } from './virusScan';
import { securelyStoreFile, securelyDeleteFile } from './secureFileHandling';
import { Buffer } from 'buffer';
import { BatchReporter } from './batchReporting';
import { stat } from 'fs/promises';

const MAX_CONCURRENT_JOBS = 3;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export interface BatchJob {
  id: string;
  filePath: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: {
    isValid: boolean;
    error?: string;
    repairedPDF?: Buffer;
  };
  retries: number;
  error?: string;
}

export interface BatchStats {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  queued: number;
}

export class BatchProcessor extends EventEmitter {
  private queue: BatchJob[];
  private activeJobs: Map<string, BatchJob>;
  private stats: BatchStats;
  private reporter: BatchReporter;
  private jobStartTimes: Map<string, number>;
  private jobProcessingTimes: number[] = [];
  private readonly maxProcessingTimes = 1000; // Keep last 1000 processing times

  constructor(reportsDir: string) {
    super();
    this.queue = [];
    this.activeJobs = new Map();
    this.stats = {
      total: 0,
      completed: 0,
      failed: 0,
      inProgress: 0,
      queued: 0
    };
    this.reporter = new BatchReporter(reportsDir);
    this.jobStartTimes = new Map();
  }

  /**
   * Add a file to the batch processing queue
   * @param filePath Path to the PDF file
   * @returns Job ID
   */
  addJob(filePath: string): string {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const job: BatchJob = {
      id: jobId,
      filePath,
      status: 'queued',
      progress: 0,
      retries: 0
    };

    this.queue.push(job);
    this.stats.total++;
    this.stats.queued++;
    this.emit('jobAdded', { jobId, stats: this.stats });

    // Start processing if we have capacity
    if (this.activeJobs.size < MAX_CONCURRENT_JOBS) {
      this.processNextJob();
    }

    return jobId;
  }

  /**
   * Start processing the batch queue
   */
  async startProcessing(): Promise<void> {
    const concurrentJobs = Math.min(MAX_CONCURRENT_JOBS, this.queue.length);
    const startupPromises = [];

    for (let i = 0; i < concurrentJobs; i++) {
      startupPromises.push(this.processNextJob());
    }

    await Promise.all(startupPromises);
  }

  /**
   * Get current batch processing statistics
   */
  getStats(): BatchStats {
    return { ...this.stats };
  }

  /**
   * Get status of a specific job
   * @param jobId Job ID to check
   */
  getJobStatus(jobId: string): BatchJob | undefined {
    return this.activeJobs.get(jobId) || this.queue.find(job => job.id === jobId);
  }

  /**
   * Get processing time statistics
   */
  getProcessingTimes(): { average: number; max: number; min: number } {
    if (this.jobProcessingTimes.length === 0) {
      return { average: 0, max: 0, min: 0 };
    }

    const sum = this.jobProcessingTimes.reduce((a, b) => a + b, 0);
    return {
      average: sum / this.jobProcessingTimes.length,
      max: Math.max(...this.jobProcessingTimes),
      min: Math.min(...this.jobProcessingTimes)
    };
  }

  private updateProcessingTime(jobId: string): void {
    const startTime = this.jobStartTimes.get(jobId);
    if (startTime) {
      const processingTime = Date.now() - startTime;
      this.jobProcessingTimes.push(processingTime);
      
      // Keep array bounded
      if (this.jobProcessingTimes.length > this.maxProcessingTimes) {
        this.jobProcessingTimes.shift();
      }
      
      this.jobStartTimes.delete(jobId);
    }
  }

  private async processNextJob(): Promise<void> {
    if (this.queue.length === 0 || this.activeJobs.size >= MAX_CONCURRENT_JOBS) {
      return;
    }

    const job = this.queue.shift()!;
    this.stats.queued--;
    this.stats.inProgress++;
    this.activeJobs.set(job.id, job);
    job.status = 'processing';
    
    // Record job start time
    this.jobStartTimes.set(job.id, Date.now());

    try {
      // Get file size for reporting
      const fileStats = await stat(job.filePath);
      
      // Update progress
      this.updateProgress(job.id, 10);
      
      // 1. Security validation
      const fileData = await validateFileUpload(job.filePath, job.id);
      if (!fileData.isValid) {
        throw new Error(fileData.error || 'Security validation failed');
      }
      this.updateProgress(job.id, 30);

      // 2. Virus scan
      const scanResult = await scanFile(fileData.data);
      if (!scanResult.isValid) {
        throw new Error(scanResult.error || 'Virus scan failed');
      }
      this.updateProgress(job.id, 50);

      // 3. PDF repair
      const repairResult = await repairPDF(fileData.data);
      if (!repairResult.isValid) {
        throw new Error(repairResult.error || 'PDF repair failed');
      }
      this.updateProgress(job.id, 80);

      // 4. Store repaired PDF
      const storageResult = await securelyStoreFile(repairResult.repairedPDF!, {
        originalName: job.filePath,
        mimeType: 'application/pdf',
        size: repairResult.repairedPDF!.length
      });
      
      // Complete job
      job.status = 'completed';
      job.result = repairResult;
      this.updateProgress(job.id, 100);
      
      // Update processing time
      this.updateProcessingTime(job.id);
      
      // Update report
      const processingTime = Date.now() - (this.jobStartTimes.get(job.id) || 0);
      this.reporter.updateJobReport(job, processingTime, fileStats.size, ['Header validation', 'Structure repair', 'Stream optimization']);
      
      this.stats.completed++;
      this.emit('jobCompleted', { jobId: job.id, result: repairResult });

    } catch (error) {
      await this.handleJobError(job, error);
    } finally {
      this.stats.inProgress--;
      this.activeJobs.delete(job.id);
      this.jobStartTimes.delete(job.id);
      
      // Process next job if available
      if (this.queue.length > 0) {
        await this.processNextJob();
      } else if (this.stats.inProgress === 0) {
        // Generate final report when batch is complete
        const report = await this.reporter.generateReport(this.stats);
        this.emit('batchCompleted', { stats: this.stats, report });
      }
    }
  }

  private async handleJobError(job: BatchJob, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (job.retries < MAX_RETRIES) {
      // Retry the job
      job.retries++;
      job.status = 'queued';
      this.queue.push(job);
      this.stats.queued++;
      
      this.emit('jobRetry', {
        jobId: job.id,
        error: errorMessage,
        retryCount: job.retries
      });
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    } else {
      // Mark job as failed
      job.status = 'failed';
      job.error = errorMessage;
      this.stats.failed++;
      
      this.emit('jobFailed', {
        jobId: job.id,
        error: errorMessage,
        finalAttempt: true
      });
    }

    // Update processing time even for failed jobs
    this.updateProcessingTime(job.id);
  }

  private updateProgress(jobId: string, progress: number): void {
    const job = this.activeJobs.get(jobId);
    if (job) {
      job.progress = progress;
      this.emit('progress', { jobId, progress });
    }
  }

  /**
   * Process multiple files at once
   * @param jobs Array of jobs to process
   * @returns Array of processed jobs
   */
  async processFiles(jobs: { id: string; file: File; status: 'queued' }[]): Promise<BatchJob[]> {
    const results: BatchJob[] = [];
    
    for (const job of jobs) {
      try {
        // Convert File to path (store in temp location)
        const arrayBuffer = await job.file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const tempPath = await securelyStoreFile(buffer, {
          originalName: job.file.name,
          mimeType: job.file.type,
          size: job.file.size
        });
        
        // Add job to processor
        const jobId = this.addJob(tempPath);
        
        // Wait for job completion
        const processedJob = await new Promise<BatchJob>((resolve, reject) => {
          const checkStatus = () => {
            const status = this.getJobStatus(jobId);
            if (status?.status === 'completed') {
              resolve(status);
            } else if (status?.status === 'failed') {
              reject(new Error(status.error || 'Processing failed'));
            } else {
              setTimeout(checkStatus, 1000);
            }
          };
          checkStatus();
        });
        
        results.push(processedJob);
      } catch (error) {
        this.emit('error', { jobId: job.id, error });
        results.push({
          id: job.id,
          filePath: '',
          status: 'failed',
          progress: 0,
          retries: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return results;
  }
} 