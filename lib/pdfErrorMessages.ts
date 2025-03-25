import { PDFErrorMessageType } from './types';

const ERROR_MESSAGES: Record<PDFErrorMessageType, string> = {
  // Header Errors
  MISSING_HEADER: 'The PDF header is missing. This indicates a severely corrupted or invalid PDF file.',
  INVALID_VERSION: 'The PDF version number is invalid. The file may have been corrupted during creation or transfer.',
  MALFORMED_HEADER: 'The PDF header is malformed. This may affect the file\'s compatibility with PDF readers.',
  
  // Cross-Reference Table Errors
  MISSING_XREF: 'The cross-reference table is missing. This will affect the PDF\'s internal structure.',
  INVALID_XREF_ENTRY: 'One or more cross-reference entries are invalid. This may cause issues with object references.',
  XREF_OVERFLOW: 'The cross-reference table contains too many entries. This may indicate file corruption.',
  
  // Stream Errors
  MISMATCHED_STREAM: 'Stream begin/end markers are mismatched. This affects embedded content integrity.',
  INVALID_STREAM_LENGTH: 'Stream length is invalid. This may cause issues with content extraction.',
  CORRUPTED_STREAM_DATA: 'Stream data is corrupted. Some content may be unreadable or missing.',
  
  // Object Errors
  INVALID_OBJECT: 'Invalid object structure detected. This affects internal PDF organization.',
  MISSING_OBJECT: 'Required PDF object is missing. This may cause rendering issues.',
  DUPLICATE_OBJECT: 'Duplicate object IDs found. This creates reference ambiguity.',
  
  // Content Errors
  CORRUPTED_TEXT: 'Text content is corrupted. Some text may be unreadable.',
  CORRUPTED_IMAGE: 'Image data is corrupted. Some images may not display correctly.',
  CORRUPTED_FONT: 'Font data is corrupted. This may affect text rendering.',
  
  // Structure Errors
  BROKEN_TREE: 'Document structure tree is broken. This affects document navigation.',
  INVALID_PAGE_TREE: 'Page tree is invalid. This may cause issues with page access.',
  BROKEN_LINKS: 'Internal links are broken. Navigation within the document may fail.',
  
  // Encryption Errors
  BROKEN_ENCRYPTION: 'PDF encryption is broken. This affects secure access to the document.',
  INVALID_PASSWORD: 'Password protection is corrupted. This prevents normal document access.',
  
  // Metadata Errors
  CORRUPTED_METADATA: 'Document metadata is corrupted. This affects document properties.',
  INVALID_PERMISSIONS: 'Permission settings are invalid. This affects document usage rights.'
};

export function getErrorMessage(type: PDFErrorMessageType): string {
  return ERROR_MESSAGES[type] || 'Unknown PDF error occurred.';
}

export function getDetailedErrorMessage(type: PDFErrorMessageType, details?: string): string {
  const baseMessage = ERROR_MESSAGES[type];
  if (!details) return baseMessage;
  return `${baseMessage}\nDetails: ${details}`;
}

export function formatErrorMessages(errors: Array<{ type: PDFErrorMessageType; details?: string }>): string[] {
  return errors.map(error => getDetailedErrorMessage(error.type, error.details));
}

export function getSeverityLevel(type: PDFErrorMessageType): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  switch (type) {
    case 'MISSING_HEADER':
    case 'BROKEN_ENCRYPTION':
    case 'MISSING_XREF':
      return 'CRITICAL';
    
    case 'INVALID_OBJECT':
    case 'CORRUPTED_STREAM_DATA':
    case 'INVALID_PAGE_TREE':
      return 'HIGH';
    
    case 'CORRUPTED_TEXT':
    case 'CORRUPTED_IMAGE':
    case 'BROKEN_LINKS':
      return 'MEDIUM';
    
    case 'CORRUPTED_METADATA':
    case 'INVALID_PERMISSIONS':
      return 'LOW';
    
    default:
      return 'MEDIUM';
  }
}

export function getRepairRecommendation(type: PDFErrorMessageType): string {
  switch (type) {
    case 'MISSING_HEADER':
      return 'Reconstruct PDF header with correct version';
    case 'MISSING_XREF':
      return 'Rebuild cross-reference table from document objects';
    case 'MISMATCHED_STREAM':
      return 'Fix stream delimiters and recalculate lengths';
    case 'CORRUPTED_TEXT':
      return 'Extract and rewrite text content';
    case 'CORRUPTED_IMAGE':
      return 'Recover image data or remove corrupted images';
    case 'BROKEN_ENCRYPTION':
      return 'Remove encryption and resave document';
    default:
      return 'Analyze and repair affected components';
  }
} 