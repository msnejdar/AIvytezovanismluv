/**
 * Application Initialization Workflow
 * Manages the proper startup sequence and dependency loading
 */

import { logger } from '../logger.js'
import { performanceMonitor } from '../performanceOptimizer.js'

export class AppInitializer {
  constructor() {
    this.initializationSteps = [
      'environment',
      'storage',
      'authentication',
      'performance',
      'features',
      'api',
      'ui'
    ]
    this.currentStep = 0
    this.isInitialized = false
    this.initializationErrors = []
    this.dependencyGraph = new Map()
    this.initializationCallbacks = []
  }

  /**
   * Main initialization sequence
   */
  async initialize(options = {}) {
    const startTime = Date.now()
    
    try {
      logger.info('APP_INIT', 'Starting application initialization', { 
        steps: this.initializationSteps.length,
        options 
      })

      // Phase 1: Environment Setup
      await this.initializeEnvironment()
      
      // Phase 2: Storage and Persistence
      await this.initializeStorage()
      
      // Phase 3: Authentication State
      await this.initializeAuthentication()
      
      // Phase 4: Performance Monitoring
      await this.initializePerformanceMonitoring()
      
      // Phase 5: Feature Detection and Configuration
      await this.initializeFeatures()
      
      // Phase 6: API Connectivity
      await this.initializeApiConnections()
      
      // Phase 7: UI Components and State
      await this.initializeUI()

      this.isInitialized = true
      
      const initTime = Date.now() - startTime
      logger.info('APP_INIT', 'Application initialization completed', { 
        duration: initTime,
        errors: this.initializationErrors.length 
      })

      // Notify callbacks
      this.initializationCallbacks.forEach(callback => {
        try {
          callback({ success: true, duration: initTime, errors: this.initializationErrors })
        } catch (error) {
          logger.error('APP_INIT', 'Initialization callback error', { error: error.message })
        }
      })

      return {
        success: true,
        duration: initTime,
        errors: this.initializationErrors
      }

    } catch (error) {
      logger.error('APP_INIT', 'Application initialization failed', { 
        error: error.message, 
        step: this.initializationSteps[this.currentStep] 
      })
      
      this.initializationCallbacks.forEach(callback => {
        try {
          callback({ success: false, error: error.message, step: this.currentStep })
        } catch (callbackError) {
          console.error('Initialization callback error:', callbackError)
        }
      })

      throw error
    }
  }

  /**
   * Phase 1: Environment Detection and Setup
   */
  async initializeEnvironment() {
    this.currentStep = 0
    logger.debug('APP_INIT', 'Initializing environment')

    const environment = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookiesEnabled: navigator.cookieEnabled,
      onlineStatus: navigator.onLine,
      screenSize: {
        width: window.screen.width,
        height: window.screen.height,
        availWidth: window.screen.availWidth,
        availHeight: window.screen.availHeight
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      memory: navigator.deviceMemory || 'unknown',
      connection: navigator.connection?.effectiveType || 'unknown',
      localStorage: this.checkLocalStorageSupport(),
      indexedDB: this.checkIndexedDBSupport(),
      serviceWorker: 'serviceWorker' in navigator,
      webWorkers: typeof Worker !== 'undefined'
    }

    // Store environment info for later use
    window.__AI_SEARCH_ENV__ = environment

    logger.info('APP_INIT', 'Environment initialized', environment)
    return environment
  }

  /**
   * Phase 2: Storage and Persistence Setup
   */
  async initializeStorage() {
    this.currentStep = 1
    logger.debug('APP_INIT', 'Initializing storage systems')

    const storage = {
      localStorage: null,
      sessionStorage: null,
      indexedDB: null,
      cache: new Map()
    }

    try {
      // Test localStorage
      if (this.checkLocalStorageSupport()) {
        storage.localStorage = window.localStorage
        logger.debug('APP_INIT', 'localStorage available')
      }

      // Test sessionStorage
      if (typeof Storage !== 'undefined' && window.sessionStorage) {
        storage.sessionStorage = window.sessionStorage
        logger.debug('APP_INIT', 'sessionStorage available')
      }

      // Initialize in-memory cache
      storage.cache = new Map()
      
      // Set up cache cleanup
      setInterval(() => {
        this.cleanupExpiredCache(storage.cache)
      }, 300000) // 5 minutes

      window.__AI_SEARCH_STORAGE__ = storage
      
    } catch (error) {
      logger.warn('APP_INIT', 'Storage initialization partial failure', { error: error.message })
      this.initializationErrors.push(`Storage: ${error.message}`)
    }

    return storage
  }

