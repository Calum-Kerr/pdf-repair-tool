import { validateFileUpload } from '../../lib/security';
import { PDFSecurityResult } from '../../lib/types';

describe('Security Module Tests', () => {
  const validPDFHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D]); // %PDF-
  const maxTestSize = 100 * 1024 * 1024; // 100MB
  const minTestSize = 100; // 100 bytes

  beforeEach(() => {
    // Reset rate limiting between tests
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('validateFileUpload', () => {
    test('should accept valid PDF file', async () => {
      const validPDF = new ArrayBuffer(1024);
      const view = new Uint8Array(validPDF);
      validPDFHeader.forEach((byte, i) => view[i] = byte);

      const result = await validateFileUpload(validPDF, 'test-client');
      expect(result.isValid).toBe(true);
      expect(result.securityLevel).toBe('LOW');
    });

    test('should reject oversized file', async () => {
      const oversizedPDF = new ArrayBuffer(maxTestSize + 1);
      const result = await validateFileUpload(oversizedPDF, 'test-client');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('exceeds maximum allowed size');
      expect(result.securityLevel).toBe('HIGH');
    });

    test('should reject undersized file', async () => {
      const undersizedPDF = new ArrayBuffer(minTestSize - 1);
      const result = await validateFileUpload(undersizedPDF, 'test-client');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('below minimum required size');
      expect(result.securityLevel).toBe('HIGH');
    });

    test('should reject invalid PDF signature', async () => {
      const invalidPDF = new ArrayBuffer(1024);
      const result = await validateFileUpload(invalidPDF, 'test-client');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid PDF file format');
      expect(result.securityLevel).toBe('HIGH');
    });

    test('should enforce rate limiting', async () => {
      const validPDF = new ArrayBuffer(1024);
      const view = new Uint8Array(validPDF);
      validPDFHeader.forEach((byte, i) => view[i] = byte);

      // Make maximum allowed requests
      for (let i = 0; i < 10; i++) {
        await validateFileUpload(validPDF, 'rate-limit-test');
      }

      // Next request should be rejected
      const result = await validateFileUpload(validPDF, 'rate-limit-test');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
      expect(result.securityLevel).toBe('HIGH');

      // After time window, should accept again
      jest.advanceTimersByTime(60 * 1000);
      const newResult = await validateFileUpload(validPDF, 'rate-limit-test');
      expect(newResult.isValid).toBe(true);
    });

    test('should handle custom validation options', async () => {
      const customMaxSize = 1024; // 1KB
      const validPDF = new ArrayBuffer(512);
      const view = new Uint8Array(validPDF);
      validPDFHeader.forEach((byte, i) => view[i] = byte);

      const result = await validateFileUpload(validPDF, 'test-client', {
        maxSize: customMaxSize,
        minSize: 100
      });

      expect(result.isValid).toBe(true);
      expect(result.securityLevel).toBe('LOW');

      // Test with file larger than custom max size
      const oversizedPDF = new ArrayBuffer(customMaxSize + 1);
      const oversizedResult = await validateFileUpload(oversizedPDF, 'test-client', {
        maxSize: customMaxSize,
        minSize: 100
      });

      expect(oversizedResult.isValid).toBe(false);
      expect(oversizedResult.error).toContain('exceeds maximum allowed size');
    });
  });
}); 