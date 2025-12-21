(function() {
  'use strict';

  /**
   * Logger utility class for structured logging with log levels
   * @class Logger
   */
  class Logger {
    /**
     * Creates a new Logger instance
     * @param {string} level - Log level: 'DEBUG', 'INFO', 'WARN', 'ERROR' (default: 'INFO')
     */
    constructor(level = 'INFO') {
      this.level = level;
      this.levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
    }

    /**
     * Checks if a log level should be logged based on current logger level
     * @param {string} level - Log level to check
     * @returns {boolean} True if the level should be logged
     */
    shouldLog(level) {
      return this.levels[level] >= this.levels[this.level];
    }

    /**
     * Logs a debug message
     * @param {...*} args - Arguments to log
     */
    debug(...args) {
      if (this.shouldLog('DEBUG')) {
        console.debug('[DEBUG]', ...args);
      }
    }

    /**
     * Logs an info message
     * @param {...*} args - Arguments to log
     */
    info(...args) {
      if (this.shouldLog('INFO')) {
        console.info('[INFO]', ...args);
      }
    }

    /**
     * Logs a warning message
     * @param {...*} args - Arguments to log
     */
    warn(...args) {
      if (this.shouldLog('WARN')) {
        console.warn('[WARN]', ...args);
      }
    }

    /**
     * Logs an error message
     * @param {...*} args - Arguments to log
     */
    error(...args) {
      if (this.shouldLog('ERROR')) {
        console.error('[ERROR]', ...args);
      }
    }

    /**
     * Creates a log group
     * @param {string} label - Group label
     */
    group(label) {
      if (this.shouldLog('DEBUG')) {
        console.group(label);
      }
    }

    /**
     * Ends a log group
     */
    groupEnd() {
      if (this.shouldLog('DEBUG')) {
        console.groupEnd();
      }
    }
  }

  // Create default logger instance and expose it globally
  window.AmazonExporterLogger = new Logger(window.CONFIG?.LOG_LEVEL || 'INFO');

})();
