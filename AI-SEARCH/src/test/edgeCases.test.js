import { describe, test, expect, beforeEach } from 'vitest'
import { edgeCaseTestData, czechTestDocument } from './fixtures/czechTestData.js'
import {
  createNormalizedDocument,
  findValueInNormalizedDocument,
  detectValueType,
  removeDiacritics,
  validators,
  normalizeValue,
  extractIndividualValues
} from '../documentNormalizer.js'

describe('Edge Cases and Robustness Tests', () => {
  
  describe('Null and Undefined Input Handling', () => {
    test('should handle null inputs gracefully', () => {
      expect(() => createNormalizedDocument(null)).not.toThrow()
      expect(() => removeDiacritics(null)).not.toThrow()
      expect(() => detectValueType(null)).not.toThrow()
      expect(() => normalizeValue(null, 'text')).not.toThrow()
      
      const result = createNormalizedDocument(null)
      expect(result.normalized).toBe('')
      expect(result.indexMap).toEqual([])
    })
    
    test('should handle undefined inputs gracefully', () => {
      expect(() => createNormalizedDocument(undefined)).not.toThrow()
      expect(() => removeDiacritics(undefined)).not.toThrow()
      expect(() => detectValueType(undefined)).not.toThrow()
      expect(() => normalizeValue(undefined, 'text')).not.toThrow()
      
      const result = createNormalizedDocument(undefined)
      expect(result.normalized).toBe('')
    })
    
    test('should handle empty string inputs', () => {
      const emptyResult = createNormalizedDocument('')
      expect(emptyResult.normalized).toBe('')
      expect(emptyResult.indexMap).toEqual([])
      expect(emptyResult.reverseMap.size).toBe(0)
      
      expect(removeDiacritics('')).toBe('')
      expect(detectValueType('')).toBe('unknown')
      expect(normalizeValue('', 'text')).toBe('')
    })
    
    test('should handle whitespace-only inputs', () => {
      const whitespaceResult = createNormalizedDocument('   \n\t  ')
      expect(whitespaceResult.normalized).toBe('   \n\t  ')
      expect(whitespaceResult.indexMap.length).toBeGreaterThan(0)
      
      expect(removeDiacritics('   ')).toBe('   ')
      expect(normalizeValue('   ', 'text')).toBe('')
    })
  })
  
  describe('Extreme Input Sizes', () => {
    test('should handle very large documents', () => {
      const veryLargeText = 'A'.repeat(1000000) // 1MB of text
      
      expect(() => {
        const result = createNormalizedDocument(veryLargeText)
        expect(result.normalized.length).toBe(1000000)
      }).not.toThrow()
    })
    
    test('should handle very long single lines', () => {
      const longLine = 'This is an extremely long line that goes on and on without any breaks or newlines and contains various Czech characters like žluťoučký kůň úpěl ďábelské ódy throughout the text. '.repeat(1000)
      
      expect(() => {
        const result = createNormalizedDocument(longLine)
        expect(result.normalized.length).toBeGreaterThan(0)
      }).not.toThrow()
    })
    
    test('should handle documents with many short lines', () => {
      const manyLines = Array(10000).fill('Short line').join('\n')
      
      expect(() => {
        const result = createNormalizedDocument(manyLines)
        expect(result.normalized.length).toBeGreaterThan(0)
      }).not.toThrow()
    })
    
    test('should handle single character input', () => {
      const result = createNormalizedDocument('a')
      expect(result.normalized).toBe('a')
      expect(result.indexMap).toEqual([0])
    })
    
    test('should handle single diacritic character', () => {
      const result = createNormalizedDocument('ř')
      expect(result.normalized).toBe('r')
      expect(result.indexMap).toEqual([0])
    })
  })
  
  describe('Unicode and Special Character Handling', () => {
    test('should handle emoji characters', () => {
      const emojiText = '🔍 Search 💯 Test 🎯'
      
      const result = createNormalizedDocument(emojiText)
      expect(result.normalized).toContain('search')
      expect(result.normalized).toContain('test')
      
      const normalizedDoc = createNormalizedDocument(emojiText)
      const matches = findValueInNormalizedDocument('search', 'text', normalizedDoc, emojiText)
      expect(matches.length).toBeGreaterThan(0)
    })
    
    test('should handle various Unicode blocks', () => {
      const unicodeText = `
        Latin: Žluťoučký kůň
        Cyrillic: Быстрая лиса
        Arabic: النص العربي
        CJK: 中文测试
        Greek: Ελληνικά
        Hebrew: עברית
      `
      
      expect(() => {
        const result = createNormalizedDocument(unicodeText)
        expect(result.normalized.length).toBeGreaterThan(0)
      }).not.toThrow()
    })
    
    test('should handle combining characters', () => {
      // Text with combining diacritics
      const combiningText = 'e\u0301' + 'a\u030A' // é and å using combining marks
      
      const result = createNormalizedDocument(combiningText)
      expect(result.normalized).toBeDefined()
      expect(result.indexMap).toBeDefined()
    })
    
    test('should handle zero-width characters', () => {
      const zeroWidthText = 'Test\u200B\u200C\u200D\uFEFFText' // Various zero-width chars
      
      const result = createNormalizedDocument(zeroWidthText)
      expect(result.normalized).toContain('test')
      expect(result.normalized).toContain('text')
    })
    
    test('should handle right-to-left text', () => {
      const rtlText = 'Text العربية Text' // Mixed LTR and RTL
      
      expect(() => {
        const result = createNormalizedDocument(rtlText)
        expect(result.normalized.length).toBeGreaterThan(0)
      }).not.toThrow()
    })
  })
  
  describe('Malformed and Corrupted Input', () => {
    test('should handle text with control characters', () => {
      const controlText = 'Text\x00\x01\x02\x03\x04\x05with\x06\x07\x08\x09control'
      
      expect(() => {
        const result = createNormalizedDocument(controlText)
        expect(result.normalized).toContain('text')
        expect(result.normalized).toContain('with')
        expect(result.normalized).toContain('control')
      }).not.toThrow()
    })
    
    test('should handle incomplete Unicode sequences', () => {
      // Simulate incomplete UTF-8 sequences (these might be handled by JS engine)
      const malformedText = 'Valid text \uFFFD replacement character'
      
      expect(() => {
        const result = createNormalizedDocument(malformedText)
        expect(result.normalized).toContain('valid')
        expect(result.normalized).toContain('text')
      }).not.toThrow()
    })
    
    test('should handle mixed encoding artifacts', () => {
      // Common encoding issues
      const mixedText = 'Žluťoučký → Åœlu»ouÄkÃ½' // Czech text with encoding issues
      
      expect(() => {
        const result = createNormalizedDocument(mixedText)
        expect(result.normalized.length).toBeGreaterThan(0)
      }).not.toThrow()
    })
    
    test('should handle excessive whitespace and newlines', () => {
      const excessiveWhitespace = '   \n\n\n\n\t\t\t   Test   \n\n\n   Text   \t\t\t   '
      
      const result = createNormalizedDocument(excessiveWhitespace)
      expect(result.normalized).toContain('test')
      expect(result.normalized).toContain('text')
    })
  })
  
  describe('Search Pattern Edge Cases', () => {
    test('should handle regex special characters in search queries', () => {
      const doc = 'Price: $1,000.50 (incl. tax) [final]'
      const normalizedDoc = createNormalizedDocument(doc)
      
      // Characters that are special in regex
      const specialChars = ['$', '.', '(', ')', '[', ']', '*', '+', '?', '^', '|']
      
      specialChars.forEach(char => {
        expect(() => {
          findValueInNormalizedDocument(char, 'text', normalizedDoc, doc)
        }).not.toThrow()
      })
    })
    
    test('should handle very short search queries', () => {
      const normalizedDoc = createNormalizedDocument(czechTestDocument)
      
      // Single character searches
      const matches1 = findValueInNormalizedDocument('J', 'text', normalizedDoc, czechTestDocument)
      expect(matches1.length).toBeGreaterThan(0)
      
      // Two character searches
      const matches2 = findValueInNormalizedDocument('Ja', 'text', normalizedDoc, czechTestDocument)
      expect(matches2.length).toBeGreaterThan(0)
    })
    
    test('should handle very long search queries', () => {
      const longQuery = 'This is a very long search query that is much longer than typical user input and should be handled gracefully by the search algorithm without causing any performance issues or crashes'
      const normalizedDoc = createNormalizedDocument(czechTestDocument)
      
      expect(() => {
        const matches = findValueInNormalizedDocument(longQuery, 'text', normalizedDoc, czechTestDocument)
        expect(Array.isArray(matches)).toBe(true)
      }).not.toThrow()
    })
    
    test('should handle queries with only special characters', () => {
      const doc = 'Test!@#$%^&*()_+-=[]{}|;:,.<>?'
      const normalizedDoc = createNormalizedDocument(doc)
      
      const specialQuery = '!@#$%^&*()'
      
      expect(() => {
        findValueInNormalizedDocument(specialQuery, 'text', normalizedDoc, doc)
      }).not.toThrow()
    })
    
    test('should handle queries with mixed scripts', () => {
      const mixedDoc = 'Test Žluťoučký كلمة 中文 Тест'
      const normalizedDoc = createNormalizedDocument(mixedDoc)
      
      const mixedQuery = 'Test Žluťoučký'
      const matches = findValueInNormalizedDocument(mixedQuery, 'text', normalizedDoc, mixedDoc)
      
      // Should handle mixed script queries gracefully
      expect(Array.isArray(matches)).toBe(true)
    })
  })
  
  describe('Validation Edge Cases', () => {
    test('should handle invalid birth number formats robustly', () => {
      const invalidBirthNumbers = [
        '', '123', '123456789', 'abc/def', '940919/', '/1022',
        '940919\\1022', '940919-1022', '94091/1022', '940919/10222',
        null, undefined, '   ', '\n\t'
      ]
      
      invalidBirthNumbers.forEach(invalid => {
        expect(() => {
          const result = validators.birthNumber(invalid)
          expect(typeof result).toBe('boolean')
        }).not.toThrow()
      })
    })
    
    test('should handle malformed amounts gracefully', () => {
      const invalidAmounts = [
        '', 'abc Kč', '1,2,3,4 EUR', '99999999999999999999999 Kč',
        '1.2.3.4 USD', 'Kč 1000', '1000 CZK EUR', null, undefined
      ]
      
      invalidAmounts.forEach(invalid => {
        expect(() => {
          const result = validators.amount(invalid)
          expect(typeof result).toBe('boolean')
        }).not.toThrow()
      })
    })
    
    test('should handle corrupted IBAN formats', () => {
      const invalidIbans = [
        '', 'CZ', 'CZ65', 'CZ6508000000192000145399123456', // Too long
        'XX6508000000192000145399', // Invalid country
        'CZ65080000001920001453', // Too short
        'cz6508000000192000145399', // Wrong case (should fail basic validation)
        null, undefined, '   \n\t'
      ]
      
      invalidIbans.forEach(invalid => {
        expect(() => {
          const result = validators.iban(invalid)
          expect(typeof result).toBe('boolean')
        }).not.toThrow()
      })
    })
  })
  
  describe('Index Mapping Edge Cases', () => {
    test('should handle index mapping with extreme document modifications', () => {
      // Document with complex markdown that gets heavily modified
      const complexMarkdown = `
        # **Bold _Italic_ Text**
        ## List with *emphasis*:
        - ***Item 1*** with \`code\`
        - [Link](url) to **resource**
        - ~~Strikethrough~~ text
        
        \`\`\`
        Code block content
        \`\`\`
      `
      
      const result = createNormalizedDocument(complexMarkdown)
      
      expect(result.normalized).toBeDefined()
      expect(result.indexMap).toBeDefined()
      expect(result.reverseMap).toBeDefined()
      
      // Index mapping should be consistent
      for (let i = 0; i < result.indexMap.length; i++) {
        const originalIndex = result.indexMap[i]
        expect(originalIndex).toBeGreaterThanOrEqual(0)
        expect(originalIndex).toBeLessThan(complexMarkdown.length)
      }
    })
    
    test('should handle documents where normalization significantly reduces length', () => {
      // Document with lots of markdown and diacritics
      const heavily_marked = '**ěščřžý**'.repeat(1000)
      
      const result = createNormalizedDocument(heavily_marked)
      
      expect(result.normalized.length).toBeLessThan(heavily_marked.length)
      expect(result.indexMap.length).toBe(result.normalized.length)
    })
    
    test('should handle empty sections after markdown removal', () => {
      const emptyAfterRemoval = '**bold** ~~strike~~ *italic*'
      
      const result = createNormalizedDocument(emptyAfterRemoval)
      
      expect(result.normalized).toBe('bold strike italic')
      expect(result.indexMap.length).toBe(result.normalized.length)
    })
  })
  
  describe('Extraction Edge Cases', () => {
    test('should handle AI responses with malformed JSON-like content', () => {
      const malformedResponses = [
        '{"name": "Jan", "birth": 940919/1022}', // Invalid JSON
        'Found: Jan Novák (940919/1022) and Marie (850623/3456', // Unclosed paren
        'Results: 940919/1022; 850623/3456; incomplete', // Mixed separators
        'Birth numbers: 940919/1022, 850623/3456, invalid/format', // Mixed valid/invalid
      ]
      
      malformedResponses.forEach(response => {
        expect(() => {
          const matches = extractIndividualValues(response, czechTestDocument)
          expect(Array.isArray(matches)).toBe(true)
        }).not.toThrow()
      })
    })
    
    test('should handle responses with excessive matches', () => {
      // Response claiming to find the same item many times
      const excessiveResponse = Array(10000).fill('Jan Novák').join(', ')
      
      expect(() => {
        const matches = extractIndividualValues(excessiveResponse, czechTestDocument)
        expect(Array.isArray(matches)).toBe(true)
        // Should deduplicate matches
        expect(matches.length).toBeLessThan(100)
      }).not.toThrow()
    })
    
    test('should handle responses with no actual matches in document', () => {
      const nonExistentResponse = 'Found: Nonexistent Person (123456/7890), Fake Amount: 999 999 999 Kč'
      
      const matches = extractIndividualValues(nonExistentResponse, czechTestDocument)
      expect(matches).toEqual([])
    })
    
    test('should handle responses with mixed languages', () => {
      const mixedResponse = `
        Names: Jan Novák, Marie Svobodová
        Имена: Иван Иванов, Мария Петрова  
        Names: John Smith, Jane Doe
        أسماء: محمد أحمد، فاطمة علي
      `
      
      expect(() => {
        const matches = extractIndividualValues(mixedResponse, czechTestDocument)
        expect(Array.isArray(matches)).toBe(true)
      }).not.toThrow()
    })
  })
  
  describe('Memory and Resource Edge Cases', () => {
    test('should handle circular references in complex objects', () => {
      // Test that functions don't break with unusual input types
      const circular = {}
      circular.self = circular
      
      expect(() => {
        detectValueType(circular)
        normalizeValue(circular, 'text')
      }).not.toThrow()
    })
    
    test('should handle very deep object structures', () => {
      let deepObject = 'base'
      for (let i = 0; i < 1000; i++) {
        deepObject = { nested: deepObject }
      }
      
      expect(() => {
        detectValueType(deepObject)
        normalizeValue(deepObject, 'text')
      }).not.toThrow()
    })
    
    test('should handle functions and other non-string types', () => {
      const weirdInputs = [
        function() { return 'test' },
        { toString: () => 'object' },
        [1, 2, 3],
        new Date(),
        /regex/,
        Symbol('test')
      ]
      
      weirdInputs.forEach(input => {
        expect(() => {
          detectValueType(input)
          normalizeValue(input, 'text')
          removeDiacritics(input)
        }).not.toThrow()
      })
    })
  })
  
  describe('Concurrency and State Edge Cases', () => {
    test('should handle concurrent normalization operations', async () => {
      const docs = Array(100).fill(czechTestDocument)
      
      // Start multiple normalization operations simultaneously
      const promises = docs.map(doc => 
        Promise.resolve(createNormalizedDocument(doc))
      )
      
      const results = await Promise.all(promises)
      
      // All should succeed and produce identical results
      results.forEach(result => {
        expect(result.normalized).toBe(results[0].normalized)
        expect(result.indexMap.length).toBe(results[0].indexMap.length)
      })
    })
    
    test('should maintain thread safety with shared resources', async () => {
      const sharedDoc = czechTestDocument
      const normalizedDoc = createNormalizedDocument(sharedDoc)
      
      const queries = [
        'Jan Novák', 'Marie Svobodová', '940919/1022', '850623/3456',
        'Praha', 'Brno', '7 850 000', 'RPSN', 'smlouva', 'kupní cena'
      ]
      
      // Perform multiple searches simultaneously
      const promises = queries.map(query =>
        Promise.resolve(findValueInNormalizedDocument(
          query, 
          detectValueType(query), 
          normalizedDoc, 
          sharedDoc
        ))
      )
      
      expect(() => Promise.all(promises)).not.toThrow()
    })
  })
  
  describe('Browser Compatibility Edge Cases', () => {
    test('should handle environments without certain modern features', () => {
      // Simulate missing features
      const originalPromise = global.Promise
      const originalSymbol = global.Symbol
      
      try {
        // Test with missing Promise (should not affect our functions directly)
        global.Promise = undefined
        
        expect(() => {
          createNormalizedDocument(czechTestDocument)
          removeDiacritics('žluťoučký')
          detectValueType('940919/1022')
        }).not.toThrow()
        
        // Test with missing Symbol
        global.Symbol = undefined
        
        expect(() => {
          createNormalizedDocument(czechTestDocument)
        }).not.toThrow()
        
      } finally {
        // Restore original features
        global.Promise = originalPromise
        global.Symbol = originalSymbol
      }
    })
    
    test('should handle different newline conventions', () => {
      const docs = [
        'Line1\nLine2\nLine3',      // Unix (LF)
        'Line1\r\nLine2\r\nLine3',  // Windows (CRLF)
        'Line1\rLine2\rLine3',      // Mac Classic (CR)
        'Line1\n\rLine2\r\nLine3'   // Mixed
      ]
      
      docs.forEach(doc => {
        expect(() => {
          const result = createNormalizedDocument(doc)
          expect(result.normalized).toContain('line1')
          expect(result.normalized).toContain('line2')
          expect(result.normalized).toContain('line3')
        }).not.toThrow()
      })
    })
  })
})