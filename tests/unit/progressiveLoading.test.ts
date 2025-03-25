import { ProgressivePDFLoader } from '../../lib/progressiveLoading';
import { join } from 'path';
import { writeFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { PDFDocument } from 'pdf-lib';

describe('Progressive PDF Loading Tests', () => {
  const TEST_DIR = join(__dirname, '..', 'fixtures', 'progressive-loading');
  let loader: ProgressivePDFLoader;
  let testPdfPath: string;

  beforeAll(async () => {
    // Create test directory if it doesn't exist
    if (!existsSync(TEST_DIR)) {
      await mkdir(TEST_DIR, { recursive: true });
    }

    // Create a test PDF with multiple pages
    testPdfPath = join(TEST_DIR, 'test.pdf');
    await generateTestPDF(testPdfPath, 50); // 50-page test PDF

    loader = new ProgressivePDFLoader();
  });

  afterAll(async () => {
    // Clean up test directory
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  // Helper to generate a test PDF
  async function generateTestPDF(path: string, pages: number): Promise<void> {
    const pdfDoc = await PDFDocument.create();
    
    for (let i = 0; i < pages; i++) {
      const page = pdfDoc.addPage([600, 800]);
      page.drawText(`Test Page ${i + 1}`, {
        x: 50,
        y: 750,
        size: 12
      });
    }

    const pdfBytes = await pdfDoc.save();
    await writeFile(path, pdfBytes);
  }

  describe('Initialization', () => {
    test('should initialize with PDF metadata', async () => {
      const result = await loader.initialize(testPdfPath);
      
      expect(result.isValid).toBe(true);
      expect(result.totalPages).toBe(50);
      expect(result.loadedPages).toHaveLength(0);
    });

    test('should handle invalid PDF files', async () => {
      const invalidPath = join(TEST_DIR, 'invalid.pdf');
      await writeFile(invalidPath, 'Not a PDF file');

      const result = await loader.initialize(invalidPath);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Page Loading', () => {
    beforeEach(async () => {
      await loader.initialize(testPdfPath);
    });

    test('should load specified page range', async () => {
      const result = await loader.loadPageRange(1, 5);
      
      expect(result.isValid).toBe(true);
      expect(result.loadedPages).toHaveLength(5);
      expect(result.loadedPages).toEqual([1, 2, 3, 4, 5]);
    });

    test('should handle out-of-bounds page ranges', async () => {
      const result = await loader.loadPageRange(48, 55);
      
      expect(result.isValid).toBe(true);
      expect(result.loadedPages).toHaveLength(3); // Only pages 48, 49, 50 should load
      expect(result.loadedPages).toEqual([48, 49, 50]);
    });

    test('should cache loaded pages', async () => {
      await loader.loadPageRange(1, 5);
      const page = loader.getPage(1);
      
      expect(page).toBeDefined();
      expect(page instanceof Uint8Array).toBe(true);
    });

    test('should manage cache size', async () => {
      // Load more pages than cache size
      await loader.loadPageRange(1, 25);
      
      // Try to get an early page (should be evicted from cache)
      const earlyPage = loader.getPage(1);
      expect(earlyPage).toBeNull();
      
      // Recent pages should still be in cache
      const recentPage = loader.getPage(25);
      expect(recentPage).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle uninitialized document', async () => {
      const newLoader = new ProgressivePDFLoader();
      const result = await newLoader.loadPageRange(1, 5);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('PDF document not initialized');
    });

    test('should handle invalid page numbers', async () => {
      await loader.initialize(testPdfPath);
      const result = await loader.loadPageRange(-1, 0);
      
      expect(result.isValid).toBe(true);
      expect(result.loadedPages).toHaveLength(0);
    });
  });
}); 