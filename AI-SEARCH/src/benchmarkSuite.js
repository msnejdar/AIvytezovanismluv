// Comprehensive Performance Benchmark Suite for AI Search System

import { PerformanceBenchmark, performanceUtils } from './performanceMonitor.js';
import { SearchQualityAnalyzer, TestDataGenerator } from './searchQualityMetrics.js';
import { createNormalizedDocument, findValueInNormalizedDocument, detectValueType } from './documentNormalizer.js';

export class AISearchBenchmarkSuite {
  constructor() {
    this.performanceBenchmark = new PerformanceBenchmark();
    this.qualityAnalyzer = new SearchQualityAnalyzer();
    this.results = new Map();
    this.testData = null;
  }

  // Initialize test data
  async initializeTestData() {
    this.testData = {
      // Small documents (< 1KB)
      small: this.generateDocuments([500, 800, 1000]),
      
      // Medium documents (1-10KB)
      medium: this.generateDocuments([2000, 5000, 10000]),
      
      // Large documents (10-100KB)
      large: this.generateDocuments([25000, 50000, 100000]),
      
      // Test queries of different complexity
      queries: {
        simple: ['Jan', 'Praha', '123'],
        complex: ['rodné číslo Jana Novotného', 'celková kupní cena nemovitosti', 'adresa prodávajícího'],
        structured: ['940815/1234', '777 888 999', '1234/5678'],
        multivalue: ['všechna jména', 'všechny částky', 'všechny telefony']
      },
      
      // Edge cases
      edgeCases: {
        empty: '',
        specialChars: 'Tést s ďiákřitikou áčďéěíňóřšťúůýž a speciálními znaky @#$%^&*()',
        numbers: '123456789 0987654321 12.34 45,67 100% 5.5% €123 $456',
        mixed: 'Jan Novák (940815/1234) tel: +420 777 888 999, cena: 2,500,000 Kč',
        unicode: '🔍 Emoji test 中文字符 العربية русский'
      }
    };
    
    console.log('[Benchmark] Test data initialized with', {
      small: this.testData.small.length,
      medium: this.testData.medium.length,
      large: this.testData.large.length,
      totalQueries: Object.values(this.testData.queries).flat().length
    });
  }

