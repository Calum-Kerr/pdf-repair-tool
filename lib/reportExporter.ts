import { ComplianceReport } from './gdprCompliance';
import { AuditLogger } from './auditLogger';
import { promises as fs } from 'fs';
import path from 'path';
import { format } from 'date-fns';

export class ReportExporter {
  private readonly auditLogger: AuditLogger;
  private readonly exportDir: string;
  private readonly maxExportsPerDay = 10;

  constructor(auditLogger: AuditLogger, exportDir: string = './exports') {
    this.auditLogger = auditLogger;
    this.exportDir = exportDir;
  }

  /**
   * Export compliance report in specified format
   */
  async exportReport(
    report: ComplianceReport,
    format: 'json' | 'csv' | 'pdf' = 'json'
  ): Promise<string> {
    try {
      // Log export start
      await this.auditLogger.logEvent({
        eventType: 'REPORT_EXPORT_START',
        actor: {
          ipAddress: 'system',
          userAgent: 'system'
        },
        resource: {
          type: 'COMPLIANCE_REPORT',
          name: `${report.reportType}_${format(report.timestamp, 'yyyy-MM-dd')}`
        },
        action: {
          type: 'EXPORT_REPORT',
          status: 'success',
          details: `Starting report export in ${format} format`
        }
      });

      // Create export directory if it doesn't exist
      await fs.mkdir(this.exportDir, { recursive: true });

      // Generate filename
      const filename = this.generateFilename(report, format);

      // Export based on format
      switch (format) {
        case 'json':
          await this.exportJson(report, filename);
          break;
        case 'csv':
          await this.exportCsv(report, filename);
          break;
        case 'pdf':
          await this.exportPdf(report, filename);
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      // Log export completion
      await this.auditLogger.logEvent({
        eventType: 'REPORT_EXPORT_COMPLETE',
        actor: {
          ipAddress: 'system',
          userAgent: 'system'
        },
        resource: {
          type: 'COMPLIANCE_REPORT',
          name: filename
        },
        action: {
          type: 'EXPORT_REPORT',
          status: 'success',
          details: `Completed report export in ${format} format`
        }
      });

      return filename;
    } catch (error) {
      // Log export failure
      await this.auditLogger.logEvent({
        eventType: 'REPORT_EXPORT_FAILED',
        actor: {
          ipAddress: 'system',
          userAgent: 'system'
        },
        resource: {
          type: 'COMPLIANCE_REPORT',
          name: `${report.reportType}_${format(report.timestamp, 'yyyy-MM-dd')}`
        },
        action: {
          type: 'EXPORT_REPORT',
          status: 'failure',
          details: `Failed to export report in ${format} format`
        },
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      throw error;
    }
  }

  /**
   * Export report as JSON
   */
  private async exportJson(report: ComplianceReport, filename: string): Promise<void> {
    const filePath = path.join(this.exportDir, filename);
    await fs.writeFile(
      filePath,
      JSON.stringify(report, null, 2),
      'utf-8'
    );
  }

  /**
   * Export report as CSV
   */
  private async exportCsv(report: ComplianceReport, filename: string): Promise<void> {
    const filePath = path.join(this.exportDir, filename);
    const csvRows: string[] = [];

    // Add header
    csvRows.push('Report Type,Timestamp,Data Type,Records Count,Status');

    // Add data retention status
    report.dataRetentionStatus.forEach(status => {
      csvRows.push(
        `${report.reportType},${format(report.timestamp, 'yyyy-MM-dd HH:mm:ss')},` +
        `${status.dataType},${status.recordsCount},${status.retentionCompliant ? 'Compliant' : 'Non-compliant'}`
      );
    });

    // Add consent status
    report.consentStatus.forEach(status => {
      csvRows.push(
        `${report.reportType},${format(report.timestamp, 'yyyy-MM-dd HH:mm:ss')},` +
        `Consent-${status.consentType},${status.activeConsents},Active`
      );
    });

    await fs.writeFile(filePath, csvRows.join('\n'), 'utf-8');
  }

  /**
   * Export report as PDF
   */
  private async exportPdf(report: ComplianceReport, filename: string): Promise<void> {
    // Implement PDF export using a PDF library
    // This is a placeholder for the actual implementation
    throw new Error('PDF export not yet implemented');
  }

  /**
   * Generate filename for export
   */
  private generateFilename(report: ComplianceReport, format: string): string {
    const timestamp = format(report.timestamp, 'yyyy-MM-dd_HH-mm-ss');
    return `compliance_report_${report.reportType}_${timestamp}.${format}`;
  }

  /**
   * Clean up old exports
   */
  async cleanupOldExports(): Promise<void> {
    try {
      const files = await fs.readdir(this.exportDir);
      const now = new Date();
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

      for (const file of files) {
        const filePath = path.join(this.exportDir, file);
        const stats = await fs.stat(filePath);
        const age = now.getTime() - stats.mtime.getTime();

        if (age > maxAge) {
          await fs.unlink(filePath);
          
          // Log deletion
          await this.auditLogger.logEvent({
            eventType: 'REPORT_EXPORT_DELETED',
            actor: {
              ipAddress: 'system',
              userAgent: 'system'
            },
            resource: {
              type: 'COMPLIANCE_REPORT',
              name: file
            },
            action: {
              type: 'DELETE_EXPORT',
              status: 'success',
              details: 'Deleted old export file'
            }
          });
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old exports:', error);
    }
  }
} 