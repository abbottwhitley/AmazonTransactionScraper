(function() {
  'use strict';

  /**
   * Pagination handling utilities
   */
  class PaginationHandler {
    constructor() {
      this.config = window.CONFIG || {};
      this.logger = window.AmazonExporterLogger;
    }

    /**
     * Sleep/delay utility function
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise} Promise that resolves after the delay
     */
    async sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Clicks the next page button
     * @returns {Promise<boolean>} True if next page was clicked, false otherwise
     */
    async clickNextPage() {
      const CONST = this.config;
      const nextPageSelectors = CONST.TRANSACTION_PAGE?.nextPageButton || [
        'input[name*="NextPage"]',
        'input[value="Next Page"]',
        'a:contains("Next Page")',
        '[aria-label*="Next Page"]',
        'button:contains("Next Page")'
      ];

      // Try to find button by text content
      const buttonSelectors = CONST.COMMON?.buttons || ['input[type="submit"]', 'button', 'a'];
      const findAllElements = CONST.findAllElementsWithFallbacks || 
        ((selectors) => Array.from(document.querySelectorAll(selectors.join(', '))));
      const allButtons = findAllElements(buttonSelectors);
      
      const nextButton = allButtons.find(btn => {
        const text = btn.textContent || btn.value || btn.getAttribute('aria-label') || '';
        return text.toLowerCase().includes('next page');
      });

      if (nextButton) {
        // Check if button is disabled
        if (nextButton.disabled || nextButton.getAttribute('aria-disabled') === 'true') {
          if (this.logger) this.logger.debug('Next Page button is disabled');
          return false;
        }

        nextButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.sleep(CONST.SCROLL_DELAY_MS || 500);
        nextButton.click();
        await this.sleep(CONST.PAGE_LOAD_DELAY_MS || 2000); // Wait for page to load
        return true;
      }

      return false;
    }

    /**
     * Checks if there's a next page available
     * @returns {boolean} True if next page button exists and is enabled
     */
    hasNextPage() {
      const CONST = this.config;
      const buttonSelectors = CONST.COMMON?.buttons || ['input[type="submit"]', 'button', 'a'];
      const findAllElements = CONST.findAllElementsWithFallbacks || 
        ((selectors) => Array.from(document.querySelectorAll(selectors.join(', '))));
      const allButtons = findAllElements(buttonSelectors);
      
      const nextButton = allButtons.find(btn => {
        const text = btn.textContent || btn.value || btn.getAttribute('aria-label') || '';
        return text.toLowerCase().includes('next page');
      });

      return nextButton && 
             !nextButton.disabled && 
             nextButton.getAttribute('aria-disabled') !== 'true';
    }
  }

  // Expose globally
  window.AmazonExporterPagination = PaginationHandler;

})();
