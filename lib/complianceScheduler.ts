import { AuditLogger } from './auditLogger';
import { ComplianceReportingService } from './complianceReporting';
import { DataRetentionManager } from './dataRetentionManager';

export class ComplianceScheduler {
  private readonly auditLogger: AuditLogger;
  private readonly reportingService: ComplianceReportingService;
  private readonly retentionManager: DataRetentionManager;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second

  constructor(
    auditLogger: AuditLogger,
    reportingService: ComplianceReportingService,
    retentionManager: DataRetentionManager
  ) {
    this.auditLogger = auditLogger;
    this.reportingService = reportingService;
    this.retentionManager = retentionManager;
  }

  /**
   * Schedule daily compliance tasks
   */
  async scheduleDailyTasks(): Promise<void> {
    try {
      // Log scheduling start
      await this.auditLogger.logEvent({
        eventType: 'COMPLIANCE_SCHEDULER_START',
        actor: {
          ipAddress: 'system',
          userAgent: 'system'
        },
        resource: {
          type: 'COMPLIANCE_SCHEDULER',
          name: 'daily_tasks'
        },
        action: {
          type: 'SCHEDULE_TASKS',
          status: 'success',
          details: 'Starting daily compliance tasks'
        }
      });

      // Run data cleanup
      await this.runWithRetry(() => this.retentionManager.cleanupExpiredData());

      // Generate daily report
      await this.runWithRetry(async () => {
        await this.reportingService.generateReport('daily');
        return;
      });

      // Log scheduling completion
      await this.auditLogger.logEvent({
        eventType: 'COMPLIANCE_SCHEDULER_COMPLETE',
        actor: {
          ipAddress: 'system',
          userAgent: 'system'
        },
        resource: {
          type: 'COMPLIANCE_SCHEDULER',
          name: 'daily_tasks'
        },
        action: {
          type: 'SCHEDULE_TASKS',
          status: 'success',
          details: 'Completed daily compliance tasks'
        }
      });
    } catch (error) {
      // Log scheduling failure
      await this.auditLogger.logEvent({
        eventType: 'COMPLIANCE_SCHEDULER_FAILED',
        actor: {
          ipAddress: 'system',
          userAgent: 'system'
        },
        resource: {
          type: 'COMPLIANCE_SCHEDULER',
          name: 'daily_tasks'
        },
        action: {
          type: 'SCHEDULE_TASKS',
          status: 'failure',
          details: 'Failed to complete daily compliance tasks'
        },
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      throw error;
    }
  }

  /**
   * Schedule weekly compliance tasks
   */
  async scheduleWeeklyTasks(): Promise<void> {
    try {
      // Log scheduling start
      await this.auditLogger.logEvent({
        eventType: 'COMPLIANCE_SCHEDULER_START',
        actor: {
          ipAddress: 'system',
          userAgent: 'system'
        },
        resource: {
          type: 'COMPLIANCE_SCHEDULER',
          name: 'weekly_tasks'
        },
        action: {
          type: 'SCHEDULE_TASKS',
          status: 'success',
          details: 'Starting weekly compliance tasks'
        }
      });

      // Generate weekly report
      await this.runWithRetry(async () => {
        await this.reportingService.generateReport('weekly');
        return;
      });

      // Log scheduling completion
      await this.auditLogger.logEvent({
        eventType: 'COMPLIANCE_SCHEDULER_COMPLETE',
        actor: {
          ipAddress: 'system',
          userAgent: 'system'
        },
        resource: {
          type: 'COMPLIANCE_SCHEDULER',
          name: 'weekly_tasks'
        },
        action: {
          type: 'SCHEDULE_TASKS',
          status: 'success',
          details: 'Completed weekly compliance tasks'
        }
      });
    } catch (error) {
      // Log scheduling failure
      await this.auditLogger.logEvent({
        eventType: 'COMPLIANCE_SCHEDULER_FAILED',
        actor: {
          ipAddress: 'system',
          userAgent: 'system'
        },
        resource: {
          type: 'COMPLIANCE_SCHEDULER',
          name: 'weekly_tasks'
        },
        action: {
          type: 'SCHEDULE_TASKS',
          status: 'failure',
          details: 'Failed to complete weekly compliance tasks'
        },
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      throw error;
    }
  }

  /**
   * Run a task with retry logic
   */
  private async runWithRetry(task: () => Promise<void>): Promise<void> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await task();
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Log retry attempt
        await this.auditLogger.logEvent({
          eventType: 'COMPLIANCE_TASK_RETRY',
          actor: {
            ipAddress: 'system',
            userAgent: 'system'
          },
          resource: {
            type: 'COMPLIANCE_SCHEDULER',
            name: 'retry_attempt'
          },
          action: {
            type: 'RETRY_TASK',
            status: 'failure',
            details: `Retry attempt ${attempt} of ${this.maxRetries}`
          },
          metadata: {
            error: lastError.message,
            attempt
          }
        });

        if (attempt < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }

    throw lastError;
  }
} 