// Advanced semantic search with NLP techniques for Czech language
import { removeDiacritics } from './documentNormalizer.js';
import { logger } from './logger.js';

/**
 * Czech language stop words and common terms
 */
const CZECH_STOP_WORDS = new Set([
  'a', 'aby', 'ale', 'ani', 'anebo', 'asi', 'az', 'bez', 'bude', 'byl', 'byla', 'bylo', 'by',
  'co', 'coz', 'da', 'dal', 'do', 'ho', 'i', 'ich', 'ja', 'jak', 'jako', 'je', 'jeho', 'jej',
  'ji', 'jin', 'jsem', 'jsi', 'jsme', 'jste', 'jsou', 'k', 'kam', 'kde', 'kdo', 'kdy', 'ktera',
  'ktere', 'kteri', 'kterou', 'ma', 'me', 'mi', 'my', 'na', 'nad', 'nam', 'nas', 'nase', 'ne',
  'nez', 'ni', 'o', 'od', 'po', 'pod', 'pokud', 'pro', 's', 'se', 'si', 'sve', 'ta', 'tak',
  'take', 'tam', 'te', 'teto', 'tim', 'to', 'tu', 'ty', 'u', 'v', 've', 'vsak', 'z', 'za',
  'ze', 'si', 'ti', 'ty', 'uz'
]);

/**
 * Czech term synonyms and semantic relationships
 */
const SEMANTIC_RELATIONSHIPS = {
  // Personal information
  'jmeno': ['nazev', 'osoba', 'prijmeni', 'krestni'],
  'osoba': ['jmeno', 'clovek', 'fyzicka', 'pravnicka'],
  'adresa': ['ulice', 'mesto', 'bydliste', 'sidlo'],
  'telefon': ['mobil', 'cislo', 'kontakt', 'spojeni'],
  
  // Financial terms
  'cena': ['castka', 'hodnota', 'suma', 'kolik'],
  'castka': ['cena', 'hodnota', 'penize', 'platba'],
  'platba': ['uhrada', 'zaplaceni', 'poplatek', 'transakce'],
  'dane': ['poplatek', 'davka', 'odvod', 'danovy'],
  
  // Documents and IDs
  'rodne': ['cislo', 'rc', 'identifikator', 'identita'],
  'cislo': ['kod', 'id', 'identifikator', 'oznaceni'],
  'ucet': ['bankovni', 'financni', 'penezni', 'cislo'],
  'doklad': ['dokument', 'listina', 'papir', 'formular'],
  
  // Property and legal
  'nemovitost': ['pozemek', 'stavba', 'byt', 'dum'],
  'pozemek': ['parcela', 'puda', 'nemovitost', 'vlastnictvi'],
  'kupni': ['prodejni', 'obchodni', 'smlouva', 'kontrakt'],
  'smlouva': ['dohoda', 'kontrakt', 'ujednani', 'dokument'],
  
  // Time and dates
  'datum': ['den', 'cas', 'rok', 'mesic'],
  'rok': ['datum', 'rocnik', 'obdobi', 'leta'],
  'den': ['datum', 'cas', 'termin', 'lhuta'],
  
  // Quality and states
  'novy': ['svezi', 'aktualni', 'posledni', 'moderny'],
  'stary': ['puvodni', 'predchozi', 'minuly', 'davny'],
  'velky': ['rozlehly', 'obrovky', 'mohutny', 'velikost'],
  'maly': ['drobny', 'kratky', 'nizky', 'velikost']
};

/**
 * Extract meaningful terms from query
 */
export const extractTerms = (query) => {
  if (!query) return [];
  
  const normalized = removeDiacritics(query.toLowerCase());
  
  // Split into words and filter stop words
  const words = normalized
    .match(/\b[\p{L}\p{N}]+\b/gu) || []
    .filter(word => word.length > 2 && !CZECH_STOP_WORDS.has(word));
  
  // Extract multi-word terms (bigrams and trigrams)
  const terms = [...words];
  
  // Add bigrams
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    terms.push(bigram);
  }
  
  // Add trigrams for specific patterns
  for (let i = 0; i < words.length - 2; i++) {
    const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
    // Only add common Czech phrases
    if (isCommonPhrase(trigram)) {
      terms.push(trigram);
    }
  }
  
  return [...new Set(terms)]; // Remove duplicates
};

/**
 * Check if phrase is a common Czech term
 */
const isCommonPhrase = (phrase) => {
  const commonPhrases = [
    'rodne cislo', 'kupni cena', 'bankovni ucet', 'parcelni cislo',
    'fyzicka osoba', 'pravnicka osoba', 'kontaktni udaje', 'osobni udaje',
    'datum narozeni', 'misto narozeni', 'adresa bydliste', 'telefon cislo'
  ];
  
  return commonPhrases.some(common => 
    removeDiacritics(phrase.toLowerCase()).includes(removeDiacritics(common))
  );
};

/**
 * Expand query with semantic relationships
 */
