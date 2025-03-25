import { PDFDocument } from 'pdf-lib';
import { Transform } from 'stream';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';

const PAGE_CHUNK_SIZE = 5; // Number of pages to load at once
const CACHE_SIZE = 20; // Maximum number of pages to keep in memory

interface PageRange {
  start: number;
  end: number;
}

interface ProgressiveLoadingResult {
  isValid: boolean;
  error?: string;
  loadedPages: number[];
  totalPages?: number;
}

export class ProgressivePDFLoader {
  private pageCache: Map<number, Uint8Array>;
  private loadedRanges: PageRange[];
  private document: PDFDocument | null;
  private totalPages: number;

  constructor() {
    this.pageCache = new Map();
    this.loadedRanges = [];
    this.document = null;
    this.totalPages = 0;
  }

  /**
   * Initialize the PDF document for progressive loading
   * @param pdfPath Path to the PDF file
   */
  async initialize(pdfPath: string): Promise<ProgressiveLoadingResult> {
    try {
      // Read only the first few bytes to get document metadata
      const headerStream = createReadStream(pdfPath, { end: 2048 });
      const headerChunks: Buffer[] = [];

      await pipeline(
        headerStream,
        new Transform({
          transform(chunk, encoding, callback) {
            headerChunks.push(chunk);
            callback(null, chunk);
          }
        })
      );

      const header = Buffer.concat(headerChunks);
      this.document = await PDFDocument.load(header, { updateMetadata: false });
      this.totalPages = this.document.getPageCount();

      return {
        isValid: true,
        loadedPages: [],
        totalPages: this.totalPages
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Failed to initialize PDF',
        loadedPages: []
      };
    }
  }

  /**
   * Load a specific range of pages
   * @param startPage First page to load (1-indexed)
   * @param endPage Last page to load (1-indexed)
   */
  async loadPageRange(startPage: number, endPage: number): Promise<ProgressiveLoadingResult> {
    try {
      if (!this.document) {
        throw new Error('PDF document not initialized');
      }

      // Validate page range
      startPage = Math.max(1, startPage);
      endPage = Math.min(this.totalPages, endPage);
      
      const pagesToLoad = [];
      for (let i = startPage; i <= endPage; i++) {
        if (!this.pageCache.has(i)) {
          pagesToLoad.push(i);
        }
      }

      // Load pages in chunks
      for (let i = 0; i < pagesToLoad.length; i += PAGE_CHUNK_SIZE) {
        const chunk = pagesToLoad.slice(i, i + PAGE_CHUNK_SIZE);
        await this.loadPages(chunk);
      }

      // Manage cache size
      this.manageCache();

      // Update loaded ranges
      this.updateLoadedRanges({ start: startPage, end: endPage });

      return {
        isValid: true,
        loadedPages: pagesToLoad,
        totalPages: this.totalPages
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Failed to load page range',
        loadedPages: []
      };
    }
  }

  /**
   * Get a loaded page from cache
   * @param pageNumber Page number (1-indexed)
   */
  getPage(pageNumber: number): Uint8Array | null {
    return this.pageCache.get(pageNumber) || null;
  }

  /**
   * Load specific pages into cache
   * @param pageNumbers Array of page numbers to load
   */
  private async loadPages(pageNumbers: number[]): Promise<void> {
    if (!this.document) return;

    for (const pageNum of pageNumbers) {
      const page = await this.document.getPage(pageNum - 1); // pdf-lib uses 0-based indexing
      const newDoc = await PDFDocument.create();
      const [copiedPage] = await newDoc.copyPages(this.document, [pageNum - 1]);
      newDoc.addPage(copiedPage);
      const pageContent = await newDoc.save();
      this.pageCache.set(pageNum, new Uint8Array(pageContent));
    }
  }

  /**
   * Manage cache size by removing least recently used pages
   */
  private manageCache(): void {
    if (this.pageCache.size > CACHE_SIZE) {
      const entriesToRemove = this.pageCache.size - CACHE_SIZE;
      const entries = Array.from(this.pageCache.entries());
      
      // Remove oldest entries
      entries
        .slice(0, entriesToRemove)
        .forEach(([pageNum]) => this.pageCache.delete(pageNum));
    }
  }

  /**
   * Update the record of loaded page ranges
   */
  private updateLoadedRanges(newRange: PageRange): void {
    this.loadedRanges.push(newRange);
    this.loadedRanges.sort((a, b) => a.start - b.start);
    
    // Merge overlapping ranges
    this.loadedRanges = this.loadedRanges.reduce((merged, current) => {
      if (merged.length === 0) return [current];
      
      const previous = merged[merged.length - 1];
      if (current.start <= previous.end + 1) {
        previous.end = Math.max(previous.end, current.end);
        return merged;
      }
      
      return [...merged, current];
    }, [] as PageRange[]);
  }
} 