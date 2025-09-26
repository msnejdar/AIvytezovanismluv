// User Experience Analysis and Optimization System

export class UserExperienceAnalyzer {
  constructor() {
    this.interactionHistory = [];
    this.performanceMetrics = new Map();
    this.usabilityIssues = [];
    this.sessionData = {
      startTime: Date.now(),
      totalInteractions: 0,
      searchAttempts: 0,
      successfulSearches: 0,
      abandonedSearches: 0,
      averageSearchTime: 0,
      highlightInteractions: 0,
      documentUploads: 0,
      errors: []
    };
  }

  // Track user interaction events
  trackInteraction(type, data = {}) {
    const interaction = {
      timestamp: Date.now(),
      type,
      data,
      sessionTime: Date.now() - this.sessionData.startTime
    };

    this.interactionHistory.push(interaction);
    this.sessionData.totalInteractions++;

    // Update session metrics based on interaction type
    this.updateSessionMetrics(type, data);

    // Analyze for usability issues
    this.analyzeInteractionForIssues(interaction);

    return interaction;
  }

  // Update session metrics
  updateSessionMetrics(type, data) {
    switch (type) {
      case 'search_initiated':
        this.sessionData.searchAttempts++;
        break;
        
      case 'search_completed':
        this.sessionData.successfulSearches++;
        if (data.duration) {
          const currentAvg = this.sessionData.averageSearchTime;
          const count = this.sessionData.successfulSearches;
          this.sessionData.averageSearchTime = 
            ((currentAvg * (count - 1)) + data.duration) / count;
        }
        break;
        
      case 'search_abandoned':
        this.sessionData.abandonedSearches++;
        break;
        
      case 'highlight_clicked':
        this.sessionData.highlightInteractions++;
        break;
        
      case 'document_uploaded':
        this.sessionData.documentUploads++;
        break;
        
      case 'error_occurred':
        this.sessionData.errors.push({
          timestamp: Date.now(),
          error: data.error,
          context: data.context
        });
        break;
    }
  }

  // Analyze interaction for potential usability issues
  analyzeInteractionForIssues(interaction) {
    const issues = [];

    // Long search times
    if (interaction.type === 'search_completed' && interaction.data.duration > 5000) {
      issues.push({
        type: 'performance',
        severity: 'high',
        issue: 'slow_search',
        description: 'Search took longer than 5 seconds',
        data: { duration: interaction.data.duration }
      });
    }

    // Multiple rapid searches (user struggling)
    if (interaction.type === 'search_initiated') {
      const recentSearches = this.interactionHistory
        .filter(i => i.type === 'search_initiated' && 
                Date.now() - i.timestamp < 30000) // Last 30 seconds
        .length;
      
      if (recentSearches >= 3) {
        issues.push({
          type: 'usability',
          severity: 'medium',
          issue: 'rapid_searches',
          description: 'User performed multiple searches in short time',
          data: { searchCount: recentSearches }
        });
      }
    }

    // No results found repeatedly
    if (interaction.type === 'search_completed' && 
        interaction.data.resultCount === 0) {
      const recentNoResults = this.interactionHistory
        .filter(i => i.type === 'search_completed' && 
                i.data.resultCount === 0 &&
                Date.now() - i.timestamp < 60000) // Last minute
        .length;
      
      if (recentNoResults >= 2) {
        issues.push({
          type: 'effectiveness',
          severity: 'high',
          issue: 'no_results_pattern',
          description: 'Multiple searches with no results',
          data: { consecutiveNoResults: recentNoResults }
        });
      }
    }

    // User not interacting with results
    if (interaction.type === 'search_completed' && 
        interaction.data.resultCount > 0) {
      setTimeout(() => {
        const hasInteracted = this.interactionHistory
          .some(i => i.timestamp > interaction.timestamp &&
                i.type === 'highlight_clicked' &&
                Date.now() - i.timestamp < 10000); // 10 seconds
        
        if (!hasInteracted) {
          this.usabilityIssues.push({
            type: 'engagement',
            severity: 'medium',
            issue: 'no_result_interaction',
            description: 'User did not interact with search results',
            timestamp: Date.now()
          });
        }
      }, 10000);
    }

    // Add issues to collection
    issues.forEach(issue => {
      this.usabilityIssues.push({
        ...issue,
        timestamp: interaction.timestamp,
        interactionId: this.interactionHistory.length - 1
      });
    });
  }

