/**
 * Format a file size in bytes to a human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Check if a file is a valid PDF
 */
export function isValidPDF(file: File): boolean {
  return (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  );
}

/**
 * Generate a unique file ID
 */
export function generateFileId(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

/**
 * Extract file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
}

/**
 * Check if file size is within limits
 */
export function isFileSizeValid(file: File, maxSize: number): boolean {
  return file.size <= maxSize;
}

/**
 * Convert a File object to an ArrayBuffer
 */
export async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Convert an ArrayBuffer to a Blob
 */
export function arrayBufferToBlob(
  buffer: ArrayBuffer,
  mimeType: string
): Blob {
  return new Blob([buffer], { type: mimeType });
}

/**
 * Create a download URL for a Blob
 */
export function createDownloadUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/**
 * Clean up a download URL
 */
export function revokeDownloadUrl(url: string): void {
  URL.revokeObjectURL(url);
}

/**
 * Validate multiple files
 */
export function validateFiles(
  files: File[],
  options: {
    maxSize?: number;
    allowedTypes?: string[];
    maxFiles?: number;
  } = {}
): {
  valid: File[];
  invalid: Array<{ file: File; reason: string }>;
} {
  const {
    maxSize = 500 * 1024 * 1024, // 500MB default
    allowedTypes = ['application/pdf'],
    maxFiles = 50,
  } = options;

  const valid: File[] = [];
  const invalid: Array<{ file: File; reason: string }> = [];

  if (files.length > maxFiles) {
    files.slice(maxFiles).forEach(file => {
      invalid.push({
        file,
        reason: `Maximum number of files (${maxFiles}) exceeded`,
      });
    });
    files = files.slice(0, maxFiles);
  }

  files.forEach(file => {
    if (!allowedTypes.includes(file.type)) {
      invalid.push({
        file,
        reason: 'Invalid file type',
      });
    } else if (file.size > maxSize) {
      invalid.push({
        file,
        reason: `File size exceeds maximum limit of ${formatFileSize(maxSize)}`,
      });
    } else {
      valid.push(file);
    }
  });

  return { valid, invalid };
} 