  /**
   * Phase 3: Authentication State Management
   */
  async initializeAuthentication() {
    this.currentStep = 2
    logger.debug('APP_INIT', 'Initializing authentication')

    const auth = {
      isAuthenticated: false,
      sessionValid: false,
      lastCheck: null,
      method: 'password'
    }

    try {
      // Check for existing authentication
      const savedAuth = localStorage.getItem('aiSearchAuth')
      if (savedAuth === 'true') {
        auth.isAuthenticated = true
        auth.sessionValid = true
        auth.lastCheck = Date.now()
        logger.info('APP_INIT', 'Found valid authentication session')
      }

      // Set up session validation
      this.setupSessionValidation(auth)

      window.__AI_SEARCH_AUTH__ = auth

    } catch (error) {
      logger.warn('APP_INIT', 'Authentication initialization failed', { error: error.message })
      this.initializationErrors.push(`Auth: ${error.message}`)
    }

    return auth
  }

  /**
   * Phase 4: Performance Monitoring Setup
   */
  async initializePerformanceMonitoring() {
    this.currentStep = 3
    logger.debug('APP_INIT', 'Initializing performance monitoring')

    try {
      // Initialize performance monitoring
      performanceMonitor.initialize({
        enableMemoryWatch: true,
        enableCaching: true,
        memoryThreshold: 100 * 1024 * 1024, // 100MB
        cacheSize: 50
      })

      // Set up performance observers
      if ('PerformanceObserver' in window) {
        this.setupPerformanceObservers()
      }

      // Monitor critical metrics
      this.setupCriticalMetricsMonitoring()

      logger.info('APP_INIT', 'Performance monitoring initialized')

    } catch (error) {
      logger.warn('APP_INIT', 'Performance monitoring setup failed', { error: error.message })
      this.initializationErrors.push(`Performance: ${error.message}`)
    }
  }

  /**
   * Phase 5: Feature Detection and Configuration
   */
  async initializeFeatures() {
    this.currentStep = 4
    logger.debug('APP_INIT', 'Initializing features')

    const features = {
      fuzzySearch: true,
      semanticSearch: true,
      contractAnalysis: true,
      intelligentHighlighting: true,
      realTimeSearch: true,
      caching: true,
      advancedRanking: true,
      multiLanguage: true,
      accessibilityFeatures: true,
      exportFeatures: true
    }

    try {
      // Test feature availability based on environment
      const env = window.__AI_SEARCH_ENV__

      // Disable heavy features on low-memory devices
      if (env?.memory && env.memory < 2) {
        features.semanticSearch = false
        features.realTimeSearch = false
        logger.info('APP_INIT', 'Disabled heavy features for low-memory device')
      }

      // Disable caching if storage is limited
      if (!env?.localStorage) {
        features.caching = false
        logger.info('APP_INIT', 'Disabled caching due to storage limitations')
      }

      window.__AI_SEARCH_FEATURES__ = features
      logger.info('APP_INIT', 'Features initialized', features)

    } catch (error) {
      logger.warn('APP_INIT', 'Feature initialization failed', { error: error.message })
      this.initializationErrors.push(`Features: ${error.message}`)
    }

    return features
  }

