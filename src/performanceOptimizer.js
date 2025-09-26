// Performance optimization utilities for real-time search
import { logger } from './logger.js';

/**
 * LRU Cache implementation for search results
 */
class LRUCache {
  constructor(maxSize = 100, ttl = 300000) { // 5 minutes default TTL
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.cache = new Map();
    this.accessTimes = new Map();
    this.createTimes = new Map();
  }
  
  _isExpired(key) {
    const createTime = this.createTimes.get(key);
    return createTime && (Date.now() - createTime > this.ttl);
  }
  
  _evictExpired() {
    const now = Date.now();
    for (const [key, createTime] of this.createTimes.entries()) {
      if (now - createTime > this.ttl) {
        this.cache.delete(key);
        this.accessTimes.delete(key);
        this.createTimes.delete(key);
      }
    }
  }
  
  _evictLRU() {
    if (this.cache.size <= this.maxSize) return;
    
    // Find least recently used item
    let lruKey = null;
    let lruTime = Date.now();
    
    for (const [key, accessTime] of this.accessTimes.entries()) {
      if (accessTime < lruTime) {
        lruTime = accessTime;
        lruKey = key;
      }
    }
    
    if (lruKey) {
      this.cache.delete(lruKey);
      this.accessTimes.delete(lruKey);
      this.createTimes.delete(lruKey);
    }
  }
  
  get(key) {
    if (!this.cache.has(key)) return null;
    
    if (this._isExpired(key)) {
      this.cache.delete(key);
      this.accessTimes.delete(key);
      this.createTimes.delete(key);
      return null;
    }
    
    this.accessTimes.set(key, Date.now());
    return this.cache.get(key);
  }
  
  set(key, value) {
    const now = Date.now();
    
    // Clean up expired entries
    this._evictExpired();
    
    // Add/update entry
    this.cache.set(key, value);
    this.accessTimes.set(key, now);
    this.createTimes.set(key, now);
    
    // Evict LRU if necessary
    this._evictLRU();
  }
  
  has(key) {
    return this.cache.has(key) && !this._isExpired(key);
  }
  
  clear() {
    this.cache.clear();
    this.accessTimes.clear();
    this.createTimes.clear();
  }
  
  size() {
    this._evictExpired();
    return this.cache.size;
  }
  
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
      hitRate: this.hitRate || 0
    };
  }
}

/**
 * Global cache instances
 */
export const searchCache = new LRUCache(200, 600000); // 10 minutes
export const documentCache = new LRUCache(50, 1800000); // 30 minutes
export const normalizationCache = new LRUCache(100, 900000); // 15 minutes

/**
 * Advanced debouncing with multiple strategies
 */
export class SmartDebouncer {
  constructor(options = {}) {
    this.timeouts = new Map();
    this.options = {
      delay: 300,
      maxDelay: 1000,
      strategy: 'trailing', // 'leading', 'trailing', 'both'
      ...options
    };
    this.callCounts = new Map();
    this.lastExecutions = new Map();
  }
  
  debounce(key, func, customDelay) {
    const delay = customDelay || this.options.delay;
    const maxDelay = this.options.maxDelay;
    
    // Clear existing timeout
    if (this.timeouts.has(key)) {
      clearTimeout(this.timeouts.get(key));
    }
    
    const now = Date.now();
    const callCount = (this.callCounts.get(key) || 0) + 1;
    const lastExecution = this.lastExecutions.get(key) || 0;
    
    this.callCounts.set(key, callCount);
    
    // Leading edge execution
    if (this.options.strategy === 'leading' && callCount === 1) {
      func();
      this.lastExecutions.set(key, now);
      return;
    }
    
    // Force execution if max delay exceeded
    const shouldForceExecution = (now - lastExecution) >= maxDelay && callCount > 1;
    
    if (shouldForceExecution) {
      func();
      this.lastExecutions.set(key, now);
      this.callCounts.set(key, 0);
      return;
    }
    
    // Trailing edge execution
    const timeout = setTimeout(() => {
      if (this.options.strategy === 'trailing' || this.options.strategy === 'both') {
        func();
        this.lastExecutions.set(key, Date.now());
      }
      this.callCounts.set(key, 0);
      this.timeouts.delete(key);
    }, delay);
    
    this.timeouts.set(key, timeout);
  }
  
