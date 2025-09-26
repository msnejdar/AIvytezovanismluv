import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { 
  performanceTestData, 
  czechTestDocument,
  diacriticsTestCases 
} from './fixtures/czechTestData.js'
import {
  createNormalizedDocument,
  findValueInNormalizedDocument,
  detectValueType,
  removeDiacritics
} from '../documentNormalizer.js'

// Performance benchmarking utilities
class PerformanceBenchmark {
  constructor() {
    this.results = []
  }
  
  async measure(name, fn, iterations = 1) {
    const measurements = []
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now()
      const result = await fn()
      const endTime = performance.now()
      
      measurements.push({
        duration: endTime - startTime,
        result
      })
    }
    
    const avgDuration = measurements.reduce((sum, m) => sum + m.duration, 0) / measurements.length
    const minDuration = Math.min(...measurements.map(m => m.duration))
    const maxDuration = Math.max(...measurements.map(m => m.duration))
    
    const benchmark = {
      name,
      avgDuration,
      minDuration,
      maxDuration,
      iterations,
      measurements
    }
    
    this.results.push(benchmark)
    return benchmark
  }
  
  getResults() {
    return this.results
  }
  
  clear() {
    this.results = []
  }
}

const generateLargeDocument = (baseDoc, multiplier) => {
  let content = ''
  for (let i = 0; i < multiplier; i++) {
    content += `\n--- Section ${i + 1} ---\n`
    content += baseDoc
    
    // Add some variation
    content += `\nAdditional content ${i}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. `
    content += `Variation ${i} with number ${Math.random().toString().substring(2, 8)}/123${i}.\n`
  }
  return content
}

const generateComplexDocument = (size) => {
  const names = ['Jan Novák', 'Marie Svobodová', 'Pavel Dvořák', 'Kateřina Nováková', 'Tomáš Procházka']
  const amounts = ['1 234 567 Kč', '987 654 CZK', '456 789 EUR', '123 456 USD']
  const birthNumbers = ['940919/1022', '850623/3456', '760214/7890', '920101/1234']
  const phones = ['+420 603 123 456', '+420 724 987 654', '+420 777 111 222']
  
  let document = ''
  const sectionsCount = Math.ceil(size / 1000) // Roughly 1KB per section
  
  for (let i = 0; i < sectionsCount; i++) {
    document += `\n=== Sekce ${i + 1} ===\n`
    document += `Účastník: ${names[i % names.length]}\n`
    document += `Rodné číslo: ${birthNumbers[i % birthNumbers.length]}\n`
    document += `Částka: ${amounts[i % amounts.length]}\n`
    document += `Telefon: ${phones[i % phones.length]}\n`
    document += `Popis: Toto je detailní popis sekce číslo ${i + 1} s různými českými znaky jako ě, š, č, ř, ž, ý, á, í, é, ú, ů, ď, ť, ň.\n`
    document += 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(5)
    document += '\n'
  }
  
  return document
}

