/**
 * Document Management Workflow
 * Handles document loading, processing, validation, and state transitions
 */

import { logger } from '../logger.js'
import { createNormalizedDocument, removeDiacritics } from '../documentNormalizer.js'
import { analyzeContractDocument } from '../contractAnalyzer.js'
import { performanceMonitor } from '../performanceOptimizer.js'

export class DocumentWorkflow {
  constructor() {
    this.state = {
      // Document content
      originalText: '',
      processedText: '',
      normalizedDocument: null,
      
      // Processing states
      isProcessing: false,
      isNormalizing: false,
      isAnalyzing: false,
      
      // Document metadata
      documentType: 'unknown',
      language: 'cs',
      encoding: 'UTF-8',
      wordCount: 0,
      characterCount: 0,
      lineCount: 0,
      
      // Analysis results
      contractAnalysis: null,
      detectedEntities: [],
      keyPhrases: [],
      
      // Processing history
      processHistory: [],
      lastProcessed: null,
      
      // Error states
      errors: [],
      warnings: [],
      
      // Performance metrics
      processingTime: null,
      normalizationTime: null,
      analysisTime: null
    }
    
    this.config = {
      maxDocumentSize: 1024 * 1024, // 1MB
      minDocumentSize: 10, // 10 characters
      enableAutoNormalization: true,
      enableAutoAnalysis: true,
      enableProgressiveProcessing: true,
      processingChunkSize: 10000, // 10KB chunks
      normalizationDelay: 100, // ms
      analysisDelay: 500, // ms
      enableEntityDetection: true,
      enableContractAnalysis: true,
      enableLanguageDetection: true
    }
    
    this.listeners = new Set()
    this.processingTimer = null
    this.normalizationTimer = null
    this.analysisTimer = null
    
    this.documentTypes = new Map([
      ['contract', this.processContract.bind(this)],
      ['legal', this.processLegalDocument.bind(this)],
      ['financial', this.processFinancialDocument.bind(this)],
      ['personal', this.processPersonalDocument.bind(this)],
      ['general', this.processGeneralDocument.bind(this)]
    ])
    
    this.initializeWorkflow()
  }

  /**
   * Initialize document workflow
   */
  initializeWorkflow() {
    logger.info('DOCUMENT_WORKFLOW', 'Document workflow initialized', {
      supportedTypes: Array.from(this.documentTypes.keys()),
      config: this.config
    })
  }

  /**
   * Main document processing entry point
   */
  async processDocument(text, options = {}) {
    const processId = this.generateProcessId()
    const startTime = Date.now()
    
    try {
      // Validate input
      this.validateDocumentInput(text, options)
      
      // Set initial state
      this.setState({
        isProcessing: true,
        originalText: text,
        errors: [],
        warnings: [],
        lastProcessed: startTime
      })
      
      this.emitStateChange('processing_started', { processId, textLength: text.length })
      
      // Phase 1: Basic document analysis
      const documentInfo = await this.analyzeDocument(text)
      
      // Phase 2: Text normalization
      const normalizedDoc = await this.normalizeDocument(text, options)
      
      // Phase 3: Type-specific processing
      const processedResult = await this.processDocumentByType(text, documentInfo.type, options)
      
      // Phase 4: Entity detection and analysis
      const analysisResult = await this.analyzeDocumentContent(text, documentInfo.type, options)
      
      // Combine results
      const finalResult = await this.finalizeProcessing({
        processId,
        originalText: text,
        documentInfo,
        normalizedDoc,
        processedResult,
        analysisResult,
        startTime
      })
      
      this.emitStateChange('processing_completed', finalResult)
      
      return {
        success: true,
        processId,
        ...finalResult
      }
      
    } catch (error) {
      return this.handleProcessingError(error, text, processId, startTime)
    } finally {
      this.setState({ isProcessing: false })
    }
  }