export const expandQuery = (query) => {
  const terms = extractTerms(query);
  const expandedTerms = new Set(terms);
  
  // Add synonyms and related terms
  terms.forEach(term => {
    const normalizedTerm = removeDiacritics(term.toLowerCase());
    
    // Direct synonyms
    Object.entries(SEMANTIC_RELATIONSHIPS).forEach(([key, synonyms]) => {
      if (normalizedTerm.includes(key) || key.includes(normalizedTerm)) {
        synonyms.forEach(synonym => expandedTerms.add(synonym));
      }
    });
    
    // Partial matches for compound terms
    if (term.includes(' ')) {
      const words = term.split(' ');
      words.forEach(word => {
        if (SEMANTIC_RELATIONSHIPS[word]) {
          SEMANTIC_RELATIONSHIPS[word].forEach(synonym => 
            expandedTerms.add(synonym)
          );
        }
      });
    }
  });
  
  logger.debug('SemanticSearch', 'Query expansion', {
    originalTerms: terms.length,
    expandedTerms: expandedTerms.size,
    expansion: Array.from(expandedTerms).filter(t => !terms.includes(t))
  });
  
  return Array.from(expandedTerms);
};

/**
 * Calculate semantic similarity between terms
 */
export const semanticSimilarity = (term1, term2) => {
  if (!term1 || !term2) return 0;
  if (term1 === term2) return 1;
  
  const normalized1 = removeDiacritics(term1.toLowerCase());
  const normalized2 = removeDiacritics(term2.toLowerCase());
  
  if (normalized1 === normalized2) return 0.9;
  
  // Check direct relationships
  const synonyms1 = SEMANTIC_RELATIONSHIPS[normalized1] || [];
  const synonyms2 = SEMANTIC_RELATIONSHIPS[normalized2] || [];
  
  if (synonyms1.includes(normalized2) || synonyms2.includes(normalized1)) {
    return 0.8;
  }
  
  // Check shared synonyms
  const sharedSynonyms = synonyms1.filter(s => synonyms2.includes(s));
  if (sharedSynonyms.length > 0) {
    return 0.6 + (sharedSynonyms.length * 0.1);
  }
  
  // Check substring relationships
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    const longer = Math.max(normalized1.length, normalized2.length);
    const shorter = Math.min(normalized1.length, normalized2.length);
    return (shorter / longer) * 0.5;
  }
  
  // Check word overlap for multi-word terms
  const words1 = normalized1.split(' ');
  const words2 = normalized2.split(' ');
  const commonWords = words1.filter(w => words2.includes(w));
  
  if (commonWords.length > 0) {
    const totalWords = new Set([...words1, ...words2]).size;
    return (commonWords.length / totalWords) * 0.4;
  }
  
  return 0;
};

/**
 * Context-aware term weighting
 */
export const calculateTermWeight = (term, context) => {
  let weight = 1.0;
  
  // Boost important field types
  const importantTerms = [
    'rodne', 'cislo', 'jmeno', 'cena', 'castka', 'datum', 'adresa', 'telefon', 'ucet'
  ];
  
  if (importantTerms.some(important => term.includes(important))) {
    weight *= 1.5;
  }
  
  // Boost specific data patterns
  if (/\d/.test(term)) {
    weight *= 1.3; // Numbers are often important
  }
  
  if (term.length > 8) {
    weight *= 1.2; // Longer terms are often more specific
  }
  
  // Contextual boosts based on query intent
  if (context) {
    const contextLower = context.toLowerCase();
    
    if (contextLower.includes('najdi') || contextLower.includes('hledej')) {
      weight *= 1.1; // Search intent
    }
    
    if (contextLower.includes('kolik') || contextLower.includes('cena') || contextLower.includes('castka')) {
      if (term.includes('cena') || term.includes('castka') || /\d/.test(term)) {
        weight *= 1.4; // Price/amount queries
      }
    }
  }
  
  return weight;
};

/**
 * Semantic search with relevance scoring
 */
