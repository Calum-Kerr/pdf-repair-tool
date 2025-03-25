import { EventEmitter } from 'events';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { BatchProcessor } from './batchProcessing';
import { ResourceManager } from './resourceManagement';

interface PerformanceMetrics {
  timestamp: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
  processStats: {
    activeJobs: number;
    queuedJobs: number;
    completedJobs: number;
    failedJobs: number;
  };
  resourceStats: {
    cacheSize: number;
    cacheHits: number;
    cacheMisses: number;
    activeResources: number;
  };
  timing: {
    averageProcessingTime: number;
    maxProcessingTime: number;
    minProcessingTime: number;
  };
}

interface AlertThresholds {
  memoryUsagePercent: number;
  cpuUsagePercent: number;
  queueSizeLimit: number;
  errorRatePercent: number;
  processingTimeMs: number;
}

interface Alert {
  type: 'memory' | 'cpu' | 'queue' | 'error' | 'performance';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

export class PerformanceMonitor extends EventEmitter {
  private readonly metricsDir: string;
  private readonly metricsHistory: PerformanceMetrics[] = [];
  private readonly alerts: Alert[] = [];
  private readonly maxHistoryLength = 1000;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private batchProcessor: BatchProcessor | null = null;
  private resourceManager: ResourceManager | null = null;
  private readonly defaultThresholds: AlertThresholds = {
    memoryUsagePercent: 85,
    cpuUsagePercent: 80,
    queueSizeLimit: 100,
    errorRatePercent: 5,
    processingTimeMs: 30000
  };

  constructor(
    metricsDir: string,
    private readonly thresholds: AlertThresholds = {} as AlertThresholds
  ) {
    super();
    this.metricsDir = metricsDir;
    this.thresholds = { ...this.defaultThresholds, ...thresholds };
    this.initializeMetricsDir();
  }

  /**
   * Initialize metrics directory
   */
  private async initializeMetricsDir(): Promise<void> {
    if (!existsSync(this.metricsDir)) {
      await mkdir(this.metricsDir, { recursive: true });
    }
  }

  /**
   * Register batch processor for monitoring
   */
  registerBatchProcessor(processor: BatchProcessor): void {
    this.batchProcessor = processor;
    
    // Listen for batch processor events
    processor.on('jobAdded', this.handleJobAdded.bind(this));
    processor.on('jobCompleted', this.handleJobCompleted.bind(this));
    processor.on('jobFailed', this.handleJobFailed.bind(this));
  }

  /**
   * Register resource manager for monitoring
   */
  registerResourceManager(manager: ResourceManager): void {
    this.resourceManager = manager;
  }

  private handleJobAdded(event: { jobId: string; stats: any }): void {
    // Update metrics immediately when job is added
    this.collectAndProcessMetrics();
  }

  private handleJobCompleted(event: { jobId: string; result: any }): void {
    // Update metrics immediately when job completes
    this.collectAndProcessMetrics();
  }

  private handleJobFailed(event: { jobId: string; error: Error }): void {
    // Update metrics immediately when job fails
    this.collectAndProcessMetrics();
  }

  private async collectAndProcessMetrics(): Promise<void> {
    const metrics = await this.collectMetrics();
    this.processMetrics(metrics);
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(intervalMs: number = 5000): void {
    if (this.monitoringInterval) {
      return;
    }

    this.monitoringInterval = setInterval(async () => {
      const metrics = await this.collectMetrics();
      this.processMetrics(metrics);
    }, intervalMs);
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Collect current performance metrics
   */
  private async collectMetrics(): Promise<PerformanceMetrics> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      timestamp: Date.now(),
      memoryUsage: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers
      },
      cpuUsage: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      processStats: this.getProcessStats(),
      resourceStats: this.getResourceStats(),
      timing: this.getTimingStats()
    };
  }

  /**
   * Process metrics and check for alerts
   */
  private processMetrics(metrics: PerformanceMetrics): void {
    // Add to history with bounded size
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > this.maxHistoryLength) {
      this.metricsHistory.shift();
    }

    // Check thresholds and emit alerts
    this.checkMemoryThreshold(metrics);
    this.checkCPUThreshold(metrics);
    this.checkQueueThreshold(metrics);
    this.checkErrorRate(metrics);
    this.checkProcessingTime(metrics);

