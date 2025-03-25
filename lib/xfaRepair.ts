import { PDFDocument } from 'pdf-lib';
import { fileToArrayBuffer } from '../utils/fileUtils';
import { AuditLogger } from './auditLogger';

export interface XFAFormInfo {
  version: string;
  mode: 'static' | 'dynamic';
  fields: XFAFieldInfo[];
  isValid: boolean;
  errors?: string[];
}

export interface XFAFieldInfo {
  name: string;
  type: string;
  value?: string;
  isValid: boolean;
  errors?: string[];
}

export interface XFARepairResult {
  originalForm: XFAFormInfo;
  repairedForm: XFAFormInfo;
  wasRepaired: boolean;
  repairDetails: string[];
}

export class XFARepairService {
  private readonly supportedVersions = ['2.4', '2.5', '2.6', '2.7', '2.8', '3.0'];
  private readonly maxFieldSize = 1024 * 1024; // 1MB max field size
  private readonly auditLogger: AuditLogger;

  constructor(auditLogger: AuditLogger) {
    this.auditLogger = auditLogger;
  }

  /**
   * Analyze and repair XFA form in a PDF
   */
  async repairXFAForm(
    pdfFile: File | Uint8Array,
    requestInfo?: { ipAddress: string; userAgent: string }
  ): Promise<XFARepairResult> {
    const fileSize = pdfFile instanceof File ? pdfFile.size : pdfFile.length;
    const fileName = pdfFile instanceof File ? pdfFile.name : 'document.pdf';

    try {
      // Log start of XFA repair
      await this.auditLogger.logEvent({
        eventType: 'XFA_REPAIR_START',
        actor: {
          ipAddress: requestInfo?.ipAddress || 'unknown',
          userAgent: requestInfo?.userAgent || 'unknown'
        },
        resource: {
          type: 'PDF',
          name: fileName,
          size: fileSize
        },
        action: {
          type: 'REPAIR_XFA',
          status: 'success',
          details: 'Starting XFA form validation and repair'
        }
      });

      // Load PDF document
      const pdfData = pdfFile instanceof File
        ? await fileToArrayBuffer(pdfFile)
        : pdfFile;
      const pdfDoc = await PDFDocument.load(pdfData);

      // Extract XFA form information
      const originalForm = await this.extractXFAForm(pdfDoc);
      const repairDetails: string[] = [];
      let wasRepaired = false;

      // Repair form if invalid
      let repairedForm = originalForm;
      if (!originalForm.isValid) {
        repairedForm = await this.repairForm(originalForm);
        if (repairedForm.isValid) {
          wasRepaired = true;
          repairDetails.push('Repaired XFA form structure');

          // Log successful form repair
          await this.auditLogger.logEvent({
            eventType: 'XFA_FORM_REPAIR_SUCCESS',
            actor: {
              ipAddress: requestInfo?.ipAddress || 'unknown',
              userAgent: requestInfo?.userAgent || 'unknown'
            },
            resource: {
              type: 'XFA_FORM',
              name: fileName,
              id: repairedForm.version
            },
            action: {
              type: 'REPAIR_FORM',
              status: 'success',
              details: 'Repaired XFA form structure'
            }
          });
        } else {
          repairDetails.push('Could not repair XFA form structure');

          // Log failed form repair
          await this.auditLogger.logEvent({
            eventType: 'XFA_FORM_REPAIR_FAILURE',
            actor: {
              ipAddress: requestInfo?.ipAddress || 'unknown',
              userAgent: requestInfo?.userAgent || 'unknown'
            },
            resource: {
              type: 'XFA_FORM',
              name: fileName,
              id: originalForm.version
            },
            action: {
              type: 'REPAIR_FORM',
              status: 'failure',
              details: 'Could not repair XFA form structure'
            },
            metadata: {
              errors: originalForm.errors
            }
          });
        }
      }

      // Repair individual fields
      const repairedFields: XFAFieldInfo[] = [];
      for (const field of repairedForm.fields) {
        if (!field.isValid) {
          const repairedField = await this.repairField(field);
          if (repairedField.isValid) {
            wasRepaired = true;
            repairDetails.push(`Repaired field: ${field.name}`);
            repairedFields.push(repairedField);

            // Log successful field repair
            await this.auditLogger.logEvent({
              eventType: 'XFA_FIELD_REPAIR_SUCCESS',
              actor: {
                ipAddress: requestInfo?.ipAddress || 'unknown',
                userAgent: requestInfo?.userAgent || 'unknown'
              },
              resource: {
                type: 'XFA_FIELD',
                name: field.name,
                id: field.type
              },
              action: {
                type: 'REPAIR_FIELD',
                status: 'success',
                details: `Repaired field: ${field.name}`
              }
            });
          } else {
            repairDetails.push(`Could not repair field: ${field.name}`);
            repairedFields.push(field);

            // Log failed field repair
            await this.auditLogger.logEvent({
              eventType: 'XFA_FIELD_REPAIR_FAILURE',
              actor: {
                ipAddress: requestInfo?.ipAddress || 'unknown',
                userAgent: requestInfo?.userAgent || 'unknown'
              },
              resource: {
                type: 'XFA_FIELD',
                name: field.name,
                id: field.type
              },
              action: {
                type: 'REPAIR_FIELD',
                status: 'failure',
                details: `Could not repair field: ${field.name}`
              },
              metadata: {
                errors: field.errors
              }
            });
          }
        } else {
          repairedFields.push(field);
        }
      }

      repairedForm = {
        ...repairedForm,
        fields: repairedFields
      };

      const result = {
        originalForm,
        repairedForm,
        wasRepaired,
        repairDetails
      };

      // Log completion
      await this.auditLogger.logEvent({
        eventType: 'XFA_REPAIR_COMPLETE',
        actor: {
          ipAddress: requestInfo?.ipAddress || 'unknown',
          userAgent: requestInfo?.userAgent || 'unknown'
        },
        resource: {
          type: 'PDF',
          name: fileName,
          size: fileSize
        },
        action: {
          type: 'REPAIR_XFA',
          status: 'success',
          details: `Completed XFA repair: ${wasRepaired ? 'changes made' : 'no changes needed'}`
        },
        metadata: {
          formVersion: repairedForm.version,
          formMode: repairedForm.mode,
          totalFields: repairedForm.fields.length,
          repairedFields: repairDetails.length,
          details: repairDetails
        }
      });

      return result;
    } catch (error) {
      // Log error
      await this.auditLogger.logEvent({
        eventType: 'XFA_REPAIR_ERROR',
        actor: {
          ipAddress: requestInfo?.ipAddress || 'unknown',
          userAgent: requestInfo?.userAgent || 'unknown'
        },
        resource: {
          type: 'PDF',
          name: fileName,
          size: fileSize
        },
        action: {
          type: 'REPAIR_XFA',
          status: 'failure',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      throw error;
    }
  }

  /**
   * Extract XFA form from PDF document
   */
  private async extractXFAForm(pdfDoc: PDFDocument): Promise<XFAFormInfo> {
    try {
      const acroForm = pdfDoc.getForm();
      if (!acroForm) {
        return this.createEmptyFormInfo('No form found');
      }

      const xfa = this.getXFAStream(acroForm);
      if (!xfa) {
        return this.createEmptyFormInfo('No XFA stream found');
      }

      const version = this.extractXFAVersion(xfa);
      if (!this.supportedVersions.includes(version)) {
        return this.createEmptyFormInfo(`Unsupported XFA version: ${version}`);
      }

      const fields = await this.extractXFAFields(xfa);
      const errors = this.validateXFAStructure(xfa);

      return {
        version,
        mode: this.determineXFAMode(xfa),
        fields,
        isValid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      return this.createEmptyFormInfo('Failed to extract XFA form');
    }
  }

  /**
   * Get XFA stream from AcroForm
   */
  private getXFAStream(acroForm: any): any {
    try {
      const xfa = acroForm.acroForm.dict.get('XFA');
      return xfa || null;
    } catch {
      return null;
    }
  }

  /**
   * Extract XFA version
   */
  private extractXFAVersion(xfa: any): string {
    try {
      const config = this.findXFAElement(xfa, 'config');
      return config?.getAttribute('version') || '2.8';
    } catch {
      return '2.8';
    }
  }

  /**
   * Determine XFA mode
   */
  private determineXFAMode(xfa: any): 'static' | 'dynamic' {
    try {
      const config = this.findXFAElement(xfa, 'config');
      const present = this.findXFAElement(xfa, 'present');
      return present ? 'dynamic' : 'static';
    } catch {
      return 'static';
    }
  }

  /**
   * Extract XFA fields
   */
  private async extractXFAFields(xfa: any): Promise<XFAFieldInfo[]> {
    const fields: XFAFieldInfo[] = [];
    try {
      const template = this.findXFAElement(xfa, 'template');
      if (template) {
        this.traverseXFAFields(template, fields);
      }
    } catch (error) {
      console.warn('Failed to extract XFA fields:', error);
    }
    return fields;
  }

  /**
   * Traverse XFA fields recursively
   */
  private traverseXFAFields(node: any, fields: XFAFieldInfo[]): void {
    try {
      if (node.nodeName === 'field') {
        fields.push(this.createFieldInfo(node));
      }
      for (const child of node.childNodes || []) {
        this.traverseXFAFields(child, fields);
      }
    } catch (error) {
      console.warn('Failed to traverse XFA node:', error);
    }
  }

  /**
   * Create field info from XFA node
   */
  private createFieldInfo(node: any): XFAFieldInfo {
    try {
      const name = node.getAttribute('name') || 'unnamed';
      const type = node.getAttribute('type') || 'text';
      const value = this.getFieldValue(node);
      const errors = this.validateField(node);

      return {
        name,
        type,
        value,
        isValid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      return {
        name: 'unknown',
        type: 'unknown',
        isValid: false,
        errors: ['Failed to create field info']
      };
    }
  }

  /**
   * Get field value from XFA node
   */
  private getFieldValue(node: any): string | undefined {
    try {
      const value = node.getAttribute('value');
      return value ? value.toString() : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Validate XFA structure
   */
  private validateXFAStructure(xfa: any): string[] {
    const errors: string[] = [];

    try {
      if (!this.findXFAElement(xfa, 'template')) {
        errors.push('Missing template element');
      }
      if (!this.findXFAElement(xfa, 'config')) {
        errors.push('Missing config element');
      }
      if (!this.findXFAElement(xfa, 'localeSet')) {
        errors.push('Missing localeSet element');
      }
    } catch (error) {
      errors.push('Failed to validate XFA structure');
    }

    return errors;
  }

  /**
   * Validate individual field
   */
  private validateField(node: any): string[] {
    const errors: string[] = [];

    try {
      if (!node.getAttribute('name')) {
        errors.push('Missing field name');
      }
      if (!node.getAttribute('type')) {
        errors.push('Missing field type');
      }

      const value = node.getAttribute('value');
      if (value && value.length > this.maxFieldSize) {
        errors.push('Field value exceeds size limit');
      }
    } catch (error) {
      errors.push('Failed to validate field');
    }

    return errors;
  }

  /**
   * Find XFA element by name
   */
  private findXFAElement(xfa: any, name: string): any {
    try {
      return xfa.getElementsByTagName(name)[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * Create empty form info
   */
  private createEmptyFormInfo(error: string): XFAFormInfo {
    return {
      version: '2.8',
      mode: 'static',
      fields: [],
      isValid: false,
      errors: [error]
    };
  }

  /**
   * Repair XFA form
   */
  private async repairForm(form: XFAFormInfo): Promise<XFAFormInfo> {
    // Implementation would depend on specific form issues
    // For now, return original form
    return form;
  }

  /**
   * Repair individual field
   */
  private async repairField(field: XFAFieldInfo): Promise<XFAFieldInfo> {
    // Implementation would depend on specific field issues
    // For now, return original field
    return field;
  }
} 