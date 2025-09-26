import { describe, test, expect, beforeEach } from 'vitest'
import {
  removeDiacritics,
  removeMarkdown,
  createNormalizedDocument,
  mapNormalizedToOriginal,
  mapRangeToOriginal,
  validators,
  normalizeValue,
  detectValueType,
  findValueInNormalizedDocument,
  extractIndividualValues
} from '../documentNormalizer.js'
import { 
  diacriticsTestCases, 
  validationTestCases,
  czechTestDocument,
  edgeCaseTestData 
} from './fixtures/czechTestData.js'

describe('Document Normalization', () => {
  
  describe('removeDiacritics', () => {
    test('should remove Czech diacritics correctly', () => {
      diacriticsTestCases.forEach(({ original, normalized }) => {
        expect(removeDiacritics(original).toLowerCase()).toBe(normalized)
      })
    })
    
    test('should handle empty and null inputs', () => {
      expect(removeDiacritics('')).toBe('')
      expect(removeDiacritics(null)).toBe('')
      expect(removeDiacritics(undefined)).toBe('')
    })
    
    test('should preserve non-diacritic characters', () => {
      const input = 'abc123 !@# XYZ'
      expect(removeDiacritics(input)).toBe(input)
    })
    
    test('should handle mixed diacritic and non-diacritic text', () => {
      const input = 'Test123 žluťoučký!@# ABC'
      const expected = 'Test123 zlutoucky!@# ABC'
      expect(removeDiacritics(input)).toBe(expected)
    })
  })
  
  describe('removeMarkdown', () => {
    test('should remove bold markdown', () => {
      expect(removeMarkdown('**bold text**')).toBe('bold text')
      expect(removeMarkdown('__bold text__')).toBe('bold text')
    })
    
    test('should remove italic markdown', () => {
      expect(removeMarkdown('*italic text*')).toBe('italic text')
      expect(removeMarkdown('_italic text_')).toBe('italic text')
    })
    
    test('should remove strikethrough', () => {
      expect(removeMarkdown('~~strikethrough~~')).toBe('strikethrough')
    })
    
    test('should remove inline code', () => {
      expect(removeMarkdown('`code`')).toBe('code')
    })
    
    test('should remove headers', () => {
      expect(removeMarkdown('# Header 1')).toBe('Header 1')
      expect(removeMarkdown('## Header 2')).toBe('Header 2')
      expect(removeMarkdown('### Header 3')).toBe('Header 3')
    })
    
    test('should remove list items', () => {
      expect(removeMarkdown('- List item')).toBe('List item')
      expect(removeMarkdown('* List item')).toBe('List item')
      expect(removeMarkdown('+ List item')).toBe('List item')
      expect(removeMarkdown('1. Numbered item')).toBe('Numbered item')
    })
    
    test('should remove links', () => {
      expect(removeMarkdown('[text](url)')).toBe('text')
      expect(removeMarkdown('[link](http://example.com)')).toBe('link')
    })
    
    test('should handle complex markdown', () => {
      const input = `
        # Header
        **Bold** and *italic* text with [link](url)
        - List item with \`code\`
        ~~strikethrough~~ text
      `
      const result = removeMarkdown(input)
      expect(result).not.toContain('**')
      expect(result).not.toContain('*')
      expect(result).not.toContain('[')
      expect(result).not.toContain('](')
      expect(result).not.toContain('`')
      expect(result).not.toContain('#')
      expect(result).not.toContain('~~')
      expect(result).not.toContain('- ')
    })
  })
  
  describe('createNormalizedDocument', () => {
    test('should create normalized document with index mapping', () => {
      const input = 'Žluťoučký kůň'
      const result = createNormalizedDocument(input)
      
      expect(result.normalized).toBe('zlutoucky kun')
      expect(result.indexMap).toBeDefined()
      expect(result.reverseMap).toBeDefined()
      expect(result.withoutMarkdown).toBe(input) // No markdown in this case
    })
    
    test('should handle empty input', () => {
      const result = createNormalizedDocument('')
      expect(result.normalized).toBe('')
      expect(result.indexMap).toEqual([])
      expect(result.reverseMap.size).toBe(0)
    })
    
    test('should handle markdown removal and normalization', () => {
      const input = '**Žluťoučký** kůň'
      const result = createNormalizedDocument(input)
      
      expect(result.normalized).toBe('zlutoucky kun')
      expect(result.withoutMarkdown).toBe('Žluťoučký kůň')
      expect(result.indexMap).toBeDefined()
    })
    
    test('should maintain correct index mapping', () => {
      const input = 'ABC žluť DEF'
      const result = createNormalizedDocument(input)
      
      // Test that we can map back correctly
      const originalLength = input.length
      expect(result.indexMap.length).toBeLessThanOrEqual(originalLength)
      
      // First char should map to index 0
      expect(result.indexMap[0]).toBe(0)
    })
  })
  
  describe('Index Mapping Functions', () => {
    let normalizedDoc
    
    beforeEach(() => {
      normalizedDoc = createNormalizedDocument('ABC žluť XYZ')
    })
    
    test('mapNormalizedToOriginal should map indices correctly', () => {
      // Test valid indices
      const originalIndex = mapNormalizedToOriginal(0, normalizedDoc.indexMap)
      expect(originalIndex).toBe(0)
      
      // Test boundary conditions
      const lastIndex = mapNormalizedToOriginal(
        normalizedDoc.indexMap.length - 1, 
        normalizedDoc.indexMap
      )
      expect(lastIndex).toBeGreaterThanOrEqual(0)
    })
    
    test('mapNormalizedToOriginal should handle invalid indices', () => {
      // Test negative index
      expect(mapNormalizedToOriginal(-1, normalizedDoc.indexMap)).toBe(-1)
      
      // Test index beyond array
      const largeIndex = normalizedDoc.indexMap.length + 100
      expect(mapNormalizedToOriginal(largeIndex, normalizedDoc.indexMap))
        .toBe(largeIndex)
    })
    
    test('mapRangeToOriginal should map ranges correctly', () => {
      const range = mapRangeToOriginal(0, 3, normalizedDoc.indexMap)
      
      expect(range.start).toBeDefined()
      expect(range.end).toBeDefined()
      expect(range.start).toBeLessThanOrEqual(range.end)
    })
  })
})

