/**
 * Robust contract document processing pipeline
 */

import { logger } from '../utils/logger.js';
import { cache } from '../utils/cache.js';
import claudeService from '../api/claudeService.js';

class ContractProcessor {
  constructor() {
    this.supportedFormats = ['txt', 'pdf', 'docx', 'html'];
    this.maxFileSize = 50 * 1024 * 1024; // 50MB
    this.processingQueue = [];
    this.isProcessing = false;
    
    // Contract analysis patterns
    this.contractPatterns = {
      parties: [
        /(?:smluvní\s+strany?|strany?|účastníci?)\s*:\s*([^\.]+)/gi,
        /(?:prodávající|kupující|pronajímatel|nájemce|dodavatel|odběratel)\s*:\s*([^\.]+)/gi
      ],
      amounts: [
        /(?:cena|částka|hodnota|úhrada|platba)\s*:?\s*([\d\s,\.]+\s*(?:kč|czk|eur|usd))/gi,
        /([\d\s,\.]+\s*(?:kč|czk|eur|usd))/gi
      ],
      dates: [
        /(\d{1,2}\.?\s*\d{1,2}\.?\s*\d{4})/g,
        /(\d{4}-\d{2}-\d{2})/g,
        /(\d{1,2}\.\s*\d{1,2}\.\s*\d{4})/g
      ],
      identifiers: [
        /(?:rodné\s+číslo|rč)\s*:?\s*(\d{6}\/?\d{3,4})/gi,
        /(?:ičo?|identifikační\s+číslo)\s*:?\s*(\d{8})/gi,
        /(?:dič|daňové\s+identifikační\s+číslo)\s*:?\s*(cz\d{8,10})/gi
      ],
      addresses: [
        /(?:adresa|bydliště|sídlo)\s*:?\s*([^,\.]+(?:,\s*[^,\.]+)*)/gi,
        /(\d{5}\s+[a-záčďéěíňóřšťúůýžA-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ\s]+)/g
      ]
    };
    
    logger.info('Contract processor initialized');
  }

  /**
   * Process contract document
   */
  async processContract(content, metadata = {}) {
    const startTime = Date.now();
    const documentId = this.generateDocumentId();
    
    try {
      logger.info(`Processing contract document ${documentId}`, {
        contentLength: content.length,
        metadata
      });

      // Validate input
      this.validateInput(content, metadata);

      // Normalize and clean content
      const normalizedContent = this.normalizeContent(content);

      // Extract basic information using patterns
      const basicExtraction = this.extractBasicInformation(normalizedContent);

      // Enhance extraction using Claude AI
      const enhancedExtraction = await this.enhanceWithAI(normalizedContent, basicExtraction);

      // Structure and validate results
      const structuredData = this.structureResults(enhancedExtraction, basicExtraction);

      // Generate summary and insights
      const summary = await this.generateSummary(normalizedContent, structuredData);

      const processingTime = Date.now() - startTime;

      const result = {
        documentId,
        metadata: {
          ...metadata,
          processedAt: new Date().toISOString(),
          processingTime: `${processingTime}ms`,
          contentLength: content.length,
          normalizedLength: normalizedContent.length
        },
        extraction: structuredData,
        summary,
        confidence: this.calculateConfidence(structuredData),
        status: 'completed'
      };

      // Cache the result
      await cache.set(`contract:${documentId}`, result, 3600000, 'contracts'); // 1 hour

      logger.info(`Contract processing completed ${documentId}`, {
        processingTime,
        extractedItems: Object.keys(structuredData).length
      });

      return result;

    } catch (error) {
      logger.error(`Contract processing failed ${documentId}`, {
        error: error.message,
        stack: error.stack
      });

      return {
        documentId,
        metadata: {
          ...metadata,
          processedAt: new Date().toISOString(),
          processingTime: `${Date.now() - startTime}ms`
        },
        extraction: {},
        summary: null,
        confidence: 0,
        status: 'failed',
        error: error.message
      };
    }
  }

  /**
   * Validate input parameters
   */
  validateInput(content, metadata) {
    if (!content || typeof content !== 'string') {
      throw new Error('Content must be a non-empty string');
    }

    if (content.length < 100) {
      throw new Error('Content too short for meaningful contract analysis');
    }

    if (content.length > 5000000) { // 5MB
      throw new Error('Content too large for processing');
    }

    if (metadata.fileSize && metadata.fileSize > this.maxFileSize) {
      throw new Error(`File size exceeds maximum limit of ${this.maxFileSize} bytes`);
    }
  }

  /**
   * Normalize and clean document content
   */
  normalizeContent(content) {
    return content
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove special characters that might interfere
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      // Normalize quotes
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      // Normalize dashes
      .replace(/[–—]/g, '-')
      // Remove page numbers and headers/footers (basic patterns)
      .replace(/(?:strana|page)\s+\d+/gi, '')
      .replace(/^\s*\d+\s*$/gm, '')
      // Trim and clean
      .trim();
  }

