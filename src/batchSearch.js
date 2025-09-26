import { 
  intelligentSearch, 
  semanticSearch,
  expandQuery,
  detectIntent 
} from './semanticSearch'
import { 
  findFuzzyMatches, 
  czechFuzzySearch,
  realtimeFuzzySearch
} from './fuzzySearch'
import { 
  searchContractDocument,
  analyzeContractDocument
} from './contractAnalyzer'
import { 
  createNormalizedDocument,
  findValueInNormalizedDocument,
  detectValueType
} from './documentNormalizer'
import { 
  rankSearchResults,
  calculateRelevanceScore
} from './intelligentRanking'
import { 
  performanceMonitor,
  searchCache,
  createQueryHash
} from './performanceOptimizer'

/**
 * Batch Search System for Multiple Queries
 * Enables processing multiple search queries efficiently with progress tracking
 */

export class BatchSearchSystem {
  constructor() {
    this.isRunning = false
    this.currentBatch = null
    this.progressCallback = null
    this.batchHistory = []
    this.defaultOptions = {
      searchMode: 'intelligent',
      maxResults: 10,
      confidenceThreshold: 0.5,
      enableCaching: true,
      parallel: false,
      batchSize: 5,
      delayBetweenQueries: 100,
      prioritizeAccuracy: true
    }
  }

  /**
   * Execute batch search with multiple queries
   */
  async executeBatchSearch(queries, document, options = {}) {
    if (this.isRunning) {
      throw new Error('Batch search is already running')
    }

    const mergedOptions = { ...this.defaultOptions, ...options }
    this.isRunning = true
    
    const batchId = `batch-${Date.now()}`
    const startTime = Date.now()
    
    this.currentBatch = {
      id: batchId,
      queries: Array.isArray(queries) ? queries : [queries],
      document,
      options: mergedOptions,
      startTime,
      status: 'running',
      results: [],
      errors: [],
      progress: 0
    }

    try {
      // Normalize and prepare document once for all queries
      const normalizedDoc = createNormalizedDocument(document)
      
      // Execute searches based on parallel/sequential mode
      let results
      if (mergedOptions.parallel) {
        results = await this.executeParallelSearch(normalizedDoc)
      } else {
        results = await this.executeSequentialSearch(normalizedDoc)
      }

      // Post-process and rank all results
      const processedResults = await this.postProcessBatchResults(results, mergedOptions)
      
      this.currentBatch.results = processedResults
      this.currentBatch.status = 'completed'
      this.currentBatch.duration = Date.now() - startTime
      
      // Add to history
      this.batchHistory.unshift({
        ...this.currentBatch,
        summary: this.generateBatchSummary(processedResults)
      })
      
      // Keep only last 10 batch executions
      if (this.batchHistory.length > 10) {
        this.batchHistory = this.batchHistory.slice(0, 10)
      }

      return {
        success: true,
        batchId,
        results: processedResults,
        summary: this.generateBatchSummary(processedResults),
        duration: this.currentBatch.duration,
        errors: this.currentBatch.errors
      }

    } catch (error) {
      this.currentBatch.status = 'failed'
      this.currentBatch.error = error.message
      throw error
    } finally {
      this.isRunning = false
    }
  }

  /**
   * Execute searches in parallel for faster processing
   */
  async executeParallelSearch(normalizedDoc) {
    const { queries, document, options } = this.currentBatch
    const batchSize = options.batchSize || 5
    
    const results = []
    
    // Process queries in batches to avoid overwhelming the system
    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (query, index) => {
        try {
          const globalIndex = i + index
          this.updateProgress(globalIndex, queries.length)
          
          return await this.executeSignleQuery(query, document, normalizedDoc, options, globalIndex)
        } catch (error) {
          this.currentBatch.errors.push({
            query,
            error: error.message,
            index: i + index
          })
          return null
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults.filter(Boolean))
      
      // Small delay between batches to prevent overwhelming
      if (i + batchSize < queries.length) {
        await new Promise(resolve => setTimeout(resolve, options.delayBetweenQueries))
      }
    }

    return results
  }

  /**
   * Execute searches sequentially for better error handling
   */
  async executeSequentialSearch(normalizedDoc) {
    const { queries, document, options } = this.currentBatch
    const results = []

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i]
      
