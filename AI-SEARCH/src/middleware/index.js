/**
 * Comprehensive API middleware collection
 */

import { logger } from '../utils/logger.js';
import { cache } from '../utils/cache.js';

/**
 * Request logging middleware
 */
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log incoming request
  logger.info(`Incoming ${req.method} ${req.url}`, {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length')
  });
  
  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'error' : 'info';
    
    logger[logLevel](`${req.method} ${req.url} ${res.statusCode}`, {
      duration: `${duration}ms`,
      statusCode: res.statusCode,
      contentLength: res.get('Content-Length') || 0
    });
  });
  
  next();
};

/**
 * Rate limiting middleware
 */
export const createRateLimiter = (options = {}) => {
  const {
    windowMs = 60000,          // 1 minute
    maxRequests = 100,         // requests per window
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = (req) => req.ip || 'unknown'
  } = options;
  
  const clients = new Map();
  
  // Cleanup old entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of clients.entries()) {
      if (now - data.windowStart > windowMs) {
        clients.delete(key);
      }
    }
  }, windowMs);
  
  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();
    
    let clientData = clients.get(key);
    
    if (!clientData || now - clientData.windowStart > windowMs) {
      clientData = {
        windowStart: now,
        requests: 0
      };
      clients.set(key, clientData);
    }
    
    clientData.requests++;
    
    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests,
      'X-RateLimit-Remaining': Math.max(0, maxRequests - clientData.requests),
      'X-RateLimit-Reset': new Date(clientData.windowStart + windowMs).toISOString()
    });
    
    if (clientData.requests > maxRequests) {
      logger.warn(`Rate limit exceeded for ${key}`, {
        requests: clientData.requests,
        limit: maxRequests,
        windowMs
      });
      
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs}ms.`,
        retryAfter: Math.ceil((clientData.windowStart + windowMs - now) / 1000)
      });
    }
    
    // Track successful/failed requests
    const originalSend = res.send;
    res.send = function(data) {
      const shouldSkip = (skipSuccessfulRequests && res.statusCode < 400) ||
                        (skipFailedRequests && res.statusCode >= 400);
      
      if (shouldSkip) {
        clientData.requests--;
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

/**
 * Security headers middleware
 */
export const securityHeaders = (req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  
  next();
};

/**
 * Request validation middleware
 */
export const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value
      }));
      
      logger.warn('Request validation failed', {
        url: req.url,
        method: req.method,
        errors: validationErrors
      });
      
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Request data is invalid',
        details: validationErrors
      });
    }
    
    req.validatedBody = value;
    next();
  };
};

/**
 * Response caching middleware
 */
export const cacheResponse = (options = {}) => {
  const {
    ttl = 300000,              // 5 minutes
    keyGenerator = (req) => `${req.method}:${req.url}:${JSON.stringify(req.body)}`,
    skipCache = () => false,
    namespace = 'http_cache'
  } = options;
  
  return async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return next();
    }
    
    if (skipCache(req)) {
      return next();
    }
    
    const cacheKey = keyGenerator(req);
    
    try {
      // Try to get cached response
      const cachedResponse = await cache.get(cacheKey, namespace);
      
      if (cachedResponse) {
        logger.debug(`Cache hit for ${req.url}`);
        res.set('X-Cache': 'HIT');
        res.set('X-Cache-Key', cacheKey);
        return res.status(cachedResponse.statusCode).json(cachedResponse.data);
      }
      
      // Cache miss - intercept response
      const originalJson = res.json;
      res.json = function(data) {
        // Cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cache.set(cacheKey, {
            statusCode: res.statusCode,
            data
          }, ttl, namespace).catch(err => {
            logger.error('Failed to cache response', { error: err.message });
          });
        }
        
        res.set('X-Cache', 'MISS');
        res.set('X-Cache-Key', cacheKey);
        return originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      logger.error('Cache middleware error', { error: error.message });
      next();
    }
  };
};

/**
 * Error handling middleware
 */
export const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body
  });
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details = null;
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    details = isDevelopment ? err.details : null;
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Forbidden';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Not Found';
  } else if (err.name === 'TimeoutError') {
    statusCode = 408;
    message = 'Request Timeout';
  } else if (err.name === 'TooManyRequestsError') {
    statusCode = 429;
    message = 'Too Many Requests';
  }
  
  const errorResponse = {
    error: message,
    timestamp: new Date().toISOString(),
    path: req.url,
    method: req.method
  };
  
  if (isDevelopment && details) {
    errorResponse.details = details;
  }
  
  if (isDevelopment && err.stack) {
    errorResponse.stack = err.stack;
  }
  
  res.status(statusCode).json(errorResponse);
};

/**
 * Request timeout middleware
 */
export const timeout = (timeoutMs = 30000) => {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn(`Request timeout: ${req.method} ${req.url}`, {
          timeout: timeoutMs,
          ip: req.ip
        });
        
        res.status(408).json({
          error: 'Request Timeout',
          message: `Request took longer than ${timeoutMs}ms to complete`
        });
      }
    }, timeoutMs);
    
    // Clear timeout when response is finished
    res.on('finish', () => {
      clearTimeout(timer);
    });
    
    res.on('close', () => {
      clearTimeout(timer);
    });
    
    next();
  };
};

/**
 * Health check middleware
 */
export const healthCheck = async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Check various system components
    const checks = {
      cache: await cache.healthCheck(),
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
    
    const responseTime = Date.now() - startTime;
    const isHealthy = checks.cache.status === 'healthy' && responseTime < 1000;
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'degraded',
      responseTime: `${responseTime}ms`,
      checks
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * CORS middleware with configurable options
 */
export const createCors = (options = {}) => {
  const {
    origin = true,
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders = ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials = false,
    maxAge = 86400 // 24 hours
  } = options;
  
  return (req, res, next) => {
    const requestOrigin = req.get('Origin');
    
    // Handle origin
    if (origin === true) {
      res.set('Access-Control-Allow-Origin', '*');
    } else if (typeof origin === 'string') {
      res.set('Access-Control-Allow-Origin', origin);
    } else if (Array.isArray(origin)) {
      if (origin.includes(requestOrigin)) {
        res.set('Access-Control-Allow-Origin', requestOrigin);
      }
    } else if (typeof origin === 'function') {
      const allowedOrigin = origin(requestOrigin);
      if (allowedOrigin) {
        res.set('Access-Control-Allow-Origin', allowedOrigin);
      }
    }
    
    res.set('Access-Control-Allow-Methods', methods.join(', '));
    res.set('Access-Control-Allow-Headers', allowedHeaders.join(', '));
    res.set('Access-Control-Max-Age', maxAge.toString());
    
    if (credentials) {
      res.set('Access-Control-Allow-Credentials', 'true');
    }
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(204).send();
    }
    
    next();
  };
};

export default {
  requestLogger,
  createRateLimiter,
  securityHeaders,
  validateRequest,
  cacheResponse,
  errorHandler,
  timeout,
  healthCheck,
  createCors
};