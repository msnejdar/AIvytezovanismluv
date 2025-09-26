/**
 * Authentication Workflow Management
 * Handles login, logout, session management, and security features
 */

import { logger } from '../logger.js'

export class AuthenticationFlow {
  constructor() {
    this.state = {
      isAuthenticated: false,
      isAuthenticating: false,
      sessionValid: false,
      lastActivity: null,
      sessionStart: null,
      attempts: 0,
      lockoutUntil: null,
      sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
      maxAttempts: 5,
      lockoutDuration: 15 * 60 * 1000, // 15 minutes
      activityTimeout: 30 * 60 * 1000 // 30 minutes
    }
    
    this.listeners = new Set()
    this.activityTimer = null
    this.sessionTimer = null
    this.securityConfig = {
      passwordMinLength: 8,
      requireSecureConnection: false, // Set to true in production
      enableBruteForceProtection: true,
      enableSessionTimeout: true,
      enableActivityTracking: true
    }
    
    this.initializeSecurityFeatures()
  }

  /**
   * Initialize security features and session recovery
   */
  initializeSecurityFeatures() {
    // Attempt to recover existing session
    this.recoverSession()
    
    // Set up activity tracking
    if (this.securityConfig.enableActivityTracking) {
      this.setupActivityTracking()
    }
    
    // Set up session monitoring
    if (this.securityConfig.enableSessionTimeout) {
      this.setupSessionMonitoring()
    }
    
    // Set up security headers check
    this.checkSecurityRequirements()
    
    logger.info('AUTH_FLOW', 'Authentication flow initialized', {
      config: this.securityConfig,
      sessionRecovered: this.state.isAuthenticated
    })
  }

  /**
   * Main authentication method
   */
  async authenticate(credentials) {
    const startTime = Date.now()
    
    try {
      // Pre-authentication checks
      this.validateAuthenticationAttempt()
      
      this.setState({ isAuthenticating: true })
      this.emitStateChange('authentication_started', { timestamp: startTime })
      
      // Simulate authentication delay for security
      await this.simulateAuthenticationDelay()
      
      // Validate credentials
      const isValid = await this.validateCredentials(credentials)
      
      if (isValid) {
        await this.handleSuccessfulAuthentication()
        
        const duration = Date.now() - startTime
        logger.info('AUTH_FLOW', 'Authentication successful', { 
          duration,
          sessionId: this.generateSessionId()
        })
        
        this.emitStateChange('authentication_success', { 
          duration, 
          sessionStart: this.state.sessionStart 
        })
        
        return { success: true, sessionStart: this.state.sessionStart }
        
      } else {
        await this.handleFailedAuthentication()
        
        const duration = Date.now() - startTime
        logger.warn('AUTH_FLOW', 'Authentication failed', { 
          duration,
          attempts: this.state.attempts,
          locked: this.isLockedOut()
        })
        
        this.emitStateChange('authentication_failed', { 
          attempts: this.state.attempts,
          lockoutUntil: this.state.lockoutUntil
        })
        
        return { 
          success: false, 
          error: this.getAuthenticationError(),
          attemptsRemaining: this.securityConfig.maxAttempts - this.state.attempts,
          lockoutUntil: this.state.lockoutUntil
        }
      }
      
    } catch (error) {
      this.setState({ isAuthenticating: false })
      
      logger.error('AUTH_FLOW', 'Authentication error', { 
        error: error.message,
        stack: error.stack
      })
      
      this.emitStateChange('authentication_error', { error: error.message })
      
      return { 
        success: false, 
        error: 'Nastala neočekávaná chyba při přihlašování.',
        technical: error.message
      }
    }
  }

  /**
   * Logout functionality
   */
  async logout(reason = 'user_initiated') {
    try {
      logger.info('AUTH_FLOW', 'Logout initiated', { 
        reason,
        sessionDuration: this.getSessionDuration()
      })
      
      // Clear timers
      this.clearTimers()
      
      // Clear stored authentication
      this.clearStoredAuthentication()
      
      // Reset state
      this.setState({
        isAuthenticated: false,
        isAuthenticating: false,
        sessionValid: false,
        lastActivity: null,
        sessionStart: null
      })
      
      this.emitStateChange('logout', { reason, timestamp: Date.now() })
      
      return { success: true, reason }
      
    } catch (error) {
      logger.error('AUTH_FLOW', 'Logout error', { error: error.message })
      return { success: false, error: error.message }
    }
  }

