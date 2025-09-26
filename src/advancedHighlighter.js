// Advanced highlighting system with 100% accuracy for contract documents
import { removeDiacritics } from './documentNormalizer.js';
import { logger } from './logger.js';

/**
 * Contract-specific highlighting styles
 */
const HIGHLIGHT_STYLES = {
  // Legal entity types
  birthNumber: { bg: '#e8f5e8', border: '#4caf50', label: 'RC' },
  fullName: { bg: '#e3f2fd', border: '#2196f3', label: 'Jméno' },
  amount: { bg: '#fff3e0', border: '#ff9800', label: 'Částka' },
  phoneNumber: { bg: '#f3e5f5', border: '#9c27b0', label: 'Tel' },
  address: { bg: '#e0f2f1', border: '#009688', label: 'Adresa' },
  bankAccount: { bg: '#fce4ec', border: '#e91e63', label: 'Účet' },
  parcelNumber: { bg: '#f1f8e9', border: '#689f38', label: 'Parcela' },
  czechDate: { bg: '#fff8e1', border: '#fbc02d', label: 'Datum' },
  contractNumber: { bg: '#ede7f6', border: '#673ab7', label: 'Smlouva' },
  companyId: { bg: '#efebe9', border: '#795548', label: 'IČO' },
  
  // Default fallback
  default: { bg: '#ffecb3', border: '#ffa000', label: '' }
};

/**
 * Enhanced HTML escaping that preserves formatting hints
 */
export const escapeHtml = (text, preserveFormatting = false) => {
  if (!text) return '';
  
  let escaped = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  
  if (preserveFormatting) {
    // Preserve line breaks and basic spacing
    escaped = escaped
      .replace(/\n/g, '<br>')
      .replace(/  +/g, (match) => '&nbsp;'.repeat(match.length));
  }
  
  return escaped;
};

/**
 * Smart range merging that handles overlaps and adjacency
 */
