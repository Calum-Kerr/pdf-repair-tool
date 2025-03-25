import { PDFDocument } from 'pdf-lib';
import { fileToArrayBuffer } from '../utils/fileUtils';
import { AuditLogger } from './auditLogger';

export interface SignatureInfo {
  type: 'certification' | 'approval';
  signerName: string;
  signatureDate: Date;
  isValid: boolean;
  errors?: string[];
}

export interface SignatureRepairResult {
  originalSignatures: SignatureInfo[];
  repairedSignatures: SignatureInfo[];
  wasRepaired: boolean;
  repairDetails: string[];
}

export class SignatureRepairService {
  private readonly maxSignatureSize = 10 * 1024 * 1024; // 10MB max signature size
  private readonly auditLogger: AuditLogger;

  constructor(auditLogger: AuditLogger) {
    this.auditLogger = auditLogger;
  }

  /**
   * Analyze and repair digital signatures in a PDF
   */
  async repairSignatures(
    pdfFile: File | Uint8Array,
    requestInfo?: { ipAddress: string; userAgent: string }
  ): Promise<SignatureRepairResult> {
    const fileSize = pdfFile instanceof File ? pdfFile.size : pdfFile.length;
    const fileName = pdfFile instanceof File ? pdfFile.name : 'document.pdf';

    try {
      // Log start of signature repair
      await this.auditLogger.logEvent({
        eventType: 'SIGNATURE_REPAIR_START',
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
          type: 'REPAIR_SIGNATURES',
          status: 'success',
          details: 'Starting signature validation and repair'
        }
      });

      // Load PDF document
      const pdfData = pdfFile instanceof File
        ? await fileToArrayBuffer(pdfFile)
        : pdfFile;
      const pdfDoc = await PDFDocument.load(pdfData);

      // Get original signatures
      const originalSignatures = await this.extractSignatures(pdfDoc);
      const repairDetails: string[] = [];
      let wasRepaired = false;

      // Check each signature
      const repairedSignatures: SignatureInfo[] = [];
      for (const sig of originalSignatures) {
        if (!sig.isValid) {
          const repairedSig = await this.repairSignature(sig);
          if (repairedSig.isValid) {
            wasRepaired = true;
            repairDetails.push(`Repaired ${sig.type} signature for ${sig.signerName}`);
            repairedSignatures.push(repairedSig);

            // Log successful repair
            await this.auditLogger.logEvent({
              eventType: 'SIGNATURE_REPAIR_SUCCESS',
              actor: {
                ipAddress: requestInfo?.ipAddress || 'unknown',
                userAgent: requestInfo?.userAgent || 'unknown'
              },
              resource: {
                type: 'PDF_SIGNATURE',
                name: sig.signerName,
                id: sig.type
              },
              action: {
                type: 'REPAIR_SIGNATURE',
                status: 'success',
                details: `Repaired ${sig.type} signature for ${sig.signerName}`
              }
            });
          } else {
            repairDetails.push(`Could not repair ${sig.type} signature for ${sig.signerName}`);
            repairedSignatures.push(sig);

            // Log failed repair
            await this.auditLogger.logEvent({
              eventType: 'SIGNATURE_REPAIR_FAILURE',
              actor: {
                ipAddress: requestInfo?.ipAddress || 'unknown',
                userAgent: requestInfo?.userAgent || 'unknown'
              },
              resource: {
                type: 'PDF_SIGNATURE',
                name: sig.signerName,
                id: sig.type
              },
              action: {
                type: 'REPAIR_SIGNATURE',
                status: 'failure',
                details: `Could not repair ${sig.type} signature for ${sig.signerName}`
              },
              metadata: {
                errors: sig.errors
              }
            });
          }
        } else {
          repairedSignatures.push(sig);
        }
      }

      const result = {
        originalSignatures,
        repairedSignatures,
        wasRepaired,
        repairDetails
      };

      // Log completion
      await this.auditLogger.logEvent({
        eventType: 'SIGNATURE_REPAIR_COMPLETE',
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
          type: 'REPAIR_SIGNATURES',
          status: 'success',
          details: `Completed signature repair: ${wasRepaired ? 'changes made' : 'no changes needed'}`
        },
        metadata: {
          totalSignatures: originalSignatures.length,
          repairedCount: repairDetails.length,
          details: repairDetails
        }
      });

