export interface PDFValidationResult {
  isValid: boolean;
  errors: PDFErrorMessage[];
}

export interface PDFCorruptionResult {
  isCorrupted: boolean;
  corruptions: {
    header: string[];
    xref: string[];
    streams: string[];
  };
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  repairStrategy: string[];
}

export interface PDFRecoveryResult {
  success: boolean;
  message: string;
  recoveredData: Uint8Array;
  appliedStrategy: string;
}

export interface PDFSecurityResult {
  isValid: boolean;
  error?: string;
  securityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  fileHash?: string;
}

export interface PDFRepairResult {
  isValid: boolean;
  error?: string;
  securityLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  repairedPDF?: Buffer;
  repairDetails?: {
    originalSize: number;
    repairedSize: number;
    repairActions: string[];
    recoveredObjects: number;
  };
}

export interface PDFErrorMessage {
  type: PDFErrorMessageType;
  message: string;
  location?: {
    offset: number;
    length: number;
  };
}

export enum PDFErrorMessageType {
  HEADER_ERROR = 'HEADER_ERROR',
  XREF_ERROR = 'XREF_ERROR',
  TRAILER_ERROR = 'TRAILER_ERROR',
  OBJECT_ERROR = 'OBJECT_ERROR',
  STREAM_ERROR = 'STREAM_ERROR',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  STRUCTURE_ERROR = 'STRUCTURE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export async function validatePDF(pdfBuffer: Buffer): Promise<PDFValidationResult> {
  try {
    const errors: PDFErrorMessage[] = [];

    // Check PDF header
    const header = pdfBuffer.slice(0, 5).toString();
    if (header !== '%PDF-') {
      errors.push({
        type: PDFErrorMessageType.HEADER_ERROR,
        message: 'Invalid PDF header',
        location: { offset: 0, length: 5 }
      });
    }

    // Check for EOF marker
    const lastBytes = pdfBuffer.slice(-6).toString();
    if (!lastBytes.includes('%%EOF')) {
      errors.push({
        type: PDFErrorMessageType.STRUCTURE_ERROR,
        message: 'Missing EOF marker',
        location: { offset: pdfBuffer.length - 6, length: 6 }
      });
    }

    // Basic structure validation
    const content = pdfBuffer.toString();
    
    // Check for xref table
    if (!content.includes('xref')) {
      errors.push({
        type: PDFErrorMessageType.XREF_ERROR,
        message: 'Missing xref table'
      });
    }

    // Check for trailer
    if (!content.includes('trailer')) {
      errors.push({
        type: PDFErrorMessageType.TRAILER_ERROR,
        message: 'Missing trailer'
      });
    }

    // Check for encryption (not supported in this version)
    if (content.includes('/Encrypt')) {
      errors.push({
        type: PDFErrorMessageType.ENCRYPTION_ERROR,
        message: 'Encrypted PDFs are not supported'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [{
        type: PDFErrorMessageType.UNKNOWN_ERROR,
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]
    };
  }
}

export interface AuditEvent {
  eventType: string;
  actor: {
    id?: string;
    email?: string;
    ipAddress: string;
    userAgent: string;
  };
  resource: {
    type: string;
    id?: string;
    name?: string;
    size?: number;
  };
  action: {
    type: string;
    status: 'success' | 'failure';
    details?: string;
  };
  metadata?: Record<string, any>;
  timestamp: string;
} 