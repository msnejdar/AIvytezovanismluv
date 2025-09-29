// Intelligent result ranking and relevance scoring system
import { removeDiacritics, detectValueType } from './documentNormalizer.js';
import { semanticSimilarity, detectIntent } from './semanticSearch.js';
import { logger } from './logger.js';

/**
 * Relevance factors and their weights
 */
const RELEVANCE_WEIGHTS = {
  // Match quality factors
  exactMatch: 1.0,
  fuzzyMatch: 0.7,
  semanticMatch: 0.6,
  partialMatch: 0.4,
  
  // Position factors
  earlyPosition: 0.3,
  documentStart: 0.2,
  lineStart: 0.15,
  
  // Context factors
  contextRelevance: 0.4,
  fieldTypeMatch: 0.5,
  dataTypeMatch: 0.4,
  
  // Query factors
  termCoverage: 0.6,
  queryLength: 0.2,
  intentAlignment: 0.3,
  
  // Document factors
  documentStructure: 0.2,
  dataQuality: 0.25,
  completeness: 0.15
};

/**
 * Data type importance hierarchy
 */
const DATA_TYPE_IMPORTANCE = {
  'birthNumber': 0.9,
  'iban': 0.85,
  'bankAccount': 0.8,
  'amount': 0.75,
  'date': 0.7,
  'phone': 0.65,
  'name': 0.6,
  'address': 0.55,
  'text': 0.3,
  'unknown': 0.1
};

/**
 * Calculate exact match score
 */
