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
      
      if (this.logger) {
        this.logger.info('🔍 Searching for Next Page button...');
      }
      
      // Standard CSS selectors (no :contains() - that's jQuery only)
      const standardSelectors = [
        'input[name*="NextPage"]',
        'input[name*="nextPage"]',
        'input[name*="next-page"]',
        'input[value*="Next"]',
        'input[value*="next"]',
        '[aria-label*="Next"]',
        '[aria-label*="next"]',
        'a[aria-label*="Next"]',
        'button[aria-label*="Next"]'
      ];
      
      // Try standard selectors first
      for (const selector of standardSelectors) {
        try {
          const elements = Array.from(document.querySelectorAll(selector));
          if (elements.length > 0) {
            if (this.logger) {
              this.logger.info(`✅ Found ${elements.length} element(s) with selector: ${selector}`);
            }
            for (const btn of elements) {
              // For input elements found by name selector, trust the selector and click immediately
              // For other elements, check text content
              const isInputByName = selector.includes('input[name');
              const text = (btn.textContent || btn.value || btn.getAttribute('aria-label') || '').toLowerCase();
              const hasNextText = text.includes('next') && !text.includes('previous');
              
              // If found by name selector (like input[name*="NextPage"]), trust it's the right button
              // Otherwise, verify it has "next" in the text
              if (isInputByName || hasNextText) {
                // Check if button is disabled
                if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') {
                  if (this.logger) {
                    this.logger.warn(`⚠️ Next Page button found but is disabled`);
                  }
                  continue;
                }
                
                const buttonText = text || btn.name || btn.id || selector;
                if (this.logger) {
                  this.logger.info(`✅ Clicking Next Page button (found by selector): ${buttonText}`);
                }
                
                btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await this.sleep(CONST.SCROLL_DELAY_MS || 500);
                btn.click();
                await this.sleep(CONST.PAGE_LOAD_DELAY_MS || 2000);
                return true;
              }
            }
          }
        } catch (e) {
          // Invalid selector, continue
          if (this.logger) {
            this.logger.debug(`Selector ${selector} failed: ${e.message}`);
          }
        }
      }
      
      // Fallback: Search all buttons/links/inputs by text content
      if (this.logger) {
        this.logger.info('🔍 Trying fallback: searching all interactive elements by text...');
      }
      
      const allInteractiveElements = Array.from(document.querySelectorAll('input, button, a, [role="button"]'));
      const nextButton = allInteractiveElements.find(btn => {
        const text = (btn.textContent || btn.value || btn.getAttribute('aria-label') || btn.title || '').toLowerCase();
        const hasNext = text.includes('next') && !text.includes('previous');
        const isVisible = btn.offsetParent !== null; // Check if element is visible
        return hasNext && isVisible;
      });

      if (nextButton) {
        // Check if button is disabled
        if (nextButton.disabled || nextButton.getAttribute('aria-disabled') === 'true') {
          if (this.logger) {
            this.logger.warn(`⚠️ Next Page button found but is disabled`);
          }
          return false;
        }

        const buttonText = (nextButton.textContent || nextButton.value || nextButton.getAttribute('aria-label') || '').trim();
        if (this.logger) {
          this.logger.info(`✅ Found Next Page button by text search: "${buttonText}"`);
        }

        nextButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.sleep(CONST.SCROLL_DELAY_MS || 500);
        nextButton.click();
        await this.sleep(CONST.PAGE_LOAD_DELAY_MS || 2000);
        return true;
      }

      if (this.logger) {
        this.logger.warn(`❌ Could not find Next Page button. Searched ${allInteractiveElements.length} interactive elements.`);
        // Log some sample button texts for debugging
        const sampleButtons = allInteractiveElements.slice(0, 10).map(btn => {
          const text = (btn.textContent || btn.value || btn.getAttribute('aria-label') || '').trim();
          return text ? `"${text.substring(0, 50)}"` : '(no text)';
        });
        this.logger.info(`   Sample button texts found: ${sampleButtons.join(', ')}`);
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