  cancel(key) {
    if (this.timeouts.has(key)) {
      clearTimeout(this.timeouts.get(key));
      this.timeouts.delete(key);
      this.callCounts.set(key, 0);
    }
  }
  
  cancelAll() {
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }
    this.timeouts.clear();
    this.callCounts.clear();
  }
  
  isPending(key) {
    return this.timeouts.has(key);
  }
}

/**
 * Performance monitor for search operations
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.thresholds = {
      search: 1000,
      normalization: 500,
      highlighting: 200,
      rendering: 100
    };
  }
  
  startTimer(operation, context = {}) {
    const id = `${operation}-${Date.now()}-${Math.random()}`;
    this.metrics.set(id, {
      operation,
      context,
      startTime: performance.now(),
      endTime: null,
      duration: null
    });
    return id;
  }
  
  endTimer(id) {
    const metric = this.metrics.get(id);
    if (!metric) return null;
    
    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;
    
    // Log if exceeds threshold
    const threshold = this.thresholds[metric.operation] || 1000;
    if (metric.duration > threshold) {
      logger.warn('Performance', `${metric.operation} exceeded threshold`, {
        duration: `${metric.duration.toFixed(2)}ms`,
        threshold: `${threshold}ms`,
        context: metric.context
      });
    } else {
      logger.debug('Performance', `${metric.operation} completed`, {
        duration: `${metric.duration.toFixed(2)}ms`,
        context: metric.context
      });
    }
    
    return metric;
  }
  
  getMetrics(operation) {
    const operationMetrics = Array.from(this.metrics.values())
      .filter(m => m.operation === operation && m.duration !== null);
    
    if (operationMetrics.length === 0) return null;
    
    const durations = operationMetrics.map(m => m.duration);
    return {
      operation,
      count: durations.length,
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      recent: durations.slice(-10) // Last 10 measurements
    };
  }
  
  getOverallStats() {
    const operations = [...new Set(Array.from(this.metrics.values()).map(m => m.operation))];
    return operations.reduce((stats, op) => {
      stats[op] = this.getMetrics(op);
      return stats;
    }, {});
  }
}

export const performanceMonitor = new PerformanceMonitor();

/**
 * Intelligent query preprocessing
 */
export const preprocessQuery = (query, options = {}) => {
  if (!query) return { normalized: '', terms: [], hash: '' };
  
  const {
    minTermLength = 2,
    maxTerms = 10,
    removeDuplicates = true,
    cacheKey = null
  } = options;
  
  // Check cache first
  const hash = createQueryHash(query);
  if (cacheKey && searchCache.has(`preprocess-${hash}`)) {
    return searchCache.get(`preprocess-${hash}`);
  }
  
  const timerId = performanceMonitor.startTimer('preprocessing', { queryLength: query.length });
  
  // Normalize query
  const normalized = query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '');
  
  // Extract terms
  let terms = normalized
    .split(' ')
    .filter(term => term.length >= minTermLength)
    .slice(0, maxTerms);
  
  if (removeDuplicates) {
    terms = [...new Set(terms)];
  }
  
  const result = {
    normalized,
    terms,
    hash,
    original: query
  };
  
  // Cache result
  if (cacheKey) {
    searchCache.set(`preprocess-${hash}`, result);
  }
  
  performanceMonitor.endTimer(timerId);
  return result;
};

/**
 * Create consistent hash for queries
 */
export const createQueryHash = (query, document) => {
  const content = document ? `${query}:${document.substring(0, 100)}` : query;
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
};

/**
 * Batch processing for multiple search operations
 */
export class BatchProcessor {
  constructor(options = {}) {
    this.options = {
      batchSize: 10,
      maxWait: 50,
      ...options
    };
    this.queue = [];
    this.processing = false;
    this.timeout = null;
  }
  
  add(item) {
    return new Promise((resolve, reject) => {
      this.queue.push({ item, resolve, reject });
      
      if (this.queue.length >= this.options.batchSize) {
        this._processBatch();
      } else if (!this.timeout) {
        this.timeout = setTimeout(() => {
          this._processBatch();
        }, this.options.maxWait);
      }
    });
  }
  
  async _processBatch() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    
    const batch = this.queue.splice(0, this.options.batchSize);
    
