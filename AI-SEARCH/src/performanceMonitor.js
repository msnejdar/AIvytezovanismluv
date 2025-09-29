// Performance monitoring and metrics collection
export class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.isEnabled = true;
  }

  // Start measuring operation
  startMeasure(operation) {
    if (!this.isEnabled) return null;
    
    const measureId = `${operation}-${Date.now()}-${Math.random()}`;
    const start = performance.now();
    
    return {
      measureId,
      operation,
      start,
      end: () => this.endMeasure(measureId, operation, start)
    };
  }

  // End measuring operation
  endMeasure(measureId, operation, startTime) {
    if (!this.isEnabled) return;
    
    const end = performance.now();
    const duration = end - startTime;
    
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, {
        operation,
        count: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0,
        avgTime: 0,
        samples: []
      });
    }
    
    const metric = this.metrics.get(operation);
    metric.count++;
    metric.totalTime += duration;
    metric.minTime = Math.min(metric.minTime, duration);
    metric.maxTime = Math.max(metric.maxTime, duration);
    metric.avgTime = metric.totalTime / metric.count;
    
    // Keep last 100 samples for percentile calculations
    metric.samples.push(duration);
    if (metric.samples.length > 100) {
      metric.samples.shift();
    }
    
    return duration;
  }

  // Get performance metrics
  getMetrics() {
    const results = {};
    
    for (const [operation, metric] of this.metrics) {
      const sortedSamples = [...metric.samples].sort((a, b) => a - b);
      const p50 = this.percentile(sortedSamples, 50);
      const p95 = this.percentile(sortedSamples, 95);
      const p99 = this.percentile(sortedSamples, 99);
      
      results[operation] = {
        ...metric,
        p50,
        p95,
        p99,
        samples: undefined // Don't include raw samples in output
      };
    }
    
    return results;
  }

  // Calculate percentile
  percentile(arr, p) {
    if (arr.length === 0) return 0;
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, Math.min(index, arr.length - 1))];
  }

  // Reset all metrics
  reset() {
    this.metrics.clear();
  }

  // Enable/disable monitoring
  setEnabled(enabled) {
    this.isEnabled = enabled;
  }

  // Export metrics to console or file
  exportMetrics() {
    const metrics = this.getMetrics();
    console.table(metrics);
    return metrics;
  }
}

// Search-specific performance metrics
export class SearchPerformanceTracker {
  constructor(monitor = new PerformanceMonitor()) {
    this.monitor = monitor;
    this.searchMetrics = {
      totalSearches: 0,
      successfulSearches: 0,
      failedSearches: 0,
      averageResultCount: 0,
      averageDocumentLength: 0,
      averageQueryLength: 0
    };
  }

  // Track search operation
  trackSearch(query, document, results, duration, success = true) {
    this.searchMetrics.totalSearches++;
    
    if (success) {
      this.searchMetrics.successfulSearches++;
    } else {
      this.searchMetrics.failedSearches++;
    }
    
    // Update rolling averages
    const total = this.searchMetrics.totalSearches;
    this.searchMetrics.averageResultCount = 
      ((this.searchMetrics.averageResultCount * (total - 1)) + (results?.length || 0)) / total;
    
    this.searchMetrics.averageDocumentLength = 
      ((this.searchMetrics.averageDocumentLength * (total - 1)) + (document?.length || 0)) / total;
    
    this.searchMetrics.averageQueryLength = 
      ((this.searchMetrics.averageQueryLength * (total - 1)) + (query?.length || 0)) / total;
    
    // Log detailed metrics
    this.monitor.endMeasure(`search-${Date.now()}`, 'search', performance.now() - duration);
  }

  // Track document normalization
  trackNormalization(originalLength, normalizedLength, duration) {
    const measure = this.monitor.startMeasure('document-normalization');
    
    // Calculate efficiency metrics
    const compressionRatio = normalizedLength / originalLength;
    const charactersPerMs = originalLength / duration;
    
    console.log('[Performance] Document normalization:', {
      originalLength,
      normalizedLength,
      compressionRatio: Math.round(compressionRatio * 100) / 100,
      charactersPerMs: Math.round(charactersPerMs),
      duration: `${Math.round(duration * 100) / 100}ms`
    });
    
    if (measure) measure.end();
    return { compressionRatio, charactersPerMs };
  }

  // Track highlighting performance
  trackHighlighting(textLength, rangeCount, duration) {
    const measure = this.monitor.startMeasure('highlighting');
    
    const rangesPerMs = rangeCount / duration;
    const charactersPerMs = textLength / duration;
    
    console.log('[Performance] Highlighting:', {
      textLength,
      rangeCount,
      rangesPerMs: Math.round(rangesPerMs * 100) / 100,
      charactersPerMs: Math.round(charactersPerMs),
      duration: `${Math.round(duration * 100) / 100}ms`
    });
    
    if (measure) measure.end();
    return { rangesPerMs, charactersPerMs };
  }

  // Get search statistics
  getSearchStats() {
    return {
      ...this.searchMetrics,
      successRate: this.searchMetrics.totalSearches > 0 
        ? (this.searchMetrics.successfulSearches / this.searchMetrics.totalSearches) * 100 
        : 0
    };
  }
}

// Memory usage tracker
export class MemoryTracker {
  constructor() {
    this.snapshots = [];
    this.isTracking = false;
  }

