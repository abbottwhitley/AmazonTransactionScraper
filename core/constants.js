(function() {
  'use strict';

  /**
   * Constants and configuration for Amazon Transaction Exporter
   * Centralizes all selectors, magic numbers, and magic strings
   */
  window.CONSTANTS = {
    // Magic Numbers
    MAX_PAGES_TO_COLLECT: 50,
    MAX_ATTEMPTS: 10,
    SCROLL_DELAY_MS: 500,
    PAGE_LOAD_DELAY_MS: 2000,
    INFINITE_SCROLL_DELAY_MS: 1000,
    CONTEXT_WINDOW_SIZE: 50,
    MAX_TEXT_LENGTH: 200,
    MIN_TEXT_LENGTH: 5,
    MIN_TEXT_LENGTH_STRICT: 10,
    MAX_STATUS_TEXT_LENGTH: 100,
    PARENT_SEARCH_DEPTH: 5,
    CONTEXT_CHECK_SIZE: 20,

    // Date Patterns
    DATE_PATTERN: /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/gi,
    DATE_PATTERN_SIMPLE: /(\w+ \d{1,2}, \d{4})/,
    DATE_PATTERN_SLASH: /(\d{1,2}\/\d{1,2}\/\d{4})/,
    DATE_PATTERN_ISO: /(\d{4}-\d{2}-\d{2})/,

    // Order ID Patterns
    ORDER_ID_PATTERN: /Order\s*#?\s*([\d-]+)/i,
    ORDER_ID_PATTERN_WITH_REFUND: /(?:Refund:)?\s*Order\s*#?\s*([\d-]+)/gi,
    ORDER_ID_URL_PATTERN: /order[_-]?id[=_]?([\d-]+)|[/-]([\d-]{10,})[/-]/i,

    // Price Patterns
    PRICE_PATTERN: /\$([\d,]+\.?\d*)/g,
    PRICE_PATTERN_SIMPLE: /^\$[\d,]+\.?\d*$/,
    QUANTITY_PATTERN: /^Qty:?\s*\d+/,

    // Regex Patterns
    METADATA_PATTERN: /^(Condition|Sold by|Shipped by|Qty|Quantity):/i,
    TEXT_PATTERN: /[a-zA-Z]{3,}/,
    CODE_CONTEXT_PATTERN: /[<>=&|!]+|function|var|const|let|if\s*\(/,

    // Selectors - Transaction Page
    TRANSACTION_PAGE: {
      orderLinks: [
        'a[href*="/gp/your-account/order-details"]',
        'a[href*="/your-account/order-details"]',
        'a[href*="order-details"]',
        'a[href*="/gp/css/summary/print"]',
        'a[href*="/gp/order-details"]',
        'a[href*="orderID"]',
        'a[href*="orderId"]'
      ],
      dateHeaders: [
        '[class*="transaction-date"]',
        '[data-pmts-component-id*="transaction-date"]',
        '[data-pmts-component-id*="transaction-date"] span',
        'span[class*="date"]',
        'h2[class*="date"]',
        'div[class*="date-header"]',
        'div[class*="DateHeader"]'
      ],
      nextPageButton: [
        'input[name*="NextPage"]',
        'input[value="Next Page"]',
        'a:contains("Next Page")',
        '[aria-label*="Next Page"]',
        'button:contains("Next Page")'
      ],
      containers: [
        'table',
        '[class*="transaction"]',
        '[class*="Transaction"]',
        'main',
        '[role="main"]',
        '#transactions-container',
        '.transactions-container'
      ],
      transactionRows: [
        'table tbody tr',
        '[data-testid*="transaction"]',
        'div[class*="transaction"]',
        'div[class*="Transaction"]',
        '.transaction-row',
        'tr[class*="transaction"]'
      ]
    },

    // Selectors - Order History Page
    ORDER_HISTORY_PAGE: {
      containers: [
        '[data-testid="order-card-container"]',
        '.order-card',
        '#ordersContainer',
        '.orders-container',
        '[data-testid="orders-container"]',
        'div:has(.order-card)',
        '.your-orders-content'
      ],
      orderCards: [
        '[data-testid="order-card"]',
        '.order-card',
        'div[class*="order-card"]',
        '[data-component-type="order-card"]'
      ],
      loadMoreButtons: [
        'button:contains("Show more")',
        'button:contains("Load more")',
        '[aria-label*="Show more"]',
        '[aria-label*="Load more"]',
        'a:contains("Next")',
        '.a-pagination .a-last'
      ]
    },

    // Selectors - Order Detail Page
    ORDER_DETAIL_PAGE: {
      items: [
        '[data-item]',
        '.yohtmlc-item',
        '[class*="yo-item"]',
        '[class*="item-row"]',
        '[class*="order-item"]',
        '.a-fixed-left-grid[class*="item"]',
        'div[class*="item-details"]'
      ],
      productLinks: [
        'a[href*="/dp/"]',
        'a[href*="/gp/product/"]',
        'a[href*="/gp/item-detail/"]'
      ],
      status: [
        '[class*="status"]',
        '[data-testid*="status"]',
        '[id*="status"]'
      ]
    },

    // Selectors - Common
    COMMON: {
      mainContent: [
        'main',
        '[role="main"]',
        '#main-content',
        '.main-content'
      ],
      buttons: [
        'input[type="submit"]',
        'button',
        'a'
      ],
      tableCells: [
        'td',
        'th',
        '[role="cell"]'
      ],
      rows: [
        'tr',
        'div[role="row"]'
      ]
    },

    // Excluded Keywords (for item extraction)
    EXCLUDED_KEYWORDS: [
      'Item(s) Subtotal',
      'Subtotal',
      'Shipping & Handling',
      'Shipping',
      'Free Shipping',
      'Total before tax',
      'Estimated tax',
      'Grand Total',
      'Order Total',
      'Your Coupon Savings',
      'Subscribe & Save',
      'Refund Total',
      'CO Retail Delivery Fees',
      'FSA or HSA eligible',
      'P&G',
      'Delivery Fees',
      'Tax',
      'Total'
    ],

    // Status Keywords
    STATUS_KEYWORDS: [
      'Shipped',
      'Delivered',
      'Cancelled',
      'Pending',
      'Processing',
      'Returned',
      'Refunded'
    ],

    // Date Extraction Patterns
    DATE_EXTRACTION_PATTERNS: [
      /(?:Ordered on|Placed on|Order date)[:\s]+([^\n<]+)/i,
      /Order\s+placed\s+(\w+ \d{1,2}, \d{4})/i,
      /(\w+ \d{1,2}, \d{4})/,
      /(\d{1,2}\/\d{1,2}\/\d{4})/
    ],

    // Refund Total Patterns
    REFUND_PATTERNS: [
      /Refund\s+Total[:\s]*\$?([\d,]+\.?\d*)/i
    ],

    // Grand Total Patterns
    GRAND_TOTAL_PATTERNS: [
      /Grand\s+Total[:\s]*\$?([\d,]+\.?\d*)/i,
      /Order\s+Total[:\s]*\$?([\d,]+\.?\d*)/i,
      /(?:Total\s+for\s+this\s+Order|Total\s+charged)[:\s]*\$?([\d,]+\.?\d*)/i
    ],

    // Payment Method Patterns
    PAYMENT_PATTERNS: [
      /(?:Payment method|Paid with|Payment)[:\s]+([^\n<]+)/i,
      /(?:Card ending|Card)[:\s]+([^\d\n<]+[\d]+)/i
    ],

    // Status Patterns
    STATUS_PATTERNS: [
      /Order\s+Status[:\s]+(Shipped|Delivered|Cancelled|Pending|Processing|Returned|Refunded)/i,
      /Status[:\s]+(Shipped|Delivered|Cancelled|Pending|Processing|Returned|Refunded)/i,
      /(?:Your\s+order\s+has\s+been\s+)?(Shipped|Delivered|Cancelled|Pending|Processing|Returned|Refunded)/i
    ],

    // Summary Section Patterns
    SUMMARY_SECTION_PATTERNS: [
      /Order\s+Summary/i,
      /Payment\s+Information/i,
      /Order\s+Total/i
    ],

    // Helper function to find element with fallback selectors
    findElementWithFallbacks: function(selectors, context = document) {
      for (const selector of selectors) {
        const element = context.querySelector(selector);
        if (element) {
          if (window.AmazonExporterLogger) {
            window.AmazonExporterLogger.debug(`Found element with selector: ${selector}`);
          }
          return element;
        }
      }
      if (window.AmazonExporterLogger) {
        window.AmazonExporterLogger.warn('No element found with any selector:', selectors);
      }
      return null;
    },

    // Helper function to find all elements with fallback selectors
    findAllElementsWithFallbacks: function(selectors, context = document) {
      for (const selector of selectors) {
        const elements = Array.from(context.querySelectorAll(selector));
        if (elements.length > 0) {
          if (window.AmazonExporterLogger) {
            window.AmazonExporterLogger.debug(`Found ${elements.length} elements with selector: ${selector}`);
          }
          return elements;
        }
      }
      if (window.AmazonExporterLogger) {
        window.AmazonExporterLogger.warn('No elements found with any selector:', selectors);
      }
      return [];
    }
  };

})();
