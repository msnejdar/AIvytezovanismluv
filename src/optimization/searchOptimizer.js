/**
 * Advanced search result optimization algorithms
 */

import { logger } from '../utils/logger.js';
import { cache } from '../utils/cache.js';

class SearchOptimizer {
  constructor() {
    this.searchHistory = new Map();
    this.userFeedback = new Map();
    this.queryAnalytics = new Map();
    
    // Optimization weights
    this.weights = {
      relevance: 0.4,
      confidence: 0.3,
      context: 0.15,
      freshness: 0.1,
      userFeedback: 0.05
    };
    
    // Learning parameters
    this.learningRate = 0.1;
    this.decayFactor = 0.95;
    
    logger.info('Search optimizer initialized');
  }

  /**
   * Optimize search results based on multiple factors
   */
  async optimizeResults(query, results, userContext = {}) {
    try {
      const startTime = Date.now();
      
      logger.debug('Optimizing search results', {
        query: query.substring(0, 50),
        resultCount: results.length,
        userContext
      });

      // Analyze query patterns
      const queryAnalysis = this.analyzeQuery(query);
      
      // Score and rank results
      const scoredResults = await this.scoreResults(query, results, queryAnalysis, userContext);
      
      // Apply personalization
      const personalizedResults = this.applyPersonalization(scoredResults, userContext);
      
      // Diversify results
      const diversifiedResults = this.diversifyResults(personalizedResults);
      
      // Final ranking
      const optimizedResults = this.finalRanking(diversifiedResults);
      
      // Track analytics
      this.trackSearchAnalytics(query, queryAnalysis, optimizedResults);
      
      const processingTime = Date.now() - startTime;
      
      logger.debug('Search optimization completed', {
        processingTime: `${processingTime}ms`,
        originalCount: results.length,
        optimizedCount: optimizedResults.length
      });

      return {
        results: optimizedResults,
        metadata: {
          queryAnalysis,
          processingTime,
          optimization: {
            scored: scoredResults.length,
            personalized: personalizedResults.length,
            diversified: diversifiedResults.length,
            final: optimizedResults.length
          }
        }
      };

    } catch (error) {
      logger.error('Search optimization error', { error: error.message });
      return {
        results,
        metadata: {
          error: 'Optimization failed, returning original results'
        }
      };
    }
  }

  /**
   * Analyze query characteristics and intent
   */
  analyzeQuery(query) {
    const analysis = {
      length: query.length,
      wordCount: query.split(/\s+/).length,
      hasNumbers: /\d/.test(query),
      hasSpecialChars: /[^\w\s]/.test(query),
      language: this.detectLanguage(query),
      intent: this.detectIntent(query),
      entities: this.extractEntities(query),
      complexity: this.calculateComplexity(query)
    };

    // Determine query type
    analysis.type = this.categorizeQuery(analysis);
    
    return analysis;
  }

  /**
   * Detect primary language of query
   */
  detectLanguage(query) {
    const czechWords = /\b(a|je|na|se|v|z|do|od|pro|při|mezi|během|před|po|nad|pod|kolem|podle|bez|s|o)\b/gi;
    const englishWords = /\b(the|and|is|in|of|to|for|with|on|at|by|from|as|an|be|or|are)\b/gi;
    
    const czechMatches = (query.match(czechWords) || []).length;
    const englishMatches = (query.match(englishWords) || []).length;
    
    if (czechMatches > englishMatches) return 'cs';
    if (englishMatches > czechMatches) return 'en';
    return 'unknown';
  }

  /**
   * Detect query intent
   */
  detectIntent(query) {
    const intents = {
      find: /\b(najdi|hledám|vyhledej|find|search|locate)\b/gi,
      extract: /\b(vytáhni|extrahuj|vezmi|extract|get|retrieve)\b/gi,
      compare: /\b(porovnej|srovnej|rozdíl|compare|versus|vs)\b/gi,
      calculate: /\b(spočítej|vypočítej|calculate|compute|sum)\b/gi,
      verify: /\b(ověř|zkontroluj|verify|check|validate)\b/gi,
      list: /\b(seznam|výčet|list|enumerate|show)\b/gi
    };

    for (const [intent, pattern] of Object.entries(intents)) {
      if (pattern.test(query)) {
        return intent;
      }
    }

    return 'general';
  }