  /**
   * Progressive document processing for large documents
   */
  async processDocumentProgressive(text, options = {}) {
    if (!this.config.enableProgressiveProcessing || text.length < this.config.processingChunkSize) {
      return this.processDocument(text, options)
    }
    
    const processId = this.generateProcessId()
    const startTime = Date.now()
    const chunks = this.splitIntoChunks(text, this.config.processingChunkSize)
    
    try {
      this.setState({ isProcessing: true })
      this.emitStateChange('progressive_processing_started', {
        processId,
        totalChunks: chunks.length,
        chunkSize: this.config.processingChunkSize
      })
      
      const results = []
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const chunkResult = await this.processDocumentChunk(chunk, i, chunks.length, options)
        results.push(chunkResult)
        
        this.emitStateChange('chunk_processed', {
          processId,
          chunkIndex: i,
          totalChunks: chunks.length,
          progress: ((i + 1) / chunks.length) * 100
        })
        
        // Small delay to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      
      // Merge chunk results
      const mergedResult = await this.mergeChunkResults(results, text, options)
      
      this.emitStateChange('progressive_processing_completed', {
        processId,
        ...mergedResult,
        duration: Date.now() - startTime
      })
      
      return {
        success: true,
        processId,
        progressive: true,
        ...mergedResult
      }
      
    } catch (error) {
      return this.handleProcessingError(error, text, processId, startTime)
    } finally {
      this.setState({ isProcessing: false })
    }
  }

  /**
   * Document analysis phase
   */
  async analyzeDocument(text) {
    const startTime = Date.now()
    
    try {
      const info = {
        type: this.detectDocumentType(text),
        language: this.detectLanguage(text),
        encoding: this.detectEncoding(text),
        wordCount: this.countWords(text),
        characterCount: text.length,
        lineCount: this.countLines(text),
        complexity: this.analyzeComplexity(text),
        structure: this.analyzeStructure(text)
      }
      
      this.setState({
        documentType: info.type,
        language: info.language,
        encoding: info.encoding,
        wordCount: info.wordCount,
        characterCount: info.characterCount,
        lineCount: info.lineCount
      })
      
      const duration = Date.now() - startTime
      logger.info('DOCUMENT_WORKFLOW', 'Document analyzed', { ...info, duration })
      
      return info
      
    } catch (error) {
      logger.error('DOCUMENT_WORKFLOW', 'Document analysis failed', { error: error.message })
      throw error
    }
  }

  /**
   * Document normalization phase
   */
  async normalizeDocument(text, options = {}) {
    if (!this.config.enableAutoNormalization && !options.forceNormalization) {
      return null
    }
    
    const startTime = Date.now()
    
    try {
      this.setState({ isNormalizing: true })
      
      // Use debounced normalization for large documents
      if (text.length > 50000) {
        return await this.normalizeDocumentDebounced(text, options)
      }
      
      const normalizedDoc = createNormalizedDocument(text)
      
      this.setState({
        normalizedDocument: normalizedDoc,
        isNormalizing: false,
        normalizationTime: Date.now() - startTime
      })
      
      logger.debug('DOCUMENT_WORKFLOW', 'Document normalized', {
        originalLength: text.length,
        normalizedLength: normalizedDoc.normalized.length,
        duration: Date.now() - startTime
      })
      
      return normalizedDoc
      
    } catch (error) {
      this.setState({ isNormalizing: false })
      logger.error('DOCUMENT_WORKFLOW', 'Normalization failed', { error: error.message })
      throw error
    }
  }

  async normalizeDocumentDebounced(text, options) {
    return new Promise((resolve, reject) => {
      if (this.normalizationTimer) {
        clearTimeout(this.normalizationTimer)
      }
      
      this.normalizationTimer = setTimeout(async () => {
        try {
          const normalizedDoc = createNormalizedDocument(text)
          this.setState({
            normalizedDocument: normalizedDoc,
            isNormalizing: false
          })
          resolve(normalizedDoc)
        } catch (error) {
          this.setState({ isNormalizing: false })
          reject(error)
        }
      }, this.config.normalizationDelay)
    })
  }

