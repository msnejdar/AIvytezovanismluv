// Document normalization utilities with index mapping

/**
 * Removes diacritics from text
 */
export const removeDiacritics = (text = '') => {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

/**
 * Removes markdown formatting while preserving index mapping
 */
export const removeMarkdown = (text = '') => {
  // Remove common markdown patterns
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // Bold **text**
    .replace(/\*([^*]+)\*/g, '$1')      // Italic *text*
    .replace(/__([^_]+)__/g, '$1')      // Bold __text__
    .replace(/_([^_]+)_/g, '$1')        // Italic _text_
    .replace(/~~([^~]+)~~/g, '$1')      // Strikethrough ~~text~~
    .replace(/`([^`]+)`/g, '$1')        // Inline code `text`
    .replace(/^#{1,6}\s+/gm, '')        // Headers
    .replace(/^\s*[-*+]\s+/gm, '')      // List items
    .replace(/^\s*\d+\.\s+/gm, '')      // Numbered lists
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Links [text](url)
};

/**
 * Creates normalized document with index mapping
 * Returns normalized text and mapping between normalized and original indices
 */
export const createNormalizedDocument = (originalText = '') => {
  if (!originalText) {
    return {
      normalized: '',
      indexMap: [],
      reverseMap: new Map()
    };
  }

  // First pass: remove markdown
  const withoutMarkdown = removeMarkdown(originalText);
  
  // Create index mapping for markdown removal
  const markdownMap = [];
  let originalIdx = 0;
  let cleanIdx = 0;
  
  // Simple approach: compare original and cleaned text character by character
  for (let i = 0; i < originalText.length; i++) {
    const char = originalText[i];
    
    // Check if this character exists in cleaned text at current position
    if (cleanIdx < withoutMarkdown.length && withoutMarkdown[cleanIdx] === char) {
      markdownMap[cleanIdx] = i;
      cleanIdx++;
    }
  }
  
  // Second pass: remove diacritics and normalize
  const normalized = removeDiacritics(withoutMarkdown).toLowerCase();
  
  // Create final index mapping
  const indexMap = [];
  const reverseMap = new Map();
  
  for (let i = 0; i < normalized.length; i++) {
    const originalIndex = markdownMap[i] || i;
    indexMap[i] = originalIndex;
    
    // Store reverse mapping for quick lookup
    if (!reverseMap.has(originalIndex)) {
      reverseMap.set(originalIndex, []);
    }
    reverseMap.get(originalIndex).push(i);
  }
  
  return {
    normalized,
    indexMap,
    reverseMap,
    withoutMarkdown
  };
};

/**
 * Maps normalized index back to original document index
 */
export const mapNormalizedToOriginal = (normalizedIndex, indexMap) => {
  if (!indexMap || normalizedIndex < 0 || normalizedIndex >= indexMap.length) {
    return normalizedIndex;
  }
  return indexMap[normalizedIndex];
};

/**
 * Maps a range from normalized document to original document
 */
export const mapRangeToOriginal = (start, end, indexMap) => {
  const originalStart = mapNormalizedToOriginal(start, indexMap);
  const originalEnd = mapNormalizedToOriginal(end - 1, indexMap) + 1;
  
  return {
    start: originalStart,
    end: originalEnd
  };
};

/**
 * Value type validators
 */
export const validators = {
  // Rodné číslo (Czech birth number)
  birthNumber: (value) => {
    const cleaned = value.replace(/\s+/g, '');
    return /^\d{6}\/\d{3,4}$/.test(cleaned);
  },
  
  // IBAN
  iban: (value) => {
    const cleaned = value.replace(/\s+/g, '').toUpperCase();
    // Basic IBAN validation (2 letters + 2 digits + up to 30 alphanumeric)
    return /^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(cleaned);
  },
  
  // Czech bank account number
  bankAccount: (value) => {
    const cleaned = value.replace(/\s+/g, '');
    // Format: [prefix-]accountNumber/bankCode
    return /^(\d{0,6}-)?(\d{2,10})\/\d{4}$/.test(cleaned);
  },
  
  // Amount with currency
  amount: (value) => {
    const cleaned = value.replace(/\s+/g, ' ').trim();
    // Matches amounts like "7 850 000 Kč" or "1,234.56 EUR"
    return /^\d{1,3}([\s,\.]\d{3})*([\.,]\d{1,2})?\s*(Kč|CZK|EUR|€|USD|\$)?$/i.test(cleaned);
  },
  
  // RPSN (Annual percentage rate)
  rpsn: (value) => {
    const cleaned = value.replace(/\s+/g, '').replace(',', '.');
    // Matches percentages like "5.9%" or "12.34 %"
    return /^\d{1,3}(\.\d{1,2})?%?$/.test(cleaned);
  },
  
  // Date formats
  date: (value) => {
    const cleaned = value.trim();
    // DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
    const dmyPattern = /^\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4}$/;
    // YYYY-MM-DD
    const ymdPattern = /^\d{4}-\d{2}-\d{2}$/;
    
    return dmyPattern.test(cleaned) || ymdPattern.test(cleaned);
  }
};

/**
 * Normalize value based on its type
 */
export const normalizeValue = (value, type) => {
  if (!value) return '';
  
  const cleaned = value.trim();
  
  switch (type) {
    case 'birthNumber':
      return cleaned.replace(/\s+/g, '').replace(/(\d{6})(\d{3,4})/, '$1/$2');
      
    case 'iban':
      return cleaned.replace(/\s+/g, '').toUpperCase();
      
    case 'bankAccount':
      return cleaned.replace(/\s+/g, '');
      
    case 'amount':
      // Keep spaces for thousands separators in amounts
      return cleaned.replace(/\s+/g, ' ');
      
    case 'rpsn':
      return cleaned.replace(/\s+/g, '').replace(',', '.');
      
    case 'date':
      return cleaned;
      
    default:
      return cleaned.toLowerCase();
  }
};

/**
 * Detect value type from text
 */
export const detectValueType = (value) => {
  if (!value) return 'unknown';
  
  const trimmed = value.trim();
  
  // Check each validator
  if (validators.birthNumber(trimmed)) return 'birthNumber';
  if (validators.iban(trimmed)) return 'iban';
  if (validators.bankAccount(trimmed)) return 'bankAccount';
  if (validators.rpsn(trimmed)) return 'rpsn';
  if (validators.date(trimmed)) return 'date';
  if (validators.amount(trimmed)) return 'amount';
  
  return 'text';
};

/**
 * Find all matches of a value in normalized document
 */
export const findValueInNormalizedDocument = (value, type, normalizedDoc, originalText) => {
  if (!value || !normalizedDoc || !normalizedDoc.normalized) {
    return [];
  }
  
  const normalizedValue = normalizeValue(value, type);
  const searchValue = removeDiacritics(normalizedValue).toLowerCase();
  
  const matches = [];
  let searchIndex = 0;
  
  while (searchIndex < normalizedDoc.normalized.length) {
    const foundIndex = normalizedDoc.normalized.indexOf(searchValue, searchIndex);
    
    if (foundIndex === -1) break;
    
    // Map back to original indices
    const originalRange = mapRangeToOriginal(
      foundIndex,
      foundIndex + searchValue.length,
      normalizedDoc.indexMap
    );
    
    // Validate the match in original text
    const originalMatch = originalText.substring(originalRange.start, originalRange.end);
    
    // Verify the match is valid for the type
    if (validators[type] && !validators[type](originalMatch)) {
      searchIndex = foundIndex + 1;
      continue;
    }
    
    matches.push({
      start: originalRange.start,
      end: originalRange.end,
      text: originalMatch,
      normalizedStart: foundIndex,
      normalizedEnd: foundIndex + searchValue.length
    });
    
    searchIndex = foundIndex + 1;
  }
  
  return matches;
};

/**
 * Extract individual values from complex AI responses
 */
export const extractIndividualValues = (responseText, documentText) => {
  if (!responseText || !documentText) return [];
  
  const matches = [];
  const text = documentText.toLowerCase();
  
  // Extract birth numbers (rodná čísla)
  const birthNumbers = responseText.match(/\d{6}\/\d{3,4}/g) || [];
  birthNumbers.forEach(bn => {
    const index = text.indexOf(bn.toLowerCase());
    if (index !== -1) {
      matches.push({
        start: index,
        end: index + bn.length,
        text: documentText.substring(index, index + bn.length)
      });
    }
  });
  
  // Extract names (Czech names pattern)
  const names = responseText.match(/[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+/g) || [];
  names.forEach(name => {
    const index = text.indexOf(name.toLowerCase());
    if (index !== -1) {
      matches.push({
        start: index,
        end: index + name.length,
        text: documentText.substring(index, index + name.length)
      });
    }
  });
  
  // Extract amounts with various formats
  const amounts = responseText.match(/\d{1,3}(?:[\s\.,]\d{3})*(?:[\.,]\d{1,2})?\s*(?:Kč|CZK|EUR|€|USD|\$)?/gi) || [];
  amounts.forEach(amount => {
    const cleanAmount = amount.replace(/\s+/g, ' ').trim();
    // Try exact match first
    let index = documentText.toLowerCase().indexOf(cleanAmount.toLowerCase());
    if (index === -1) {
      // Try without currency
      const numOnly = cleanAmount.replace(/\s*(Kč|CZK|EUR|€|USD|\$)\s*$/i, '').trim();
      index = documentText.toLowerCase().indexOf(numOnly.toLowerCase());
      if (index !== -1) {
        const actualLength = documentText.substring(index).match(/^\d{1,3}(?:[\s\.,]\d{3})*(?:[\.,]\d{1,2})?\s*(?:Kč|CZK|EUR|€|USD|\$)?/i);
        if (actualLength) {
          matches.push({
            start: index,
            end: index + actualLength[0].length,
            text: actualLength[0]
          });
        }
      }
    } else {
      matches.push({
        start: index,
        end: index + cleanAmount.length,
        text: documentText.substring(index, index + cleanAmount.length)
      });
    }
  });
  
  // Extract percentages
  const percentages = responseText.match(/\d{1,3}(?:[\.,]\d{1,2})?\s*%/g) || [];
  percentages.forEach(pct => {
    const index = text.indexOf(pct.toLowerCase());
    if (index !== -1) {
      matches.push({
        start: index,
        end: index + pct.length,
        text: documentText.substring(index, index + pct.length)
      });
    }
  });
  
  // Extract account numbers
  const accounts = responseText.match(/\d{2,10}\/\d{4}/g) || [];
  accounts.forEach(acc => {
    const index = text.indexOf(acc.toLowerCase());
    if (index !== -1) {
      matches.push({
        start: index,
        end: index + acc.length,
        text: documentText.substring(index, index + acc.length)
      });
    }
  });
  
  // Remove duplicates by position
  const unique = [];
  matches.forEach(match => {
    const exists = unique.some(u => u.start === match.start && u.end === match.end);
    if (!exists) {
      unique.push(match);
    }
  });
  
  console.log('[Extract] Found individual values:', unique);
  return unique;
};

/**
 * Create a debounced version of document normalization
 */
export const createDebouncedNormalizer = (callback, delay = 300) => {
  let timeoutId = null;
  
  return (text) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      const normalized = createNormalizedDocument(text);
      callback(normalized);
    }, delay);
  };
};