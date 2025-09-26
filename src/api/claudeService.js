/**
 * Enhanced Claude API Service with robust error handling and rate limiting
 */

import { logger } from '../utils/logger.js';
import { cache } from '../utils/cache.js';

class ClaudeAPIService {
  constructor() {
    this.apiKey = process.env.VITE_CLAUDE_API_KEY;
    this.baseURL = 'https://api.anthropic.com/v1/messages';
    this.model = 'claude-3-5-sonnet-20241022';
    this.maxRetries = 3;
    this.baseDelay = 1000;
    this.maxDelay = 30000;
    
    // Rate limiting configuration
    this.requestQueue = [];
    this.requestsPerMinute = 50;
    this.requestWindowMs = 60000;
    this.requestTimestamps = [];
    
    // Circuit breaker configuration
    this.circuitBreaker = {
      isOpen: false,
      failureCount: 0,
      failureThreshold: 5,
      resetTimeoutMs: 30000,
      nextAttempt: 0
    };
    
    this.validateConfiguration();
  }

  validateConfiguration() {
    if (!this.apiKey) {
      throw new Error('Claude API key is required. Please set VITE_CLAUDE_API_KEY environment variable.');
    }
    
    if (!this.apiKey.startsWith('sk-ant-')) {
      logger.warn('API key format appears invalid. Expected format: sk-ant-...');
    }
  }

  /**
   * Rate limiting implementation
   */
  async checkRateLimit() {
    const now = Date.now();
    
    // Remove old timestamps outside the current window
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < this.requestWindowMs
    );
    
    // Check if we've exceeded the rate limit
    if (this.requestTimestamps.length >= this.requestsPerMinute) {
      const oldestRequest = Math.min(...this.requestTimestamps);
      const waitTime = this.requestWindowMs - (now - oldestRequest);
      
      logger.warn(`Rate limit reached. Waiting ${waitTime}ms before next request.`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.checkRateLimit();
    }
    
    this.requestTimestamps.push(now);
  }

  /**
   * Circuit breaker implementation
   */
  checkCircuitBreaker() {
    if (this.circuitBreaker.isOpen) {
      if (Date.now() < this.circuitBreaker.nextAttempt) {
        throw new Error('Circuit breaker is open. Service temporarily unavailable.');
      } else {
        // Reset circuit breaker for half-open state
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.failureCount = 0;
        logger.info('Circuit breaker reset. Attempting to reconnect.');
      }
    }
  }

  /**
   * Handle circuit breaker on failure
   */
  handleCircuitBreakerFailure() {
    this.circuitBreaker.failureCount++;
    
    if (this.circuitBreaker.failureCount >= this.circuitBreaker.failureThreshold) {
      this.circuitBreaker.isOpen = true;
      this.circuitBreaker.nextAttempt = Date.now() + this.circuitBreaker.resetTimeoutMs;
      logger.error(`Circuit breaker opened due to ${this.circuitBreaker.failureCount} consecutive failures`);
    }
  }

  /**
   * Reset circuit breaker on success
   */
  handleCircuitBreakerSuccess() {
    this.circuitBreaker.failureCount = 0;
    this.circuitBreaker.isOpen = false;
  }

