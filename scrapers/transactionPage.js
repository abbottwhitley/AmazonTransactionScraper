(function() {
  'use strict';

  /**
   * Base scraper class (Strategy pattern)
   */
  class BaseScraper {
    extractOrderLinks() {
      throw new Error('extractOrderLinks() must be implemented by subclass');
    }

    extractTransactionDates() {
      throw new Error('extractTransactionDates() must be implemented by subclass');
    }
  }

  /**
   * Transaction page scraper (Strategy pattern implementation)
   */
  class TransactionPageScraper extends BaseScraper {
    constructor() {
      super();
      this.config = window.CONFIG || {};
      this.logger = window.AmazonExporterLogger;
      this.dateUtils = window.AmazonExporterDateUtils;
    }

    /**
     * Extracts transaction dates from the page
     * @returns {Array} Array of parsed date objects
     */
    extractTransactionDates() {
      const CONST = this.config;
      const dateSelectors = CONST.TRANSACTION_PAGE?.dateHeaders || [
        '[class*="transaction-date"]',
        '[data-pmts-component-id*="transaction-date"] span',
        'span[class*="date"]'
      ];
      
      const findAllElements = CONST.findAllElementsWithFallbacks || 
        ((selectors) => Array.from(document.querySelectorAll(selectors.join(', '))));
      const dateElements = findAllElements(dateSelectors);
      const dates = [];
      
      dateElements.forEach(el => {
        const text = el.textContent?.trim() || '';
        const parsed = this.dateUtils ? 
          this.dateUtils.parseDateFromTransaction(text) :
          this._parseDateFromTransaction(text);
        if (parsed) {
          dates.push(parsed);
        }
      });
      
      // Also try to find dates in the page text
      const datePattern = CONST.DATE_PATTERN || 
        /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/gi;
      const pageText = document.body.textContent || '';
      let match;
      while ((match = datePattern.exec(pageText)) !== null) {
        const parsed = this.dateUtils ? 
          this.dateUtils.parseDateFromTransaction(match[0]) :
          this._parseDateFromTransaction(match[0]);
        if (parsed) {
          // Avoid duplicates
          const isDuplicate = dates.some(d => 
            d.year === parsed.year && d.month === parsed.month && 
            d.date.getDate() === parsed.date.getDate()
          );
          if (!isDuplicate) {
            dates.push(parsed);
          }
        }
      }
      
      return dates;
    }

    /**
     * Extracts order links from the current page
     * @returns {Array} Array of order link objects
     */
    extractOrderLinks() {
      const CONST = this.config;
      const orderLinkMap = new Map();
      const dateHeaders = [];
      const datePattern = CONST.DATE_PATTERN ? new RegExp(CONST.DATE_PATTERN.source, 'i') : 
        /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/i;
      const dateSelectors = CONST.TRANSACTION_PAGE?.dateHeaders || [
        '[class*="transaction-date"]',
        '[data-pmts-component-id*="transaction-date"]',
        '[class*="TransactionDate"]'
      ];
      
      // Find all date headers on the page
      const findAllElements = CONST.findAllElementsWithFallbacks || 
        ((selectors) => Array.from(document.querySelectorAll(selectors.join(', '))));
      
      dateSelectors.forEach(selector => {
        const dateElements = findAllElements([selector]);
        dateElements.forEach(el => {
          const dateText = el.textContent?.trim() || '';
          const match = dateText.match(datePattern);
          if (match) {
            const parsedDate = this.dateUtils ? 
              this.dateUtils.parseDateFromTransaction(match[0]) :
              this._parseDateFromTransaction(match[0]);
            if (parsedDate) {
              dateHeaders.push({
                element: el,
                date: parsedDate.date,
                position: this._getElementPosition(el)
              });
            }
          }
        });
      });
      
      // Sort by DOM position
      dateHeaders.sort((a, b) => a.position - b.position);
      
      if (this.logger) {
        this.logger.debug(`Found ${dateHeaders.length} date headers on page`);
      }

      // Extract order links
      const orderDetailLinkSelectors = CONST.TRANSACTION_PAGE?.orderLinks || [
        'a[href*="/gp/your-account/order-details"]',
        'a[href*="/your-account/order-details"]',
        'a[href*="order-details"]',
        'a[href*="/gp/css/summary/print"]'
      ];

      orderDetailLinkSelectors.forEach(selector => {
        const links = findAllElements([selector]);
        links.forEach(link => {
          const href = link.getAttribute('href');
          const text = link.textContent || '';
          
          // Extract order ID
          const orderIdPattern = CONST.ORDER_ID_PATTERN || /Order\s*#?\s*([\d-]+)/i;
          let orderMatch = text.match(orderIdPattern);
          if (!orderMatch && href) {
            const urlPattern = CONST.ORDER_ID_URL_PATTERN || /order[_-]?id[=_]?([\d-]+)|[/-]([\d-]{10,})[/-]/i;
            orderMatch = href.match(urlPattern);
            if (orderMatch) {
              orderMatch = [null, orderMatch[1] || orderMatch[2]];
            }
          }
          
          if (orderMatch && href) {
            const orderId = orderMatch[1].trim();
            const fullUrl = href.startsWith('http') ? href : new URL(href, window.location.origin).href;
            
            if (!orderLinkMap.has(orderId)) {
              const transactionDate = this._findTransactionDateForElement(link, dateHeaders);
              orderLinkMap.set(orderId, {
                orderId: orderId,
                url: fullUrl,
                text: text.trim() || `Order #${orderId}`,
                transactionDate: transactionDate
              });
            }
          }
        });
      });

      // Also search for order numbers in page text
      const orderPattern = CONST.ORDER_ID_PATTERN_WITH_REFUND || 
        /(?:Refund:)?\s*Order\s*#?\s*([\d-]+)/gi;
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent || '';
        let match;
        const regex = new RegExp(orderPattern.source, orderPattern.flags);
        while ((match = regex.exec(text)) !== null) {
          const orderId = match[1].trim();
          if (!orderLinkMap.has(orderId)) {
            let searchElement = node.parentElement;
            let foundLink = null;
            
            for (let i = 0; i < 5 && searchElement && searchElement !== document.body; i++) {
              if (searchElement.tagName === 'A' && searchElement.href) {
                foundLink = searchElement;
                break;
              }
              
              const siblings = Array.from(searchElement.parentElement?.children || []);
              for (const sibling of siblings) {
                if (sibling.tagName === 'A' && sibling.href && 
                    (sibling.href.includes('order') || sibling.textContent.includes(orderId))) {
                  foundLink = sibling;
                  break;
                }
              }
              
              if (foundLink) break;
              searchElement = searchElement.parentElement;
            }
            
            if (foundLink && foundLink.href) {
              const fullUrl = foundLink.href.startsWith('http') ? foundLink.href : 
                new URL(foundLink.href, window.location.origin).href;
              const transactionDate = this._findTransactionDateForElement(foundLink, dateHeaders);
              orderLinkMap.set(orderId, {
                orderId: orderId,
                url: fullUrl,
                text: `Order #${orderId}`,
                transactionDate: transactionDate
              });
            } else {
              const constructedUrl = `https://www.amazon.com/gp/your-account/order-details/ref=oh_aui_detailpage_o00_s00?ie=UTF8&orderID=${orderId}`;
              const transactionDate = this._findTransactionDateForElement(node, dateHeaders);
              orderLinkMap.set(orderId, {
                orderId: orderId,
                url: constructedUrl,
                text: `Order #${orderId}`,
                transactionDate: transactionDate
              });
            }
          }
        }
      }

      if (this.logger) {
        this.logger.info(`Extracted ${orderLinkMap.size} unique order links`);
      }

      return Array.from(orderLinkMap.values());
    }

    /**
     * Helper: Parse date from transaction string
     * @private
     */
    _parseDateFromTransaction(dateString) {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return {
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          date: date
        };
      }
      return null;
    }

    /**
     * Helper: Get element position in DOM
     * @private
     */
    _getElementPosition(element) {
      if (!element) return Infinity;
      let position = 0;
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_ELEMENT,
        null,
        false
      );
      let node;
      while ((node = walker.nextNode())) {
        if (node === element) {
          return position;
        }
        position++;
      }
      return Infinity;
    }

    /**
     * Helper: Find transaction date for element
     * @private
     */
    _findTransactionDateForElement(element, dateHeaders) {
      if (!dateHeaders || dateHeaders.length === 0) return null;
      const elementPosition = this._getElementPosition(element);
      for (let i = dateHeaders.length - 1; i >= 0; i--) {
        if (dateHeaders[i].position < elementPosition) {
          return dateHeaders[i].date;
        }
      }
      return dateHeaders.length > 0 ? dateHeaders[0].date : null;
    }
  }

  /**
   * Order history page scraper (Strategy pattern implementation)
   * Currently uses same logic as transaction page, but can be extended
   */
  class OrderHistoryPageScraper extends TransactionPageScraper {
    // Can override methods for order history page specific logic
  }

  /**
   * Factory function to get appropriate scraper (Strategy pattern)
   * @param {string} url - Current page URL
   * @returns {BaseScraper} Appropriate scraper instance
   */
  function getScraperForPage(url) {
    if (url.includes('/cpe/yourpayments/transactions')) {
      return new TransactionPageScraper();
    }
    return new OrderHistoryPageScraper();
  }

  // Expose globally
  window.AmazonExporterTransactionPageScraper = TransactionPageScraper;
  window.AmazonExporterOrderHistoryPageScraper = OrderHistoryPageScraper;
  window.AmazonExporterGetScraperForPage = getScraperForPage;

})();
