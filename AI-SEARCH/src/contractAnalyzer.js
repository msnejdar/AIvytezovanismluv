// Advanced Contract Document Analyzer for Czech Legal Documents
// Specialized for 100% accurate contract data extraction

import { removeDiacritics } from './documentNormalizer.js';
import { logger } from './logger.js';

/**
 * Czech legal document patterns and validators
 */
export const CZECH_LEGAL_PATTERNS = {
  // Personal identification
  birthNumber: {
    pattern: /\b\d{6}\s*\/\s*\d{3,4}\b/g,
    validator: (value) => {
      const cleaned = value.replace(/\s/g, '');
      return /^\d{6}\/\d{3,4}$/.test(cleaned) && validateBirthNumber(cleaned);
    },
    normalizer: (value) => value.replace(/\s/g, ''),
    type: 'birthNumber'
  },
  
  // Full names (Czech naming conventions)
  fullName: {
    pattern: /\b[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+(?:\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+)?\b/g,
    validator: (value) => {
      const parts = value.trim().split(/\s+/);
      return parts.length >= 2 && parts.length <= 4 && 
             parts.every(part => /^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+$/.test(part));
    },
    type: 'fullName'
  },

  // Czech addresses
  address: {
    pattern: /\b[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž\s]+\s+\d+(?:\/\d+)?[a-zA-Z]?,\s*\d{3}\s*\d{2}\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž\s]+/g,
    validator: (value) => {
      return /\d{3}\s*\d{2}/.test(value) && // Contains ZIP code
             /[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]/.test(value); // Contains Czech characters
    },
    type: 'address'
  },

  // Phone numbers (Czech format)
  phoneNumber: {
    pattern: /(?:\+420\s?)?(?:\d{3}\s?\d{3}\s?\d{3}|\d{9})\b/g,
    validator: (value) => {
      const cleaned = value.replace(/[^\d]/g, '');
      return cleaned.length === 9 || (cleaned.length === 12 && cleaned.startsWith('420'));
    },
    normalizer: (value) => {
      const cleaned = value.replace(/[^\d]/g, '');
      return cleaned.startsWith('420') ? `+420 ${cleaned.slice(3)}` : cleaned;
    },
    type: 'phoneNumber'
  },

  // Financial amounts (Czech currency)
  amount: {
    pattern: /\b\d{1,3}(?:[\s\.\,]\d{3})*(?:[,\.]\d{1,2})?\s*(?:Kč|CZK|korun|EUR|€)\b/gi,
    validator: (value) => {
      return /\d/.test(value) && /(?:Kč|CZK|korun|EUR|€)/i.test(value);
    },
    normalizer: (value) => {
      const amount = value.replace(/[^\d,\.]/g, '').replace(',', '.');
      const currency = value.match(/(?:Kč|CZK|korun|EUR|€)/i)?.[0] || 'Kč';
      return `${amount} ${currency}`;
    },
    type: 'amount'
  },

  // IBAN and account numbers
  bankAccount: {
    pattern: /\b(?:CZ\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}|\d{1,10}[-\/]\d{4})\b/g,
    validator: (value) => {
      const cleaned = value.replace(/\s/g, '');
      return /^CZ\d{22}$/.test(cleaned) || /^\d{1,10}[-\/]\d{4}$/.test(value);
    },
    normalizer: (value) => value.replace(/\s/g, ''),
    type: 'bankAccount'
  },

  // Property numbers (parcel numbers)
  parcelNumber: {
    pattern: /\b\d+\/\d+\b(?!\s*\d{3})/g, // Excludes birth numbers by negative lookahead
    validator: (value) => {
      return /^\d+\/\d+$/.test(value) && !validateBirthNumber(value);
    },
    type: 'parcelNumber'
  },

  // Building numbers
  buildingNumber: {
    pattern: /\bč\.p\.\s*\d+(?:\/\d+)?|\bčíslo\s*popisné\s*\d+(?:\/\d+)?/gi,
    validator: (value) => /\d+/.test(value),
    normalizer: (value) => value.match(/\d+(?:\/\d+)?/)?.[0] || value,
    type: 'buildingNumber'
  },

  // Dates (Czech format)
  czechDate: {
    pattern: /\b\d{1,2}\.\s*\d{1,2}\.\s*\d{4}\b/g,
    validator: (value) => {
      const parts = value.split('.').map(p => parseInt(p.trim()));
      if (parts.length !== 3) return false;
      const [day, month, year] = parts;
      return day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100;
    },
    normalizer: (value) => {
      const parts = value.split('.').map(p => p.trim().padStart(2, '0'));
      return `${parts[0]}.${parts[1]}.${parts[2]}`;
    },
    type: 'date'
  },

  // Contract numbers and case numbers
  contractNumber: {
    pattern: /\b(?:smlouva|kontrakt)\s*(?:č\.|číslo)\s*[\w\/-]+|\bspis\.?\s*zn\.?\s*[\w\/-]+/gi,
    validator: (value) => /[\w\/-]/.test(value),
    normalizer: (value) => value.match(/[\w\/-]+$/)?.[0] || value,
    type: 'contractNumber'
  },

  // Legal entity ID numbers
  companyId: {
    pattern: /\bIČO?\s*:?\s*\d{8}\b|\bidentifikační\s*číslo\s*:?\s*\d{8}\b/gi,
    validator: (value) => {
      const id = value.match(/\d{8}/)?.[0];
      return id && validateCompanyId(id);
    },
    normalizer: (value) => value.match(/\d{8}/)?.[0] || value,
    type: 'companyId'
  },

  // VAT numbers
  vatNumber: {
    pattern: /\bDIČ\s*:?\s*CZ\d{8,10}\b/gi,
    validator: (value) => /CZ\d{8,10}/.test(value),
    normalizer: (value) => value.match(/CZ\d{8,10}/)?.[0] || value,
    type: 'vatNumber'
  }
};

