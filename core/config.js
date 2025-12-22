(function() {
  'use strict';

  /**
   * Configuration and constants for Amazon Transaction Exporter
   * Combines runtime configuration with constants
   */
  window.CONFIG = {
    // Runtime Configuration
    TEST_MODE: false,  // Set to true to enable test/debugging mode
    TEST_MODE_MAX_ORDERS: 50,  // In test mode, only process this many orders
    TEST_MODE_DELAY_MS: 1000,  // Delay between requests in test mode (ms)
    PRODUCTION_DELAY_MS: 1000,  // Delay between requests in production mode (ms)
    LOG_LEVEL: 'INFO',  // Log level: 'DEBUG', 'INFO', 'WARN', 'ERROR'
    
    // Error Handling Configuration
    CIRCUIT_BREAKER_THRESHOLD: 5,  // Number of failures before opening circuit
    CIRCUIT_BREAKER_TIMEOUT_MS: 60000,  // Time before attempting half-open (1 minute)
    RETRY_MAX_ATTEMPTS: 3,  // Maximum retry attempts
    RETRY_BASE_DELAY_MS: 1000  // Base delay for exponential backoff
  };

  // Merge with constants if available (for backward compatibility)
  if (window.CONSTANTS) {
    // Copy constants to CONFIG for unified access
    Object.keys(window.CONSTANTS).forEach(key => {
      if (key !== 'findElementWithFallbacks' && key !== 'findAllElementsWithFallbacks') {
        window.CONFIG[key] = window.CONSTANTS[key];
      }
    });
    
    // Keep helper functions accessible
    if (window.CONSTANTS.findElementWithFallbacks) {
      window.CONFIG.findElementWithFallbacks = window.CONSTANTS.findElementWithFallbacks;
    }
    if (window.CONSTANTS.findAllElementsWithFallbacks) {
      window.CONFIG.findAllElementsWithFallbacks = window.CONSTANTS.findAllElementsWithFallbacks;
    }
  }

})();
