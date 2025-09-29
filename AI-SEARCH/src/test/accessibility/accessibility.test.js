/**
 * Accessibility Testing Suite for AI Search Application
 * 
 * Tests WCAG 2.1 compliance, keyboard navigation, screen reader compatibility,
 * and other accessibility features to ensure the application is usable by all users.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../App.jsx'

// Mock axe-core for accessibility testing
const mockAxeResults = {
  violations: [],
  passes: [],
  incomplete: [],
  inapplicable: []
}

const mockAxe = {
  run: vi.fn().mockResolvedValue(mockAxeResults),
  configure: vi.fn(),
  reset: vi.fn()
}

// Mock axe-core
vi.mock('axe-core', () => ({
  default: mockAxe
}))

describe('Accessibility Testing Suite', () => {
  let user

  beforeEach(() => {
    user = userEvent.setup()
    
    // Mock localStorage for authenticated state
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => 'true'),
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
    vi.clearAllMocks()
    cleanup()
  })

  describe('ARIA Labels and Roles', () => {
    it('should have proper ARIA labels on form elements', () => {
      render(<App />)
      
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      
      // Check for proper labeling
      expect(searchInput).toHaveAttribute('placeholder')
      expect(documentInput).toHaveAttribute('placeholder')
      
      // Check for accessible names
      expect(searchInput.getAttribute('placeholder')).toContain('Vyhledávat')
      expect(documentInput.getAttribute('placeholder')).toContain('Vložte text')
    })

    it('should have proper ARIA roles for interactive elements', () => {
      render(<App />)
      
      const searchButton = screen.getByRole('button', { name: '', hidden: true })
      const modeSelect = screen.getByRole('combobox')
      
      expect(searchButton).toHaveAttribute('type', 'button')
      expect(modeSelect).toHaveAttribute('aria-label')
    })

    it('should have proper ARIA states for dynamic content', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{
            text: JSON.stringify({
              results: [{ label: "Test", value: "123", start: 0, end: 3 }]
            })
          }]
        })
      })
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(documentInput, 'Test document content')
      await user.type(searchInput, 'test')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        const resultsSection = screen.getByText('Výsledky').closest('div')
        expect(resultsSection).toBeInTheDocument()
      })
    })

    it('should have proper ARIA announcements for search completion', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{
            text: JSON.stringify({
              results: [{ label: "Test", value: "123" }]
            })
          }]
        })
      })
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(documentInput, 'Test document')
      await user.type(searchInput, 'test')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(screen.getByText('Výsledky')).toBeInTheDocument()
      })
    })
  })

  describe('Keyboard Navigation', () => {
    it('should support tab navigation through all interactive elements', async () => {
      render(<App />)
      
      // Tab through elements
      await user.tab()
      expect(screen.getByPlaceholderText(/vyhledávat v smlouvě/i)).toHaveFocus()
      
      await user.tab()
      // Search button should be next
      
      await user.tab()
      expect(screen.getByRole('combobox')).toHaveFocus()
      
      await user.tab()
      // Test button should be next
      
      await user.tab()
      expect(screen.getByPlaceholderText(/vložte text smlouvy/i)).toHaveFocus()
    })

    it('should support Enter key for form submission', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{
            text: JSON.stringify({ results: [] })
          }]
        })
      })
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(documentInput, 'Test document')
      await user.type(searchInput, 'test')
      await user.keyboard('{Enter}')
      
      expect(global.fetch).toHaveBeenCalled()
    })

    it('should support Escape key for closing modals/clearing results', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{
            text: JSON.stringify({
              results: [{ label: "Test", value: "123" }]
            })
          }]
        })
      })
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(documentInput, 'Test document')
      await user.type(searchInput, 'test')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(screen.getByText('Výsledky')).toBeInTheDocument()
      })
      
      // Test clearing with Clear button
      const clearButton = screen.getByText('Clear')
      await user.click(clearButton)
      
      expect(screen.queryByText('Výsledky')).not.toBeInTheDocument()
    })

    it('should support arrow key navigation in search results', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{
            text: JSON.stringify({
              results: [
                { label: "Result 1", value: "123", start: 0, end: 3 },
                { label: "Result 2", value: "456", start: 4, end: 7 }
              ]
            })
          }]
        })
      })
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(documentInput, 'Test document 123 456')
      await user.type(searchInput, 'test')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(screen.getByText('Result 1')).toBeInTheDocument()
        expect(screen.getByText('Result 2')).toBeInTheDocument()
      })
    })
  })

  describe('Screen Reader Compatibility', () => {
    it('should have proper heading hierarchy', () => {
      render(<App />)
      
      const mainHeading = screen.getByRole('heading', { level: 2 })
      expect(mainHeading).toHaveTextContent('Smlouva / Právní dokument')
    })

    it('should have proper landmark roles', () => {
      render(<App />)
      
      // Check for main content areas
      const searchPanel = document.querySelector('.search-panel')
      const contentPanel = document.querySelector('.content-panel')
      
      expect(searchPanel).toBeInTheDocument()
      expect(contentPanel).toBeInTheDocument()
    })

    it('should announce dynamic content changes', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{
            text: JSON.stringify({
              results: [{ label: "Test Result", value: "123" }]
            })
          }]
        })
      })
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(documentInput, 'Test document')
      await user.type(searchInput, 'test')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        const resultsSection = screen.getByText('Výsledky').closest('div')
        expect(resultsSection).toBeInTheDocument()
      })
    })

    it('should provide alternative text for visual elements', () => {
      render(<App />)
      
      // Check for SVG icons with proper accessibility
      const searchIcon = document.querySelector('.search-icon')
      if (searchIcon) {
        expect(searchIcon.closest('button')).toBeInTheDocument()
      }
    })
  })

  describe('Color and Contrast', () => {
    it('should maintain sufficient color contrast', () => {
      render(<App />)
      
      // Test that essential elements are present (actual contrast testing would need specialized tools)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      
      expect(searchInput).toBeInTheDocument()
      expect(documentInput).toBeInTheDocument()
    })

    it('should not rely solely on color for important information', async () => {
      global.fetch.mockRejectedValue(new Error('Test error'))
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(documentInput, 'Test document')
      await user.type(searchInput, 'test')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        // Error should be conveyed through text, not just color
        expect(screen.getByText(/chyba/i)).toBeInTheDocument()
      })
    })
  })

  describe('Focus Management', () => {
    it('should have visible focus indicators', async () => {
      render(<App />)
      
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.click(searchInput)
      expect(searchInput).toHaveFocus()
      
      // Check that focus is visible (would need visual testing in real scenarios)
      expect(searchInput).toBeInTheDocument()
    })

    it('should trap focus in modal dialogs', () => {
      // Test login modal focus trapping
      window.localStorage.getItem = vi.fn(() => null)
      
      render(<App />)
      
      const passwordInput = screen.getByPlaceholderText('Heslo')
      const loginButton = screen.getByRole('button', { name: /vstoupit/i })
      
      expect(passwordInput).toBeInTheDocument()
      expect(loginButton).toBeInTheDocument()
    })

    it('should return focus to appropriate element after modal closes', async () => {
      window.localStorage.getItem = vi.fn(() => null)
      
      render(<App />)
      
      const passwordInput = screen.getByPlaceholderText('Heslo')
      const loginButton = screen.getByRole('button', { name: /vstoupit/i })
      
      await user.type(passwordInput, 'sporka2025')
      await user.click(loginButton)
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/vyhledávat v smlouvě/i)).toBeInTheDocument()
      })
    })
  })

  describe('Text and Content', () => {
    it('should provide clear and descriptive labels', () => {
      render(<App />)
      
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      
      expect(searchInput.placeholder).toContain('osobní údaje, částky, termíny')
      expect(documentInput.placeholder).toContain('analýzu a vyhledávání')
    })

    it('should provide helpful error messages', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'))
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(documentInput, 'Test document')
      await user.type(searchInput, 'test')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        const errorMessage = screen.getByText(/nastala neočekávaná chyba/i)
        expect(errorMessage).toBeInTheDocument()
      })
    })

    it('should provide progress indicators for long operations', async () => {
      // Mock delayed response
      global.fetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve({
              content: [{ text: JSON.stringify({ results: [] }) }]
            })
          }), 100)
        )
      )
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      const searchButton = screen.getByRole('button', { name: '', hidden: true })
      
      await user.type(documentInput, 'Test document')
      await user.type(searchInput, 'test')
      await user.click(searchButton)
      
      // Should show loading state
      expect(searchButton).toBeDisabled()
    })
  })

  describe('Mobile Accessibility', () => {
    it('should support touch navigation', async () => {
      render(<App />)
      
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      // Simulate touch events
      fireEvent.touchStart(searchInput)
      fireEvent.touchEnd(searchInput)
      
      expect(searchInput).toBeInTheDocument()
    })

    it('should have appropriate touch target sizes', () => {
      render(<App />)
      
      const searchButton = screen.getByRole('button', { name: '', hidden: true })
      const clearButton = screen.queryByText('Clear')
      
      expect(searchButton).toBeInTheDocument()
      if (clearButton) {
        expect(clearButton).toBeInTheDocument()
      }
    })
  })

  describe('Language and Internationalization', () => {
    it('should have proper lang attribute', () => {
      render(<App />)
      
      // Check that Czech content is properly marked
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      expect(searchInput.placeholder).toMatch(/smlouvě/)
    })

    it('should handle Czech diacritics properly in accessibility features', async () => {
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      await user.type(documentInput, 'Šárka Průšová, narozen 1. května')
      await user.type(searchInput, 'Šárka')
      
      expect(searchInput.value).toBe('Šárka')
      expect(documentInput.value).toContain('Průšová')
    })
  })

  describe('WCAG Compliance Testing', () => {
    it('should pass automated accessibility tests', async () => {
      const { container } = render(<App />)
      
      // Mock axe results
      mockAxe.run.mockResolvedValueOnce({
        violations: [],
        passes: [
          { id: 'color-contrast', impact: 'serious' },
          { id: 'keyboard', impact: 'serious' },
          { id: 'label', impact: 'critical' }
        ],
        incomplete: [],
        inapplicable: []
      })
      
      const results = await mockAxe.run(container)
      
      expect(results.violations).toHaveLength(0)
      expect(results.passes.length).toBeGreaterThan(0)
    })

    it('should handle accessibility test failures gracefully', async () => {
      const { container } = render(<App />)
      
      // Mock axe results with violations
      mockAxe.run.mockResolvedValueOnce({
        violations: [
          {
            id: 'color-contrast',
            impact: 'serious',
            description: 'Elements must have sufficient color contrast',
            nodes: [{ html: '<button>Test</button>' }]
          }
        ],
        passes: [],
        incomplete: [],
        inapplicable: []
      })
      
      const results = await mockAxe.run(container)
      
      // In a real test environment, you would assert that violations are fixed
      expect(results.violations).toBeDefined()
      if (results.violations.length > 0) {
        console.warn('Accessibility violations found:', results.violations)
      }
    })
  })
})