export const calculateExactMatchScore = (query, matchText, options = {}) => {
  if (!query || !matchText) return 0;
  
  const {
    caseSensitive = false,
    diacriticSensitive = false,
    wordBoundary = true
  } = options;
  
  let normalizedQuery = query;
  let normalizedMatch = matchText;
  
  if (!caseSensitive) {
    normalizedQuery = normalizedQuery.toLowerCase();
    normalizedMatch = normalizedMatch.toLowerCase();
  }
  
  if (!diacriticSensitive) {
    normalizedQuery = removeDiacritics(normalizedQuery);
    normalizedMatch = removeDiacritics(normalizedMatch);
  }
  
  // Exact match
  if (normalizedQuery === normalizedMatch) {
    return RELEVANCE_WEIGHTS.exactMatch;
  }
  
  // Contains match
  if (normalizedMatch.includes(normalizedQuery)) {
    const coverage = normalizedQuery.length / normalizedMatch.length;
    return RELEVANCE_WEIGHTS.partialMatch * coverage;
  }
  
  // Word boundary match
  if (wordBoundary) {
    const wordRegex = new RegExp(`\\b${normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (wordRegex.test(normalizedMatch)) {
      return RELEVANCE_WEIGHTS.partialMatch * 0.8;
    }
  }
  
  return 0;
};

/**
 * Calculate positional relevance score
 */
export const calculatePositionalScore = (match, documentText, options = {}) => {
  if (!match || typeof match.start !== 'number') return 0;
  
  const { 
    documentLength = documentText?.length || 1000,
    favorEarly = true
  } = options;
  
  let score = 0;
  const position = match.start;
  const relativePosition = position / documentLength;
  
  // Early position bonus (first 20% of document)
  if (favorEarly && relativePosition <= 0.2) {
    score += RELEVANCE_WEIGHTS.earlyPosition * (1 - relativePosition * 5);
  }
  
  // Document start bonus (first 100 characters)
  if (position <= 100) {
    score += RELEVANCE_WEIGHTS.documentStart * (1 - position / 100);
  }
  
  // Line start bonus
  if (documentText) {
    const lineStart = documentText.lastIndexOf('\n', position) + 1;
    const charFromLineStart = position - lineStart;
    if (charFromLineStart <= 10) {
      score += RELEVANCE_WEIGHTS.lineStart * (1 - charFromLineStart / 10);
    }
  }
  
  return Math.min(score, 1.0);
};

/**
 * Calculate context relevance score
 */
export const calculateContextScore = (match, query, documentText, options = {}) => {
  if (!match || !documentText) return 0;
  
  const {
    contextWindow = 100,
    semanticAnalysis = true
  } = options;
  
  const start = Math.max(0, match.start - contextWindow);
  const end = Math.min(documentText.length, match.end + contextWindow);
  const context = documentText.substring(start, end);
  
  let score = 0;
  
  // Keyword density in context
  const queryTerms = query.toLowerCase().split(/\s+/);
  const contextLower = context.toLowerCase();
  const contextWords = contextLower.split(/\s+/);
  
  const relevantWords = queryTerms.filter(term => 
    contextWords.some(word => word.includes(term) || term.includes(word))
  );
  
  const keywordDensity = relevantWords.length / Math.max(contextWords.length, 1);
  score += keywordDensity * 0.3;
  
  // Field labels and structure indicators
  const structureIndicators = [
    /jméno|název|name/gi,
    /číslo|number|id/gi,
    /cena|částka|amount|price/gi,
    /datum|date/gi,
    /adresa|address/gi,
    /telefon|phone/gi,
    /email|mail/gi
  ];
  
  let structureBonus = 0;
  structureIndicators.forEach(indicator => {
    if (indicator.test(context)) {
      structureBonus += 0.1;
    }
  });
  
  score += Math.min(structureBonus, 0.4);
  
  // Semantic context analysis
  if (semanticAnalysis) {
    const intents = detectIntent(query);
    if (intents.length > 0) {
      const primaryIntent = intents[0];
      
      // Check if context aligns with intent
      const intentKeywords = {
        amount: ['kč', 'czk', 'eur', '€', 'cena', 'částka', 'zaplatit', 'hodnota'],
        person: ['pan', 'paní', 'jméno', 'příjmení', 'osoba'],
        date: ['datum', 'rok', 'měsíc', 'den', 'narozen'],
        phone: ['telefon', 'mobil', 'volat', 'kontakt'],
        location: ['adresa', 'ulice', 'město', 'bydlí']
      };
      
      const keywords = intentKeywords[primaryIntent.intent] || [];
      const contextMatches = keywords.filter(keyword => 
        contextLower.includes(removeDiacritics(keyword).toLowerCase())
      );
      
      if (contextMatches.length > 0) {
        score += (contextMatches.length / keywords.length) * 0.2;
      }
    }
  }
  
  return Math.min(score, 1.0);
};

/**
 * Calculate data type and field matching score
 */
export const calculateDataTypeScore = (match, query, detectedType, options = {}) => {
  let score = 0;
  
  // Base importance score for detected data type
  const typeImportance = DATA_TYPE_IMPORTANCE[detectedType] || DATA_TYPE_IMPORTANCE.unknown;
  score += typeImportance * 0.4;
  
  // Query-type alignment
  const queryIntents = detectIntent(query);
  if (queryIntents.length > 0) {
    const primaryIntent = queryIntents[0].intent;
    
    const intentTypeAlignment = {
      amount: ['amount', 'rpsn'],
      person: ['name'],
      date: ['date'],
      phone: ['phone'],
      location: ['address']
    };
    
    const alignedTypes = intentTypeAlignment[primaryIntent] || [];
    if (alignedTypes.includes(detectedType)) {
      score += RELEVANCE_WEIGHTS.intentAlignment;
    }
  }
  
  // Data quality bonus
  if (match.text) {
    const text = match.text.trim();
    
    // Completeness bonus
    if (detectedType === 'birthNumber' && /^\d{6}\/\d{4}$/.test(text)) {
      score += 0.2; // Complete birth number
    } else if (detectedType === 'amount' && /\d+.*kč|czk|eur|€/gi.test(text)) {
      score += 0.15; // Amount with currency
    } else if (detectedType === 'phone' && text.length >= 9) {
      score += 0.1; // Complete phone number
    }
    
    // Format validation bonus
    const isValidFormat = detectedType !== 'unknown' && text.length > 0;
    if (isValidFormat) {
      score += 0.1;
    }
  }
  
  return Math.min(score, 1.0);
};

/**
 * Calculate comprehensive relevance score
 */
export const calculateRelevanceScore = (match, query, documentText, options = {}) => {
  if (!match || !query) return 0;
  
  const {
    enableFuzzy = true,
    enableSemantic = true,
    enablePositional = true,
    enableContext = true,
    enableDataType = true,
    weights = RELEVANCE_WEIGHTS
  } = options;
  
  let totalScore = 0;
  let componentCount = 0;
  const scoreComponents = {};
  
  // Exact match score
  const exactScore = calculateExactMatchScore(query, match.text, options);
  if (exactScore > 0) {
    scoreComponents.exact = exactScore;
    totalScore += exactScore * weights.exactMatch;
    componentCount++;
  }
  
  // Fuzzy match score
  if (enableFuzzy && exactScore < 0.9) {
    const fuzzyScore = match.fuzzyScore || 0;
    if (fuzzyScore > 0) {
      scoreComponents.fuzzy = fuzzyScore;
      totalScore += fuzzyScore * weights.fuzzyMatch;
      componentCount++;
    }
  }
  
  // Semantic similarity score
  if (enableSemantic) {
    const semanticScore = semanticSimilarity(query, match.text);
    if (semanticScore > 0) {
      scoreComponents.semantic = semanticScore;
      totalScore += semanticScore * weights.semanticMatch;
      componentCount++;
    }
  }
  
  // Positional relevance
  if (enablePositional && documentText) {
    const positionScore = calculatePositionalScore(match, documentText, options);
    if (positionScore > 0) {
      scoreComponents.positional = positionScore;
      totalScore += positionScore;
      componentCount++;
    }
  }
  
  // Context relevance
  if (enableContext && documentText) {
    const contextScore = calculateContextScore(match, query, documentText, options);
    if (contextScore > 0) {
      scoreComponents.context = contextScore;
      totalScore += contextScore;
      componentCount++;
    }
  }
  
  // Data type relevance
  if (enableDataType) {
    const detectedType = detectValueType(match.text);
    const typeScore = calculateDataTypeScore(match, query, detectedType, options);
    if (typeScore > 0) {
      scoreComponents.dataType = typeScore;
      totalScore += typeScore;
      componentCount++;
    }
  }
  
  // Term coverage bonus
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
  const matchText = match.text.toLowerCase();
  const coveredTerms = queryTerms.filter(term => matchText.includes(term));
  const coverageScore = coveredTerms.length / Math.max(queryTerms.length, 1);
  
  scoreComponents.coverage = coverageScore;
  totalScore += coverageScore * weights.termCoverage;
  componentCount++;
  
  // Calculate final weighted average
  const finalScore = componentCount > 0 ? totalScore / componentCount : 0;
  
  logger.debug('Ranking', 'Relevance score calculated', {
    query,
    matchText: match.text?.substring(0, 50) + '...',
    finalScore: finalScore.toFixed(3),
    components: Object.fromEntries(
      Object.entries(scoreComponents).map(([key, value]) => [key, value.toFixed(3)])
    )
  });
  
  return {
    score: Math.min(finalScore, 1.0),
    components: scoreComponents,
    componentCount,
    detectedType: detectValueType(match.text)
  };
};

/**
 * Rank search results intelligently
 */
export const rankSearchResults = (results, query, documentText, options = {}) => {
  if (!Array.isArray(results) || results.length === 0) return [];
  
  const {
    maxResults = 20,
    diversityBonus = true,
    groupSimilar = true,
    minScore = 0.1
  } = options;
  
  const startTime = Date.now();
  
  // Calculate relevance scores for all results
  const scoredResults = results.map(result => {
    const matches = result.matches || [];
    
    if (matches.length === 0) {
      return {
        ...result,
        relevanceScore: 0,
        scoreComponents: {},
        ranking: {
          position: Infinity,
          confidence: 0
        }
      };
    }
    
    // Calculate score for each match
    const matchScores = matches.map(match => 
      calculateRelevanceScore(match, query, documentText, options)
    );
    
    // Aggregate match scores
    const bestMatch = matchScores.reduce((best, current) => 
      current.score > best.score ? current : best, { score: 0 }
    );
    
    const avgScore = matchScores.reduce((sum, ms) => sum + ms.score, 0) / matchScores.length;
    const maxScore = Math.max(...matchScores.map(ms => ms.score));
    
    // Combined relevance score (weighted average of best and average)
    const relevanceScore = (bestMatch.score * 0.6) + (avgScore * 0.4);
    
    return {
      ...result,
      relevanceScore,
      maxMatchScore: maxScore,
      avgMatchScore: avgScore,
      bestMatch,
      matchScores,
      scoreComponents: bestMatch.components || {},
      ranking: {
        position: 0, // Will be set after sorting
        confidence: Math.min(relevanceScore * matchScores.length * 0.2, 1.0)
      }
    };
  });
  
  // Filter by minimum score
  const filteredResults = scoredResults.filter(r => r.relevanceScore >= minScore);
  
  // Apply diversity bonus
  if (diversityBonus) {
    applyDiversityBonus(filteredResults, options);
  }
  
  // Sort by relevance score
  const rankedResults = filteredResults.sort((a, b) => {
    // Primary sort: relevance score
    if (Math.abs(a.relevanceScore - b.relevanceScore) > 0.05) {
      return b.relevanceScore - a.relevanceScore;
    }
    
    // Secondary sort: confidence
    if (Math.abs(a.ranking.confidence - b.ranking.confidence) > 0.05) {
      return b.ranking.confidence - a.ranking.confidence;
    }
    
    // Tertiary sort: number of matches
    return (b.matches?.length || 0) - (a.matches?.length || 0);
  });
  
  // Set positions
  rankedResults.forEach((result, index) => {
    result.ranking.position = index + 1;
  });
  
  // Group similar results if requested
  const finalResults = groupSimilar ? 
    groupSimilarResults(rankedResults, options) : 
    rankedResults;
  
  const duration = Date.now() - startTime;
  
  logger.info('Ranking', 'Results ranked', {
    originalCount: results.length,
    scoredCount: scoredResults.length,
    filteredCount: filteredResults.length,
    finalCount: Math.min(finalResults.length, maxResults),
    duration: `${duration}ms`,
    topScore: finalResults[0]?.relevanceScore?.toFixed(3) || '0'
  });
  
  return finalResults.slice(0, maxResults);
};

/**
 * Apply diversity bonus to avoid too many similar results
 */
const applyDiversityBonus = (results, options) => {
  const seenTypes = new Set();
  const seenTexts = new Set();
  
  results.forEach(result => {
    const detectedType = result.bestMatch?.detectedType || 'unknown';
    const normalizedText = removeDiacritics(result.value || '').toLowerCase().trim();
    
    // Type diversity bonus
    if (!seenTypes.has(detectedType)) {
      result.relevanceScore *= 1.1;
      seenTypes.add(detectedType);
    } else {
      result.relevanceScore *= 0.95; // Small penalty for same type
    }
    
    // Text diversity bonus
    if (!seenTexts.has(normalizedText) && normalizedText.length > 0) {
      result.relevanceScore *= 1.05;
      seenTexts.add(normalizedText);
    } else if (normalizedText.length > 0) {
      result.relevanceScore *= 0.9; // Penalty for duplicate content
    }
  });
};

/**
 * Group similar results together
 */
const groupSimilarResults = (results, options) => {
  const { similarityThreshold = 0.8 } = options;
  const groups = [];
  const processed = new Set();
  
  results.forEach((result, index) => {
    if (processed.has(index)) return;
    
    const group = {
      primary: result,
      similar: [],
      combinedScore: result.relevanceScore
    };
    
    // Find similar results
    results.forEach((otherResult, otherIndex) => {
      if (otherIndex <= index || processed.has(otherIndex)) return;
      
      const similarity = calculateResultSimilarity(result, otherResult);
      if (similarity >= similarityThreshold) {
        group.similar.push(otherResult);
        group.combinedScore += otherResult.relevanceScore * 0.3; // Reduced weight for similar
        processed.add(otherIndex);
      }
    });
    
    groups.push(group);
    processed.add(index);
  });
  
  // Convert groups back to flat results
  return groups
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .map(group => ({
      ...group.primary,
      similarResults: group.similar,
      groupScore: group.combinedScore
    }));
};

/**
 * Calculate similarity between two results
 */
const calculateResultSimilarity = (result1, result2) => {
  if (!result1.value || !result2.value) return 0;
  
  const text1 = removeDiacritics(result1.value.toLowerCase().trim());
  const text2 = removeDiacritics(result2.value.toLowerCase().trim());
  
  // Exact match
  if (text1 === text2) return 1.0;
  
  // Substring match
  if (text1.includes(text2) || text2.includes(text1)) {
    const shorter = Math.min(text1.length, text2.length);
    const longer = Math.max(text1.length, text2.length);
    return shorter / longer;
  }
  
  // Semantic similarity
  return semanticSimilarity(text1, text2);
};