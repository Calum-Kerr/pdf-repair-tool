import { validateFileUpload } from '../../lib/security';
import { scanFile } from '../../lib/virusScan';
import { validatePDF } from '../../lib/types';
import { securelyStoreFile, validateStoredFile, securelyDeleteFile } from '../../lib/secureFileHandling';
import { repairPDF } from '../../lib/pdfRepair';
import { join } from 'path';
import { readFile } from 'fs/promises';

describe('PDF Repair Workflow Integration Tests', () => {
  // Test file paths
  const FIXTURES_PATH = join(__dirname, '..', 'fixtures');
  const VALID_PDF_PATH = join(FIXTURES_PATH, 'valid.pdf');
  const CORRUPTED_PDF_PATH = join(FIXTURES_PATH, 'corrupted.pdf');
  const MALWARE_PDF_PATH = join(FIXTURES_PATH, 'malware.pdf');

  // Mock metadata
  const testMetadata = {
    originalName: 'test.pdf',
    mimeType: 'application/pdf',
    size: 1024
  };

  describe('Complete Repair Workflow', () => {
    test('should successfully repair a valid PDF', async () => {
      // 1. Load test PDF
      const pdfBuffer = await readFile(VALID_PDF_PATH);
      const pdfData = new Uint8Array(pdfBuffer);
      
      // 2. Security validation
      const securityResult = await validateFileUpload(pdfData, 'test-client');
      expect(securityResult.isValid).toBe(true);
      expect(securityResult.securityLevel).toBe('LOW');

      // 3. Virus scan
      const scanResult = await scanFile(pdfData);
      expect(scanResult.isValid).toBe(true);
      expect(scanResult.securityLevel).toBe('LOW');

      // 4. PDF validation
      const validationResult = await validatePDF(pdfBuffer);
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);

      // 5. Secure storage
      const storageResult = await securelyStoreFile(pdfData, testMetadata);
      expect(storageResult.isValid).toBe(true);
      expect(storageResult.fileHash).toBeDefined();

      // 6. Validate stored file
      const validateResult = await validateStoredFile(storageResult.fileHash!);
      expect(validateResult.isValid).toBe(true);

      // 7. Repair PDF (even though it's valid, should still process)
      const repairResult = await repairPDF(pdfBuffer);
      expect(repairResult.isValid).toBe(true);
      expect(repairResult.repairedPDF).toBeDefined();

      // 8. Clean up
      const deleteResult = await securelyDeleteFile(storageResult.fileHash!);
      expect(deleteResult.isValid).toBe(true);
    });

    test('should handle and repair corrupted PDF', async () => {
      // 1. Load corrupted test PDF
      const pdfBuffer = await readFile(CORRUPTED_PDF_PATH);
      const pdfData = new Uint8Array(pdfBuffer);
      
      // 2. Security validation (should pass as it's still a PDF)
      const securityResult = await validateFileUpload(pdfData, 'test-client');
      expect(securityResult.isValid).toBe(true);

      // 3. Virus scan
      const scanResult = await scanFile(pdfData);
      expect(scanResult.isValid).toBe(true);

      // 4. PDF validation (should fail with specific errors)
      const validationResult = await validatePDF(pdfBuffer);
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);

      // 5. Secure storage (store for repair)
      const storageResult = await securelyStoreFile(pdfData, testMetadata);
      expect(storageResult.isValid).toBe(true);
      expect(storageResult.fileHash).toBeDefined();

      // 6. Repair PDF
      const repairResult = await repairPDF(pdfBuffer);
      expect(repairResult.isValid).toBe(true);
      expect(repairResult.repairedPDF).toBeDefined();

      // 7. Validate repaired PDF
      const repairedValidation = await validatePDF(repairResult.repairedPDF!);
      expect(repairedValidation.isValid).toBe(true);
      expect(repairedValidation.errors).toHaveLength(0);

      // 8. Clean up
      const deleteResult = await securelyDeleteFile(storageResult.fileHash!);
      expect(deleteResult.isValid).toBe(true);
    });

    test('should reject malware-infected PDF', async () => {
      // 1. Load infected test PDF
      const pdfBuffer = await readFile(MALWARE_PDF_PATH);
      const pdfData = new Uint8Array(pdfBuffer);
      
      // 2. Security validation
      const securityResult = await validateFileUpload(pdfData, 'test-client');
      expect(securityResult.isValid).toBe(true); // Should pass initial security check

      // 3. Virus scan (should fail)
      const scanResult = await scanFile(pdfData);
      expect(scanResult.isValid).toBe(false);
      expect(scanResult.securityLevel).toBe('CRITICAL');
      expect(scanResult.error).toContain('Malware detected');

      // 4. Workflow should stop here - no further processing
      expect(async () => {
        await securelyStoreFile(pdfData, testMetadata);
      }).rejects.toThrow();
    });

    test('should handle rate limiting in workflow', async () => {
      const pdfBuffer = await readFile(VALID_PDF_PATH);
      const pdfData = new Uint8Array(pdfBuffer);
      
      // Make multiple requests to trigger rate limiting
      for (let i = 0; i < 10; i++) {
        await validateFileUpload(pdfData, 'rate-limit-test');
      }

      // Next request should be rejected
      const securityResult = await validateFileUpload(pdfData, 'rate-limit-test');
      expect(securityResult.isValid).toBe(false);
      expect(securityResult.error).toContain('Rate limit exceeded');
      expect(securityResult.securityLevel).toBe('HIGH');

      // Workflow should stop here
      expect(async () => {
        await scanFile(pdfData);
      }).rejects.toThrow();
    });
  });
}); 