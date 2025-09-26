import { detectValueType, validators } from './documentNormalizer'

/**
 * Data Aggregation and Summary System
 * Provides comprehensive analysis and aggregation of search results
 */

export class DataAggregationSystem {
  constructor() {
    this.aggregationTypes = [
      'summary',
      'distribution',
      'confidence',
      'temporal',
      'geographical',
      'financial',
      'legal'
    ]
  }

  /**
   * Generate comprehensive data summary
   */
  generateComprehensiveSummary(searchResults, options = {}) {
    const startTime = Date.now()
    
    try {
      const summary = {
        metadata: this.generateMetadata(searchResults),
        overview: this.generateOverview(searchResults),
        dataTypes: this.analyzeDataTypes(searchResults),
        confidence: this.analyzeConfidence(searchResults),
        distribution: this.analyzeDistribution(searchResults),
        patterns: this.detectPatterns(searchResults),
        quality: this.assessDataQuality(searchResults),
        insights: this.generateInsights(searchResults),
        recommendations: this.generateRecommendations(searchResults),
        executionTime: Date.now() - startTime
      }

      // Add specific analyses based on detected content
      if (this.hasFinancialData(searchResults)) {
        summary.financial = this.analyzeFinancialData(searchResults)
      }

      if (this.hasPersonalData(searchResults)) {
        summary.personal = this.analyzePersonalData(searchResults)
      }

      if (this.hasContractData(searchResults)) {
        summary.contract = this.analyzeContractData(searchResults)
      }

      return summary
    } catch (error) {
      console.error('Summary generation error:', error)
      return {
        error: true,
        message: error.message,
        basicStats: this.generateBasicStats(searchResults)
      }
    }
  }

  /**
   * Generate metadata about the dataset
   */
  generateMetadata(searchResults) {
    return {
      totalRecords: searchResults.length,
      generatedAt: new Date().toISOString(),
      dataSource: 'AI Search Results',
      version: '1.0.0',
      uniqueQueries: new Set(searchResults.map(r => r.batchQuery || r.query || 'unknown')).size,
      hasMatches: searchResults.filter(r => r.matches && r.matches.length > 0).length,
      averageMatchesPerResult: this.calculateAverageMatches(searchResults)
    }
  }

  /**
   * Generate high-level overview
   */
  generateOverview(searchResults) {
    const values = searchResults.map(r => r.value).filter(Boolean)
    const types = searchResults.map(r => r.type).filter(Boolean)
    const confidences = searchResults.map(r => r.confidence).filter(c => typeof c === 'number')

    return {
      totalValues: values.length,
      uniqueValues: new Set(values).size,
      duplicateRate: ((values.length - new Set(values).size) / values.length * 100).toFixed(1),
      typeVariety: new Set(types).size,
      averageConfidence: confidences.length > 0 
        ? (confidences.reduce((sum, c) => sum + c, 0) / confidences.length).toFixed(3)
        : 0,
      completeness: ((searchResults.filter(r => r.value && r.value.trim()).length / searchResults.length) * 100).toFixed(1)
    }
  }

