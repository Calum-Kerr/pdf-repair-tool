import { ResourceManager } from '../../lib/resourceManagement';
import { join } from 'path';
import { mkdir, writeFile, readFile, rm } from 'fs/promises';
import { existsSync } from 'fs';

describe('Resource Management Tests', () => {
  const TEST_CACHE_DIR = join(__dirname, '..', 'fixtures', 'cache');
  let resourceManager: ResourceManager;

  const defaultCacheOptions = {
    maxSize: 1024 * 1024 * 10, // 10MB
    maxAge: 1000 * 60 * 60,    // 1 hour
    updateAgeOnGet: true
  };

  const defaultPoolConfig = {
    maxConcurrent: 3,
    acquireTimeout: 5000,
    releaseDelay: 100
  };

  beforeAll(async () => {
    if (!existsSync(TEST_CACHE_DIR)) {
      await mkdir(TEST_CACHE_DIR, { recursive: true });
    }
  });

  afterAll(async () => {
    await rm(TEST_CACHE_DIR, { recursive: true, force: true });
  });

  beforeEach(() => {
    resourceManager = new ResourceManager(
      TEST_CACHE_DIR,
      defaultCacheOptions,
      defaultPoolConfig
    );
  });

  describe('Cache Operations', () => {
    test('should store and retrieve items from memory cache', async () => {
      const key = 'test-key';
      const value = Buffer.from('test-data');

      await resourceManager.setCachedItem(key, value);
      const retrieved = await resourceManager.getCachedItem(key);

      expect(retrieved).toBeDefined();
      expect(retrieved?.toString()).toBe('test-data');

      const stats = resourceManager.getStats();
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(0);
    });

    test('should handle large items with disk cache', async () => {
      const key = 'large-item';
      const value = Buffer.alloc(1024 * 1024 * 6); // 6MB
      value.fill('X');

      await resourceManager.setCachedItem(key, value);
      const retrieved = await resourceManager.getCachedItem(key);

      expect(retrieved).toBeDefined();
      expect(retrieved?.length).toBe(value.length);
      
      const stats = resourceManager.getStats();
      expect(stats.cacheHits).toBe(1);
    });

    test('should handle cache misses', async () => {
      const result = await resourceManager.getCachedItem('non-existent');
      
      expect(result).toBeNull();
      
      const stats = resourceManager.getStats();
      expect(stats.cacheMisses).toBe(1);
      expect(stats.cacheHits).toBe(0);
    });

    test('should clean up expired cache items', async () => {
      // Create some cache items
      const items = ['item1', 'item2', 'item3'];
      for (const item of items) {
        await resourceManager.setCachedItem(item, Buffer.from(item));
      }

      // Force items to expire by manipulating maxAge
      const testManager = resourceManager as any; // For testing only
      testManager.memoryCache.ttl = 0;
      
      await resourceManager.cleanupCache();
      
      // Verify items are cleaned up
      const results = await Promise.all(
        items.map(item => resourceManager.getCachedItem(item))
      );
      
      expect(results.every(r => r === null)).toBe(true);
    });
  });

  describe('Resource Pool Management', () => {
    test('should manage concurrent resource access', async () => {
      const resourceId = 'test-resource';
      const acquired1 = await resourceManager.acquireResource(resourceId);
      const acquired2 = await resourceManager.acquireResource(resourceId);
      const acquired3 = await resourceManager.acquireResource(resourceId);
      
      expect(acquired1).toBe(true);
      expect(acquired2).toBe(true);
      expect(acquired3).toBe(true);

      const stats = resourceManager.getStats();
      expect(stats.activeResources).toBe(3);
    });

    test('should queue requests when pool is full', async () => {
      const resourceId = 'test-resource';
      
      // Fill the pool
      for (let i = 0; i < defaultPoolConfig.maxConcurrent; i++) {
        await resourceManager.acquireResource(resourceId);
      }

      // Additional request should be queued
      const acquirePromise = resourceManager.acquireResource(resourceId);
      
      const stats = resourceManager.getStats();
      expect(stats.waitingRequests).toBe(1);

      // Release a resource
      await resourceManager.releaseResource(resourceId);
      
      // Queued request should now acquire the resource
      const acquired = await acquirePromise;
      expect(acquired).toBe(true);
    });

    test('should handle resource release correctly', async () => {
      const resourceId = 'test-resource';
      
      await resourceManager.acquireResource(resourceId);
      let stats = resourceManager.getStats();
      expect(stats.activeResources).toBe(1);

      await resourceManager.releaseResource(resourceId);
      stats = resourceManager.getStats();
      expect(stats.activeResources).toBe(0);
    });

    test('should process waiting queue in order', async () => {
      const resourceId = 'test-resource';
      const results: number[] = [];

      // Fill the pool
      await resourceManager.acquireResource(resourceId);
      await resourceManager.acquireResource(resourceId);
      await resourceManager.acquireResource(resourceId);

      // Queue additional requests
      const request1 = resourceManager.acquireResource(resourceId)
        .then(() => results.push(1));
      const request2 = resourceManager.acquireResource(resourceId)
        .then(() => results.push(2));

      // Release resources
      await resourceManager.releaseResource(resourceId);
      await resourceManager.releaseResource(resourceId);

      await Promise.all([request1, request2]);
      expect(results).toEqual([1, 2]);
    });
  });
}); 