  // Analyze search patterns and user behavior
  analyzeSearchPatterns() {
    const searches = this.interactionHistory.filter(i => 
      i.type === 'search_initiated' || i.type === 'search_completed'
    );

    if (searches.length === 0) {
      return { message: 'No search patterns available' };
    }

    const patterns = {
      searchFrequency: this.calculateSearchFrequency(),
      queryComplexity: this.analyzeQueryComplexity(),
      resultInteraction: this.analyzeResultInteraction(),
      searchSuccess: this.calculateSearchSuccessRate(),
      userJourney: this.analyzeUserJourney(),
      commonQueries: this.findCommonQueries(),
      timeDistribution: this.analyzeTimeDistribution()
    };

    return patterns;
  }

  // Calculate search frequency patterns
  calculateSearchFrequency() {
    const searches = this.interactionHistory.filter(i => i.type === 'search_initiated');
    if (searches.length < 2) return { frequency: 0, pattern: 'insufficient_data' };

    const intervals = [];
    for (let i = 1; i < searches.length; i++) {
      intervals.push(searches[i].timestamp - searches[i-1].timestamp);
    }

    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const medianInterval = intervals.sort((a, b) => a - b)[Math.floor(intervals.length / 2)];

    return {
      averageInterval: Math.round(avgInterval / 1000), // seconds
      medianInterval: Math.round(medianInterval / 1000), // seconds
      totalSearches: searches.length,
      pattern: this.classifySearchPattern(avgInterval)
    };
  }

  // Classify search pattern based on frequency
  classifySearchPattern(avgInterval) {
    if (avgInterval < 10000) return 'rapid'; // < 10 seconds
    if (avgInterval < 60000) return 'frequent'; // < 1 minute
    if (avgInterval < 300000) return 'moderate'; // < 5 minutes
    return 'occasional'; // > 5 minutes
  }

  // Analyze query complexity
  analyzeQueryComplexity() {
    const searches = this.interactionHistory.filter(i => 
      i.type === 'search_initiated' && i.data.query
    );

    if (searches.length === 0) return { message: 'No query data available' };

    const complexityMetrics = searches.map(search => {
      const query = search.data.query;
      return {
        length: query.length,
        wordCount: query.split(/\s+/).length,
        hasNumbers: /\d/.test(query),
        hasSpecialChars: /[^\w\s]/.test(query),
        hasCzechChars: /[áčďéěíňóřšťúůýž]/i.test(query),
        complexity: this.calculateQueryComplexity(query)
      };
    });

    return {
      averageLength: Math.round(
        complexityMetrics.reduce((sum, m) => sum + m.length, 0) / complexityMetrics.length
      ),
      averageWordCount: Math.round(
        complexityMetrics.reduce((sum, m) => sum + m.wordCount, 0) / complexityMetrics.length * 10
      ) / 10,
      percentageWithNumbers: Math.round(
        complexityMetrics.filter(m => m.hasNumbers).length / complexityMetrics.length * 100
      ),
      percentageWithSpecialChars: Math.round(
        complexityMetrics.filter(m => m.hasSpecialChars).length / complexityMetrics.length * 100
      ),
      averageComplexity: Math.round(
        complexityMetrics.reduce((sum, m) => sum + m.complexity, 0) / complexityMetrics.length * 100
      ) / 100,
      distribution: this.getComplexityDistribution(complexityMetrics)
    };
  }

  // Calculate individual query complexity score
  calculateQueryComplexity(query) {
    let score = 0;
    
    // Length factor (normalized)
    score += Math.min(query.length / 50, 1) * 0.3;
    
    // Word count factor
    const wordCount = query.split(/\s+/).length;
    score += Math.min(wordCount / 10, 1) * 0.3;
    
    // Special characters
    if (/[^\w\s]/.test(query)) score += 0.2;
    
    // Numbers (often indicate specific searches)
    if (/\d/.test(query)) score += 0.1;
    
    // Czech diacritics (language complexity)
    if (/[áčďéěíňóřšťúůýž]/i.test(query)) score += 0.1;
    
    return Math.min(score, 1);
  }