describe('Value Validation', () => {
  
  describe('validators.birthNumber', () => {
    test('should validate correct birth number formats', () => {
      validationTestCases.birthNumbers
        .filter(tc => tc.valid)
        .forEach(({ value }) => {
          expect(validators.birthNumber(value)).toBe(true)
        })
    })
    
    test('should reject incorrect birth number formats', () => {
      validationTestCases.birthNumbers
        .filter(tc => !tc.valid)
        .forEach(({ value }) => {
          expect(validators.birthNumber(value)).toBe(false)
        })
    })
  })
  
  describe('validators.amount', () => {
    test('should validate correct amount formats', () => {
      validationTestCases.amounts
        .filter(tc => tc.valid)
        .forEach(({ value }) => {
          expect(validators.amount(value)).toBe(true)
        })
    })
    
    test('should reject incorrect amount formats', () => {
      validationTestCases.amounts
        .filter(tc => !tc.valid) 
        .forEach(({ value }) => {
          expect(validators.amount(value)).toBe(false)
        })
    })
  })
  
  describe('validators.rpsn', () => {
    test('should validate correct RPSN formats', () => {
      validationTestCases.rpsn
        .filter(tc => tc.valid)
        .forEach(({ value }) => {
          expect(validators.rpsn(value)).toBe(true)
        })
    })
    
    test('should reject incorrect RPSN formats', () => {
      validationTestCases.rpsn
        .filter(tc => !tc.valid)
        .forEach(({ value }) => {
          expect(validators.rpsn(value)).toBe(false)
        })
    })
  })
  
  describe('validators.bankAccount', () => {
    test('should validate correct bank account formats', () => {
      validationTestCases.bankAccounts
        .filter(tc => tc.valid)
        .forEach(({ value }) => {
          expect(validators.bankAccount(value)).toBe(true)
        })
    })
    
    test('should reject incorrect bank account formats', () => {
      validationTestCases.bankAccounts
        .filter(tc => !tc.valid)
        .forEach(({ value }) => {
          expect(validators.bankAccount(value)).toBe(false)
        })
    })
  })
  
  describe('validators.iban', () => {
    test('should validate correct IBAN formats', () => {
      validationTestCases.ibans
        .filter(tc => tc.valid)
        .forEach(({ value }) => {
          expect(validators.iban(value)).toBe(true)
        })
    })
    
    test('should reject incorrect IBAN formats', () => {
      validationTestCases.ibans
        .filter(tc => !tc.valid)
        .forEach(({ value }) => {
          expect(validators.iban(value)).toBe(false)
        })
    })
  })
})