/**
 * Contract clause patterns for semantic understanding
 */
export const CONTRACT_CLAUSES = {
  // Purchase price clauses
  purchasePrice: {
    keywords: ['kupní cena', 'prodejní cena', 'celková cena', 'cena díla'],
    patterns: [
      /kupní\s+cena[\s\w]*?činí[\s\w]*?(\d{1,3}(?:[\s\.\,]\d{3})*(?:[,\.]\d{1,2})?\s*(?:Kč|CZK|korun))/gi,
      /za\s+cenu[\s\w]*?(\d{1,3}(?:[\s\.\,]\d{3})*(?:[,\.]\d{1,2})?\s*(?:Kč|CZK|korun))/gi,
      /celková\s+cena[\s\w]*?(\d{1,3}(?:[\s\.\,]\d{3})*(?:[,\.]\d{1,2})?\s*(?:Kč|CZK|korun))/gi
    ]
  },

  // Payment terms
  paymentTerms: {
    keywords: ['splatnost', 'platba', 'uhrada', 'termín platby'],
    patterns: [
      /splatnost[\s\w]*?(\d{1,2}[\.\s]\d{1,2}[\.\s]\d{4})/gi,
      /do[\s\w]*?(\d+)\s*(?:dnů|dní)/gi,
      /nejpozději[\s\w]*?(\d{1,2}[\.\s]\d{1,2}[\.\s]\d{4})/gi
    ]
  },

  // Property description
  propertyDescription: {
    keywords: ['pozemek', 'parcela', 'stavba', 'nemovitost', 'objekt'],
    patterns: [
      /parcela\s+č\.\s*(\d+\/\d+)/gi,
      /pozemek\s+parcelní\s+číslo\s*(\d+\/\d+)/gi,
      /stavba\s+na\s+parcele\s*(\d+\/\d+)/gi
    ]
  },

  // Contracting parties
  contractingParties: {
    keywords: ['prodávající', 'kupující', 'nájemce', 'pronajímatel', 'objednatel', 'dodavatel'],
    patterns: [
      /prodávající:\s*([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž\s]+)/gi,
      /kupující:\s*([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž\s]+)/gi,
      /nájemce:\s*([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž\s]+)/gi
    ]
  }
};

/**
 * Analyze contract document for specific legal patterns
 */
export const analyzeContractDocument = (document, query) => {
  const results = [];
  const queryLower = query.toLowerCase();
  const normalizedQuery = removeDiacritics(queryLower);

  // Determine what user is looking for
  const searchIntents = detectSearchIntent(normalizedQuery);
  
  for (const intent of searchIntents) {
    const matches = findPatternMatches(document, intent);
    results.push(...matches);
  }

  // Remove duplicates and rank by relevance
  return deduplicateAndRank(results, query);
};

/**
 * Detect what the user is searching for
 */