describe('Performance Tests', () => {
  let benchmark
  
  beforeEach(() => {
    benchmark = new PerformanceBenchmark()
  })
  
  afterEach(() => {
    // Log performance results for analysis
    const results = benchmark.getResults()
    if (results.length > 0) {
      console.log('\n=== Performance Results ===')
      results.forEach(result => {
        console.log(`${result.name}:`)
        console.log(`  Average: ${result.avgDuration.toFixed(2)}ms`)
        console.log(`  Min: ${result.minDuration.toFixed(2)}ms`)  
        console.log(`  Max: ${result.maxDuration.toFixed(2)}ms`)
        console.log(`  Iterations: ${result.iterations}`)
      })
      console.log('===========================\n')
    }
  })
  
  describe('Document Normalization Performance', () => {
    test('should normalize small documents quickly', async () => {
      const smallDoc = czechTestDocument // ~10KB
      
      const result = await benchmark.measure('Small doc normalization', () => {
        return createNormalizedDocument(smallDoc)
      }, 100)
      
      expect(result.avgDuration).toBeLessThan(10) // < 10ms on average
      expect(result.maxDuration).toBeLessThan(50) // < 50ms worst case
    })
    
    test('should normalize medium documents efficiently', async () => {
      const mediumDoc = generateLargeDocument(czechTestDocument, 10) // ~100KB
      
      const result = await benchmark.measure('Medium doc normalization', () => {
        return createNormalizedDocument(mediumDoc)
      }, 10)
      
      expect(result.avgDuration).toBeLessThan(100) // < 100ms on average
      expect(result.maxDuration).toBeLessThan(500) // < 500ms worst case
    })
    
    test('should normalize large documents within reasonable time', async () => {
      const largeDoc = generateLargeDocument(czechTestDocument, 100) // ~1MB
      
      const result = await benchmark.measure('Large doc normalization', () => {
        return createNormalizedDocument(largeDoc)
      }, 5)
      
      expect(result.avgDuration).toBeLessThan(1000) // < 1s on average
      expect(result.maxDuration).toBeLessThan(3000) // < 3s worst case
    })
    
    test('should handle huge documents without timeout', async () => {
      const hugeDoc = generateLargeDocument(czechTestDocument, 500) // ~5MB
      
      const result = await benchmark.measure('Huge doc normalization', () => {
        return createNormalizedDocument(hugeDoc)
      }, 1)
      
      expect(result.avgDuration).toBeLessThan(10000) // < 10s
    })
  })
  
  describe('Search Performance', () => {
    test('should search small documents quickly', async () => {
      const smallDoc = czechTestDocument
      const normalizedDoc = createNormalizedDocument(smallDoc)
      
      const result = await benchmark.measure('Small doc search', () => {
        return findValueInNormalizedDocument('Jan Novák', 'text', normalizedDoc, smallDoc)
      }, 1000)
      
      expect(result.avgDuration).toBeLessThan(1) // < 1ms on average
      expect(result.maxDuration).toBeLessThan(10) // < 10ms worst case
    })
    
    test('should search medium documents efficiently', async () => {
      const mediumDoc = generateLargeDocument(czechTestDocument, 10)
      const normalizedDoc = createNormalizedDocument(mediumDoc)
      
      const result = await benchmark.measure('Medium doc search', () => {
        return findValueInNormalizedDocument('Jan Novák', 'text', normalizedDoc, mediumDoc)
      }, 100)
      
      expect(result.avgDuration).toBeLessThan(10) // < 10ms on average
      expect(result.maxDuration).toBeLessThan(50) // < 50ms worst case
    })
    
    test('should search large documents within reasonable time', async () => {
      const largeDoc = generateLargeDocument(czechTestDocument, 100)
      const normalizedDoc = createNormalizedDocument(largeDoc)
      
      const result = await benchmark.measure('Large doc search', () => {
        return findValueInNormalizedDocument('Jan Novák', 'text', normalizedDoc, largeDoc)
      }, 10)
      
      expect(result.avgDuration).toBeLessThan(100) // < 100ms on average
      expect(result.maxDuration).toBeLessThan(500) // < 500ms worst case
    })
    
    test('should handle multiple searches efficiently', async () => {
      const doc = generateLargeDocument(czechTestDocument, 50) // ~500KB
      const normalizedDoc = createNormalizedDocument(doc)
      
      const queries = [
        'Jan Novák', 'Marie Svobodová', '940919/1022', '7 850 000',
        'Praha', 'Brno', 'RPSN', 'CZ6508000000192000145399'
      ]
      
      const result = await benchmark.measure('Multiple searches', () => {
        return queries.map(query => 
          findValueInNormalizedDocument(query, detectValueType(query), normalizedDoc, doc)
        )
      }, 10)
      
      expect(result.avgDuration).toBeLessThan(500) // < 500ms for all queries
    })
  })
  
  describe('Diacritics Processing Performance', () => {
    test('should remove diacritics quickly from various sizes', async () => {
      const texts = [
        'Krátký text s ěščřžýáíéúůďťň',
        'Středně dlouhý text s mnoha diakritickými znaky: '.repeat(100),
        'Velmi dlouhý text s českými znaky: '.repeat(1000)
      ]
      
      for (let i = 0; i < texts.length; i++) {
        const result = await benchmark.measure(`Diacritics removal ${i + 1}`, () => {
          return removeDiacritics(texts[i])
        }, 100)
        
        // Should scale linearly with text length
        const expectedMaxTime = texts[i].length * 0.01 // 0.01ms per character
        expect(result.avgDuration).toBeLessThan(Math.max(expectedMaxTime, 10))
      }
    })
    
    test('should handle complex Czech text efficiently', async () => {
      const complexText = diacriticsTestCases
        .map(tc => tc.original)
        .join(' ')
        .repeat(1000)
      
      const result = await benchmark.measure('Complex diacritics text', () => {
        return removeDiacritics(complexText)
      }, 10)
      
      expect(result.avgDuration).toBeLessThan(100) // < 100ms
    })
  })
  
  describe('Memory Usage and Scaling', () => {
    test('should not have memory leaks with repeated operations', async () => {
      const doc = czechTestDocument
      
      // Measure memory usage trend
      const memoryBefore = process.memoryUsage().heapUsed
      
      await benchmark.measure('Memory leak test', () => {
        // Perform operations that could potentially leak memory
        const normalized = createNormalizedDocument(doc)
        const results = findValueInNormalizedDocument('Jan Novák', 'text', normalized, doc)
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc()
        }
        
        return results
      }, 1000)
      
      const memoryAfter = process.memoryUsage().heapUsed
      const memoryIncrease = memoryAfter - memoryBefore
      
      // Memory increase should be reasonable (< 100MB for 1000 iterations)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024)
    })
    
    test('should scale linearly with document size', async () => {
      const baseTimes = []
      const sizes = [1, 10, 50, 100] // Multipliers for document size
      
      for (const size of sizes) {
        const doc = generateComplexDocument(size * 1000) // size * 1KB
        
        const result = await benchmark.measure(`Scaling test ${size}x`, () => {
          const normalized = createNormalizedDocument(doc)
          return findValueInNormalizedDocument('Jan Novák', 'text', normalized, doc)
        }, 5)
        
        baseTimes.push({
          size: size * 1000,
          time: result.avgDuration
        })
      }
      
      // Calculate scaling factor
      const firstTime = baseTimes[0].time
      const lastTime = baseTimes[baseTimes.length - 1].time
      const firstSize = baseTimes[0].size
      const lastSize = baseTimes[baseTimes.length - 1].size
      
      const scalingFactor = (lastTime / firstTime) / (lastSize / firstSize)
      
      // Should scale roughly linearly (scaling factor should be close to 1)
      // Allow for some overhead, so accept anything less than 3x linear scaling
      expect(scalingFactor).toBeLessThan(3)
    })
  })
  
  describe('Concurrent Operations Performance', () => {
    test('should handle multiple concurrent searches', async () => {
      const doc = generateLargeDocument(czechTestDocument, 20) // ~200KB
      const normalizedDoc = createNormalizedDocument(doc)
      
      const queries = [
        'Jan Novák', 'Marie Svobodová', '940919/1022', '7 850 000 Kč',
        'Praha', '+420', 'RPSN', 'kupní cena', 'prodávající', 'smlouva'
      ]
      
      const result = await benchmark.measure('Concurrent searches', async () => {
        // Simulate concurrent searches
        const promises = queries.map(query => 
          Promise.resolve(findValueInNormalizedDocument(
            query, 
            detectValueType(query), 
            normalizedDoc, 
            doc
          ))
        )
        return Promise.all(promises)
      }, 10)
      
      expect(result.avgDuration).toBeLessThan(1000) // < 1s for all concurrent searches
    })
    
    test('should handle rapid sequential operations', async () => {
      const doc = czechTestDocument
      const queries = ['Jan', 'Novák', 'Marie', 'Praha', '940919', '1022', '7', '850', '000']
      
      const result = await benchmark.measure('Rapid sequential operations', () => {
        const normalized = createNormalizedDocument(doc)
        return queries.map(query => 
          findValueInNormalizedDocument(query, 'text', normalized, doc)
        )
      }, 100)
      
      expect(result.avgDuration).toBeLessThan(50) // < 50ms for sequence
    })
  })
  
  describe('Worst Case Scenarios', () => {
    test('should handle documents with many repeated patterns', async () => {
      // Create document with many repeated search targets
      const pattern = 'Jan Novák, rodné číslo: 940919/1022, '
      const worstCaseDoc = pattern.repeat(10000) // ~500KB with 10k matches
      
      const result = await benchmark.measure('Worst case - many matches', () => {
        const normalized = createNormalizedDocument(worstCaseDoc)
        return findValueInNormalizedDocument('Jan Novák', 'text', normalized, worstCaseDoc)
      }, 3)
      
      expect(result.avgDuration).toBeLessThan(2000) // < 2s even with 10k matches
      
      const matches = result.measurements[0].result
      expect(matches.length).toBe(10000) // Should find all instances
    })
    
    test('should handle very long lines', async () => {
      const longLine = 'Toto je velmi dlouhý řádek s mnoha českými znaky: žluťoučký kůň úpěl ďábelské ódy. '.repeat(1000)
      const doc = longLine + '\nKrátký řádek.\n' + longLine
      
      const result = await benchmark.measure('Very long lines', () => {
        const normalized = createNormalizedDocument(doc)
        return findValueInNormalizedDocument('žluťoučký', 'text', normalized, doc)
      }, 10)
      
      expect(result.avgDuration).toBeLessThan(1000) // < 1s
    })
    
    test('should handle documents with dense Unicode content', async () => {
      const unicodeDoc = '🔍💯🎯📊✅❌⚡🚀💡📝📋📈📉🔥💪🎉🎊🎈🎁🎂🎃🎄🎅🎆🎇🎈'.repeat(1000)
      
      const result = await benchmark.measure('Dense Unicode', () => {
        return createNormalizedDocument(unicodeDoc)
      }, 10)
      
      expect(result.avgDuration).toBeLessThan(500) // < 500ms
    })
    
    test('should handle mixed content with various encodings', async () => {
      const mixedDoc = `
        Čeština: žluťoučký kůň úpěl ďábelské ódy
        English: The quick brown fox jumps over the lazy dog
        Русский: Быстрая коричневая лиса прыгает через ленивую собаку
        العربية: الثعلب البني السريع يقفز فوق الكلب الكسول
        中文: 快速的棕色狐狸跳过懒狗
        日本語: 素早い茶色のキツネが怠け者の犬を飛び越える
      `.repeat(100)
      
      const result = await benchmark.measure('Mixed encodings', () => {
        const normalized = createNormalizedDocument(mixedDoc)
        return findValueInNormalizedDocument('fox', 'text', normalized, mixedDoc)
      }, 10)
      
      expect(result.avgDuration).toBeLessThan(1000) // < 1s
    })
  })
  
  describe('Performance Regression Tests', () => {
    test('should maintain consistent performance across runs', async () => {
      const doc = generateLargeDocument(czechTestDocument, 10)
      const measurements = []
      
      // Run the same operation multiple times
      for (let i = 0; i < 10; i++) {
        const result = await benchmark.measure(`Consistency test ${i}`, () => {
          const normalized = createNormalizedDocument(doc)
          return findValueInNormalizedDocument('Jan Novák', 'text', normalized, doc)
        }, 1)
        
        measurements.push(result.avgDuration)
      }
      
      // Calculate coefficient of variation (std dev / mean)
      const mean = measurements.reduce((sum, val) => sum + val, 0) / measurements.length
      const variance = measurements.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / measurements.length
      const stdDev = Math.sqrt(variance)
      const coefficientOfVariation = stdDev / mean
      
      // Performance should be consistent (CV < 50%)
      expect(coefficientOfVariation).toBeLessThan(0.5)
    })
    
    test('should not degrade with multiple document normalizations', async () => {
      const docs = Array(100).fill(null).map(() => generateComplexDocument(1000))
      
      const firstBatch = await benchmark.measure('First batch normalization', () => {
        return docs.slice(0, 10).map(doc => createNormalizedDocument(doc))
      }, 1)
      
      const lastBatch = await benchmark.measure('Last batch normalization', () => {
        return docs.slice(-10).map(doc => createNormalizedDocument(doc))
      }, 1)
      
      // Performance should not degrade significantly (< 50% slower)
      const degradationFactor = lastBatch.avgDuration / firstBatch.avgDuration
      expect(degradationFactor).toBeLessThan(1.5)
    })
  })
})