  /**
   * Session validation
   */
  validateSession() {
    if (!this.state.isAuthenticated) {
      return { valid: false, reason: 'not_authenticated' }
    }
    
    const now = Date.now()
    
    // Check session timeout
    if (this.state.sessionStart && (now - this.state.sessionStart) > this.state.sessionTimeout) {
      this.logout('session_expired')
      return { valid: false, reason: 'session_expired' }
    }
    
    // Check activity timeout
    if (this.state.lastActivity && (now - this.state.lastActivity) > this.state.activityTimeout) {
      this.logout('activity_timeout')
      return { valid: false, reason: 'activity_timeout' }
    }
    
    return { valid: true, remainingTime: this.getRemainingSessionTime() }
  }

  /**
   * Extend session on activity
   */
  recordActivity() {
    if (this.state.isAuthenticated) {
      this.setState({ lastActivity: Date.now() })
      
      // Reset activity timer
      if (this.activityTimer) {
        clearTimeout(this.activityTimer)
      }
      
      this.activityTimer = setTimeout(() => {
        this.logout('activity_timeout')
      }, this.state.activityTimeout)
    }
  }

  /**
   * Private Methods
   */
  validateAuthenticationAttempt() {
    // Check if locked out
    if (this.isLockedOut()) {
      const remainingTime = Math.ceil((this.state.lockoutUntil - Date.now()) / 1000)
      throw new Error(`Účet je dočasně zablokován. Zkuste to znovu za ${remainingTime} sekund.`)
    }
    
    // Check if already authenticating
    if (this.state.isAuthenticating) {
      throw new Error('Probíhá přihlašování, počkejte prosím.')
    }
    
    // Check secure connection in production
    if (this.securityConfig.requireSecureConnection && location.protocol !== 'https:') {
      throw new Error('Přihlášení vyžaduje zabezpečené připojení.')
    }
  }

