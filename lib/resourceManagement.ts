import { LRUCache } from 'lru-cache';
import { join } from 'path';
import { mkdir, rm, writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';

interface CacheOptions {
  maxSize: number;        // Maximum cache size in bytes
  maxAge: number;         // Maximum age of cache items in milliseconds
  updateAgeOnGet: boolean;// Whether to update item age on access
}

interface ResourcePool {
  maxConcurrent: number;  // Maximum number of concurrent resources
  acquireTimeout: number; // Timeout for resource acquisition in milliseconds
  releaseDelay: number;   // Delay before resource release in milliseconds
}

interface ResourceStats {
  cacheSize: number;
  cacheHits: number;
  cacheMisses: number;
  activeResources: number;
  waitingRequests: number;
}

export class ResourceManager {
  private readonly cacheDir: string;
  private readonly memoryCache: LRUCache<string, Buffer>;
  private readonly diskCache: LRUCache<string, string>;
  private readonly resourcePool: Map<string, boolean>;
  private readonly waitingQueue: Map<string, (() => void)[]>;
  private stats: ResourceStats;

  constructor(
    cacheDir: string,
    cacheOptions: CacheOptions,
    private readonly poolConfig: ResourcePool
  ) {
    this.cacheDir = cacheDir;
    this.resourcePool = new Map();
    this.waitingQueue = new Map();
    
    // Initialize caches with bounded sizes
    this.memoryCache = new LRUCache({
      max: cacheOptions.maxSize,
      ttl: cacheOptions.maxAge,
      updateAgeOnGet: cacheOptions.updateAgeOnGet,
      dispose: (value, key) => this.handleCacheEviction(key, value)
    });

    this.diskCache = new LRUCache({
      max: 1000, // Maximum number of files to track
      ttl: cacheOptions.maxAge
    });

    this.stats = {
      cacheSize: 0,
      cacheHits: 0,
      cacheMisses: 0,
      activeResources: 0,
      waitingRequests: 0
    };

    // Ensure cache directory exists
    this.initializeCache();
  }

  /**
   * Initialize cache directory
   */
  private async initializeCache(): Promise<void> {
    if (!existsSync(this.cacheDir)) {
      await mkdir(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Get item from cache, trying memory first then disk
   */
  async getCachedItem(key: string): Promise<Buffer | null> {
    // Try memory cache first
    const memoryItem = this.memoryCache.get(key);
    if (memoryItem) {
      this.stats.cacheHits++;
      return memoryItem;
    }

    // Try disk cache
    const diskPath = this.diskCache.get(key);
    if (diskPath) {
      try {
        const data = await readFile(join(this.cacheDir, diskPath));
        // Promote to memory cache if possible
        this.memoryCache.set(key, data);
        this.stats.cacheHits++;
        return data;
      } catch (error) {
        this.diskCache.delete(key);
      }
    }

    this.stats.cacheMisses++;
    return null;
  }

  /**
   * Store item in cache
   */
  async setCachedItem(key: string, value: Buffer): Promise<void> {
    const size = value.length;

    // If item is too large for memory cache, store on disk
    if (size > this.memoryCache.max / 2) {
      const diskPath = `${key}_${Date.now()}.cache`;
      await writeFile(join(this.cacheDir, diskPath), value);
      this.diskCache.set(key, diskPath);
    } else {
      this.memoryCache.set(key, value);
    }

    this.stats.cacheSize += size;
  }

  /**
   * Acquire a resource from the pool
   */
  async acquireResource(resourceId: string): Promise<boolean> {
    // Check if resource is available
    if (this.resourcePool.size >= this.poolConfig.maxConcurrent) {
      // Add to waiting queue
      return new Promise((resolve) => {
        const queue = this.waitingQueue.get(resourceId) || [];
        queue.push(() => resolve(true));
        this.waitingQueue.set(resourceId, queue);
        this.stats.waitingRequests++;
      });
    }

    this.resourcePool.set(resourceId, true);
    this.stats.activeResources++;
    return true;
  }

  /**
   * Release a resource back to the pool
   */
  async releaseResource(resourceId: string): Promise<void> {
    this.resourcePool.delete(resourceId);
    this.stats.activeResources--;

    // Process waiting queue
    const queue = this.waitingQueue.get(resourceId);
    if (queue && queue.length > 0) {
      const nextRequest = queue.shift();
      this.stats.waitingRequests--;
      if (nextRequest) {
        setTimeout(nextRequest, this.poolConfig.releaseDelay);
      }
      if (queue.length === 0) {
        this.waitingQueue.delete(resourceId);
      }
    }
  }

  /**
   * Handle cache item eviction
   */
  private async handleCacheEviction(key: string, value: Buffer): Promise<void> {
    // If item is still valid, try to move to disk cache
    const diskPath = `${key}_${Date.now()}.cache`;
    try {
      await writeFile(join(this.cacheDir, diskPath), value);
      this.diskCache.set(key, diskPath);
    } catch (error) {
      console.error('Failed to move cache item to disk:', error);
    }
    this.stats.cacheSize -= value.length;
  }

  /**
   * Clean up expired cache files
   */
  async cleanupCache(): Promise<void> {
    const maxAge = Date.now() - this.memoryCache.ttl;
    const promises: Promise<void>[] = [];
    
    // Bound the number of concurrent deletions
    const maxConcurrentDeletions = 10;
    let deletions = 0;

    for (const [key, path] of this.diskCache.entries()) {
      if (deletions >= maxConcurrentDeletions) break;

      const filePath = join(this.cacheDir, path);
      try {
        const stats = await readFile(filePath);
        if (stats.length > 0 && Date.now() - stats.length > maxAge) {
          promises.push(
            rm(filePath).catch(error => {
              console.error(`Failed to delete cache file ${path}:`, error);
            })
          );
          this.diskCache.delete(key);
          deletions++;
        }
      } catch (error) {
        this.diskCache.delete(key);
      }
    }

    await Promise.all(promises);
  }

  /**
   * Get current resource statistics
   */
  getStats(): ResourceStats {
    return { ...this.stats };
  }
} 