  /**
   * Phase 6: API Connection and Health Check
   */
  async initializeApiConnections() {
    this.currentStep = 5
    logger.debug('APP_INIT', 'Initializing API connections')

    const api = {
      claude: { available: false, latency: null, lastCheck: null },
      local: { available: false, latency: null, lastCheck: null },
      status: 'checking'
    }

    try {
      // Test local API endpoint
      const localStart = Date.now()
      try {
        const response = await fetch('/', { 
          method: 'GET', 
          timeout: 5000,
          signal: AbortSignal.timeout(5000)
        })
        
        if (response.ok) {
          api.local.available = true
          api.local.latency = Date.now() - localStart
          api.local.lastCheck = Date.now()
        }
      } catch (error) {
        logger.warn('APP_INIT', 'Local API not available', { error: error.message })
      }

      // Test Claude API availability (lightweight check)
      try {
        const claudeStart = Date.now()
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'test', document: 'test' }),
          timeout: 10000,
          signal: AbortSignal.timeout(10000)
        })
        
        api.claude.available = response.status !== 404
        api.claude.latency = Date.now() - claudeStart
        api.claude.lastCheck = Date.now()
      } catch (error) {
        logger.warn('APP_INIT', 'Claude API not available', { error: error.message })
      }

      api.status = api.local.available || api.claude.available ? 'available' : 'offline'
      
      window.__AI_SEARCH_API__ = api
      logger.info('APP_INIT', 'API connections initialized', api)

    } catch (error) {
      logger.warn('APP_INIT', 'API initialization failed', { error: error.message })
      this.initializationErrors.push(`API: ${error.message}`)
    }

    return api
  }

  /**
   * Phase 7: UI Components and State Setup
   */
  async initializeUI() {
    this.currentStep = 6
    logger.debug('APP_INIT', 'Initializing UI components')

    const ui = {
      theme: 'professional',
      responsive: true,
      accessibility: true,
      animations: true,
      notifications: true
    }

    try {
      // Set up responsive design breakpoints
      this.setupResponsiveBreakpoints()

      // Initialize accessibility features
      this.setupAccessibilityFeatures()

      // Set up keyboard shortcuts
      this.setupKeyboardShortcuts()

      // Initialize notification system
      this.setupNotificationSystem()

      window.__AI_SEARCH_UI__ = ui
      logger.info('APP_INIT', 'UI initialized', ui)

    } catch (error) {
      logger.warn('APP_INIT', 'UI initialization failed', { error: error.message })
      this.initializationErrors.push(`UI: ${error.message}`)
    }

    return ui
  }

  /**
   * Helper Methods
   */
  checkLocalStorageSupport() {
    try {
      const test = 'localStorage-test'
      localStorage.setItem(test, test)
      localStorage.removeItem(test)
      return true
    } catch (error) {
      return false
    }
  }

  checkIndexedDBSupport() {
    return 'indexedDB' in window
  }

  setupSessionValidation(auth) {
    // Validate session every 5 minutes
    setInterval(() => {
      if (auth.isAuthenticated) {
        const sessionAge = Date.now() - auth.lastCheck
        const maxAge = 24 * 60 * 60 * 1000 // 24 hours
        
        if (sessionAge > maxAge) {
          auth.isAuthenticated = false
          auth.sessionValid = false
          localStorage.removeItem('aiSearchAuth')
          logger.info('APP_INIT', 'Session expired')
        }
      }
    }, 300000) // 5 minutes
  }

  setupPerformanceObservers() {
    try {
      // Observe long tasks
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            logger.warn('PERFORMANCE', 'Long task detected', {
              duration: entry.duration,
              startTime: entry.startTime
            })
          }
        }
      })
      longTaskObserver.observe({ entryTypes: ['longtask'] })

      // Observe navigation timing
      const navigationObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          logger.info('PERFORMANCE', 'Navigation timing', {
            loadTime: entry.loadEventEnd - entry.loadEventStart,
            domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart
          })
        }
      })
      navigationObserver.observe({ entryTypes: ['navigation'] })

    } catch (error) {
      logger.warn('APP_INIT', 'Performance observers setup failed', { error: error.message })
    }
  }

  setupCriticalMetricsMonitoring() {
    // Monitor memory usage
    setInterval(() => {
      if (performance.memory) {
        const memoryUsage = {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit
        }

        if (memoryUsage.used / memoryUsage.limit > 0.8) {
          logger.warn('PERFORMANCE', 'High memory usage detected', memoryUsage)
        }
      }
    }, 30000) // 30 seconds
  }

  setupResponsiveBreakpoints() {
    const breakpoints = {
      mobile: 768,
      tablet: 1024,
      desktop: 1200
    }

    window.__AI_SEARCH_BREAKPOINTS__ = breakpoints
  }

  setupAccessibilityFeatures() {
    // Set up focus management
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') {
        document.body.classList.add('using-keyboard')
      }
    })

    document.addEventListener('mousedown', () => {
      document.body.classList.remove('using-keyboard')
    })

    // Set up ARIA live regions
    if (!document.getElementById('aria-live-region')) {
      const liveRegion = document.createElement('div')
      liveRegion.id = 'aria-live-region'
      liveRegion.setAttribute('aria-live', 'polite')
      liveRegion.setAttribute('aria-atomic', 'true')
      liveRegion.style.position = 'absolute'
      liveRegion.style.left = '-10000px'
      liveRegion.style.width = '1px'
      liveRegion.style.height = '1px'
      liveRegion.style.overflow = 'hidden'
      document.body.appendChild(liveRegion)
    }
  }

  setupKeyboardShortcuts() {
    const shortcuts = new Map([
      ['ctrl+k', () => this.focusSearchInput()],
      ['escape', () => this.clearHighlights()],
      ['ctrl+enter', () => this.performSearch()],
      ['ctrl+shift+l', () => this.toggleLogout()]
    ])

    document.addEventListener('keydown', (event) => {
      const key = `${event.ctrlKey ? 'ctrl+' : ''}${event.shiftKey ? 'shift+' : ''}${event.key.toLowerCase()}`
      
      if (shortcuts.has(key)) {
        event.preventDefault()
        shortcuts.get(key)()
      }
    })

    window.__AI_SEARCH_SHORTCUTS__ = shortcuts
  }

  setupNotificationSystem() {
    const notifications = {
      container: null,
      queue: [],
      maxVisible: 3,
      defaultTimeout: 5000
    }

    // Create notification container
    const container = document.createElement('div')
    container.id = 'notification-container'
    container.className = 'notification-container'
    container.setAttribute('aria-live', 'polite')
    document.body.appendChild(container)

    notifications.container = container
    window.__AI_SEARCH_NOTIFICATIONS__ = notifications
  }

  cleanupExpiredCache(cache) {
    const now = Date.now()
    for (const [key, value] of cache.entries()) {
      if (value.expires && value.expires < now) {
        cache.delete(key)
      }
    }
  }

  // Public API
  onInitialization(callback) {
    this.initializationCallbacks.push(callback)
  }

  getInitializationStatus() {
    return {
      isInitialized: this.isInitialized,
      currentStep: this.currentStep,
      totalSteps: this.initializationSteps.length,
      errors: this.initializationErrors,
      stepName: this.initializationSteps[this.currentStep]
    }
  }

  // Shortcut methods for common actions
  focusSearchInput() {
    const searchInput = document.querySelector('.search-input')
    if (searchInput) {
      searchInput.focus()
    }
  }

  clearHighlights() {
    // This will be called by the React component
    if (window.__AI_SEARCH_CLEAR_HIGHLIGHTS__) {
      window.__AI_SEARCH_CLEAR_HIGHLIGHTS__()
    }
  }

  performSearch() {
    // This will be called by the React component
    if (window.__AI_SEARCH_PERFORM_SEARCH__) {
      window.__AI_SEARCH_PERFORM_SEARCH__()
    }
  }

  toggleLogout() {
    // This will be called by the React component
    if (window.__AI_SEARCH_LOGOUT__) {
      window.__AI_SEARCH_LOGOUT__()
    }
  }
}

// Create singleton instance
export const appInitializer = new AppInitializer()

// Export initialization function for easy use
export const initializeApp = (options) => appInitializer.initialize(options)

export default appInitializer