    try {
      const results = await this._processBatchItems(batch.map(b => b.item));
      
      batch.forEach((batchItem, index) => {
        batchItem.resolve(results[index]);
      });
    } catch (error) {
      batch.forEach(batchItem => {
        batchItem.reject(error);
      });
    } finally {
      this.processing = false;
      
      // Process remaining items
      if (this.queue.length > 0) {
        setTimeout(() => this._processBatch(), 0);
      }
    }
  }
  
  async _processBatchItems(items) {
    // Override in subclasses
    return items.map(item => ({ processed: true, item }));
  }
}

/**
 * Memory management utilities
 */
export const memoryManager = {
  _watchInterval: null,
  _memoryThreshold: 100 * 1024 * 1024, // 100MB
  
  startMemoryWatch() {
    if (this._watchInterval) return;
    
    this._watchInterval = setInterval(() => {
      if (performance.memory) {
        const used = performance.memory.usedJSHeapSize;
        
        if (used > this._memoryThreshold) {
          logger.warn('Memory', 'High memory usage detected', {
            used: `${(used / 1024 / 1024).toFixed(2)}MB`,
            threshold: `${(this._memoryThreshold / 1024 / 1024).toFixed(2)}MB`
          });
          
          // Trigger cache cleanup
          this.cleanup();
        }
      }
    }, 10000); // Check every 10 seconds
  },
  
  stopMemoryWatch() {
    if (this._watchInterval) {
      clearInterval(this._watchInterval);
      this._watchInterval = null;
    }
  },
  
  cleanup() {
    logger.info('Memory', 'Performing cache cleanup');
    
    // Clear old cache entries
    searchCache.clear();
    documentCache.clear();
    normalizationCache.clear();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  },
  
  getStats() {
    if (!performance.memory) {
      return { available: false };
    }
    
    return {
      available: true,
      used: performance.memory.usedJSHeapSize,
      total: performance.memory.totalJSHeapSize,
      limit: performance.memory.jsHeapSizeLimit,
      cacheStats: {
        search: searchCache.getStats(),
        document: documentCache.getStats(),
        normalization: normalizationCache.getStats()
      }
    };
  }
};

/**
 * Request throttling to prevent API abuse
 */
export class RequestThrottler {
  constructor(options = {}) {
    this.options = {
      requestsPerMinute: 60,
      burstLimit: 10,
      ...options
    };
    this.requests = [];
    this.burstCount = 0;
    this.lastBurstReset = Date.now();
  }
  
  canMakeRequest() {
    const now = Date.now();
    
    // Reset burst counter every minute
    if (now - this.lastBurstReset > 60000) {
      this.burstCount = 0;
      this.lastBurstReset = now;
    }
    
    // Check burst limit
    if (this.burstCount >= this.options.burstLimit) {
      return false;
    }
    
    // Clean old requests (older than 1 minute)
    this.requests = this.requests.filter(time => now - time < 60000);
    
    // Check rate limit
    if (this.requests.length >= this.options.requestsPerMinute) {
      return false;
    }
    
    return true;
  }
  
  recordRequest() {
    const now = Date.now();
    this.requests.push(now);
    this.burstCount++;
    
    logger.debug('Throttler', 'Request recorded', {
      requestCount: this.requests.length,
      burstCount: this.burstCount,
      limit: this.options.requestsPerMinute
    });
  }
  
  getStats() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < 60000);
    
    return {
      currentRequests: this.requests.length,
      limit: this.options.requestsPerMinute,
      burstCount: this.burstCount,
      burstLimit: this.options.burstLimit,
      canMakeRequest: this.canMakeRequest()
    };
  }
}

/**
 * Initialize performance optimizations
 */
export const initializeOptimizations = (options = {}) => {
  const {
    enableMemoryWatch = true,
    enableCaching = true,
    cacheConfig = {}
  } = options;
  
  if (enableMemoryWatch) {
    memoryManager.startMemoryWatch();
  }
  
  logger.info('Performance', 'Optimizations initialized', {
    memoryWatch: enableMemoryWatch,
    caching: enableCaching,
    cacheStats: memoryManager.getStats().cacheStats
  });
};

// Global debouncer instance
export const globalDebouncer = new SmartDebouncer({
  delay: 300,
  maxDelay: 1000,
  strategy: 'trailing'
});

// Global request throttler
export const requestThrottler = new RequestThrottler({
  requestsPerMinute: 30,
  burstLimit: 5
});