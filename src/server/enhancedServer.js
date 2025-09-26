/**
 * Enhanced production-ready server with comprehensive middleware
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import helmet from 'helmet';

// Import our custom modules
import { logger } from '../utils/logger.js';
import { cache } from '../utils/cache.js';
import claudeService from '../api/claudeService.js';
import {
  requestLogger,
  createRateLimiter,
  securityHeaders,
  cacheResponse,
  errorHandler,
  timeout,
  healthCheck,
  createCors
} from '../middleware/index.js';
import {
  validateSearchRequest,
  validateDocumentUpload,
  validateBatchSearch,
  createValidationMiddleware,
  sanitizeInput
} from '../validation/schemas.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class EnhancedServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3001;
    this.environment = process.env.NODE_ENV || 'development';
    this.isProduction = this.environment === 'production';
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    
    logger.info('Enhanced server initialized', {
      environment: this.environment,
      port: this.port
    });
  }

  /**
   * Setup comprehensive middleware stack
   */
  setupMiddleware() {
    // Security headers (should be first)
    if (this.isProduction) {
      this.app.use(helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://api.anthropic.com"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true
        }
      }));
    }
    
    // Custom security headers
    this.app.use(securityHeaders);
    
    // CORS configuration
    this.app.use(createCors({
      origin: this.isProduction 
        ? ['https://yourdomain.com', 'https://api.yourdomain.com']
        : true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Requested-With']
    }));
    
    // Request parsing
    this.app.use(express.json({ 
      limit: '10mb',
      strict: true,
      type: 'application/json'
    }));
    
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: '10mb' 
    }));
    
    // Request logging
    this.app.use(requestLogger);
    
    // Request timeout
    this.app.use(timeout(30000)); // 30 seconds
    
    // Rate limiting
    this.app.use('/api/', createRateLimiter({
      windowMs: 60000,       // 1 minute
      maxRequests: this.isProduction ? 50 : 100,
      keyGenerator: (req) => {
        // Use API key if provided, otherwise IP
        return req.get('X-API-Key') || req.ip || 'unknown';
      }
    }));
    
    // Serve static files
    this.app.use(express.static(join(__dirname, '../../dist')));
  }

  /**
   * Setup API routes with validation and caching
   */
  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', healthCheck);
    this.app.get('/api/health', healthCheck);
    
    // System status endpoint
    this.app.get('/api/status', async (req, res) => {
      try {
        const [cacheHealth, claudeHealth] = await Promise.all([
          cache.healthCheck(),
          claudeService.healthCheck()
        ]);
        
        const status = {
          status: 'operational',
          timestamp: new Date().toISOString(),
          version: process.env.npm_package_version || '1.0.0',
          environment: this.environment,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cache: cacheHealth,
          claude: claudeHealth,
          logger: logger.getMetrics()
        };
        
        const isHealthy = cacheHealth.status === 'healthy' && 
                         claudeHealth.status === 'healthy';
        
        res.status(isHealthy ? 200 : 503).json(status);
      } catch (error) {
        logger.error('Status endpoint error', { error: error.message });
        res.status(500).json({
          status: 'error',
          message: 'Failed to get system status'
        });
      }
    });
    
    // Cache management endpoints (admin only in production)
    if (!this.isProduction) {
      this.app.get('/api/cache/stats', (req, res) => {
        res.json(cache.getStats());
      });
      
      this.app.delete('/api/cache', async (req, res) => {
        const cleared = await cache.clear();
        res.json({ message: `Cleared ${cleared} cache entries` });
      });
      
      this.app.get('/api/logs', (req, res) => {
        const count = parseInt(req.query.count) || 50;
        res.json(logger.getRecentLogs(count));
      });
    }
    
    // Main search endpoint
    this.app.post('/api/search',
      createValidationMiddleware(validateSearchRequest),
      cacheResponse({
        ttl: 300000, // 5 minutes
        keyGenerator: (req) => `search:${JSON.stringify(req.validatedBody)}`,
        namespace: 'search_cache'
      }),
      async (req, res) => {
        const timer = logger.timer('claude_api_call');
        
        try {
          const { query, document, options = {} } = req.validatedBody;
          
          logger.info('Processing search request', {
            queryLength: query.length,
            documentLength: document.length,
            options
          });
          
          const result = await claudeService.callClaudeAPI(query, document, options);
          
          timer.end();
          
          if (result.success) {
            // Add metadata to response
            const response = {
              ...result.data,
              metadata: {
                source: result.source,
                timestamp: new Date().toISOString(),
                processingTime: timer.end(),
                cached: result.source === 'cache'
              }
            };
            
            res.json(response);
          } else {
            const status = result.status || 500;
            logger.error('Claude API call failed', {
              error: result.error,
              status
            });
            
            res.status(status).json({
              error: result.error?.type || 'api_error',
              message: result.error?.message || 'Failed to process search request',
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          timer.end();
          logger.error('Search endpoint error', {
            error: error.message,
            stack: error.stack
          });
          
          res.status(500).json({
            error: 'internal_error',
            message: 'An unexpected error occurred while processing your request'
          });
        }
      }
    );
    
    // Batch search endpoint
    this.app.post('/api/search/batch',
      createValidationMiddleware(validateBatchSearch),
      async (req, res) => {
        const timer = logger.timer('batch_search');
        
        try {
          const { queries, document } = req.validatedBody;
          
          logger.info('Processing batch search request', {
            queryCount: queries.length,
            documentLength: document.length
          });
          
          // Process queries in parallel with concurrency limit
          const concurrencyLimit = 3;
          const results = [];
          
          for (let i = 0; i < queries.length; i += concurrencyLimit) {
            const batch = queries.slice(i, i + concurrencyLimit);
            const batchPromises = batch.map(async (query, index) => {
              try {
                const result = await claudeService.callClaudeAPI(query, document);
                return {
                  query,
                  index: i + index,
                  success: result.success,
                  data: result.success ? result.data : null,
                  error: result.success ? null : result.error
                };
              } catch (error) {
                return {
                  query,
                  index: i + index,
                  success: false,
                  data: null,
                  error: { type: 'processing_error', message: error.message }
                };
              }
            });
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
          }
          
          timer.end();
          
          const successCount = results.filter(r => r.success).length;
          
          res.json({
            results,
            metadata: {
              totalQueries: queries.length,
              successfulQueries: successCount,
              failedQueries: queries.length - successCount,
              processingTime: timer.end(),
              timestamp: new Date().toISOString()
            }
          });
        } catch (error) {
          timer.end();
          logger.error('Batch search endpoint error', {
            error: error.message,
            stack: error.stack
          });
          
          res.status(500).json({
            error: 'internal_error',
            message: 'Failed to process batch search request'
          });
        }
      }
    );
    
    // Document processing endpoint
    this.app.post('/api/document/process',
      createValidationMiddleware(validateDocumentUpload),
      async (req, res) => {
        try {
          const { content, filename, type = 'general' } = req.validatedBody;
          
          logger.info('Processing document', {
            filename,
            type,
            contentLength: content.length
          });
          
          // Here you would implement document processing logic
          // For now, just return the processed document info
          const processedDocument = {
            id: Date.now().toString(),
            filename,
            type,
            contentLength: content.length,
            processedAt: new Date().toISOString(),
            status: 'processed'
          };
          
          res.json({
            document: processedDocument,
            message: 'Document processed successfully'
          });
        } catch (error) {
          logger.error('Document processing error', {
            error: error.message,
            stack: error.stack
          });
          
          res.status(500).json({
            error: 'processing_error',
            message: 'Failed to process document'
          });
        }
      }
    );
    
    // Fallback for SPA routing
    this.app.get('*', (req, res) => {
      res.sendFile(join(__dirname, '../../dist/index.html'));
    });
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // 404 handler
    this.app.use((req, res) => {
      logger.warn('404 Not Found', {
        url: req.url,
        method: req.method,
        ip: req.ip
      });
      
      res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.url}`,
        timestamp: new Date().toISOString()
      });
    });
    
    // Global error handler
    this.app.use(errorHandler);
    
    // Graceful shutdown handling
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    
    // Unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Promise Rejection', {
        reason: reason?.message || reason,
        stack: reason?.stack
      });
    });
    
    // Uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack
      });
      
      this.gracefulShutdown('uncaughtException');
    });
  }

  /**
   * Start the server
   */
  start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          logger.info(`Enhanced server running on port ${this.port}`, {
            environment: this.environment,
            pid: process.pid,
            memory: process.memoryUsage()
          });
          resolve(this.server);
        });
        
        this.server.on('error', (error) => {
          logger.error('Server error', { error: error.message });
          reject(error);
        });
      } catch (error) {
        logger.error('Failed to start server', { error: error.message });
        reject(error);
      }
    });
  }

  /**
   * Graceful shutdown
   */
  gracefulShutdown(signal) {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    
    if (this.server) {
      this.server.close((err) => {
        if (err) {
          logger.error('Error during server shutdown', { error: err.message });
          process.exit(1);
        }
        
        logger.info('Server closed. Exiting process.');
        process.exit(0);
      });
      
      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    } else {
      process.exit(0);
    }
  }
}

// Create and export server instance
const server = new EnhancedServer();

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  server.start().catch((error) => {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  });
}

export default server;
export { EnhancedServer };