/**
 * End-to-End Testing Suite for AI Search Application
 * 
 * Tests complete user workflows including authentication, document upload,
 * search functionality, and result interactions across different browsers.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../App.jsx'

// Mock data for testing
const mockContractDocument = `
Kupní smlouva č. 12345/2024

Prodávající: Jan Novák, rodné číslo: 801201/1234
Kupující: Marie Svobodová, rodné číslo: 851215/5678

Předmět koupě: Byt 3+1, ul. Hlavní 123, Praha 1
Kupní cena: 7 850 000 Kč

Datum podpisu: 15. 3. 2024
Platba: bankovní převod na účet 123456789/0100

Telefon prodávající: +420 608 123 456
E-mail: jan.novak@email.cz
`

const mockApiResponses = {
  search: {
    content: [{
      text: JSON.stringify({
        results: [
          {
            label: "Rodné číslo",
            value: "801201/1234",
            start: 45,
            end: 56
          },
          {
            label: "Kupní cena",
            value: "7 850 000 Kč",
            start: 180,
            end: 193
          }
        ]
      })
    }]
  }
}

describe('E2E: Complete User Workflows', () => {
  let user

  beforeEach(() => {
    user = userEvent.setup()
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    })

    // Mock fetch API
    global.fetch = vi.fn()

    // Clean up DOM
    cleanup()
  })

  afterEach(() => {
    vi.clearAllMocks()
    cleanup()
  })

  describe('Authentication Flow', () => {
    it('should show login screen when not authenticated', () => {
      window.localStorage.getItem.mockReturnValue(null)
      
      render(<App />)
      
      expect(screen.getByText('Legal Document Analyzer')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Heslo')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /vstoupit/i })).toBeInTheDocument()
    })

    it('should authenticate user with correct password', async () => {
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

    it('should reject incorrect password', async () => {
      window.localStorage.getItem.mockReturnValue(null)
      
      render(<App />)
      
      const passwordInput = screen.getByPlaceholderText('Heslo')
      const loginButton = screen.getByRole('button', { name: /vstoupit/i })
      
      await user.type(passwordInput, 'wrongpassword')
      await user.click(loginButton)
      
      await waitFor(() => {
        expect(screen.getByText('Nesprávné heslo. Zkuste to znovu.')).toBeInTheDocument()
      })
      
      expect(window.localStorage.setItem).not.toHaveBeenCalled()
    })

    it('should show main interface when already authenticated', () => {
      window.localStorage.getItem.mockReturnValue('true')
      
      render(<App />)
      
      expect(screen.getByText('Smlouva / Právní dokument')).toBeInTheDocument()
      expect(screen.queryByPlaceholderText('Heslo')).not.toBeInTheDocument()
    })
  })

  describe('Document Input and Management', () => {
    beforeEach(() => {
      window.localStorage.getItem.mockReturnValue('true')
    })

    it('should allow document text input', async () => {
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      
      await user.type(documentInput, mockContractDocument)
      
      expect(documentInput.value).toBe(mockContractDocument)
    })

    it('should show character count for document', async () => {
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      
      await user.type(documentInput, 'Test document')
      
      await waitFor(() => {
        expect(screen.getByText(/13 znaků/)).toBeInTheDocument()
      })
    })

    it('should enable search button when document and query are present', async () => {
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      const searchButton = screen.getByRole('button', { name: '', hidden: true })
      
      await user.type(documentInput, mockContractDocument)
      await user.type(searchInput, 'rodné číslo')
      
      expect(searchButton).not.toBeDisabled()
    })
  })

  describe('Search Functionality', () => {
    beforeEach(() => {
      window.localStorage.getItem.mockReturnValue('true')
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponses.search)
      })
    })

    it('should perform search and display results', async () => {
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(documentInput, mockContractDocument)
      await user.type(searchInput, 'rodné číslo')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(screen.getByText('Výsledky')).toBeInTheDocument()
        expect(screen.getByText('Rodné číslo')).toBeInTheDocument()
        expect(screen.getByText('801201/1234')).toBeInTheDocument()
      })
    })

    it('should highlight search results in document', async () => {
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(documentInput, mockContractDocument)
      await user.type(searchInput, 'rodné číslo')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        const highlightedDoc = document.querySelector('.document-highlighted')
        expect(highlightedDoc).toBeInTheDocument()
        expect(highlightedDoc.innerHTML).toContain('<mark')
      })
    })

    it('should handle different search modes', async () => {
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      const modeSelect = screen.getByDisplayValue('🏛️ Smlouvy')
      
      await user.type(documentInput, mockContractDocument)
      await user.type(searchInput, 'local:test')
      
      // Test different modes
      await user.selectOptions(modeSelect, '🧠 Inteligentní')
      expect(modeSelect.value).toBe('intelligent')
      
      await user.selectOptions(modeSelect, '🔍 Fuzzy')
      expect(modeSelect.value).toBe('fuzzy')
    })

    it('should save and display search history', async () => {
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(documentInput, mockContractDocument)
      await user.type(searchInput, 'rodné číslo')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(screen.getByText('rodné číslo')).toBeInTheDocument()
      })
      
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'searchHistory',
        expect.stringContaining('rodné číslo')
      )
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      window.localStorage.getItem.mockReturnValue('true')
    })

    it('should handle API errors gracefully', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'))
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(documentInput, mockContractDocument)
      await user.type(searchInput, 'test search')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(screen.getByText(/nastala neočekávaná chyba/i)).toBeInTheDocument()
      })
    })

    it('should handle malformed API responses', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: 'response' })
      })
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(documentInput, mockContractDocument)
      await user.type(searchInput, 'test search')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(screen.getByText('Výsledky')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should show offline message when network is unavailable', async () => {
      // Mock offline state
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      })
      
      global.fetch.mockRejectedValue(new Error('Network error'))
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(documentInput, mockContractDocument)
      await user.type(searchInput, 'test search')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(screen.getByText(/nejste připojeni k internetu/i)).toBeInTheDocument()
      })
    })
  })

  describe('Result Interaction', () => {
    beforeEach(() => {
      window.localStorage.getItem.mockReturnValue('true')
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponses.search)
      })
    })

    it('should allow clicking on search results', async () => {
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(documentInput, mockContractDocument)
      await user.type(searchInput, 'rodné číslo')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        const resultItem = screen.getByText('801201/1234').closest('.result-item')
        expect(resultItem).toBeInTheDocument()
        expect(resultItem).toHaveClass('clickable')
      })
    })

    it('should clear results when requested', async () => {
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(documentInput, mockContractDocument)
      await user.type(searchInput, 'rodné číslo')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(screen.getByText('Výsledky')).toBeInTheDocument()
      })
      
      const clearButton = screen.getByText('Clear')
      await user.click(clearButton)
      
      expect(screen.queryByText('Výsledky')).not.toBeInTheDocument()
    })
  })

  describe('Quick Test Functions', () => {
    beforeEach(() => {
      window.localStorage.getItem.mockReturnValue('true')
    })

    it('should execute RNČ test', async () => {
      render(<App />)
      
      const rnčTestButton = screen.getByText('RNČ test')
      await user.click(rnčTestButton)
      
      await waitFor(() => {
        const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
        const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
        
        expect(documentInput.value).toContain('940919/1022')
        expect(searchInput.value).toBe('local:rodné číslo')
      })
    })

    it('should execute amount test', async () => {
      render(<App />)
      
      const amountTestButton = screen.getByText('Částka test')
      await user.click(amountTestButton)
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
        expect(searchInput.value).toBe('local:cena')
      })
    })

    it('should execute multi-person test', async () => {
      render(<App />)
      
      const multiTestButton = screen.getByText('Multi-person test')
      await user.click(multiTestButton)
      
      await waitFor(() => {
        const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
        expect(documentInput.value).toContain('Tomáš Novotný')
        expect(documentInput.value).toContain('Petra Novotná')
        expect(documentInput.value).toContain('Martin Procházka')
      })
    })
  })

  describe('Keyboard Navigation', () => {
    beforeEach(() => {
      window.localStorage.getItem.mockReturnValue('true')
    })

    it('should support Enter key for search', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponses.search)
      })
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(documentInput, mockContractDocument)
      await user.type(searchInput, 'rodné číslo')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(screen.getByText('Výsledky')).toBeInTheDocument()
      })
    })

    it('should support Enter key for authentication', async () => {
      window.localStorage.getItem.mockReturnValue(null)
      
      render(<App />)
      
      const passwordInput = screen.getByPlaceholderText('Heslo')
      
      await user.type(passwordInput, 'sporka2025')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(screen.getByText('Smlouva / Právní dokument')).toBeInTheDocument()
      })
    })
  })

  describe('Performance Indicators', () => {
    beforeEach(() => {
      window.localStorage.getItem.mockReturnValue('true')
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponses.search)
      })
    })

    it('should show loading state during search', async () => {
      // Mock a delayed response
      global.fetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve(mockApiResponses.search)
          }), 100)
        )
      )
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      const searchButton = screen.getByRole('button', { name: '', hidden: true })
      
      await user.type(documentInput, mockContractDocument)
      await user.type(searchInput, 'rodné číslo')
      await user.click(searchButton)
      
      // Check for loading spinner
      expect(screen.getByRole('button', { name: '', hidden: true })).toBeDisabled()
    })

    it('should display performance stats after search', async () => {
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(documentInput, mockContractDocument)
      await user.type(searchInput, 'local:test')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(screen.getByText(/vyhledávání dokončeno za/i)).toBeInTheDocument()
      })
    })
  })
})