  async simulateAuthenticationDelay() {
    // Add random delay to prevent timing attacks
    const delay = Math.random() * 1000 + 500 // 500-1500ms
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  async validateCredentials(credentials) {
    const { password } = credentials
    
    // Basic validation
    if (!password || typeof password !== 'string') {
      return false
    }
    
    // Check password length
    if (password.length < this.securityConfig.passwordMinLength) {
      return false
    }
    
    // Main password validation
    return password === 'sporka2025'
  }

  async handleSuccessfulAuthentication() {
    const now = Date.now()
    
    this.setState({
      isAuthenticated: true,
      isAuthenticating: false,
      sessionValid: true,
      sessionStart: now,
      lastActivity: now,
      attempts: 0, // Reset attempts on success
      lockoutUntil: null
    })
    
    // Store authentication state
    this.storeAuthentication()
    
    // Start session monitoring
    this.startSessionMonitoring()
    
    // Record activity
    this.recordActivity()
  }

  async handleFailedAuthentication() {
    this.setState({
      isAuthenticating: false,
      attempts: this.state.attempts + 1
    })
    
    // Check if should lock out
    if (this.state.attempts >= this.securityConfig.maxAttempts) {
      this.setState({
        lockoutUntil: Date.now() + this.state.lockoutDuration
      })
    }
  }

  storeAuthentication() {
    try {
      localStorage.setItem('aiSearchAuth', 'true')
      localStorage.setItem('aiSearchAuthTime', this.state.sessionStart.toString())
      
      // Store session metadata
      const sessionData = {
        start: this.state.sessionStart,
        userAgent: navigator.userAgent,
        ip: 'client-side' // Would be replaced with actual IP in production
      }
      
      localStorage.setItem('aiSearchSession', JSON.stringify(sessionData))
      
    } catch (error) {
      logger.warn('AUTH_FLOW', 'Failed to store authentication', { error: error.message })
    }
  }

  clearStoredAuthentication() {
    try {
      localStorage.removeItem('aiSearchAuth')
      localStorage.removeItem('aiSearchAuthTime')
      localStorage.removeItem('aiSearchSession')
    } catch (error) {
      logger.warn('AUTH_FLOW', 'Failed to clear stored authentication', { error: error.message })
    }
  }

  recoverSession() {
    try {
      const isAuthenticated = localStorage.getItem('aiSearchAuth') === 'true'
      const authTime = localStorage.getItem('aiSearchAuthTime')
      
      if (isAuthenticated && authTime) {
        const sessionStart = parseInt(authTime, 10)
        const now = Date.now()
        
        // Check if session is still valid
        if ((now - sessionStart) < this.state.sessionTimeout) {
          this.setState({
            isAuthenticated: true,
            sessionValid: true,
            sessionStart: sessionStart,
            lastActivity: now
          })
          
          this.startSessionMonitoring()
          logger.info('AUTH_FLOW', 'Session recovered from storage')
          return true
        } else {
          // Session expired, clear it
          this.clearStoredAuthentication()
          logger.info('AUTH_FLOW', 'Stored session expired, cleared')
        }
      }
    } catch (error) {
      logger.warn('AUTH_FLOW', 'Session recovery failed', { error: error.message })
    }
    
    return false
  }

  setupActivityTracking() {
    // Track user activity events
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart']
    
    const handleActivity = () => {
      this.recordActivity()
    }
    
    // Throttle activity recording to prevent excessive calls
    let activityThrottle = false
    const throttledHandleActivity = () => {
      if (!activityThrottle) {
        activityThrottle = true
        setTimeout(() => {
          handleActivity()
          activityThrottle = false
        }, 1000) // 1 second throttle
      }
    }
    
    activityEvents.forEach(event => {
      document.addEventListener(event, throttledHandleActivity, { passive: true })
    })
  }

  setupSessionMonitoring() {
    // Check session validity every minute
    this.sessionTimer = setInterval(() => {
      const validation = this.validateSession()
      if (!validation.valid) {
        logger.info('AUTH_FLOW', 'Session invalidated during monitoring', { reason: validation.reason })
      }
    }, 60000) // 1 minute
  }

  startSessionMonitoring() {
    this.setupSessionMonitoring()
  }

  clearTimers() {
    if (this.activityTimer) {
      clearTimeout(this.activityTimer)
      this.activityTimer = null
    }
    
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer)
      this.sessionTimer = null
    }
  }

  checkSecurityRequirements() {
    const warnings = []
    
    // Check HTTPS in production
    if (this.securityConfig.requireSecureConnection && location.protocol !== 'https:') {
      warnings.push('Insecure connection detected')
    }
    
    // Check browser security features
    if (!window.crypto || !window.crypto.getRandomValues) {
      warnings.push('Browser lacks required security features')
    }
    
    if (warnings.length > 0) {
      logger.warn('AUTH_FLOW', 'Security warnings detected', { warnings })
    }
  }

  /**
   * Utility methods
   */
  isLockedOut() {
    return this.state.lockoutUntil && Date.now() < this.state.lockoutUntil
  }

  getAuthenticationError() {
    if (this.isLockedOut()) {
      const remainingTime = Math.ceil((this.state.lockoutUntil - Date.now()) / 1000)
      return `Účet je dočasně zablokován. Zkuste to znovu za ${remainingTime} sekund.`
    }
    
    const remaining = this.securityConfig.maxAttempts - this.state.attempts
    
    if (remaining <= 1) {
      return `Nesprávné heslo. Pozor: při dalším neúspěšném pokusu bude účet dočasně zablokován.`
    }
    
    return `Nesprávné heslo. Zbývá ${remaining} pokusů.`
  }

  getSessionDuration() {
    if (!this.state.sessionStart) return 0
    return Date.now() - this.state.sessionStart
  }

  getRemainingSessionTime() {
    if (!this.state.sessionStart) return 0
    const elapsed = Date.now() - this.state.sessionStart
    return Math.max(0, this.state.sessionTimeout - elapsed)
  }

  generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  /**
   * State management
   */
  setState(updates) {
    this.state = { ...this.state, ...updates }
  }

  getState() {
    return { ...this.state }
  }

  /**
   * Event system
   */
  addListener(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emitStateChange(event, data = {}) {
    const eventData = {
      event,
      state: this.getState(),
      timestamp: Date.now(),
      ...data
    }
    
    this.listeners.forEach(listener => {
      try {
        listener(eventData)
      } catch (error) {
        logger.error('AUTH_FLOW', 'Listener error', { error: error.message })
      }
    })
  }

  /**
   * Public API methods
   */
  isAuthenticated() {
    return this.state.isAuthenticated && this.validateSession().valid
  }

  isAuthenticating() {
    return this.state.isAuthenticating
  }

  getSessionInfo() {
    return {
      isAuthenticated: this.state.isAuthenticated,
      sessionStart: this.state.sessionStart,
      lastActivity: this.state.lastActivity,
      remainingTime: this.getRemainingSessionTime(),
      isValid: this.validateSession().valid
    }
  }

  getSecurityStatus() {
    return {
      attempts: this.state.attempts,
      maxAttempts: this.securityConfig.maxAttempts,
      isLockedOut: this.isLockedOut(),
      lockoutUntil: this.state.lockoutUntil,
      secureConnection: location.protocol === 'https:'
    }
  }
}

// Create singleton instance
export const authenticationFlow = new AuthenticationFlow()

// Export convenience functions
export const authenticate = (credentials) => authenticationFlow.authenticate(credentials)
export const logout = (reason) => authenticationFlow.logout(reason)
export const isAuthenticated = () => authenticationFlow.isAuthenticated()
export const validateSession = () => authenticationFlow.validateSession()
export const getSessionInfo = () => authenticationFlow.getSessionInfo()
export const addAuthListener = (listener) => authenticationFlow.addListener(listener)

export default authenticationFlow