import { readFile } from 'fs/promises';
import { join } from 'path';
import { repairPDF } from '../../lib/pdfRepair';
import { validateFileUpload } from '../../lib/security';
import { scanFile } from '../../lib/virusScan';
import { securelyStoreFile } from '../../lib/secureFileHandling';
import { PDFDocument } from 'pdf-lib';

const PERFORMANCE_FIXTURES_DIR = join(__dirname, '..', 'fixtures', 'performance');
const TIMEOUT = 120000; // 2 minutes timeout for large file tests

describe('Large File Performance Tests', () => {
  // Helper to measure execution time
  const measureExecutionTime = async (operation: () => Promise<any>): Promise<number> => {
    const start = process.hrtime.bigint();
    await operation();
    const end = process.hrtime.bigint();
    return Number(end - start) / 1e6; // Convert to milliseconds
  };

  // Helper to create a large PDF
  const generateLargePDF = async (pages: number): Promise<Buffer> => {
    const pdfDoc = await PDFDocument.create();
    
    // Add specified number of pages with content
    for (let i = 0; i < pages; i++) {
      const page = pdfDoc.addPage([600, 800]);
      page.drawText(`Page ${i + 1} of test document`, {
        x: 50,
        y: 750,
        size: 12
      });
      
      // Add more content to increase file size
      for (let j = 0; j < 50; j++) {
        page.drawText(`Line ${j + 1} of test content for performance testing.`, {
          x: 50,
          y: 700 - (j * 12),
          size: 10
        });
      }
    }
    
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  };

  describe('Processing Time Tests', () => {
    const testSizes = [10, 50, 100, 500]; // Number of pages to test
    
    testSizes.forEach(pageCount => {
      test(`should process ${pageCount}-page PDF within acceptable time`, async () => {
        const pdfData = await generateLargePDF(pageCount);
        
        // Test security validation performance
        const securityTime = await measureExecutionTime(async () => {
          const result = await validateFileUpload(pdfData, 'test-client');
          expect(result.isValid).toBe(true);
        });
        
        // Test virus scan performance
        const scanTime = await measureExecutionTime(async () => {
          const result = await scanFile(pdfData);
          expect(result.isValid).toBe(true);
        });
        
        // Test repair performance
        const repairTime = await measureExecutionTime(async () => {
          const result = await repairPDF(pdfData);
          expect(result.isValid).toBe(true);
        });
        
        // Test storage performance
        const storageTime = await measureExecutionTime(async () => {
          const result = await securelyStoreFile(pdfData, {
            originalName: `${pageCount}-pages.pdf`,
            mimeType: 'application/pdf',
            size: pdfData.length
          });
          expect(result.isValid).toBe(true);
        });

        // Define performance thresholds (in milliseconds)
        const thresholds = {
          security: pageCount * 2,    // 2ms per page
          scan: pageCount * 3,        // 3ms per page
          repair: pageCount * 10,     // 10ms per page
          storage: pageCount * 5      // 5ms per page
        };

        // Assert performance expectations
        expect(securityTime).toBeLessThan(thresholds.security);
        expect(scanTime).toBeLessThan(thresholds.scan);
        expect(repairTime).toBeLessThan(thresholds.repair);
        expect(storageTime).toBeLessThan(thresholds.storage);

        // Log performance metrics
        console.log(`\nPerformance metrics for ${pageCount}-page PDF:`);
        console.log(`- Security validation: ${securityTime.toFixed(2)}ms`);
        console.log(`- Virus scan: ${scanTime.toFixed(2)}ms`);
        console.log(`- PDF repair: ${repairTime.toFixed(2)}ms`);
        console.log(`- Secure storage: ${storageTime.toFixed(2)}ms`);
      }, TIMEOUT);
    });
  });

  describe('Memory Usage Tests', () => {
    test('should maintain stable memory usage during large file processing', async () => {
      const initialMemory = process.memoryUsage();
      const pdfData = await generateLargePDF(1000); // Test with 1000 pages
      
      // Process the large PDF
      await validateFileUpload(pdfData, 'test-client');
      await scanFile(pdfData);
      await repairPDF(pdfData);
      await securelyStoreFile(pdfData, {
        originalName: 'large-test.pdf',
        mimeType: 'application/pdf',
        size: pdfData.length
      });
      
      const finalMemory = process.memoryUsage();
      
      // Check memory usage
      const heapDiff = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
      console.log(`\nMemory usage difference: ${heapDiff.toFixed(2)}MB`);
      
      // Memory increase should not exceed 100MB
      expect(heapDiff).toBeLessThan(100);
    }, TIMEOUT);
  });
}); 