(function() {
  'use strict';

  /**
   * Order Repository - Abstracts data access (Repository pattern)
   */
  class OrderRepository {
    constructor() {
      this.config = window.CONFIG || {};
      this.logger = window.AmazonExporterLogger;
      this.result = window.AmazonExporterResult;
      this.retryHandler = window.AmazonExporterRetryHandler;
      this.circuitBreaker = window.AmazonExporterCircuitBreaker;
      this.orderParser = new OrderDetailPageParser();
      this.lastRunFailures = [];
      
      // Create circuit breaker for order fetching
      this.fetchCircuitBreaker = this.circuitBreaker ? new this.circuitBreaker({
        threshold: this.config.CIRCUIT_BREAKER_THRESHOLD || 5,
        timeoutMs: this.config.CIRCUIT_BREAKER_TIMEOUT_MS || 60000
      }) : null;
    }

    /**
     * Fetches order details for a single order
     * @param {string} orderUrl - Order detail page URL
     * @param {string} orderId - Order ID
     * @param {Date} transactionDate - Transaction date
     * @returns {Promise<Object|null>} Order details object or null if failed
     */
    async fetchOrderDetails(orderUrl, orderId, transactionDate) {
      if (this.logger) {
        this.logger.debug(`Fetching order details for ${orderId} from ${orderUrl}`);
      }
      
      // Wrap fetch in retry logic and circuit breaker
      const fetchWithRetry = async () => {
        const response = await fetch(orderUrl, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.text();
      };

      try {
        let html;
        
        // Use circuit breaker if available
        if (this.fetchCircuitBreaker) {
          html = await this.fetchCircuitBreaker.execute(fetchWithRetry);
        } else if (this.retryHandler) {
          // Use retry handler if available
          html = await this.retryHandler.executeWithRetry(fetchWithRetry, {
            maxRetries: this.config.RETRY_MAX_ATTEMPTS || 3,
            baseDelayMs: this.config.RETRY_BASE_DELAY_MS || 1000,
            shouldRetry: (error) => {
              // Retry on network errors or 5xx errors, but not 4xx errors
              return !error.message.includes('status: 4');
            }
          });
        } else {
          // Fallback to direct fetch
          html = await fetchWithRetry();
        }
        
        // Parse the order details from the HTML using Result pattern
        const parseResult = this.result ? 
          this.result.wrap(this.orderParser.parse.bind(this.orderParser), html, orderId, orderUrl, transactionDate) :
          { success: true, data: this.orderParser.parse(html, orderId, orderUrl, transactionDate) };
        
        if (parseResult.success) {
          return parseResult.data;
        } else {
          if (this.logger) {
            this.logger.error(`Error parsing order ${orderId}:`, parseResult.error);
          }
          this.lastRunFailures.push({ orderId, url: orderUrl, reason: `parse error: ${parseResult.error?.message || parseResult.error}` });
          return null;
        }
      } catch (error) {
        if (this.logger) {
          this.logger.error(`Error fetching order ${orderId}:`, error);
        }
        this.lastRunFailures.push({ orderId, url: orderUrl, reason: `fetch error: ${error?.message || error}` });
        return null;
      }
    }

    /**
     * Fetches multiple orders
     * @param {Array} orderLinks - Array of order link objects
     * @param {Function} onProgress - Progress callback(current, total)
     * @returns {Promise<Array>} Array of order detail objects
     */
    async fetchMultipleOrders(orderLinks, onProgress = null) {
      const orderDetails = [];
      // Per-order failure reasons for this run, read by content.js's
      // end-of-run order accounting so a dropped order is never silent.
      this.lastRunFailures = [];
      const delayMs = this.config.TEST_MODE ? 
        (this.config.TEST_MODE_DELAY_MS || 1000) : 
        (this.config.PRODUCTION_DELAY_MS || 1000);
      
      for (let i = 0; i < orderLinks.length; i++) {
        const orderLink = orderLinks[i];
        
        if (onProgress) {
          onProgress(i + 1, orderLinks.length);
        }
        
        const details = await this.fetchOrderDetails(
          orderLink.url, 
          orderLink.orderId, 
          orderLink.transactionDate
        );
        
        if (details) {
          orderDetails.push(details);
          if (this.logger) {
            this.logger.debug(`Successfully fetched order ${orderLink.orderId}`);
          }
        }
        
        if (i < orderLinks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }

      return orderDetails;
    }
  }

  /**
   * Order Detail Page Parser - Parses HTML from order detail pages
   */
  class OrderDetailPageParser {
    constructor() {
      this.config = window.CONFIG || {};
    }

    /**
     * Parses order details from HTML
     * @param {string} html - HTML content of order detail page
     * @param {string} orderId - Order ID
     * @param {string} orderUrl - Order URL
     * @param {Date} transactionDate - Transaction date
     * @returns {Object} Order details object
     */
    parse(html, orderId, orderUrl, transactionDate) {
      const CONST = this.config;
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const orderDetails = {
        orderNumber: orderId,
        orderUrl: orderUrl || '',
        transactionDate: transactionDate ? transactionDate.toLocaleDateString() : '',
        orderPlacedDate: '',
        orderTotal: '',
        refundAmount: '',
        paymentMethod: '',
        items: [],
        status: ''
      };

      const bodyText = doc.body.textContent || '';

      // Extract order placed date
      const datePatterns = CONST.DATE_EXTRACTION_PATTERNS || [
        /(?:Ordered on|Placed on|Order date)[:\s]+([^\n<]+)/i,
        /Order\s+placed\s+(\w+ \d{1,2}, \d{4})/i,
        /(\w+ \d{1,2}, \d{4})/,
        /(\d{1,2}\/\d{1,2}\/\d{4})/
      ];
      
      for (const pattern of datePatterns) {
        const match = bodyText.match(pattern);
        if (match) {
          orderDetails.orderPlacedDate = match[1].trim();
          break;
        }
      }

      // Extract refund total
      const refundTotalPatterns = CONST.REFUND_PATTERNS || [
        /Refund\s+Total[:\s]*\$?([\d,]+\.?\d*)/i
      ];
      
      let refundTotal = 0;
      for (const pattern of refundTotalPatterns) {
        const matches = bodyText.matchAll(new RegExp(pattern.source, 'gi'));
        for (const match of matches) {
          const refundValue = parseFloat(match[1].replace(/,/g, ''));
          if (!isNaN(refundValue) && refundValue > 0) {
            refundTotal = refundValue;
            orderDetails.refundAmount = '$' + refundValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            break;
          }
        }
        if (refundTotal > 0) break;
      }
      
      if (refundTotal === 0) {
        orderDetails.refundAmount = '';
      }

      // Extract order total (Grand Total)
      const grandTotalPatterns = CONST.GRAND_TOTAL_PATTERNS || [
        /Grand\s+Total[:\s]*\$?([\d,]+\.?\d*)/i,
        /Order\s+Total[:\s]*\$?([\d,]+\.?\d*)/i,
        /(?:Total\s+for\s+this\s+Order|Total\s+charged)[:\s]*\$?([\d,]+\.?\d*)/i
      ];
      
      let foundGrandTotal = false;
      let grandTotalValue = 0;
      for (const pattern of grandTotalPatterns) {
        const matches = bodyText.matchAll(new RegExp(pattern.source, 'gi'));
        for (const match of matches) {
          const contextSize = CONST.CONTEXT_WINDOW_SIZE || 50;
          const contextStart = Math.max(0, match.index - contextSize);
          const contextEnd = Math.min(bodyText.length, match.index + match[0].length + contextSize);
          const context = bodyText.substring(contextStart, contextEnd);
          
          if (!context.match(/Item\(s\)\s+Subtotal|Subtotal[:\s]*\$|Before\s+tax/i)) {
            grandTotalValue = parseFloat(match[1].replace(/,/g, ''));
            if (!isNaN(grandTotalValue)) {
              foundGrandTotal = true;
              break;
            }
          }
        }
        if (foundGrandTotal) break;
      }
      
      if (!foundGrandTotal) {
        const pricePattern = CONST.PRICE_PATTERN || /\$([\d,]+\.?\d*)/g;
        const allAmounts = bodyText.matchAll(pricePattern);
        const amounts = [];
        for (const match of allAmounts) {
          const amount = parseFloat(match[1].replace(/,/g, ''));
          if (!isNaN(amount) && amount > 0) {
            amounts.push({ value: amount });
          }
        }
        if (amounts.length > 0) {
          amounts.sort((a, b) => b.value - a.value);
          grandTotalValue = amounts[0].value;
          foundGrandTotal = true;
        }
      }

      // Store grand total and calculate net amount
      if (foundGrandTotal && grandTotalValue > 0) {
        orderDetails.grandTotal = '$' + grandTotalValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        const netAmount = grandTotalValue - refundTotal;
        orderDetails.orderTotal = '$' + netAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      } else {
        orderDetails.grandTotal = '';
      }

      // Extract items
      const excludedKeywords = CONST.EXCLUDED_KEYWORDS || [
        'Item(s) Subtotal', 'Subtotal', 'Shipping & Handling', 'Shipping', 
        'Free Shipping', 'Total before tax', 'Estimated tax', 'Grand Total',
        'Order Total', 'Your Coupon Savings', 'Subscribe & Save', 
        'Refund Total', 'CO Retail Delivery Fees', 'FSA or HSA eligible',
        'P&G', 'Delivery Fees', 'Tax', 'Total'
      ];

      const itemSelectors = CONST.ORDER_DETAIL_PAGE?.items || [
        '[data-item]',
        '.yohtmlc-item',
        '[class*="yo-item"]',
        '[class*="item-row"]',
        '[class*="order-item"]',
        '.a-fixed-left-grid[class*="item"]',
        'div[class*="item-details"]'
      ];

      // name -> price string ('$X.XX') or null. A Map (not a Set) so each
      // item name can carry its price alongside it -- needed so financeAgent
      // can split a mixed-category order across real categories instead of
      // leaving it unresolved. Known limitation: if a single container ever
      // yields more than one item name (rare -- the productLinks path and
      // the containerText-line fallback both feed the same container), they
      // all get that container's one detected price; this was already an
      // existing imprecision in how this method groups items into
      // containers, not something newly introduced here.
      const itemContainers = new Map();

      // Links in the site nav/footer are never order items -- see
      // constants.js's ORDER_DETAIL_PAGE.pageChrome comment.
      const pageChromeSelector = (CONST.ORDER_DETAIL_PAGE?.pageChrome || [
        '#navFooter', '.navLeftFooter', '#navbar', '#nav-main', 'header', 'footer',
        '[role="navigation"]', '[role="contentinfo"]'
      ]).join(', ');
      function isInPageChrome(element) {
        try {
          return !!element.closest(pageChromeSelector);
        } catch (e) {
          return false;
        }
      }

      const priceLinePattern = CONST.PRICE_PATTERN_SIMPLE || /^\$[\d,]+\.?\d*$/;

      // The text of a product link is the product's title. Amazon lets a
      // title run to 200 characters and sellers routinely fill it, so the
      // general MAX_TEXT_LENGTH guard ("under 200", meant to reject blobs of
      // page text) dropped every item whose title was exactly at the limit
      // -- and with it, on an order of only such items, the whole item list
      // (found 2026-10-04: order with two 200-character titles exported
      // with no items). A product link is already known to be a product, so
      // it gets its own, more generous limit.
      const maxItemTitleLength = CONST.MAX_ITEM_TITLE_LENGTH || 500;

      // A line ending in a colon is a label from the order summary
      // ("Rewards Points:", "Promotion Applied:", "Subscription saving:"),
      // never a product name. The item selectors below also match the
      // summary's rows, and EXCLUDED_KEYWORDS only knows the usual labels
      // (subtotal, tax, total...). On an order paid with points or a
      // promotion, the extra label was taken as the order's only "item",
      // which also stopped the search before it reached the real product
      // links (found 2026-10-04, 13 orders in one export). Matching the
      // colon rather than listing more keywords avoids dropping real
      // products whose names contain "Gift Card" or "Discount".
      const summaryLabelPattern = CONST.SUMMARY_LABEL_PATTERN || /:\s*$/;

      // Amazon commonly renders a price as e.g.
      // <span class="a-price"><span class="a-offscreen">$49.17</span>
      // <span aria-hidden="true">...whole/fraction split for display...</span></span>
      // -- the visible whole/fraction spans often don't concatenate into a
      // clean "$49.17" text line (the decimal point is sometimes CSS
      // content, not a text node), but .a-offscreen always holds the full,
      // clean price as one string for screen readers. Try that first;
      // fall back to line-scanning textContent for pages that don't use it.
      const priceElementSelectors = CONST.ORDER_DETAIL_PAGE?.itemPrice || [
        '.a-price .a-offscreen',
        '.a-color-price',
        '[class*="price"] .a-offscreen',
      ];

      function findPriceInText(text) {
        const lines = (text || '').split('\n').map(l => l.trim());
        const priceLine = lines.find(l => priceLinePattern.test(l));
        return priceLine || null;
      }

      function findPriceInContainer(container) {
        for (const selector of priceElementSelectors) {
          try {
            const el = container.querySelector(selector);
            const text = el?.textContent?.trim();
            if (text && priceLinePattern.test(text)) {
              return text;
            }
          } catch (e) {
            // invalid selector for this DOM, try the next one
          }
        }
        return findPriceInText(container.textContent);
      }

      function findNearbyPrice(element, maxDepth) {
        let node = element;
        for (let i = 0; i < maxDepth && node; i++) {
          const price = findPriceInContainer(node);
          if (price) return price;
          node = node.parentElement;
        }
        return null;
      }

      for (const selector of itemSelectors) {
        const containers = Array.from(doc.querySelectorAll(selector))
          .filter(container => !isInPageChrome(container));
        if (containers.length > 0) {
          containers.forEach(container => {
            const containerText = container.textContent?.trim() || '';
            const containerPrice = findPriceInContainer(container);

            const productLinkSelectors = CONST.ORDER_DETAIL_PAGE?.productLinks ||
              ['a[href*="/dp/"]', 'a[href*="/gp/product/"]'];
            const productLinks = container.querySelectorAll(productLinkSelectors.join(', '));
            productLinks.forEach(link => {
              if (isInPageChrome(link)) return;
              const linkText = link.textContent?.trim();
              const minLength = CONST.MIN_TEXT_LENGTH || 5;
              if (linkText && linkText.length > minLength && linkText.length <= maxItemTitleLength) {
                const isExcluded = summaryLabelPattern.test(linkText) || excludedKeywords.some(keyword =>
                  linkText.toLowerCase().includes(keyword.toLowerCase())
                );
                if (!isExcluded && !itemContainers.has(linkText)) {
                  itemContainers.set(linkText, containerPrice);
                }
              }
            });

            const minTextLengthStrict = CONST.MIN_TEXT_LENGTH_STRICT || 10;
            if (containerText.length > minTextLengthStrict) {
              const minLength = CONST.MIN_TEXT_LENGTH || 5;
              const lines = containerText.split('\n').map(l => l.trim()).filter(l => l.length > minLength);
              lines.forEach(line => {
                const isExcluded = summaryLabelPattern.test(line) || excludedKeywords.some(keyword =>
                  line.toLowerCase().includes(keyword.toLowerCase())
                );
                const pricePattern = CONST.PRICE_PATTERN_SIMPLE || /^\$[\d,]+\.?\d*$/;
                const quantityPattern = CONST.QUANTITY_PATTERN || /^Qty:?\s*\d+/;
                const looksLikePrice = pricePattern.test(line) || quantityPattern.test(line);
                const metadataPattern = CONST.METADATA_PATTERN || /^(Condition|Sold by|Shipped by|Qty|Quantity):/i;
                const looksLikeMetadata = metadataPattern.test(line);

                const maxLength = CONST.MAX_TEXT_LENGTH || 200;
                if (!isExcluded && !looksLikePrice && !looksLikeMetadata &&
                    line.length > minTextLengthStrict && line.length < maxLength) {
                  const textPattern = CONST.TEXT_PATTERN || /[a-zA-Z]{3,}/;
                  if (textPattern.test(line)) {
                    const name = line.substring(0, maxLength);
                    if (!itemContainers.has(name)) {
                      itemContainers.set(name, containerPrice);
                    }
                  }
                }
              });
            }
          });
          if (itemContainers.size > 0) break;
        }
      }

      if (itemContainers.size === 0) {
        const allProductLinkSelectors = CONST.ORDER_DETAIL_PAGE?.productLinks ||
          ['a[href*="/dp/"]', 'a[href*="/gp/product/"]', 'a[href*="/gp/item-detail/"]'];
        const allProductLinks = doc.querySelectorAll(allProductLinkSelectors.join(', '));
        const minTextLengthStrict = CONST.MIN_TEXT_LENGTH_STRICT || 10;
        const parentSearchDepth = CONST.PARENT_SEARCH_DEPTH || 5;
        allProductLinks.forEach(link => {
          if (isInPageChrome(link)) return;
          const linkText = link.textContent?.trim();
          if (linkText && linkText.length > minTextLengthStrict && linkText.length <= maxItemTitleLength) {
            const isExcluded = summaryLabelPattern.test(linkText) || excludedKeywords.some(keyword =>
              linkText.toLowerCase().includes(keyword.toLowerCase())
            );
            let parent = link.parentElement;
            let inSummary = false;
            const summaryPatterns = CONST.SUMMARY_SECTION_PATTERNS ||
              [/Order\s+Summary/i, /Payment\s+Information/i, /Order\s+Total/i];
            for (let i = 0; i < parentSearchDepth && parent; i++) {
              const parentText = parent.textContent || '';
              if (summaryPatterns.some(pattern => pattern.test(parentText))) {
                inSummary = true;
                break;
              }
              parent = parent.parentElement;
            }

            const textPattern = CONST.TEXT_PATTERN || /[a-zA-Z]{3,}/;
            if (!isExcluded && !inSummary && textPattern.test(linkText)) {
              if (!itemContainers.has(linkText)) {
                itemContainers.set(linkText, findNearbyPrice(link.parentElement, parentSearchDepth));
              }
            }
          }
        });
      }

      orderDetails.items = Array.from(itemContainers.keys());
      orderDetails.itemPrices = Array.from(itemContainers.values());

      // Extract payment method - try DOM selectors first for detailed extraction
      let foundPaymentMethod = '';
      
      // Try DOM-based extraction using selectors
      const paymentSelectors = CONST.ORDER_DETAIL_PAGE?.paymentMethod || [
        '.pmts-payments-instrument-list li',
        'ul.pmts-payments-instrument-list .a-list-item',
        '.pmts-payment-credit-card-instrument-logo'
      ];
      
      for (const selector of paymentSelectors) {
        try {
          const paymentElements = doc.querySelectorAll(selector);
          if (paymentElements.length > 0) {
            // Use the first payment element found
            let paymentElement = paymentElements[0];
            
            // If we selected an image element, get its parent container for full text
            if (paymentElement.tagName === 'IMG') {
              // Look for parent li or span with class a-list-item
              paymentElement = paymentElement.closest('li') || 
                              paymentElement.closest('.a-list-item') ||
                              paymentElement.parentElement;
            }
            
            // Get the text content, which should include card type and "ending in XXXX"
            let paymentText = paymentElement.textContent?.trim() || '';
            
            // Also check if there's an image with alt text (like "Mastercard", "Prime Visa", etc.)
            const paymentImg = paymentElement.querySelector('img[alt]');
            const cardTypeFromImg = paymentImg ? paymentImg.getAttribute('alt') : '';
            
            // If we have text content, use it (it should already include everything)
            if (paymentText) {
              foundPaymentMethod = paymentText;
            } else if (cardTypeFromImg) {
              // Fallback: if no text but we have image alt, use that
              foundPaymentMethod = cardTypeFromImg;
            }
            
            // Clean up the text - remove extra whitespace and normalize
            if (foundPaymentMethod) {
              foundPaymentMethod = foundPaymentMethod.replace(/\s+/g, ' ').trim();
              
              // If we found something meaningful, use it
              if (foundPaymentMethod.length > 0) {
                break;
              }
            }
          }
        } catch (e) {
          // Continue to next selector if this one fails
          continue;
        }
      }
      
      // Fall back to regex patterns if DOM extraction didn't work
      if (!foundPaymentMethod) {
        const paymentPatterns = CONST.PAYMENT_PATTERNS || [
          /(?:Payment method|Paid with|Payment)[:\s]+([^\n<]+)/i,
          /(?:Card ending|Card)[:\s]+([^\d\n<]+[\d]+)/i
        ];
        
        for (const pattern of paymentPatterns) {
          const match = bodyText.match(pattern);
          if (match) {
            foundPaymentMethod = match[1] ? match[1].trim() : match[0].trim();
            break;
          }
        }
      }
      
      orderDetails.paymentMethod = foundPaymentMethod || '';

      // Extract order status
      const statusKeywords = CONST.STATUS_KEYWORDS || 
        ['Shipped', 'Delivered', 'Cancelled', 'Pending', 'Processing', 'Returned', 'Refunded'];
      let foundStatus = '';
      
      const statusSelectors = CONST.ORDER_DETAIL_PAGE?.status || [
        '[class*="status"]',
        '[data-testid*="status"]',
        '[id*="status"]'
      ];
      
      for (const selector of statusSelectors) {
        const statusElements = doc.querySelectorAll(selector);
        for (const element of statusElements) {
          const text = element.textContent?.trim() || '';
          const maxStatusTextLength = CONST.MAX_STATUS_TEXT_LENGTH || 100;
          for (const keyword of statusKeywords) {
            if (text.includes(keyword) && text.length < maxStatusTextLength) {
              foundStatus = keyword;
              break;
            }
          }
          if (foundStatus) break;
        }
        if (foundStatus) break;
      }
      
      if (!foundStatus) {
        const statusPatterns = CONST.STATUS_PATTERNS || [
          /Order\s+Status[:\s]+(Shipped|Delivered|Cancelled|Pending|Processing|Returned|Refunded)/i,
          /Status[:\s]+(Shipped|Delivered|Cancelled|Pending|Processing|Returned|Refunded)/i,
          /(?:Your\s+order\s+has\s+been\s+)?(Shipped|Delivered|Cancelled|Pending|Processing|Returned|Refunded)/i
        ];
        
        const contextCheckSize = CONST.CONTEXT_CHECK_SIZE || 20;
        const codeContextPattern = CONST.CODE_CONTEXT_PATTERN || /[<>=&|!]+|function|var|const|let|if\s*\(/;
        for (const pattern of statusPatterns) {
          const match = bodyText.match(pattern);
          if (match && match[1]) {
            const matchIndex = bodyText.indexOf(match[0]);
            const contextStart = Math.max(0, matchIndex - contextCheckSize);
            const contextEnd = Math.min(bodyText.length, matchIndex + match[0].length + contextCheckSize);
            const context = bodyText.substring(contextStart, contextEnd);
            
            if (!codeContextPattern.test(context)) {
              foundStatus = match[1];
              break;
            }
          }
        }
      }
      
      orderDetails.status = foundStatus || '';
      
      // Categorize items before joining
      const itemsString = orderDetails.items.join('; ');
      const itemPricesString = (orderDetails.itemPrices || []).map(p => p || '').join('; ');
      const CategoryRules = window.AmazonExporterCategoryRules;
      if (CategoryRules) {
        orderDetails.category = CategoryRules.categorizeOrder(orderDetails.items);
      } else {
        orderDetails.category = 'Shopping'; // Default fallback
      }

      orderDetails.items = itemsString;
      orderDetails.itemPrices = itemPricesString;

      return orderDetails;
    }
  }

  // Expose globally
  window.AmazonExporterOrderRepository = OrderRepository;
  window.AmazonExporterOrderDetailPageParser = OrderDetailPageParser;
  
  // Also expose parser instance for direct use
  window.AmazonExporterOrderParser = new OrderDetailPageParser();

})();