  /**
   * Type-specific document processing
   */
  async processDocumentByType(text, type, options) {
    const processor = this.documentTypes.get(type) || this.documentTypes.get('general')
    
    try {
      const result = await processor(text, options)
      
      logger.info('DOCUMENT_WORKFLOW', 'Type-specific processing completed', {
        type,
        processingTime: result.processingTime
      })
      
      return result
      
    } catch (error) {
      logger.error('DOCUMENT_WORKFLOW', 'Type-specific processing failed', {
        type,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Document content analysis
   */
  async analyzeDocumentContent(text, type, options) {
    if (!this.config.enableAutoAnalysis && !options.forceAnalysis) {
      return null
    }
    
    const startTime = Date.now()
    
    try {
      this.setState({ isAnalyzing: true })
      
      const analysis = {
        entities: this.config.enableEntityDetection ? this.detectEntities(text) : [],
        keyPhrases: this.extractKeyPhrases(text),
        contractAnalysis: null
      }
      
      // Contract-specific analysis
      if (type === 'contract' && this.config.enableContractAnalysis) {
        analysis.contractAnalysis = analyzeContractDocument(text)
      }
      
      this.setState({
        detectedEntities: analysis.entities,
        keyPhrases: analysis.keyPhrases,
        contractAnalysis: analysis.contractAnalysis,
        isAnalyzing: false,
        analysisTime: Date.now() - startTime
      })
      
      logger.info('DOCUMENT_WORKFLOW', 'Content analysis completed', {
        entitiesFound: analysis.entities.length,
        keyPhrasesFound: analysis.keyPhrases.length,
        duration: Date.now() - startTime
      })
      
      return analysis
      
    } catch (error) {
      this.setState({ isAnalyzing: false })
      logger.error('DOCUMENT_WORKFLOW', 'Content analysis failed', { error: error.message })
      throw error
    }
  }

  /**
   * Document type processors
   */
  async processContract(text, options) {
    const startTime = Date.now()
    
    const contractData = {
      parties: this.extractContractParties(text),
      amounts: this.extractAmounts(text),
      dates: this.extractDates(text),
      terms: this.extractContractTerms(text),
      obligations: this.extractObligations(text)
    }
    
    return {
      type: 'contract',
      data: contractData,
      processingTime: Date.now() - startTime
    }
  }

  async processLegalDocument(text, options) {
    const startTime = Date.now()
    
    const legalData = {
      sections: this.extractLegalSections(text),
      references: this.extractLegalReferences(text),
      definitions: this.extractDefinitions(text)
    }
    
    return {
      type: 'legal',
      data: legalData,
      processingTime: Date.now() - startTime
    }
  }

  async processFinancialDocument(text, options) {
    const startTime = Date.now()
    
    const financialData = {
      amounts: this.extractAmounts(text),
      accounts: this.extractBankAccounts(text),
      transactions: this.extractTransactions(text)
    }
    
    return {
      type: 'financial',
      data: financialData,
      processingTime: Date.now() - startTime
    }
  }

  async processPersonalDocument(text, options) {
    const startTime = Date.now()
    
    const personalData = {
      names: this.extractPersonalNames(text),
      addresses: this.extractAddresses(text),
      phones: this.extractPhoneNumbers(text),
      birthNumbers: this.extractBirthNumbers(text)
    }
    
    return {
      type: 'personal',
      data: personalData,
      processingTime: Date.now() - startTime
    }
  }

  async processGeneralDocument(text, options) {
    const startTime = Date.now()
    
    const generalData = {
      paragraphs: this.extractParagraphs(text),
      sentences: this.extractSentences(text),
      keywords: this.extractKeywords(text)
    }
    
    return {
      type: 'general',
      data: generalData,
      processingTime: Date.now() - startTime
    }
  }

  /**
   * Document analysis utilities
   */
  detectDocumentType(text) {
    const lowerText = text.toLowerCase()
    
    // Contract indicators
    const contractKeywords = ['smlouva', 'kupní', 'prodej', 'kupující', 'prodávající', 'smluvní strana']
    const contractScore = contractKeywords.filter(keyword => lowerText.includes(keyword)).length
    
    // Legal document indicators
    const legalKeywords = ['zákon', 'paragraf', 'článek', 'odstavec', 'právní', 'soud']
    const legalScore = legalKeywords.filter(keyword => lowerText.includes(keyword)).length
    
    // Financial document indicators
    const financialKeywords = ['účet', 'banka', 'částka', 'platba', 'převod', 'faktura']
    const financialScore = financialKeywords.filter(keyword => lowerText.includes(keyword)).length
    
    // Personal document indicators
    const personalKeywords = ['rodné číslo', 'jméno', 'adresa', 'telefon', 'občanský průkaz']
    const personalScore = personalKeywords.filter(keyword => lowerText.includes(keyword)).length
    
    // Determine type based on highest score
    const scores = [
      { type: 'contract', score: contractScore },
      { type: 'legal', score: legalScore },
      { type: 'financial', score: financialScore },
      { type: 'personal', score: personalScore }
    ]
    
    scores.sort((a, b) => b.score - a.score)
    
    return scores[0].score > 0 ? scores[0].type : 'general'
  }

  detectLanguage(text) {
    const czechIndicators = ['a', 'v', 'na', 'se', 'z', 'k', 'o', 'do', 'ze', 'pro', 'při', 'od', 'po', 'za', 's']
    const sample = text.toLowerCase().substring(0, 1000)
    const words = sample.split(/\s+/)
    
    const czechWords = words.filter(word => czechIndicators.includes(word)).length
    const czechScore = czechWords / words.length
    
    return czechScore > 0.1 ? 'cs' : 'unknown'
  }

  detectEncoding(text) {
    // Simple encoding detection based on character patterns
    const hasSpecialChars = /[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(text)
    return hasSpecialChars ? 'UTF-8' : 'ASCII'
  }

  countWords(text) {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length
  }

  countLines(text) {
    return text.split('\n').length
  }

  analyzeComplexity(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const avgSentenceLength = text.length / sentences.length
    const avgWordLength = text.replace(/\s+/g, '').length / this.countWords(text)
    
    let complexity = 'simple'
    if (avgSentenceLength > 100 || avgWordLength > 6) {
      complexity = 'complex'
    } else if (avgSentenceLength > 50 || avgWordLength > 4) {
      complexity = 'medium'
    }
    
    return {
      level: complexity,
      avgSentenceLength,
      avgWordLength,
      sentenceCount: sentences.length
    }
  }

  analyzeStructure(text) {
    const structure = {
      hasParagraphs: text.includes('\n\n'),
      hasBulletPoints: /^\s*[-*•]\s/.test(text),
      hasNumberedLists: /^\s*\d+\.\s/.test(text),
      hasHeaders: /^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ].{0,50}$/m.test(text),
      hasQuotes: /["„"]/.test(text),
      hasDates: /\d{1,2}\.\s?\d{1,2}\.\s?\d{4}/.test(text),
      hasNumbers: /\d+/.test(text)
    }
    
    return structure
  }

  /**
   * Content extraction utilities
   */
  extractContractParties(text) {
    const parties = []
    const patterns = [
      /(?:kupující|prodávající|nájemce|pronajímatel|dodavatel|odběratel):\s*([^\n,;]+)/gi,
      /(?:smluvní strana|strana):\s*([^\n,;]+)/gi
    ]
    
    patterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(text)) !== null) {
        parties.push(match[1].trim())
      }
    })
    
    return [...new Set(parties)]
  }