function detectSearchIntent(query) {
  const intents = [];

  // Financial information
  if (/cena|castka|penize|kolik|hodnota|suma/.test(query)) {
    intents.push('amount', 'purchasePrice');
  }

  // Personal information
  if (/jmeno|osoba|kdo|prodavajici|kupujici|najemce/.test(query)) {
    intents.push('fullName', 'contractingParties');
  }

  // Identification numbers
  if (/rodne|rc|cislo/.test(query)) {
    intents.push('birthNumber', 'companyId', 'contractNumber');
  }

  // Property information
  if (/nemovitost|pozemek|parcela|stavba|dum|byt/.test(query)) {
    intents.push('parcelNumber', 'buildingNumber', 'propertyDescription');
  }

  // Contact information
  if (/telefon|mobil|kontakt|adresa|bydliste/.test(query)) {
    intents.push('phoneNumber', 'address');
  }

  // Banking information
  if (/ucet|iban|banka/.test(query)) {
    intents.push('bankAccount');
  }

  // Date information
  if (/datum|kdy|termin|lhuta|splatnost/.test(query)) {
    intents.push('czechDate', 'paymentTerms');
  }

  // If no specific intent detected, search all patterns
  if (intents.length === 0) {
    intents.push(...Object.keys(CZECH_LEGAL_PATTERNS));
  }

  return intents;
}

/**
 * Find matches for specific pattern
 */
function findPatternMatches(document, patternName) {
  const results = [];
  const pattern = CZECH_LEGAL_PATTERNS[patternName];
  
  if (!pattern) {
    // Check if it's a clause pattern
    const clause = CONTRACT_CLAUSES[patternName];
    if (clause) {
      return findClauseMatches(document, clause, patternName);
    }
    return results;
  }

  const matches = Array.from(document.matchAll(pattern.pattern));
  
  for (const match of matches) {
    const value = match[0];
    const start = match.index;
    const end = start + value.length;

    // Validate the match if validator exists
    if (pattern.validator && !pattern.validator(value)) {
      continue;
    }

    // Normalize the value if normalizer exists
    const normalizedValue = pattern.normalizer ? pattern.normalizer(value) : value;

    // Get surrounding context
    const context = getContext(document, start, end);

    results.push({
      label: getPatternLabel(pattern.type),
      value: normalizedValue,
      originalValue: value,
      start,
      end,
      type: pattern.type,
      confidence: calculateConfidence(value, pattern, context),
      context: context.trim()
    });
  }

  return results;
}

/**
 * Find matches in contract clauses
 */
function findClauseMatches(document, clause, clauseName) {
  const results = [];

  for (const pattern of clause.patterns) {
    const matches = Array.from(document.matchAll(pattern));
    
    for (const match of matches) {
      const fullMatch = match[0];
      const value = match[1] || fullMatch;
      const start = match.index;
      const end = start + fullMatch.length;

      // Get broader context for clauses
      const context = getContext(document, start, end, 200);

      results.push({
        label: getClauseLabel(clauseName),
        value: value.trim(),
        originalValue: fullMatch,
        start,
        end,
        type: clauseName,
        confidence: 0.9, // High confidence for clause matches
        context: context.trim(),
        clauseType: true
      });
    }
  }

  return results;
}

/**
 * Get surrounding context for a match
 */
function getContext(document, start, end, radius = 100) {
  const contextStart = Math.max(0, start - radius);
  const contextEnd = Math.min(document.length, end + radius);
  return document.slice(contextStart, contextEnd);
}

/**
 * Calculate confidence score for a match
 */
function calculateConfidence(value, pattern, context) {
  let confidence = 0.8; // Base confidence

  // Boost for exact pattern match
  if (pattern.validator && pattern.validator(value)) {
    confidence += 0.15;
  }

  // Boost for contextual relevance
  if (hasRelevantContext(context, pattern.type)) {
    confidence += 0.05;
  }

  return Math.min(1.0, confidence);
}

/**
 * Check if context is relevant for the pattern type
 */
function hasRelevantContext(context, patternType) {
  const contextKeywords = {
    birthNumber: ['rodné číslo', 'rc', 'narozen', 'identifikace'],
    fullName: ['jméno', 'příjmení', 'osoba', 'pan', 'paní'],
    amount: ['cena', 'částka', 'korun', 'platba', 'hodnota'],
    phoneNumber: ['telefon', 'mobil', 'kontakt'],
    address: ['adresa', 'bydliště', 'sídlo', 'ulice'],
    parcelNumber: ['parcela', 'pozemek', 'číslo parcely']
  };

  const keywords = contextKeywords[patternType] || [];
  const lowerContext = context.toLowerCase();
  
  return keywords.some(keyword => lowerContext.includes(keyword));
}

/**
 * Get user-friendly label for pattern type
 */
function getPatternLabel(patternType) {
  const labels = {
    birthNumber: 'Rodné číslo',
    fullName: 'Jméno a příjmení',
    amount: 'Finanční částka',
    phoneNumber: 'Telefonní číslo',
    address: 'Adresa',
    bankAccount: 'Bankovní účet',
    parcelNumber: 'Parcelní číslo',
    buildingNumber: 'Číslo popisné',
    czechDate: 'Datum',
    contractNumber: 'Číslo smlouvy',
    companyId: 'IČO',
    vatNumber: 'DIČ'
  };

  return labels[patternType] || 'Nalezený údaj';
}

