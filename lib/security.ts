import { PDFSecurityResult } from './types';
import crypto from 'crypto';

// Constants for security limits
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB max file size
const MIN_FILE_SIZE = 100; // Minimum PDF size (bytes)
const MAX_CONCURRENT_UPLOADS = 5;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

// Track upload counts and timestamps for rate limiting
const uploadTracker = new Map<string, { count: number; timestamp: number }>();

export interface FileValidationOptions {
  maxSize?: number;
  minSize?: number;
  allowedTypes?: string[];
}

export async function validateFileUpload(fileData: Uint8Array, clientId: string): Promise<PDFSecurityResult> {
  try {
    // Basic validation
    if (!fileData || fileData.length === 0) {
      return {
        isValid: false,
        error: 'Invalid file data provided',
        securityLevel: 'HIGH'
      };
    }

    // Check file size (max 100MB)
    if (fileData.length > MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: 'File size exceeds maximum limit',
        securityLevel: 'HIGH'
      };
    }

    // Rate limiting check (example implementation)
    const isRateLimited = await checkRateLimit(clientId);
    if (isRateLimited) {
      return {
        isValid: false,
        error: 'Rate limit exceeded for client',
        securityLevel: 'HIGH'
      };
    }

    // Basic PDF header check
    const pdfHeader = new TextDecoder().decode(fileData.slice(0, 5));
    if (pdfHeader !== '%PDF-') {
      return {
        isValid: false,
        error: 'Invalid PDF header',
        securityLevel: 'HIGH'
      };
    }

    return {
      isValid: true,
      securityLevel: 'LOW'
    };
  } catch (error) {
    return {
      isValid: false,
      error: `Security validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      securityLevel: 'CRITICAL'
    };
  }
}

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const clientData = uploadTracker.get(clientId);

  if (!clientData) {
    uploadTracker.set(clientId, { count: 1, timestamp: now });
    return true;
  }

  if (now - clientData.timestamp > RATE_LIMIT_WINDOW) {
    // Reset window
    uploadTracker.set(clientId, { count: 1, timestamp: now });
    return true;
  }

  if (clientData.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  clientData.count++;
  return true;
}

async function validatePDFSignature(file: ArrayBuffer): Promise<boolean> {
  const header = new Uint8Array(file.slice(0, 5));
  const signature = new TextDecoder().decode(header);
  return signature.startsWith('%PDF-');
}

async function generateFileHash(file: ArrayBuffer): Promise<string> {
  const hash = crypto.createHash('sha256');
  hash.update(Buffer.from(file));
  return hash.digest('hex');
}

function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  Array.from(uploadTracker.entries()).forEach(([clientId, data]) => {
    if (now - data.timestamp > RATE_LIMIT_WINDOW) {
      uploadTracker.delete(clientId);
    }
  });
}, RATE_LIMIT_WINDOW); 