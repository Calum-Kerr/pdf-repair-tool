import { validatePDF, PDFValidationResult, PDFCorruptionResult } from '../../lib/types';
import { Buffer } from 'buffer';

describe('PDF Validation Module Tests', () => {
  const createValidPDFBuffer = () => {
    const header = '%PDF-1.7\n';
    const body = '1 0 obj\n<<>>\nendobj\n';
    const xref = 'xref\n0 2\n0000000000 65535 f\n0000000010 00000 n\n';
    const trailer = 'trailer\n<<>>\nstartxref\n66\n%%EOF';
    return Buffer.from(header + body + xref + trailer);
  };

  describe('validatePDF', () => {
    test('should validate correct PDF structure', async () => {
      const validPDF = createValidPDFBuffer();
      const result = await validatePDF(validPDF);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.details).toEqual({
        headerValid: true,
        xrefValid: true,
        streamValid: true
      });
    });

    test('should detect missing PDF header', async () => {
      const invalidPDF = Buffer.from('Not a PDF file');
      const result = await validatePDF(invalidPDF);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('MISSING_HEADER');
      expect(result.details.headerValid).toBe(false);
    });

    test('should detect corrupted cross-reference table', async () => {
      const corruptedXref = createValidPDFBuffer().toString().replace('xref', 'corrupted');
      const result = await validatePDF(Buffer.from(corruptedXref));

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('INVALID_XREF_ENTRY');
      expect(result.details.xrefValid).toBe(false);
    });

    test('should detect missing EOF marker', async () => {
      const missingEOF = createValidPDFBuffer().toString().replace('%%EOF', '');
      const result = await validatePDF(Buffer.from(missingEOF));

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('MALFORMED_HEADER');
    });

    test('should handle empty file', async () => {
      const emptyFile = Buffer.from('');
      const result = await validatePDF(emptyFile);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('MISSING_HEADER');
      expect(result.details).toEqual({
        headerValid: false,
        xrefValid: false,
        streamValid: false
      });
    });

    test('should detect corrupted object streams', async () => {
      const corruptedStream = createValidPDFBuffer().toString().replace('endobj', 'corrupted');
      const result = await validatePDF(Buffer.from(corruptedStream));

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('CORRUPTED_STREAM_DATA');
      expect(result.details.streamValid).toBe(false);
    });

    test('should handle malformed version number', async () => {
      const invalidVersion = createValidPDFBuffer().toString().replace('1.7', 'X.Y');
      const result = await validatePDF(Buffer.from(invalidVersion));

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('INVALID_VERSION');
    });

    test('should detect duplicate object numbers', async () => {
      const duplicateObjects = createValidPDFBuffer().toString() + '\n1 0 obj\n<<>>\nendobj\n';
      const result = await validatePDF(Buffer.from(duplicateObjects));

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('DUPLICATE_OBJECT');
    });

    test('should validate PDF with multiple streams', async () => {
      const multiStream = createValidPDFBuffer().toString() + 
        '\n2 0 obj\n<< /Length 10 >>\nstream\nTest Data\nendstream\nendobj\n';
      const result = await validatePDF(Buffer.from(multiStream));

      expect(result.isValid).toBe(true);
      expect(result.details.streamValid).toBe(true);
    });

    test('should handle oversized objects', async () => {
      const largeObject = '1 0 obj\n<<' + 'x'.repeat(10000) + '>>\nendobj\n';
      const result = await validatePDF(Buffer.from(largeObject));

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('INVALID_OBJECT');
    });
  });
}); 