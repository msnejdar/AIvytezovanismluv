/**
 * Request validation schemas
 */

/**
 * Simple validation function for required fields
 */
const required = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return `${fieldName} is required`;
  }
  return null;
};

/**
 * String validation
 */
const string = (value, fieldName, options = {}) => {
  const { minLength = 0, maxLength = Infinity, pattern } = options;
  
  if (typeof value !== 'string') {
    return `${fieldName} must be a string`;
  }
  
  if (value.length < minLength) {
    return `${fieldName} must be at least ${minLength} characters long`;
  }
  
  if (value.length > maxLength) {
    return `${fieldName} must be at most ${maxLength} characters long`;
  }
  
  if (pattern && !pattern.test(value)) {
    return `${fieldName} format is invalid`;
  }
  
  return null;
};

/**
 * Object validation
 */
const object = (value, fieldName, schema) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return `${fieldName} must be an object`;
  }
  
  const errors = [];
  
  for (const [key, validator] of Object.entries(schema)) {
    const fieldValue = value[key];
    const error = validator(fieldValue, `${fieldName}.${key}`);
    if (error) {
      errors.push(error);
    }
  }
  
  return errors.length > 0 ? errors : null;
};

/**
 * Validation helper
 */
const validate = (data, schema) => {
  const errors = [];
  
  for (const [field, validator] of Object.entries(schema)) {
    const error = validator(data[field], field);
    if (error) {
      if (Array.isArray(error)) {
        errors.push(...error);
      } else {
        errors.push(error);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    data
  };
};

/**
 * Search request validation schema
 */
export const searchRequestSchema = {
  query: (value) => {
    const requiredError = required(value, 'query');
    if (requiredError) return requiredError;
    
    return string(value, 'query', {
      minLength: 1,
      maxLength: 1000
    });
  },
  
  document: (value) => {
    const requiredError = required(value, 'document');
    if (requiredError) return requiredError;
    
    return string(value, 'document', {
      minLength: 10,
      maxLength: 1000000 // 1MB of text
    });
  },
  
  options: (value) => {
    if (value === undefined) return null; // Optional field
    
    return object(value, 'options', {
      useCache: (val) => {
        if (val !== undefined && typeof val !== 'boolean') {
          return 'options.useCache must be a boolean';
        }
        return null;
      },
      
      cacheTimeMs: (val) => {
        if (val !== undefined) {
          if (typeof val !== 'number' || val < 0 || val > 3600000) {
            return 'options.cacheTimeMs must be a number between 0 and 3600000 (1 hour)';
          }
        }
        return null;
      },
      
      timeout: (val) => {
        if (val !== undefined) {
          if (typeof val !== 'number' || val < 1000 || val > 60000) {
            return 'options.timeout must be a number between 1000 and 60000 (1 minute)';
          }
        }
        return null;
      },
      
      maxTokens: (val) => {
        if (val !== undefined) {
          if (typeof val !== 'number' || val < 100 || val > 4000) {
            return 'options.maxTokens must be a number between 100 and 4000';
          }
        }
        return null;
      }
    });
  }
};

/**
 * Validate search request
 */
export const validateSearchRequest = (data) => {
  return validate(data, searchRequestSchema);
};

/**
 * Document upload validation schema
 */
export const documentUploadSchema = {
  content: (value) => {
    const requiredError = required(value, 'content');
    if (requiredError) return requiredError;
    
    return string(value, 'content', {
      minLength: 50,
      maxLength: 5000000 // 5MB of text
    });
  },
  
  filename: (value) => {
    if (value !== undefined) {
      const stringError = string(value, 'filename', {
        maxLength: 255,
        pattern: /^[a-zA-Z0-9._-]+$/
      });
      if (stringError) return stringError;
    }
    return null;
  },
  
  type: (value) => {
    if (value !== undefined) {
      const allowedTypes = ['contract', 'legal', 'invoice', 'general'];
      if (!allowedTypes.includes(value)) {
        return `type must be one of: ${allowedTypes.join(', ')}`;
      }
    }
    return null;
  }
};

/**
 * Validate document upload
 */
export const validateDocumentUpload = (data) => {
  return validate(data, documentUploadSchema);
};

/**
 * Batch search validation schema
 */
export const batchSearchSchema = {
  queries: (value) => {
    const requiredError = required(value, 'queries');
    if (requiredError) return requiredError;
    
    if (!Array.isArray(value)) {
      return 'queries must be an array';
    }
    
    if (value.length === 0) {
      return 'queries array cannot be empty';
    }
    
    if (value.length > 10) {
      return 'queries array cannot contain more than 10 items';
    }
    
    const errors = [];
    value.forEach((query, index) => {
      const error = string(query, `queries[${index}]`, {
        minLength: 1,
        maxLength: 500
      });
      if (error) {
        errors.push(error);
      }
    });
    
    return errors.length > 0 ? errors : null;
  },
  
  document: (value) => {
    const requiredError = required(value, 'document');
    if (requiredError) return requiredError;
    
    return string(value, 'document', {
      minLength: 10,
      maxLength: 1000000
    });
  }
};

/**
 * Validate batch search request
 */
export const validateBatchSearch = (data) => {
  return validate(data, batchSearchSchema);
};

/**
 * Health check validation (no validation needed, but for consistency)
 */
export const validateHealthCheck = () => {
  return { isValid: true, errors: [], data: {} };
};

/**
 * API key validation
 */
export const validateApiKey = (apiKey) => {
  if (!apiKey) {
    return { isValid: false, error: 'API key is required' };
  }
  
  if (!apiKey.startsWith('sk-ant-')) {
    return { isValid: false, error: 'Invalid API key format' };
  }
  
  if (apiKey.length < 20) {
    return { isValid: false, error: 'API key too short' };
  }
  
  return { isValid: true };
};

/**
 * Sanitize input data
 */
export const sanitizeInput = (data) => {
  if (typeof data === 'string') {
    return data
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeInput);
  }
  
  if (data && typeof data === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return data;
};

/**
 * Create validation middleware
 */
export const createValidationMiddleware = (validatorFunction) => {
  return (req, res, next) => {
    try {
      // Sanitize input first
      const sanitizedBody = sanitizeInput(req.body);
      
      // Validate
      const validation = validatorFunction(sanitizedBody);
      
      if (!validation.isValid) {
        logger.warn('Request validation failed', {
          url: req.url,
          method: req.method,
          errors: validation.errors
        });
        
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Request data is invalid',
          details: validation.errors
        });
      }
      
      // Store sanitized and validated data
      req.validatedBody = validation.data;
      next();
    } catch (error) {
      logger.error('Validation middleware error', { error: error.message });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to validate request'
      });
    }
  };
};

export default {
  validateSearchRequest,
  validateDocumentUpload,
  validateBatchSearch,
  validateHealthCheck,
  validateApiKey,
  sanitizeInput,
  createValidationMiddleware
};