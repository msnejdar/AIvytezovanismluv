/**
 * Search Workflow Management
 * Handles the complete search pipeline: input → processing → results → highlighting
 */

import { logger } from '../logger.js'
import { performanceMonitor, searchCache, createQueryHash } from '../performanceOptimizer.js'
import { findValueInNormalizedDocument, createNormalizedDocument, detectValueType } from '../documentNormalizer.js'
import { findFuzzyMatches, czechFuzzySearch } from '../fuzzySearch.js'
import { intelligentSearch, semanticSearch } from '../semanticSearch.js'
import { rankSearchResults } from '../intelligentRanking.js'
import { searchContractDocument } from '../contractAnalyzer.js'

export class SearchWorkflow {
  constructor() {
    this.state = {
      isSearching: false,
      currentQuery: '',
      currentDocument: '',
      searchMode: 'intelligent',
      results: [],
      performance: null,
      errors: [],
      warnings: [],
      lastSearchTime: null,
      searchHistory: [],
      activeResultId: null
    }
    
    this.config = {
      defaultMode: 'intelligent',
      enableCaching: true,
      enableRealtime: true,
      realtimeDelay: 500,
      maxHistoryItems: 10,
      maxResults: 10,
      searchTimeout: 30000, // 30 seconds
      enablePerformanceTracking: true,
      enableErrorRecovery: true,
      enableFallbackStrategies: true
    }
    
    this.listeners = new Set()
    this.abortController = null
    this.realtimeTimer = null
    
    this.searchStrategies = new Map([
      ['exact', this.exactSearch.bind(this)],
      ['fuzzy', this.fuzzySearch.bind(this)],
      ['semantic', this.semanticSearch.bind(this)],
      ['intelligent', this.intelligentSearch.bind(this)],
      ['contract', this.contractSearch.bind(this)],
      ['hybrid', this.hybridSearch.bind(this)]
    ])
    
    this.initializeWorkflow()
  }

  /**
   * Initialize the search workflow
   */
  initializeWorkflow() {
    // Load search history
    this.loadSearchHistory()
    
    // Set up performance monitoring
    if (this.config.enablePerformanceTracking) {
      this.setupPerformanceMonitoring()
    }
    
    logger.info('SEARCH_WORKFLOW', 'Search workflow initialized', {
      strategies: Array.from(this.searchStrategies.keys()),
      config: this.config
    })
  }

  /**
   * Main search entry point
   */
  async search(query, document, options = {}) {
    const searchId = this.generateSearchId()
    const startTime = Date.now()
    
    try {
      // Validate input
      this.validateSearchInput(query, document)
      
      // Set initial state
      this.setState({
        isSearching: true,
        currentQuery: query,
        currentDocument: document,
        errors: [],
        warnings: [],
        lastSearchTime: startTime
      })
      
      this.emitStateChange('search_started', { searchId, query, mode: options.mode || this.state.searchMode })
      
      // Check cache first
      const cachedResults = await this.checkCache(query, document, options)
      if (cachedResults) {
        return this.handleCachedResults(cachedResults, searchId, startTime)
      }
      
      // Abort any ongoing search
      this.abortOngoingSearch()
      
      // Create new abort controller
      this.abortController = new AbortController()
      const { signal } = this.abortController
      
      // Process search with timeout
      const results = await Promise.race([
        this.processSearch(query, document, options, signal),
        this.createSearchTimeout()
      ])
      
      // Post-process results
      const processedResults = await this.postProcessResults(results, query, document, options)
      
      // Update state and cache
      await this.handleSuccessfulSearch(processedResults, query, document, searchId, startTime)
      
      return {
        success: true,
        results: processedResults,
        searchId,
        performance: this.state.performance,
        warnings: this.state.warnings
      }
      
    } catch (error) {
      return this.handleSearchError(error, query, document, searchId, startTime)
    } finally {
      this.setState({ isSearching: false })
      this.abortController = null
    }
  }

  /**
   * Real-time search with debouncing
   */
  searchRealtime(query, document, options = {}) {
    if (!this.config.enableRealtime) {
      return Promise.resolve(null)
    }
    
    // Clear existing timer
    if (this.realtimeTimer) {
      clearTimeout(this.realtimeTimer)
    }
    
    // Debounce the search
    return new Promise((resolve) => {
      this.realtimeTimer = setTimeout(async () => {
        try {
          const results = await this.search(query, document, {
            ...options,
            realtime: true,
            maxResults: 5 // Limit results for real-time
          })
          resolve(results)
        } catch (error) {
          logger.warn('SEARCH_WORKFLOW', 'Real-time search failed', { error: error.message })
          resolve(null)
        }
      }, this.config.realtimeDelay)
    })
  }

