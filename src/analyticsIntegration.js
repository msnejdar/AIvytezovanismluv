// Analytics Integration Hub - Combines all monitoring and analysis systems

import { globalPerformanceMonitor, searchPerformanceTracker, memoryTracker } from './performanceMonitor.js';
import { SearchQualityAnalyzer, TestDataGenerator } from './searchQualityMetrics.js';
import { AISearchBenchmarkSuite } from './benchmarkSuite.js';
import { globalUXAnalyzer } from './userExperienceAnalyzer.js';

export class AnalyticsHub {
  constructor() {
    this.performanceMonitor = globalPerformanceMonitor;
    this.performanceTracker = searchPerformanceTracker;
    this.memoryTracker = memoryTracker;
    this.qualityAnalyzer = new SearchQualityAnalyzer();
    this.benchmarkSuite = new AISearchBenchmarkSuite();
    this.uxAnalyzer = globalUXAnalyzer;
    
    this.isInitialized = false;
    this.dashboardData = {
      lastUpdate: null,
      realTimeMetrics: {},
      historicalData: [],
      alerts: [],
      insights: []
    };
    
    this.alertThresholds = {
      searchTime: 5000, // ms
      memoryUsage: 100, // MB
      errorRate: 0.1, // 10%
      successRate: 0.8, // 80%
      responseTime: 3000 // ms
    };
  }

  // Initialize all monitoring systems
  async initialize() {
    console.log('[Analytics] Initializing analytics hub...');
    
    try {
      // Start memory tracking
      this.memoryTracker.startTracking(5000); // Every 5 seconds
      
      // Initialize benchmark suite
      await this.benchmarkSuite.initializeTestData();
      
      // Set up periodic data collection
      this.startPeriodicCollection();
      
      this.isInitialized = true;
      console.log('[Analytics] Analytics hub initialized successfully');
      
      return true;
    } catch (error) {
      console.error('[Analytics] Failed to initialize:', error);
      return false;
    }
  }

  // Start periodic data collection
  startPeriodicCollection() {
    // Collect real-time metrics every 10 seconds
    setInterval(() => {
      this.collectRealTimeMetrics();
    }, 10000);
    
    // Generate insights every minute
    setInterval(() => {
      this.generateInsights();
    }, 60000);
    
    // Check for alerts every 30 seconds
    setInterval(() => {
      this.checkAlerts();
    }, 30000);
    
    // Store historical data every 5 minutes
    setInterval(() => {
      this.storeHistoricalData();
    }, 300000);
  }

  // Collect real-time performance metrics
  collectRealTimeMetrics() {
    const now = Date.now();
    const performanceMetrics = this.performanceMonitor.getMetrics();
    const searchStats = this.performanceTracker.getSearchStats();
    const memoryStats = this.memoryTracker.getMemoryStats();
    const uxReport = this.uxAnalyzer.generateUXReport();

    this.dashboardData.realTimeMetrics = {
      timestamp: now,
      performance: {
        totalOperations: Object.values(performanceMetrics).reduce((sum, m) => sum + m.count, 0),
        averageResponseTime: this.calculateAverageResponseTime(performanceMetrics),
        slowOperations: this.getSlowOperations(performanceMetrics),
        memoryUsage: memoryStats?.current || null
      },
      search: {
        totalSearches: searchStats.totalSearches,
        successRate: searchStats.successRate,
        averageResultCount: searchStats.averageResultCount,
        averageDocumentLength: searchStats.averageDocumentLength,
        errorCount: uxReport.session.searchActivity?.abandoned || 0
      },
      userExperience: {
        sessionDuration: uxReport.session.duration,
        interactionCount: uxReport.session.totalInteractions,
        engagementScore: uxReport.overallScore?.score || 0,
        usabilityIssues: uxReport.usabilityIssues?.total || 0
      },
      quality: this.getQualityMetrics()
    };

    this.dashboardData.lastUpdate = now;
    
    // Emit event for real-time dashboard updates
    this.emitDashboardUpdate('realtime', this.dashboardData.realTimeMetrics);
  }

  // Calculate average response time across all operations
  calculateAverageResponseTime(metrics) {
    const operations = Object.values(metrics);
    if (operations.length === 0) return 0;
    
    const totalTime = operations.reduce((sum, op) => sum + op.totalTime, 0);
    const totalCount = operations.reduce((sum, op) => sum + op.count, 0);
    
    return totalCount > 0 ? Math.round(totalTime / totalCount) : 0;
  }