  /**
   * Extract basic information using regex patterns
   */
  extractBasicInformation(content) {
    const extraction = {
      parties: [],
      amounts: [],
      dates: [],
      identifiers: [],
      addresses: []
    };

    // Extract parties
    for (const pattern of this.contractPatterns.parties) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        if (match[1] && match[1].trim().length > 3) {
          extraction.parties.push({
            value: match[1].trim(),
            context: this.getContext(content, match.index, 100),
            confidence: 0.7,
            start: match.index,
            end: match.index + match[0].length
          });
        }
      }
    }

    // Extract amounts
    for (const pattern of this.contractPatterns.amounts) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        if (match[1] || match[0]) {
          const value = (match[1] || match[0]).trim();
          if (this.isValidAmount(value)) {
            extraction.amounts.push({
              value,
              normalized: this.normalizeAmount(value),
              context: this.getContext(content, match.index, 100),
              confidence: 0.8,
              start: match.index,
              end: match.index + match[0].length
            });
          }
        }
      }
    }

    // Extract dates
    for (const pattern of this.contractPatterns.dates) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        if (match[1] || match[0]) {
          const value = (match[1] || match[0]).trim();
          if (this.isValidDate(value)) {
            extraction.dates.push({
              value,
              normalized: this.normalizeDate(value),
              context: this.getContext(content, match.index, 100),
              confidence: 0.9,
              start: match.index,
              end: match.index + match[0].length
            });
          }
        }
      }
    }

    // Extract identifiers
    for (const pattern of this.contractPatterns.identifiers) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        if (match[1]) {
          extraction.identifiers.push({
            value: match[1].trim(),
            type: this.identifyIdentifierType(match[0]),
            context: this.getContext(content, match.index, 100),
            confidence: 0.95,
            start: match.index,
            end: match.index + match[0].length
          });
        }
      }
    }

    // Extract addresses
    for (const pattern of this.contractPatterns.addresses) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        if (match[1] || match[0]) {
          const value = (match[1] || match[0]).trim();
          if (value.length > 10) {
            extraction.addresses.push({
              value,
              context: this.getContext(content, match.index, 100),
              confidence: 0.6,
              start: match.index,
              end: match.index + match[0].length
            });
          }
        }
      }
    }

    return extraction;
  }

  /**
   * Enhance extraction using Claude AI
   */
  async enhanceWithAI(content, basicExtraction) {
    try {
      const enhancementPrompt = this.buildEnhancementPrompt(content, basicExtraction);
      
      const result = await claudeService.callClaudeAPI(
        enhancementPrompt,
        content,
        {
          maxTokens: 2000,
          useCache: true,
          cacheTimeMs: 1800000 // 30 minutes
        }
      );

      if (result.success && result.data.content) {
        return this.parseAIEnhancement(result.data.content);
      } else {
        logger.warn('AI enhancement failed, using basic extraction only');
        return {};
      }
    } catch (error) {
      logger.error('AI enhancement error', { error: error.message });
      return {};
    }
  }

  /**
   * Build enhancement prompt for Claude
   */
  buildEnhancementPrompt(content, basicExtraction) {
    return `Analyzuj tento právní dokument a vylepši extrakci informací. Zaměř se na přesnost a relevanci.

ZÁKLADNÍ EXTRAKCE:
${JSON.stringify(basicExtraction, null, 2)}

DOKUMENT:
${content.substring(0, 8000)}${content.length > 8000 ? '...' : ''}

ÚKOLY:
1. Ověř a upřesni základní extrakci
2. Najdi další relevantní informace:
   - Typ smlouvy/dokumentu
   - Účel/předmět smlouvy
   - Platnost/doba trvání
   - Povinnosti stran
   - Sankce/pokuty
   - Kontaktní údaje

Vrať odpověď v JSON formátu:
{
  "documentType": "typ dokumentu",
  "subject": "předmět smlouvy",
  "validity": "doba platnosti",
  "obligations": ["povinnost 1", "povinnost 2"],
  "penalties": ["sankce 1"],
  "contactInfo": ["kontakt 1"],
  "improvements": {
    "parties": [{"value": "upresnění", "confidence": 0.9}],
    "amounts": [{"value": "upresnění", "confidence": 0.9}]
  }
}`;
  }

  /**
   * Parse AI enhancement response
   */
  parseAIEnhancement(content) {
    try {
      // Extract JSON from Claude's response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {};
    } catch (error) {
      logger.warn('Failed to parse AI enhancement', { error: error.message });
      return {};
    }
  }

  /**
   * Structure and combine results
   */
  structureResults(aiEnhancement, basicExtraction) {
    const structured = {
      ...basicExtraction
    };

    // Apply AI improvements
    if (aiEnhancement.improvements) {
      for (const [category, improvements] of Object.entries(aiEnhancement.improvements)) {
        if (structured[category] && Array.isArray(improvements)) {
          structured[category] = [...structured[category], ...improvements];
        }
      }
    }

    // Add AI-discovered information
    if (aiEnhancement.documentType) {
      structured.documentType = aiEnhancement.documentType;
    }

    if (aiEnhancement.subject) {
      structured.subject = aiEnhancement.subject;
    }

    if (aiEnhancement.validity) {
      structured.validity = aiEnhancement.validity;
    }

    if (aiEnhancement.obligations) {
      structured.obligations = aiEnhancement.obligations;
    }

    if (aiEnhancement.penalties) {
      structured.penalties = aiEnhancement.penalties;
    }

    if (aiEnhancement.contactInfo) {
      structured.contactInfo = aiEnhancement.contactInfo;
    }

    // Remove duplicates and sort by confidence
    for (const category of ['parties', 'amounts', 'dates', 'identifiers', 'addresses']) {
      if (structured[category]) {
        structured[category] = this.removeDuplicates(structured[category])
          .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
      }
    }

    return structured;
  }

  /**
   * Generate document summary
   */
  async generateSummary(content, structuredData) {
    try {
      const summaryPrompt = `Vytvoř stručné shrnutí tohoto právního dokumentu v češtině.

EXTRAHOVANÁ DATA:
${JSON.stringify(structuredData, null, 2)}

Shrnutí by mělo obsahovat:
1. Typ dokumentu a jeho účel (1 věta)
2. Hlavní strany (1 věta)
3. Klíčové podmínky (2-3 věty)
4. Důležité termíny a částky (1 věta)

Maximálně 150 slov.`;

      const result = await claudeService.callClaudeAPI(
        summaryPrompt,
        content.substring(0, 5000),
        {
          maxTokens: 500,
          useCache: true
        }
      );

      if (result.success && result.data.content) {
        return result.data.content[0]?.text || 'Shrnutí není k dispozici';
      }

      return 'Shrnutí není k dispozici';
    } catch (error) {
      logger.error('Summary generation error', { error: error.message });
      return 'Chyba při generování shrnutí';
    }
  }

  /**
   * Calculate overall confidence score
   */
  calculateConfidence(structuredData) {
    const categories = ['parties', 'amounts', 'dates', 'identifiers'];
    let totalConfidence = 0;
    let totalItems = 0;

    for (const category of categories) {
      if (structuredData[category] && Array.isArray(structuredData[category])) {
        for (const item of structuredData[category]) {
          totalConfidence += item.confidence || 0;
          totalItems++;
        }
      }
    }

    return totalItems > 0 ? Math.round((totalConfidence / totalItems) * 100) / 100 : 0;
  }

  /**
   * Helper methods
   */
  generateDocumentId() {
    return `contract_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getContext(content, position, length = 100) {
    const start = Math.max(0, position - length / 2);
    const end = Math.min(content.length, position + length / 2);
    return content.substring(start, end).trim();
  }

  isValidAmount(value) {
    return /[\d,\s]+\s*(?:kč|czk|eur|usd)/i.test(value);
  }

  normalizeAmount(value) {
    return value.replace(/\s/g, '').toLowerCase();
  }

  isValidDate(value) {
    const dateRegex = /^\d{1,2}\.?\s*\d{1,2}\.?\s*\d{4}$|^\d{4}-\d{2}-\d{2}$/;
    return dateRegex.test(value.trim());
  }

  normalizeDate(value) {
    // Convert to standard format YYYY-MM-DD
    const cleaned = value.replace(/\s/g, '');
    if (cleaned.match(/^\d{1,2}\.?\d{1,2}\.?\d{4}$/)) {
      const parts = cleaned.split('.');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
    }
    return value;
  }

  identifyIdentifierType(text) {
    if (/rodné\s+číslo|rč/i.test(text)) return 'birth_number';
    if (/ičo?|identifikační\s+číslo/i.test(text)) return 'company_id';
    if (/dič|daňové/i.test(text)) return 'tax_id';
    return 'unknown';
  }

  removeDuplicates(items) {
    const seen = new Set();
    return items.filter(item => {
      const key = item.value.toLowerCase().trim();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      supportedFormats: this.supportedFormats,
      maxFileSize: this.maxFileSize,
      queueLength: this.processingQueue.length,
      isProcessing: this.isProcessing
    };
  }

  /**
   * Health check
   */
  healthCheck() {
    return {
      status: 'healthy',
      queueLength: this.processingQueue.length,
      isProcessing: this.isProcessing,
      supportedFormats: this.supportedFormats.length
    };
  }
}

// Create singleton instance
export const contractProcessor = new ContractProcessor();
export default contractProcessor;