      return result;
    } catch (error) {
      // Log error
      await this.auditLogger.logEvent({
        eventType: 'SIGNATURE_REPAIR_ERROR',
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
          type: 'REPAIR_SIGNATURES',
          status: 'failure',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      throw error;
    }
  }

  /**
   * Extract signatures from PDF document
   */
  private async extractSignatures(pdfDoc: PDFDocument): Promise<SignatureInfo[]> {
    const signatures: SignatureInfo[] = [];
    const acroForm = pdfDoc.getForm();
    
    if (!acroForm) {
      return signatures;
    }

    const fields = acroForm.getFields();
    for (const field of fields) {
      if (field.constructor.name === 'PDFSignature') {
        try {
          const sigField = field as any; // Type assertion needed as pdf-lib doesn't expose signature types
          const sigDict = sigField.acroField.dict;

          signatures.push({
            type: this.getSignatureType(sigDict),
            signerName: this.extractSignerName(sigDict),
            signatureDate: this.extractSignatureDate(sigDict),
            isValid: this.validateSignature(sigDict),
            errors: this.getSignatureErrors(sigDict)
          });
        } catch (error) {
          console.warn('Failed to extract signature:', error);
        }
      }
    }

    return signatures;
  }

  /**
   * Repair a single signature
   */
  private async repairSignature(signature: SignatureInfo): Promise<SignatureInfo> {
    // Implementation would depend on specific signature issues
    // For now, return original signature
    return signature;
  }

  /**
   * Get signature type from dictionary
   */
  private getSignatureType(sigDict: any): 'certification' | 'approval' {
    try {
      const sigFlags = sigDict.get('SigFlags');
      return sigFlags === 3 ? 'certification' : 'approval';
    } catch {
      return 'approval';
    }
  }

  /**
   * Extract signer name from dictionary
   */
  private extractSignerName(sigDict: any): string {
    try {
      const name = sigDict.get('Name');
      return name ? name.toString() : 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Extract signature date from dictionary
   */
  private extractSignatureDate(sigDict: any): Date {
    try {
      const date = sigDict.get('M');
      return date ? new Date(date) : new Date();
    } catch {
      return new Date();
    }
  }

  /**
   * Validate signature dictionary
   */
  private validateSignature(sigDict: any): boolean {
    try {
      // Basic structure validation
      if (!sigDict.has('Type') || !sigDict.has('Filter') || !sigDict.has('SubFilter')) {
        return false;
      }

      // Size validation
      const sigBytes = sigDict.get('Contents');
      if (!sigBytes || sigBytes.length > this.maxSignatureSize) {
        return false;
      }

      // Additional validation would be needed for cryptographic verification
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get signature validation errors
   */
  private getSignatureErrors(sigDict: any): string[] {
    const errors: string[] = [];

    try {
      if (!sigDict.has('Type')) {
        errors.push('Missing signature type');
      }
      if (!sigDict.has('Filter')) {
        errors.push('Missing signature filter');
      }
      if (!sigDict.has('SubFilter')) {
        errors.push('Missing signature subfilter');
      }
      if (!sigDict.has('Name')) {
        errors.push('Missing signer name');
      }
      if (!sigDict.has('M')) {
        errors.push('Missing signature date');
      }

      const sigBytes = sigDict.get('Contents');
      if (!sigBytes) {
        errors.push('Missing signature data');
      } else if (sigBytes.length > this.maxSignatureSize) {
        errors.push('Signature data exceeds size limit');
      }
    } catch (error) {
      errors.push('Failed to validate signature structure');
    }

    return errors;
  }
} 