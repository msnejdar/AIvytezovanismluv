// Advanced fuzzy search implementation with Czech language support
import { removeDiacritics } from './documentNormalizer.js';
import { logger } from './logger.js';

/**
 * Levenshtein distance calculation with optimization for small strings
 */
export const levenshteinDistance = (str1, str2) => {
  if (!str1 || !str2) return Math.max(str1?.length || 0, str2?.length || 0);
  if (str1 === str2) return 0;
  
  const len1 = str1.length;
  const len2 = str2.length;
  
  // Optimization for small strings
  if (len1 === 0) return len2;
  if (len2 === 0) return len1;
  
  // Use single array instead of matrix for memory efficiency
  let previousRow = Array.from({ length: len2 + 1 }, (_, i) => i);
  let currentRow = new Array(len2 + 1);
  
  for (let i = 1; i <= len1; i++) {
    currentRow[0] = i;
    
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      currentRow[j] = Math.min(
        currentRow[j - 1] + 1,     // insertion
        previousRow[j] + 1,        // deletion
        previousRow[j - 1] + cost  // substitution
      );
    }
    
    // Swap rows
    [previousRow, currentRow] = [currentRow, previousRow];
  }
  
  return previousRow[len2];
};

/**
 * Jaro similarity calculation
 */
export const jaroSimilarity = (str1, str2) => {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0 && len2 === 0) return 1;
  if (len1 === 0 || len2 === 0) return 0;
  
  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
  if (matchWindow < 0) return str1 === str2 ? 1 : 0;
  
  const str1Matches = new Array(len1).fill(false);
  const str2Matches = new Array(len2).fill(false);
  
  let matches = 0;
  let transpositions = 0;
  
  // Find matches
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);
    
    for (let j = start; j < end; j++) {
      if (str2Matches[j] || str1[i] !== str2[j]) continue;
      str1Matches[i] = str2Matches[j] = true;
      matches++;
      break;
    }
  }
  
  if (matches === 0) return 0;
  
  // Count transpositions
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!str1Matches[i]) continue;
    while (!str2Matches[k]) k++;
    if (str1[i] !== str2[k]) transpositions++;
    k++;
  }
  
  return (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
};

/**
 * Jaro-Winkler similarity with prefix bonus
 */
export const jaroWinklerSimilarity = (str1, str2, prefixScale = 0.1) => {
  const jaro = jaroSimilarity(str1, str2);
  
  if (jaro < 0.7) return jaro;
  
  // Calculate common prefix length (up to 4 characters)
  let prefix = 0;
  for (let i = 0; i < Math.min(str1.length, str2.length, 4); i++) {
    if (str1[i] === str2[i]) prefix++;
    else break;
  }
  
  return jaro + prefix * prefixScale * (1 - jaro);
};

/**
 * Normalized fuzzy similarity score (0-1)
 */
export const fuzzyScore = (query, target, options = {}) => {
  if (!query || !target) return 0;
  if (query === target) return 1;
  
  const {
    algorithm = 'hybrid',
    threshold = 0.6,
    caseSensitive = false,
    diacriticSensitive = false
  } = options;
  
  // Normalize strings
  let normalizedQuery = query;
  let normalizedTarget = target;
  
  if (!caseSensitive) {
    normalizedQuery = normalizedQuery.toLowerCase();
    normalizedTarget = normalizedTarget.toLowerCase();
  }
  
  if (!diacriticSensitive) {
    normalizedQuery = removeDiacritics(normalizedQuery);
    normalizedTarget = removeDiacritics(normalizedTarget);
  }
  
  // Calculate similarity based on algorithm
  let score = 0;
  
  switch (algorithm) {
    case 'levenshtein': {
      const distance = levenshteinDistance(normalizedQuery, normalizedTarget);
      const maxLength = Math.max(normalizedQuery.length, normalizedTarget.length);
      score = maxLength > 0 ? 1 - (distance / maxLength) : 0;
      break;
    }
    
    case 'jaro':
      score = jaroSimilarity(normalizedQuery, normalizedTarget);
      break;
    
    case 'jaroWinkler':
      score = jaroWinklerSimilarity(normalizedQuery, normalizedTarget);
      break;
    
    case 'hybrid':
    default: {
      // Combine multiple algorithms for better results
      const jw = jaroWinklerSimilarity(normalizedQuery, normalizedTarget);
      const distance = levenshteinDistance(normalizedQuery, normalizedTarget);
      const maxLength = Math.max(normalizedQuery.length, normalizedTarget.length);
      const levenScore = maxLength > 0 ? 1 - (distance / maxLength) : 0;
      
      // Weighted combination favoring Jaro-Winkler for short strings
      const jwWeight = normalizedQuery.length <= 10 ? 0.7 : 0.5;
      score = jw * jwWeight + levenScore * (1 - jwWeight);
      break;
    }
  }
  
  return score >= threshold ? score : 0;
};

/**
 * Find fuzzy matches in text with position information
 */