export const semanticSearch = (query, documents, options = {}) => {
  const {
    maxResults = 10,
    minScore = 0.3,
    useExpansion = true,
    contextWindow = 100
  } = options;
  
  if (!query || !documents) return [];
  
  const startTime = Date.now();
  
  // Extract and optionally expand query terms
  const originalTerms = extractTerms(query);
  const searchTerms = useExpansion ? expandQuery(query) : originalTerms;
  
  logger.debug('SemanticSearch', 'Search terms', {
    original: originalTerms,
    expanded: searchTerms,
    query
  });
  
  const results = [];
  
  // Handle both array of documents and single document
  const docArray = Array.isArray(documents) ? documents : [{ text: documents, id: 0 }];
  
  docArray.forEach((doc, docIndex) => {
    const text = doc.text || doc;
    const docId = doc.id !== undefined ? doc.id : docIndex;
    
    const documentTerms = extractTerms(text);
    let totalScore = 0;
    let matchedTerms = 0;
    const matches = [];
    
    // Score each search term against document
    searchTerms.forEach(searchTerm => {
      const termWeight = calculateTermWeight(searchTerm, query);
      let bestTermScore = 0;
      let bestMatch = null;
      
      documentTerms.forEach(docTerm => {
        const similarity = semanticSimilarity(searchTerm, docTerm);
        const score = similarity * termWeight;
        
        if (score > bestTermScore) {
          bestTermScore = score;
          bestMatch = docTerm;
        }
      });
      
      if (bestTermScore > minScore) {
        totalScore += bestTermScore;
        matchedTerms++;
        
        // Find position in text for highlighting
        const termIndex = text.toLowerCase().indexOf(bestMatch.toLowerCase());
        if (termIndex !== -1) {
          matches.push({
            term: bestMatch,
            searchTerm,
            score: bestTermScore,
            start: termIndex,
            end: termIndex + bestMatch.length,
            context: extractContext(text, termIndex, contextWindow)
          });
        }
      }
    });
    
    if (matchedTerms > 0) {
      const averageScore = totalScore / searchTerms.length;
      const coverageBonus = matchedTerms / searchTerms.length;
      const finalScore = averageScore * (0.7 + coverageBonus * 0.3);
      
      results.push({
        docId,
        score: finalScore,
        matchedTerms,
        totalTerms: searchTerms.length,
        coverage: coverageBonus,
        matches,
        text: doc.text || doc,
        label: doc.label || `Document ${docId + 1}`
      });
    }
  });
  
  // Sort by score and limit results
  const sortedResults = results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
  
  const duration = Date.now() - startTime;
  
  logger.info('SemanticSearch', 'Search completed', {
    query,
    termCount: searchTerms.length,
    documentCount: docArray.length,
    resultCount: sortedResults.length,
    duration: `${duration}ms`
  });
  
  return sortedResults;
};

/**
 * Extract context around a match
 */
const extractContext = (text, position, windowSize) => {
  const start = Math.max(0, position - windowSize);
  const end = Math.min(text.length, position + windowSize);
  const context = text.substring(start, end);
  
  return {
    text: context,
    matchStart: position - start,
    fullText: text,
    actualStart: start,
    actualEnd: end
  };
};

/**
 * Intent detection for queries
 */
export const detectIntent = (query) => {
  const normalized = removeDiacritics(query.toLowerCase());
  
  const intents = {
    search: ['najdi', 'hledej', 'vyhledej', 'najd', 'kde', 'co'],
    amount: ['kolik', 'cena', 'castka', 'stoji', 'hodnota', 'suma'],
    person: ['kdo', 'jmeno', 'osoba', 'clovek', 'pan', 'pani'],
    date: ['kdy', 'datum', 'rok', 'mesic', 'den', 'cas'],
    location: ['kde', 'adresa', 'ulice', 'mesto', 'kraj', 'misto'],
    phone: ['telefon', 'mobil', 'cislo', 'kontakt', 'zavolej'],
    document: ['dokument', 'listina', 'papir', 'formular', 'doklad']
  };
  
  const detected = [];
  
  Object.entries(intents).forEach(([intent, keywords]) => {
    const matches = keywords.filter(keyword => normalized.includes(keyword));
    if (matches.length > 0) {
      detected.push({
        intent,
        confidence: matches.length / keywords.length,
        matches
      });
    }
  });
  
  return detected.sort((a, b) => b.confidence - a.confidence);
};

/**
 * Multi-intent semantic search
 */
export const intelligentSearch = (query, documents, options = {}) => {
  const intents = detectIntent(query);
  
  logger.debug('SemanticSearch', 'Intent detection', {
    query,
    intents: intents.map(i => ({ intent: i.intent, confidence: i.confidence }))
  });
  
  // Adjust search parameters based on detected intent
  const adjustedOptions = { ...options };
  
  if (intents.length > 0) {
    const primaryIntent = intents[0];
    
    switch (primaryIntent.intent) {
      case 'amount':
        adjustedOptions.minScore = 0.4;
        adjustedOptions.focusPatterns = [/\d+[.,]?\d*\s*(kč|czk|eur|€)/gi, /\d+/g];
        break;
      case 'person':
        adjustedOptions.minScore = 0.5;
        adjustedOptions.focusPatterns = [/[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+/g];
        break;
      case 'date':
        adjustedOptions.minScore = 0.3;
        adjustedOptions.focusPatterns = [/\d{1,2}\.\s?\d{1,2}\.\s?\d{4}/g, /\d{4}-\d{2}-\d{2}/g];
        break;
      case 'phone':
        adjustedOptions.minScore = 0.6;
        adjustedOptions.focusPatterns = [/\+?420\s?\d{3}\s?\d{3}\s?\d{3}/g, /\d{9}/g];
        break;
    }
  }
  
  const results = semanticSearch(query, documents, adjustedOptions);
  
  // Enhance results with intent information
  return results.map(result => ({
    ...result,
    intents,
    primaryIntent: intents[0]?.intent || 'general'
  }));
};