  /**
   * Extract entities from query
   */
  extractEntities(query) {
    const entities = {
      dates: [],
      amounts: [],
      names: [],
      locations: [],
      organizations: []
    };

    // Extract dates
    const datePatterns = [
      /\d{1,2}\.\s*\d{1,2}\.\s*\d{4}/g,
      /\d{4}-\d{2}-\d{2}/g,
      /\b(leden|únor|březen|duben|květen|červen|červenec|srpen|září|říjen|listopad|prosinec)\s+\d{4}\b/gi
    ];

    for (const pattern of datePatterns) {
      const matches = query.match(pattern);
      if (matches) entities.dates.push(...matches);
    }

    // Extract amounts
    const amountPattern = /\d+(?:[,\s]\d{3})*(?:[,\.]\d{2})?\s*(?:kč|czk|eur|usd|korun)/gi;
    const amountMatches = query.match(amountPattern);
    if (amountMatches) entities.amounts.push(...amountMatches);

    // Extract potential names (capitalized words)
    const namePattern = /\b[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+\b/g;
    const nameMatches = query.match(namePattern);
    if (nameMatches) entities.names.push(...nameMatches);

    return entities;
  }

  /**
   * Calculate query complexity
   */
  calculateComplexity(query) {
    let complexity = 0;
    
    // Base complexity from length
    complexity += Math.min(query.length / 100, 1) * 0.3;
    
    // Word count factor
    const wordCount = query.split(/\s+/).length;
    complexity += Math.min(wordCount / 20, 1) * 0.3;
    
    // Special characters and operators
    const specialChars = (query.match(/[^\w\s]/g) || []).length;
    complexity += Math.min(specialChars / 10, 1) * 0.2;
    
    // Logical operators
    const logicalOps = (query.match(/\b(a|nebo|ne|and|or|not)\b/gi) || []).length;
    complexity += Math.min(logicalOps / 5, 1) * 0.2;
    
    return Math.min(complexity, 1);
  }

  /**
   * Categorize query type
   */
  categorizeQuery(analysis) {
    if (analysis.entities.amounts.length > 0) return 'financial';
    if (analysis.entities.dates.length > 0) return 'temporal';
    if (analysis.entities.names.length > 0) return 'personal';
    if (analysis.intent === 'extract') return 'extraction';
    if (analysis.intent === 'compare') return 'comparison';
    if (analysis.complexity > 0.7) return 'complex';
    return 'simple';
  }

  /**
   * Score individual results
   */
  async scoreResults(query, results, queryAnalysis, userContext) {
    const scoredResults = [];

    for (const result of results) {
      const score = await this.calculateResultScore(query, result, queryAnalysis, userContext);
      scoredResults.push({
        ...result,
        score,
        optimization: {
          relevanceScore: score.relevance,
          confidenceScore: score.confidence,
          contextScore: score.context,
          freshnessScore: score.freshness,
          userFeedbackScore: score.userFeedback,
          totalScore: score.total
        }
      });
    }

    return scoredResults.sort((a, b) => b.score.total - a.score.total);
  }

  /**
   * Calculate comprehensive score for a result
   */
  async calculateResultScore(query, result, queryAnalysis, userContext) {
    const scores = {
      relevance: this.calculateRelevanceScore(query, result, queryAnalysis),
      confidence: this.calculateConfidenceScore(result),
      context: this.calculateContextScore(result, queryAnalysis),
      freshness: this.calculateFreshnessScore(result),
      userFeedback: await this.calculateUserFeedbackScore(result, userContext)
    };

    // Calculate weighted total
    const total = Object.entries(scores).reduce((sum, [key, score]) => {
      return sum + (score * this.weights[key]);
    }, 0);

    return { ...scores, total };
  }

  /**
   * Calculate relevance score based on query matching
   */
  calculateRelevanceScore(query, result, queryAnalysis) {
    let score = 0;

    const queryLower = query.toLowerCase();
    const resultText = (result.highlight || result.value || '').toLowerCase();

    // Exact match bonus
    if (resultText.includes(queryLower)) {
      score += 0.8;
    }

    // Word overlap
    const queryWords = queryLower.split(/\s+/);
    const resultWords = resultText.split(/\s+/);
    const overlap = queryWords.filter(word => resultWords.includes(word)).length;
    score += (overlap / queryWords.length) * 0.6;

    // Entity matching
    if (queryAnalysis.entities) {
      for (const entityType of Object.keys(queryAnalysis.entities)) {
        for (const entity of queryAnalysis.entities[entityType]) {
          if (resultText.includes(entity.toLowerCase())) {
            score += 0.3;
          }
        }
      }
    }

    // Intent matching
    if (queryAnalysis.intent === 'extract' && result.value) {
      score += 0.2;
    }

    return Math.min(score, 1);
  }

  /**
   * Calculate confidence score
   */
  calculateConfidenceScore(result) {
    if (result.confidence !== undefined) {
      return result.confidence;
    }

    // Estimate confidence based on available data
    let confidence = 0.5; // Base confidence

    if (result.start !== undefined && result.end !== undefined) {
      confidence += 0.2; // Has position info
    }

    if (result.context && result.context.length > 20) {
      confidence += 0.2; // Has context
    }

    if (result.value && result.highlight && result.value === result.highlight) {
      confidence += 0.1; // Value matches highlight
    }

    return Math.min(confidence, 1);
  }

  /**
   * Calculate context score
   */
  calculateContextScore(result, queryAnalysis) {
    let score = 0;

    if (!result.context) return 0;

    const contextLength = result.context.length;
    
    // Context length score
    score += Math.min(contextLength / 200, 1) * 0.4;

    // Context relevance to query
    if (queryAnalysis.entities) {
      for (const entityType of Object.keys(queryAnalysis.entities)) {
        for (const entity of queryAnalysis.entities[entityType]) {
          if (result.context.toLowerCase().includes(entity.toLowerCase())) {
            score += 0.3;
          }
        }
      }
    }

    // Context completeness (sentences)
    const sentences = result.context.split(/[.!?]/).length;
    score += Math.min(sentences / 3, 1) * 0.3;

    return Math.min(score, 1);
  }

  /**
   * Calculate freshness score
   */
  calculateFreshnessScore(result) {
    // For now, assume all results are equally fresh
    // In a real system, this would consider document age, last modified, etc.
    return 1;
  }

  /**
   * Calculate user feedback score
   */
  async calculateUserFeedbackScore(result, userContext) {
    if (!userContext.userId) return 0.5;

    try {
      const feedbackKey = `feedback:${userContext.userId}:${result.value}`;
      const feedback = await cache.get(feedbackKey, 'user_feedback');
      
      if (feedback) {
        return feedback.score || 0.5;
      }

      return 0.5; // Neutral for new results
    } catch (error) {
      return 0.5;
    }
  }

  /**
   * Apply personalization based on user context
   */
  applyPersonalization(results, userContext) {
    if (!userContext.userId) return results;

    // Get user preferences and history
    const userHistory = this.searchHistory.get(userContext.userId) || [];
    
    return results.map(result => {
      let personalizedScore = result.score.total;

      // Boost results similar to previously selected ones
      for (const historyItem of userHistory) {
        if (this.isSimilarResult(result, historyItem)) {
          personalizedScore *= 1.1;
        }
      }

      // Apply user-specific domain preferences
      if (userContext.preferences) {
        if (userContext.preferences.preferredDomains) {
          // Implementation would depend on result structure
        }
      }

      return {
        ...result,
        score: {
          ...result.score,
          total: personalizedScore
        }
      };
    });
  }

  /**
   * Diversify results to avoid redundancy
   */
  diversifyResults(results) {
    const diversified = [];
    const seen = new Set();

    for (const result of results) {
      const signature = this.createResultSignature(result);
      
      if (!seen.has(signature)) {
        diversified.push(result);
        seen.add(signature);
      } else {
        // If similar result exists, only add if significantly better score
        const existing = diversified.find(r => this.createResultSignature(r) === signature);
        if (existing && result.score.total > existing.score.total * 1.2) {
          const index = diversified.indexOf(existing);
          diversified[index] = result;
        }
      }
    }

    return diversified;
  }

  /**
   * Create signature for result deduplication
   */
  createResultSignature(result) {
    const value = (result.value || '').toLowerCase().trim();
    const type = result.label || 'unknown';
    return `${type}:${value.substring(0, 50)}`;
  }

  /**
   * Final ranking with position-aware scoring
   */
  finalRanking(results) {
    return results
      .sort((a, b) => b.score.total - a.score.total)
      .map((result, index) => ({
        ...result,
        rank: index + 1,
        optimization: {
          ...result.optimization,
          finalRank: index + 1
        }
      }));
  }

  /**
   * Track search analytics
   */
  trackSearchAnalytics(query, analysis, results) {
    const analytics = {
      query,
      analysis,
      resultCount: results.length,
      timestamp: Date.now()
    };

    // Store in query analytics
    const queryKey = query.toLowerCase().trim();
    if (!this.queryAnalytics.has(queryKey)) {
      this.queryAnalytics.set(queryKey, []);
    }
    this.queryAnalytics.get(queryKey).push(analytics);

    // Limit history size
    const history = this.queryAnalytics.get(queryKey);
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }

  /**
   * Record user feedback
   */
  async recordFeedback(userId, result, feedback) {
    try {
      const feedbackKey = `feedback:${userId}:${result.value}`;
      const existingFeedback = await cache.get(feedbackKey, 'user_feedback') || { score: 0.5, count: 0 };

      // Update feedback with learning rate
      const newScore = existingFeedback.score + this.learningRate * (feedback.score - existingFeedback.score);
      
      await cache.set(feedbackKey, {
        score: newScore,
        count: existingFeedback.count + 1,
        lastUpdate: Date.now()
      }, 86400000 * 30, 'user_feedback'); // 30 days

      logger.debug('User feedback recorded', {
        userId,
        result: result.value,
        feedback,
        newScore
      });
    } catch (error) {
      logger.error('Failed to record feedback', { error: error.message });
    }
  }

  /**
   * Update search history
   */
  updateSearchHistory(userId, query, selectedResult) {
    if (!this.searchHistory.has(userId)) {
      this.searchHistory.set(userId, []);
    }

    const history = this.searchHistory.get(userId);
    history.push({
      query,
      result: selectedResult,
      timestamp: Date.now()
    });

    // Limit history size
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
  }

  /**
   * Check if two results are similar
   */
  isSimilarResult(result1, result2) {
    const signature1 = this.createResultSignature(result1);
    const signature2 = this.createResultSignature(result2.result || result2);
    return signature1 === signature2;
  }

  /**
   * Get optimization statistics
   */
  getStats() {
    return {
      searchHistorySize: this.searchHistory.size,
      userFeedbackSize: this.userFeedback.size,
      queryAnalyticsSize: this.queryAnalytics.size,
      weights: this.weights,
      learningRate: this.learningRate
    };
  }

  /**
   * Health check
   */
  healthCheck() {
    return {
      status: 'healthy',
      stats: this.getStats()
    };
  }
}

// Create singleton instance
export const searchOptimizer = new SearchOptimizer();
export default searchOptimizer;