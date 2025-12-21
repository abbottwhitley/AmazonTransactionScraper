(function() {
  'use strict';

  /**
   * Result pattern for structured error handling
   * Returns { success: boolean, data?: T, error?: string } instead of throwing
   */
  class Result {
    /**
     * Creates a successful result
     * @param {*} data - The successful data
     * @returns {Object} Result object with success: true
     */
    static success(data) {
      return { success: true, data };
    }

    /**
     * Creates a failed result
     * @param {string|Error} error - The error message or Error object
     * @returns {Object} Result object with success: false
     */
    static failure(error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }

    /**
     * Wraps a function call in a try/catch and returns a Result
     * @param {Function} fn - Function to execute
     * @param {...*} args - Arguments to pass to the function
     * @returns {Object} Result object
     */
    static wrap(fn, ...args) {
      try {
        const result = fn(...args);
        // Handle async functions
        if (result instanceof Promise) {
          return result
            .then(data => Result.success(data))
            .catch(error => Result.failure(error));
        }
        return Result.success(result);
      } catch (error) {
        return Result.failure(error);
      }
    }

    /**
     * Wraps an async function call in a try/catch and returns a Result Promise
     * @param {Function} fn - Async function to execute
     * @param {...*} args - Arguments to pass to the function
     * @returns {Promise<Object>} Promise that resolves to a Result object
     */
    static async wrapAsync(fn, ...args) {
      try {
        const data = await fn(...args);
        return Result.success(data);
      } catch (error) {
        return Result.failure(error);
      }
    }
  }

  /**
   * Retry utility with exponential backoff
   */
  class RetryHandler {
    /**
     * Executes a function with retry logic and exponential backoff
     * @param {Function} fn - Function to execute (can be async)
     * @param {Object} options - Retry options
     * @param {number} options.maxRetries - Maximum number of retries (default: 3)
     * @param {number} options.baseDelayMs - Base delay in milliseconds (default: 1000)
     * @param {Function} options.shouldRetry - Function to determine if error should be retried (default: always retry)
     * @returns {Promise<*>} Result of the function call
     */
    static async executeWithRetry(fn, options = {}) {
      const {
        maxRetries = 3,
        baseDelayMs = 1000,
        shouldRetry = () => true
      } = options;

      let lastError;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await fn();
          return result;
        } catch (error) {
          lastError = error;
          
          // Don't retry if we've exhausted attempts or if shouldRetry returns false
          if (attempt === maxRetries || !shouldRetry(error)) {
            throw error;
          }

          // Calculate exponential backoff delay
          const delay = baseDelayMs * Math.pow(2, attempt);
          
          if (window.AmazonExporterLogger) {
            window.AmazonExporterLogger.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`, error);
          }
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      throw lastError;
    }
  }

  /**
   * Circuit Breaker pattern to prevent cascading failures
   */
  class CircuitBreaker {
    /**
     * Creates a new CircuitBreaker instance
     * @param {Object} options - Circuit breaker options
     * @param {number} options.threshold - Number of failures before opening circuit (default: 5)
     * @param {number} options.timeoutMs - Time in ms before attempting half-open state (default: 60000)
     */
    constructor(options = {}) {
      this.failureCount = 0;
      this.threshold = options.threshold || 5;
      this.timeoutMs = options.timeoutMs || 60000;
      this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
      this.lastFailureTime = null;
      this.halfOpenTimeout = null;
    }

    /**
     * Executes a function through the circuit breaker
     * @param {Function} fn - Function to execute (can be async)
     * @returns {Promise<*>} Result of the function call
     */
    async execute(fn) {
      // Check if circuit is open
      if (this.state === 'OPEN') {
        // Check if we should try half-open
        if (this.lastFailureTime && 
            Date.now() - this.lastFailureTime >= this.timeoutMs) {
          this.state = 'HALF_OPEN';
          if (window.AmazonExporterLogger) {
            window.AmazonExporterLogger.info('Circuit breaker entering HALF_OPEN state');
          }
        } else {
          throw new Error('Circuit breaker is OPEN - too many failures');
        }
      }

      try {
        const result = await fn();
        this.onSuccess();
        return result;
      } catch (error) {
        this.onFailure();
        throw error;
      }
    }

    /**
     * Handles successful execution
     */
    onSuccess() {
      if (this.state === 'HALF_OPEN') {
        // Successfully recovered
        if (window.AmazonExporterLogger) {
          window.AmazonExporterLogger.info('Circuit breaker recovered, entering CLOSED state');
        }
      }
      this.failureCount = 0;
      this.state = 'CLOSED';
      this.lastFailureTime = null;
      if (this.halfOpenTimeout) {
        clearTimeout(this.halfOpenTimeout);
        this.halfOpenTimeout = null;
      }
    }

    /**
     * Handles failed execution
     */
    onFailure() {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.threshold) {
        this.state = 'OPEN';
        if (window.AmazonExporterLogger) {
          window.AmazonExporterLogger.error(`Circuit breaker OPENED after ${this.failureCount} failures`);
        }
        
        // Schedule transition to half-open
        if (this.halfOpenTimeout) {
          clearTimeout(this.halfOpenTimeout);
        }
        this.halfOpenTimeout = setTimeout(() => {
          this.state = 'HALF_OPEN';
          if (window.AmazonExporterLogger) {
            window.AmazonExporterLogger.info('Circuit breaker entering HALF_OPEN state after timeout');
          }
        }, this.timeoutMs);
      }
    }

    /**
     * Gets the current state
     * @returns {string} Current state: 'CLOSED', 'OPEN', or 'HALF_OPEN'
     */
    getState() {
      return this.state;
    }

    /**
     * Resets the circuit breaker
     */
    reset() {
      this.failureCount = 0;
      this.state = 'CLOSED';
      this.lastFailureTime = null;
      if (this.halfOpenTimeout) {
        clearTimeout(this.halfOpenTimeout);
        this.halfOpenTimeout = null;
      }
    }
  }

  // Expose globally
  window.AmazonExporterResult = Result;
  window.AmazonExporterRetryHandler = RetryHandler;
  window.AmazonExporterCircuitBreaker = CircuitBreaker;

})();