      try {
        this.updateProgress(i, queries.length)
        
        const result = await this.executeSignleQuery(query, document, normalizedDoc, options, i)
        if (result) {
          results.push(result)
        }

        // Delay between queries if specified
        if (options.delayBetweenQueries && i < queries.length - 1) {
          await new Promise(resolve => setTimeout(resolve, options.delayBetweenQueries))
        }

      } catch (error) {
        this.currentBatch.errors.push({
          query,
          error: error.message,
          index: i
        })
        
        // Continue with other queries unless critical error
        if (!options.stopOnError) {
          continue
        } else {
          throw error
        }
      }
    }

    return results
  }

  /**
   * Execute a single query with performance monitoring
   */
  async executeSignleQuery(query, document, normalizedDoc, options, index) {
    const timerId = performanceMonitor.startTimer(`batch-query-${index}`, {
      query,
      searchMode: options.searchMode,
      batchIndex: index
    })

    try {
      // Check cache first if enabled
      if (options.enableCaching) {
        const cacheKey = createQueryHash(query, document)
        const cachedResults = searchCache.get(`search-${cacheKey}`)
        
        if (cachedResults) {
          return {
            query,
            results: cachedResults,
            cached: true,
            index
          }
        }
      }

      let searchResults = []

      // Execute search based on mode
      switch (options.searchMode) {
        case 'contract':
          const contractResults = searchContractDocument(document, query, {
            maxResults: options.maxResults,
            confidenceThreshold: options.confidenceThreshold
          })
          searchResults = contractResults.results
          break

        case 'semantic':
          searchResults = intelligentSearch(query, document, {
            maxResults: options.maxResults,
            minScore: options.confidenceThreshold,
            contextWindow: 100
          })
          break

        case 'fuzzy':
          const fuzzyResults = czechFuzzySearch(query, document, {
            minScore: options.confidenceThreshold,
            maxResults: options.maxResults,
            contextLength: 50
          })
          searchResults = fuzzyResults.map(match => ({
            label: `Fuzzy match (${(match.score * 100).toFixed(1)}%)`,
            value: match.text,
            confidence: match.score,
            start: match.start,
            end: match.end,
            type: 'fuzzy'
          }))
          break

        case 'intelligent':
        default:
          // Combination approach
          const exactMatches = findValueInNormalizedDocument(
            query,
            detectValueType(query),
            normalizedDoc,
            document
          )

          const fuzzyMatches = findFuzzyMatches(query, document, {
            minScore: 0.5,
            maxResults: 5,
            algorithm: 'hybrid'
          })

          const semanticMatches = intelligentSearch(query, document, {
            maxResults: 5,
            minScore: 0.3
          })

          // Combine and rank all results
          const combinedResults = []
          
          exactMatches.forEach((match, idx) => {
            combinedResults.push({
              id: `exact-${index}-${idx}`,
              label: `Exact match - ${detectValueType(match.text)}`,
              value: match.text,
              confidence: 1.0,
              start: match.start,
              end: match.end,
              type: 'exact',
              query
            })
          })

          fuzzyMatches.forEach((match, idx) => {
            combinedResults.push({
              id: `fuzzy-${index}-${idx}`,
              label: `Fuzzy match (${(match.score * 100).toFixed(1)}%)`,
              value: match.text,
              confidence: match.score,
              start: match.start,
              end: match.end,
              type: 'fuzzy',
              query
            })
          })

          semanticMatches.forEach((result, idx) => {
            if (result.matches && result.matches.length > 0) {
              result.matches.forEach((match, mIdx) => {
                combinedResults.push({
                  id: `semantic-${index}-${idx}-${mIdx}`,
                  label: `Semantic match (${result.primaryIntent})`,
                  value: match.term,
                  confidence: match.score,
                  start: match.start || 0,
                  end: match.end || 0,
                  type: 'semantic',
                  query
                })
              })
            }
          })

          searchResults = rankSearchResults(combinedResults, query, document, {
            maxResults: options.maxResults,
            diversityBonus: true,
            minScore: options.confidenceThreshold
          })
          break
      }

      // Cache results if enabled
      if (options.enableCaching && searchResults.length > 0) {
        const cacheKey = createQueryHash(query, document)
        searchCache.set(`search-${cacheKey}`, searchResults)
      }

      return {
        query,
        results: searchResults,
        cached: false,
        index
      }

    } finally {
      performanceMonitor.endTimer(timerId)
    }
  }

  /**
   * Post-process batch results for consistency and ranking
   */
  async postProcessBatchResults(results, options) {
    const allResults = []
    const queryMap = new Map()

    // Organize results by query
    results.forEach(result => {
      if (!queryMap.has(result.query)) {
        queryMap.set(result.query, [])
      }
      queryMap.get(result.query).push(...result.results)
    })

    // Process each query's results
    for (const [query, queryResults] of queryMap) {
      const processedResults = queryResults.map((result, index) => ({
        ...result,
        id: result.id || `${query}-${index}`,
        batchQuery: query,
        extractedAt: new Date().toISOString(),
        batchIndex: results.findIndex(r => r.query === query)
      }))

      allResults.push({
        query,
        results: processedResults,
        count: processedResults.length,
        avgConfidence: this.calculateAverageConfidence(processedResults),
        topResult: processedResults[0] || null
      })
    }

    return allResults
  }

  /**
   * Generate batch execution summary
   */
  generateBatchSummary(results) {
    const totalResults = results.reduce((sum, r) => sum + r.count, 0)
    const totalQueries = results.length
    const avgResultsPerQuery = totalResults / totalQueries
    const avgConfidence = results.reduce((sum, r) => sum + (r.avgConfidence || 0), 0) / totalQueries

    const typeDistribution = {}
    const confidenceDistribution = { high: 0, medium: 0, low: 0 }

    results.forEach(queryResult => {
      queryResult.results.forEach(result => {
        const type = result.type || 'unknown'
        typeDistribution[type] = (typeDistribution[type] || 0) + 1

        const confidence = result.confidence || 0
        if (confidence > 0.8) confidenceDistribution.high++
        else if (confidence > 0.5) confidenceDistribution.medium++
        else confidenceDistribution.low++
      })
    })

    return {
      totalQueries,
      totalResults,
      avgResultsPerQuery: Number(avgResultsPerQuery.toFixed(1)),
      avgConfidence: Number(avgConfidence.toFixed(3)),
      typeDistribution,
      confidenceDistribution,
      successRate: Number(((totalQueries - this.currentBatch.errors.length) / totalQueries * 100).toFixed(1)),
      processingTime: this.currentBatch.duration
    }
  }

  /**
   * Utility methods
   */
  updateProgress(current, total) {
    const progress = Math.round((current / total) * 100)
    this.currentBatch.progress = progress
    
    if (this.progressCallback) {
      this.progressCallback({
        current,
        total,
        progress,
        query: this.currentBatch.queries[current],
        status: this.currentBatch.status
      })
    }
  }

  calculateAverageConfidence(results) {
    if (results.length === 0) return 0
    
    const confidences = results
      .map(r => r.confidence)
      .filter(c => typeof c === 'number')
    
    if (confidences.length === 0) return 0
    
    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length
  }

  /**
   * Control methods
   */
  setProgressCallback(callback) {
    this.progressCallback = callback
  }

  getCurrentBatch() {
    return this.currentBatch
  }

  getBatchHistory() {
    return this.batchHistory
  }

  cancelCurrentBatch() {
    if (this.isRunning && this.currentBatch) {
      this.currentBatch.status = 'cancelled'
      this.isRunning = false
      return true
    }
    return false
  }

  /**
   * Predefined batch configurations
   */
  static getPresetConfigurations() {
    return {
      contractAnalysis: {
        searchMode: 'contract',
        maxResults: 5,
        confidenceThreshold: 0.6,
        parallel: false,
        prioritizeAccuracy: true
      },
      
      comprehensiveSearch: {
        searchMode: 'intelligent',
        maxResults: 10,
        confidenceThreshold: 0.3,
        parallel: true,
        batchSize: 3
      },
      
      fastFuzzySearch: {
        searchMode: 'fuzzy',
        maxResults: 15,
        confidenceThreshold: 0.5,
        parallel: true,
        batchSize: 10,
        delayBetweenQueries: 50
      },
      
      semanticAnalysis: {
        searchMode: 'semantic',
        maxResults: 8,
        confidenceThreshold: 0.4,
        parallel: false,
        delayBetweenQueries: 200
      }
    }
  }

  /**
   * Create common batch query sets
   */
  static generateCommonQuerySets() {
    return {
      personalData: [
        'jméno',
        'rodné číslo',
        'adresa',
        'telefon',
        'email',
        'datum narození'
      ],
      
      contractTerms: [
        'kupní cena',
        'datum podpisu',
        'účinnost smlouvy',
        'vypovědní lhůta',
        'sankce',
        'úroky'
      ],
      
      legalEntities: [
        'prodávající',
        'kupující',
        'společnost',
        'IČO',
        'DIČ',
        'sídlo'
      ],
      
      financialData: [
        'částka',
        'cena',
        'poplatek',
        'úhrada',
        'splátka',
        'úrok',
        'RPSN'
      ],
      
      propertyData: [
        'parcela',
        'pozemek',
        'stavba',
        'katastrální území',
        'výměra',
        'LV'
      ]
    }
  }
}

// Export singleton instance
export const batchSearchSystem = new BatchSearchSystem()

// Export convenience functions
export const executeBatchSearch = (queries, document, options) => 
  batchSearchSystem.executeBatchSearch(queries, document, options)

export const getBatchHistory = () => batchSearchSystem.getBatchHistory()

export const cancelBatch = () => batchSearchSystem.cancelCurrentBatch()

export default batchSearchSystem