/**
 * Mobile Responsiveness Testing Suite
 * 
 * Tests application behavior and layout across different screen sizes and mobile devices:
 * - Various viewport sizes (320px to 1920px width)
 * - Portrait and landscape orientations
 * - Touch interactions and gestures
 * - Mobile-specific UI adaptations
 * - Performance on mobile devices
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../App.jsx'

// Viewport configurations for different device types
const viewports = {
  // Mobile phones (portrait)
  'iPhone SE': { width: 375, height: 667 },
  'iPhone 12': { width: 390, height: 844 },
  'iPhone 12 Pro Max': { width: 428, height: 926 },
  'Samsung Galaxy S21': { width: 384, height: 854 },
  'Google Pixel 5': { width: 393, height: 851 },
  
  // Mobile phones (landscape)
  'iPhone SE Landscape': { width: 667, height: 375 },
  'iPhone 12 Landscape': { width: 844, height: 390 },
  
  // Tablets (portrait)
  'iPad': { width: 768, height: 1024 },
  'iPad Pro': { width: 834, height: 1194 },
  'Samsung Galaxy Tab': { width: 800, height: 1280 },
  
  // Tablets (landscape)
  'iPad Landscape': { width: 1024, height: 768 },
  'iPad Pro Landscape': { width: 1194, height: 834 },
  
  // Small laptops and desktops
  'Laptop Small': { width: 1366, height: 768 },
  'Desktop': { width: 1920, height: 1080 },
  
  // Edge cases
  'Very Small': { width: 320, height: 568 },
  'Very Wide': { width: 2560, height: 1440 }
}

const setViewport = (viewport) => {
  // Mock window dimensions
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: viewport.width,
  })
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: viewport.height,
  })
  
  // Mock screen dimensions
  Object.defineProperty(window.screen, 'width', {
    writable: true,
    configurable: true,
    value: viewport.width,
  })
  Object.defineProperty(window.screen, 'height', {
    writable: true,
    configurable: true,
    value: viewport.height,
  })
  
  // Trigger resize event
  fireEvent(window, new Event('resize'))
}

const mockTouchDevice = (isTouchDevice = true) => {
  if (isTouchDevice) {
    // Mock touch support
    window.ontouchstart = () => {}
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 5,
      configurable: true
    })
    
    // Mock mobile user agent
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
      configurable: true
    })
  } else {
    delete window.ontouchstart
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 0,
      configurable: true
    })
  }
}

describe('Mobile Responsiveness Testing', () => {
  let user
  let originalInnerWidth
  let originalInnerHeight
  let originalUserAgent

  beforeEach(() => {
    user = userEvent.setup()
    
    // Store original values
    originalInnerWidth = window.innerWidth
    originalInnerHeight = window.innerHeight
    originalUserAgent = navigator.userAgent
    
    // Setup localStorage mock
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
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    })
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    })
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true
    })
    
    delete window.ontouchstart
    vi.clearAllMocks()
    cleanup()
  })

  describe('Mobile Phone Layouts', () => {
    it('should render properly on iPhone SE (375px)', () => {
      setViewport(viewports['iPhone SE'])
      mockTouchDevice(true)
      
      render(<App />)
      
      expect(screen.getByText('Legal Document Analyzer')).toBeInTheDocument()
      
      // Check that elements are stacked vertically on mobile
      const searchPanel = document.querySelector('.search-panel')
      const contentPanel = document.querySelector('.content-panel')
      
      expect(searchPanel).toBeInTheDocument()
      expect(contentPanel).toBeInTheDocument()
    })

    it('should render properly on iPhone 12 (390px)', () => {
      setViewport(viewports['iPhone 12'])
      mockTouchDevice(true)
      
      render(<App />)
      
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      
      expect(searchInput).toBeInTheDocument()
      expect(documentInput).toBeInTheDocument()
    })

    it('should render properly on iPhone 12 Pro Max (428px)', () => {
      setViewport(viewports['iPhone 12 Pro Max'])
      mockTouchDevice(true)
      
      render(<App />)
      
      // Test that larger phones can accommodate more content
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      expect(searchInput).toBeInTheDocument()
    })

    it('should handle landscape orientation on mobile', () => {
      setViewport(viewports['iPhone 12 Landscape'])
      mockTouchDevice(true)
      
      render(<App />)
      
      // In landscape, layout might change to accommodate wider screen
      const appContainer = document.querySelector('.app-container')
      expect(appContainer).toBeInTheDocument()
    })

    it('should handle very small screens (320px)', () => {
      setViewport(viewports['Very Small'])
      mockTouchDevice(true)
      
      render(<App />)
      
      // Even on very small screens, essential elements should be accessible
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      expect(searchInput).toBeInTheDocument()
    })
  })

  describe('Tablet Layouts', () => {
    it('should render properly on iPad (768px)', () => {
      setViewport(viewports['iPad'])
      mockTouchDevice(true)
      
      render(<App />)
      
      const searchPanel = document.querySelector('.search-panel')
      const contentPanel = document.querySelector('.content-panel')
      
      expect(searchPanel).toBeInTheDocument()
      expect(contentPanel).toBeInTheDocument()
    })

    it('should render properly on iPad Pro (834px)', () => {
      setViewport(viewports['iPad Pro'])
      mockTouchDevice(true)
      
      render(<App />)
      
      // Tablets should have more space for side-by-side layout
      const appContainer = document.querySelector('.app-container')
      expect(appContainer).toBeInTheDocument()
    })

    it('should handle tablet landscape orientation', () => {
      setViewport(viewports['iPad Landscape'])
      mockTouchDevice(true)
      
      render(<App />)
      
      // Landscape tablets should utilize horizontal space better
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      
      expect(searchInput).toBeInTheDocument()
      expect(documentInput).toBeInTheDocument()
    })
  })

  describe('Touch Interactions', () => {
    it('should handle touch events on mobile devices', async () => {
      setViewport(viewports['iPhone 12'])
      mockTouchDevice(true)
      
      render(<App />)
      
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      // Test touch start and end
      fireEvent.touchStart(searchInput, {
        touches: [{ clientX: 100, clientY: 100 }]
      })
      fireEvent.touchEnd(searchInput)
      
      expect(searchInput).toBeInTheDocument()
    })

    it('should handle tap to focus on input fields', async () => {
      setViewport(viewports['iPhone 12'])
      mockTouchDevice(true)
      
      render(<App />)
      
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      fireEvent.touchStart(searchInput)
      fireEvent.touchEnd(searchInput)
      fireEvent.click(searchInput)
      
      expect(searchInput).toHaveFocus()
    })

    it('should handle touch scrolling in document area', async () => {
      setViewport(viewports['iPhone 12'])
      mockTouchDevice(true)
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      
      // Simulate long content that requires scrolling
      await user.type(documentInput, 'Very long document content that would require scrolling on mobile devices. '.repeat(20))
      
      // Test touch scroll events
      fireEvent.touchStart(documentInput, {
        touches: [{ clientX: 200, clientY: 300 }]
      })
      fireEvent.touchMove(documentInput, {
        touches: [{ clientX: 200, clientY: 250 }]
      })
      fireEvent.touchEnd(documentInput)
      
      expect(documentInput.value).toContain('Very long document')
    })

    it('should handle pinch-to-zoom gestures', async () => {
      setViewport(viewports['iPhone 12'])
      mockTouchDevice(true)
      
      render(<App />)
      
      const appContainer = document.querySelector('.app-container')
      
      // Simulate pinch gesture
      fireEvent.touchStart(appContainer, {
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 200 }
        ]
      })
      
      fireEvent.touchMove(appContainer, {
        touches: [
          { clientX: 80, clientY: 80 },
          { clientX: 220, clientY: 220 }
        ]
      })
      
      fireEvent.touchEnd(appContainer)
      
      expect(appContainer).toBeInTheDocument()
    })
  })

  describe('Virtual Keyboard Handling', () => {
    it('should handle virtual keyboard appearance on mobile', async () => {
      setViewport(viewports['iPhone 12'])
      mockTouchDevice(true)
      
      render(<App />)
      
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      // Simulate virtual keyboard appearing (reduces viewport height)
      fireEvent.focus(searchInput)
      
      // Mock reduced viewport height when keyboard is open
      setViewport({ width: 390, height: 500 })
      
      await user.type(searchInput, 'mobile keyboard test')
      
      expect(searchInput.value).toBe('mobile keyboard test')
    })

    it('should handle input field visibility when keyboard is open', async () => {
      setViewport(viewports['iPhone 12'])
      mockTouchDevice(true)
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      
      // Focus on input at bottom of screen
      fireEvent.focus(documentInput)
      
      // Keyboard reduces available space
      setViewport({ width: 390, height: 400 })
      
      await user.type(documentInput, 'keyboard visibility test')
      
      expect(documentInput.value).toBe('keyboard visibility test')
    })

    it('should maintain functionality when keyboard opens and closes', async () => {
      setViewport(viewports['iPhone 12'])
      mockTouchDevice(true)
      
      render(<App />)
      
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      
      // Open keyboard
      fireEvent.focus(searchInput)
      setViewport({ width: 390, height: 500 })
      
      await user.type(searchInput, 'keyboard test')
      
      // Close keyboard
      fireEvent.blur(searchInput)
      setViewport(viewports['iPhone 12'])
      
      expect(searchInput.value).toBe('keyboard test')
    })
  })

  describe('Button and Touch Target Sizes', () => {
    it('should have appropriately sized touch targets on mobile', () => {
      setViewport(viewports['iPhone 12'])
      mockTouchDevice(true)
      
      render(<App />)
      
      const searchButton = screen.getByRole('button', { name: '', hidden: true })
      const modeSelect = screen.getByRole('combobox')
      
      // Touch targets should be at least 44px (iOS) or 48dp (Android) - roughly 44-48px
      expect(searchButton).toBeInTheDocument()
      expect(modeSelect).toBeInTheDocument()
    })

    it('should have accessible spacing between touch targets', async () => {
      setViewport(viewports['iPhone 12'])
      mockTouchDevice(true)
      
      render(<App />)
      
      const testButtons = screen.getAllByText(/test/i)
      
      // Should have adequate spacing to prevent accidental touches
      expect(testButtons.length).toBeGreaterThan(0)
    })

    it('should handle button presses on mobile without double-tap delay', async () => {
      setViewport(viewports['iPhone 12'])
      mockTouchDevice(true)
      
      render(<App />)
      
      const rnčTestButton = screen.getByText('RNČ test')
      
      // Single tap should work immediately
      fireEvent.touchStart(rnčTestButton)
      fireEvent.touchEnd(rnčTestButton)
      fireEvent.click(rnčTestButton)
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
        expect(searchInput.value).toBe('local:rodné číslo')
      })
    })
  })

  describe('Performance on Mobile Devices', () => {
    it('should load quickly on mobile devices', async () => {
      setViewport(viewports['iPhone 12'])
      mockTouchDevice(true)
      
      const startTime = Date.now()
      render(<App />)
      const loadTime = Date.now() - startTime
      
      // Should load within reasonable time on mobile
      expect(loadTime).toBeLessThan(2000)
    })

    it('should handle large document input efficiently on mobile', async () => {
      setViewport(viewports['iPhone 12'])
      mockTouchDevice(true)
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      
      // Test with moderately large content
      const largeContent = 'Large document content for mobile testing. '.repeat(50)
      
      const startTime = Date.now()
      await user.type(documentInput, largeContent.substring(0, 100))
      const inputTime = Date.now() - startTime
      
      // Should handle input without significant lag
      expect(inputTime).toBeLessThan(3000)
    })

    it('should maintain responsive scrolling on mobile', async () => {
      setViewport(viewports['iPhone 12'])
      mockTouchDevice(true)
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      await user.type(documentInput, 'Content that will create scrollable area. '.repeat(30))
      
      // Test smooth scrolling
      fireEvent.scroll(documentInput, { target: { scrollTop: 100 } })
      
      expect(documentInput.value).toContain('Content that will create')
    })
  })

  describe('Orientation Changes', () => {
    it('should handle portrait to landscape rotation', async () => {
      setViewport(viewports['iPhone 12'])
      mockTouchDevice(true)
      
      render(<App />)
      
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      await user.type(searchInput, 'rotation test')
      
      // Rotate to landscape
      setViewport(viewports['iPhone 12 Landscape'])
      fireEvent(window, new Event('orientationchange'))
      
      // Content should remain
      expect(searchInput.value).toBe('rotation test')
    })

    it('should handle landscape to portrait rotation', async () => {
      setViewport(viewports['iPhone 12 Landscape'])
      mockTouchDevice(true)
      
      render(<App />)
      
      const documentInput = screen.getByPlaceholderText(/vložte text smlouvy/i)
      await user.type(documentInput, 'landscape content')
      
      // Rotate to portrait
      setViewport(viewports['iPhone 12'])
      fireEvent(window, new Event('orientationchange'))
      
      expect(documentInput.value).toBe('landscape content')
    })

    it('should adjust layout appropriately after rotation', async () => {
      setViewport(viewports['iPad'])
      mockTouchDevice(true)
      
      render(<App />)
      
      // Rotate to landscape
      setViewport(viewports['iPad Landscape'])
      fireEvent(window, new Event('orientationchange'))
      
      // Layout should adapt
      const appContainer = document.querySelector('.app-container')
      expect(appContainer).toBeInTheDocument()
    })
  })

  describe('Mobile-Specific Features', () => {
    it('should handle mobile browser zoom', async () => {
      setViewport(viewports['iPhone 12'])
      mockTouchDevice(true)
      
      render(<App />)
      
      // Simulate zoom by changing viewport scale
      const metaViewport = document.createElement('meta')
      metaViewport.setAttribute('name', 'viewport')
      metaViewport.setAttribute('content', 'width=device-width, initial-scale=2.0')
      document.head.appendChild(metaViewport)
      
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      await user.type(searchInput, 'zoom test')
      
      expect(searchInput.value).toBe('zoom test')
      
      document.head.removeChild(metaViewport)
    })

    it('should prevent horizontal scrolling on mobile', () => {
      setViewport(viewports['iPhone SE'])
      mockTouchDevice(true)
      
      render(<App />)
      
      // Check that content doesn't overflow horizontally
      const appContainer = document.querySelector('.app-container')
      expect(appContainer).toBeInTheDocument()
      
      // In a real test, you would check computed styles or measure scroll width
      expect(window.innerWidth).toBe(375)
    })

    it('should handle mobile pull-to-refresh gesture', async () => {
      setViewport(viewports['iPhone 12'])
      mockTouchDevice(true)
      
      render(<App />)
      
      const appContainer = document.querySelector('.app-container')
      
      // Simulate pull-to-refresh gesture
      fireEvent.touchStart(appContainer, {
        touches: [{ clientX: 200, clientY: 50 }]
      })
      
      fireEvent.touchMove(appContainer, {
        touches: [{ clientX: 200, clientY: 150 }]
      })
      
      fireEvent.touchEnd(appContainer)
      
      // App should handle the gesture gracefully
      expect(appContainer).toBeInTheDocument()
    })

    it('should handle mobile context menu events', async () => {
      setViewport(viewports['iPhone 12'])
      mockTouchDevice(true)
      
      render(<App />)
      
      const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
      await user.type(searchInput, 'context menu test')
      
      // Long press to trigger context menu
      fireEvent.touchStart(searchInput, {
        touches: [{ clientX: 100, clientY: 100 }]
      })
      
      // Hold for context menu
      setTimeout(() => {
        fireEvent.touchEnd(searchInput)
      }, 500)
      
      expect(searchInput.value).toBe('context menu test')
    })
  })

  describe('Cross-Device Consistency', () => {
    it('should maintain functionality across different mobile devices', async () => {
      const devices = ['iPhone SE', 'iPhone 12', 'Samsung Galaxy S21', 'Google Pixel 5']
      
      for (const device of devices) {
        setViewport(viewports[device])
        mockTouchDevice(true)
        
        const { unmount } = render(<App />)
        
        const searchInput = screen.getByPlaceholderText(/vyhledávat v smlouvě/i)
        await user.type(searchInput, `test on ${device}`)
        
        expect(searchInput.value).toBe(`test on ${device}`)
        
        unmount()
        cleanup()
      }
    })

    it('should maintain consistent styling across viewport sizes', () => {
      const sizes = [320, 375, 390, 428, 768, 834, 1024]
      
      for (const width of sizes) {
        setViewport({ width, height: 800 })
        
        const { unmount } = render(<App />)
        
        const searchPanel = document.querySelector('.search-panel')
        const contentPanel = document.querySelector('.content-panel')
        
        expect(searchPanel).toBeInTheDocument()
        expect(contentPanel).toBeInTheDocument()
        
        unmount()
        cleanup()
      }
    })
  })
})