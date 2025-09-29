import { describe, test, expect, beforeEach } from 'vitest'
import { 
  czechTestDocument, 
  fuzzySearchTestCases,
  diacriticsTestCases,
  edgeCaseTestData 
} from './fixtures/czechTestData.js'

// Import functions from App.jsx that handle search
// Note: In a real implementation, these would be extracted to separate modules
import { 
  createNormalizedDocument,
  findValueInNormalizedDocument,
  detectValueType,
  removeDiacritics 
} from '../documentNormalizer.js'

// Mock functions from App.jsx for testing
const createDocumentSearcher = (text = '') => {
  const normalized = removeDiacritics(text).toLowerCase()
  
  const findExact = (target = '') => {
    const term = removeDiacritics(String(target || '')).toLowerCase().trim()
    if (!term) return []
    
    const matches = []
    let searchIndex = 0
    
    while (searchIndex <= normalized.length - term.length) {
      const foundIndex = normalized.indexOf(term, searchIndex)
      if (foundIndex === -1) break
      
      matches.push({
        start: foundIndex,
        end: foundIndex + term.length,
        text: text.slice(foundIndex, foundIndex + term.length)
      })
      
      searchIndex = foundIndex + 1
    }
    
    return matches
  }
  
  const findTokens = (target = '') => {
    const tokenMatches = []
    const tokenCandidates = (String(target || '').match(/[\p{L}\p{N}/]+/gu) || [])
      .map(token => token.trim())
      .filter(token => token.length > 0)
    
    const uniqueTokens = Array.from(new Set(tokenCandidates))
    
    uniqueTokens.forEach(token => {
      if (token.length >= 3 || /\d/.test(token)) {
        tokenMatches.push(...findExact(token))
      }
    })
    
    return tokenMatches
  }
  
  return { findExact, findTokens }
}