  /**
   * Process search based on strategy
   */
  async processSearch(query, document, options, signal) {
    const mode = options.mode || this.state.searchMode
    const strategy = this.searchStrategies.get(mode)
    
    if (!strategy) {
      throw new Error(`Unsupported search mode: ${mode}`)
    }
    
    // Start performance tracking
    const timerId = performanceMonitor.startTimer(`search-${mode}`, {
      queryLength: query.length,
      documentLength: document.length,
      mode,
      realtime: options.realtime || false
    })
    
    try {
      const results = await strategy(query, document, options, signal)
      
      // End performance tracking
      const metric = performanceMonitor.endTimer(timerId)
      this.setState({ performance: metric })
      
      return results
      
    } catch (error) {
      performanceMonitor.endTimer(timerId)
      throw error
    }
  }

  /**
   * Search Strategies
   */
  async exactSearch(query, document, options, signal) {
    const normalizedDoc = createNormalizedDocument(document)
    const valueType = detectValueType(query)
    
    const matches = findValueInNormalizedDocument(query, valueType, normalizedDoc, document)
    
    return matches.map((match, index) => ({
      id: `exact-${Date.now()}-${index}`,
      label: `Přesná shoda - ${valueType}`,
      value: match.text,
      type: 'exact',
      confidence: 1.0,
      matches: [{
        start: match.start,
        end: match.end,
        text: match.text,
        score: 1.0,
        confidence: 1.0,
        id: `exact-match-${index}`,
        resultId: `exact-${Date.now()}-${index}`
      }]
    }))
  }

  async fuzzySearch(query, document, options, signal) {
    const fuzzyOptions = {
      minScore: options.minScore || 0.6,
      maxResults: options.maxResults || this.config.maxResults,
      contextLength: 50,
      algorithm: 'hybrid',
      ...options.fuzzyOptions
    }
    
    const matches = czechFuzzySearch(query, document, fuzzyOptions)
    
    return matches.map((match, index) => ({
      id: `fuzzy-${Date.now()}-${index}`,
      label: `Fuzzy shoda (${(match.score * 100).toFixed(1)}%)`,
      value: match.text,
      type: 'fuzzy',
      confidence: match.score,
      matches: [{
        start: match.start,
        end: match.end,
        text: match.text,
        score: match.score,
        confidence: match.score,
        id: `fuzzy-match-${index}`,
        resultId: `fuzzy-${Date.now()}-${index}`
      }]
    }))
  }

  async semanticSearch(query, document, options, signal) {
    const semanticOptions = {
      maxResults: options.maxResults || this.config.maxResults,
      minScore: options.minScore || 0.3,
      contextWindow: 100,
      ...options.semanticOptions
    }
    
    const results = intelligentSearch(query, document, semanticOptions)
    
    return results.map((result, index) => ({
      id: `semantic-${Date.now()}-${index}`,
      label: `Sémantická shoda (${result.primaryIntent})`,
      value: result.matches[0]?.term || 'No match',
      type: 'semantic',
      confidence: result.matches[0]?.score || 0,
      matches: result.matches.map((match, mIndex) => ({
        start: match.start || 0,
        end: match.end || 0,
        text: match.term,
        score: match.score,
        confidence: match.score,
        id: `semantic-match-${index}-${mIndex}`,
        resultId: `semantic-${Date.now()}-${index}`
      }))
    }))
  }

  async contractSearch(query, document, options, signal) {
    const contractOptions = {
      maxResults: options.maxResults || this.config.maxResults,
      confidenceThreshold: options.confidenceThreshold || 0.5,
      ...options.contractOptions
    }
    
    const contractResults = searchContractDocument(document, query, contractOptions)
    
    return contractResults.results.map((match, index) => ({
      id: `contract-${Date.now()}-${index}`,
      label: match.label,
      value: match.value,
      type: 'contract',
      confidence: match.confidence,
      context: match.context,
      matches: [{
        start: match.start,
        end: match.end,
        text: match.value,
        score: match.confidence,
        confidence: match.confidence,
        type: match.type,
        id: `contract-match-${index}`,
        resultId: `contract-${Date.now()}-${index}`
      }]
    }))
  }