  /**
   * Analyze data types distribution
   */
  analyzeDataTypes(searchResults) {
    const typeDistribution = {}
    const typeExamples = {}
    const typeConfidences = {}

    searchResults.forEach(result => {
      const type = result.type || this.detectValueType(result.value) || 'unknown'
      
      // Count distribution
      typeDistribution[type] = (typeDistribution[type] || 0) + 1
      
      // Collect examples
      if (!typeExamples[type]) {
        typeExamples[type] = []
      }
      if (typeExamples[type].length < 3 && result.value) {
        typeExamples[type].push(result.value)
      }
      
      // Track confidences
      if (!typeConfidences[type]) {
        typeConfidences[type] = []
      }
      if (typeof result.confidence === 'number') {
        typeConfidences[type].push(result.confidence)
      }
    })

    // Calculate statistics for each type
    const typeAnalysis = {}
    Object.keys(typeDistribution).forEach(type => {
      const confidences = typeConfidences[type] || []
      typeAnalysis[type] = {
        count: typeDistribution[type],
        percentage: ((typeDistribution[type] / searchResults.length) * 100).toFixed(1),
        examples: typeExamples[type] || [],
        avgConfidence: confidences.length > 0 
          ? (confidences.reduce((sum, c) => sum + c, 0) / confidences.length).toFixed(3)
          : 0,
        minConfidence: confidences.length > 0 ? Math.min(...confidences).toFixed(3) : 0,
        maxConfidence: confidences.length > 0 ? Math.max(...confidences).toFixed(3) : 0
      }
    })

    return {
      distribution: typeDistribution,
      analysis: typeAnalysis,
      mostCommon: Object.entries(typeDistribution)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([type, count]) => ({ type, count })),
      rareTypes: Object.entries(typeDistribution)
        .filter(([,count]) => count === 1)
        .map(([type]) => type)
    }
  }

  /**
   * Analyze confidence patterns
   */
  analyzeConfidence(searchResults) {
    const confidences = searchResults
      .map(r => r.confidence)
      .filter(c => typeof c === 'number')

    if (confidences.length === 0) {
      return { noData: true }
    }

    const sorted = confidences.sort((a, b) => a - b)
    const mean = confidences.reduce((sum, c) => sum + c, 0) / confidences.length
    const median = sorted[Math.floor(sorted.length / 2)]
    const variance = confidences.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / confidences.length
    const stdDev = Math.sqrt(variance)

    // Confidence distribution
    const distribution = {
      high: confidences.filter(c => c > 0.8).length,
      medium: confidences.filter(c => c > 0.5 && c <= 0.8).length,
      low: confidences.filter(c => c <= 0.5).length
    }

    return {
      count: confidences.length,
      mean: Number(mean.toFixed(3)),
      median: Number(median.toFixed(3)),
      min: Number(Math.min(...confidences).toFixed(3)),
      max: Number(Math.max(...confidences).toFixed(3)),
      standardDeviation: Number(stdDev.toFixed(3)),
      distribution,
      distributionPercentages: {
        high: Number((distribution.high / confidences.length * 100).toFixed(1)),
        medium: Number((distribution.medium / confidences.length * 100).toFixed(1)),
        low: Number((distribution.low / confidences.length * 100).toFixed(1))
      }
    }
  }

  /**
   * Analyze value distribution patterns
   */
  analyzeDistribution(searchResults) {
    const values = searchResults.map(r => r.value).filter(Boolean)
    const valueCounts = {}
    
    values.forEach(value => {
      valueCounts[value] = (valueCounts[value] || 0) + 1
    })

    const duplicates = Object.entries(valueCounts)
      .filter(([,count]) => count > 1)
      .sort(([,a], [,b]) => b - a)

    const lengthDistribution = {}
    values.forEach(value => {
      const length = String(value).length
      const range = this.getLengthRange(length)
      lengthDistribution[range] = (lengthDistribution[range] || 0) + 1
    })

    return {
      uniqueValues: Object.keys(valueCounts).length,
      totalValues: values.length,
      duplicates: duplicates.slice(0, 10).map(([value, count]) => ({ value, count })),
      duplicateRate: Number(((values.length - Object.keys(valueCounts).length) / values.length * 100).toFixed(1)),
      lengthDistribution,
      averageLength: Number((values.reduce((sum, v) => sum + String(v).length, 0) / values.length).toFixed(1))
    }
  }

  /**
   * Detect patterns in the data
   */
  detectPatterns(searchResults) {
    const patterns = {
      temporal: this.detectTemporalPatterns(searchResults),
      sequential: this.detectSequentialPatterns(searchResults),
      format: this.detectFormatPatterns(searchResults),
      linguistic: this.detectLinguisticPatterns(searchResults)
    }

    return patterns
  }

  /**
   * Assess overall data quality
   */
  assessDataQuality(searchResults) {
    const metrics = {
      completeness: this.calculateCompleteness(searchResults),
      accuracy: this.calculateAccuracy(searchResults),
      consistency: this.calculateConsistency(searchResults),
      validity: this.calculateValidity(searchResults)
    }

    const overallScore = Object.values(metrics).reduce((sum, score) => sum + score, 0) / Object.keys(metrics).length

    return {
      ...metrics,
      overallScore: Number(overallScore.toFixed(3)),
      grade: this.getQualityGrade(overallScore),
      issues: this.identifyQualityIssues(searchResults, metrics)
    }
  }

  /**
   * Generate actionable insights
   */
  generateInsights(searchResults) {
    const insights = []

    // Confidence insights
    const confidenceAnalysis = this.analyzeConfidence(searchResults)
    if (confidenceAnalysis.distributionPercentages?.low > 30) {
      insights.push({
        type: 'warning',
        category: 'confidence',
        message: `${confidenceAnalysis.distributionPercentages.low}% of results have low confidence. Consider refining search queries.`,
        impact: 'medium'
      })
    }

    // Type diversity insights
    const typeAnalysis = this.analyzeDataTypes(searchResults)
    if (typeAnalysis.analysis && Object.keys(typeAnalysis.analysis).length < 3) {
      insights.push({
        type: 'info',
        category: 'diversity',
        message: 'Limited data type diversity detected. Document may contain specific type of information.',
        impact: 'low'
      })
    }

    // Duplicate insights
    const distribution = this.analyzeDistribution(searchResults)
    if (distribution.duplicateRate > 20) {
      insights.push({
        type: 'warning',
        category: 'duplicates',
        message: `High duplicate rate (${distribution.duplicateRate}%). Consider deduplication strategies.`,
        impact: 'medium'
      })
    }

    // Performance insights
    const avgMatches = this.calculateAverageMatches(searchResults)
    if (avgMatches < 1) {
      insights.push({
        type: 'warning',
        category: 'performance',
        message: 'Low average matches per result. Search strategies may need optimization.',
        impact: 'high'
      })
    }

    return insights
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(searchResults) {
    const recommendations = []
    const quality = this.assessDataQuality(searchResults)

    if (quality.overallScore < 0.7) {
      recommendations.push({
        priority: 'high',
        category: 'quality',
        title: 'Improve Data Quality',
        description: 'Overall data quality score is below optimal threshold.',
        actions: [
          'Review search queries for better specificity',
          'Implement data validation rules',
          'Consider using multiple search strategies'
        ]
      })
    }

    const confidenceAnalysis = this.analyzeConfidence(searchResults)
    if (confidenceAnalysis.mean < 0.6) {
      recommendations.push({
        priority: 'medium',
        category: 'confidence',
        title: 'Enhance Search Accuracy',
        description: 'Average confidence is lower than expected.',
        actions: [
          'Use more specific search terms',
          'Combine multiple search methods',
          'Implement fuzzy matching for better coverage'
        ]
      })
    }

    const typeAnalysis = this.analyzeDataTypes(searchResults)
    const hasPersonalData = Object.keys(typeAnalysis.distribution).some(type => 
      ['birthNumber', 'name', 'phone', 'email'].includes(type)
    )

    if (hasPersonalData) {
      recommendations.push({
        priority: 'high',
        category: 'privacy',
        title: 'Personal Data Protection',
        description: 'Personal data detected in results.',
        actions: [
          'Implement data anonymization',
          'Ensure GDPR compliance',
          'Add data retention policies'
        ]
      })
    }

    return recommendations
  }

  /**
   * Specialized analysis for financial data
   */
  analyzeFinancialData(searchResults) {
    const financialData = searchResults.filter(r => 
      this.isFinancialValue(r.value) || 
      ['currency', 'amount', 'financial'].includes(r.type)
    )

    if (financialData.length === 0) return null

    const amounts = financialData
      .map(r => this.extractNumericValue(r.value))
      .filter(n => !isNaN(n))

    return {
      count: financialData.length,
      totalAmount: amounts.reduce((sum, amount) => sum + amount, 0),
      averageAmount: amounts.length > 0 ? amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length : 0,
      minAmount: Math.min(...amounts),
      maxAmount: Math.max(...amounts),
      currencies: this.extractCurrencies(financialData),
      amountRanges: this.categorizeAmounts(amounts)
    }
  }

  /**
   * Specialized analysis for personal data
   */
  analyzePersonalData(searchResults) {
    const personalData = searchResults.filter(r => 
      ['birthNumber', 'name', 'phone', 'email', 'address'].includes(r.type) ||
      this.isPersonalValue(r.value)
    )

    if (personalData.length === 0) return null

    return {
      count: personalData.length,
      types: this.groupByType(personalData),
      privacyRisk: this.assessPrivacyRisk(personalData),
      recommendations: this.getPersonalDataRecommendations(personalData)
    }
  }

  /**
   * Specialized analysis for contract data
   */
  analyzeContractData(searchResults) {
    const contractData = searchResults.filter(r => 
      ['contract', 'legal', 'agreement'].includes(r.type) ||
      this.isContractValue(r.value)
    )

    if (contractData.length === 0) return null

    return {
      count: contractData.length,
      parties: this.extractParties(contractData),
      dates: this.extractDates(contractData),
      terms: this.extractTerms(contractData),
      completeness: this.assessContractCompleteness(contractData)
    }
  }

  /**
   * Helper methods
   */
  detectValueType(value) {
    if (!value) return 'unknown'
    
    const str = String(value).trim()
    if (/^\\d{6}\\/\\d{3,4}$/.test(str)) return 'birthNumber'
    if (/^\\d+(?:[.,]\\d+)?\\s*(?:Kč|CZK|€|EUR)$/i.test(str)) return 'currency'
    if (/^(\\+420\\s?)?\\d{3}\\s?\\d{3}\\s?\\d{3}$/.test(str)) return 'phone'
    if (/^[A-Z][a-z]+\\s+[A-Z][a-z]+$/.test(str)) return 'name'
    if (/^\\d+$/.test(str)) return 'number'
    if (/^\\d+\\/\\d+$/.test(str)) return 'fraction'
    if (/\\b\\d{1,2}[.\\/]\\d{1,2}[.\\/]\\d{2,4}\\b/.test(str)) return 'date'
    
    return 'text'
  }

  calculateAverageMatches(searchResults) {
    const matchCounts = searchResults
      .map(r => r.matchCount || (r.matches ? r.matches.length : 0))
      .filter(count => count > 0)
    
    return matchCounts.length > 0 ? matchCounts.reduce((sum, count) => sum + count, 0) / matchCounts.length : 0
  }

  getLengthRange(length) {
    if (length <= 5) return 'very-short'
    if (length <= 15) return 'short'
    if (length <= 50) return 'medium'
    if (length <= 100) return 'long'
    return 'very-long'
  }

  calculateCompleteness(searchResults) {
    const completeResults = searchResults.filter(r => 
      r.value && r.value.toString().trim() && r.type && typeof r.confidence === 'number'
    )
    return completeResults.length / searchResults.length
  }

  calculateAccuracy(searchResults) {
    const confidences = searchResults
      .map(r => r.confidence)
      .filter(c => typeof c === 'number')
    
    return confidences.length > 0 ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length : 0
  }

  calculateConsistency(searchResults) {
    // Measure consistency based on type prediction accuracy
    const typeConsistency = searchResults.filter(r => {
      if (!r.value || !r.type) return false
      const detectedType = this.detectValueType(r.value)
      return detectedType === r.type
    })
    
    return typeConsistency.length / searchResults.length
  }

  calculateValidity(searchResults) {
    const validResults = searchResults.filter(r => {
      if (!r.value || !r.type) return false
      const validator = validators[r.type]
      return !validator || validator(r.value)
    })
    
    return validResults.length / searchResults.length
  }

  getQualityGrade(score) {
    if (score >= 0.9) return 'A'
    if (score >= 0.8) return 'B'
    if (score >= 0.7) return 'C'
    if (score >= 0.6) return 'D'
    return 'F'
  }

  identifyQualityIssues(searchResults, metrics) {
    const issues = []
    
    if (metrics.completeness < 0.8) {
      issues.push('Low completeness: Missing required fields in some results')
    }
    
    if (metrics.accuracy < 0.7) {
      issues.push('Low accuracy: Confidence scores are below expected threshold')
    }
    
    if (metrics.consistency < 0.8) {
      issues.push('Low consistency: Type detection inconsistencies found')
    }
    
    if (metrics.validity < 0.9) {
      issues.push('Validity issues: Some values do not match their assigned types')
    }
    
    return issues
  }

  detectTemporalPatterns(searchResults) {
    // Detect dates and time-based patterns
    const dates = searchResults
      .map(r => r.extractedAt)
      .filter(Boolean)
      .map(d => new Date(d))
    
    if (dates.length === 0) return { noData: true }
    
    return {
      count: dates.length,
      range: {
        start: new Date(Math.min(...dates)),
        end: new Date(Math.max(...dates))
      },
      distribution: this.groupDatesByHour(dates)
    }
  }

  detectSequentialPatterns(searchResults) {
    // Look for sequential patterns in data
    const numbers = searchResults
      .map(r => this.extractNumericValue(r.value))
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b)
    
    if (numbers.length < 2) return { noData: true }
    
    const gaps = []
    for (let i = 1; i < numbers.length; i++) {
      gaps.push(numbers[i] - numbers[i-1])
    }
    
    const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length
    
    return {
      isSequential: gaps.every(gap => Math.abs(gap - avgGap) < avgGap * 0.1),
      averageGap: avgGap,
      hasPattern: new Set(gaps).size < gaps.length * 0.3
    }
  }

  detectFormatPatterns(searchResults) {
    const formats = {}
    
    searchResults.forEach(r => {
      if (!r.value) return
      const format = this.getValueFormat(r.value)
      formats[format] = (formats[format] || 0) + 1
    })
    
    return {
      distribution: formats,
      dominantFormat: Object.entries(formats)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'mixed'
    }
  }

  detectLinguisticPatterns(searchResults) {
    const textValues = searchResults
      .map(r => r.value)
      .filter(v => v && typeof v === 'string' && /[a-zA-ZáčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(v))
    
    if (textValues.length === 0) return { noData: true }
    
    return {
      languages: this.detectLanguages(textValues),
      averageWordCount: textValues.reduce((sum, v) => sum + v.split(/\\s+/).length, 0) / textValues.length,
      hasSpecialChars: textValues.some(v => /[áčďéěíňóřšťúůýž]/i.test(v))
    }
  }

  // Additional helper methods
  isFinancialValue(value) {
    if (!value) return false
    return /\\d+[.,]?\\d*\\s*(?:Kč|CZK|€|EUR|\\$)/i.test(String(value))
  }

  isPersonalValue(value) {
    if (!value) return false
    const str = String(value)
    return /^\\d{6}\\/\\d{3,4}$/.test(str) || // birth number
           /^[A-Z][a-z]+\\s+[A-Z][a-z]+$/.test(str) || // name
           /^(\\+420\\s?)?\\d{3}\\s?\\d{3}\\s?\\d{3}$/.test(str) // phone
  }

  isContractValue(value) {
    if (!value) return false
    const str = String(value).toLowerCase()
    return /smlouva|dohoda|kupní|prodej|pronájem/.test(str)
  }

  extractNumericValue(value) {
    if (!value) return NaN
    const match = String(value).match(/\\d+(?:[.,]\\d+)?/)
    return match ? parseFloat(match[0].replace(',', '.')) : NaN
  }

  extractCurrencies(financialData) {
    const currencies = new Set()
    financialData.forEach(item => {
      const match = String(item.value || '').match(/(?:Kč|CZK|€|EUR|\\$)/i)
      if (match) currencies.add(match[0].toUpperCase())
    })
    return Array.from(currencies)
  }

  categorizeAmounts(amounts) {
    return {
      small: amounts.filter(a => a < 1000).length,
      medium: amounts.filter(a => a >= 1000 && a < 100000).length,
      large: amounts.filter(a => a >= 100000).length
    }
  }

  groupByType(data) {
    const groups = {}
    data.forEach(item => {
      const type = item.type || 'unknown'
      groups[type] = (groups[type] || 0) + 1
    })
    return groups
  }

  assessPrivacyRisk(personalData) {
    const riskFactors = {
      birthNumbers: personalData.filter(d => d.type === 'birthNumber').length,
      names: personalData.filter(d => d.type === 'name').length,
      phones: personalData.filter(d => d.type === 'phone').length,
      addresses: personalData.filter(d => d.type === 'address').length
    }
    
    const totalRisk = Object.values(riskFactors).reduce((sum, count) => sum + count, 0)
    
    if (totalRisk > 10) return 'high'
    if (totalRisk > 5) return 'medium'
    if (totalRisk > 0) return 'low'
    return 'none'
  }

  getPersonalDataRecommendations(personalData) {
    const recommendations = []
    
    if (personalData.some(d => d.type === 'birthNumber')) {
      recommendations.push('Implement birth number masking')
    }
    
    if (personalData.length > 5) {
      recommendations.push('Consider data minimization strategies')
    }
    
    recommendations.push('Ensure GDPR compliance for personal data processing')
    
    return recommendations
  }

  extractParties(contractData) {
    // Extract party information from contract data
    const parties = new Set()
    contractData.forEach(item => {
      if (item.label && /prodávající|kupující|pronajímatel|nájemce|strana/i.test(item.label)) {
        parties.add(item.value)
      }
    })
    return Array.from(parties)
  }

  extractDates(contractData) {
    const dates = []
    contractData.forEach(item => {
      const dateMatch = String(item.value || '').match(/\\d{1,2}[.\\/]\\d{1,2}[.\\/]\\d{2,4}/)
      if (dateMatch) {
        dates.push(dateMatch[0])
      }
    })
    return dates
  }

  extractTerms(contractData) {
    const terms = []
    contractData.forEach(item => {
      if (item.label && /termín|lhůta|doba|období/i.test(item.label)) {
        terms.push(item.value)
      }
    })
    return terms
  }

  assessContractCompleteness(contractData) {
    const requiredElements = ['parties', 'amount', 'date', 'terms']
    const foundElements = []
    
    contractData.forEach(item => {
      if (item.label) {
        const label = item.label.toLowerCase()
        if (/prodávající|kupující|strana/.test(label)) foundElements.push('parties')
        if (/cena|částka|hodnota/.test(label)) foundElements.push('amount')
        if (/datum|den/.test(label)) foundElements.push('date')
        if (/termín|lhůta|podmínka/.test(label)) foundElements.push('terms')
      }
    })
    
    const uniqueElements = new Set(foundElements)
    return (uniqueElements.size / requiredElements.length) * 100
  }

  generateBasicStats(searchResults) {
    return {
      count: searchResults.length,
      withValues: searchResults.filter(r => r.value).length,
      withConfidence: searchResults.filter(r => typeof r.confidence === 'number').length,
      avgConfidence: this.calculateAccuracy(searchResults)
    }
  }

  getValueFormat(value) {
    if (!value) return 'empty'
    
    const str = String(value)
    if (/^\\d+$/.test(str)) return 'numeric'
    if (/^\\d{6}\\/\\d{3,4}$/.test(str)) return 'birth-number'
    if (/^\\d+\\/\\d+$/.test(str)) return 'fraction'
    if (/^[A-Z][a-z]+\\s+[A-Z][a-z]+$/.test(str)) return 'full-name'
    if (/^\\d+[.,]\\d+/.test(str)) return 'decimal'
    if (/\\d+.*(?:Kč|CZK|€)/.test(str)) return 'currency'
    if (/^\\d{3}\\s?\\d{3}\\s?\\d{3}$/.test(str)) return 'phone'
    
    return 'text'
  }

  detectLanguages(textValues) {
    const hasEnglish = textValues.some(v => /^[a-zA-Z\\s]+$/.test(v))
    const hasCzech = textValues.some(v => /[áčďéěíňóřšťúůýž]/i.test(v))
    
    const languages = []
    if (hasCzech) languages.push('cs')
    if (hasEnglish) languages.push('en')
    
    return languages.length > 0 ? languages : ['unknown']
  }

  groupDatesByHour(dates) {
    const hours = {}
    dates.forEach(date => {
      const hour = date.getHours()
      hours[hour] = (hours[hour] || 0) + 1
    })
    return hours
  }

  hasFinancialData(searchResults) {
    return searchResults.some(r => 
      this.isFinancialValue(r.value) || 
      ['currency', 'amount', 'financial'].includes(r.type)
    )
  }

  hasPersonalData(searchResults) {
    return searchResults.some(r => 
      ['birthNumber', 'name', 'phone', 'email', 'address'].includes(r.type) ||
      this.isPersonalValue(r.value)
    )
  }

  hasContractData(searchResults) {
    return searchResults.some(r => 
      ['contract', 'legal', 'agreement'].includes(r.type) ||
      this.isContractValue(r.value)
    )
  }
}

// Export singleton instance
export const dataAggregationSystem = new DataAggregationSystem()

// Export convenience functions
export const generateSummary = (searchResults, options) => 
  dataAggregationSystem.generateComprehensiveSummary(searchResults, options)

export const analyzeDataTypes = (searchResults) => 
  dataAggregationSystem.analyzeDataTypes(searchResults)

export const analyzeConfidence = (searchResults) => 
  dataAggregationSystem.analyzeConfidence(searchResults)

export default dataAggregationSystem