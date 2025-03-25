import { PerformanceMonitor } from '../../lib/performanceMonitoring';
import { join } from 'path';
import { mkdir, readFile, rm } from 'fs/promises';
import { existsSync } from 'fs';

describe('Performance Monitoring Tests', () => {
  const TEST_METRICS_DIR = join(__dirname, '..', 'fixtures', 'metrics');
  let monitor: PerformanceMonitor;

  const customThresholds = {
    memoryUsagePercent: 90,
    cpuUsagePercent: 85,
    queueSizeLimit: 50,
    errorRatePercent: 10,
    processingTimeMs: 20000
  };

  beforeAll(async () => {
    if (!existsSync(TEST_METRICS_DIR)) {
      await mkdir(TEST_METRICS_DIR, { recursive: true });
    }
  });

  afterAll(async () => {
    await rm(TEST_METRICS_DIR, { recursive: true, force: true });
  });

  beforeEach(() => {
    monitor = new PerformanceMonitor(TEST_METRICS_DIR, customThresholds);
  });

  afterEach(() => {
    monitor.stopMonitoring();
  });

  describe('Monitoring Control', () => {
    test('should start and stop monitoring', () => {
      monitor.startMonitoring(1000);
      expect(monitor['monitoringInterval']).toBeTruthy();

      monitor.stopMonitoring();
      expect(monitor['monitoringInterval']).toBeNull();
    });

    test('should not start monitoring twice', () => {
      monitor.startMonitoring(1000);
      const firstInterval = monitor['monitoringInterval'];
      
      monitor.startMonitoring(1000);
      expect(monitor['monitoringInterval']).toBe(firstInterval);
    });
  });

  describe('Metrics Collection', () => {
    test('should collect system metrics', async () => {
      const metrics = await monitor['collectMetrics']();
      
      expect(metrics).toMatchObject({
        timestamp: expect.any(Number),
        memoryUsage: {
          heapUsed: expect.any(Number),
          heapTotal: expect.any(Number),
          external: expect.any(Number),
          arrayBuffers: expect.any(Number)
        },
        cpuUsage: {
          user: expect.any(Number),
          system: expect.any(Number)
        }
      });
    });

    test('should maintain bounded metrics history', async () => {
      const maxHistory = monitor['maxHistoryLength'];
      
      // Add more metrics than the limit
      for (let i = 0; i < maxHistory + 10; i++) {
        const metrics = await monitor['collectMetrics']();
        monitor['processMetrics'](metrics);
      }

      expect(monitor.getMetricsHistory().length).toBeLessThanOrEqual(maxHistory);
    });
  });

  describe('Alert Generation', () => {
    test('should generate memory alert', async () => {
      const alertHandler = jest.fn();
      monitor.on('alert', alertHandler);

      // Mock high memory usage
      const metrics = await monitor['collectMetrics']();
      metrics.memoryUsage.heapUsed = metrics.memoryUsage.heapTotal * 0.95; // 95% usage
      
      monitor['processMetrics'](metrics);
      
      expect(alertHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'memory',
          value: expect.any(Number),
          threshold: customThresholds.memoryUsagePercent
        })
      );
    });

    test('should generate CPU alert', async () => {
      const alertHandler = jest.fn();
      monitor.on('alert', alertHandler);

      // Mock high CPU usage
      const metrics = await monitor['collectMetrics']();
      metrics.cpuUsage.user = 8500000; // 85% usage
      metrics.cpuUsage.system = 1000000;
      
      monitor['processMetrics'](metrics);
      
      expect(alertHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'cpu',
          value: expect.any(Number),
          threshold: customThresholds.cpuUsagePercent
        })
      );
    });

    test('should generate queue size alert', async () => {
      const alertHandler = jest.fn();
      monitor.on('alert', alertHandler);

      // Mock large queue
      const metrics = await monitor['collectMetrics']();
      metrics.processStats.queuedJobs = customThresholds.queueSizeLimit + 10;
      
      monitor['processMetrics'](metrics);
      
      expect(alertHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'queue',
          value: metrics.processStats.queuedJobs,
          threshold: customThresholds.queueSizeLimit
        })
      );
    });

    test('should generate error rate alert', async () => {
      const alertHandler = jest.fn();
      monitor.on('alert', alertHandler);

      // Mock high error rate
      const metrics = await monitor['collectMetrics']();
      metrics.processStats.completedJobs = 80;
      metrics.processStats.failedJobs = 20; // 20% error rate
      
      monitor['processMetrics'](metrics);
      
      expect(alertHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          value: expect.any(Number),
          threshold: customThresholds.errorRatePercent
        })
      );
    });
  });

  describe('Alert Management', () => {
    test('should maintain alert history', () => {
      const alerts = [
        { type: 'memory' as const, value: 95, threshold: 90 },
        { type: 'cpu' as const, value: 88, threshold: 85 },
        { type: 'queue' as const, value: 60, threshold: 50 }
      ];

      alerts.forEach(alert => {
        monitor['alerts'].push({
          ...alert,
          message: `Test alert`,
          timestamp: Date.now()
        });
      });

      const recentAlerts = monitor.getRecentAlerts();
      expect(recentAlerts).toHaveLength(alerts.length);
      expect(recentAlerts[0].type).toBe('memory');
    });

    test('should clear old alerts', () => {
      const now = Date.now();
      const oldAlerts = [
        {
          type: 'memory' as const,
          value: 95,
          threshold: 90,
          message: 'Old alert',
          timestamp: now - 48 * 60 * 60 * 1000 // 48 hours old
        },
        {
          type: 'cpu' as const,
          value: 88,
          threshold: 85,
          message: 'Recent alert',
          timestamp: now - 12 * 60 * 60 * 1000 // 12 hours old
        }
      ];

      monitor['alerts'].push(...oldAlerts);
      monitor.clearOldAlerts(24 * 60 * 60 * 1000); // 24 hours

      const remainingAlerts = monitor.getRecentAlerts();
      expect(remainingAlerts).toHaveLength(1);
      expect(remainingAlerts[0].message).toBe('Recent alert');
    });
  });

  describe('Metrics Storage', () => {
    test('should save metrics to file', async () => {
      const metrics = await monitor['collectMetrics']();
      await monitor['saveMetrics'](metrics);

      const filename = `metrics_${new Date().toISOString().split('T')[0]}.json`;
      const filePath = join(TEST_METRICS_DIR, filename);
      
      expect(existsSync(filePath)).toBe(true);
      
      const savedMetrics = JSON.parse(await readFile(filePath, 'utf-8'));
      expect(savedMetrics).toMatchObject({
        timestamp: metrics.timestamp,
        memoryUsage: expect.any(Object),
        cpuUsage: expect.any(Object)
      });
    });
  });
}); 