  extractAmounts(text) {
    const amounts = []
    const patterns = [
      /(\d{1,3}(?:[\s\.,]\d{3})*(?:[\.,]\d+)?)\s*(?:Kč|CZK|eur|€)/gi,
      /(?:částka|cena|hodnota|úhrada):\s*(\d+(?:[,\.]\d+)?)/gi
    ]
    
    patterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(text)) !== null) {
        amounts.push(match[1].trim())
      }
    })
    
    return [...new Set(amounts)]
  }

  extractDates(text) {
    const dates = []
    const patterns = [
      /\d{1,2}\.\s?\d{1,2}\.\s?\d{4}/g,
      /\d{4}-\d{1,2}-\d{1,2}/g
    ]
    
    patterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        dates.push(...matches)
      }
    })
    
    return [...new Set(dates)]
  }

  extractBirthNumbers(text) {
    const birthNumbers = []
    const pattern = /\b\d{6}\/?\d{3,4}\b/g
    const matches = text.match(pattern)
    
    if (matches) {
      birthNumbers.push(...matches.filter(bn => {
        const normalized = bn.replace(/\//g, '')
        return normalized.length === 9 || normalized.length === 10
      }))
    }
    
    return [...new Set(birthNumbers)]
  }

  extractPhoneNumbers(text) {
    const phones = []
    const patterns = [
      /(\+420\s?)?\d{3}\s?\d{3}\s?\d{3}/g,
      /\d{9}/g
    ]
    
    patterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        phones.push(...matches)
      }
    })
    
    return [...new Set(phones)]
  }

  extractBankAccounts(text) {
    const accounts = []
    const patterns = [
      /\d{1,6}-?\d{10}\/\d{4}/g, // Czech bank account format
      /[A-Z]{2}\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{0,4}/g // IBAN
    ]
    
    patterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        accounts.push(...matches)
      }
    })
    
    return [...new Set(accounts)]
  }

  extractPersonalNames(text) {
    const names = []
    const pattern = /[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+/g
    const matches = text.match(pattern)
    
    if (matches) {
      names.push(...matches)
    }
    
    return [...new Set(names)]
  }

  extractAddresses(text) {
    const addresses = []
    const patterns = [
      /[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+\s+\d+(?:\/\d+)?,\s*\d{3}\s?\d{2}\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+/g
    ]
    
    patterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        addresses.push(...matches)
      }
    })
    
    return [...new Set(addresses)]
  }

  detectEntities(text) {
    const entities = []
    
    // Person entities
    const names = this.extractPersonalNames(text)
    names.forEach(name => {
      entities.push({ type: 'PERSON', value: name, confidence: 0.8 })
    })
    
    // Date entities
    const dates = this.extractDates(text)
    dates.forEach(date => {
      entities.push({ type: 'DATE', value: date, confidence: 0.9 })
    })
    
    // Money entities
    const amounts = this.extractAmounts(text)
    amounts.forEach(amount => {
      entities.push({ type: 'MONEY', value: amount, confidence: 0.9 })
    })
    
    return entities
  }

  extractKeyPhrases(text) {
    const phrases = []
    const sentences = text.split(/[.!?]+/)
    
    sentences.forEach(sentence => {
      const words = sentence.trim().split(/\s+/)
      if (words.length >= 2 && words.length <= 5) {
        const phrase = words.join(' ').trim()
        if (phrase.length > 5) {
          phrases.push(phrase)
        }
      }
    })
    
    return phrases.slice(0, 20) // Limit to top 20 phrases
  }

  /**
   * Processing utilities
   */
  splitIntoChunks(text, chunkSize) {
    const chunks = []
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.substring(i, i + chunkSize))
    }
    return chunks
  }

  async processDocumentChunk(chunk, index, total, options) {
    const chunkInfo = await this.analyzeDocument(chunk)
    const normalizedChunk = await this.normalizeDocument(chunk, options)
    
    return {
      index,
      chunk,
      info: chunkInfo,
      normalized: normalizedChunk
    }
  }

  async mergeChunkResults(chunkResults, originalText, options) {
    const mergedInfo = {
      type: this.findMostCommonType(chunkResults),
      language: this.findMostCommonLanguage(chunkResults),
      totalWordCount: chunkResults.reduce((sum, result) => sum + result.info.wordCount, 0),
      totalCharacterCount: originalText.length,
      chunkCount: chunkResults.length
    }
    
    // Merge normalized documents
    const mergedNormalized = this.mergeNormalizedChunks(chunkResults)
    
    return {
      documentInfo: mergedInfo,
      normalizedDocument: mergedNormalized,
      chunkResults
    }
  }

  findMostCommonType(chunkResults) {
    const typeCounts = {}
    chunkResults.forEach(result => {
      typeCounts[result.info.type] = (typeCounts[result.info.type] || 0) + 1
    })
    
    return Object.keys(typeCounts).reduce((a, b) => 
      typeCounts[a] > typeCounts[b] ? a : b
    )
  }

  findMostCommonLanguage(chunkResults) {
    const langCounts = {}
    chunkResults.forEach(result => {
      langCounts[result.info.language] = (langCounts[result.info.language] || 0) + 1
    })
    
    return Object.keys(langCounts).reduce((a, b) => 
      langCounts[a] > langCounts[b] ? a : b
    )
  }

  mergeNormalizedChunks(chunkResults) {
    // Simple concatenation for now - could be more sophisticated
    const normalized = chunkResults
      .map(result => result.normalized?.normalized || '')
      .join('')
    
    return { normalized }
  }

  /**
   * Finalization and cleanup
   */
  async finalizeProcessing(processingData) {
    const {
      processId,
      originalText,
      documentInfo,
      normalizedDoc,
      processedResult,
      analysisResult,
      startTime
    } = processingData
    
    const totalDuration = Date.now() - startTime
    
    const finalResult = {
      processId,
      documentInfo,
      normalizedDocument: normalizedDoc,
      processedData: processedResult?.data || {},
      analysis: analysisResult || {},
      performance: {
        totalDuration,
        normalizationTime: this.state.normalizationTime,
        analysisTime: this.state.analysisTime,
        processingTime: processedResult?.processingTime
      },
      metadata: {
        processedAt: new Date().toISOString(),
        originalLength: originalText.length,
        wordCount: this.state.wordCount,
        characterCount: this.state.characterCount,
        documentType: this.state.documentType
      }
    }
    
    // Add to processing history
    this.addToProcessHistory(finalResult)
    
    // Update final state
    this.setState({
      processedText: originalText,
      processingTime: totalDuration
    })
    
    logger.info('DOCUMENT_WORKFLOW', 'Document processing finalized', {
      processId,
      duration: totalDuration,
      type: documentInfo.type,
      wordCount: this.state.wordCount
    })
    
    return finalResult
  }

  /**
   * Error handling
   */
  handleProcessingError(error, text, processId, startTime) {
    const duration = Date.now() - startTime
    
    logger.error('DOCUMENT_WORKFLOW', 'Document processing failed', {
      error: error.message,
      processId,
      duration,
      textLength: text.length
    })
    
    this.setState({
      errors: [...this.state.errors, error.message],
      isProcessing: false,
      isNormalizing: false,
      isAnalyzing: false
    })
    
    this.emitStateChange('processing_error', {
      processId,
      error: error.message,
      duration
    })
    
    return {
      success: false,
      error: error.message,
      processId,
      duration
    }
  }

  validateDocumentInput(text, options) {
    if (!text || typeof text !== 'string') {
      throw new Error('Text je povinný a musí být řetězec')
    }
    
    if (text.length < this.config.minDocumentSize) {
      throw new Error(`Dokument je příliš krátký (minimum ${this.config.minDocumentSize} znaků)`)
    }
    
    if (text.length > this.config.maxDocumentSize) {
      throw new Error(`Dokument je příliš velký (maximum ${this.config.maxDocumentSize / 1024}KB)`)
    }
  }

  /**
   * State and history management
   */
  setState(updates) {
    this.state = { ...this.state, ...updates }
  }

  getState() {
    return { ...this.state }
  }

  addToProcessHistory(result) {
    const historyEntry = {
      ...result,
      timestamp: Date.now()
    }
    
    const newHistory = [historyEntry, ...this.state.processHistory].slice(0, 10)
    this.setState({ processHistory: newHistory })
  }

  generateProcessId() {
    return `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Event system
   */
  addListener(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emitStateChange(event, data = {}) {
    const eventData = {
      event,
      state: this.getState(),
      timestamp: Date.now(),
      ...data
    }
    
    this.listeners.forEach(listener => {
      try {
        listener(eventData)
      } catch (error) {
        logger.error('DOCUMENT_WORKFLOW', 'Listener error', { error: error.message })
      }
    })
  }

  /**
   * Public API
   */
  clearDocument() {
    this.setState({
      originalText: '',
      processedText: '',
      normalizedDocument: null,
      documentType: 'unknown',
      wordCount: 0,
      characterCount: 0,
      lineCount: 0,
      contractAnalysis: null,
      detectedEntities: [],
      keyPhrases: [],
      errors: [],
      warnings: []
    })
    
    this.emitStateChange('document_cleared')
  }

  getDocumentStats() {
    return {
      type: this.state.documentType,
      wordCount: this.state.wordCount,
      characterCount: this.state.characterCount,
      lineCount: this.state.lineCount,
      language: this.state.language,
      processingTime: this.state.processingTime,
      hasNormalizedDocument: !!this.state.normalizedDocument,
      entityCount: this.state.detectedEntities.length,
      keyPhraseCount: this.state.keyPhrases.length
    }
  }

  getProcessingHistory() {
    return this.state.processHistory
  }
}

// Create singleton instance
export const documentWorkflow = new DocumentWorkflow()

// Export convenience functions
export const processDocument = (text, options) => documentWorkflow.processDocument(text, options)
export const processDocumentProgressive = (text, options) => documentWorkflow.processDocumentProgressive(text, options)
export const getDocumentState = () => documentWorkflow.getState()
export const addDocumentListener = (listener) => documentWorkflow.addListener(listener)
export const clearDocument = () => documentWorkflow.clearDocument()

export default documentWorkflow