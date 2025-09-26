// Search Quality and Relevance Metrics System

export class SearchQualityAnalyzer {
  constructor() {
    this.qualityMetrics = new Map();
    this.relevanceHistory = [];
    this.accuracyTests = new Map();
  }

  // Calculate precision and recall for search results
  calculatePrecisionRecall(results, expectedResults, documentText) {
    if (!results || !expectedResults || results.length === 0) {
      return { precision: 0, recall: 0, f1Score: 0 };
    }

    // Convert results to comparable format
    const foundItems = new Set(results.map(r => this.normalizeResult(r.value || r.text)));
    const expectedItems = new Set(expectedResults.map(e => this.normalizeResult(e)));

    // Calculate true positives, false positives, false negatives
    const truePositives = [...foundItems].filter(item => expectedItems.has(item)).length;
    const falsePositives = foundItems.size - truePositives;
    const falseNegatives = expectedItems.size - truePositives;

    // Calculate metrics
    const precision = foundItems.size > 0 ? truePositives / foundItems.size : 0;
    const recall = expectedItems.size > 0 ? truePositives / expectedItems.size : 0;
    const f1Score = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    return {
      precision: Math.round(precision * 100) / 100,
      recall: Math.round(recall * 100) / 100,
      f1Score: Math.round(f1Score * 100) / 100,
      truePositives,
      falsePositives,
      falseNegatives
    };
  }

  // Normalize result for comparison
  normalizeResult(value) {
    if (!value) return '';
    return value.toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  // Analyze search relevance based on query context
  analyzeRelevance(query, results, documentText) {
    const analysis = {
      queryType: this.detectQueryType(query),
      resultTypes: results.map(r => this.detectValueType(r.value || r.text)),
      contextualRelevance: 0,
      semanticRelevance: 0,
      structuralRelevance: 0,
      overallScore: 0
    };

    // Calculate contextual relevance (query terms appear near results)
    analysis.contextualRelevance = this.calculateContextualRelevance(query, results, documentText);
    
    // Calculate semantic relevance (results match query intent)
    analysis.semanticRelevance = this.calculateSemanticRelevance(query, results);
    
    // Calculate structural relevance (results have proper format)
    analysis.structuralRelevance = this.calculateStructuralRelevance(analysis.queryType, results);
    
    // Overall score (weighted average)
    analysis.overallScore = Math.round(
      (analysis.contextualRelevance * 0.3 + 
       analysis.semanticRelevance * 0.4 + 
       analysis.structuralRelevance * 0.3) * 100
    ) / 100;

    this.relevanceHistory.push({
      timestamp: Date.now(),
      query,
      analysis
    });

    return analysis;
  }

  // Detect query type based on content
  detectQueryType(query) {
    const lowerQuery = query.toLowerCase();
    
    if (/rodn[ée]|birth|číslo.*rodn/i.test(lowerQuery)) return 'birthNumber';
    if (/jméno|name|osoba|person/i.test(lowerQuery)) return 'name';
    if (/cena|price|částka|amount|money|kč|czk|eur/i.test(lowerQuery)) return 'amount';
    if (/telefon|phone|mobil|mobile/i.test(lowerQuery)) return 'phone';
    if (/adresa|address|ulice|street/i.test(lowerQuery)) return 'address';
    if (/datum|date/i.test(lowerQuery)) return 'date';
    if (/účet|account|iban/i.test(lowerQuery)) return 'account';
    if (/parcela|parcel|pozemek/i.test(lowerQuery)) return 'parcel';
    if (/procent|percent|%|úrok|rate/i.test(lowerQuery)) return 'percentage';
    
    return 'general';
  }

  // Detect value type based on format
  detectValueType(value) {
    if (!value) return 'unknown';
    
    const trimmed = value.toString().trim();
    
    if (/^\d{6}\/\d{3,4}$/.test(trimmed)) return 'birthNumber';
    if (/^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+$/i.test(trimmed)) return 'name';
    if (/\d+.*[Kč|CZK|EUR|€]/i.test(trimmed)) return 'amount';
    if (/^\+?[\d\s]{9,}$/.test(trimmed)) return 'phone';
    if (/\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4}/.test(trimmed)) return 'date';
    if (/\d+\/\d+/.test(trimmed) && !/^\d{6}\/\d{3,4}$/.test(trimmed)) return 'parcel';
    if (/\d+[.,]\d*\s*%/.test(trimmed)) return 'percentage';
    
    return 'text';
  }

  // Calculate how relevant results are based on context
  calculateContextualRelevance(query, results, documentText) {
    if (!results || results.length === 0) return 0;
    
    let totalRelevance = 0;
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    results.forEach(result => {
      if (!result.start || !result.end) return;
      
      // Get context around the result (±100 characters)
      const contextStart = Math.max(0, result.start - 100);
      const contextEnd = Math.min(documentText.length, result.end + 100);
      const context = documentText.substring(contextStart, contextEnd).toLowerCase();
      
      // Count how many query terms appear in context
      const termsInContext = queryTerms.filter(term => context.includes(term)).length;
      const contextRelevance = termsInContext / queryTerms.length;
      
      totalRelevance += contextRelevance;
    });
    
    return Math.round((totalRelevance / results.length) * 100) / 100;
  }