describe('Value Type Detection and Normalization', () => {
  
  describe('detectValueType', () => {
    test('should detect birth numbers', () => {
      expect(detectValueType('940919/1022')).toBe('birthNumber')
      expect(detectValueType('850623/3456')).toBe('birthNumber')
    })
    
    test('should detect amounts', () => {
      expect(detectValueType('7 850 000 Kč')).toBe('amount')
      expect(detectValueType('1,234.56 EUR')).toBe('amount')
    })
    
    test('should detect RPSN', () => {
      expect(detectValueType('5,9%')).toBe('rpsn')
      expect(detectValueType('12.34%')).toBe('rpsn')
    })
    
    test('should detect bank accounts', () => {
      expect(detectValueType('123456789/0800')).toBe('bankAccount')
    })
    
    test('should detect IBANs', () => {
      expect(detectValueType('CZ6508000000192000145399')).toBe('iban')
    })
    
    test('should default to text for unrecognized patterns', () => {
      expect(detectValueType('some random text')).toBe('text')
      expect(detectValueType('')).toBe('unknown')
    })
  })
  
  describe('normalizeValue', () => {
    test('should normalize birth numbers', () => {
      expect(normalizeValue(' 940919 / 1022 ', 'birthNumber')).toBe('940919/1022')
      expect(normalizeValue('9409191022', 'birthNumber')).toBe('940919/1022')
    })
    
    test('should normalize IBANs', () => {
      expect(normalizeValue('cz6508000000192000145399', 'iban'))
        .toBe('CZ6508000000192000145399')
      expect(normalizeValue('CZ65 0800', 'iban')).toBe('CZ650800')
    })
    
    test('should normalize bank accounts', () => {
      expect(normalizeValue(' 123456789 / 0800 ', 'bankAccount'))
        .toBe('123456789/0800')
    })
    
    test('should normalize amounts', () => {
      expect(normalizeValue('7  850  000  Kč', 'amount')).toBe('7 850 000 Kč')
    })
    
    test('should normalize RPSN', () => {
      expect(normalizeValue('5,9 %', 'rpsn')).toBe('5.9%')
      expect(normalizeValue(' 12,34% ', 'rpsn')).toBe('12.34%')
    })
    
    test('should normalize text to lowercase by default', () => {
      expect(normalizeValue('Some TEXT', 'text')).toBe('some text')
    })
  })
})