  async intelligentSearch(query, document, options, signal) {
    const normalizedDoc = createNormalizedDocument(document)
    const combinedResults = []
    
    try {
      // 1. Exact matches
      const exactMatches = await this.exactSearch(query, document, options, signal)
      combinedResults.push(...exactMatches)
      
      // 2. Fuzzy matches (if no exact matches or if requested)
      if (exactMatches.length === 0 || options.includeFuzzy) {
        const fuzzyMatches = await this.fuzzySearch(query, document, {
          ...options,
          minScore: 0.5,
          maxResults: 5
        }, signal)
        combinedResults.push(...fuzzyMatches)
      }
      
      // 3. Semantic matches
      if (options.includeSemantic !== false) {
        const semanticMatches = await this.semanticSearch(query, document, {
          ...options,
          maxResults: 5,
          minScore: 0.3
        }, signal)
        combinedResults.push(...semanticMatches)
      }
      
      // 4. Contract-specific search if document looks like a contract
      if (this.isContractDocument(document)) {
        const contractMatches = await this.contractSearch(query, document, {
          ...options,
          maxResults: 3
        }, signal)
        combinedResults.push(...contractMatches)
      }
      
      // Rank and return best results
      return rankSearchResults(combinedResults, query, document, {
        maxResults: options.maxResults || this.config.maxResults,
        diversityBonus: true,
        groupSimilar: true,
        minScore: 0.1
      })
      
    } catch (error) {
      logger.error('SEARCH_WORKFLOW', 'Intelligent search failed', { error: error.message })
      throw error
    }
  }

  async hybridSearch(query, document, options, signal) {
    // Combine multiple strategies in parallel for best performance
    const promises = []
    
    // Always include exact search
    promises.push(this.exactSearch(query, document, options, signal))
    
    // Add other strategies based on query complexity
    const queryComplexity = this.analyzeQueryComplexity(query)
    
    if (queryComplexity.needsFuzzy) {
      promises.push(this.fuzzySearch(query, document, options, signal))
    }
    
    if (queryComplexity.needsSemantic) {
      promises.push(this.semanticSearch(query, document, options, signal))
    }
    
    if (queryComplexity.needsContract) {
      promises.push(this.contractSearch(query, document, options, signal))
    }
    
    // Execute searches in parallel
    const results = await Promise.allSettled(promises)
    
    // Combine successful results
    const combinedResults = []
    results.forEach((result) => {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        combinedResults.push(...result.value)
      }
    })
    