  // Get operations that are performing slowly
  getSlowOperations(metrics) {
    return Object.entries(metrics)
      .filter(([, metric]) => metric.avgTime > this.alertThresholds.searchTime)
      .map(([operation, metric]) => ({
        operation,
        averageTime: Math.round(metric.avgTime),
        count: metric.count,
        p95: Math.round(metric.p95 || 0)
      }));
  }

  // Get current quality metrics
  getQualityMetrics() {
    const qualityReport = this.qualityAnalyzer.generateQualityReport();
    
    return {
      overallQuality: qualityReport.overview?.qualityScore || 0,
      averageRelevance: qualityReport.overview?.averageRelevance || 0,
      averageAccuracy: qualityReport.overview?.averageAccuracy || 0,
      totalQueries: qualityReport.overview?.totalQueries || 0,
      recentTrends: qualityReport.relevanceAnalysis?.relevanceTrends?.slice(-5) || []
    };
  }

  // Generate analytical insights
  generateInsights() {
    const insights = [];
    const metrics = this.dashboardData.realTimeMetrics;
    
    if (!metrics) return;

    // Performance insights
    if (metrics.performance.averageResponseTime > this.alertThresholds.responseTime) {
      insights.push({
        type: 'performance',
        severity: 'warning',
        title: 'Slow Response Times Detected',
        description: `Average response time is ${metrics.performance.averageResponseTime}ms, above threshold of ${this.alertThresholds.responseTime}ms`,
        recommendation: 'Consider optimizing search algorithms or scaling resources',
        timestamp: Date.now()
      });
    }

    // Search success insights
    if (metrics.search.successRate < this.alertThresholds.successRate * 100) {
      insights.push({
        type: 'effectiveness',
        severity: 'error',
        title: 'Low Search Success Rate',
        description: `Search success rate is ${Math.round(metrics.search.successRate)}%, below target of ${this.alertThresholds.successRate * 100}%`,
        recommendation: 'Review search algorithms and add better query understanding',
        timestamp: Date.now()
      });
    }

    // Memory usage insights
    if (metrics.performance.memoryUsage?.current?.usedJSHeapSize > this.alertThresholds.memoryUsage) {
      insights.push({
        type: 'resource',
        severity: 'warning',
        title: 'High Memory Usage',
        description: `Memory usage is ${metrics.performance.memoryUsage.current.usedJSHeapSize}MB, above threshold of ${this.alertThresholds.memoryUsage}MB`,
        recommendation: 'Implement memory optimization strategies and garbage collection',
        timestamp: Date.now()
      });
    }

    // User experience insights
    if (metrics.userExperience.engagementScore < 0.6) {
      insights.push({
        type: 'user_experience',
        severity: 'warning',
        title: 'Low User Engagement',
        description: `User engagement score is ${Math.round(metrics.userExperience.engagementScore * 100)}%, indicating poor user experience`,
        recommendation: 'Improve UI responsiveness and add user guidance features',
        timestamp: Date.now()
      });
    }

    // Quality insights
    if (metrics.quality.averageRelevance < 0.7) {
      insights.push({
        type: 'quality',
        severity: 'warning',
        title: 'Search Relevance Issues',
        description: `Average search relevance is ${Math.round(metrics.quality.averageRelevance * 100)}%, below acceptable threshold`,
        recommendation: 'Enhance search algorithms and improve query understanding',
        timestamp: Date.now()
      });
    }

    // Store new insights
    insights.forEach(insight => {
      // Check if similar insight already exists
      const exists = this.dashboardData.insights.some(existing => 
        existing.type === insight.type && 
        existing.title === insight.title &&
        Date.now() - existing.timestamp < 3600000 // Within last hour
      );
      
      if (!exists) {
        this.dashboardData.insights.push(insight);
      }
    });

    // Keep only last 50 insights
    if (this.dashboardData.insights.length > 50) {
      this.dashboardData.insights = this.dashboardData.insights.slice(-50);
    }

    // Emit insights update
    if (insights.length > 0) {
      this.emitDashboardUpdate('insights', insights);
    }
  }