  // Get complexity distribution
  getComplexityDistribution(metrics) {
    const buckets = { simple: 0, moderate: 0, complex: 0 };
    
    metrics.forEach(m => {
      if (m.complexity < 0.3) buckets.simple++;
      else if (m.complexity < 0.7) buckets.moderate++;
      else buckets.complex++;
    });
    
    return buckets;
  }

  // Analyze how users interact with results
  analyzeResultInteraction() {
    const completedSearches = this.interactionHistory.filter(i => 
      i.type === 'search_completed' && i.data.resultCount > 0
    );
    
    const highlightClicks = this.interactionHistory.filter(i => 
      i.type === 'highlight_clicked'
    );

    if (completedSearches.length === 0) {
      return { message: 'No completed searches with results' };
    }

    // Calculate time from search completion to first result interaction
    const interactionTimes = completedSearches.map(search => {
      const nextHighlight = highlightClicks.find(h => 
        h.timestamp > search.timestamp && 
        h.timestamp < search.timestamp + 30000 // Within 30 seconds
      );
      
      return nextHighlight ? nextHighlight.timestamp - search.timestamp : null;
    }).filter(time => time !== null);

    return {
      totalSearchesWithResults: completedSearches.length,
      totalResultInteractions: highlightClicks.length,
      interactionRate: Math.round(
        (interactionTimes.length / completedSearches.length) * 100
      ),
      averageTimeToInteraction: interactionTimes.length > 0 
        ? Math.round(interactionTimes.reduce((sum, time) => sum + time, 0) / interactionTimes.length)
        : null,
      quickInteractions: interactionTimes.filter(time => time < 3000).length, // < 3 seconds
      delayedInteractions: interactionTimes.filter(time => time > 10000).length // > 10 seconds
    };
  }

  // Calculate search success rate
  calculateSearchSuccessRate() {
    const initiated = this.sessionData.searchAttempts;
    const completed = this.sessionData.successfulSearches;
    const abandoned = this.sessionData.abandonedSearches;

    return {
      successRate: initiated > 0 ? Math.round((completed / initiated) * 100) : 0,
      abandonmentRate: initiated > 0 ? Math.round((abandoned / initiated) * 100) : 0,
      averageSearchTime: Math.round(this.sessionData.averageSearchTime),
      totalAttempts: initiated,
      completedSearches: completed,
      abandonedSearches: abandoned
    };
  }

  // Analyze user journey patterns
  analyzeUserJourney() {
    const interactions = this.interactionHistory;
    if (interactions.length < 2) return { message: 'Insufficient interaction data' };

    const journey = {
      sessionDuration: Date.now() - this.sessionData.startTime,
      interactionSequence: this.getInteractionSequence(),
      commonPaths: this.findCommonInteractionPaths(),
      dropoffPoints: this.identifyDropoffPoints(),
      engagementScore: this.calculateEngagementScore()
    };

    return journey;
  }

  // Get sequence of interaction types
  getInteractionSequence() {
    return this.interactionHistory.map(i => i.type);
  }

  // Find common interaction paths
  findCommonInteractionPaths() {
    const sequences = [];
    const sequence = this.getInteractionSequence();
    
    // Look for patterns of length 3
    for (let i = 0; i <= sequence.length - 3; i++) {
      const path = sequence.slice(i, i + 3).join(' -> ');
      sequences.push(path);
    }
    
    // Count occurrences
    const pathCounts = sequences.reduce((acc, path) => {
      acc[path] = (acc[path] || 0) + 1;
      return acc;
    }, {});
    
    // Return most common paths
    return Object.entries(pathCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([path, count]) => ({ path, count }));
  }

  // Identify where users commonly stop/abandon
  identifyDropoffPoints() {
    const dropoffs = [];
    const sequence = this.getInteractionSequence();
    
    // Find long gaps between interactions (>30 seconds)
    for (let i = 1; i < this.interactionHistory.length; i++) {
      const gap = this.interactionHistory[i].timestamp - this.interactionHistory[i-1].timestamp;
      if (gap > 30000) { // 30 seconds
        dropoffs.push({
          afterAction: this.interactionHistory[i-1].type,
          gapDuration: Math.round(gap / 1000), // seconds
          timestamp: this.interactionHistory[i-1].timestamp
        });
      }
    }
    
    return dropoffs;
  }