  // Calculate semantic relevance (intent matching)
  calculateSemanticRelevance(query, results) {
    if (!results || results.length === 0) return 0;
    
    const queryType = this.detectQueryType(query);
    let matchingResults = 0;
    
    results.forEach(result => {
      const resultType = this.detectValueType(result.value || result.text);
      if (resultType === queryType || this.areTypesCompatible(queryType, resultType)) {
        matchingResults++;
      }
    });
    
    return Math.round((matchingResults / results.length) * 100) / 100;
  }

  // Calculate structural relevance (format correctness)
  calculateStructuralRelevance(queryType, results) {
    if (!results || results.length === 0) return 0;
    
    let structurallyCorrect = 0;
    
    results.forEach(result => {
      const value = result.value || result.text;
      if (this.isStructurallyValid(queryType, value)) {
        structurallyCorrect++;
      }
    });
    
    return Math.round((structurallyCorrect / results.length) * 100) / 100;
  }

  // Check if query type and result type are compatible
  areTypesCompatible(queryType, resultType) {
    const compatibilityMap = {
      general: ['text', 'name', 'amount', 'phone', 'date'],
      name: ['name', 'text'],
      amount: ['amount', 'percentage'],
      phone: ['phone', 'text'],
      birthNumber: ['birthNumber'],
      account: ['account', 'text'],
      parcel: ['parcel', 'text'],
      percentage: ['percentage', 'amount']
    };
    
    return compatibilityMap[queryType]?.includes(resultType) || false;
  }

  // Validate structural correctness
  isStructurallyValid(queryType, value) {
    if (!value) return false;
    
    const validators = {
      birthNumber: (v) => /^\d{6}\/\d{3,4}$/.test(v.trim()),
      phone: (v) => /^(\+420\s?)?\d{3}\s?\d{3}\s?\d{3}$/.test(v.trim()),
      amount: (v) => /\d+.*[Kč|CZK|EUR|€]/i.test(v) || /^\d{1,3}([\s,\.]\d{3})*([\.,]\d{1,2})?$/.test(v),
      date: (v) => /\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4}/.test(v),
      percentage: (v) => /\d+[.,]\d*\s*%/.test(v),
      parcel: (v) => /\d+\/\d+/.test(v) && !/^\d{6}\/\d{3,4}$/.test(v),
      account: (v) => /\d+\/\d{4}/.test(v) || /^[A-Z]{2}\d{2}/.test(v),
      name: (v) => /^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+$/i.test(v.trim())
    };
    
