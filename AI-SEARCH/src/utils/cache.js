/**
 * Advanced caching system with multiple strategies and persistence
 */

import { logger } from './logger.js';

class Cache {
  constructor() {
    this.memory = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      errors: 0
    };
    
    // Configuration
    this.maxSize = parseInt(process.env.CACHE_MAX_SIZE) || 1000;
    this.defaultTTL = parseInt(process.env.CACHE_DEFAULT_TTL) || 300000; // 5 minutes
    this.cleanupInterval = parseInt(process.env.CACHE_CLEANUP_INTERVAL) || 60000; // 1 minute
    
    // LRU tracking
    this.accessOrder = [];
    
    // Start cleanup timer
    this.startCleanupTimer();
    
    logger.info('Cache initialized', {
      maxSize: this.maxSize,
      defaultTTL: this.defaultTTL,
      cleanupInterval: this.cleanupInterval
    });
  }

  /**
   * Generate cache key with namespace support
   */
  generateKey(key, namespace = 'default') {
    return `${namespace}:${key}`;
  }

  /**
   * Set value in cache with TTL
   */
  async set(key, value, ttl = this.defaultTTL, namespace = 'default') {
    try {
      const fullKey = this.generateKey(key, namespace);
      const expiry = Date.now() + ttl;
      
      // Check if we need to evict items due to size limit
      if (this.memory.size >= this.maxSize && !this.memory.has(fullKey)) {
        this.evictLRU();
      }
      
      const cacheEntry = {
        value,
        expiry,
        createdAt: Date.now(),
        accessCount: 0,
        size: this.calculateSize(value)
      };
      
      this.memory.set(fullKey, cacheEntry);
      this.updateAccessOrder(fullKey);
      this.stats.sets++;
      
      logger.debug(`Cache SET: ${fullKey}`, {
        ttl,
        size: cacheEntry.size,
        totalItems: this.memory.size
      });
      
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache SET error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Get value from cache
   */
  async get(key, namespace = 'default') {
    try {
      const fullKey = this.generateKey(key, namespace);
      const entry = this.memory.get(fullKey);
      
      if (!entry) {
        this.stats.misses++;
        logger.debug(`Cache MISS: ${fullKey}`);
        return null;
      }
      
      // Check if expired
      if (entry.expiry < Date.now()) {
        this.memory.delete(fullKey);
        this.removeFromAccessOrder(fullKey);
        this.stats.misses++;
        this.stats.evictions++;
        logger.debug(`Cache EXPIRED: ${fullKey}`);
        return null;
      }
      
      // Update access tracking
      entry.accessCount++;
      this.updateAccessOrder(fullKey);
      this.stats.hits++;
      
      logger.debug(`Cache HIT: ${fullKey}`, {
        accessCount: entry.accessCount,
        age: Date.now() - entry.createdAt
      });
      
      return entry.value;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache GET error', { key, error: error.message });
      return null;
    }
  }

  /**
   * Delete specific key from cache
   */
  async delete(key, namespace = 'default') {
    try {
      const fullKey = this.generateKey(key, namespace);
      const deleted = this.memory.delete(fullKey);
      
      if (deleted) {
        this.removeFromAccessOrder(fullKey);
        this.stats.deletes++;
        logger.debug(`Cache DELETE: ${fullKey}`);
      }
      
      return deleted;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache DELETE error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Clear all cache entries for a namespace
   */
  async clearNamespace(namespace = 'default') {
    try {
      const prefix = `${namespace}:`;
      let deletedCount = 0;
      
      for (const key of this.memory.keys()) {
        if (key.startsWith(prefix)) {
          this.memory.delete(key);
          this.removeFromAccessOrder(key);
          deletedCount++;
        }
      }
      
      this.stats.deletes += deletedCount;
      logger.info(`Cache namespace cleared: ${namespace}`, { deletedCount });
      
      return deletedCount;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache clearNamespace error', { namespace, error: error.message });
      return 0;
    }
  }

  /**
   * Clear entire cache
   */
  async clear() {
    try {
      const size = this.memory.size;
      this.memory.clear();
      this.accessOrder = [];
      this.stats.deletes += size;
      
      logger.info('Cache cleared completely', { deletedCount: size });
      return size;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache clear error', { error: error.message });
      return 0;
    }
  }

  /**
   * Get or set pattern (cache-aside)
   */
  async getOrSet(key, factory, ttl = this.defaultTTL, namespace = 'default') {
    try {
      // Try to get from cache first
      let value = await this.get(key, namespace);
      
      if (value !== null) {
        return value;
      }
      
      // Generate value using factory function
      logger.debug(`Cache factory execution for key: ${key}`);
      value = await factory();
      
      // Store in cache
      await this.set(key, value, ttl, namespace);
      
      return value;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache getOrSet error', { key, error: error.message });
      throw error;
    }
  }

  /**
   * Update access order for LRU eviction
   */
  updateAccessOrder(key) {
    // Remove from current position
    this.removeFromAccessOrder(key);
    // Add to end (most recent)
    this.accessOrder.push(key);
  }

  /**
   * Remove key from access order
   */
  removeFromAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Evict least recently used item
   */
  evictLRU() {
    if (this.accessOrder.length === 0) return;
    
    const lruKey = this.accessOrder[0];
    this.memory.delete(lruKey);
    this.accessOrder.shift();
    this.stats.evictions++;
    
    logger.debug(`Cache LRU eviction: ${lruKey}`);
  }

  /**
   * Calculate approximate size of value
   */
  calculateSize(value) {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 1; // Fallback for non-serializable values
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [key, entry] of this.memory.entries()) {
      if (entry.expiry < now) {
        this.memory.delete(key);
        this.removeFromAccessOrder(key);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      this.stats.evictions += expiredCount;
      logger.debug(`Cache cleanup: ${expiredCount} expired entries removed`);
    }
    
    return expiredCount;
  }

  /**
   * Start automatic cleanup timer
   */
  startCleanupTimer() {
    setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
    
    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
      totalRequests,
      currentSize: this.memory.size,
      maxSize: this.maxSize,
      memoryUsage: this.calculateTotalSize()
    };
  }

  /**
   * Calculate total memory usage
   */
  calculateTotalSize() {
    let totalSize = 0;
    for (const entry of this.memory.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  /**
   * Get cache keys by namespace
   */
  getKeys(namespace = null) {
    if (namespace === null) {
      return Array.from(this.memory.keys());
    }
    
    const prefix = `${namespace}:`;
    return Array.from(this.memory.keys()).filter(key => key.startsWith(prefix));
  }

  /**
   * Get cache entry info (for debugging)
   */
  getEntryInfo(key, namespace = 'default') {
    const fullKey = this.generateKey(key, namespace);
    const entry = this.memory.get(fullKey);
    
    if (!entry) return null;
    
    return {
      key: fullKey,
      size: entry.size,
      createdAt: new Date(entry.createdAt).toISOString(),
      expiresAt: new Date(entry.expiry).toISOString(),
      accessCount: entry.accessCount,
      timeToLive: entry.expiry - Date.now(),
      isExpired: entry.expiry < Date.now()
    };
  }

  /**
   * Health check for cache system
   */
  healthCheck() {
    const stats = this.getStats();
    const isHealthy = stats.errors < 10 && this.memory.size <= this.maxSize;
    
    return {
      status: isHealthy ? 'healthy' : 'degraded',
      ...stats,
      issues: isHealthy ? [] : [
        stats.errors >= 10 ? 'High error rate' : null,
        this.memory.size > this.maxSize ? 'Cache size exceeded' : null
      ].filter(Boolean)
    };
  }
}

// Create singleton instance
export const cache = new Cache();
export default cache;