    // Rank and deduplicate
    return rankSearchResults(combinedResults, query, document, {
      maxResults: options.maxResults || this.config.maxResults,
      diversityBonus: true,
      groupSimilar: false,
      minScore: 0.2
    })
  }

  /**
   * Post-processing and validation
   */
  async postProcessResults(results, query, document, options) {
    if (!Array.isArray(results)) {
      return []
    }
    
    // Validate results
    const validatedResults = results.filter(result => this.validateSearchResult(result))
    
    // Add metadata
    const enhancedResults = validatedResults.map(result => ({
      ...result,
      timestamp: Date.now(),
      query: query,
      searchMode: options.mode || this.state.searchMode,
      relevanceScore: this.calculateRelevanceScore(result, query),
      processingTime: this.state.performance?.duration || 0
    }))
    
    // Sort by relevance
    enhancedResults.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    
    // Limit results
    const maxResults = options.maxResults || this.config.maxResults
    return enhancedResults.slice(0, maxResults)
  }

  /**
   * Cache management
   */
  async checkCache(query, document, options) {
    if (!this.config.enableCaching || options.bypassCache) {
      return null
    }
    
    const cacheKey = createQueryHash(query, document)
    const cachedResults = searchCache.get(`search-${cacheKey}`)
    
    if (cachedResults) {
      logger.debug('SEARCH_WORKFLOW', 'Cache hit', { query, cacheKey })
      return cachedResults
    }
    
    return null
  }

  async cacheResults(results, query, document) {
    if (!this.config.enableCaching) {
      return
    }
    
    try {
      const cacheKey = createQueryHash(query, document)
      searchCache.set(`search-${cacheKey}`, results)
      logger.debug('SEARCH_WORKFLOW', 'Results cached', { query, cacheKey, resultCount: results.length })
    } catch (error) {
      logger.warn('SEARCH_WORKFLOW', 'Cache storage failed', { error: error.message })
    }
  }

  /**
   * Error handling and recovery
   */
  handleSearchError(error, query, document, searchId, startTime) {
    const duration = Date.now() - startTime
    
    logger.error('SEARCH_WORKFLOW', 'Search failed', {
      error: error.message,
      query,
      searchId,
      duration,
      mode: this.state.searchMode
    })
    
    // Try fallback strategies if enabled
    if (this.config.enableFallbackStrategies && !error.message.includes('timeout')) {
      return this.attemptFallbackSearch(query, document, searchId, startTime)
    }
    
    this.setState({
      errors: [...this.state.errors, error.message],
      isSearching: false
    })
    
    this.emitStateChange('search_error', {
      searchId,
      error: error.message,
      duration,
      fallbackAttempted: false
    })
    
    return {
      success: false,
      error: error.message,
      searchId,
      duration,
      fallbackAvailable: this.config.enableFallbackStrategies
    }
  }

  async attemptFallbackSearch(query, document, searchId, startTime) {
    try {
      logger.info('SEARCH_WORKFLOW', 'Attempting fallback search', { searchId })
      
      // Try simpler exact search as fallback
      const fallbackResults = await this.exactSearch(query, document, { fallback: true })
      
      this.setState({
        results: fallbackResults,
        warnings: [...this.state.warnings, 'Použito zjednodušené vyhledávání kvůli chybě']
      })
      
      this.emitStateChange('search_fallback_success', {
        searchId,
        results: fallbackResults,
        duration: Date.now() - startTime
      })
      
      return {
        success: true,
        results: fallbackResults,
        searchId,
        fallback: true,
        warnings: this.state.warnings
      }
      
    } catch (fallbackError) {
      logger.error('SEARCH_WORKFLOW', 'Fallback search failed', {
        error: fallbackError.message,
        searchId
      })
      
      return this.handleSearchError(fallbackError, query, document, searchId, startTime)
    }
  }

  /**
   * Helper methods
   */
  validateSearchInput(query, document) {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Dotaz je povinný a musí obsahovat text')
    }
    
    if (!document || typeof document !== 'string' || document.trim().length === 0) {
      throw new Error('Dokument je povinný a musí obsahovat text')
    }
    
    if (query.length > 1000) {
      throw new Error('Dotaz je příliš dlouhý (maximum 1000 znaků)')
    }
    
    if (document.length > 1000000) { // 1MB limit
      throw new Error('Dokument je příliš velký (maximum 1MB)')
    }
  }

  validateSearchResult(result) {
    return result &&
           typeof result === 'object' &&
           result.id &&
           (result.value || result.content) &&
           Array.isArray(result.matches)
  }

  calculateRelevanceScore(result, query) {
    let score = result.confidence || 0
    
    // Boost exact matches
    if (result.type === 'exact') {
      score += 0.2
    }
    
    // Boost if query appears in value
    if (result.value && result.value.toLowerCase().includes(query.toLowerCase())) {
      score += 0.1
    }
    
    return Math.min(1.0, score)
  }

  isContractDocument(document) {
    const contractKeywords = [
      'smlouva', 'kupní', 'prodej', 'smluvní', 'strana', 'článek',
      'kupující', 'prodávající', 'závazek', 'práva', 'povinnosti'
    ]
    
    const lowerDoc = document.toLowerCase()
    const keywordCount = contractKeywords.filter(keyword => lowerDoc.includes(keyword)).length
    
    return keywordCount >= 3
  }

  analyzeQueryComplexity(query) {
    const lowerQuery = query.toLowerCase()
    
    return {
      needsFuzzy: query.length < 50 && !(/^\d+$/.test(query)), // Short non-numeric queries
      needsSemantic: lowerQuery.includes(' ') || query.length > 20, // Multi-word or long queries
      needsContract: /smlouva|cena|částka|prodávající|kupující|strana/.test(lowerQuery)
    }
  }

  createSearchTimeout() {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Vyhledávání překročilo časový limit'))
      }, this.config.searchTimeout)
    })
  }

  abortOngoingSearch() {
    if (this.abortController) {
      this.abortController.abort()
    }
  }

  generateSearchId() {
    return `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
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

  loadSearchHistory() {
    try {
      const saved = localStorage.getItem('searchHistory')
      if (saved) {
        this.setState({ searchHistory: JSON.parse(saved) })
      }
    } catch (error) {
      logger.warn('SEARCH_WORKFLOW', 'Failed to load search history', { error: error.message })
    }
  }

  saveSearchHistory() {
    try {
      localStorage.setItem('searchHistory', JSON.stringify(this.state.searchHistory))
    } catch (error) {
      logger.warn('SEARCH_WORKFLOW', 'Failed to save search history', { error: error.message })
    }
  }

  addToHistory(query, results) {
    const historyEntry = {
      query,
      timestamp: new Date().toISOString(),
      id: Date.now(),
      resultCount: results.length,
      searchMode: this.state.searchMode
    }
    
    const newHistory = [historyEntry, ...this.state.searchHistory]
      .slice(0, this.config.maxHistoryItems)
    
    this.setState({ searchHistory: newHistory })
    this.saveSearchHistory()
  }

  async handleSuccessfulSearch(results, query, document, searchId, startTime) {
    const duration = Date.now() - startTime
    
    this.setState({
      results,
      lastSearchTime: startTime,
      errors: []
    })
    
    // Cache results
    await this.cacheResults(results, query, document)
    
    // Add to history
    this.addToHistory(query, results)
    
    // Emit success event
    this.emitStateChange('search_success', {
      searchId,
      results,
      duration,
      resultCount: results.length,
      cached: false
    })
    
    logger.info('SEARCH_WORKFLOW', 'Search completed successfully', {
      searchId,
      query,
      resultCount: results.length,
      duration,
      mode: this.state.searchMode
    })
  }

  handleCachedResults(results, searchId, startTime) {
    const duration = Date.now() - startTime
    
    this.setState({
      results,
      isSearching: false,
      lastSearchTime: startTime
    })
    
    this.emitStateChange('search_success', {
      searchId,
      results,
      duration,
      resultCount: results.length,
      cached: true
    })
    
    logger.info('SEARCH_WORKFLOW', 'Search completed from cache', {
      searchId,
      resultCount: results.length,
      duration
    })
    
    return {
      success: true,
      results,
      searchId,
      cached: true,
      duration
    }
  }

  setupPerformanceMonitoring() {
    // Monitor search performance metrics
    this.addListener((event) => {
      if (event.event === 'search_success') {
        const { duration, resultCount, cached } = event
        
        // Log performance metrics
        logger.info('SEARCH_PERFORMANCE', 'Search metrics', {
          duration,
          resultCount,
          cached,
          mode: this.state.searchMode,
          queryLength: this.state.currentQuery.length,
          documentLength: this.state.currentDocument.length
        })
        
        // Alert on slow searches
        if (duration > 5000 && !cached) {
          this.setState({
            warnings: [...this.state.warnings, `Vyhledávání trvalo ${duration}ms - zvažte zjednodušení dotazu`]
          })
        }
      }
    })
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
        logger.error('SEARCH_WORKFLOW', 'Listener error', { error: error.message })
      }
    })
  }

  /**
   * Public API
   */
  setSearchMode(mode) {
    if (this.searchStrategies.has(mode)) {
      this.setState({ searchMode: mode })
      logger.info('SEARCH_WORKFLOW', 'Search mode changed', { mode })
    } else {
      throw new Error(`Invalid search mode: ${mode}`)
    }
  }

  getSearchModes() {
    return Array.from(this.searchStrategies.keys())
  }

  clearHistory() {
    this.setState({ searchHistory: [] })
    try {
      localStorage.removeItem('searchHistory')
    } catch (error) {
      logger.warn('SEARCH_WORKFLOW', 'Failed to clear history storage', { error: error.message })
    }
  }

  clearCache() {
    searchCache.clear()
    logger.info('SEARCH_WORKFLOW', 'Search cache cleared')
  }

  getPerformanceStats() {
    return {
      lastSearchDuration: this.state.performance?.duration,
      cacheStats: searchCache.getStats(),
      historySize: this.state.searchHistory.length,
      errorCount: this.state.errors.length,
      warningCount: this.state.warnings.length
    }
  }
}

// Create singleton instance
export const searchWorkflow = new SearchWorkflow()

// Export convenience functions
export const search = (query, document, options) => searchWorkflow.search(query, document, options)
export const searchRealtime = (query, document, options) => searchWorkflow.searchRealtime(query, document, options)
export const setSearchMode = (mode) => searchWorkflow.setSearchMode(mode)
export const getSearchState = () => searchWorkflow.getState()
export const addSearchListener = (listener) => searchWorkflow.addListener(listener)

export default searchWorkflow