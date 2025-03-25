import { PDFValidationResult } from './types';

const MAX_HEADER_SIZE = 1024; // Maximum size to scan for PDF header
const PDF_HEADER_PATTERN = /%PDF-\d\.\d/;
const MAX_XREF_ENTRIES = 1000000; // Reasonable limit for number of objects
const MAX_STREAM_SIZE = 100 * 1024 * 1024; // 100MB max stream size

export function validatePDFStructure(buffer: ArrayBuffer): PDFValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let isValid = true;

  try {
    // Convert buffer to Uint8Array for easier processing
    const data = new Uint8Array(buffer);
    
    // 1. Validate PDF Header
    const headerValid = validatePDFHeader(data);
    if (!headerValid.valid) {
      errors.push(headerValid.error || 'Unknown PDF header error');
      isValid = false;
    }

    // 2. Validate Cross-Reference Table
    const xrefValid = validateXRefTable(data);
    if (!xrefValid.valid) {
      errors.push(xrefValid.error || 'Unknown cross-reference table error');
      isValid = false;
    }

    // 3. Validate Object Streams
    const streamValid = validateObjectStreams(data);
    if (!streamValid.valid) {
      errors.push(streamValid.error || 'Unknown object stream error');
      isValid = false;
    }

    return {
      isValid,
      errors,
      warnings,
      details: {
        headerValid: headerValid.valid,
        xrefValid: xrefValid.valid,
        streamValid: streamValid.valid
      }
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [`Fatal error during PDF validation: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings: [],
      details: {
        headerValid: false,
        xrefValid: false,
        streamValid: false
      }
    };
  }
}

function validatePDFHeader(data: Uint8Array): { valid: boolean; error?: string } {
  // Check first 1024 bytes for PDF header signature
  const headerText = new TextDecoder().decode(data.slice(0, MAX_HEADER_SIZE));
  
  if (!PDF_HEADER_PATTERN.test(headerText)) {
    return {
      valid: false,
      error: 'Invalid PDF header: Missing or malformed PDF version signature'
    };
  }
  
  return { valid: true };
}

function validateXRefTable(data: Uint8Array): { valid: boolean; error?: string } {
  try {
    // Find 'startxref' position
    const dataText = new TextDecoder().decode(data);
    const startXrefPos = dataText.lastIndexOf('startxref');
    
    if (startXrefPos === -1) {
      return {
        valid: false,
        error: 'Invalid PDF structure: Missing startxref marker'
      };
    }

    // Basic validation of xref entries count
    const xrefMatch = dataText.match(/xref\s+\d+\s+(\d+)/);
    if (xrefMatch && parseInt(xrefMatch[1]) > MAX_XREF_ENTRIES) {
      return {
        valid: false,
        error: `Invalid xref table: Too many entries (${xrefMatch[1]} > ${MAX_XREF_ENTRIES})`
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: 'Error validating cross-reference table'
    };
  }
}

function validateObjectStreams(data: Uint8Array): { valid: boolean; error?: string } {
  try {
    const dataText = new TextDecoder().decode(data);
    const streamMatches = dataText.match(/stream\s*([\s\S]*?)\s*endstream/g);

    if (!streamMatches) {
      return { valid: true }; // No streams to validate
    }

    for (let i = 0; i < streamMatches.length; i++) {
      const streamSize = streamMatches[i].length;
      if (streamSize > MAX_STREAM_SIZE) {
        return {
          valid: false,
          error: `Object stream ${i + 1} exceeds maximum allowed size (${streamSize} > ${MAX_STREAM_SIZE} bytes)`
        };
      }
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: 'Error validating object streams'
    };
  }
} 