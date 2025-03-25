import { readFile } from 'fs/promises';
import { join } from 'path';
import { repairPDF } from '../lib/pdfRepair';
import { validateFileUpload } from '../lib/security';
import { scanFile } from '../lib/virusScan';
import { securelyStoreFile, validateStoredFile } from '../lib/secureFileHandling';

const FIXTURES_DIR = join(__dirname, 'fixtures', 'corrupted-pdfs');

describe('Corrupted PDF Test Suite', () => {
  // Helper function to load test files
  async function loadTestFile(subdir: string, filename: string): Promise<Buffer> {
    const filePath = join(FIXTURES_DIR, subdir, filename);
    return readFile(filePath);
  }

  describe('Header Corruption Tests', () => {
    test('should repair PDF with missing header', async () => {
      const pdfData = await loadTestFile('header', 'missing-header.pdf');
      const result = await repairPDF(pdfData);
      expect(result.isValid).toBe(true);
      expect(result.repairedPDF).toBeDefined();
      expect(result.error).toBeNull();
    });

    test('should repair PDF with corrupted version number', async () => {
      const pdfData = await loadTestFile('header', 'invalid-version.pdf');
      const result = await repairPDF(pdfData);
      expect(result.isValid).toBe(true);
      expect(result.repairedPDF).toBeDefined();
      expect(result.error).toBeNull();
    });
  });

  describe('Cross-Reference Table Tests', () => {
    test('should repair PDF with corrupted xref table', async () => {
      const pdfData = await loadTestFile('xref', 'corrupted-xref.pdf');
      const result = await repairPDF(pdfData);
      expect(result.isValid).toBe(true);
      expect(result.repairedPDF).toBeDefined();
      expect(result.error).toBeNull();
    });

    test('should repair PDF with missing xref table', async () => {
      const pdfData = await loadTestFile('xref', 'missing-xref.pdf');
      const result = await repairPDF(pdfData);
      expect(result.isValid).toBe(true);
      expect(result.repairedPDF).toBeDefined();
      expect(result.error).toBeNull();
    });
  });

  describe('Stream Corruption Tests', () => {
    test('should repair PDF with corrupted object stream', async () => {
      const pdfData = await loadTestFile('stream', 'corrupted-stream.pdf');
      const result = await repairPDF(pdfData);
      expect(result.isValid).toBe(true);
      expect(result.repairedPDF).toBeDefined();
      expect(result.error).toBeNull();
    });

    test('should repair PDF with invalid stream length', async () => {
      const pdfData = await loadTestFile('stream', 'invalid-length.pdf');
      const result = await repairPDF(pdfData);
      expect(result.isValid).toBe(true);
      expect(result.repairedPDF).toBeDefined();
      expect(result.error).toBeNull();
    });
  });

  describe('Encryption Tests', () => {
    test('should repair PDF with broken encryption', async () => {
      const pdfData = await loadTestFile('encryption', 'broken-encryption.pdf');
      const result = await repairPDF(pdfData);
      expect(result.isValid).toBe(true);
      expect(result.repairedPDF).toBeDefined();
      expect(result.error).toBeNull();
    });

    test('should repair PDF with invalid encryption key', async () => {
      const pdfData = await loadTestFile('encryption', 'invalid-key.pdf');
      const result = await repairPDF(pdfData);
      expect(result.isValid).toBe(true);
      expect(result.repairedPDF).toBeDefined();
      expect(result.error).toBeNull();
    });
  });

  describe('Metadata Tests', () => {
    test('should repair PDF with corrupted metadata', async () => {
      const pdfData = await loadTestFile('metadata', 'corrupted-metadata.pdf');
      const result = await repairPDF(pdfData);
      expect(result.isValid).toBe(true);
      expect(result.repairedPDF).toBeDefined();
      expect(result.error).toBeNull();
    });

    test('should repair PDF with invalid XMP metadata', async () => {
      const pdfData = await loadTestFile('metadata', 'invalid-xmp.pdf');
      const result = await repairPDF(pdfData);
      expect(result.isValid).toBe(true);
      expect(result.repairedPDF).toBeDefined();
      expect(result.error).toBeNull();
    });
  });

  describe('Form Field Tests', () => {
    test('should repair PDF with corrupted form fields', async () => {
      const pdfData = await loadTestFile('forms', 'corrupted-fields.pdf');
      const result = await repairPDF(pdfData);
      expect(result.isValid).toBe(true);
      expect(result.repairedPDF).toBeDefined();
      expect(result.error).toBeNull();
    });

    test('should repair PDF with invalid widget annotations', async () => {
      const pdfData = await loadTestFile('forms', 'invalid-widgets.pdf');
      const result = await repairPDF(pdfData);
      expect(result.isValid).toBe(true);
      expect(result.repairedPDF).toBeDefined();
      expect(result.error).toBeNull();
    });
  });

  describe('Security and Validation Tests', () => {
    test('should validate and scan corrupted files correctly', async () => {
      const pdfData = await loadTestFile('header', 'missing-header.pdf');
      const testClientId = 'test-client-123';
      
      // Security validation
      const securityResult = await validateFileUpload(pdfData, testClientId);
      expect(securityResult.isValid).toBe(true);
      expect(securityResult.securityLevel).toBe('low');
      
      // Virus scan
      const scanResult = await scanFile(pdfData);
      expect(scanResult.isValid).toBe(true);
      expect(scanResult.securityLevel).toBe('low');
      
      // Secure storage
      const storageResult = await securelyStoreFile(pdfData, {
        originalName: 'missing-header.pdf',
        mimeType: 'application/pdf',
        size: pdfData.length
      });
      expect(storageResult.isValid).toBe(true);
      expect(storageResult.fileHash).toBeDefined();
      
      // Validate stored file
      if (storageResult.fileHash) {
        const validationResult = await validateStoredFile(storageResult.fileHash);
        expect(validationResult.isValid).toBe(true);
      }
    });
  });
}); 