    return validators[queryType]?.(value) || true; // Default to true for general queries
  }

  // Test search accuracy against known datasets
  runAccuracyTest(testName, testCases) {
    const results = {
      testName,
      totalCases: testCases.length,
      passedCases: 0,
      failedCases: 0,
      averagePrecision: 0,
      averageRecall: 0,
      averageF1: 0,
      cases: []
    };
    
    testCases.forEach((testCase, index) => {
      const { query, document, expectedResults, actualResults } = testCase;
      
      const metrics = this.calculatePrecisionRecall(actualResults, expectedResults, document);
      const relevance = this.analyzeRelevance(query, actualResults, document);
      
      const passed = metrics.f1Score >= 0.8 && relevance.overallScore >= 0.7;
      
      if (passed) results.passedCases++;
      else results.failedCases++;
      
      results.cases.push({
        index,
        query,
        passed,
        metrics,
        relevance
      });
    });
    
    // Calculate averages
    results.averagePrecision = results.cases.reduce((sum, c) => sum + c.metrics.precision, 0) / results.totalCases;
    results.averageRecall = results.cases.reduce((sum, c) => sum + c.metrics.recall, 0) / results.totalCases;
    results.averageF1 = results.cases.reduce((sum, c) => sum + c.metrics.f1Score, 0) / results.totalCases;
    
    this.accuracyTests.set(testName, results);
    return results;
  }

  // Generate search quality report
  generateQualityReport() {
    const recentRelevance = this.relevanceHistory.slice(-10);
    const avgRelevance = recentRelevance.length > 0 
      ? recentRelevance.reduce((sum, r) => sum + r.analysis.overallScore, 0) / recentRelevance.length 
      : 0;
    
    const accuracyResults = Array.from(this.accuracyTests.values());
    const avgAccuracy = accuracyResults.length > 0
      ? accuracyResults.reduce((sum, r) => sum + r.averageF1, 0) / accuracyResults.length
      : 0;
    
    return {
      overview: {
        totalQueries: this.relevanceHistory.length,
        averageRelevance: Math.round(avgRelevance * 100) / 100,
        averageAccuracy: Math.round(avgAccuracy * 100) / 100,
        qualityScore: Math.round(((avgRelevance + avgAccuracy) / 2) * 100) / 100
      },
      relevanceAnalysis: {
        recentQueries: recentRelevance.length,
        queryTypes: this.getQueryTypeDistribution(),
        relevanceTrends: this.getRelevanceTrends()
      },
      accuracyTests: {
        totalTests: accuracyResults.length,
        passRate: accuracyResults.length > 0
          ? (accuracyResults.reduce((sum, r) => sum + r.passedCases, 0) / 
             accuracyResults.reduce((sum, r) => sum + r.totalCases, 0)) * 100
          : 0,
        results: accuracyResults
      },
      recommendations: this.generateRecommendations(avgRelevance, avgAccuracy)
    };
  }

  // Get distribution of query types
  getQueryTypeDistribution() {
    const distribution = {};
    this.relevanceHistory.forEach(item => {
      const type = item.analysis.queryType;
      distribution[type] = (distribution[type] || 0) + 1;
    });
    return distribution;
  }

  // Get relevance trends over time
  getRelevanceTrends() {
    if (this.relevanceHistory.length < 2) return [];
    
    const trends = [];
    const windowSize = 5;
    
    for (let i = windowSize; i < this.relevanceHistory.length; i++) {
      const window = this.relevanceHistory.slice(i - windowSize, i);
      const avgScore = window.reduce((sum, item) => sum + item.analysis.overallScore, 0) / windowSize;
      
      trends.push({
        timestamp: window[window.length - 1].timestamp,
        averageScore: Math.round(avgScore * 100) / 100,
        sampleSize: windowSize
      });
    }
    
    return trends;
  }

  // Generate improvement recommendations
  generateRecommendations(relevance, accuracy) {
    const recommendations = [];
    
    if (relevance < 0.6) {
      recommendations.push({
        priority: 'high',
        category: 'relevance',
        issue: 'Low search relevance score',
        suggestion: 'Improve query understanding and result ranking algorithms'
      });
    }
    
    if (accuracy < 0.7) {
      recommendations.push({
        priority: 'high',
        category: 'accuracy',
        issue: 'Low search accuracy',
        suggestion: 'Enhance document parsing and value extraction methods'
      });
    }
    
    if (relevance < 0.8 && accuracy >= 0.7) {
      recommendations.push({
        priority: 'medium',
        category: 'relevance',
        issue: 'Moderate relevance issues',
        suggestion: 'Fine-tune contextual analysis and semantic matching'
      });
    }
    
    if (accuracy < 0.9 && relevance >= 0.8) {
      recommendations.push({
        priority: 'medium',
        category: 'accuracy',
        issue: 'Room for accuracy improvement',
        suggestion: 'Add more validation rules and edge case handling'
      });
    }
    
    return recommendations;
  }

  // Clear all metrics (for testing/reset)
  clearMetrics() {
    this.qualityMetrics.clear();
    this.relevanceHistory = [];
    this.accuracyTests.clear();
  }
}

// Test data generator for accuracy testing
export class TestDataGenerator {
  static generateTestCases() {
    return [
      {
        query: "rodné číslo Jana Dvořáka",
        document: "Smlouva: Jan Dvořák, rodné číslo 940815/1234, adresa Praha 1",
        expectedResults: ["940815/1234"],
        description: "Birth number extraction"
      },
      {
        query: "kupní cena",
        document: "Kupní cena nemovitosti činí 7 850 000 Kč včetně DPH",
        expectedResults: ["7 850 000 Kč"],
        description: "Amount extraction"
      },
      {
        query: "jméno prodávajícího",
        document: "Prodávající: Marie Novotná, tel: 605 123 456",
        expectedResults: ["Marie Novotná"],
        description: "Name extraction"
      },
      {
        query: "telefon",
        document: "Kontakt: +420 777 888 999, email: test@email.cz",
        expectedResults: ["+420 777 888 999"],
        description: "Phone number extraction"
      },
      {
        query: "parcelní číslo",
        document: "Pozemek parcela č. 1234/5 v k.ú. Praha",
        expectedResults: ["1234/5"],
        description: "Parcel number extraction"
      }
    ];
  }

  static generatePerformanceTestData(sizes = [1000, 5000, 10000, 50000]) {
    return sizes.map(size => {
      const baseText = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ";
      const names = ["Jan Novák", "Marie Svobodová", "Petr Dvořák"];
      const birthNumbers = ["940815/1234", "850620/5678", "760301/9012"];
      const amounts = ["150 000 Kč", "2 500 000 Kč", "75 000 Kč"];
      
      let document = baseText.repeat(Math.floor(size / baseText.length));
      
      // Insert test data at random positions
      names.forEach((name, i) => {
        const pos = Math.floor(Math.random() * document.length);
        document = document.slice(0, pos) + ` ${name}, rodné číslo ${birthNumbers[i]}, cena ${amounts[i]}. ` + document.slice(pos);
      });
      
      return {
        size,
        document,
        expectedNames: names,
        expectedBirthNumbers: birthNumbers,
        expectedAmounts: amounts
      };
    });
  }
}

export default SearchQualityAnalyzer;