  /**
   * Calculate exponential backoff delay
   */
  calculateBackoffDelay(attempt) {
    const exponentialDelay = this.baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, this.maxDelay);
  }

  /**
   * Determine if error is retryable
   */
  isRetryableError(error, response) {
    if (!response) return true; // Network errors are retryable
    
    const retryableStatusCodes = [429, 502, 503, 504];
    const retryableErrorTypes = ['overloaded_error', 'rate_limit_error', 'api_error'];
    
    return retryableStatusCodes.includes(response.status) ||
           (error?.type && retryableErrorTypes.includes(error.type));
  }

  /**
   * Create cache key for request
   */
  createCacheKey(query, document) {
    const content = JSON.stringify({ query, document: document.substring(0, 100) });
    return `claude_search_${Buffer.from(content).toString('base64').substring(0, 50)}`;
  }

  /**
   * Enhanced Claude API call with comprehensive error handling
   */
  async callClaudeAPI(query, document, options = {}) {
    const {
      useCache = true,
      cacheTimeMs = 300000, // 5 minutes
      timeout = 30000,
      maxTokens = 1024
    } = options;

    // Check cache first
    const cacheKey = this.createCacheKey(query, document);
    if (useCache) {
      const cachedResult = await cache.get(cacheKey);
      if (cachedResult) {
        logger.info('Returning cached result for query');
        return { success: true, data: cachedResult, source: 'cache' };
      }
    }

    // Check circuit breaker
    this.checkCircuitBreaker();

    // Check rate limiting
    await this.checkRateLimit();

    const requestPayload = {
      model: this.model,
      max_tokens: maxTokens,
      messages: [{
        role: 'user',
        content: this.buildPrompt(query, document)
      }]
    };

    let lastError = null;
    let lastResponse = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        logger.info(`Claude API attempt ${attempt + 1}/${this.maxRetries} for query: "${query.substring(0, 50)}..."`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(this.baseURL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(requestPayload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        lastResponse = response;

        const data = await response.json();
        
        if (response.ok) {
          // Success - reset circuit breaker and cache result
          this.handleCircuitBreakerSuccess();
          
          if (useCache) {
            await cache.set(cacheKey, data, cacheTimeMs);
          }
          
          logger.info(`Claude API call successful on attempt ${attempt + 1}`);
          return { success: true, data, source: 'api' };
        } else {
          lastError = data.error;
          
          // Handle specific error types
          if (data.error?.type === 'invalid_request_error') {
            logger.error('Invalid request error (non-retryable):', data.error);
            this.handleCircuitBreakerFailure();
            return { success: false, error: data.error, status: response.status };
          }
          
          if (data.error?.type === 'authentication_error') {
            logger.error('Authentication error (non-retryable):', data.error);
            this.handleCircuitBreakerFailure();
            return { success: false, error: data.error, status: response.status };
          }
          
          // Check if error is retryable
          if (!this.isRetryableError(data.error, response)) {
            logger.error('Non-retryable error:', data.error);
            this.handleCircuitBreakerFailure();
            return { success: false, error: data.error, status: response.status };
          }
          
          if (attempt < this.maxRetries - 1) {
            const delay = this.calculateBackoffDelay(attempt);
            logger.warn(`Retryable error on attempt ${attempt + 1}. Retrying in ${delay}ms:`, data.error);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            this.handleCircuitBreakerFailure();
          }
        }
      } catch (error) {
        lastError = error;
        
        if (error.name === 'AbortError') {
          logger.error(`Request timeout after ${timeout}ms on attempt ${attempt + 1}`);
        } else {
          logger.error(`Network error on attempt ${attempt + 1}:`, error.message);
        }
        
        if (attempt < this.maxRetries - 1) {
          const delay = this.calculateBackoffDelay(attempt);
          logger.warn(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          this.handleCircuitBreakerFailure();
        }
      }
    }

    // All attempts failed
    logger.error(`All ${this.maxRetries} attempts failed for Claude API call`);
    return { 
      success: false, 
      error: lastError || { type: 'unknown_error', message: 'All retry attempts failed' },
      status: lastResponse?.status || 500
    };
  }

  /**
   * Build optimized prompt for contract analysis
   */
  buildPrompt(query, document) {
    return `Analyzuj následující text a nalezni přesně to, co požaduje dotaz. Vrať odpověď v JSON formátu s jednotlivými výsledky jako klikatelnými položkami.

DOTAZ: "${query}"

TEXT DOKUMENTU:
${document}

INSTRUKCE:
- Vrať odpověď ve formátu: {"results": [{"label": "popis", "value": "hodnota", "highlight": "text k zvýraznění", "start": 123, "end": 456, "confidence": 0.95, "context": "okolní kontext"}]}
- start a end jsou integer indexy (0-based) do původního TEXTU DOKUMENTU.
- highlight musí být přesný úsek textu mezi indexy start a end (ověřit, že text.substring(start, end) === highlight).
- label: krátký popis co to je (např. "Rodné číslo Jana Dvořáka")
- value: čistá hodnota (např. "123456/7890")
- confidence: skóre důvěry 0-1 pro relevanci výsledku
- context: krátký okolní kontext pro lepší pochopení
- Seřaď výsledky podle confidence (nejvyšší první)
- Pokud nic nenajdeš: {"results": []}

Příklady:
Dotaz "rodné číslo Jana Dvořáka" → {"results": [{"label": "Rodné číslo Jana Dvořáka", "value": "123456/7890", "highlight": "123456/7890", "start": 234, "end": 246, "confidence": 0.98, "context": "...jméno Jan Dvořák, rodné číslo 123456/7890, bydliště..."}]}
Dotaz "celková kupní cena" → {"results": [{"label": "Celková kupní cena", "value": "7 850 000 Kč", "highlight": "7 850 000", "start": 1234, "end": 1242, "confidence": 0.95, "context": "...celková kupní cena činí 7 850 000 Kč včetně..."}]}`;
  }

  /**
   * Health check endpoint
   */
  async healthCheck() {
    try {
      this.checkCircuitBreaker();
      return {
        status: 'healthy',
        circuitBreaker: this.circuitBreaker.isOpen ? 'open' : 'closed',
        failureCount: this.circuitBreaker.failureCount,
        requestsInWindow: this.requestTimestamps.length,
        rateLimit: `${this.requestTimestamps.length}/${this.requestsPerMinute} per minute`
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        circuitBreaker: 'open'
      };
    }
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      circuitBreaker: this.circuitBreaker,
      requestsInWindow: this.requestTimestamps.length,
      rateLimit: {
        current: this.requestTimestamps.length,
        limit: this.requestsPerMinute,
        windowMs: this.requestWindowMs
      },
      configuration: {
        maxRetries: this.maxRetries,
        baseDelay: this.baseDelay,
        maxDelay: this.maxDelay,
        model: this.model
      }
    };
  }
}

// Create singleton instance
export const claudeService = new ClaudeAPIService();
export default claudeService;