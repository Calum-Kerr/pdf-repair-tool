import { PDFRecoveryResult, PDFErrorMessageType } from './types';

const PDF_HEADER_TEMPLATE = '%PDF-1.7\n%����\n';
const XREF_ENTRY_TEMPLATE = '0000000000 65535 f\n';

export async function applyRecoveryStrategy(
  buffer: ArrayBuffer,
  errorType: PDFErrorMessageType,
  details?: string
): Promise<PDFRecoveryResult> {
  try {
    const data = new Uint8Array(buffer);
    let recoveredData: Uint8Array;
    let recoveryMethod = '';
    let success = false;

    switch (errorType) {
      case 'MISSING_HEADER':
        ({ recoveredData, success } = recoverHeader(data));
        recoveryMethod = 'Header reconstruction';
        break;

      case 'MISSING_XREF':
        ({ recoveredData, success } = await recoverXRefTable(data));
        recoveryMethod = 'Cross-reference table rebuild';
        break;

      case 'MISMATCHED_STREAM':
        ({ recoveredData, success } = fixStreamDelimiters(data));
        recoveryMethod = 'Stream delimiter correction';
        break;

      case 'CORRUPTED_TEXT':
        ({ recoveredData, success } = await recoverTextContent(data));
        recoveryMethod = 'Text content recovery';
        break;

      case 'CORRUPTED_IMAGE':
        ({ recoveredData, success } = await recoverImageData(data));
        recoveryMethod = 'Image data recovery';
        break;

      case 'BROKEN_ENCRYPTION':
        ({ recoveredData, success } = removeEncryption(data));
        recoveryMethod = 'Encryption removal';
        break;

      default:
        return {
          success: false,
          message: 'No recovery strategy available for this error type',
          recoveredData: data,
          appliedStrategy: 'none'
        };
    }

    return {
      success,
      message: success ? 'Recovery completed successfully' : 'Recovery partially completed with issues',
      recoveredData,
      appliedStrategy: recoveryMethod
    };
  } catch (error) {
    return {
      success: false,
      message: `Recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      recoveredData: new Uint8Array(buffer),
      appliedStrategy: 'failed'
    };
  }
}

function recoverHeader(data: Uint8Array): { recoveredData: Uint8Array; success: boolean } {
  const headerBuffer = new TextEncoder().encode(PDF_HEADER_TEMPLATE);
  const recoveredData = new Uint8Array(headerBuffer.length + data.length);
  recoveredData.set(headerBuffer);
  recoveredData.set(data, headerBuffer.length);
  
  return { recoveredData, success: true };
}

async function recoverXRefTable(data: Uint8Array): Promise<{ recoveredData: Uint8Array; success: boolean }> {
  try {
    // Find all object definitions
    const text = new TextDecoder().decode(data);
    const objectMatches = text.match(/(\d+)\s+\d+\s+obj[\s\S]*?endobj/g) || [];
    
    // Create new xref table
    const xrefEntries = objectMatches.map((_, index) => {
      const offset = text.indexOf(objectMatches[index]);
      return `${offset.toString().padStart(10, '0')} 00000 n\n`;
    });
    
    // Add header entry
    xrefEntries.unshift(XREF_ENTRY_TEMPLATE);
    
    // Create xref section
    const xrefTable = `xref\n0 ${xrefEntries.length}\n${xrefEntries.join('')}`;
    const xrefBuffer = new TextEncoder().encode(xrefTable);
    
    // Combine original data with new xref table
    const recoveredData = new Uint8Array(data.length + xrefBuffer.length);
    recoveredData.set(data);
    recoveredData.set(xrefBuffer, data.length - 6); // Leave room for %%EOF
    
    return { recoveredData, success: true };
  } catch (error) {
    return { recoveredData: data, success: false };
  }
}

function fixStreamDelimiters(data: Uint8Array): { recoveredData: Uint8Array; success: boolean } {
  try {
    let text = new TextDecoder().decode(data);
    
    // Fix missing newlines after stream
    text = text.replace(/stream(?!\n)/g, 'stream\n');
    
    // Fix missing newlines before endstream
    text = text.replace(/(?<!\n)endstream/g, '\nendstream');
    
    // Recalculate stream lengths
    text = text.replace(/\/Length\s+\d+[\s\S]*?stream\n([\s\S]*?)\nendstream/g, 
      (match, streamContent) => {
        const length = streamContent.length;
        return `/Length ${length}\nstream\n${streamContent}\nendstream`;
      });
    
    const recoveredData = new TextEncoder().encode(text);
    return { recoveredData, success: true };
  } catch (error) {
    return { recoveredData: data, success: false };
  }
}

async function recoverTextContent(data: Uint8Array): Promise<{ recoveredData: Uint8Array; success: boolean }> {
  try {
    let text = new TextDecoder().decode(data);
    
    // Fix text encoding issues
    text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
    
    // Fix common text stream corruption patterns
    text = text.replace(/<([^>]+)>/g, '($1)'); // Fix broken text markers
    text = text.replace(/\(\\[\d]{3}\)/g, ' '); // Remove broken escape sequences
    
    const recoveredData = new TextEncoder().encode(text);
    return { recoveredData, success: true };
  } catch (error) {
    return { recoveredData: data, success: false };
  }
}

async function recoverImageData(data: Uint8Array): Promise<{ recoveredData: Uint8Array; success: boolean }> {
  try {
    let text = new TextDecoder().decode(data);
    
    // Remove corrupted image streams while preserving structure
    text = text.replace(
      /\/Subtype\s*\/Image[\s\S]*?stream[\s\S]*?endstream/g,
      '/Subtype /Image\n/Width 0\n/Height 0\n/BitsPerComponent 8\n/ColorSpace /DeviceRGB\n>>\nstream\nendstream'
    );
    
    const recoveredData = new TextEncoder().encode(text);
    return { recoveredData, success: true };
  } catch (error) {
    return { recoveredData: data, success: false };
  }
}

function removeEncryption(data: Uint8Array): { recoveredData: Uint8Array; success: boolean } {
  try {
    let text = new TextDecoder().decode(data);
    
    // Remove encryption dictionary
    text = text.replace(/\/Encrypt\s*<<[\s\S]*?>>/g, '');
    
    // Remove encryption references
    text = text.replace(/\/Encrypt\s+\d+\s+\d+\s+R/g, '');
    
    const recoveredData = new TextEncoder().encode(text);
    return { recoveredData, success: true };
  } catch (error) {
    return { recoveredData: data, success: false };
  }
} 