  // Check for alert conditions
  checkAlerts() {
    const alerts = [];
    const metrics = this.dashboardData.realTimeMetrics;
    
    if (!metrics) return;

    // Critical performance alert
    if (metrics.performance.averageResponseTime > this.alertThresholds.searchTime) {
      alerts.push({
        id: `perf-${Date.now()}`,
        type: 'performance',
        severity: 'critical',
        title: 'Critical Performance Degradation',
        message: `Response time exceeded ${this.alertThresholds.searchTime}ms`,
        timestamp: Date.now(),
        data: { responseTime: metrics.performance.averageResponseTime }
      });
    }

    // Search failure alert
    if (metrics.search.errorCount > 3) {
      alerts.push({
        id: `search-${Date.now()}`,
        type: 'reliability',
        severity: 'error',
        title: 'High Search Failure Rate',
        message: `${metrics.search.errorCount} search errors detected`,
        timestamp: Date.now(),
        data: { errorCount: metrics.search.errorCount }
      });
    }

    // Memory leak alert
    const memStats = metrics.performance.memoryUsage;
    if (memStats?.trend?.memoryGrowth > 50 * 1024 * 1024) { // 50MB growth
      alerts.push({
        id: `memory-${Date.now()}`,
        type: 'resource',
        severity: 'warning',
        title: 'Potential Memory Leak',
        message: `Memory usage increased by ${Math.round(memStats.trend.memoryGrowth / 1024 / 1024)}MB`,
        timestamp: Date.now(),
        data: memStats.trend
      });
    }

    // Store alerts
    alerts.forEach(alert => {
      this.dashboardData.alerts.push(alert);
    });

    // Keep only last 100 alerts
    if (this.dashboardData.alerts.length > 100) {
      this.dashboardData.alerts = this.dashboardData.alerts.slice(-100);
    }

    // Emit alerts
    if (alerts.length > 0) {
      this.emitDashboardUpdate('alerts', alerts);
    }
  }

  // Store historical data points
  storeHistoricalData() {
    const metrics = this.dashboardData.realTimeMetrics;
    if (!metrics) return;

    const dataPoint = {
      timestamp: Date.now(),
      performance: {
        responseTime: metrics.performance.averageResponseTime,
        operationCount: metrics.performance.totalOperations,
        memoryUsage: metrics.performance.memoryUsage?.current?.usedJSHeapSize || 0
      },
      search: {
        totalSearches: metrics.search.totalSearches,
        successRate: metrics.search.successRate,
        averageResults: metrics.search.averageResultCount
      },
      userExperience: {
        sessionDuration: metrics.userExperience.sessionDuration,
        engagementScore: metrics.userExperience.engagementScore,
        interactionCount: metrics.userExperience.interactionCount
      },
      quality: {
        qualityScore: metrics.quality.overallQuality,
        relevanceScore: metrics.quality.averageRelevance,
        accuracyScore: metrics.quality.averageAccuracy
      }
    };

    this.dashboardData.historicalData.push(dataPoint);

    // Keep only last 288 data points (24 hours at 5-minute intervals)
    if (this.dashboardData.historicalData.length > 288) {
      this.dashboardData.historicalData = this.dashboardData.historicalData.slice(-288);
    }
  }

  // Track search operation with all monitoring systems
  async trackSearch(query, document, results, startTime) {
    const duration = Date.now() - startTime;
    const success = results && results.length > 0;
    
    // Track with performance monitor
    this.performanceTracker.trackSearch(query, document, results, duration, success);
    
    // Track with UX analyzer
    this.uxAnalyzer.trackInteraction('search_initiated', { query });
    this.uxAnalyzer.trackInteraction('search_completed', { 
      query, 
      duration, 
      resultCount: results?.length || 0 
    });
    
    // Analyze quality if results exist
    if (results && results.length > 0) {
      const relevance = this.qualityAnalyzer.analyzeRelevance(query, results, document);
      
      // Store quality data
      this.qualityAnalyzer.relevanceHistory.push({
        timestamp: Date.now(),
        query,
        analysis: relevance
      });
    }
    
    return {
      duration,
      success,
      resultCount: results?.length || 0,
      trackingComplete: true
    };
  }

  // Track document normalization
  trackNormalization(originalText, normalizedDoc, duration) {
    const result = this.performanceTracker.trackNormalization(
      originalText.length,
      normalizedDoc.normalized.length,
      duration
    );
    
    // Track with UX analyzer
    this.uxAnalyzer.trackInteraction('document_uploaded', {
      originalLength: originalText.length,
      normalizedLength: normalizedDoc.normalized.length
    });
    
    return result;
  }

  // Track highlighting operation
  trackHighlighting(text, ranges, duration) {
    const result = this.performanceTracker.trackHighlighting(
      text.length,
      ranges.length,
      duration
    );
    
    // Track with UX analyzer if user clicked highlight
    if (ranges.length > 0) {
      this.uxAnalyzer.trackInteraction('highlight_clicked', {
        rangeCount: ranges.length,
        textLength: text.length
      });
    }
    
    return result;
  }

  // Track error occurrences
  trackError(error, context) {
    this.uxAnalyzer.trackInteraction('error_occurred', {
      error: error.message || error.toString(),
      context
    });
    
    console.error('[Analytics] Error tracked:', error, context);
  }