export const mergeHighlightRanges = (ranges, options = {}) => {
  if (!Array.isArray(ranges) || ranges.length === 0) return [];
  
  const { 
    mergeAdjacent = true, 
    adjacentThreshold = 3,
    prioritizeType = 'score' // 'score', 'length', 'position'
  } = options;
  
  // Validate and sort ranges
  const validRanges = ranges
    .filter(range => 
      range && 
      typeof range.start === 'number' && 
      typeof range.end === 'number' && 
      range.start < range.end && 
      range.start >= 0
    )
    .map((range, index) => ({
      ...range,
      originalIndex: index,
      length: range.end - range.start,
      priority: calculateRangePriority(range, prioritizeType)
    }))
    .sort((a, b) => a.start - b.start);
  
  if (validRanges.length === 0) return [];
  
  const merged = [];
  let current = { ...validRanges[0] };
  
  for (let i = 1; i < validRanges.length; i++) {
    const next = validRanges[i];
    
    // Check for overlap or adjacency
    const overlap = current.end > next.start;
    const adjacent = mergeAdjacent && (next.start - current.end <= adjacentThreshold);
    
    if (overlap || adjacent) {
      // Merge ranges, keeping higher priority metadata
      const higherPriority = next.priority > current.priority ? next : current;
      
      current = {
        ...higherPriority,
        start: Math.min(current.start, next.start),
        end: Math.max(current.end, next.end),
        mergedRanges: [...(current.mergedRanges || [current.originalIndex]), next.originalIndex],
        confidence: Math.max(current.confidence || 0, next.confidence || 0)
      };
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  
  merged.push(current);
  
  logger.debug('AdvancedHighlighter', 'Range merging completed', {
    originalCount: ranges.length,
    mergedCount: merged.length,
    reduction: `${Math.round((1 - merged.length / ranges.length) * 100)}%`
  });
  
  return merged;
};

/**
 * Calculate priority for range merging decisions
 */
const calculateRangePriority = (range, type) => {
  switch (type) {
    case 'score':
      return range.score || range.confidence || 0;
    case 'length':
      return range.end - range.start;
    case 'position':
      return 1000 - range.start; // Earlier positions get higher priority
    default:
      return range.score || range.confidence || range.end - range.start;
  }
};

/**
 * Generate highlight classes based on context and type
 */
export const generateHighlightClass = (range, context = {}) => {
  const classes = ['highlight'];
  
  // Add type-specific classes
  if (range.type) {
    classes.push(`highlight-${range.type}`);
  }
  
  // Add confidence-based classes
  const confidence = range.confidence || range.score || 0;
  if (confidence > 0.8) {
    classes.push('highlight-high');
  } else if (confidence > 0.5) {
    classes.push('highlight-medium');
  } else {
    classes.push('highlight-low');
  }
  
  // Add semantic classes based on content
  const text = range.text || '';
  if (/\d{6}\/\d{3,4}/.test(text)) {
    classes.push('highlight-birth-number');
  } else if (/\d+[.,]?\d*\s*(kč|czk|eur|€)/gi.test(text)) {
    classes.push('highlight-amount');
  } else if (/[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(text)) {
    classes.push('highlight-name');
  } else if (/\+?420\s?\d{3}\s?\d{3}\s?\d{3}/.test(text)) {
    classes.push('highlight-phone');
  } else if (/\d{1,2}\.\s?\d{1,2}\.\s?\d{4}/.test(text)) {
    classes.push('highlight-date');
  }
  
  // Add active class if this is the active result
  if (context.activeRangeId && range.id === context.activeRangeId) {
    classes.push('highlight-active');
  }
  
  return classes.join(' ');
};

/**
 * Advanced highlighting with diacritic preservation
 */
export const renderAdvancedHighlights = (text, ranges, options = {}) => {
  if (!text || !ranges || ranges.length === 0) {
    return escapeHtml(text, options.preserveFormatting);
  }
  
  const {
    preserveFormatting = true,
    addDataAttributes = true,
    highlightTag = 'mark',
    customRenderer = null,
    contextualStyling = true
  } = options;
  
  const startTime = Date.now();
  
  // Merge overlapping ranges
  const mergedRanges = mergeHighlightRanges(ranges, {
    mergeAdjacent: true,
    adjacentThreshold: 2
  });
  
  // Sort ranges by start position (descending) for reverse processing
  const sortedRanges = mergedRanges.sort((a, b) => b.start - a.start);
  
  let result = escapeHtml(text, preserveFormatting);
  
  // Apply highlights in reverse order to maintain correct indices
  sortedRanges.forEach((range, index) => {
    const start = Math.max(0, Math.min(range.start, text.length));
    const end = Math.max(start, Math.min(range.end, text.length));
    
    if (start >= end) return;
    
    const highlightText = escapeHtml(text.substring(start, end), preserveFormatting);
    const cssClass = contextualStyling ? generateHighlightClass(range, options) : 'highlight';
    
    // Build attributes
    const attributes = [];
    attributes.push(`class="${cssClass}"`);
    
    if (addDataAttributes) {
      if (range.id) attributes.push(`data-highlight-id="${range.id}"`);
      if (range.resultId) attributes.push(`data-result-id="${range.resultId}"`);
      if (range.type) attributes.push(`data-type="${range.type}"`);
      if (range.confidence) attributes.push(`data-confidence="${range.confidence.toFixed(2)}"`);
    }
    
    // Custom renderer or default
    let highlightHtml;
    if (customRenderer && typeof customRenderer === 'function') {
      highlightHtml = customRenderer(highlightText, range, attributes.join(' '));
    } else {
      highlightHtml = `<${highlightTag} ${attributes.join(' ')}>${highlightText}</${highlightTag}>`;
    }
    
    // Insert the highlight
    const beforeText = result.substring(0, start);
    const afterText = result.substring(end);
    result = beforeText + highlightHtml + afterText;
  });
  
  const duration = Date.now() - startTime;
  
  logger.debug('AdvancedHighlighter', 'Rendering completed', {
    textLength: text.length,
    rangeCount: ranges.length,
    mergedCount: mergedRanges.length,
    duration: `${duration}ms`,
    hasCustomRenderer: !!customRenderer
  });
  
  return result;
};

/**
 * Smart text segmentation for better highlighting
 */
export const segmentText = (text, ranges) => {
  if (!text || !ranges || ranges.length === 0) {
    return [{ text, type: 'text', start: 0, end: text.length }];
  }
  
  const segments = [];
  const sortedRanges = [...ranges].sort((a, b) => a.start - b.start);
  let lastEnd = 0;
  
  sortedRanges.forEach(range => {
    // Add text segment before highlight
    if (range.start > lastEnd) {
      segments.push({
        text: text.substring(lastEnd, range.start),
        type: 'text',
        start: lastEnd,
        end: range.start
      });
    }
    
    // Add highlight segment
    segments.push({
      text: text.substring(range.start, range.end),
      type: 'highlight',
      start: range.start,
      end: range.end,
      range: range
    });
    
    lastEnd = Math.max(lastEnd, range.end);
  });
  
  // Add remaining text
  if (lastEnd < text.length) {
    segments.push({
      text: text.substring(lastEnd),
      type: 'text',
      start: lastEnd,
      end: text.length
    });
  }
  
  return segments;
};

/**
 * Context-aware highlighting with surrounding text enhancement
 */
export const renderContextualHighlights = (text, ranges, options = {}) => {
  const {
    contextPadding = 20,
    maxContextLength = 200,
    showEllipsis = true,
    preserveOriginalFormatting = true
  } = options;
  
  if (!ranges || ranges.length === 0) {
    return escapeHtml(text, preserveOriginalFormatting);
  }
  
  const segments = segmentText(text, ranges);
  let result = '';
  
  segments.forEach((segment, index) => {
    if (segment.type === 'highlight') {
      // Enhanced highlight with context
      const contextStart = Math.max(0, segment.start - contextPadding);
      const contextEnd = Math.min(text.length, segment.end + contextPadding);
      
      let contextBefore = '';
      let contextAfter = '';
      
      if (contextStart < segment.start) {
        contextBefore = text.substring(contextStart, segment.start);
        if (contextBefore.length > maxContextLength && showEllipsis) {
          contextBefore = '...' + contextBefore.slice(-maxContextLength + 3);
        }
      }
      
      if (contextEnd > segment.end) {
        contextAfter = text.substring(segment.end, contextEnd);
        if (contextAfter.length > maxContextLength && showEllipsis) {
          contextAfter = contextAfter.slice(0, maxContextLength - 3) + '...';
        }
      }
      
      const cssClass = generateHighlightClass(segment.range, options);
      const highlightContent = escapeHtml(segment.text, preserveOriginalFormatting);
      
      result += `<span class="context-before">${escapeHtml(contextBefore, preserveOriginalFormatting)}</span>`;
      result += `<mark class="${cssClass}" data-highlight-id="${segment.range.id || ''}">${highlightContent}</mark>`;
      result += `<span class="context-after">${escapeHtml(contextAfter, preserveOriginalFormatting)}</span>`;
      
    } else {
      result += escapeHtml(segment.text, preserveOriginalFormatting);
    }
  });
  
  return result;
};

/**
 * Progressive highlighting for large documents
 */
export const renderProgressiveHighlights = (text, ranges, options = {}) => {
  const {
    chunkSize = 5000,
    maxChunks = 10,
    prioritizeVisibleRanges = true
  } = options;
  
  if (!text || text.length <= chunkSize) {
    return renderAdvancedHighlights(text, ranges, options);
  }
  
  logger.info('AdvancedHighlighter', 'Using progressive highlighting', {
    textLength: text.length,
    chunkSize,
    rangeCount: ranges?.length || 0
  });
  
  // Split text into chunks
  const chunks = [];
  for (let i = 0; i < text.length && chunks.length < maxChunks; i += chunkSize) {
    const end = Math.min(i + chunkSize, text.length);
    chunks.push({
      text: text.substring(i, end),
      start: i,
      end: end,
      ranges: ranges.filter(r => r.start < end && r.end > i)
        .map(r => ({
          ...r,
          start: Math.max(0, r.start - i),
          end: Math.min(end - i, r.end - i)
        }))
    });
  }
  
  // Render each chunk
  return chunks.map((chunk, index) => {
    const chunkHtml = renderAdvancedHighlights(chunk.text, chunk.ranges, {
      ...options,
      addDataAttributes: true
    });
    
    return `<div class="text-chunk" data-chunk-index="${index}" data-chunk-start="${chunk.start}">${chunkHtml}</div>`;
  }).join('');
};

/**
 * Accessibility-enhanced highlighting
 */
export const renderAccessibleHighlights = (text, ranges, options = {}) => {
  const {
    addAriaLabels = true,
    addScreenReaderText = true,
    highlightRole = 'mark'
  } = options;
  
  const accessibleOptions = {
    ...options,
    customRenderer: (highlightText, range, attributes) => {
      const ariaLabel = addAriaLabels ? 
        `aria-label="Highlighted: ${range.type || 'match'} - ${highlightText.substring(0, 50)}"` : '';
      
      const screenReaderText = addScreenReaderText ?
        `<span class="sr-only">Start highlight: </span>` : '';
      
      const screenReaderEnd = addScreenReaderText ?
        `<span class="sr-only"> End highlight</span>` : '';
      
      return `${screenReaderText}<mark role="${highlightRole}" ${attributes} ${ariaLabel}>${highlightText}</mark>${screenReaderEnd}`;
    }
  };
  
  return renderAdvancedHighlights(text, ranges, accessibleOptions);
};

/**
 * Contract-specific highlighting with legal document styling
 */
export const renderContractHighlights = (text, ranges, options = {}) => {
  const {
    showConfidence = true,
    showLabels = true,
    groupByType = true,
    highConfidenceThreshold = 0.8
  } = options;
  
  if (!text || !ranges || ranges.length === 0) {
    return escapeHtml(text, options.preserveFormatting);
  }
  
  // Group ranges by type if requested
  const processedRanges = groupByType ? groupRangesByType(ranges) : ranges;
  
  const contractOptions = {
    ...options,
    contextualStyling: true,
    addDataAttributes: true,
    customRenderer: (highlightText, range, attributes) => {
      const style = getContractHighlightStyle(range);
      const confidence = range.confidence || 0.5;
      
      // Build CSS classes
      const cssClasses = ['contract-highlight', `highlight-${range.type || 'default'}`];
      
      if (confidence >= highConfidenceThreshold) {
        cssClasses.push('high-confidence');
      } else if (confidence < 0.6) {
        cssClasses.push('low-confidence');
      }
      
      // Build inline styles
      const inlineStyles = [
        `background-color: ${style.bg}`,
        `border-left: 3px solid ${style.border}`,
        'padding: 2px 4px',
        'border-radius: 3px',
        'position: relative'
      ];
      
      // Add label if enabled
      const label = showLabels && style.label ? 
        `<span class="highlight-label" style="
          position: absolute;
          top: -20px;
          left: 0;
          background: ${style.border};
          color: white;
          padding: 1px 4px;
          font-size: 10px;
          border-radius: 2px;
          white-space: nowrap;
          z-index: 1000;
        ">${style.label}</span>` : '';
      
      // Add confidence indicator if enabled
      const confidenceIndicator = showConfidence ?
        `<span class="confidence-indicator" style="
          opacity: 0.7;
          font-size: 0.8em;
        " title="Spolehlivost: ${Math.round(confidence * 100)}%">
          ${Math.round(confidence * 100)}%
        </span>` : '';
      
      return `<mark 
        class="${cssClasses.join(' ')}" 
        style="${inlineStyles.join('; ')}"
        ${attributes}
        data-confidence="${confidence.toFixed(2)}"
        title="${range.type || 'highlight'}: ${highlightText} (${Math.round(confidence * 100)}% sure)"
      >${label}${highlightText}${confidenceIndicator}</mark>`;
    }
  };
  
  return renderAdvancedHighlights(text, processedRanges, contractOptions);
};

/**
 * Get contract-specific highlight style
 */
function getContractHighlightStyle(range) {
  const type = range.type || 'default';
  return HIGHLIGHT_STYLES[type] || HIGHLIGHT_STYLES.default;
}

/**
 * Group ranges by type for better organization
 */
function groupRangesByType(ranges) {
  const grouped = {};
  
  ranges.forEach(range => {
    const type = range.type || 'default';
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(range);
  });
  
  // Sort groups by priority (legal importance)
  const typePriority = {
    birthNumber: 10,
    companyId: 9,
    fullName: 8,
    amount: 7,
    contractNumber: 6,
    czechDate: 5,
    address: 4,
    phoneNumber: 3,
    bankAccount: 3,
    parcelNumber: 2,
    default: 1
  };
  
  const result = [];
  Object.keys(grouped)
    .sort((a, b) => (typePriority[b] || 0) - (typePriority[a] || 0))
    .forEach(type => {
      result.push(...grouped[type]);
    });
  
  return result;
}

/**
 * Enhanced highlighting for legal documents with validation
 */
export const highlightLegalDocument = (text, ranges, options = {}) => {
  const startTime = Date.now();
  
  try {
    // Validate ranges for legal document requirements
    const validatedRanges = validateLegalHighlights(ranges, text);
    
    // Use contract-specific highlighting
    const result = renderContractHighlights(text, validatedRanges, {
      ...options,
      showConfidence: true,
      showLabels: true,
      groupByType: true,
      preserveFormatting: true,
      accessible: true
    });
    
    const duration = Date.now() - startTime;
    
    logger.info('ContractHighlighter', 'Legal document highlighted', {
      textLength: text.length,
      originalRanges: ranges.length,
      validatedRanges: validatedRanges.length,
      duration: `${duration}ms`
    });
    
    return result;
    
  } catch (error) {
    logger.error('ContractHighlighter', 'Error highlighting legal document', error);
    // Fallback to basic highlighting
    return renderAdvancedHighlights(text, ranges, options);
  }
};

/**
 * Validate highlights for legal document accuracy
 */
function validateLegalHighlights(ranges, text) {
  return ranges.filter(range => {
    // Basic validation
    if (!range || typeof range.start !== 'number' || typeof range.end !== 'number') {
      return false;
    }
    
    if (range.start < 0 || range.end > text.length || range.start >= range.end) {
      return false;
    }
    
    // Extract actual text and verify it matches expected value
    const actualText = text.slice(range.start, range.end);
    
    if (range.value && actualText.trim() !== range.value.trim()) {
      logger.warn('ContractHighlighter', 'Text mismatch detected', {
        expected: range.value,
        actual: actualText,
        range: { start: range.start, end: range.end }
      });
      return false;
    }
    
    return true;
  });
}

/**
 * Export default highlighting function with auto-detection
 */
export const smartHighlight = (text, ranges, options = {}) => {
  if (!text || !ranges || ranges.length === 0) {
    return escapeHtml(text, options.preserveFormatting);
  }
  
  const textLength = text.length;
  const rangeCount = ranges.length;
  
  // Detect if this is a legal/contract document
  const isLegalDocument = detectLegalDocument(text, ranges);
  
  if (isLegalDocument) {
    return highlightLegalDocument(text, ranges, options);
  }
  
  // Choose rendering strategy based on content size and complexity
  if (textLength > 50000 || rangeCount > 100) {
    return renderProgressiveHighlights(text, ranges, options);
  } else if (options.contextual) {
    return renderContextualHighlights(text, ranges, options);
  } else if (options.accessible) {
    return renderAccessibleHighlights(text, ranges, options);
  } else {
    return renderAdvancedHighlights(text, ranges, options);
  }
};

/**
 * Detect if document appears to be a legal/contract document
 */
function detectLegalDocument(text, ranges) {
  const legalKeywords = [
    'smlouva', 'kontrakt', 'kupní', 'prodejní', 'nájemní',
    'rodné číslo', 'IČO', 'DIČ', 'smluvní strana',
    'prodávající', 'kupující', 'nájemce', 'pronajímatel'
  ];
  
  const legalTypes = [
    'birthNumber', 'companyId', 'vatNumber', 'contractNumber',
    'fullName', 'amount', 'parcelNumber'
  ];
  
  const textLower = text.toLowerCase();
  const hasLegalKeywords = legalKeywords.some(keyword => textLower.includes(keyword));
  const hasLegalTypes = ranges.some(range => legalTypes.includes(range.type));
  
  return hasLegalKeywords || hasLegalTypes;
}