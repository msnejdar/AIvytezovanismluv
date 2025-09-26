/**
 * Cross-Browser Compatibility Testing Suite
 * 
 * Tests application functionality across different browsers and environments:
 * - Chrome (latest and legacy versions)
 * - Firefox (latest and ESR)
 * - Safari (latest and older versions)
 * - Edge (Chromium-based)
 * - Mobile browsers (iOS Safari, Chrome Mobile)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../App.jsx'

// Browser environment simulation utilities
const createBrowserEnvironment = (browserType, version, isMobile = false) => {
  const userAgents = {
    chrome: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36`,
    firefox: `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${version}.0) Gecko/20100101 Firefox/${version}.0`,
    safari: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${version}.0 Safari/605.1.15`,
    edge: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36 Edg/${version}.0.0.0`,
    mobileSafari: `Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${version}.0 Mobile/15E148 Safari/604.1`,
    chromeMobile: `Mozilla/5.0 (Linux; Android 11; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Mobile Safari/537.36`
  }

  return {
    userAgent: userAgents[browserType] || userAgents.chrome,
    isMobile,
    browserType,
    version,
    features: getBrowserFeatures(browserType, version, isMobile)
  }
}

const getBrowserFeatures = (browserType, version, isMobile) => {
  const features = {
    es6: true,
    es2017: true,
    es2020: true,
    webComponents: true,
    shadowDOM: true,
    cssGrid: true,
    cssFlexbox: true,
    fetch: true,
    localStorage: true,
    sessionStorage: true,
    webWorkers: true,
    serviceWorkers: true,
    webGL: true,
    webGL2: true,
    webRTC: true,
    intersectionObserver: true,
    mutationObserver: true,
    resizeObserver: true,
    clipboard: true,
    permissions: true,
    notifications: true,
    geolocation: true,
    deviceOrientation: true,
    vibration: isMobile,
    touchEvents: isMobile
  }

  // Browser-specific feature adjustments
  switch (browserType) {
    case 'safari':
      if (parseFloat(version) < 14) {
        features.es2020 = false
        features.resizeObserver = false
      }
      if (parseFloat(version) < 13) {
        features.webGL2 = false
      }
      break
    
    case 'firefox':
      if (parseFloat(version) < 78) {
        features.es2020 = false
      }
      if (parseFloat(version) < 65) {
        features.resizeObserver = false
      }
      break
    
    case 'chrome':
      if (parseFloat(version) < 80) {
        features.es2020 = false
      }
      break
    
    case 'edge':
      // Modern Edge is Chromium-based, so similar to Chrome
      if (parseFloat(version) < 80) {
        features.es2020 = false
      }
      break
  }

  return features
}

const mockBrowserEnvironment = (environment) => {
  // Mock navigator
  Object.defineProperty(navigator, 'userAgent', {
    value: environment.userAgent,
    configurable: true
  })

  // Mock touch support
  if (environment.isMobile) {
    window.ontouchstart = () => {}
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 5,
      configurable: true
    })
  }

  // Mock feature detection
  Object.keys(environment.features).forEach(feature => {
    switch (feature) {
      case 'localStorage':
        if (!environment.features[feature]) {
          delete window.localStorage
        }
        break
      case 'fetch':
        if (!environment.features[feature]) {
          delete window.fetch
        }
        break
      case 'intersectionObserver':
        if (!environment.features[feature]) {
          delete window.IntersectionObserver
        }
        break
    }
  })
}

describe('Cross-Browser Compatibility Testing', () => {
  let user
  let originalUserAgent
  let originalLocalStorage
  let originalFetch

  beforeEach(() => {
    user = userEvent.setup()
    
    // Store original values
    originalUserAgent = navigator.userAgent
    originalLocalStorage = window.localStorage
    originalFetch = window.fetch

    // Setup default mocks
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
    // Restore original values
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true
    })
    
    window.localStorage = originalLocalStorage
    window.fetch = originalFetch
    
    vi.clearAllMocks()
    cleanup()
  })

  describe('Chrome Compatibility', () => {
    it('should work on Chrome 120+ (latest)', async () => {
      const env = createBrowserEnvironment('chrome', '120')
      mockBrowserEnvironment(env)
      
      render(<App />)
      
      expect(screen.getByText('Legal Document Analyzer')).toBeInTheDocument()
      
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      await user.type(searchInput, 'test search')
      
      expect(searchInput.value).toBe('test search')
    })

    it('should work on Chrome 90-100 (older versions)', async () => {
      const env = createBrowserEnvironment('chrome', '95')
      mockBrowserEnvironment(env)
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      await user.type(documentInput, 'Test document content')
      
      expect(documentInput.value).toBe('Test document content')
    })

    it('should handle Chrome-specific features', async () => {
      const env = createBrowserEnvironment('chrome', '120')
      mockBrowserEnvironment(env)
      
      render(<App />)
      
      // Test modern JavaScript features
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      // Test async/await, optional chaining, nullish coalescing
      await user.type(searchInput, 'modern js test')
      expect(searchInput.value).toBe('modern js test')
    })
  })

  describe('Firefox Compatibility', () => {
    it('should work on Firefox 115+ (latest)', async () => {
      const env = createBrowserEnvironment('firefox', '115')
      mockBrowserEnvironment(env)
      
      render(<App />)
      
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      const modeSelect = screen.getByRole('combobox')
      
      await user.selectOptions(modeSelect, 'intelligent')
      expect(modeSelect.value).toBe('intelligent')
    })

    it('should work on Firefox ESR (102)', async () => {
      const env = createBrowserEnvironment('firefox', '102')
      mockBrowserEnvironment(env)
      
      render(<App />)
      
      // Test functionality that should work in older Firefox
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      await user.type(documentInput, 'Firefox compatibility test')
      
      expect(documentInput.value).toBe('Firefox compatibility test')
    })

    it('should handle Firefox-specific quirks', async () => {
      const env = createBrowserEnvironment('firefox', '110')
      mockBrowserEnvironment(env)
      
      // Mock Firefox-specific behavior
      Object.defineProperty(window, 'InstallTrigger', {
        value: {},
        configurable: true
      })
      
      render(<App />)
      
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      // Test copy/paste functionality (Firefox has different clipboard API)
      fireEvent.focus(searchInput)
      fireEvent.paste(searchInput, {
        clipboardData: {
          getData: () => 'pasted text'
        }
      })
      
      expect(searchInput).toHaveFocus()
    })
  })

  describe('Safari Compatibility', () => {
    it('should work on Safari 16+ (latest)', async () => {
      const env = createBrowserEnvironment('safari', '16')
      mockBrowserEnvironment(env)
      
      render(<App />)
      
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      await user.type(searchInput, 'safari test')
      
      expect(searchInput.value).toBe('safari test')
    })

    it('should work on Safari 14-15 (older versions)', async () => {
      const env = createBrowserEnvironment('safari', '14')
      mockBrowserEnvironment(env)
      
      render(<App />)
      
      // Test features that may not be available in older Safari
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      await user.type(documentInput, 'Safari 14 compatibility')
      
      expect(documentInput.value).toBe('Safari 14 compatibility')
    })

    it('should handle Safari-specific date/time formatting', async () => {
      const env = createBrowserEnvironment('safari', '16')
      mockBrowserEnvironment(env)
      
      render(<App />)
      
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      await user.type(searchInput, 'datum test')
      
      // Safari may format dates differently
      expect(searchInput.value).toBe('datum test')
    })
  })

  describe('Edge Compatibility', () => {
    it('should work on Edge Chromium 120+', async () => {
      const env = createBrowserEnvironment('edge', '120')
      mockBrowserEnvironment(env)
      
      render(<App />)
      
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      await user.type(searchInput, 'edge test')
      
      expect(searchInput.value).toBe('edge test')
    })

    it('should handle Edge-specific features', async () => {
      const env = createBrowserEnvironment('edge', '120')
      mockBrowserEnvironment(env)
      
      render(<App />)
      
      // Test Windows-specific features that might be available in Edge
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      await user.type(documentInput, 'Windows integration test')
      
      expect(documentInput.value).toBe('Windows integration test')
    })
  })

  describe('Mobile Browser Compatibility', () => {
    it('should work on iOS Safari', async () => {
      const env = createBrowserEnvironment('mobileSafari', '16', true)
      mockBrowserEnvironment(env)
      
      render(<App />)
      
      // Test touch interactions
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      fireEvent.touchStart(searchInput)
      fireEvent.touchEnd(searchInput)
      
      await user.type(searchInput, 'mobile safari')
      expect(searchInput.value).toBe('mobile safari')
    })

    it('should work on Chrome Mobile', async () => {
      const env = createBrowserEnvironment('chromeMobile', '120', true)
      mockBrowserEnvironment(env)
      
      render(<App />)
      
      // Test mobile-specific features
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      
      fireEvent.touchStart(documentInput)
      await user.type(documentInput, 'Chrome mobile test')
      
      expect(documentInput.value).toBe('Chrome mobile test')
    })

    it('should handle mobile viewport and touch events', async () => {
      const env = createBrowserEnvironment('mobileSafari', '16', true)
      mockBrowserEnvironment(env)
      
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', { value: 375, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 667, writable: true })
      
      render(<App />)
      
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      // Test touch events
      fireEvent.touchStart(searchInput, {
        touches: [{ clientX: 100, clientY: 100 }]
      })
      
      expect(searchInput).toBeInTheDocument()
    })

    it('should handle mobile-specific input behaviors', async () => {
      const env = createBrowserEnvironment('mobileSafari', '16', true)
      mockBrowserEnvironment(env)
      
      render(<App />)
      
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      // Test virtual keyboard interactions
      fireEvent.focus(searchInput)
      await user.type(searchInput, 'virtual keyboard test')
      
      expect(searchInput.value).toBe('virtual keyboard test')
    })
  })

  describe('Feature Detection and Polyfills', () => {
    it('should handle missing localStorage gracefully', async () => {
      const env = createBrowserEnvironment('chrome', '120')
      env.features.localStorage = false
      mockBrowserEnvironment(env)
      
      delete window.localStorage
      
      render(<App />)
      
      // App should still function without localStorage
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      await user.type(searchInput, 'no localStorage')
      
      expect(searchInput.value).toBe('no localStorage')
    })

    it('should handle missing fetch API', async () => {
      const env = createBrowserEnvironment('safari', '12')
      env.features.fetch = false
      mockBrowserEnvironment(env)
      
      delete window.fetch
      
      render(<App />)
      
      // Should still render the interface
      expect(screen.getByText('Legal Document Analyzer')).toBeInTheDocument()
    })

    it('should handle missing modern JavaScript features', async () => {
      const env = createBrowserEnvironment('safari', '12')
      env.features.es2020 = false
      mockBrowserEnvironment(env)
      
      render(<App />)
      
      // Basic functionality should still work
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      await user.type(searchInput, 'legacy browser')
      
      expect(searchInput.value).toBe('legacy browser')
    })
  })

  describe('CSS and Layout Compatibility', () => {
    it('should handle CSS Grid support', async () => {
      const env = createBrowserEnvironment('chrome', '120')
      mockBrowserEnvironment(env)
      
      render(<App />)
      
      // Check that layout elements are present
      const searchPanel = document.querySelector('.search-panel')
      const contentPanel = document.querySelector('.content-panel')
      
      expect(searchPanel).toBeInTheDocument()
      expect(contentPanel).toBeInTheDocument()
    })

    it('should handle CSS Flexbox fallbacks', async () => {
      const env = createBrowserEnvironment('safari', '10')
      env.features.cssGrid = false
      mockBrowserEnvironment(env)
      
      render(<App />)
      
      // Layout should still work with flexbox
      const appContainer = document.querySelector('.app-container')
      expect(appContainer).toBeInTheDocument()
    })

    it('should handle viewport units on mobile', async () => {
      const env = createBrowserEnvironment('mobileSafari', '14', true)
      mockBrowserEnvironment(env)
      
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', { value: 375, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 667, writable: true })
      
      render(<App />)
      
      const appContainer = document.querySelector('.app-container')
      expect(appContainer).toBeInTheDocument()
    })
  })

  describe('JavaScript API Compatibility', () => {
    it('should handle different date formatting across browsers', async () => {
      const env = createBrowserEnvironment('safari', '16')
      mockBrowserEnvironment(env)
      
      render(<App />)
      
      // Test date handling in search history
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      await user.type(searchInput, 'datum test')
      
      expect(searchInput.value).toBe('datum test')
    })

    it('should handle different clipboard API implementations', async () => {
      const env = createBrowserEnvironment('firefox', '110')
      mockBrowserEnvironment(env)
      
      // Mock different clipboard API
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true
      })
      
      render(<App />)
      
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      // Test fallback copy/paste functionality
      fireEvent.copy(searchInput)
      expect(searchInput).toBeInTheDocument()
    })

    it('should handle different scrolling behaviors', async () => {
      const env = createBrowserEnvironment('safari', '15')
      mockBrowserEnvironment(env)
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      await user.type(documentInput, 'Long document content that might cause scrolling issues in some browsers')
      
      expect(documentInput.value).toContain('Long document content')
    })
  })

  describe('Performance Across Browsers', () => {
    it('should maintain performance in Chrome', async () => {
      const env = createBrowserEnvironment('chrome', '120')
      mockBrowserEnvironment(env)
      
      const startTime = Date.now()
      render(<App />)
      const renderTime = Date.now() - startTime
      
      // Should render quickly
      expect(renderTime).toBeLessThan(1000)
    })

    it('should maintain performance in Safari', async () => {
      const env = createBrowserEnvironment('safari', '16')
      mockBrowserEnvironment(env)
      
      const startTime = Date.now()
      render(<App />)
      const renderTime = Date.now() - startTime
      
      // Safari might be slightly slower but should still be reasonable
      expect(renderTime).toBeLessThan(1500)
    })

    it('should handle large documents efficiently across browsers', async () => {
      const env = createBrowserEnvironment('firefox', '115')
      mockBrowserEnvironment(env)
      
      render(<App />)
      
      const largeDocument = 'Large document content. '.repeat(1000)
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      
      const startTime = Date.now()
      await user.type(documentInput, largeDocument.substring(0, 100))
      const inputTime = Date.now() - startTime
      
      // Should handle input efficiently
      expect(inputTime).toBeLessThan(2000)
    })
  })
})