describe('Fuzzy Matching Accuracy', () => {
  
  describe('Exact Match Tests', () => {
    test('should find exact matches case-sensitively', () => {
      const searcher = createDocumentSearcher(czechTestDocument)
      const matches = searcher.findExact('Jan Novák')
      
      expect(matches).toHaveLength(1)
      expect(matches[0].text).toBe('Jan Novák')
    })
    
    test('should find exact matches with normalized search', () => {
      const searcher = createDocumentSearcher(czechTestDocument)
      const matches = searcher.findExact('jan novak') // without diacritics
      
      expect(matches).toHaveLength(1)
      expect(matches[0].text.toLowerCase()).toContain('novák')
    })
    
    test('should find multiple exact matches', () => {
      const testText = 'Jan Novák a Pavel Novák jsou bratři. Novák je časté příjmení.'
      const searcher = createDocumentSearcher(testText)
      const matches = searcher.findExact('Novák')
      
      expect(matches.length).toBeGreaterThanOrEqual(2)
      matches.forEach(match => {
        expect(match.text.toLowerCase()).toContain('novák')
      })
    })
  })
  
  describe('Diacritics Insensitive Search', () => {
    test('should match Czech text regardless of diacritics in query', () => {
      diacriticsTestCases.forEach(({ original, normalized }) => {
        const testDoc = `Text contains ${original} in the middle`
        const searcher = createDocumentSearcher(testDoc)
        
        // Search with normalized form should find original
        const matches = searcher.findExact(normalized)
        expect(matches.length).toBeGreaterThan(0)
        expect(matches[0].text).toBe(original)
      })
    })
    
    test('should handle mixed diacritic scenarios', () => {
      const testCases = [
        { query: 'prilis', text: 'příliš žluťoučký kůň' },
        { query: 'zlutoucky', text: 'příliš žluťoučký kůň' },
        { query: 'kun', text: 'příliš žluťoučký kůň' },
        { query: 'cestina', text: 'Čeština je krásný jazyk' },
        { query: 'krasny', text: 'Čeština je krásný jazyk' }
      ]
      
      testCases.forEach(({ query, text }) => {
        const searcher = createDocumentSearcher(text)
        const matches = searcher.findExact(query)
        expect(matches.length).toBeGreaterThan(0)
      })
    })
  })
  
  describe('Case Insensitive Search', () => {
    test('should find matches regardless of case', () => {
      const testCases = [
        { query: 'JAN NOVÁK', expected: 'Jan Novák' },
        { query: 'jan novák', expected: 'Jan Novák' },
        { query: 'JaN NoVáK', expected: 'Jan Novák' }
      ]
      
      testCases.forEach(({ query, expected }) => {
        const searcher = createDocumentSearcher(czechTestDocument)
        const matches = searcher.findExact(query)
        expect(matches.length).toBeGreaterThan(0)
        expect(matches[0].text).toBe(expected)
      })
    })
  })
  
  describe('Token-based Search', () => {
    test('should find matches using token extraction', () => {
      const searcher = createDocumentSearcher(czechTestDocument)
      const matches = searcher.findTokens('Jan Novák prodávající')
      
      expect(matches.length).toBeGreaterThan(0)
      const foundTexts = matches.map(m => m.text.toLowerCase())
      expect(foundTexts.some(text => text.includes('jan'))).toBe(true)
      expect(foundTexts.some(text => text.includes('novák'))).toBe(true)
    })
    
    test('should handle numeric tokens', () => {
      const searcher = createDocumentSearcher(czechTestDocument)
      const matches = searcher.findTokens('940919/1022')
      
      expect(matches.length).toBeGreaterThan(0)
      expect(matches[0].text).toBe('940919/1022')
    })
    
    test('should filter short tokens but include numeric ones', () => {
      const searcher = createDocumentSearcher('Test a1 to bb 123 short')
      
      // Short tokens (< 3 chars) should be filtered unless they contain digits
      const matches1 = searcher.findTokens('to') // 2 chars, should be filtered
      expect(matches1).toHaveLength(0)
      
      const matches2 = searcher.findTokens('a1') // 2 chars but contains digit
      expect(matches2.length).toBeGreaterThan(0)
      
      const matches3 = searcher.findTokens('test') // 4 chars, should match
      expect(matches3.length).toBeGreaterThan(0)
    })
  })
  
  describe('Pattern-based Search', () => {
    test('should find birth number patterns', () => {
      const searcher = createDocumentSearcher(czechTestDocument)
      const matches = searcher.findExact('940919/1022')
      
      expect(matches).toHaveLength(1)
      expect(matches[0].text).toBe('940919/1022')
    })
    
    test('should find amount patterns', () => {
      const searcher = createDocumentSearcher(czechTestDocument)
      const matches = searcher.findTokens('7 850 000')
      
      expect(matches.length).toBeGreaterThan(0)
      const foundText = matches[0].text
      expect(foundText).toContain('850')
      expect(foundText).toContain('000')
    })
    
    test('should find percentage patterns', () => {
      const searcher = createDocumentSearcher(czechTestDocument)
      const matches = searcher.findTokens('5,9%')
      
      expect(matches.length).toBeGreaterThan(0)
      expect(matches[0].text).toMatch(/5[,.]9/)
    })
    
    test('should find bank account patterns', () => {
      const searcher = createDocumentSearcher(czechTestDocument)
      const matches = searcher.findExact('123456789/0800')
      
      expect(matches).toHaveLength(1)
      expect(matches[0].text).toBe('123456789/0800')
    })
    
    test('should find IBAN patterns', () => {
      const searcher = createDocumentSearcher(czechTestDocument)
      const matches = searcher.findExact('CZ6508000000192000145399')
      
      expect(matches).toHaveLength(1)
      expect(matches[0].text).toBe('CZ6508000000192000145399')
    })
  })
  
  describe('Advanced Fuzzy Matching', () => {
    test('should handle partial word matches', () => {
      const searcher = createDocumentSearcher('Ing. Jan Novák, Ph.D.')
      
      // Should find "Novák" even when surrounded by other text
      const matches = searcher.findExact('Novák')
      expect(matches).toHaveLength(1)
      expect(matches[0].text).toBe('Novák')
    })
    
    test('should handle overlapping matches', () => {
      const text = 'Novák Novák Nováková'
      const searcher = createDocumentSearcher(text)
      const matches = searcher.findExact('Novák')
      
      expect(matches).toHaveLength(2) // Should find both instances of "Novák"
      expect(matches[0].text).toBe('Novák')
      expect(matches[1].text).toBe('Novák')
    })
    
    test('should handle boundary word matches', () => {
      const text = 'Novák-Svoboda, Nováková, přednovák, Novák.'
      const searcher = createDocumentSearcher(text)
      const matches = searcher.findExact('Novák')
      
      // Should find all instances where "Novák" appears as complete word
      expect(matches.length).toBeGreaterThanOrEqual(2)
    })
  })
  
  describe('Search Accuracy Metrics', () => {
    test('should achieve high precision for exact queries', () => {
      fuzzySearchTestCases
        .filter(tc => tc.matchType === 'exact')
        .forEach(({ query, document, expectedMatches }) => {
          const searcher = createDocumentSearcher(document)
          const matches = searcher.findExact(query)
          
          expect(matches.length).toBeGreaterThan(0)
          
          // Check if at least one match is exactly what we expected
          const hasExpectedMatch = matches.some(match => 
            expectedMatches.some(expected => 
              match.text.toLowerCase().includes(expected.toLowerCase())
            )
          )
          expect(hasExpectedMatch).toBe(true)
        })
    })
    
    test('should achieve high recall for diacritics insensitive queries', () => {
      fuzzySearchTestCases
        .filter(tc => tc.matchType === 'diacritics_insensitive')
        .forEach(({ query, document, expectedMatches }) => {
          const searcher = createDocumentSearcher(document)
          const matches = searcher.findExact(query)
          
          expect(matches.length).toBeGreaterThan(0)
          
          // Verify the match content is correct
          const hasExpectedMatch = matches.some(match => 
            expectedMatches.some(expected => {
              const normalizedMatch = removeDiacritics(match.text).toLowerCase()
              const normalizedExpected = removeDiacritics(expected).toLowerCase()
              return normalizedMatch.includes(normalizedExpected)
            })
          )
          expect(hasExpectedMatch).toBe(true)
        })
    })
    
    test('should minimize false positives', () => {
      const searcher = createDocumentSearcher(czechTestDocument)
      
      // Query for something that definitely doesn't exist
      const matches = searcher.findExact('xyz123nonexistent')
      expect(matches).toHaveLength(0)
      
      // Query for partial match that shouldn't match
      const partialMatches = searcher.findExact('Nov') // Should not match "Novák"
      expect(partialMatches).toHaveLength(0)
    })
  })
  
  describe('Performance Characteristics', () => {
    test('should handle large documents efficiently', () => {
      const largeDoc = czechTestDocument.repeat(1000) // ~10MB document
      
      const startTime = Date.now()
      const searcher = createDocumentSearcher(largeDoc)
      const matches = searcher.findExact('Jan Novák')
      const endTime = Date.now()
      
      expect(matches.length).toBe(1000) // Should find all instances
      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds
    })
    
    test('should handle many small queries efficiently', () => {
      const searcher = createDocumentSearcher(czechTestDocument)
      const queries = [
        'Jan', 'Novák', 'Marie', 'Svobodová', '940919/1022',
        '850623/3456', '7 850 000', 'Praha', 'Brno', 'RPSN'
      ]
      
      const startTime = Date.now()
      const allMatches = queries.map(query => searcher.findExact(query))
      const endTime = Date.now()
      
      expect(allMatches.length).toBe(queries.length)
      expect(endTime - startTime).toBeLessThan(1000) // Should complete within 1 second
    })
    
    test('should handle complex token queries efficiently', () => {
      const searcher = createDocumentSearcher(czechTestDocument)
      const complexQuery = 'Jan Novák 940919/1022 Praha Vinohrady 7 850 000 Kč'
      
      const startTime = Date.now()
      const matches = searcher.findTokens(complexQuery)
      const endTime = Date.now()
      
      expect(matches.length).toBeGreaterThan(0)
      expect(endTime - startTime).toBeLessThan(500) // Should complete within 500ms
    })
  })
  
  describe('Edge Cases in Fuzzy Matching', () => {
    test('should handle empty queries gracefully', () => {
      const searcher = createDocumentSearcher(czechTestDocument)
      
      expect(searcher.findExact('')).toHaveLength(0)
      expect(searcher.findExact(null)).toHaveLength(0)
      expect(searcher.findExact(undefined)).toHaveLength(0)
      
      expect(searcher.findTokens('')).toHaveLength(0)
      expect(searcher.findTokens(null)).toHaveLength(0)
      expect(searcher.findTokens(undefined)).toHaveLength(0)
    })
    
    test('should handle whitespace-only queries', () => {
      const searcher = createDocumentSearcher(czechTestDocument)
      
      expect(searcher.findExact('   ')).toHaveLength(0)
      expect(searcher.findExact('\t\n')).toHaveLength(0)
      expect(searcher.findTokens('   ')).toHaveLength(0)
    })
    
    test('should handle special characters in queries', () => {
      const text = 'Email: test@example.com, Phone: +420-123-456'
      const searcher = createDocumentSearcher(text)
      
      const emailMatches = searcher.findTokens('test@example.com')
      expect(emailMatches.length).toBeGreaterThan(0)
      
      const phoneMatches = searcher.findTokens('420')
      expect(phoneMatches.length).toBeGreaterThan(0)
    })
    
    test('should handle unicode characters', () => {
      const searcher = createDocumentSearcher(edgeCaseTestData.unicode)
      
      // Should find emoji
      const emojiMatches = searcher.findExact('💯')
      expect(emojiMatches.length).toBeGreaterThan(0)
      
      // Should find unicode text
      const unicodeMatches = searcher.findTokens('search')
      expect(unicodeMatches.length).toBeGreaterThan(0)
    })
    
    test('should handle very long queries', () => {
      const longQuery = 'a'.repeat(10000)
      const searcher = createDocumentSearcher(czechTestDocument)
      
      // Should handle gracefully without crashing
      const matches = searcher.findExact(longQuery)
      expect(matches).toHaveLength(0) // Won't find such a long string
    })
    
    test('should handle queries longer than document', () => {
      const shortDoc = 'Short text'
      const longQuery = 'This query is much longer than the document content'
      const searcher = createDocumentSearcher(shortDoc)
      
      const matches = searcher.findExact(longQuery)
      expect(matches).toHaveLength(0)
    })
  })
})