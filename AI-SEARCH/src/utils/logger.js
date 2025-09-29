/**
 * Enhanced logging utility with multiple levels and structured output
 */

class Logger {
  constructor() {
    this.levels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    };
    
    this.currentLevel = process.env.LOG_LEVEL 
      ? this.levels[process.env.LOG_LEVEL.toUpperCase()] 
      : this.levels.INFO;
    
    this.logHistory = [];
    this.maxHistorySize = 1000;
    
    // Performance metrics
    this.metrics = {
      errorCount: 0,
      warnCount: 0,
      infoCount: 0,
      debugCount: 0,
      startTime: Date.now()
    };
  }

  /**
   * Format log message with timestamp and metadata
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      meta,
      pid: process.pid,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };

    // Add to history
    this.logHistory.push(logEntry);
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }

    return logEntry;
  }

  /**
   * Output log to console with colors
   */
  output(logEntry) {
    const { timestamp, level, message, meta } = logEntry;
    const colors = {
      ERROR: '\x1b[31m', // Red
      WARN: '\x1b[33m',  // Yellow
      INFO: '\x1b[36m',  // Cyan
      DEBUG: '\x1b[37m'  // White
    };
    
    const reset = '\x1b[0m';
    const color = colors[level] || reset;
    
    let output = `${color}[${timestamp}] ${level}:${reset} ${message}`;
    
    if (Object.keys(meta).length > 0) {
      output += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    console.log(output);
  }

  /**
   * Log error messages
   */
  error(message, meta = {}) {
    if (this.currentLevel >= this.levels.ERROR) {
      this.metrics.errorCount++;
      const logEntry = this.formatMessage('ERROR', message, meta);
      this.output(logEntry);
      
      // Also log to error file in production
      if (process.env.NODE_ENV === 'production') {
        this.writeToFile('error', logEntry);
      }
    }
  }

  /**
   * Log warning messages
   */
  warn(message, meta = {}) {
    if (this.currentLevel >= this.levels.WARN) {
      this.metrics.warnCount++;
      const logEntry = this.formatMessage('WARN', message, meta);
      this.output(logEntry);
    }
  }

  /**
   * Log info messages
   */
  info(message, meta = {}) {
    if (this.currentLevel >= this.levels.INFO) {
      this.metrics.infoCount++;
      const logEntry = this.formatMessage('INFO', message, meta);
      this.output(logEntry);
    }
  }

  /**
   * Log debug messages
   */
  debug(message, meta = {}) {
    if (this.currentLevel >= this.levels.DEBUG) {
      this.metrics.debugCount++;
      const logEntry = this.formatMessage('DEBUG', message, meta);
      this.output(logEntry);
    }
  }

  /**
   * Log API requests
   */
  logRequest(req, res, responseTime) {
    const logData = {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      responseTime: `${responseTime}ms`,
      statusCode: res.statusCode,
      contentLength: res.get('Content-Length') || 0
    };

    if (res.statusCode >= 400) {
      this.error(`HTTP ${res.statusCode} ${req.method} ${req.url}`, logData);
    } else {
      this.info(`HTTP ${res.statusCode} ${req.method} ${req.url}`, logData);
    }
  }

  /**
   * Log performance metrics
   */
  logPerformance(operation, duration, meta = {}) {
    const performanceData = {
      operation,
      duration: `${duration}ms`,
      ...meta
    };

    if (duration > 5000) {
      this.warn(`Slow operation detected: ${operation}`, performanceData);
    } else {
      this.debug(`Performance: ${operation}`, performanceData);
    }
  }

  /**
   * Create a timer for measuring execution time
   */
  timer(label) {
    const start = Date.now();
    return {
      end: () => {
        const duration = Date.now() - start;
        this.logPerformance(label, duration);
        return duration;
      }
    };
  }

  /**
   * Get logger metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      runtime: Date.now() - this.metrics.startTime,
      historySize: this.logHistory.length,
      currentLevel: Object.keys(this.levels)[Object.values(this.levels).indexOf(this.currentLevel)]
    };
  }

  /**
   * Get recent log entries
   */
  getRecentLogs(count = 50) {
    return this.logHistory.slice(-count);
  }

  /**
   * Clear log history
   */
  clearHistory() {
    this.logHistory = [];
    this.info('Log history cleared');
  }

  /**
   * Write logs to file (for production use)
   */
  async writeToFile(type, logEntry) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const logDir = 'logs';
      const logFile = path.join(logDir, `${type}-${new Date().toISOString().split('T')[0]}.log`);
      
      // Ensure log directory exists
      try {
        await fs.mkdir(logDir, { recursive: true });
      } catch (err) {
        // Directory might already exist
      }
      
      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(logFile, logLine);
    } catch (error) {
      console.error('Failed to write log to file:', error);
    }
  }

  /**
   * Middleware for Express.js request logging
   */
  middleware() {
    return (req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const responseTime = Date.now() - start;
        this.logRequest(req, res, responseTime);
      });
      
      next();
    };
  }
}

// Create singleton instance
export const logger = new Logger();
export default logger;