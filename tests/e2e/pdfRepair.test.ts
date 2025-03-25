import puppeteer, { Browser, Page } from 'puppeteer';
import { join } from 'path';
import fs from 'fs/promises';

describe('PDF Repair Tool E2E Tests', () => {
  let page: Page;
  let browser: Browser;
  
  const FIXTURES_PATH = join(__dirname, '..', 'fixtures');
  const VALID_PDF_PATH = join(FIXTURES_PATH, 'valid.pdf');
  const CORRUPTED_PDF_PATH = join(FIXTURES_PATH, 'corrupted.pdf');
  const MALWARE_PDF_PATH = join(FIXTURES_PATH, 'malware.pdf');

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    await page.goto('http://localhost:3000');
  });

  test('should successfully repair a valid PDF', async () => {
    // Set up file input handling
    const fileInput = await page.$('input[type="file"]');
    expect(fileInput).toBeTruthy();

    // Upload valid PDF
    const validPdfBuffer = await fs.readFile(VALID_PDF_PATH);
    await fileInput!.uploadFile(VALID_PDF_PATH);

    // Wait for upload completion and processing
    await page.waitForSelector('[data-testid="upload-success"]', { timeout: 5000 });

    // Verify success message
    const successMessage = await page.$eval('[data-testid="upload-success"]', el => el.textContent);
    expect(successMessage).toContain('PDF processed successfully');

    // Check repair details
    const repairDetails = await page.$eval('[data-testid="repair-details"]', el => el.textContent);
    expect(repairDetails).toBeTruthy();
    expect(repairDetails).toContain('Validation passed');

    // Verify download button is available
    const downloadButton = await page.$('[data-testid="download-button"]');
    expect(downloadButton).toBeTruthy();
  });

  test('should handle corrupted PDF appropriately', async () => {
    const fileInput = await page.$('input[type="file"]');
    await fileInput!.uploadFile(CORRUPTED_PDF_PATH);

    // Wait for processing completion
    await page.waitForSelector('[data-testid="repair-status"]', { timeout: 5000 });

    // Verify repair status
    const repairStatus = await page.$eval('[data-testid="repair-status"]', el => el.textContent);
    expect(repairStatus).toContain('Repairing PDF');

    // Wait for repair completion
    await page.waitForSelector('[data-testid="repair-complete"]', { timeout: 10000 });

    // Verify repair details
    const repairDetails = await page.$eval('[data-testid="repair-details"]', el => el.textContent);
    expect(repairDetails).toContain('Repaired successfully');
  });

  test('should reject malware-infected PDF', async () => {
    const fileInput = await page.$('input[type="file"]');
    await fileInput!.uploadFile(MALWARE_PDF_PATH);

    // Wait for error message
    await page.waitForSelector('[data-testid="error-message"]', { timeout: 5000 });

    // Verify error message
    const errorMessage = await page.$eval('[data-testid="error-message"]', el => el.textContent);
    expect(errorMessage).toContain('Malware detected');

    // Verify no download button is present
    const downloadButton = await page.$('[data-testid="download-button"]');
    expect(downloadButton).toBeNull();
  });

  test('should handle rate limiting', async () => {
    const fileInput = await page.$('input[type="file"]');
    
    // Attempt multiple uploads rapidly
    for (let i = 0; i < 11; i++) {
      await fileInput!.uploadFile(VALID_PDF_PATH);
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
    }

    // Wait for rate limit error
    await page.waitForSelector('[data-testid="error-message"]', { timeout: 5000 });

    // Verify rate limit error message
    const errorMessage = await page.$eval('[data-testid="error-message"]', el => el.textContent);
    expect(errorMessage).toContain('Rate limit exceeded');
  });
}); 