    // Save metrics to file
    this.saveMetrics(metrics);
  }

  /**
   * Check memory usage threshold
   */
  private checkMemoryThreshold(metrics: PerformanceMetrics): void {
    const usagePercent = (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100;
    if (usagePercent > this.thresholds.memoryUsagePercent) {
      const alert: Alert = {
        type: 'memory',
        message: `Memory usage exceeded threshold: ${usagePercent.toFixed(2)}%`,
        value: usagePercent,
        threshold: this.thresholds.memoryUsagePercent,
        timestamp: Date.now()
      };
      this.alerts.push(alert);
      this.emit('alert', alert);
    }
  }

  /**
   * Check CPU usage threshold
   */
  private checkCPUThreshold(metrics: PerformanceMetrics): void {
    const totalCPU = metrics.cpuUsage.user + metrics.cpuUsage.system;
    const usagePercent = (totalCPU / 1000000) * 100; // Convert to percentage
    if (usagePercent > this.thresholds.cpuUsagePercent) {
      const alert: Alert = {
        type: 'cpu',
        message: `CPU usage exceeded threshold: ${usagePercent.toFixed(2)}%`,
        value: usagePercent,
        threshold: this.thresholds.cpuUsagePercent,
        timestamp: Date.now()
      };
      this.alerts.push(alert);
      this.emit('alert', alert);
    }
  }

  /**
   * Check queue size threshold
   */
  private checkQueueThreshold(metrics: PerformanceMetrics): void {
    if (metrics.processStats.queuedJobs > this.thresholds.queueSizeLimit) {
      const alert: Alert = {
        type: 'queue',
        message: `Queue size exceeded limit: ${metrics.processStats.queuedJobs} jobs`,
        value: metrics.processStats.queuedJobs,
        threshold: this.thresholds.queueSizeLimit,
        timestamp: Date.now()
      };
      this.alerts.push(alert);
      this.emit('alert', alert);
    }
  }

  /**
   * Check error rate threshold
   */
  private checkErrorRate(metrics: PerformanceMetrics): void {
    const totalJobs = metrics.processStats.completedJobs + metrics.processStats.failedJobs;
    if (totalJobs > 0) {
      const errorRate = (metrics.processStats.failedJobs / totalJobs) * 100;
      if (errorRate > this.thresholds.errorRatePercent) {
        const alert: Alert = {
          type: 'error',
          message: `Error rate exceeded threshold: ${errorRate.toFixed(2)}%`,
          value: errorRate,
          threshold: this.thresholds.errorRatePercent,
          timestamp: Date.now()
        };
        this.alerts.push(alert);
        this.emit('alert', alert);
      }
    }
  }

  /**
   * Check processing time threshold
   */
  private checkProcessingTime(metrics: PerformanceMetrics): void {
    if (metrics.timing.averageProcessingTime > this.thresholds.processingTimeMs) {
      const alert: Alert = {
        type: 'performance',
        message: `Processing time exceeded threshold: ${metrics.timing.averageProcessingTime}ms`,
        value: metrics.timing.averageProcessingTime,
        threshold: this.thresholds.processingTimeMs,
        timestamp: Date.now()
      };
      this.alerts.push(alert);
      this.emit('alert', alert);
    }
  }

  /**
   * Save metrics to file
   */
  private async saveMetrics(metrics: PerformanceMetrics): Promise<void> {
    const filename = `metrics_${new Date().toISOString().split('T')[0]}.json`;
    const filePath = join(this.metricsDir, filename);
    
    try {
      const data = JSON.stringify(metrics, null, 2);
      await writeFile(filePath, data, { flag: 'a' });
    } catch (error) {
      console.error('Failed to save metrics:', error);
    }
  }

  /**
   * Get process statistics from BatchProcessor
   */
  private getProcessStats(): PerformanceMetrics['processStats'] {
    if (!this.batchProcessor) {
      return {
        activeJobs: 0,
        queuedJobs: 0,
        completedJobs: 0,
        failedJobs: 0
      };
    }

    const stats = this.batchProcessor.getStats();
    return {
      activeJobs: stats.inProgress,
      queuedJobs: stats.queued,
      completedJobs: stats.completed,
      failedJobs: stats.failed
    };
  }

  /**
   * Get resource statistics from ResourceManager
   */
  private getResourceStats(): PerformanceMetrics['resourceStats'] {
    if (!this.resourceManager) {
      return {
        cacheSize: 0,
        cacheHits: 0,
        cacheMisses: 0,
        activeResources: 0
      };
    }

    const stats = this.resourceManager.getStats();
    return {
      cacheSize: stats.cacheSize,
      cacheHits: stats.cacheHits,
      cacheMisses: stats.cacheMisses,
      activeResources: stats.activeResources
    };
  }

  /**
   * Get timing statistics from BatchProcessor
   */
  private getTimingStats(): PerformanceMetrics['timing'] {
    if (!this.batchProcessor) {
      return {
        averageProcessingTime: 0,
        maxProcessingTime: 0,
        minProcessingTime: 0
      };
    }

    const processingTimes = this.batchProcessor.getProcessingTimes();
    return {
      averageProcessingTime: processingTimes.average,
      maxProcessingTime: processingTimes.max,
      minProcessingTime: processingTimes.min
    };
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(count: number = 10): Alert[] {
    return this.alerts.slice(-count);
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Clear old alerts
   */
  clearOldAlerts(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAgeMs;
    this.alerts.splice(0, this.alerts.findIndex(alert => alert.timestamp >= cutoff));
  }
} 