  // Calculate overall engagement score
  calculateEngagementScore() {
    const metrics = {
      interactionRate: this.interactionHistory.length / (Date.now() - this.sessionData.startTime) * 60000, // per minute
      successRate: this.sessionData.searchAttempts > 0 ? this.sessionData.successfulSearches / this.sessionData.searchAttempts : 0,
      highlightInteractionRate: this.sessionData.successfulSearches > 0 ? this.sessionData.highlightInteractions / this.sessionData.successfulSearches : 0,
      errorRate: this.sessionData.errors.length / this.interactionHistory.length
    };

    // Weighted engagement score (0-1)
    const score = 
      (Math.min(metrics.interactionRate / 5, 1) * 0.25) + // interaction frequency
      (metrics.successRate * 0.35) + // search success
      (Math.min(metrics.highlightInteractionRate, 1) * 0.25) + // result engagement
      ((1 - Math.min(metrics.errorRate * 5, 1)) * 0.15); // error impact

    return {
      score: Math.round(score * 100) / 100,
      level: this.classifyEngagement(score),
      metrics
    };
  }

  // Classify engagement level
  classifyEngagement(score) {
    if (score >= 0.8) return 'high';
    if (score >= 0.6) return 'moderate';
    if (score >= 0.4) return 'low';
    return 'very_low';
  }