  // Start tracking memory usage
  startTracking(interval = 5000) {
    if (this.isTracking) return;
    
    this.isTracking = true;
    this.trackingInterval = setInterval(() => {
      if ('memory' in performance) {
        const snapshot = {
          timestamp: Date.now(),
          ...performance.memory
        };
        this.snapshots.push(snapshot);
        
        // Keep only last 100 snapshots
        if (this.snapshots.length > 100) {
          this.snapshots.shift();
        }
      }
    }, interval);
  }

  // Stop tracking
  stopTracking() {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
    }
    this.isTracking = false;
  }

  // Get memory statistics
  getMemoryStats() {
    if (this.snapshots.length === 0) return null;
    
    const latest = this.snapshots[this.snapshots.length - 1];
    const oldest = this.snapshots[0];
    
    return {
      current: {
        usedJSHeapSize: Math.round(latest.usedJSHeapSize / 1024 / 1024),
        totalJSHeapSize: Math.round(latest.totalJSHeapSize / 1024 / 1024),
        jsHeapSizeLimit: Math.round(latest.jsHeapSizeLimit / 1024 / 1024)
      },
      trend: {
        memoryGrowth: latest.usedJSHeapSize - oldest.usedJSHeapSize,
        timespan: latest.timestamp - oldest.timestamp
      },
      samples: this.snapshots.length
    };
  }
}

// Create global performance monitor instance
export const globalPerformanceMonitor = new PerformanceMonitor();
export const searchPerformanceTracker = new SearchPerformanceTracker(globalPerformanceMonitor);
export const memoryTracker = new MemoryTracker();

// Performance benchmark tests
export class PerformanceBenchmark {
  constructor() {
    this.testResults = new Map();
  }

  // Benchmark document normalization
  async benchmarkNormalization(testData) {
    const results = [];
    
    for (const data of testData) {
      const start = performance.now();
      
      // Simulate normalization process
      const normalized = data.text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      
      const duration = performance.now() - start;
      
      results.push({
        textLength: data.text.length,
        normalizedLength: normalized.length,
        duration,
        charactersPerMs: data.text.length / duration
      });
    }
    
    this.testResults.set('normalization', results);
    return results;
  }

  // Benchmark search operations
  async benchmarkSearch(queries, document) {
    const results = [];
    
    for (const query of queries) {
      const start = performance.now();
      
      // Simulate search
      const matches = [];
      const lowerDoc = document.toLowerCase();
      const lowerQuery = query.toLowerCase();
      
      let index = 0;
      while ((index = lowerDoc.indexOf(lowerQuery, index)) !== -1) {
        matches.push({
          start: index,
          end: index + query.length,
          text: document.substring(index, index + query.length)
        });
        index++;
      }
      
      const duration = performance.now() - start;
      
      results.push({
        query,
        queryLength: query.length,
        documentLength: document.length,
        matchCount: matches.length,
        duration,
        matchesPerMs: matches.length / duration
      });
    }
    
    this.testResults.set('search', results);
    return results;
  }

  // Benchmark highlighting
  async benchmarkHighlighting(testCases) {
    const results = [];
    
    for (const testCase of testCases) {
      const { text, ranges } = testCase;
      const start = performance.now();
      
      // Simulate highlighting process
      let highlighted = text;
      const sortedRanges = ranges.sort((a, b) => b.start - a.start);
      
      for (const range of sortedRanges) {
        const before = highlighted.substring(0, range.start);
        const highlight = highlighted.substring(range.start, range.end);
        const after = highlighted.substring(range.end);
        highlighted = before + `<mark>${highlight}</mark>` + after;
      }
      
      const duration = performance.now() - start;
      
      results.push({
        textLength: text.length,
        rangeCount: ranges.length,
        duration,
        rangesPerMs: ranges.length / duration,
        charactersPerMs: text.length / duration
      });
    }
    
    this.testResults.set('highlighting', results);
    return results;
  }

  // Get all benchmark results
  getAllResults() {
    const results = {};
    for (const [test, data] of this.testResults) {
      results[test] = {
        samples: data.length,
        averageDuration: data.reduce((sum, r) => sum + r.duration, 0) / data.length,
        minDuration: Math.min(...data.map(r => r.duration)),
        maxDuration: Math.max(...data.map(r => r.duration)),
        data
      };
    }
    return results;
  }
}

// Export performance utilities
export const performanceUtils = {
  measureAsync: async (operation, asyncFn) => {
    const measure = globalPerformanceMonitor.startMeasure(operation);
    try {
      const result = await asyncFn();
      if (measure) measure.end();
      return result;
    } catch (error) {
      if (measure) measure.end();
      throw error;
    }
  },
  
  measureSync: (operation, syncFn) => {
    const measure = globalPerformanceMonitor.startMeasure(operation);
    try {
      const result = syncFn();
      if (measure) measure.end();
      return result;
    } catch (error) {
      if (measure) measure.end();
      throw error;
    }
  },
  
  createTestData: (sizes = [100, 1000, 10000, 50000]) => {
    return sizes.map(size => ({
      text: 'A'.repeat(size) + ' Test text with various characters áčďéěíňóřšťúůýž and numbers 123456/7890.',
      size
    }));
  },
  
  createTestQueries: () => [
    'test',
    'various characters',
    '123456/7890',
    'áčďéěíňóřšťúůýž',
    'A'.repeat(50),
    'nonexistent query'
  ]
};