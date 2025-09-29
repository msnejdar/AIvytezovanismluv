// Logging utilities for debugging and audit

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// Current log level (can be configured)
const currentLogLevel = LOG_LEVELS.DEBUG;

// Store for audit logs
const auditLogs = [];

/**
 * Format log message with timestamp and level
 */
const formatMessage = (level, category, message, data) => {
  const timestamp = new Date().toISOString();
  return {
    timestamp,
    level,
    category,
    message,
    data: data || {}
  };
};

/**
 * Main logging function
 */
const log = (level, category, message, data) => {
  const logEntry = formatMessage(level, category, message, data);
  
  // Store in audit log
  auditLogs.push(logEntry);
  
  // Only keep last 1000 entries
  if (auditLogs.length > 1000) {
    auditLogs.shift();
  }
  
  // Console output based on level
  if (level >= currentLogLevel) {
    const prefix = `[${category}]`;
    
    switch (level) {
      case LOG_LEVELS.DEBUG:
        console.log(prefix, message, data || '');
        break;
      case LOG_LEVELS.INFO:
        console.info(prefix, message, data || '');
        break;
      case LOG_LEVELS.WARN:
        console.warn(prefix, message, data || '');
        break;
      case LOG_LEVELS.ERROR:
        console.error(prefix, message, data || '');
        break;
    }
  }
  
  return logEntry;
};

/**
 * Public logging methods
 */
export const logger = {
  debug: (category, message, data) => log(LOG_LEVELS.DEBUG, category, message, data),
  info: (category, message, data) => log(LOG_LEVELS.INFO, category, message, data),
  warn: (category, message, data) => log(LOG_LEVELS.WARN, category, message, data),
  error: (category, message, data) => log(LOG_LEVELS.ERROR, category, message, data),
  
  // Get audit logs
  getAuditLogs: () => [...auditLogs],
  
  // Clear audit logs
  clearAuditLogs: () => {
    auditLogs.length = 0;
  },
  
  // Export logs as JSON
  exportLogs: () => {
    const blob = new Blob([JSON.stringify(auditLogs, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
};

/**
 * Specialized loggers for different operations
 */

// Search operation logger
export const logSearch = (query, results, duration) => {
  logger.info('Search', 'Search executed', {
    query,
    resultCount: results.length,
    duration: `${duration}ms`,
    results: results.map(r => ({
      label: r.label,
      value: r.value,
      matchCount: r.matches?.length || 0
    }))
  });
};

// Validation logger
export const logValidation = (value, type, isValid, details) => {
  const level = isValid ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN;
  logger[isValid ? 'debug' : 'warn']('Validation', 
    isValid ? 'Value validated successfully' : 'Value validation failed',
    {
      value,
      type,
      isValid,
      ...details
    }
  );
};

// Mismatch logger for AI results
export const logMismatch = (aiValue, foundValue, context) => {
  logger.warn('Mismatch', 'AI value does not match found value', {
    aiValue,
    foundValue,
    difference: aiValue !== foundValue ? {
      aiLength: aiValue?.length,
      foundLength: foundValue?.length,
      aiType: typeof aiValue,
      foundType: typeof foundValue
    } : null,
    ...context
  });
};

// Normalization logger
export const logNormalization = (originalLength, normalizedLength, duration) => {
  logger.debug('Normalization', 'Document normalized', {
    originalLength,
    normalizedLength,
    reduction: `${Math.round((1 - normalizedLength / originalLength) * 100)}%`,
    duration: `${duration}ms`
  });
};

// Performance logger
export const logPerformance = (operation, duration, details) => {
  const level = duration > 1000 ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG;
  logger[duration > 1000 ? 'warn' : 'debug']('Performance', 
    `${operation} completed`,
    {
      operation,
      duration: `${duration}ms`,
      slow: duration > 1000,
      ...details
    }
  );
};

// Error boundary logger
export const logError = (error, context) => {
  logger.error('Error', error.message || 'Unknown error', {
    stack: error.stack,
    context
  });
};