  // Find most common queries
  findCommonQueries() {
    const queries = this.interactionHistory
      .filter(i => i.type === 'search_initiated' && i.data.query)
      .map(i => i.data.query.toLowerCase().trim());

    const queryCounts = queries.reduce((acc, query) => {
      acc[query] = (acc[query] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(queryCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));
  }

  // Analyze time distribution of interactions
  analyzeTimeDistribution() {
    if (this.interactionHistory.length === 0) return null;

    const sessionDuration = Date.now() - this.sessionData.startTime;
    const hourlyDistribution = new Array(24).fill(0);
    const timeGaps = [];

    // Analyze gaps between interactions
    for (let i = 1; i < this.interactionHistory.length; i++) {
      const gap = this.interactionHistory[i].timestamp - this.interactionHistory[i-1].timestamp;
      timeGaps.push(gap);
    }

    return {
      sessionDuration: Math.round(sessionDuration / 1000), // seconds
      averageInteractionGap: timeGaps.length > 0 
        ? Math.round(timeGaps.reduce((sum, gap) => sum + gap, 0) / timeGaps.length)
        : 0,
      longestGap: Math.max(...timeGaps, 0),
      shortestGap: Math.min(...timeGaps, Infinity) === Infinity ? 0 : Math.min(...timeGaps),
      interactionDensity: this.interactionHistory.length / (sessionDuration / 60000) // per minute
    };
  }

  // Generate UX improvement recommendations
  generateRecommendations() {
    const patterns = this.analyzeSearchPatterns();
    const issues = this.categorizeUsabilityIssues();
    const recommendations = [];

    // Performance recommendations
    if (this.sessionData.averageSearchTime > 3000) {
      recommendations.push({
        category: 'performance',
        priority: 'high',
        issue: 'Slow search response times',
        recommendation: 'Optimize search algorithm and implement result caching',
        impact: 'Reduce user frustration and abandonment',
        metrics: { currentAverage: this.sessionData.averageSearchTime }
      });
    }

    // Success rate recommendations
    const successRate = this.sessionData.searchAttempts > 0 
      ? this.sessionData.successfulSearches / this.sessionData.searchAttempts 
      : 1;
    
    if (successRate < 0.8) {
      recommendations.push({
        category: 'effectiveness',
        priority: 'high',
        issue: 'Low search success rate',
        recommendation: 'Improve query understanding and add search suggestions',
        impact: 'Increase user satisfaction and task completion',
        metrics: { successRate: Math.round(successRate * 100) }
      });
    }

    // Interaction recommendations
    if (patterns.resultInteraction?.interactionRate < 50) {
      recommendations.push({
        category: 'engagement',
        priority: 'medium',
        issue: 'Low result interaction rate',
        recommendation: 'Improve result presentation and add visual cues',
        impact: 'Better user engagement with search results',
        metrics: { interactionRate: patterns.resultInteraction.interactionRate }
      });
    }

    // Query complexity recommendations
    if (patterns.queryComplexity?.averageComplexity > 0.7) {
      recommendations.push({
        category: 'usability',
        priority: 'medium',
        issue: 'High query complexity',
        recommendation: 'Add query assistance and autocomplete features',
        impact: 'Simplify user interactions and reduce cognitive load',
        metrics: { averageComplexity: patterns.queryComplexity.averageComplexity }
      });
    }

    // Error rate recommendations
    if (this.sessionData.errors.length > 2) {
      recommendations.push({
        category: 'reliability',
        priority: 'high',
        issue: 'Frequent errors occurring',
        recommendation: 'Improve error handling and add user guidance',
        impact: 'Reduce user frustration and support ticket volume',
        metrics: { errorCount: this.sessionData.errors.length }
      });
    }

    // Rapid search pattern recommendations
    if (patterns.searchFrequency?.pattern === 'rapid') {
      recommendations.push({
        category: 'user_guidance',
        priority: 'medium',
        issue: 'Users struggling with search formulation',
        recommendation: 'Add contextual help and example queries',
        impact: 'Reduce user confusion and improve search efficiency',
        metrics: { searchPattern: patterns.searchFrequency.pattern }
      });
    }

    return {
      totalRecommendations: recommendations.length,
      highPriority: recommendations.filter(r => r.priority === 'high').length,
      mediumPriority: recommendations.filter(r => r.priority === 'medium').length,
      lowPriority: recommendations.filter(r => r.priority === 'low').length,
      categories: [...new Set(recommendations.map(r => r.category))],
      recommendations
    };
  }

  // Categorize usability issues
  categorizeUsabilityIssues() {
    const categories = {
      performance: [],
      usability: [],
      effectiveness: [],
      engagement: []
    };

    this.usabilityIssues.forEach(issue => {
      if (categories[issue.type]) {
        categories[issue.type].push(issue);
      }
    });

    return categories;
  }

  // Generate comprehensive UX report
  generateUXReport() {
    return {
      timestamp: new Date().toISOString(),
      session: {
        duration: Date.now() - this.sessionData.startTime,
        totalInteractions: this.sessionData.totalInteractions,
        searchActivity: {
          attempts: this.sessionData.searchAttempts,
          successful: this.sessionData.successfulSearches,
          abandoned: this.sessionData.abandonedSearches,
          averageTime: this.sessionData.averageSearchTime
        }
      },
      patterns: this.analyzeSearchPatterns(),
      usabilityIssues: {
        total: this.usabilityIssues.length,
        categories: this.categorizeUsabilityIssues(),
        recent: this.usabilityIssues.filter(issue => 
          Date.now() - issue.timestamp < 300000 // Last 5 minutes
        )
      },
      recommendations: this.generateRecommendations(),
      overallScore: this.calculateOverallUXScore()
    };
  }

  // Calculate overall UX score
  calculateOverallUXScore() {
    const engagement = this.calculateEngagementScore();
    const successRate = this.sessionData.searchAttempts > 0 
      ? this.sessionData.successfulSearches / this.sessionData.searchAttempts 
      : 1;
    
    const errorRate = this.sessionData.errors.length / Math.max(this.sessionData.totalInteractions, 1);
    const issueScore = Math.max(0, 1 - (this.usabilityIssues.length / 10));

    const overallScore = (
      engagement.score * 0.3 +
      successRate * 0.3 +
      (1 - errorRate) * 0.2 +
      issueScore * 0.2
    );

    return {
      score: Math.round(overallScore * 100) / 100,
      grade: this.getUXGrade(overallScore),
      components: {
        engagement: engagement.score,
        successRate,
        errorRate,
        issueScore
      }
    };
  }

  // Get UX grade based on score
  getUXGrade(score) {
    if (score >= 0.9) return 'A';
    if (score >= 0.8) return 'B';
    if (score >= 0.7) return 'C';
    if (score >= 0.6) return 'D';
    return 'F';
  }

  // Clear all tracking data (for new session)
  reset() {
    this.interactionHistory = [];
    this.performanceMetrics.clear();
    this.usabilityIssues = [];
    this.sessionData = {
      startTime: Date.now(),
      totalInteractions: 0,
      searchAttempts: 0,
      successfulSearches: 0,
      abandonedSearches: 0,
      averageSearchTime: 0,
      highlightInteractions: 0,
      documentUploads: 0,
      errors: []
    };
  }
}

// Create global UX analyzer instance
export const globalUXAnalyzer = new UserExperienceAnalyzer();

export default UserExperienceAnalyzer;