  // Run comprehensive analysis
  async runComprehensiveAnalysis() {
    console.log('[Analytics] Running comprehensive analysis...');
    
    const analysis = {
      timestamp: new Date().toISOString(),
      performance: this.performanceMonitor.getMetrics(),
      searchStats: this.performanceTracker.getSearchStats(),
      memoryStats: this.memoryTracker.getMemoryStats(),
      qualityReport: this.qualityAnalyzer.generateQualityReport(),
      uxReport: this.uxAnalyzer.generateUXReport(),
      currentMetrics: this.dashboardData.realTimeMetrics,
      insights: this.dashboardData.insights.slice(-10), // Last 10 insights
      alerts: this.dashboardData.alerts.filter(a => Date.now() - a.timestamp < 3600000) // Last hour
    };
    
    // Run benchmark if requested
    if (this.benchmarkSuite.testData) {
      try {
        analysis.benchmarkResults = await this.benchmarkSuite.runFullBenchmark();
      } catch (error) {
        console.warn('[Analytics] Benchmark failed:', error);
        analysis.benchmarkError = error.message;
      }
    }
    
    return analysis;
  }

  // Get dashboard data for UI
  getDashboardData() {
    return {
      ...this.dashboardData,
      isInitialized: this.isInitialized,
      systemHealth: this.calculateSystemHealth()
    };
  }

  // Calculate overall system health score
  calculateSystemHealth() {
    const metrics = this.dashboardData.realTimeMetrics;
    if (!metrics) return { score: 0, status: 'unknown' };

    let score = 100;

    // Performance impact
    if (metrics.performance.averageResponseTime > this.alertThresholds.responseTime) {
      score -= 20;
    }

    // Search success impact
    if (metrics.search.successRate < this.alertThresholds.successRate * 100) {
      score -= 25;
    }

    // Memory usage impact
    if (metrics.performance.memoryUsage?.current?.usedJSHeapSize > this.alertThresholds.memoryUsage) {
      score -= 15;
    }

    // UX impact
    if (metrics.userExperience.engagementScore < 0.6) {
      score -= 20;
    }

    // Quality impact
    if (metrics.quality.averageRelevance < 0.7) {
      score -= 20;
    }

    const status = score >= 80 ? 'healthy' : score >= 60 ? 'warning' : 'critical';

    return {
      score: Math.max(0, score),
      status,
      components: {
        performance: metrics.performance.averageResponseTime <= this.alertThresholds.responseTime,
        search: metrics.search.successRate >= this.alertThresholds.successRate * 100,
        memory: (metrics.performance.memoryUsage?.current?.usedJSHeapSize || 0) <= this.alertThresholds.memoryUsage,
        userExperience: metrics.userExperience.engagementScore >= 0.6,
        quality: metrics.quality.averageRelevance >= 0.7
      }
    };
  }

  // Emit dashboard updates (for real-time UI updates)
  emitDashboardUpdate(type, data) {
    // Custom event for dashboard updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('analyticsUpdate', {
        detail: { type, data, timestamp: Date.now() }
      }));
    }
  }

  // Export all analytics data
  exportAnalyticsData() {
    const data = {
      exportTimestamp: new Date().toISOString(),
      dashboardData: this.dashboardData,
      performanceMetrics: this.performanceMonitor.getMetrics(),
      searchStats: this.performanceTracker.getSearchStats(),
      memoryStats: this.memoryTracker.getMemoryStats(),
      qualityReport: this.qualityAnalyzer.generateQualityReport(),
      uxReport: this.uxAnalyzer.generateUXReport(),
      systemHealth: this.calculateSystemHealth()
    };

    // Create downloadable file
    if (typeof window !== 'undefined') {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-report-${new Date().toISOString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }

    return data;
  }

  // Reset all analytics (for new session)
  reset() {
    this.performanceMonitor.reset();
    this.qualityAnalyzer.clearMetrics();
    this.uxAnalyzer.reset();
    this.dashboardData = {
      lastUpdate: null,
      realTimeMetrics: {},
      historicalData: [],
      alerts: [],
      insights: []
    };
  }

  // Cleanup on destroy
  destroy() {
    this.memoryTracker.stopTracking();
    this.reset();
    this.isInitialized = false;
  }
}

// Create global analytics hub instance
export const globalAnalyticsHub = new AnalyticsHub();

// Auto-initialize when module loads
if (typeof window !== 'undefined') {
  globalAnalyticsHub.initialize().catch(console.error);
}

export default AnalyticsHub;