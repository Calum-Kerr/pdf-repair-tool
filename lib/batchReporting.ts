import { BatchStats, BatchJob } from './batchProcessing';
import { writeFile } from 'fs/promises';
import { join } from 'path';

interface BatchReport {
  id: string;
  timestamp: string;
  duration: number;
  stats: BatchStats;
  jobs: BatchJobReport[];
  summary: {
    successRate: number;
    averageProcessingTime: number;
    totalProcessedSize: number;
    errorCategories: Map<string, number>;
  };
}

interface BatchJobReport {
  id: string;
  filePath: string;
  status: string;
  processingTime: number;
  fileSize: number;
  error?: string;
  repairActions?: string[];
}

export class BatchReporter {
  private readonly reportsDir: string;
  private currentBatchId: string;
  private startTime: number;
  private jobReports: Map<string, BatchJobReport>;

  constructor(reportsDir: string) {
    this.reportsDir = reportsDir;
    this.currentBatchId = `batch_${Date.now()}`;
    this.startTime = Date.now();
    this.jobReports = new Map();
  }

  /**
   * Initialize a new batch report
   */
  startNewBatch(): string {
    this.currentBatchId = `batch_${Date.now()}`;
    this.startTime = Date.now();
    this.jobReports.clear();
    return this.currentBatchId;
  }

  /**
   * Add or update a job report
   */
  updateJobReport(job: BatchJob, processingTime: number, fileSize: number, repairActions?: string[]): void {
    this.jobReports.set(job.id, {
      id: job.id,
      filePath: job.filePath,
      status: job.status,
      processingTime,
      fileSize,
      error: job.error,
      repairActions
    });
  }

  /**
   * Generate the final batch report
   */
  async generateReport(stats: BatchStats): Promise<BatchReport> {
    const duration = Date.now() - this.startTime;
    const errorCategories = new Map<string, number>();
    let totalProcessingTime = 0;
    let totalSize = 0;

    // Process job reports with bounded loop
    const jobReports: BatchJobReport[] = [];
    const maxJobs = Math.min(this.jobReports.size, 1000); // Bound the loop
    let processedJobs = 0;
    
    for (const report of this.jobReports.values()) {
      if (processedJobs >= maxJobs) break;
      
      jobReports.push(report);
      totalProcessingTime += report.processingTime;
      totalSize += report.fileSize;
      
      if (report.error) {
        const category = this.categorizeError(report.error);
        errorCategories.set(category, (errorCategories.get(category) || 0) + 1);
      }
      
      processedJobs++;
    }

    const report: BatchReport = {
      id: this.currentBatchId,
      timestamp: new Date().toISOString(),
      duration,
      stats,
      jobs: jobReports,
      summary: {
        successRate: (stats.completed / stats.total) * 100,
        averageProcessingTime: totalProcessingTime / jobReports.length,
        totalProcessedSize: totalSize,
        errorCategories
      }
    };

    // Save report to file
    await this.saveReport(report);
    return report;
  }

  /**
   * Save the report to a file
   */
  private async saveReport(report: BatchReport): Promise<void> {
    const reportPath = join(this.reportsDir, `${report.id}.json`);
    try {
      await writeFile(reportPath, JSON.stringify(report, this.replacer, 2));
    } catch (error) {
      throw new Error(`Failed to save batch report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Categorize errors for reporting
   */
  private categorizeError(error: string): string {
    const categories = [
      { pattern: /security|validation/i, name: 'Security Validation' },
      { pattern: /virus|malware/i, name: 'Virus Detection' },
      { pattern: /corrupt|invalid/i, name: 'PDF Corruption' },
      { pattern: /storage|file/i, name: 'Storage Error' },
      { pattern: /memory|resource/i, name: 'Resource Error' }
    ];

    for (const category of categories) {
      if (category.pattern.test(error)) {
        return category.name;
      }
    }
    
    return 'Other';
  }

  /**
   * Custom replacer for JSON stringification to handle Map
   */
  private replacer(key: string, value: any): any {
    if (value instanceof Map) {
      return Object.fromEntries(value);
    }
    return value;
  }
} 