export const findFuzzyMatches = (query, text, options = {}) => {
  if (!query || !text) return [];
  
  const {
    minScore = 0.6,
    maxResults = 10,
    contextLength = 50,
    wordBoundary = true,
    algorithm = 'hybrid'
  } = options;
  
  const matches = [];
  const queryLength = query.length;
  const textLength = text.length;
  
  // Performance optimization: skip very long texts for fuzzy search
  if (textLength > 10000 && queryLength < 3) {
    logger.warn('FuzzySearch', 'Skipping fuzzy search for large text with short query', {
      textLength,
      queryLength
    });
    return matches;
  }
  
  // Generate candidate substrings
  const candidates = [];
  
  // Try exact length matches first
  for (let i = 0; i <= textLength - queryLength; i++) {
    const candidate = text.substring(i, i + queryLength);
    candidates.push({ text: candidate, start: i, end: i + queryLength });
  }
  
  // Try slightly longer and shorter matches
  const tolerance = Math.min(3, Math.ceil(queryLength * 0.3));
  for (let len = queryLength - tolerance; len <= queryLength + tolerance; len++) {
    if (len === queryLength || len <= 0) continue;
    
    for (let i = 0; i <= textLength - len; i++) {
      const candidate = text.substring(i, i + len);
      candidates.push({ text: candidate, start: i, end: i + len });
    }
  }
  
  // Score all candidates
  const scoredCandidates = candidates
    .map(candidate => ({
      ...candidate,
      score: fuzzyScore(query, candidate.text, { algorithm, threshold: minScore })
    }))
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
  
  // Remove overlapping matches, keeping the best scores
  const nonOverlapping = [];
  for (const candidate of scoredCandidates) {
    const overlaps = nonOverlapping.some(existing => 
      (candidate.start < existing.end && candidate.end > existing.start)
    );
    
    if (!overlaps) {
      // Add context if requested
      let contextStart = candidate.start;
      let contextEnd = candidate.end;
      
      if (contextLength > 0) {
        contextStart = Math.max(0, candidate.start - contextLength);
        contextEnd = Math.min(textLength, candidate.end + contextLength);
      }
      
      nonOverlapping.push({
        ...candidate,
        context: contextLength > 0 ? text.substring(contextStart, contextEnd) : candidate.text,
        contextStart,
        contextEnd
      });
    }
  }
  
  logger.debug('FuzzySearch', 'Found fuzzy matches', {
    query,
    candidateCount: candidates.length,
    scoredCount: scoredCandidates.length,
    finalCount: nonOverlapping.length
  });
  
  return nonOverlapping;
};

/**
 * Multi-algorithm fuzzy search with confidence scoring
 */
export const advancedFuzzySearch = (query, text, options = {}) => {
  const {
    algorithms = ['hybrid', 'jaroWinkler', 'levenshtein'],
    weights = [0.5, 0.3, 0.2],
    minScore = 0.6,
    maxResults = 5
  } = options;
  
  const allResults = [];
  
  // Run search with different algorithms
  algorithms.forEach((algorithm, index) => {
    const results = findFuzzyMatches(query, text, {
      ...options,
      algorithm,
      minScore: minScore * 0.8, // Lower threshold for individual algorithms
      maxResults: maxResults * 2
    });
    
    // Apply algorithm weight
    const weight = weights[index] || (1 / algorithms.length);
    results.forEach(result => {
      result.weightedScore = result.score * weight;
      result.algorithm = algorithm;
    });
    
    allResults.push(...results);
  });
  
  // Merge and rank results
  const mergedResults = new Map();
  
  allResults.forEach(result => {
    const key = `${result.start}-${result.end}`;
    const existing = mergedResults.get(key);
    
    if (existing) {
      existing.combinedScore += result.weightedScore;
      existing.algorithms.push(result.algorithm);
      existing.confidence = Math.min(existing.confidence + 0.2, 1);
    } else {
      mergedResults.set(key, {
        ...result,
        combinedScore: result.weightedScore,
        algorithms: [result.algorithm],
        confidence: 0.5
      });
    }
  });
  
  const finalResults = Array.from(mergedResults.values())
    .filter(result => result.combinedScore >= minScore)
    .sort((a, b) => {
      // Sort by combined score, then by confidence
      if (Math.abs(a.combinedScore - b.combinedScore) < 0.05) {
        return b.confidence - a.confidence;
      }
      return b.combinedScore - a.combinedScore;
    })
    .slice(0, maxResults);
  
  return finalResults;
};

/**
 * Optimized fuzzy search for real-time queries
 */
export const realtimeFuzzySearch = (query, text, options = {}) => {
  const startTime = Date.now();
  const {
    timeout = 100, // Maximum 100ms for real-time
    quickMode = true
  } = options;
  
  // Use simplified algorithm for real-time search
  const searchOptions = {
    ...options,
    algorithm: quickMode ? 'jaroWinkler' : 'hybrid',
    maxResults: 3,
    contextLength: 30
  };
  
  const results = findFuzzyMatches(query, text, searchOptions);
  const duration = Date.now() - startTime;
  
  if (duration > timeout) {
    logger.warn('FuzzySearch', 'Real-time search exceeded timeout', {
      duration,
      timeout,
      queryLength: query.length,
      textLength: text.length
    });
  }
  
  return results;
};

/**
 * Czech-specific fuzzy search with diacritic handling
 */
export const czechFuzzySearch = (query, text, options = {}) => {
  const czechOptions = {
    ...options,
    diacriticSensitive: false,
    caseSensitive: false,
    algorithm: 'hybrid',
    // Common Czech character substitutions
    substitutions: {
      'š': 's', 'č': 'c', 'ř': 'r', 'ž': 'z',
      'ý': 'y', 'á': 'a', 'í': 'i', 'é': 'e',
      'ú': 'u', 'ů': 'u', 'ó': 'o', 'ť': 't',
      'ď': 'd', 'ň': 'n', 'ě': 'e'
    }
  };
  
  return advancedFuzzySearch(query, text, czechOptions);
};