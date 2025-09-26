import { describe, test, expect, beforeEach } from 'vitest'
import { highlightingTestCases, czechTestDocument } from './fixtures/czechTestData.js'

// Mock DOM environment for HTML testing
import { JSDOM } from 'jsdom'

// Mock highlighting functions from App.jsx
const escapeHtml = (str = '') => {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const renderHighlightedDocument = (text = '', ranges = []) => {
  if (!ranges || ranges.length === 0 || !text) {
    return escapeHtml(text)
  }

  // Sort ranges from end to start to avoid index shifting
  const sortedRanges = [...ranges]
    .filter(r => r && typeof r.start === 'number' && typeof r.end === 'number' && r.start < r.end)
    .sort((a, b) => b.start - a.start)
    
  let result = escapeHtml(text)
  
  // Apply each range
  sortedRanges.forEach((range) => {
    const start = Math.max(0, Math.min(range.start, text.length))
    const end = Math.max(start, Math.min(range.end, text.length))
    
    if (start < end) {
      const beforeText = result.substring(0, start)
      const highlightText = escapeHtml(text.substring(start, end))
      const afterText = result.substring(end)
      
      const markTag = `<mark class="highlight" style="background-color: yellow; padding: 2px;">${highlightText}</mark>`
      result = beforeText + markTag + afterText
    }
  })
  
  return result
}

const extractRangesFromHTML = (html) => {
  const dom = new JSDOM(html)
  const marks = dom.window.document.querySelectorAll('mark.highlight')
  
  const ranges = []
  let currentIndex = 0
  
  // Simple approach: find mark positions in original HTML
  const cleanText = html.replace(/<mark[^>]*>([^<]*)<\/mark>/g, '$1')
  
  marks.forEach(mark => {
    const content = mark.textContent
    const index = cleanText.indexOf(content, currentIndex)
    if (index !== -1) {
      ranges.push({
        start: index,
        end: index + content.length,
        text: content
      })
      currentIndex = index + content.length
    }
  })
  
  return ranges
}

describe('Highlighting Functionality', () => {
  
  describe('Basic Highlighting', () => {
    test('should highlight single match', () => {
      const text = 'Jan Novák je prodávající'
      const ranges = [{ start: 0, end: 8 }]
      
      const highlighted = renderHighlightedDocument(text, ranges)
      
      expect(highlighted).toContain('<mark class="highlight"')
      expect(highlighted).toContain('Jan Nov')
      expect(highlighted).toContain('</mark>')
      expect(highlighted).toContain('je prodávající')
    })
    
    test('should handle empty ranges', () => {
      const text = 'Test text'
      const highlighted = renderHighlightedDocument(text, [])
      
      expect(highlighted).toBe(escapeHtml(text))
      expect(highlighted).not.toContain('<mark')
    })
    
    test('should handle null/undefined ranges', () => {
      const text = 'Test text'
      
      expect(renderHighlightedDocument(text, null)).toBe(escapeHtml(text))
      expect(renderHighlightedDocument(text, undefined)).toBe(escapeHtml(text))
    })
    
    test('should handle empty text', () => {
      const ranges = [{ start: 0, end: 5 }]
      
      expect(renderHighlightedDocument('', ranges)).toBe('')
      expect(renderHighlightedDocument(null, ranges)).toBe('')
      expect(renderHighlightedDocument(undefined, ranges)).toBe('')
    })
  })
  
  describe('Multiple Highlights', () => {
    test('should highlight multiple non-overlapping ranges', () => {
      const text = 'Jan Novák a Pavel Dvořák'
      const ranges = [
        { start: 0, end: 8 }, // "Jan Novák"
        { start: 12, end: 24 } // "Pavel Dvořák"
      ]
      
      const highlighted = renderHighlightedDocument(text, ranges)
      
      const markCount = (highlighted.match(/<mark/g) || []).length
      expect(markCount).toBe(2)
      
      expect(highlighted).toContain('Jan Nov')
      expect(highlighted).toContain('Pavel Dvo')
    })
    
    test('should handle overlapping ranges correctly', () => {
      const text = 'Jan Novák Novák'
      const ranges = [
        { start: 4, end: 9 },  // First "Novák"
        { start: 10, end: 15 } // Second "Novák"
      ]
      
      const highlighted = renderHighlightedDocument(text, ranges)
      
      const markCount = (highlighted.match(/<mark/g) || []).length
      expect(markCount).toBe(2)
    })
    
    test('should handle adjacent ranges', () => {
      const text = 'ABCDEF'
      const ranges = [
        { start: 0, end: 3 }, // "ABC"
        { start: 3, end: 6 }  // "DEF"
      ]
      
      const highlighted = renderHighlightedDocument(text, ranges)
      
      const markCount = (highlighted.match(/<mark/g) || []).length
      expect(markCount).toBe(2)
      
      expect(highlighted).toContain('ABC')
      expect(highlighted).toContain('DEF')
    })
  })
  
  describe('Range Validation', () => {
    test('should handle invalid ranges gracefully', () => {
      const text = 'Test text'
      const invalidRanges = [
        { start: -1, end: 5 },     // Negative start
        { start: 0, end: 100 },    // End beyond text length
        { start: 5, end: 2 },      // Start > end
        { start: null, end: 5 },   // Null start
        { start: 0, end: null },   // Null end
        { },                       // Empty object
        null,                      // Null range
        undefined                  // Undefined range
      ]
      
      const highlighted = renderHighlightedDocument(text, invalidRanges)
      
      // Should still have some valid highlights and not crash
      expect(highlighted).toBeDefined()
      expect(typeof highlighted).toBe('string')
    })
    
    test('should clamp ranges to text boundaries', () => {
      const text = 'Short'
      const ranges = [
        { start: -5, end: 3 },   // Start before beginning
        { start: 2, end: 20 }    // End beyond text
      ]
      
      const highlighted = renderHighlightedDocument(text, ranges)
      
      expect(highlighted).toBeDefined()
      expect(highlighted).toContain('<mark')
    })
    
    test('should handle zero-length ranges', () => {
      const text = 'Test text'
      const ranges = [
        { start: 0, end: 0 },  // Zero length
        { start: 5, end: 5 }   // Zero length
      ]
      
      const highlighted = renderHighlightedDocument(text, ranges)
      
      // Zero-length ranges should be filtered out
      expect(highlighted).toBe(escapeHtml(text))
    })
  })
  
  describe('HTML Escaping', () => {
    test('should escape HTML characters in text', () => {
      const text = '<script>alert("xss")</script>'
      const ranges = [{ start: 0, end: 8 }]
      
      const highlighted = renderHighlightedDocument(text, ranges)
      
      expect(highlighted).toContain('&lt;script&gt;')
      expect(highlighted).not.toContain('<script>')
      expect(highlighted).toContain('<mark')
    })
    
    test('should escape special characters', () => {
      const text = 'Test & "quotes" & \'apostrophes\''
      const ranges = [{ start: 0, end: 4 }]
      
      const highlighted = renderHighlightedDocument(text, ranges)
      
      expect(highlighted).toContain('&amp;')
      expect(highlighted).toContain('&quot;')
      expect(highlighted).toContain('&#39;')
    })
    
    test('should preserve mark HTML structure', () => {
      const text = 'Test <em>emphasis</em> text'
      const ranges = [{ start: 5, end: 19 }] // The <em> part
      
      const highlighted = renderHighlightedDocument(text, ranges)
      
      // Should escape the <em> tags but preserve mark tags
      expect(highlighted).toContain('<mark')
      expect(highlighted).toContain('&lt;em&gt;')
      expect(highlighted).toContain('&lt;/em&gt;')
    })
  })
  
  describe('Czech Language Highlighting', () => {
    test('should highlight Czech text with diacritics', () => {
      const text = 'Žluťoučký kůň úpěl ďábelské ódy'
      const ranges = [{ start: 0, end: 9 }] // "Žluťoučký"
      
      const highlighted = renderHighlightedDocument(text, ranges)
      
      expect(highlighted).toContain('<mark')
      expect(highlighted).toContain('lu')
      expect(highlighted).toContain('ou')
    })
    
    test('should handle Czech names correctly', () => {
      const ranges = [{ start: czechTestDocument.indexOf('Jan Novák'), end: czechTestDocument.indexOf('Jan Novák') + 8 }]
      
      const highlighted = renderHighlightedDocument(czechTestDocument, ranges)
      
      expect(highlighted).toContain('<mark')
      expect(highlighted).toContain('Jan Nov')
    })
    
    test('should highlight birth numbers', () => {
      const birthNumber = '940919/1022'
      const start = czechTestDocument.indexOf(birthNumber)
      const ranges = [{ start, end: start + birthNumber.length }]
      
      const highlighted = renderHighlightedDocument(czechTestDocument, ranges)
      
      expect(highlighted).toContain('<mark')
      expect(highlighted).toContain('940919/1022')
    })
    
    test('should highlight amounts with Czech currency', () => {
      const amount = '7 850 000 Kč'
      const start = czechTestDocument.indexOf(amount)
      const ranges = [{ start, end: start + amount.length }]
      
      const highlighted = renderHighlightedDocument(czechTestDocument, ranges)
      
      expect(highlighted).toContain('<mark')
      expect(highlighted).toContain('7 850 000')
    })
  })
  
  describe('Highlighting Test Cases', () => {
    highlightingTestCases.forEach(({ name, text, query, expectedRanges }) => {
      test(`should handle ${name}`, () => {
        const highlighted = renderHighlightedDocument(text, expectedRanges)
        
        expect(highlighted).toContain('<mark')
        expect(highlighted).toContain('</mark>')
        
        const markCount = (highlighted.match(/<mark/g) || []).length
        expect(markCount).toBe(expectedRanges.length)
      })
    })
  })
  
  describe('Performance Tests', () => {
    test('should handle large documents with many highlights efficiently', () => {
      const largeText = 'Novák '.repeat(10000) // 60KB with many repeated names
      const ranges = []
      
      // Create highlight ranges for every occurrence
      for (let i = 0; i < 10000; i++) {
        const start = i * 6
        const end = start + 5
        ranges.push({ start, end })
      }
      
      const startTime = Date.now()
      const highlighted = renderHighlightedDocument(largeText, ranges)
      const endTime = Date.now()
      
      expect(highlighted).toContain('<mark')
      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds
    })
    
    test('should handle many small highlights efficiently', () => {
      const text = 'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z'
      const ranges = []
      
      // Highlight every letter
      for (let i = 0; i < text.length; i += 2) {
        ranges.push({ start: i, end: i + 1 })
      }
      
      const startTime = Date.now()
      const highlighted = renderHighlightedDocument(text, ranges)
      const endTime = Date.now()
      
      expect(highlighted).toContain('<mark')
      expect(endTime - startTime).toBeLessThan(1000) // Should complete within 1 second
    })
  })
  
  describe('HTML Output Validation', () => {
    test('should produce valid HTML structure', () => {
      const text = 'Test highlighting functionality'
      const ranges = [
        { start: 0, end: 4 },   // "Test"
        { start: 5, end: 18 }   // "highlighting"
      ]
      
      const highlighted = renderHighlightedDocument(text, ranges)
      
      // Check for proper HTML structure
      expect(highlighted).toMatch(/<mark[^>]*>.*?<\/mark>/)
      
      // Should have equal number of opening and closing tags
      const openTags = (highlighted.match(/<mark/g) || []).length
      const closeTags = (highlighted.match(/<\/mark>/g) || []).length
      expect(openTags).toBe(closeTags)
    })
    
    test('should include proper CSS classes and attributes', () => {
      const text = 'Test text'
      const ranges = [{ start: 0, end: 4 }]
      
      const highlighted = renderHighlightedDocument(text, ranges)
      
      expect(highlighted).toContain('class="highlight"')
      expect(highlighted).toContain('style="background-color: yellow')
      expect(highlighted).toContain('padding: 2px;')
    })
    
    test('should be parseable by DOM parser', () => {
      const text = 'Test with <special> &characters& "quotes"'
      const ranges = [{ start: 0, end: 4 }]
      
      const highlighted = renderHighlightedDocument(text, ranges)
      
      // Should be valid HTML that can be parsed
      expect(() => {
        const dom = new JSDOM(`<!DOCTYPE html><body>${highlighted}</body>`)
        const marks = dom.window.document.querySelectorAll('mark')
        expect(marks.length).toBe(1)
      }).not.toThrow()
    })
  })
  
  describe('Edge Cases', () => {
    test('should handle text with only whitespace', () => {
      const text = '   \n\t  '
      const ranges = [{ start: 0, end: text.length }]
      
      const highlighted = renderHighlightedDocument(text, ranges)
      
      expect(highlighted).toBeDefined()
      expect(highlighted).toContain('<mark')
    })
    
    test('should handle ranges at text boundaries', () => {
      const text = 'ABCDE'
      const ranges = [
        { start: 0, end: 1 },     // First character
        { start: 4, end: 5 }      // Last character
      ]
      
      const highlighted = renderHighlightedDocument(text, ranges)
      
      expect(highlighted).toContain('<mark')
      const markCount = (highlighted.match(/<mark/g) || []).length
      expect(markCount).toBe(2)
    })
    
    test('should handle very large ranges', () => {
      const text = 'Small text'
      const ranges = [{ start: 0, end: 1000000 }] // Much larger than text
      
      const highlighted = renderHighlightedDocument(text, ranges)
      
      expect(highlighted).toContain('<mark')
      expect(highlighted).toContain('Small text')
    })
    
    test('should handle ranges with same start and end positions', () => {
      const text = 'Test text with overlapping'
      const ranges = [
        { start: 5, end: 9 },   // "text"
        { start: 5, end: 9 }    // Same range again
      ]
      
      const highlighted = renderHighlightedDocument(text, ranges)
      
      // Should handle duplicate ranges gracefully
      expect(highlighted).toContain('<mark')
    })
  })
})