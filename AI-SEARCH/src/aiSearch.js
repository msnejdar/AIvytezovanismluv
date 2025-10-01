/**
 * AI-powered search using Claude API
 * Searches for specific information in normalized text
 */

import { removeDiacritics } from './documentNormalizer.js';
import { logger } from './logger.js';

/**
 * Search document using Claude AI
 * @param {string} documentText - Original document text (shown to user)
 * @param {string} query - What to search for (e.g., "najdi rodné číslo Tomáše Vokouna")
 * @returns {Promise<Object>} - Search result with exact answer
 */
export async function aiSearch(documentText, query) {
  try {
    logger.info('AI_SEARCH', 'Starting AI search', {
      queryLength: query.length,
      documentLength: documentText.length
    });

    // Normalize text for better AI searching (remove diacritics, clean whitespace)
    const normalizedText = normalizeForAI(documentText);

    // Call backend API
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query,
        document: normalizedText,  // AI gets normalized text
        originalDocument: documentText  // Keep original for reference
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const result = await response.json();

    logger.info('AI_SEARCH', 'Search completed', {
      success: true,
      resultLength: result.answer?.length || 0,
      hasFullContext: !!result.fullContext
    });

    return {
      success: true,
      answer: result.answer,
      fullContext: result.fullContext, // For yes/no questions
      confidence: result.confidence || 0.9,
      query: query,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error('AI_SEARCH', 'Search failed', {
      error: error.message,
      query: query.substring(0, 50)
    });

    return {
      success: false,
      error: error.message,
      answer: null,
      query: query,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Normalize text for AI processing
 * - Remove diacritics for better matching
 * - Clean up whitespace
 * - Keep structure intact
 */
function normalizeForAI(text) {
  if (!text) return '';

  let normalized = text;

  // Remove diacritics
  normalized = removeDiacritics(normalized);

  // Normalize whitespace (but keep line breaks)
  normalized = normalized
    .replace(/\t/g, ' ')  // tabs to spaces
    .replace(/ +/g, ' ')  // multiple spaces to single
    .replace(/\n{3,}/g, '\n\n');  // max 2 line breaks

  return normalized.trim();
}

/**
 * Batch search - multiple queries at once
 * @param {string} documentText - Document to search
 * @param {string[]} queries - Array of queries
 * @returns {Promise<Object[]>} - Array of results
 */
export async function batchAISearch(documentText, queries) {
  const results = [];

  for (const query of queries) {
    const result = await aiSearch(documentText, query);
    results.push(result);

    // Small delay to avoid rate limiting
    if (queries.indexOf(query) < queries.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
}