/**
 * Get user-friendly label for clause type
 */
function getClauseLabel(clauseType) {
  const labels = {
    purchasePrice: 'Kupní cena',
    paymentTerms: 'Podmínky platby',
    propertyDescription: 'Popis nemovitosti',
    contractingParties: 'Smluvní strana'
  };

  return labels[clauseType] || 'Smluvní ustanovení';
}

/**
 * Remove duplicates and rank results by relevance
 */
function deduplicateAndRank(results, query) {
  // Remove exact duplicates
  const seen = new Set();
  const deduplicated = results.filter(result => {
    const key = `${result.start}-${result.end}-${result.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Rank by confidence and relevance to query
  return deduplicated
    .sort((a, b) => {
      // Primary: confidence score
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      
      // Secondary: query relevance (how well the type matches the query)
      const aRelevance = calculateQueryRelevance(a, query);
      const bRelevance = calculateQueryRelevance(b, query);
      
      return bRelevance - aRelevance;
    })
    .slice(0, 10); // Limit to top 10 results
}

/**
 * Calculate how relevant a result is to the original query
 */
function calculateQueryRelevance(result, query) {
  const queryLower = query.toLowerCase();
  const normalizedQuery = removeDiacritics(queryLower);
  
  let relevance = 0;

  // Direct value match
  if (normalizedQuery.includes(removeDiacritics(result.value.toLowerCase()))) {
    relevance += 0.5;
  }

  // Type-specific relevance
  const typeRelevance = {
    birthNumber: /rodne|rc/,
    fullName: /jmeno|osoba/,
    amount: /cena|castka|penize/,
    phoneNumber: /telefon|mobil/,
    address: /adresa|bydliste/,
    parcelNumber: /parcela|pozemek/
  };

  const typePattern = typeRelevance[result.type];
  if (typePattern && typePattern.test(normalizedQuery)) {
    relevance += 0.3;
  }

  // Context relevance
  if (result.context && normalizedQuery.split(' ').some(word => 
    removeDiacritics(result.context.toLowerCase()).includes(word)
  )) {
    relevance += 0.2;
  }

  return relevance;
}

/**
 * Validate Czech birth number (rodné číslo)
 */
function validateBirthNumber(birthNumber) {
  const cleaned = birthNumber.replace(/[^\d]/g, '');
  
  if (cleaned.length < 9 || cleaned.length > 10) return false;
  
  // Basic format check
  if (!/^\d{6}\d{3,4}$/.test(cleaned)) return false;
  
  // Extract components
  const year = parseInt(cleaned.substr(0, 2));
  const month = parseInt(cleaned.substr(2, 2));
  const day = parseInt(cleaned.substr(4, 2));
  
  // Adjust year based on birth number format
  const fullYear = year < 54 ? 2000 + year : 1900 + year;
  
  // Validate month (can be +50 for women)
  const realMonth = month > 50 ? month - 50 : month;
  if (realMonth < 1 || realMonth > 12) return false;
  
  // Validate day
  if (day < 1 || day > 31) return false;
  
  // Additional validation could include checksum for post-1954 birth numbers
  return true;
}

/**
 * Validate Czech company ID (IČO)
 */
function validateCompanyId(ico) {
  if (!/^\d{8}$/.test(ico)) return false;
  
  // Calculate checksum
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    sum += parseInt(ico[i]) * (8 - i);
  }
  
  const remainder = sum % 11;
  const checksum = remainder < 2 ? remainder : 11 - remainder;
  
  return checksum === parseInt(ico[7]);
}

/**
 * Enhanced search specifically for contract documents
 */
export const searchContractDocument = (document, query, options = {}) => {
  const startTime = Date.now();
  
  try {
    // Use contract analyzer
    const results = analyzeContractDocument(document, query);
    
    const duration = Date.now() - startTime;
    logger.info('Contract Search', `Found ${results.length} results in ${duration}ms`, {
      query,
      resultCount: results.length,
      duration
    });
    
    return {
      results,
      metadata: {
        searchType: 'contract',
        duration,
        query,
        confidence: results.length > 0 ? Math.max(...results.map(r => r.confidence)) : 0
      }
    };
    
  } catch (error) {
    logger.error('Contract Search', error.message, { query, error: error.stack });
    throw error;
  }
};

export default {
  analyzeContractDocument,
  searchContractDocument,
  CZECH_LEGAL_PATTERNS,
  CONTRACT_CLAUSES
};