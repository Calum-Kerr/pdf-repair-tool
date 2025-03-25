import { PDFDocument } from 'pdf-lib';
import { AuditEvent } from './types';

export interface AuditLogQuery {
  startDate?: Date;
  endDate?: Date;
  eventType?: string;
  actorId?: string;
  resourceType?: string;
  actionType?: string;
  status?: 'success' | 'failure';
  limit?: number;
  offset?: number;
}

export class AuditLogger {
  private static readonly MAX_RETENTION_DAYS = 365;
  private static readonly MAX_BATCH_SIZE = 1000;
  private static instance: AuditLogger;
  private events: AuditEvent[] = [];

  private constructor() {
    // Initialize with a bounded array to prevent unbounded growth
    this.events = [];
  }

  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  /**
   * Log an audit event
   */
  logEvent(event: AuditEvent): void {
    this.events.push({
      ...event,
      timestamp: new Date().toISOString(),
    });
    console.log('Audit Event:', event);
  }

  /**
   * Query audit logs with filters
   */
  async queryLogs(query: AuditLogQuery = {}): Promise<AuditEvent[]> {
    let results = this.events;

    // Apply filters
    if (query.startDate) {
      results = results.filter(log => log.timestamp >= query.startDate!);
    }
    if (query.endDate) {
      results = results.filter(log => log.timestamp <= query.endDate!);
    }
    if (query.eventType) {
      results = results.filter(log => log.eventType === query.eventType);
    }
    if (query.actorId) {
      results = results.filter(log => log.actor.id === query.actorId);
    }
    if (query.resourceType) {
      results = results.filter(log => log.resource.type === query.resourceType);
    }
    if (query.actionType) {
      results = results.filter(log => log.action.type === query.actionType);
    }
    if (query.status) {
      results = results.filter(log => log.action.status === query.status);
    }

    // Apply pagination
    const offset = query.offset || 0;
    const limit = Math.min(query.limit || 50, 100); // Cap at 100 results
    results = results.slice(offset, offset + limit);

    return results;
  }

  /**
   * Export logs to a specific format
   */
  async exportLogs(format: 'json' | 'csv' = 'json'): Promise<string> {
    if (format === 'csv') {
      return this.exportToCSV();
    }
    return JSON.stringify(this.events, null, 2);
  }

  /**
   * Clean up old logs based on retention policy
   */
  async cleanupOldLogs(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - AuditLogger.MAX_RETENTION_DAYS);
    this.events = this.events.filter(log => log.timestamp >= cutoffDate);
  }

  /**
   * Validate audit event data
   */
  private validateEvent(event: AuditEvent): void {
    if (!event.eventType) {
      throw new Error('Event type is required');
    }
    if (!event.actor.ipAddress) {
      throw new Error('Actor IP address is required');
    }
    if (!event.resource.type) {
      throw new Error('Resource type is required');
    }
    if (!event.action.type || !event.action.status) {
      throw new Error('Action type and status are required');
    }
  }

  /**
   * Export logs to CSV format
   */
  private exportToCSV(): string {
    if (this.events.length === 0) {
      return '';
    }

    const headers = [
      'timestamp',
      'eventType',
      'actorId',
      'actorEmail',
      'ipAddress',
      'userAgent',
      'resourceType',
      'resourceId',
      'resourceName',
      'actionType',
      'actionStatus',
      'actionDetails'
    ].join(',');

    const rows = this.events.map(log => [
      log.timestamp,
      log.eventType,
      log.actor.id || '',
      log.actor.email || '',
      log.actor.ipAddress,
      log.actor.userAgent,
      log.resource.type,
      log.resource.id || '',
      log.resource.name || '',
      log.action.type,
      log.action.status,
      log.action.details || ''
    ].map(field => `"${field}"`).join(','));

    return [headers, ...rows].join('\n');
  }

  getEvents(): AuditEvent[] {
    return [...this.events];
  }

  clearEvents(): void {
    this.events = [];
  }
} 