  // Generate synthetic documents for testing
  generateDocuments(sizes) {
    const templates = [
      'Kupní smlouva č. {id}\nProdávající: {seller}, rodné číslo {birthNumber}, telefon {phone}\nKupující: {buyer}, rodné číslo {buyerBirth}\nPředmět koupě: Nemovitost na parcele č. {parcel}\nKupní cena: {amount} Kč\nDatum podpisu: {date}',
      
      'Pracovní smlouva\nZaměstnanec: {employee}, r.č. {empBirth}, bydliště {address}\nZaměstnavatel: {company}\nPozice: {position}\nMzda: {salary} Kč/měsíc\nNástup: {startDate}',
      
      'Faktura č. {invoiceId}\nOdběratel: {customer}\nDodavatel: {supplier}, IČ: {ico}\nSplatnost: {dueDate}\nCelkem k úhradě: {total} Kč\nÚčet: {account}'
    ];

    return sizes.map(size => {
      let document = '';
      const targetSize = size;
      
      while (document.length < targetSize) {
        const template = templates[Math.floor(Math.random() * templates.length)];
        const filled = this.fillTemplate(template);
        document += filled + '\n\n';
      }
      
      return {
        size: document.length,
        content: document.substring(0, targetSize),
        metadata: {
          estimatedNames: (document.match(/[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+/g) || []).length,
          estimatedNumbers: (document.match(/\d{6}\/\d{3,4}/g) || []).length,
          estimatedAmounts: (document.match(/\d+[\s,]\d+\s*Kč/g) || []).length
        }
      };
    });
  }

  // Fill template with random data
  fillTemplate(template) {
    const names = ['Jan Novák', 'Marie Svobodová', 'Petr Dvořák', 'Jana Černá', 'Tomáš Procházka'];
    const companies = ['ABC s.r.o.', 'XYZ a.s.', 'DEMO spol. s r.o.'];
    const positions = ['programátor', 'účetní', 'manažer', 'asistent'];
    const addresses = ['Praha 1, Náměstí 123', 'Brno, Hlavní 456', 'Ostrava, Nová 789'];
    
    return template
      .replace(/{id}/g, Math.floor(Math.random() * 10000))
      .replace(/{seller}/g, names[Math.floor(Math.random() * names.length)])
      .replace(/{buyer}/g, names[Math.floor(Math.random() * names.length)])
      .replace(/{employee}/g, names[Math.floor(Math.random() * names.length)])
      .replace(/{customer}/g, names[Math.floor(Math.random() * names.length)])
      .replace(/{company}/g, companies[Math.floor(Math.random() * companies.length)])
      .replace(/{supplier}/g, companies[Math.floor(Math.random() * companies.length)])
      .replace(/{position}/g, positions[Math.floor(Math.random() * positions.length)])
      .replace(/{birthNumber}/g, this.generateBirthNumber())
      .replace(/{buyerBirth}/g, this.generateBirthNumber())
      .replace(/{empBirth}/g, this.generateBirthNumber())
      .replace(/{phone}/g, this.generatePhone())
      .replace(/{amount}/g, this.generateAmount())
      .replace(/{salary}/g, Math.floor(Math.random() * 50000 + 20000).toLocaleString('cs-CZ'))
      .replace(/{total}/g, this.generateAmount())
      .replace(/{parcel}/g, `${Math.floor(Math.random() * 9999)}/${Math.floor(Math.random() * 99)}`)
      .replace(/{date}/g, this.generateDate())
      .replace(/{startDate}/g, this.generateDate())
      .replace(/{dueDate}/g, this.generateDate())
      .replace(/{address}/g, addresses[Math.floor(Math.random() * addresses.length)])
      .replace(/{ico}/g, Math.floor(Math.random() * 99999999))
      .replace(/{invoiceId}/g, `F${Math.floor(Math.random() * 99999)}`)
      .replace(/{account}/g, `${Math.floor(Math.random() * 9999999999)}/${Math.floor(Math.random() * 9999)}`);
  }

  generateBirthNumber() {
    const year = Math.floor(Math.random() * 50 + 40); // 40-89 (1940-1989)
    const month = Math.floor(Math.random() * 12 + 1).toString().padStart(2, '0');
    const day = Math.floor(Math.random() * 28 + 1).toString().padStart(2, '0');
    const suffix = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `${year}${month}${day}/${suffix}`;
  }

  generatePhone() {
    return `+420 ${Math.floor(Math.random() * 900 + 100)} ${Math.floor(Math.random() * 900 + 100)} ${Math.floor(Math.random() * 900 + 100)}`;
  }

  generateAmount() {
    const amount = Math.floor(Math.random() * 10000000 + 100000);
    return amount.toLocaleString('cs-CZ').replace(/,/g, ' ');
  }

  generateDate() {
    const day = Math.floor(Math.random() * 28 + 1);
    const month = Math.floor(Math.random() * 12 + 1);
    const year = Math.floor(Math.random() * 10 + 2020);
    return `${day}.${month}.${year}`;
  }

  // Benchmark document normalization performance
  async benchmarkNormalization() {
    console.log('[Benchmark] Testing document normalization...');
    
    const results = {
      small: [],
      medium: [],
      large: [],
      edgeCases: []
    };

    // Test different document sizes
    for (const [category, documents] of Object.entries(this.testData)) {
      if (category === 'queries' || category === 'edgeCases') continue;
      
      for (const doc of documents) {
        const measure = performanceUtils.measureSync('normalization', () => {
          return createNormalizedDocument(doc.content);
        });
        
        results[category].push({
          originalSize: doc.size,
          normalizedSize: measure.normalized.length,
          compressionRatio: measure.normalized.length / doc.size,
          indexMapSize: measure.indexMap.length,
          reverseMapSize: measure.reverseMap.size
        });
      }
    }

    // Test edge cases
    for (const [name, content] of Object.entries(this.testData.edgeCases)) {
      const start = performance.now();
      const normalized = createNormalizedDocument(content);
      const duration = performance.now() - start;
      
      results.edgeCases.push({
        case: name,
        originalSize: content.length,
        normalizedSize: normalized.normalized.length,
        duration,
        success: normalized.normalized !== null
      });
    }

    this.results.set('normalization', results);
    return results;
  }

  // Benchmark search operations
  async benchmarkSearch() {
    console.log('[Benchmark] Testing search performance...');
    
    const results = {
      simple: [],
      complex: [],
      structured: [],
      multivalue: [],
      byDocumentSize: { small: [], medium: [], large: [] }
    };

    // Test different query types
    for (const [queryType, queries] of Object.entries(this.testData.queries)) {
      for (const query of queries) {
        // Test on medium-sized document
        const testDoc = this.testData.medium[1];
        const normalized = createNormalizedDocument(testDoc.content);
        
        const start = performance.now();
        const searchResults = findValueInNormalizedDocument(
          query,
          detectValueType(query),
          normalized,
          testDoc.content
        );
        const duration = performance.now() - start;
        
        results[queryType].push({
          query,
          queryLength: query.length,
          documentSize: testDoc.size,
          resultCount: searchResults.length,
          duration,
          resultsPerMs: searchResults.length / duration,
          charactersPerMs: testDoc.size / duration
        });
      }
    }

    // Test performance by document size
    const testQuery = 'Jan Novák';
    for (const [sizeCategory, documents] of Object.entries(this.testData)) {
      if (sizeCategory === 'queries' || sizeCategory === 'edgeCases') continue;
      
      for (const doc of documents) {
        const normalized = createNormalizedDocument(doc.content);
        
        const start = performance.now();
        const searchResults = findValueInNormalizedDocument(
          testQuery,
          detectValueType(testQuery),
          normalized,
          doc.content
        );
        const duration = performance.now() - start;
        
        results.byDocumentSize[sizeCategory].push({
          documentSize: doc.size,
          resultCount: searchResults.length,
          duration,
          throughput: doc.size / duration // chars/ms
        });
      }
    }

    this.results.set('search', results);
    return results;
  }

  // Benchmark highlighting performance
  async benchmarkHighlighting() {
    console.log('[Benchmark] Testing highlighting performance...');
    
    const results = {
      byRangeCount: [],
      byDocumentSize: [],
      complexScenarios: []
    };

    // Test different numbers of highlight ranges
    const testDoc = this.testData.medium[1].content;
    const rangeCounts = [1, 5, 10, 25, 50, 100];
    
    for (const count of rangeCounts) {
      const ranges = this.generateTestRanges(testDoc, count);
      
      const start = performance.now();
      this.simulateHighlighting(testDoc, ranges);
      const duration = performance.now() - start;
      
      results.byRangeCount.push({
        rangeCount: count,
        documentSize: testDoc.length,
        duration,
        rangesPerMs: count / duration,
        charactersPerMs: testDoc.length / duration
      });
    }

    // Test different document sizes with fixed range count
    const fixedRangeCount = 10;
    for (const [category, documents] of Object.entries(this.testData)) {
      if (category === 'queries' || category === 'edgeCases') continue;
      
      for (const doc of documents) {
        const ranges = this.generateTestRanges(doc.content, fixedRangeCount);
        
        const start = performance.now();
        this.simulateHighlighting(doc.content, ranges);
        const duration = performance.now() - start;
        
        results.byDocumentSize.push({
          category,
          documentSize: doc.size,
          rangeCount: fixedRangeCount,
          duration,
          efficiency: doc.size / duration
        });
      }
    }

    this.results.set('highlighting', results);
    return results;
  }

  // Generate test highlight ranges
  generateTestRanges(text, count) {
    const ranges = [];
    const words = text.match(/\w+/g) || [];
    
    for (let i = 0; i < Math.min(count, words.length); i++) {
      const word = words[i];
      const index = text.indexOf(word);
      if (index !== -1) {
        ranges.push({
          start: index,
          end: index + word.length,
          text: word
        });
      }
    }
    
    return ranges;
  }

  // Simulate highlighting process
  simulateHighlighting(text, ranges) {
    // Sort ranges by start position (descending for reverse processing)
    const sortedRanges = ranges.sort((a, b) => b.start - a.start);
    
    let result = text;
    for (const range of sortedRanges) {
      const before = result.substring(0, range.start);
      const highlight = result.substring(range.start, range.end);
      const after = result.substring(range.end);
      result = before + `<mark>${highlight}</mark>` + after;
    }
    
    return result;
  }

  // Run memory usage tests
  async benchmarkMemoryUsage() {
    console.log('[Benchmark] Testing memory usage...');
    
    if (!('memory' in performance)) {
      console.warn('[Benchmark] Memory API not available');
      return null;
    }

    const results = {
      baseline: this.getMemorySnapshot(),
      afterNormalization: [],
      afterSearch: [],
      afterHighlighting: []
    };

    // Test memory usage during normalization
    for (const doc of this.testData.large) {
      const beforeMem = this.getMemorySnapshot();
      const normalized = createNormalizedDocument(doc.content);
      const afterMem = this.getMemorySnapshot();
      
      results.afterNormalization.push({
        documentSize: doc.size,
        memoryBefore: beforeMem.usedJSHeapSize,
        memoryAfter: afterMem.usedJSHeapSize,
        memoryIncrease: afterMem.usedJSHeapSize - beforeMem.usedJSHeapSize,
        normalizedSize: normalized.normalized.length
      });
      
      // Force garbage collection if available
      if (global.gc) global.gc();
    }

    this.results.set('memory', results);
    return results;
  }

  // Get memory snapshot
  getMemorySnapshot() {
    if ('memory' in performance) {
      return {
        usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024), // MB
        totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024), // MB
        jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) // MB
      };
    }
    return null;
  }

  // Run quality and accuracy tests
  async benchmarkQuality() {
    console.log('[Benchmark] Testing search quality and accuracy...');
    
    const testCases = TestDataGenerator.generateTestCases();
    const results = {
      overallAccuracy: 0,
      testResults: [],
      qualityMetrics: {}
    };

    for (const testCase of testCases) {
      // Simulate search execution
      const normalized = createNormalizedDocument(testCase.document);
      const searchResults = findValueInNormalizedDocument(
        testCase.query,
        detectValueType(testCase.query),
        normalized,
        testCase.document
      );

      // Convert to expected format
      const actualResults = searchResults.map(r => ({
        value: r.text,
        start: r.start,
        end: r.end
      }));

      // Calculate quality metrics
      const precision = this.qualityAnalyzer.calculatePrecisionRecall(
        actualResults,
        testCase.expectedResults,
        testCase.document
      );

      const relevance = this.qualityAnalyzer.analyzeRelevance(
        testCase.query,
        actualResults,
        testCase.document
      );

      results.testResults.push({
        description: testCase.description,
        query: testCase.query,
        expectedCount: testCase.expectedResults.length,
        actualCount: actualResults.length,
        precision: precision.precision,
        recall: precision.recall,
        f1Score: precision.f1Score,
        relevanceScore: relevance.overallScore,
        passed: precision.f1Score >= 0.8 && relevance.overallScore >= 0.7
      });
    }

    // Calculate overall metrics
    const totalTests = results.testResults.length;
    const passedTests = results.testResults.filter(r => r.passed).length;
    results.overallAccuracy = (passedTests / totalTests) * 100;

    results.qualityMetrics = {
      averagePrecision: results.testResults.reduce((sum, r) => sum + r.precision, 0) / totalTests,
      averageRecall: results.testResults.reduce((sum, r) => sum + r.recall, 0) / totalTests,
      averageF1: results.testResults.reduce((sum, r) => sum + r.f1Score, 0) / totalTests,
      averageRelevance: results.testResults.reduce((sum, r) => sum + r.relevanceScore, 0) / totalTests
    };

    this.results.set('quality', results);
    return results;
  }

  // Run complete benchmark suite
  async runFullBenchmark() {
    console.log('[Benchmark] Starting comprehensive benchmark suite...');
    
    const startTime = performance.now();
    
    // Initialize test data
    await this.initializeTestData();
    
    // Run all benchmarks
    const results = {
      timestamp: new Date().toISOString(),
      environment: this.getEnvironmentInfo(),
      testData: {
        documentSizes: Object.keys(this.testData).filter(k => k !== 'queries' && k !== 'edgeCases'),
        queryTypes: Object.keys(this.testData.queries),
        totalDocuments: Object.values(this.testData)
          .filter(v => Array.isArray(v))
          .reduce((sum, arr) => sum + arr.length, 0)
      },
      results: {}
    };

    try {
      results.results.normalization = await this.benchmarkNormalization();
      results.results.search = await this.benchmarkSearch();
      results.results.highlighting = await this.benchmarkHighlighting();
      results.results.memory = await this.benchmarkMemoryUsage();
      results.results.quality = await this.benchmarkQuality();
      
      const duration = performance.now() - startTime;
      results.benchmarkDuration = Math.round(duration);
      
      // Generate summary
      results.summary = this.generateBenchmarkSummary(results.results);
      
      console.log('[Benchmark] Complete! Duration:', `${Math.round(duration)}ms`);
      
    } catch (error) {
      console.error('[Benchmark] Error during execution:', error);
      results.error = error.message;
    }

    this.results.set('fullBenchmark', results);
    return results;
  }

  // Get environment information
  getEnvironmentInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory,
      connection: navigator.connection?.effectiveType,
      timestamp: Date.now()
    };
  }

  // Generate benchmark summary
  generateBenchmarkSummary(results) {
    const summary = {
      performance: {
        normalizationSpeed: 'N/A',
        searchThroughput: 'N/A',
        highlightingEfficiency: 'N/A'
      },
      quality: {
        overallAccuracy: 'N/A',
        averageRelevance: 'N/A'
      },
      recommendations: []
    };

    // Analyze normalization performance
    if (results.normalization?.medium?.length > 0) {
      const avgCompression = results.normalization.medium.reduce((sum, r) => sum + r.compressionRatio, 0) / results.normalization.medium.length;
      summary.performance.normalizationSpeed = `${Math.round(avgCompression * 100)}% compression ratio`;
    }

    // Analyze search throughput
    if (results.search?.byDocumentSize?.medium?.length > 0) {
      const avgThroughput = results.search.byDocumentSize.medium.reduce((sum, r) => sum + r.throughput, 0) / results.search.byDocumentSize.medium.length;
      summary.performance.searchThroughput = `${Math.round(avgThroughput)} chars/ms`;
    }

    // Analyze quality metrics
    if (results.quality) {
      summary.quality.overallAccuracy = `${Math.round(results.quality.overallAccuracy)}%`;
      summary.quality.averageRelevance = `${Math.round(results.quality.qualityMetrics.averageRelevance * 100)}%`;
    }

    // Generate recommendations
    if (results.quality?.overallAccuracy < 80) {
      summary.recommendations.push('Consider improving search accuracy algorithms');
    }
    if (results.search?.byDocumentSize?.large?.some(r => r.duration > 100)) {
      summary.recommendations.push('Optimize search performance for large documents');
    }
    if (results.memory?.afterNormalization?.some(r => r.memoryIncrease > 50)) {
      summary.recommendations.push('Consider memory optimization for document normalization');
    }

    return summary;
  }

  // Export results to console and return for further analysis
  exportResults() {
    console.group('[Benchmark Results]');
    
    for (const [testName, result] of this.results) {
      console.group(`${testName.toUpperCase()} Results`);
      console.table(result);
      console.groupEnd();
    }
    
    console.groupEnd();
    
    return Object.fromEntries(this.results);
  }
}

// Factory function to create and run benchmarks
export const createBenchmarkSuite = () => new AISearchBenchmarkSuite();

export default AISearchBenchmarkSuite;