describe('Document Search Functions', () => {
  
  describe('findValueInNormalizedDocument', () => {
    let normalizedDoc
    
    beforeEach(() => {
      normalizedDoc = createNormalizedDocument(czechTestDocument)
    })
    
    test('should find exact birth number matches', () => {
      const matches = findValueInNormalizedDocument(
        '940919/1022', 
        'birthNumber', 
        normalizedDoc, 
        czechTestDocument
      )
      
      expect(matches).toHaveLength(1)
      expect(matches[0].text).toBe('940919/1022')
      expect(matches[0].start).toBeGreaterThanOrEqual(0)
      expect(matches[0].end).toBeGreaterThan(matches[0].start)
    })
    
    test('should find name matches with diacritics', () => {
      const matches = findValueInNormalizedDocument(
        'jan novak',
        'text',
        normalizedDoc,
        czechTestDocument
      )
      
      expect(matches.length).toBeGreaterThan(0)
      expect(matches.some(m => m.text.toLowerCase().includes('novák'))).toBe(true)
    })
    
    test('should handle non-existent values', () => {
      const matches = findValueInNormalizedDocument(
        'nonexistent value',
        'text',
        normalizedDoc,
        czechTestDocument
      )
      
      expect(matches).toHaveLength(0)
    })
    
    test('should handle empty inputs', () => {
      const matches = findValueInNormalizedDocument(
        '',
        'text', 
        normalizedDoc,
        czechTestDocument
      )
      
      expect(matches).toHaveLength(0)
    })
  })
  
  describe('extractIndividualValues', () => {
    test('should extract birth numbers from AI response', () => {
      const response = 'Found birth numbers: 940919/1022 and 850623/3456'
      const matches = extractIndividualValues(response, czechTestDocument)
      
      const birthNumbers = matches.filter(m => 
        /^\d{6}\/\d{3,4}$/.test(m.text)
      )
      expect(birthNumbers.length).toBeGreaterThanOrEqual(2)
    })
    
    test('should extract names from AI response', () => {
      const response = 'Persons: Jan Novák, Marie Svobodová'
      const matches = extractIndividualValues(response, czechTestDocument)
      
      const names = matches.filter(m => 
        /^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+$/.test(m.text)
      )
      expect(names.length).toBeGreaterThanOrEqual(1)
    })
    
    test('should extract amounts from AI response', () => {
      const response = 'Purchase price: 7 850 000 Kč, deposit: 785 000 CZK'
      const matches = extractIndividualValues(response, czechTestDocument)
      
      const amounts = matches.filter(m => 
        /\d{1,3}(?:[\s,\.]\d{3})*(?:[\.,]\d{1,2})?\s*(?:Kč|CZK|EUR|€|USD|\$)?/i.test(m.text)
      )
      expect(amounts.length).toBeGreaterThanOrEqual(1)
    })
    
    test('should handle empty response', () => {
      const matches = extractIndividualValues('', czechTestDocument)
      expect(matches).toHaveLength(0)
    })
    
    test('should remove duplicate matches', () => {
      const response = '940919/1022 and 940919/1022 again'
      const matches = extractIndividualValues(response, czechTestDocument)
      
      // Should deduplicate matches by position
      const uniquePositions = new Set(matches.map(m => `${m.start}-${m.end}`))
      expect(matches.length).toBe(uniquePositions.size)
    })
  })
})

describe('Edge Cases and Error Handling', () => {
  
  test('should handle empty document', () => {
    const normalizedDoc = createNormalizedDocument('')
    const matches = findValueInNormalizedDocument(
      'test',
      'text',
      normalizedDoc,
      ''
    )
    expect(matches).toHaveLength(0)
  })
  
  test('should handle whitespace-only document', () => {
    const normalizedDoc = createNormalizedDocument(edgeCaseTestData.whitespace)
    expect(normalizedDoc.normalized).toBe('')
  })
  
  test('should handle unicode content', () => {
    const normalizedDoc = createNormalizedDocument(edgeCaseTestData.unicode)
    expect(normalizedDoc.normalized).toBeDefined()
    expect(normalizedDoc.normalized.length).toBeGreaterThan(0)
  })
  
  test('should handle special characters', () => {
    const normalizedDoc = createNormalizedDocument(edgeCaseTestData.specialChars)
    expect(normalizedDoc.normalized).toBe(edgeCaseTestData.specialChars.toLowerCase())
  })
  
  test('should handle mixed content', () => {
    const normalizedDoc = createNormalizedDocument(edgeCaseTestData.mixedContent)
    expect(normalizedDoc.normalized).toBeDefined()
    expect(normalizedDoc.indexMap.length).toBeGreaterThan(0)
  })
  
  test('should handle very long lines', () => {
    const start = Date.now()
    const normalizedDoc = createNormalizedDocument(edgeCaseTestData.longLines)
    const end = Date.now()
    
    expect(normalizedDoc.normalized).toBeDefined()
    expect(end - start).toBeLessThan(1000) // Should complete within 1 second
  })
  
  test('should handle deeply nested content', () => {
    const normalizedDoc = createNormalizedDocument(edgeCaseTestData.deepNesting)
    expect(normalizedDoc.normalized).toBeDefined()
    expect(normalizedDoc.normalized.includes('level')).toBe(true)
  })
})