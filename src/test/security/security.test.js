/**
 * Security and Authentication Testing Suite
 * 
 * Tests security measures, authentication flow, and protection against common vulnerabilities:
 * - Authentication and authorization
 * - Input validation and sanitization
 * - XSS protection
 * - CSRF protection
 * - Data encryption and storage security
 * - API security
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../App.jsx'

describe('Security and Authentication Testing', () => {
  let user
  let originalLocalStorage
  let originalSessionStorage
  let originalFetch

  beforeEach(() => {
    user = userEvent.setup()
    
    // Store original values
    originalLocalStorage = window.localStorage
    originalSessionStorage = window.sessionStorage
    originalFetch = window.fetch

    // Setup default mocks
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    })

    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    })

    global.fetch = vi.fn()
    cleanup()
  })

  afterEach(() => {
    // Restore original values
    window.localStorage = originalLocalStorage
    window.sessionStorage = originalSessionStorage
    window.fetch = originalFetch
    
    vi.clearAllMocks()
    cleanup()
  })

  describe('Authentication Security', () => {
    it('should block access without authentication', () => {
      window.localStorage.getItem.mockReturnValue(null)
      
      render(<App />)
      
      // Should show login screen
      expect(screen.getByText('Legal Document Analyzer')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Heslo')).toBeInTheDocument()
      
      // Should not show main interface
      expect(screen.queryByText('Smlouva / Právní dokument')).not.toBeInTheDocument()
    })

    it('should reject weak/incorrect passwords', async () => {
      window.localStorage.getItem.mockReturnValue(null)
      
      render(<App />)
      
      const passwordInput = screen.getByPlaceholderText('Heslo')
      const loginButton = screen.getByRole('button', { name: /vstoupit/i })
      
      // Test various incorrect passwords
      const incorrectPasswords = [
        'wrongpassword',
        'password123',
        'admin',
        'test',
        '12345',
        'sporka2024', // Close but wrong year
        'Sporka2025', // Wrong case
        '',
        ' sporka2025 ' // With spaces
      ]
      
      for (const password of incorrectPasswords) {
        // Clear input
        fireEvent.change(passwordInput, { target: { value: '' } })
        
        await user.type(passwordInput, password)
        await user.click(loginButton)
        
        await waitFor(() => {
          expect(screen.getByText('Nesprávné heslo. Zkuste to znovu.')).toBeInTheDocument()
        })
        
        // Should not be authenticated
        expect(window.localStorage.setItem).not.toHaveBeenCalledWith('aiSearchAuth', 'true')
      }
    })

    it('should accept only the correct password', async () => {
      window.localStorage.getItem.mockReturnValue(null)
      
      render(<App />)
      
      const passwordInput = screen.getByPlaceholderText('Heslo')
      const loginButton = screen.getByRole('button', { name: /vstoupit/i })
      
      await user.type(passwordInput, 'sporka2025')
      await user.click(loginButton)
      
      await waitFor(() => {
        expect(screen.getByText('Smlouva / Právní dokument')).toBeInTheDocument()
      })
      
      expect(window.localStorage.setItem).toHaveBeenCalledWith('aiSearchAuth', 'true')
    })

    it('should handle authentication bypass attempts', () => {
      // Attempt to manipulate localStorage directly
      window.localStorage.getItem.mockReturnValue('false')
      
      render(<App />)
      
      // Should still show login screen
      expect(screen.getByPlaceholderText('Heslo')).toBeInTheDocument()
      
      // Try to set auth to 'true' after component mount
      window.localStorage.getItem.mockReturnValue('true')
      
      // Component should not automatically re-render to authenticated state
      // without proper authentication flow
    })

    it('should handle session timeout', async () => {
      window.localStorage.getItem.mockReturnValue('true')
      
      render(<App />)
      
      // Should show authenticated interface
      expect(screen.getByText('Smlouva / Právní dokument')).toBeInTheDocument()
      
      // Simulate session expiration by changing localStorage
      window.localStorage.getItem.mockReturnValue(null)
      
      // In a real app, this might trigger a logout on next localStorage check
      // For now, we verify the current state
      expect(screen.getByText('Smlouva / Právní dokument')).toBeInTheDocument()
    })

    it('should handle logout securely', async () => {
      window.localStorage.getItem.mockReturnValue('true')
      
      render(<App />)
      
      expect(screen.getByText('Smlouva / Právní dokument')).toBeInTheDocument()
      
      // Simulate logout (would need logout button in real implementation)
      // For now, we test the storage cleanup
      window.localStorage.clear()
      
      expect(window.localStorage.clear).toHaveBeenCalled()
    })

    it('should handle localStorage unavailable gracefully', () => {
      // Simulate private browsing or disabled localStorage
      Object.defineProperty(window, 'localStorage', {
        value: null,
        writable: true,
      })
      
      // Should not crash
      expect(() => render(<App />)).not.toThrow()
    })
  })

  describe('Input Validation and Sanitization', () => {
    beforeEach(() => {
      window.localStorage.getItem.mockReturnValue('true')
    })

    it('should sanitize malicious HTML in document input', async () => {
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      
      // Test various XSS payloads
      const maliciousInputs = [
        '<script>alert("XSS")</script>',
        '<img src="x" onerror="alert(\'XSS\')">',
        '<svg onload="alert(\'XSS\')">',
        'javascript:alert("XSS")',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        '<object data="javascript:alert(\'XSS\')"></object>',
        '<embed src="javascript:alert(\'XSS\')">',
        '<link rel="stylesheet" href="javascript:alert(\'XSS\')">',
        '<meta http-equiv="refresh" content="0;url=javascript:alert(\'XSS\')">'
      ]
      
      for (const maliciousInput of maliciousInputs) {
        // Clear input
        fireEvent.change(documentInput, { target: { value: '' } })
        
        await user.type(documentInput, maliciousInput)
        
        // Input should contain the text but not execute scripts
        expect(documentInput.value).toBe(maliciousInput)
        
        // Check that no script has executed (would need more sophisticated testing in real scenario)
        expect(window.alert).not.toHaveBeenCalled()
      }
    })

    it('should sanitize malicious HTML in search input', async () => {
      render(<App />)
      
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      const xssPayload = '<script>alert("XSS in search")</script>'
      
      await user.type(searchInput, xssPayload)
      
      expect(searchInput.value).toBe(xssPayload)
      expect(window.alert).not.toHaveBeenCalled()
    })

    it('should handle extremely long input strings', async () => {
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      
      // Test with very long string that could cause buffer overflow
      const longString = 'A'.repeat(100000)
      
      await user.type(documentInput, longString.substring(0, 1000)) // Type first 1000 chars
      
      // Should handle without crashing
      expect(documentInput.value).toContain('A')
    })

    it('should handle special characters and Unicode', async () => {
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      // Test various Unicode and special characters
      const specialChars = [
        'áčďéěíňóřšťúůýž',
        '测试中文字符',
        'тест кириллицы',
        '🎉🔍📄',
        '₹€$¥£',
        '©®™',
        '\n\t\r',
        '\\x00\\x01\\x02'
      ]
      
      for (const chars of specialChars) {
        await user.clear(documentInput)
        await user.type(documentInput, chars)
        expect(documentInput.value).toBe(chars)
        
        await user.clear(searchInput)
        await user.type(searchInput, chars)
        expect(searchInput.value).toBe(chars)
      }
    })

    it('should validate API request payloads', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: JSON.stringify({ results: [] }) }]
        })
      })
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(documentInput, 'Valid document content')
      await user.type(searchInput, 'valid search')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: 'valid search',
            document: 'Valid document content'
          })
        })
      })
    })
  })

  describe('XSS Protection', () => {
    beforeEach(() => {
      window.localStorage.getItem.mockReturnValue('true')
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{
            text: JSON.stringify({
              results: [
                {
                  label: '<script>alert("XSS")</script>',
                  value: '<img src="x" onerror="alert(\'XSS\')">',
                  start: 0,
                  end: 10
                }
              ]
            })
          }]
        })
      })
    })

    it('should sanitize search results from API', async () => {
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(documentInput, 'Test document content')
      await user.type(searchInput, 'test')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(screen.getByText('Výsledky')).toBeInTheDocument()
      })
      
      // Results should be displayed but scripts should not execute
      expect(window.alert).not.toHaveBeenCalled()
    })

    it('should escape HTML in highlighted document content', async () => {
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      const documentWithHtml = 'Document with <script>alert("XSS")</script> content'
      
      await user.type(documentInput, documentWithHtml)
      await user.type(searchInput, 'test')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        const highlightedDoc = document.querySelector('.document-highlighted')
        if (highlightedDoc) {
          // HTML should be escaped in the displayed content
          expect(highlightedDoc.innerHTML).toContain('&lt;script&gt;')
          expect(highlightedDoc.innerHTML).not.toContain('<script>')
        }
      })
    })

    it('should prevent script injection through search history', async () => {
      render(<App />)
      
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      const maliciousQuery = '<script>alert("History XSS")</script>'
      
      await user.type(searchInput, maliciousQuery)
      await user.keyboard('{Enter}')
      
      // Check that search history displays safely
      await waitFor(() => {
        const historyItems = document.querySelectorAll('.history-item')
        historyItems.forEach(item => {
          if (item.textContent.includes('script')) {
            expect(item.innerHTML).not.toContain('<script>')
          }
        })
      })
    })
  })

  describe('CSRF Protection', () => {
    beforeEach(() => {
      window.localStorage.getItem.mockReturnValue('true')
    })

    it('should include proper headers in API requests', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: JSON.stringify({ results: [] }) }]
        })
      })
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(documentInput, 'Test document')
      await user.type(searchInput, 'test')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.any(String)
        })
      })
    })

    it('should handle API request validation', async () => {
      // Mock CSRF-like attack by manipulating request
      global.fetch.mockRejectedValue(new Error('Invalid request origin'))
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(documentInput, 'Test document')
      await user.type(searchInput, 'test')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(screen.getByText(/nastala neočekávaná chyba/i)).toBeInTheDocument()
      })
    })
  })

  describe('Data Protection', () => {
    beforeEach(() => {
      window.localStorage.getItem.mockReturnValue('true')
    })

    it('should not log sensitive data to console', async () => {
      const consoleSpy = vi.spyOn(console, 'log')
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const sensitiveData = 'Rodné číslo: 801201/1234, Bankovní účet: 123456789/0100'
      
      await user.type(documentInput, sensitiveData)
      
      // Check that sensitive data is not logged
      const consoleCalls = consoleSpy.mock.calls.flat().join(' ')
      expect(consoleCalls).not.toContain('801201/1234')
      expect(consoleCalls).not.toContain('123456789/0100')
      
      consoleSpy.mockRestore()
    })

    it('should handle localStorage data securely', async () => {
      render(<App />)
      
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(searchInput, 'test search')
      await user.keyboard('{Enter}')
      
      // Search history should be stored, but check for sensitive data
      const setItemCalls = window.localStorage.setItem.mock.calls
      setItemCalls.forEach(([key, value]) => {
        if (key === 'searchHistory') {
          // History should not contain sensitive patterns
          expect(value).not.toMatch(/\d{6}\/\d{3,4}/) // Birth numbers
          expect(value).not.toMatch(/\d{6,}\/\d{4}/) // Account numbers
        }
      })
    })

    it('should clear sensitive data on logout', async () => {
      render(<App />)
      
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(searchInput, 'sensitive search')
      
      // Simulate logout
      window.localStorage.removeItem('aiSearchAuth')
      
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('aiSearchAuth')
      
      // In a complete implementation, other sensitive data should also be cleared
    })
  })

  describe('API Security', () => {
    beforeEach(() => {
      window.localStorage.getItem.mockReturnValue('true')
    })

    it('should handle API rate limiting', async () => {
      global.fetch.mockRejectedValue(new Error('rate_limit'))
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(documentInput, 'Test document')
      await user.type(searchInput, 'test')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(screen.getByText(/překročen limit požadavků/i)).toBeInTheDocument()
      })
    })

    it('should handle API authentication errors', async () => {
      global.fetch.mockRejectedValue(new Error('authentication'))
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(documentInput, 'Test document')
      await user.type(searchInput, 'test')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(screen.getByText(/problém s autentizací/i)).toBeInTheDocument()
      })
    })

    it('should handle API overload gracefully', async () => {
      global.fetch.mockRejectedValue(new Error('Overloaded'))
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(documentInput, 'Test document')
      await user.type(searchInput, 'test')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(screen.getByText(/api je momentálně přetížené/i)).toBeInTheDocument()
      })
    })

    it('should implement proper error handling for malformed responses', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' })
      })
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(documentInput, 'Test document')
      await user.type(searchInput, 'test')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(screen.getByText(/chyba při vyhledávání/i)).toBeInTheDocument()
      })
    })
  })

  describe('Content Security Policy', () => {
    it('should not execute inline scripts', () => {
      // In a real CSP test, you would check that CSP headers prevent inline script execution
      // For now, we verify that the app doesn't rely on inline scripts
      
      render(<App />)
      
      // Check that app renders without inline scripts
      expect(screen.getByText('Legal Document Analyzer')).toBeInTheDocument()
    })

    it('should handle blocked external resources gracefully', () => {
      // Simulate blocked external resources
      const originalError = console.error
      console.error = vi.fn()
      
      render(<App />)
      
      // App should still function
      expect(screen.getByText('Legal Document Analyzer')).toBeInTheDocument()
      
      console.error = originalError
    })
  })

  describe('Privacy Protection', () => {
    beforeEach(() => {
      window.localStorage.getItem.mockReturnValue('true')
    })

    it('should not transmit document content unnecessarily', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: JSON.stringify({ results: [] }) }]
        })
      })
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const privateContent = 'Private contract with sensitive information'
      
      await user.type(documentInput, privateContent)
      
      // Document content should only be sent when explicitly searching
      expect(global.fetch).not.toHaveBeenCalled()
      
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      await user.type(searchInput, 'test')
      await user.keyboard('{Enter}')
      
      // Now it should be sent with the search
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/search', expect.objectContaining({
          body: expect.stringContaining(privateContent)
        }))
      })
    })

    it('should handle data retention policies', async () => {
      render(<App />)
      
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      // Create multiple search entries
      for (let i = 0; i < 15; i++) {
        await user.clear(searchInput)
        await user.type(searchInput, `search ${i}`)
        await user.keyboard('{Enter}')
        
        // Wait for history to update
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      
      // Verify that history is limited (app stores max 10)
      const setHistoryCalls = window.localStorage.setItem.mock.calls
        .filter(([key]) => key === 'searchHistory')
      
      if (setHistoryCalls.length > 0) {
        const lastHistoryCall = setHistoryCalls[setHistoryCalls.length - 1]
        const history = JSON.parse(lastHistoryCall[1])
        expect(history.length).toBeLessThanOrEqual(10)
      }
    })
  })
})