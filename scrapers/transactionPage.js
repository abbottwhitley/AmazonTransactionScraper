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
        '[data-pmts-component-id*="transaction-date"]',
        '[data-pmts-component-id*="transaction-date"] span',
        'span[class*="date"]',
        'h2[class*="date"]',
        'div[class*="date-header"]',
        'div[class*="DateHeader"]'
      ];
      
      const findAllElements = CONST.findAllElementsWithFallbacks || 
        ((selectors) => {
          const results = [];
          selectors.forEach(selector => {
            try {
              const elements = Array.from(document.querySelectorAll(selector));
              results.push(...elements);
            } catch (e) {
              // Invalid selector, skip
            }
          });
          return results;
        });
      
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
      
      // Also try to find dates in the page text (more aggressive search)
      const datePattern = CONST.DATE_PATTERN || 
        /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/gi;
      const pageText = document.body.textContent || '';
      let match;
      const foundDates = new Set(); // Use Set to track unique date strings
      while ((match = datePattern.exec(pageText)) !== null) {
        const dateString = match[0];
        if (foundDates.has(dateString)) continue; // Skip duplicates
        foundDates.add(dateString);
        
        const parsed = this.dateUtils ? 
          this.dateUtils.parseDateFromTransaction(dateString) :
          this._parseDateFromTransaction(dateString);
        if (parsed) {
          // Avoid duplicates by checking date values
          const isDuplicate = dates.some(d => 
            d.year === parsed.year && d.month === parsed.month && 
            d.date.getDate() === parsed.date.getDate()
          );
          if (!isDuplicate) {
            dates.push(parsed);
          }
        }
      }
      
      if (this.logger) {
        this.logger.debug(`Extracted ${dates.length} unique transaction dates from page`);
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
      // Real Amazon order IDs are XXX-XXXXXXX-XXXXXXX, but the first group
      // isn't always 3 digits -- digital/subscription orders (Audible,
      // Kindle, etc.) use a letter-prefixed group instead (e.g.
      // "D01-4098072-8253053"). Regression found 2026-09-26: an earlier,
      // narrower \d{3}-only version of this pattern silently rejected every
      // one of those as "bogus", which is why exports were missing most
      // digital-order months. Both extraction paths below guard against
      // accepting a *malformed* orderId -- e.g. a stray "Order # -" match on
      // an unrelated page element (a UI label, not a real order) that could
      // otherwise match almost anything downstream -- without assuming the
      // prefix is always 3 digits.
      const AMAZON_ORDER_ID_PATTERN = CONST.AMAZON_ORDER_ID_PATTERN || /^[A-Za-z0-9]{2,4}-\d{7}-\d{7}$/;
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
        this.logger.info(`📅 Found ${dateHeaders.length} date headers on page:`);
        dateHeaders.forEach((header, idx) => {
          this.logger.info(`   ${idx + 1}. ${header.date.toLocaleDateString()} (position: ${header.position})`);
        });
      }

      // Extract order links. Confirmed real pattern (2026-09-26, from actual
      // page HTML): Amazon's current order link is
      // /gp/css/summary/edit.html?orderID=<id> -- kept here too as a
      // defense-in-depth default even though core/constants.js's
      // TRANSACTION_PAGE.orderLinks (which takes precedence) already has it,
      // in case CONST.TRANSACTION_PAGE is ever unavailable for some reason.
      const orderDetailLinkSelectors = CONST.TRANSACTION_PAGE?.orderLinks || [
        'a[href*="/gp/your-account/order-details"]',
        'a[href*="/your-account/order-details"]',
        'a[href*="order-details"]',
        'a[href*="/gp/css/summary/print"]',
        'a[href*="orderID"]',
        'a[href*="orderId"]'
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
            // Real Amazon order IDs are always XXX-XXXXXXX-XXXXXXX. Without
            // this, a stray "Order # -" style match elsewhere on the page
            // (a UI label, not a real order) can produce a bogus orderId
            // like "-" that then matches almost anything downstream.
            if (!AMAZON_ORDER_ID_PATTERN.test(orderId)) {
              return;
            }
            const fullUrl = href.startsWith('http') ? href : new URL(href, window.location.origin).href;

            if (!orderLinkMap.has(orderId)) {
              const transactionDate = this._findTransactionDateForElement(link, dateHeaders);
              if (this.logger) {
                const dateStr = transactionDate ? transactionDate.toLocaleDateString() : 'NO DATE';
                this.logger.debug(`📦 Found order ${orderId} with transaction date: ${dateStr}`);
              }
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

      // Also search for order numbers in page text (more aggressive search)
      const orderPattern = CONST.ORDER_ID_PATTERN_WITH_REFUND || 
        /(?:Refund:)?\s*Order\s*#?\s*([\d-]+)/gi;
      
      // Search in all text nodes
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
          if (!AMAZON_ORDER_ID_PATTERN.test(orderId)) {
            continue;
          }
          if (!orderLinkMap.has(orderId)) {
            let searchElement = node.parentElement;
            let foundLink = null;
            
            // Search up the DOM tree and in siblings for links
            for (let i = 0; i < 10 && searchElement && searchElement !== document.body; i++) {
              // Check if this element is a link
              if (searchElement.tagName === 'A' && searchElement.href) {
                foundLink = searchElement;
                break;
              }
              
              // Check siblings for links
              const siblings = Array.from(searchElement.parentElement?.children || []);
              for (const sibling of siblings) {
                if (sibling.tagName === 'A' && sibling.href && 
                    (sibling.href.includes('order') || sibling.href.includes(orderId) || 
                     sibling.textContent.includes(orderId))) {
                  foundLink = sibling;
                  break;
                }
              }
              
              // Check children for links
              const childLinks = searchElement.querySelectorAll('a[href]');
              for (const childLink of childLinks) {
                if (childLink.href.includes('order') || childLink.href.includes(orderId) ||
                    childLink.textContent.includes(orderId)) {
                  foundLink = childLink;
                  break;
                }
              }
              
              if (foundLink) break;
              searchElement = searchElement.parentElement;
            }
            
            // Find transaction date for this order
            const transactionDate = this._findTransactionDateForElement(
              foundLink || node, 
              dateHeaders
            );
            
            if (this.logger) {
              const dateStr = transactionDate ? transactionDate.toLocaleDateString() : 'NO DATE';
              this.logger.debug(`📦 Found order ${orderId} (text-based) with transaction date: ${dateStr}`);
            }
            
            if (foundLink && foundLink.href) {
              const fullUrl = foundLink.href.startsWith('http') ? foundLink.href : 
                new URL(foundLink.href, window.location.origin).href;
              orderLinkMap.set(orderId, {
                orderId: orderId,
                url: fullUrl,
                text: `Order #${orderId}`,
                transactionDate: transactionDate
              });
            } else {
              // Construct URL from order ID
              const constructedUrl = `https://www.amazon.com/gp/your-account/order-details/ref=oh_aui_detailpage_o00_s00?ie=UTF8&orderID=${orderId}`;
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
        this.logger.info(`📦 Extracted ${orderLinkMap.size} unique order links`);
        
        // Log summary of dates found
        const ordersByDate = new Map();
        orderLinkMap.forEach((link, orderId) => {
          if (link.transactionDate) {
            const dateKey = link.transactionDate.toLocaleDateString();
            if (!ordersByDate.has(dateKey)) {
              ordersByDate.set(dateKey, []);
            }
            ordersByDate.get(dateKey).push(orderId);
          }
        });
        
        if (ordersByDate.size > 0) {
          this.logger.info(`📊 Orders grouped by transaction date:`);
          Array.from(ordersByDate.entries()).sort().forEach(([date, orderIds]) => {
            this.logger.info(`   ${date}: ${orderIds.length} order(s) - ${orderIds.slice(0, 3).join(', ')}${orderIds.length > 3 ? '...' : ''}`);
          });
        } else {
          this.logger.warn(`⚠️ No transaction dates found for any orders!`);
        }
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
      if (!dateHeaders || dateHeaders.length === 0) {
        if (this.logger) {
          this.logger.debug(`   No date headers available for date lookup`);
        }
        return null;
      }
      const elementPosition = this._getElementPosition(element);
      
      // Find the most recent date header that appears before this element
      let foundDate = null;
      for (let i = dateHeaders.length - 1; i >= 0; i--) {
        if (dateHeaders[i].position < elementPosition) {
          foundDate = dateHeaders[i].date;
          if (this.logger) {
            this.logger.debug(`   Found date ${foundDate.toLocaleDateString()} at position ${dateHeaders[i].position} (element at ${elementPosition})`);
          }
          break;
        }
      }
      
      // If no date found before element, use the first date (fallback)
      if (!foundDate && dateHeaders.length > 0) {
        foundDate = dateHeaders[0].date;
        if (this.logger) {
          this.logger.debug(`   Using first date header ${foundDate.toLocaleDateString()} as fallback`);
        }
      }
      
      return foundDate;
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
