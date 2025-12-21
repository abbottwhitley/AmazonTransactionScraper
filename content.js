(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    TEST_MODE: true,  // Set to true to enable test/debugging mode
    TEST_MODE_MAX_ORDERS: 30,  // In test mode, only process this many orders
    TEST_MODE_DELAY_MS: 1000,  // Delay between requests in test mode (ms)
    PRODUCTION_DELAY_MS: 1000,  // Delay between requests in production mode (ms)
    LOG_LEVEL: 'INFO'  // Log level: 'DEBUG', 'INFO', 'WARN', 'ERROR'
  };

  // Initialize logger if available
  const logger = window.AmazonExporterLogger || {
    debug: console.debug.bind(console),
    info: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    group: console.group.bind(console),
    groupEnd: console.groupEnd.bind(console)
  };

  // Initialize constants if available
  const CONST = window.CONSTANTS || {};

  // Initialize date filter if available
  const dateFilter = window.AmazonExporterDateFilter;
  
  // Legacy dateFilterSettings for backward compatibility (will be synced with DateFilter)
  let dateFilterSettings = dateFilter ? dateFilter.getSettings() : null;

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Normalizes a date to midnight (00:00:00) for consistent date comparisons
   * @param {Date} date - The date to normalize
   * @returns {Date} A new Date object with time set to midnight
   */
  function normalizeDate(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Formats a date for HTML date input fields (YYYY-MM-DD)
   * @param {Date} date - The date to format
   * @returns {string} Formatted date string or empty string if invalid
   */
  function formatDateForInput(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Parses a date string from transaction page (e.g., "November 3, 2025")
   * @param {string} dateString - The date string to parse
   * @returns {Object|null} Object with year, month, and date, or null if invalid
   */
  function parseDateFromTransaction(dateString) {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return {
        year: date.getFullYear(),
        month: date.getMonth() + 1, // JavaScript months are 0-indexed
        date: date
      };
    }
    return null;
  }

  /**
   * Checks if a parsed date is within the target date range
   * @param {Object} parsedDate - Parsed date object with date, year, month properties
   * @returns {boolean} True if date is in range or filtering is disabled
   */
  function isDateInTargetRange(parsedDate) {
    if (dateFilter) {
      return dateFilter.isDateInTargetRange(parsedDate);
    }
    // Fallback for backward compatibility
    if (!dateFilterSettings || !dateFilterSettings.enabled || !parsedDate || !dateFilterSettings.startDate || !dateFilterSettings.endDate) {
      return true;
    }
    const transDateOnly = normalizeDate(parsedDate.date);
    const startDateOnly = normalizeDate(dateFilterSettings.startDate);
    const endDateOnly = normalizeDate(dateFilterSettings.endDate);
    
    return transDateOnly >= startDateOnly && transDateOnly <= endDateOnly;
  }

  /**
   * Checks if a parsed date is before the target start date
   * @param {Object} parsedDate - Parsed date object
   * @returns {boolean} True if date is before start date
   */
  function hasPassedTargetMonth(parsedDate) {
    if (dateFilter) {
      return dateFilter.hasPassedTargetMonth(parsedDate);
    }
    // Fallback for backward compatibility
    if (!dateFilterSettings || !dateFilterSettings.enabled || !parsedDate || !dateFilterSettings.startDate) return false;
    const transDateOnly = normalizeDate(parsedDate.date);
    const startDateOnly = normalizeDate(dateFilterSettings.startDate);
    return transDateOnly < startDateOnly;
  }

  /**
   * Checks if we should continue collecting (date is <= end date)
   * @param {Object} parsedDate - Parsed date object
   * @returns {boolean} True if date is within or before end date
   */
  function shouldContinueCollecting(parsedDate) {
    if (dateFilter) {
      return dateFilter.shouldContinueCollecting(parsedDate);
    }
    // Fallback for backward compatibility
    if (!dateFilterSettings || !dateFilterSettings.enabled || !parsedDate || !dateFilterSettings.endDate) return true;
    const transDateOnly = normalizeDate(parsedDate.date);
    const endDateOnly = normalizeDate(dateFilterSettings.endDate);
    return transDateOnly <= endDateOnly;
  }

  /**
   * Escapes a value for CSV format (handles commas, quotes, newlines)
   * @param {*} value - The value to escape
   * @returns {string} Escaped CSV value
   */
  function escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }

  /**
   * Generates a date string in ISO format (YYYY-MM-DD) for filenames
   * @returns {string} Current date in ISO format
   */
  function getDateString() {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * Sleep/delay utility function
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Promise that resolves after the delay
   */
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gets the appropriate button text based on current state
   * @param {Object} options - Button state options
   * @param {boolean} options.isExporting - Whether export is in progress
   * @param {Object} options.progress - Progress object with current and total
   * @param {string} options.customText - Custom text to display
   * @returns {string} Button text
   */
  function getExportButtonText(options = {}) {
    const { isExporting = false, progress = null, customText = null } = options;
    
    if (customText) {
      return customText;
    }
    
    if (isExporting && progress) {
      return `🔄 Fetching order ${progress.current}/${progress.total}...`;
    }
    
    if (CONFIG.TEST_MODE) {
      return `🧪 Export Transactions (TEST MODE - First ${CONFIG.TEST_MODE_MAX_ORDERS} Only)`;
    }
    
    return '📥 Export All Transactions to CSV';
  }

  /**
   * Resets the export button to its default state
   * @param {HTMLElement} button - The button element to reset
   */
  function resetExportButton(button) {
    if (!button) return;
    button.textContent = getExportButtonText();
    button.disabled = false;
  }

  // ============================================================================
  // END UTILITY FUNCTIONS
  // ============================================================================

  // Wait for page to fully load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    // Check if button already exists
    if (document.getElementById('amazon-export-btn')) {
      logger.debug('Amazon Transaction Exporter: Button already exists');
      return;
    }

    logger.info('Amazon Transaction Exporter: Initializing...');
    logger.debug('Current URL:', window.location.href);

    // Create export button
    const exportButton = document.createElement('button');
    exportButton.id = 'amazon-export-btn';
    exportButton.className = 'amazon-export-button';
    exportButton.textContent = getExportButtonText();
    exportButton.addEventListener('click', (e) => {
      logger.info('Amazon Transaction Exporter: Button clicked');
      e.preventDefault();
      e.stopPropagation();
      showExportModal();
    });

    // Insert button at the top of the orders/transactions section
    const ordersContainer = findOrdersContainer();
    if (ordersContainer) {
      logger.debug('Amazon Transaction Exporter: Found container, inserting button');
      ordersContainer.insertBefore(exportButton, ordersContainer.firstChild);
    } else {
      // Fallback: insert at top of page or in main content
      logger.debug('Amazon Transaction Exporter: Container not found, using fallback');
      const mainContent = CONST.findElementWithFallbacks ? 
        CONST.findElementWithFallbacks(CONST.COMMON?.mainContent || ['main', '[role="main"]', '#main-content', '.main-content']) || document.body :
        document.querySelector('main, [role="main"], #main-content, .main-content') || document.body;
      const firstChild = mainContent.firstChild;
      if (firstChild) {
        mainContent.insertBefore(exportButton, firstChild);
      } else {
        mainContent.appendChild(exportButton);
      }
    }
    
    logger.info('Amazon Transaction Exporter: Button added successfully');
  }

  function findOrdersContainer() {
    const isTransactionsPage = window.location.href.includes('/cpe/yourpayments/transactions');
    
    // Try multiple selectors for Amazon's page structure
    const selectors = isTransactionsPage 
      ? (CONST.TRANSACTION_PAGE?.containers || ['table', '[class*="transaction"]', '[class*="Transaction"]', 'main', '[role="main"]', '#transactions-container', '.transactions-container'])
      : (CONST.ORDER_HISTORY_PAGE?.containers || ['[data-testid="order-card-container"]', '.order-card', '#ordersContainer', '.orders-container', '[data-testid="orders-container"]', 'div:has(.order-card)', '.your-orders-content']);

    if (CONST.findElementWithFallbacks) {
      const element = CONST.findElementWithFallbacks(selectors);
      if (element) {
        return element.parentElement || element;
      }
    } else {
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          return element.parentElement || element;
        }
      }
    }

    // Try to find by common Amazon page patterns
    const pattern = isTransactionsPage 
      ? 'div[class*="transaction"], div[class*="Transaction"], table'
      : 'div[class*="order"], div[class*="Order"]';
    const possibleContainers = document.querySelectorAll(pattern);
    if (possibleContainers.length > 0) {
      return possibleContainers[0].parentElement;
    }

    return null;
  }

  function showExportModal() {
    // Remove existing modal if any
    const existingModal = document.getElementById('amazon-export-modal-overlay');
    if (existingModal) {
      existingModal.remove();
    }

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'amazon-export-modal-overlay';
    overlay.className = 'amazon-export-modal-overlay';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeExportModal();
      }
    });

    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'amazon-export-modal';

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const currentMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const currentMonthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    modal.innerHTML = `
      <h2>Export Transactions</h2>
      
      <div class="form-group">
        <label>Export Options:</label>
        <div style="margin-top: 8px;">
          <div style="margin-bottom: 12px;">
            <input type="radio" id="export-current-month" name="export-mode" value="current-month" ${dateFilterSettings.mode === 'current-month' ? 'checked' : ''}>
            <label for="export-current-month" style="margin-left: 8px; font-weight: normal; cursor: pointer;">
              Current Month (${monthNames[currentMonth - 1]} ${currentYear})
            </label>
          </div>
          <div style="margin-bottom: 12px;">
            <input type="radio" id="export-current-page" name="export-mode" value="current-page" ${dateFilterSettings.mode === 'current-page' ? 'checked' : ''}>
            <label for="export-current-page" style="margin-left: 8px; font-weight: normal; cursor: pointer;">
              Current Page Only
            </label>
          </div>
          <div>
            <input type="radio" id="export-custom" name="export-mode" value="custom" ${dateFilterSettings.mode === 'custom' ? 'checked' : ''}>
            <label for="export-custom" style="margin-left: 8px; font-weight: normal; cursor: pointer;">
              Custom Date Range
            </label>
          </div>
        </div>
      </div>

      <div id="custom-date-options" style="display: ${dateFilterSettings.mode === 'custom' ? 'block' : 'none'};">
        <div class="quick-select">
          <div class="quick-select-label">Quick Select:</div>
          <div class="month-year-selectors">
            <select id="quick-month">
              <option value="">Select Month</option>
              ${monthNames.map((name, idx) => 
                `<option value="${idx + 1}" ${idx + 1 === currentMonth && dateFilterSettings.mode === 'current-month' ? 'selected' : ''}>${name}</option>`
              ).join('')}
            </select>
            <select id="quick-year">
              ${Array.from({ length: 5 }, (_, i) => currentYear - i).map(year => 
                `<option value="${year}" ${year === currentYear ? 'selected' : ''}>${year}</option>`
              ).join('')}
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>Custom Date Range:</label>
          <div class="date-inputs">
            <div>
              <label for="start-date" style="font-size: 12px; margin-bottom: 5px;">Start Date</label>
              <input type="date" id="start-date" value="${dateFilterSettings.startDate ? formatDateForInput(dateFilterSettings.startDate) : formatDateForInput(currentMonthStart)}">
            </div>
            <div>
              <label for="end-date" style="font-size: 12px; margin-bottom: 5px;">End Date</label>
              <input type="date" id="end-date" value="${dateFilterSettings.endDate ? formatDateForInput(dateFilterSettings.endDate) : formatDateForInput(currentMonthEnd)}">
            </div>
          </div>
        </div>
      </div>

      <div class="button-group">
        <button class="btn-cancel" id="cancel-export">Cancel</button>
        <button class="btn-export" id="confirm-export">Export</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Set up event handlers
    const exportModeRadios = document.querySelectorAll('input[name="export-mode"]');
    const customDateOptions = document.getElementById('custom-date-options');
    const quickMonth = document.getElementById('quick-month');
    const quickYear = document.getElementById('quick-year');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const cancelBtn = document.getElementById('cancel-export');
    const exportBtn = document.getElementById('confirm-export');

    // Handle radio button changes
    exportModeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
          customDateOptions.style.display = 'block';
        } else {
          customDateOptions.style.display = 'none';
        }
      });
    });

    // Quick select month/year (for custom date range)
    if (quickMonth && quickYear) {
      quickMonth.addEventListener('change', () => {
        if (quickMonth.value && quickYear.value) {
          const year = parseInt(quickYear.value);
          const month = parseInt(quickMonth.value);
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 0, 23, 59, 59, 999); // Last day of month
          
          startDateInput.value = formatDateForInput(startDate);
          endDateInput.value = formatDateForInput(endDate);
        }
      });

      quickYear.addEventListener('change', () => {
        if (quickMonth.value && quickYear.value) {
          const year = parseInt(quickYear.value);
          const month = parseInt(quickMonth.value);
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 0, 23, 59, 59, 999);
          
          startDateInput.value = formatDateForInput(startDate);
          endDateInput.value = formatDateForInput(endDate);
        }
      });
    }

    cancelBtn.addEventListener('click', closeExportModal);

    exportBtn.addEventListener('click', () => {
      // Get selected export mode
      const selectedMode = document.querySelector('input[name="export-mode"]:checked')?.value;
      
      let mode = 'current-page';
      let enabled = false;
      let startDate = null;
      let endDate = null;

      if (selectedMode === 'current-month') {
        // Export current month
        mode = 'current-month';
        enabled = true;
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      } else if (selectedMode === 'custom') {
        // Custom date range
        mode = 'custom';
        enabled = true;
        const startValue = startDateInput.value;
        const endValue = endDateInput.value;

        if (!startValue || !endValue) {
          alert('Please select both start and end dates, or use the Quick Select month/year.');
          return;
        }

        startDate = new Date(startValue);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(endValue);
        endDate.setHours(23, 59, 59, 999);

        if (startDate > endDate) {
          alert('Start date must be before or equal to end date.');
          return;
        }
      } else {
        // Current page only
        mode = 'current-page';
        enabled = false;
      }

      // Store settings
      const newSettings = {
        mode: mode,
        enabled: enabled,
        startDate: startDate,
        endDate: endDate
      };
      
      // Update DateFilter if available
      if (dateFilter) {
        dateFilter.updateSettings(newSettings);
        dateFilterSettings = dateFilter.getSettings();
      } else {
        dateFilterSettings = newSettings;
      }

      closeExportModal();
      exportToCSV();
    });
  }

  function closeExportModal() {
    const overlay = document.getElementById('amazon-export-modal-overlay');
    if (overlay) {
      overlay.remove();
    }
  }


  function extractTransactionDates() {
    // Extract date headers from the transactions page
    // Dates appear as headers like "November 3, 2025"
    const dateSelectors = CONST.TRANSACTION_PAGE?.dateHeaders || [
      '[class*="transaction-date"]',
      '[data-pmts-component-id*="transaction-date"] span',
      'span[class*="date"]'
    ];
    const dateElements = CONST.findAllElementsWithFallbacks ? 
      CONST.findAllElementsWithFallbacks(dateSelectors) :
      Array.from(document.querySelectorAll(dateSelectors.join(', ')));
    const dates = [];
    
    dateElements.forEach(el => {
      const text = el.textContent?.trim() || '';
      const parsed = parseDateFromTransaction(text);
      if (parsed) {
        dates.push(parsed);
      }
    });
    
    // Also try to find dates in the page text
    const datePattern = CONST.DATE_PATTERN || /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/gi;
    const pageText = document.body.textContent || '';
    let match;
    while ((match = datePattern.exec(pageText)) !== null) {
      const parsed = parseDateFromTransaction(match[0]);
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

  async function clickNextPage() {
    // Find and click the "Next Page" button
    const nextPageSelectors = CONST.TRANSACTION_PAGE?.nextPageButton || [
      'input[name*="NextPage"]',
      'input[value="Next Page"]',
      'a:contains("Next Page")',
      '[aria-label*="Next Page"]',
      'button:contains("Next Page")'
    ];

    // Try to find button by text content
    const buttonSelectors = CONST.COMMON?.buttons || ['input[type="submit"]', 'button', 'a'];
    const allButtons = CONST.findAllElementsWithFallbacks ?
      CONST.findAllElementsWithFallbacks(buttonSelectors) :
      Array.from(document.querySelectorAll(buttonSelectors.join(', ')));
    const nextButton = allButtons.find(btn => {
      const text = btn.textContent || btn.value || btn.getAttribute('aria-label') || '';
      return text.toLowerCase().includes('next page');
    });

    if (nextButton) {
      // Check if button is disabled
      if (nextButton.disabled || nextButton.getAttribute('aria-disabled') === 'true') {
        logger.debug('Next Page button is disabled');
        return false;
      }

      nextButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(CONST.SCROLL_DELAY_MS || 500);
      nextButton.click();
      await sleep(CONST.PAGE_LOAD_DELAY_MS || 2000); // Wait for page to load
      return true;
    }

    return false;
  }

  async function navigateToDateRange() {
    const settings = dateFilter ? dateFilter.getSettings() : dateFilterSettings;
    if (!settings || !settings.enabled || !settings.startDate) return true;

    let pageCount = 0;
    const maxPages = CONST.MAX_PAGES_TO_COLLECT || 50;
    const targetMonth = settings.startDate.getMonth() + 1;
    const targetYear = settings.startDate.getFullYear();

    while (pageCount < maxPages) {
      const dates = extractTransactionDates();
      logger.debug(`Page ${pageCount + 1}: Found ${dates.length} date headers`);

      if (dates.length === 0) {
        logger.debug('No dates found on current page');
        break;
      }

      // Check if we've reached the target date range
      const hasTargetDate = dates.some(d => isDateInTargetRange(d));
      const hasPassedTarget = dates.some(d => hasPassedTargetMonth(d));

      if (hasTargetDate) {
        logger.info(`Found target date range (starting ${targetMonth}/${targetYear}) on page ${pageCount + 1}`);
        return true;
      }

      if (hasPassedTarget && !hasTargetDate) {
        logger.info(`Passed target date range, stopping pagination`);
        return false;
      }

      // Click to next page
      const clicked = await clickNextPage();
      if (!clicked) {
        logger.warn('Could not click Next Page button');
        return false;
      }

      pageCount++;
    }

    logger.warn(`Reached max pages (${maxPages}) without finding target date range`);
    return false;
  }

  /**
   * Collects all order links from the current page or multiple pages based on date filter settings
   * @returns {Promise<Array>} Array of order link objects
   */
  async function collectAllOrderLinks() {
    const allOrderLinks = [];
    let pageCount = 0;
    const settings = dateFilter ? dateFilter.getSettings() : dateFilterSettings;
    
    if (settings && settings.enabled && settings.startDate && settings.endDate) {
      // Collect links from all pages that contain dates in the range
      const maxPages = CONST.MAX_PAGES_TO_COLLECT || 50;
      let passedEndDate = false;

      while (pageCount < maxPages && !passedEndDate) {
        const pageOrderLinks = extractOrderLinks();
        logger.debug(`Collection Page ${pageCount + 1}: Found ${pageOrderLinks.length} order links`);
        
        allOrderLinks.push(...pageOrderLinks);
        
        const dates = extractTransactionDates();
        const hasTargetDate = dates.some(d => isDateInTargetRange(d));
        const hasPassedEnd = dates.every(d => !shouldContinueCollecting(d));
        
        if (hasPassedEnd && !hasTargetDate) {
          logger.info('Passed end date, stopping page collection');
          passedEndDate = true;
          break;
        }

        const clicked = await clickNextPage();
        if (!clicked) {
          logger.info('No more pages available');
          break;
        }

        pageCount++;
      }
    } else {
      // Just collect from current page
      const pageOrderLinks = extractOrderLinks();
      allOrderLinks.push(...pageOrderLinks);
      pageCount = 1;
    }

    logger.info(`Collected ${allOrderLinks.length} total order links from ${pageCount} page(s)`);
    return allOrderLinks;
  }

  /**
   * Filters order links by date range and test mode limits
   * @param {Array} orderLinks - Array of order link objects
   * @returns {Array} Filtered array of order links
   */
  function filterOrdersByDateRange(orderLinks) {
    // Limit orders in test mode
    let filteredLinks = CONFIG.TEST_MODE 
      ? orderLinks.slice(0, CONFIG.TEST_MODE_MAX_ORDERS)
      : orderLinks;
    
    if (CONFIG.TEST_MODE) {
      logger.info(`🧪 TEST MODE: Processing only ${filteredLinks.length} of ${orderLinks.length} orders`);
    }

    // Filter by date range if enabled (using DateFilter if available)
    if (dateFilter && dateFilter.isEnabled()) {
      filteredLinks = dateFilter.filterOrdersByDateRange(filteredLinks);
    } else if (dateFilterSettings && dateFilterSettings.enabled) {
      // Fallback for backward compatibility
      logger.info(`Filtering ${filteredLinks.length} orders by date range: ${dateFilterSettings.startDate?.toLocaleDateString()} - ${dateFilterSettings.endDate?.toLocaleDateString()}`);
      
      filteredLinks = filteredLinks.filter(orderLink => {
        if (!orderLink.transactionDate) {
          logger.warn(`Order ${orderLink.orderId} has no transaction date extracted. Including order anyway.`);
          return true;
        }
        
        const transactionDateObj = {
          date: orderLink.transactionDate,
          year: orderLink.transactionDate.getFullYear(),
          month: orderLink.transactionDate.getMonth() + 1
        };
        
        const inRange = isDateInTargetRange(transactionDateObj);
        if (inRange) {
          logger.debug(`Order ${orderLink.orderId} with date ${orderLink.transactionDate.toLocaleDateString()} is IN date range`);
          return true;
        } else {
          logger.debug(`Order ${orderLink.orderId} with date ${orderLink.transactionDate.toLocaleDateString()} is OUT of date range, filtering out`);
          return false;
        }
      });
      
      logger.info(`Date filtering result: ${filteredLinks.length} of ${orderLinks.length} orders match the date range`);
    }

    return filteredLinks;
  }

  /**
   * Fetches order details for all provided order links
   * @param {Array} orderLinks - Array of order link objects to fetch
   * @param {HTMLElement} button - Button element to update with progress
   * @returns {Promise<Array>} Array of order detail objects
   */
  async function fetchAllOrderDetails(orderLinks, button) {
    const orderDetails = [];
    const delayMs = CONFIG.TEST_MODE ? CONFIG.TEST_MODE_DELAY_MS : CONFIG.PRODUCTION_DELAY_MS;
    
    button.textContent = getExportButtonText({ customText: `🔄 Fetching ${orderLinks.length} orders...` });

    for (let i = 0; i < orderLinks.length; i++) {
      const orderLink = orderLinks[i];
      button.textContent = getExportButtonText({ 
        isExporting: true, 
        progress: { current: i + 1, total: orderLinks.length } 
      });
      
      try {
        const details = await fetchOrderDetails(orderLink.url, orderLink.orderId, orderLink.transactionDate);
        if (details) {
          orderDetails.push(details);
          logger.debug(`Successfully fetched order ${orderLink.orderId}`);
        }
      } catch (error) {
        logger.error(`Error fetching order ${orderLink.orderId}:`, error);
      }
      
      if (i < orderLinks.length - 1) {
        await sleep(delayMs);
      }
    }

    return orderDetails;
  }

  /**
   * Main export function - orchestrates the entire export process
   */
  async function exportToCSV() {
    const button = document.getElementById('amazon-export-btn');
    if (!button) {
      logger.error('Export button not found');
      return;
    }

    try {
      button.textContent = getExportButtonText({ customText: '🔄 Exporting...' });
      button.disabled = true;

      // Navigate to target date range if needed
      const settings = dateFilter ? dateFilter.getSettings() : dateFilterSettings;
      if (settings && settings.enabled && settings.startDate) {
        const startDateStr = settings.startDate.toLocaleDateString();
        button.textContent = getExportButtonText({ customText: `🔄 Navigating to ${startDateStr}...` });
        const foundTarget = await navigateToDateRange();
        if (!foundTarget) {
          alert(`Could not find transactions for the selected date range. Make sure you navigate to the correct page manually.`);
          resetExportButton(button);
          return;
        }
      }

      // Collect all order links
      const allOrderLinks = await collectAllOrderLinks();
      
      // Log order statistics
      const ordersWithDates = allOrderLinks.filter(link => link.transactionDate).length;
      const ordersWithoutDates = allOrderLinks.length - ordersWithDates;
      logger.info(`Orders with transaction dates: ${ordersWithDates}, Orders without dates: ${ordersWithoutDates}`);

      if (allOrderLinks.length === 0) {
        alert('No order links found. Make sure you are on the Amazon Transactions page.');
        resetExportButton(button);
        return;
      }

      // Filter orders by date range and test mode
      const ordersToProcess = filterOrdersByDateRange(allOrderLinks);

      if (ordersToProcess.length === 0) {
        let errorMessage = 'Could not find any orders to process. ';
        const settings = dateFilter ? dateFilter.getSettings() : dateFilterSettings;
        if (settings && settings.enabled) {
          errorMessage += `No orders found in the selected date range (${settings.startDate?.toLocaleDateString()} - ${settings.endDate?.toLocaleDateString()}). Please check the date range or try exporting the current page only.`;
        } else {
          errorMessage += 'Please try again.';
        }
        alert(errorMessage);
        resetExportButton(button);
        return;
      }

      // Fetch order details
      const orderDetails = await fetchAllOrderDetails(ordersToProcess, button);

      if (orderDetails.length === 0) {
        let errorMessage = 'Could not fetch any order details. ';
        const settings = dateFilter ? dateFilter.getSettings() : dateFilterSettings;
        if (settings && settings.enabled) {
          errorMessage += `No orders found in the selected date range (${settings.startDate?.toLocaleDateString()} - ${settings.endDate?.toLocaleDateString()}). Please check the date range or try exporting the current page only.`;
        } else {
          errorMessage += 'Please try again.';
        }
        alert(errorMessage);
        resetExportButton(button);
        return;
      }

      // Convert to CSV and download
      const csvContent = convertToCSV(orderDetails);
      const filename = CONFIG.TEST_MODE 
        ? `amazon_orders_TEST_${getDateString()}.csv`
        : `amazon_orders_${getDateString()}.csv`;
      downloadCSV(csvContent, filename);

      // Show success message
      button.textContent = getExportButtonText({ customText: `✅ Exported ${orderDetails.length} orders!` });
      setTimeout(() => {
        resetExportButton(button);
      }, 3000);

    } catch (error) {
      logger.error('Export error:', error);
      alert('Error exporting transactions: ' + error.message);
      resetExportButton(button);
    }
  }

  function getElementPosition(element) {
    // Get a numeric position for an element based on its location in document order
    // This is used for comparing positions between elements
    if (!element) return Infinity;
    
    // Use a simple approach: count elements before this one in document order
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

  function findTransactionDateForElement(element, dateHeaders) {
    // Find the nearest date header (grouping date) for this order element
    // Use the pre-extracted date headers to find the most recent date before this element
    if (!dateHeaders || dateHeaders.length === 0) {
      return null;
    }
    
    const elementPosition = getElementPosition(element);
    
    // Find the most recent date header that appears before this element in the DOM
    for (let i = dateHeaders.length - 1; i >= 0; i--) {
      if (dateHeaders[i].position < elementPosition) {
        return dateHeaders[i].date;
      }
    }
    
    // If no date found before, use the first date header (shouldn't happen, but fallback)
    return dateHeaders.length > 0 ? dateHeaders[0].date : null;
  }

  function extractOrderLinks() {
    const orderLinkMap = new Map(); // Use Map to avoid duplicates
    
    // First, build a map of date headers and their positions in the DOM
    // This helps us correctly associate each order with its date
    const dateHeaders = [];
    const datePattern = CONST.DATE_PATTERN ? new RegExp(CONST.DATE_PATTERN.source, 'i') : /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/i;
    const dateSelectors = CONST.TRANSACTION_PAGE?.dateHeaders || [
      '[class*="transaction-date"]',
      '[data-pmts-component-id*="transaction-date"]',
      '[class*="TransactionDate"]'
    ];
    
    // Find all date headers on the page
    dateSelectors.forEach(selector => {
      const dateElements = CONST.findAllElementsWithFallbacks ?
        CONST.findAllElementsWithFallbacks([selector]) :
        Array.from(document.querySelectorAll(selector));
      dateElements.forEach(el => {
        const dateText = el.textContent?.trim() || '';
        const match = dateText.match(datePattern);
        if (match) {
          const parsedDate = parseDateFromTransaction(match[0]);
          if (parsedDate) {
            dateHeaders.push({
              element: el,
              date: parsedDate.date,
              position: getElementPosition(el)
            });
          }
        }
      });
    });
    
    // Sort by DOM position (top to bottom)
    dateHeaders.sort((a, b) => a.position - b.position);
    
    logger.debug(`Found ${dateHeaders.length} date headers on page`);

    // First, try to find links that contain order detail URLs
    const orderDetailLinkSelectors = CONST.TRANSACTION_PAGE?.orderLinks || [
      'a[href*="/gp/your-account/order-details"]',
      'a[href*="/your-account/order-details"]',
      'a[href*="order-details"]',
      'a[href*="/gp/css/summary/print"]'
    ];

    orderDetailLinkSelectors.forEach(selector => {
      const links = CONST.findAllElementsWithFallbacks ?
        CONST.findAllElementsWithFallbacks([selector]) :
        Array.from(document.querySelectorAll(selector));
      links.forEach(link => {
        const href = link.getAttribute('href');
        const text = link.textContent || '';
        
        // Extract order ID from text or href
        const orderIdPattern = CONST.ORDER_ID_PATTERN || /Order\s*#?\s*([\d-]+)/i;
        let orderMatch = text.match(orderIdPattern);
        if (!orderMatch && href) {
          // Try to extract from URL
          const urlPattern = CONST.ORDER_ID_URL_PATTERN || /order[_-]?id[=_]?([\d-]+)|[/-]([\d-]{10,})[/-]/i;
          orderMatch = href.match(urlPattern);
          if (orderMatch) {
            orderMatch = [null, orderMatch[1] || orderMatch[2]];
          }
        }
        
        if (orderMatch && href) {
          const orderId = orderMatch[1].trim();
          // Convert relative URLs to absolute
          const fullUrl = href.startsWith('http') ? href : new URL(href, window.location.origin).href;
          
          if (!orderLinkMap.has(orderId)) {
            // Find the transaction date (grouping date) for this order
            const transactionDate = findTransactionDateForElement(link, dateHeaders);
            
            orderLinkMap.set(orderId, {
              orderId: orderId,
              url: fullUrl,
              text: text.trim() || `Order #${orderId}`,
              transactionDate: transactionDate // Date from transactions page grouping
            });
          }
        }
      });
    });

    // Also search for order numbers in the page and find nearby links
    // This handles cases where order number text is near but not inside the link
    // Also handles "Refund: Order #" pattern
    const orderPattern = CONST.ORDER_ID_PATTERN_WITH_REFUND || /(?:Refund:)?\s*Order\s*#?\s*([\d-]+)/gi;
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
          // Search for a link in the parent hierarchy or siblings
          let searchElement = node.parentElement;
          let foundLink = null;
          
          // Check parent and sibling elements for links
          for (let i = 0; i < 5 && searchElement && searchElement !== document.body; i++) {
            // Check if this element is a link
            if (searchElement.tagName === 'A' && searchElement.href) {
              foundLink = searchElement;
              break;
            }
            
            // Check siblings for links
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
            const fullUrl = foundLink.href.startsWith('http') ? foundLink.href : new URL(foundLink.href, window.location.origin).href;
            // Find the transaction date (grouping date) for this order
            const transactionDate = findTransactionDateForElement(foundLink, dateHeaders);
            
            orderLinkMap.set(orderId, {
              orderId: orderId,
              url: fullUrl,
              text: `Order #${orderId}`,
              transactionDate: transactionDate // Date from transactions page grouping
            });
          } else {
            // If no link found, construct the order detail URL from order ID
            // Amazon order detail URLs typically follow: /gp/your-account/order-details/ref=oh_aui_detailpage_o00_s00?ie=UTF8&orderID=ORDER_ID
            const constructedUrl = `https://www.amazon.com/gp/your-account/order-details/ref=oh_aui_detailpage_o00_s00?ie=UTF8&orderID=${orderId}`;
            // Find the transaction date (grouping date) for this order
            const transactionDate = findTransactionDateForElement(node, dateHeaders);
            
            orderLinkMap.set(orderId, {
              orderId: orderId,
              url: constructedUrl,
              text: `Order #${orderId}`,
              transactionDate: transactionDate // Date from transactions page grouping
            });
          }
        }
      }
    }

    logger.info(`Extracted ${orderLinkMap.size} unique order links`);
    const orderLinks = Array.from(orderLinkMap.values());
    
    // Log transaction dates for debugging and count how many have dates
    let datesFound = 0;
    let datesMissing = 0;
    orderLinks.forEach(link => {
      if (link.transactionDate) {
        logger.debug(`Order ${link.orderId}: transaction date = ${link.transactionDate.toLocaleDateString()}`);
        datesFound++;
      } else {
        logger.warn(`Order ${link.orderId}: no transaction date found`);
        datesMissing++;
      }
    });
    
    logger.info(`Transaction date extraction summary: ${datesFound} orders with dates, ${datesMissing} orders without dates`);
    
    if (datesMissing > 0 && datesFound === 0) {
      logger.error('WARNING: No transaction dates were extracted for any orders! This will cause date filtering to fail.');
    }
    
    return orderLinks;
  }

  async function fetchOrderDetails(orderUrl, orderId, transactionDate) {
    try {
      logger.debug(`Fetching order details for ${orderId} from ${orderUrl}`);
      
      // Fetch the order page HTML with credentials
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

      const html = await response.text();
      
      // Parse the order details from the HTML
      const orderDetails = parseOrderPage(html, orderId, orderUrl, transactionDate);
      
      return orderDetails;
    } catch (error) {
      logger.error(`Error fetching order ${orderId}:`, error);
      return null;
    }
  }

  function parseOrderPage(html, orderId, orderUrl, transactionDate) {
    // Create a temporary DOM element to parse the HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const orderDetails = {
      orderNumber: orderId,
      orderUrl: orderUrl || '',
      transactionDate: transactionDate ? transactionDate.toLocaleDateString() : '', // Date from transactions page grouping
      orderPlacedDate: '', // Date from order details page (when order was placed)
      orderTotal: '',
      refundAmount: '',
      paymentMethod: '',
      items: [],
      status: ''
    };

    // Extract order placed date (from order details page)
    const datePatterns = CONST.DATE_EXTRACTION_PATTERNS || [
      /(?:Ordered on|Placed on|Order date)[:\s]+([^\n<]+)/i,
      /Order\s+placed\s+(\w+ \d{1,2}, \d{4})/i,
      /(\w+ \d{1,2}, \d{4})/,
      /(\d{1,2}\/\d{1,2}\/\d{4})/
    ];
    
    const bodyText = doc.body.textContent || '';
    for (const pattern of datePatterns) {
      const match = bodyText.match(pattern);
      if (match) {
        orderDetails.orderPlacedDate = match[1].trim();
        break;
      }
    }

    // Extract refund total first (if it exists)
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
          // Format refund amount consistently
          orderDetails.refundAmount = '$' + refundValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
          break;
        }
      }
      if (refundTotal > 0) break;
    }
    
    // If no refund found, leave refundAmount empty
    if (refundTotal === 0) {
      orderDetails.refundAmount = '';
    }

    // Extract order total - specifically look for Grand Total
    // Avoid Item(s) Subtotal, Shipping & Handling, etc.
    const grandTotalPatterns = CONST.GRAND_TOTAL_PATTERNS || [
      /Grand\s+Total[:\s]*\$?([\d,]+\.?\d*)/i,
      /Order\s+Total[:\s]*\$?([\d,]+\.?\d*)/i,
      /(?:Total\s+for\s+this\s+Order|Total\s+charged)[:\s]*\$?([\d,]+\.?\d*)/i
    ];
    
    // First try to find Grand Total specifically
    let foundGrandTotal = false;
    let grandTotalValue = 0;
    for (const pattern of grandTotalPatterns) {
      const matches = bodyText.matchAll(new RegExp(pattern.source, 'gi'));
      for (const match of matches) {
        // Make sure it's not in a context that suggests it's a subtotal
        const contextSize = CONST.CONTEXT_WINDOW_SIZE || 50;
        const contextStart = Math.max(0, match.index - contextSize);
        const contextEnd = Math.min(bodyText.length, match.index + match[0].length + contextSize);
        const context = bodyText.substring(contextStart, contextEnd);
        
        // Skip if it looks like a subtotal or intermediate total
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
    
    // If Grand Total not found, look for the last/largest total value
    if (!foundGrandTotal) {
      const pricePattern = CONST.PRICE_PATTERN || /\$([\d,]+\.?\d*)/g;
      const allAmounts = bodyText.matchAll(pricePattern);
      const amounts = [];
      for (const match of allAmounts) {
        const amount = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(amount) && amount > 0) {
          amounts.push({ value: amount, match: match });
        }
      }
      // Take the largest amount as it's likely the grand total
      if (amounts.length > 0) {
        amounts.sort((a, b) => b.value - a.value);
        grandTotalValue = amounts[0].value;
        foundGrandTotal = true;
      }
    }

    // Calculate net amount: Grand Total - Refund Total
    if (foundGrandTotal && grandTotalValue > 0) {
      const netAmount = grandTotalValue - refundTotal;
      // Store the net amount as the order total (the actual transaction amount)
      orderDetails.orderTotal = '$' + netAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    // Extract items - only actual product names, not order summary fields
    const excludedKeywords = CONST.EXCLUDED_KEYWORDS || [
      'Item(s) Subtotal', 'Subtotal', 'Shipping & Handling', 'Shipping', 
      'Free Shipping', 'Total before tax', 'Estimated tax', 'Grand Total',
      'Order Total', 'Your Coupon Savings', 'Subscribe & Save', 
      'Refund Total', 'CO Retail Delivery Fees', 'FSA or HSA eligible',
      'P&G', 'Delivery Fees', 'Tax', 'Total'
    ];

    // Try to find item containers/rows that contain product information
    const itemSelectors = CONST.ORDER_DETAIL_PAGE?.items || [
      '[data-item]',
      '.yohtmlc-item',
      '[class*="yo-item"]',
      '[class*="item-row"]',
      '[class*="order-item"]',
      '.a-fixed-left-grid[class*="item"]',
      'div[class*="item-details"]'
    ];

    const itemContainers = new Set();
    
    for (const selector of itemSelectors) {
      const containers = Array.from(doc.querySelectorAll(selector));
      if (containers.length > 0) {
        containers.forEach(container => {
          // Look for links or spans that might contain product names
          const productLinkSelectors = CONST.ORDER_DETAIL_PAGE?.productLinks || ['a[href*="/dp/"]', 'a[href*="/gp/product/"]'];
          const productLinks = container.querySelectorAll(productLinkSelectors.join(', '));
          productLinks.forEach(link => {
            const linkText = link.textContent?.trim();
            const minLength = CONST.MIN_TEXT_LENGTH || 5;
            const maxLength = CONST.MAX_TEXT_LENGTH || 200;
            if (linkText && linkText.length > minLength && linkText.length < maxLength) {
              // Check if it's not a summary field
              const isExcluded = excludedKeywords.some(keyword => 
                linkText.toLowerCase().includes(keyword.toLowerCase())
              );
              if (!isExcluded) {
                itemContainers.add(linkText);
              }
            }
          });

          // Also check for product titles in the container
          const containerText = container.textContent?.trim() || '';
          const minTextLengthStrict = CONST.MIN_TEXT_LENGTH_STRICT || 10;
          if (containerText.length > minTextLengthStrict) {
            // Split by lines and look for product-like text
            const minLength = CONST.MIN_TEXT_LENGTH || 5;
            const lines = containerText.split('\n').map(l => l.trim()).filter(l => l.length > minLength);
            lines.forEach(line => {
              // Skip if it looks like a summary field
              const isExcluded = excludedKeywords.some(keyword => 
                line.toLowerCase().includes(keyword.toLowerCase())
              );
              // Skip if it looks like a price or quantity
              const pricePattern = CONST.PRICE_PATTERN_SIMPLE || /^\$[\d,]+\.?\d*$/;
              const quantityPattern = CONST.QUANTITY_PATTERN || /^Qty:?\s*\d+/;
              const looksLikePrice = pricePattern.test(line) || quantityPattern.test(line);
              // Skip if it's too short or looks like metadata
              const metadataPattern = CONST.METADATA_PATTERN || /^(Condition|Sold by|Shipped by|Qty|Quantity):/i;
              const looksLikeMetadata = metadataPattern.test(line);
              
              const maxLength = CONST.MAX_TEXT_LENGTH || 200;
              if (!isExcluded && !looksLikePrice && !looksLikeMetadata && 
                  line.length > minTextLengthStrict && line.length < maxLength) {
                // Check if it contains actual text (not just numbers/symbols)
                const textPattern = CONST.TEXT_PATTERN || /[a-zA-Z]{3,}/;
                if (textPattern.test(line)) {
                  itemContainers.add(line.substring(0, maxLength));
                }
              }
            });
          }
        });
        if (itemContainers.size > 0) break;
      }
    }

    // If still no items, try a more targeted search for product links
    if (itemContainers.size === 0) {
      const allProductLinkSelectors = CONST.ORDER_DETAIL_PAGE?.productLinks || ['a[href*="/dp/"]', 'a[href*="/gp/product/"]', 'a[href*="/gp/item-detail/"]'];
      const allProductLinks = doc.querySelectorAll(allProductLinkSelectors.join(', '));
      const minTextLengthStrict = CONST.MIN_TEXT_LENGTH_STRICT || 10;
      const maxLength = CONST.MAX_TEXT_LENGTH || 200;
      const parentSearchDepth = CONST.PARENT_SEARCH_DEPTH || 5;
      allProductLinks.forEach(link => {
        const linkText = link.textContent?.trim();
        if (linkText && linkText.length > minTextLengthStrict && linkText.length < maxLength) {
          const isExcluded = excludedKeywords.some(keyword => 
            linkText.toLowerCase().includes(keyword.toLowerCase())
          );
          // Make sure it's not in the order summary section
          let parent = link.parentElement;
          let inSummary = false;
          const summaryPatterns = CONST.SUMMARY_SECTION_PATTERNS || [/Order\s+Summary/i, /Payment\s+Information/i, /Order\s+Total/i];
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
            itemContainers.add(linkText.substring(0, maxLength));
          }
        }
      });
    }

    orderDetails.items = Array.from(itemContainers);

    // Extract payment method
    const paymentPatterns = CONST.PAYMENT_PATTERNS || [
      /(?:Payment method|Paid with|Payment)[:\s]+([^\n<]+)/i,
      /(?:Card ending|Card)[:\s]+([^\d\n<]+[\d]+)/i
    ];
    
    for (const pattern of paymentPatterns) {
      const match = bodyText.match(pattern);
      if (match) {
        orderDetails.paymentMethod = match[1].trim();
        break;
      }
    }

    // Extract order status - be very specific to avoid matching code or other text
    // Look for actual status words in context, not just anywhere
    const statusKeywords = CONST.STATUS_KEYWORDS || ['Shipped', 'Delivered', 'Cancelled', 'Pending', 'Processing', 'Returned', 'Refunded'];
    let foundStatus = '';
    
    // First, try to find status in structured sections
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
          if (text.includes(keyword) && text.length < maxStatusTextLength) { // Avoid matching long text blocks
            foundStatus = keyword;
            break;
          }
        }
        if (foundStatus) break;
      }
      if (foundStatus) break;
    }
    
    // If not found in structured sections, look for status in specific patterns
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
          // Make sure it's not part of code (check context)
          const matchIndex = bodyText.indexOf(match[0]);
          const contextStart = Math.max(0, matchIndex - contextCheckSize);
          const contextEnd = Math.min(bodyText.length, matchIndex + match[0].length + contextCheckSize);
          const context = bodyText.substring(contextStart, contextEnd);
          
          // Skip if it looks like code (contains operators, brackets, etc.)
          if (!codeContextPattern.test(context)) {
            foundStatus = match[1];
            break;
          }
        }
      }
    }
    
    orderDetails.status = foundStatus || '';

    // Combine items into a single string
    orderDetails.items = orderDetails.items.join('; ');

    return orderDetails;
  }

  async function loadAllOrders() {
    // Amazon may paginate orders. This function attempts to load all orders.
    // Amazon's UI might use infinite scroll or pagination buttons.
    let previousCount = 0;
    let currentCount = 0;
    let attempts = 0;
    const maxAttempts = CONST.MAX_ATTEMPTS || 10;

    do {
      previousCount = currentCount;
      
      // Try to find and click "Show more" or "Load more" buttons
      const loadMoreButtons = CONST.ORDER_HISTORY_PAGE?.loadMoreButtons || [
        'button:contains("Show more")',
        'button:contains("Load more")',
        '[aria-label*="Show more"]',
        '[aria-label*="Load more"]',
        'a:contains("Next")',
        '.a-pagination .a-last'
      ];

      for (const selector of loadMoreButtons) {
        try {
          const button = Array.from(document.querySelectorAll('button, a')).find(
            el => el.textContent.toLowerCase().includes('more') || 
                  el.textContent.toLowerCase().includes('next') ||
                  el.getAttribute('aria-label')?.toLowerCase().includes('more')
          );
          
          if (button && button.offsetParent !== null) {
            button.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(CONST.SCROLL_DELAY_MS || 500);
            button.click();
            await sleep(CONST.PAGE_LOAD_DELAY_MS || 2000); // Wait for content to load
            break;
          }
        } catch (e) {
          logger.debug('Could not find load more button:', e);
        }
      }

      // Scroll to bottom to trigger infinite scroll if present
      window.scrollTo(0, document.body.scrollHeight);
      await sleep(CONST.INFINITE_SCROLL_DELAY_MS || 1000);

      const orderCardSelectors = CONST.ORDER_HISTORY_PAGE?.orderCards || ['[data-testid="order-card"]', '.order-card', 'div[class*="order-card"]'];
      currentCount = CONST.findAllElementsWithFallbacks ?
        CONST.findAllElementsWithFallbacks(orderCardSelectors).length :
        document.querySelectorAll(orderCardSelectors.join(', ')).length;
      attempts++;
    } while (currentCount > previousCount && attempts < maxAttempts);
  }

  function extractTransactions() {
    const transactions = [];
    
    // Check if we're on the transactions page
    const isTransactionsPage = window.location.href.includes('/cpe/yourpayments/transactions');
    
    let orderElements = [];
    
    if (isTransactionsPage) {
      // Try to find transaction rows in tables or transaction containers
      const transactionSelectors = CONST.TRANSACTION_PAGE?.transactionRows || [
        'table tbody tr',
        '[data-testid*="transaction"]',
        'div[class*="transaction"]',
        'div[class*="Transaction"]',
        '.transaction-row',
        'tr[class*="transaction"]'
      ];
      
      for (const selector of transactionSelectors) {
        orderElements = CONST.findAllElementsWithFallbacks ?
          CONST.findAllElementsWithFallbacks([selector]) :
          Array.from(document.querySelectorAll(selector));
        if (orderElements.length > 0) {
          logger.debug(`Found ${orderElements.length} transactions using selector: ${selector}`);
          break;
        }
      }
      
      // Also try to find by text content patterns for transactions
      if (orderElements.length === 0) {
        const rowSelectors = CONST.COMMON?.rows || ['tr', 'div[role="row"]'];
        const allRows = CONST.findAllElementsWithFallbacks ?
          CONST.findAllElementsWithFallbacks(rowSelectors) :
          Array.from(document.querySelectorAll(rowSelectors.join(', ')));
        orderElements = allRows.filter(row => {
          const text = row.textContent || '';
          return (text.includes('$') || text.match(/\d{1,2}\/\d{1,2}\/\d{4}/) || 
                  text.match(/\w+ \d{1,2}, \d{4}/)) && text.length > 20;
        });
      }
    } else {
      // Try multiple selectors for order cards (orders page)
      const orderSelectors = CONST.ORDER_HISTORY_PAGE?.orderCards || [
        '[data-testid="order-card"]',
        '.order-card',
        'div[class*="order-card"]',
        '[data-component-type="order-card"]'
      ];

      for (const selector of orderSelectors) {
        orderElements = CONST.findAllElementsWithFallbacks ?
          CONST.findAllElementsWithFallbacks([selector]) :
          Array.from(document.querySelectorAll(selector));
        if (orderElements.length > 0) break;
      }
    }

    // If no standard selectors work, try to find by structure
    if (orderElements.length === 0) {
      // Look for elements containing order/transaction information
      const allDivs = Array.from(document.querySelectorAll('div'));
      orderElements = allDivs.filter(div => {
        const text = div.textContent || '';
        return text.includes('Order #') || text.includes('Ordered on') || 
               text.includes('Total') || (text.includes('$') && text.includes('Placed')) ||
               (text.includes('$') && (text.match(/\d{1,2}\/\d{1,2}\/\d{4}/) || text.match(/\w+ \d{1,2}, \d{4}/)));
      });
    }

    logger.debug(`Found ${orderElements.length} potential transaction elements`);

    orderElements.forEach((orderElement, index) => {
      try {
        const transaction = parseOrderElement(orderElement, isTransactionsPage);
        if (transaction) {
          transactions.push(transaction);
        }
      } catch (error) {
        logger.error(`Error parsing order ${index}:`, error);
      }
    });

    return transactions;
  }

  function parseOrderElement(element, isTransactionsPage = false) {
    const text = element.textContent || '';
    const html = element.innerHTML || '';

    if (isTransactionsPage) {
      // Parse transaction page structure
      // Try to extract data from table cells if it's a table row
      const cells = element.querySelectorAll('td, th, [role="cell"]');
      let transactionData = {
        transactionId: '',
        date: '',
        description: '',
        amount: '',
        merchant: ''
      };

      if (cells.length > 0) {
        // Extract from table cells
        cells.forEach((cell, idx) => {
          const cellText = cell.textContent?.trim() || '';
          if (cellText.includes('$') || cellText.match(/^-?\$?[\d,]+\.?\d*$/)) {
            transactionData.amount = cellText.replace(/[^0-9.-]/g, '') ? '$' + cellText.replace(/[^0-9.-]/g, '') : '';
          } else if (cellText.match(/\d{1,2}\/\d{1,2}\/\d{4}/) || cellText.match(/\w+ \d{1,2}, \d{4}/)) {
            transactionData.date = cellText;
          } else if (cellText.length > 10 && !transactionData.description) {
            transactionData.description = cellText;
          }
        });
      }

      // Extract date
      const dateMatch = text.match(/(\w+ \d{1,2}, \d{4})/) ||
                       text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/) ||
                       text.match(/(\d{4}-\d{2}-\d{2})/);
      transactionData.date = transactionData.date || (dateMatch ? dateMatch[1].trim() : '');

      // Extract amount
      const amountMatches = text.match(/\$([\d,]+\.?\d*)/g);
      if (amountMatches && amountMatches.length > 0) {
        transactionData.amount = amountMatches[amountMatches.length - 1]; // Get the last (likely the total)
      } else if (!transactionData.amount) {
        transactionData.amount = '';
      }

      // Extract description/merchant
      if (!transactionData.description) {
        const descMatch = text.match(/(Amazon|Merchant|Description)[:\s]+([^\n$]+)/i);
        transactionData.description = descMatch ? descMatch[2].trim() : text.substring(0, 200).trim();
      }

      // Extract transaction ID
      const transIdMatch = text.match(/(?:Transaction|Txn|ID)[:\s#]*([\dA-Z-]+)/i) ||
                          html.match(/transaction[_-]?id["']?\s*[=:]\s*["']?([^"'\s]+)/i);
      transactionData.transactionId = transIdMatch ? transIdMatch[1].trim() : `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      return {
        orderNumber: transactionData.transactionId,
        date: transactionData.date,
        total: transactionData.amount,
        items: transactionData.description,
        status: ''
      };
    } else {
      // Parse order page structure (original logic)
      // Extract order number
      const orderNumberMatch = text.match(/Order\s*#?\s*([\d-]+)/i) || 
                              html.match(/order[_-]?id["']?\s*[=:]\s*["']?([^"'\s]+)/i);
      const orderNumber = orderNumberMatch ? orderNumberMatch[1] : `ORDER-${Date.now()}-${Math.random()}`;

      // Extract date
      const dateMatch = text.match(/(?:Ordered on|Placed on|Date)[:\s]+([^\n]+)/i) ||
                       text.match(/(\w+ \d{1,2}, \d{4})/) ||
                       text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
      const date = dateMatch ? dateMatch[1].trim() : '';

      // Extract total price
      const priceMatch = text.match(/(?:Total|Amount)[:\s]*\$?([\d,]+\.?\d*)/i) ||
                        text.match(/\$([\d,]+\.?\d*)/);
      const total = priceMatch ? '$' + priceMatch[1] : '';

      // Extract items
      const items = [];
      const itemElements = element.querySelectorAll('[class*="item"], [class*="product"]');
      itemElements.forEach(itemEl => {
        const itemText = itemEl.textContent?.trim();
        if (itemText && itemText.length > 3) {
          items.push(itemText);
        }
      });
      const itemsText = items.length > 0 ? items.join('; ') : text.substring(0, 200);

      // Extract status
      const statusMatch = text.match(/(?:Status|Shipped|Delivered|Cancelled|Pending)[:\s]*([^\n]+)/i);
      const status = statusMatch ? statusMatch[1].trim() : '';

      return {
        orderNumber: orderNumber.trim(),
        date: date,
        total: total,
        items: itemsText,
        status: status
      };
    }
  }

  function convertToCSV(orders) {
    if (orders.length === 0) return '';

    // Check if this is the new order details format or old transaction format
    const isOrderDetails = orders[0].hasOwnProperty('transactionDate') || orders[0].hasOwnProperty('orderPlacedDate') || orders[0].hasOwnProperty('orderTotal');

    if (isOrderDetails) {
      // New order details format
      const headers = ['Order Number', 'Transaction Date', 'Order Placed Date', 'Order Total', 'Refund Amount', 'Items', 'Payment Method', 'Status', 'Order URL'];
      const rows = orders.map(t => [
        escapeCSV(t.orderNumber || ''),
        escapeCSV(t.transactionDate || ''), // Date from transactions page grouping
        escapeCSV(t.orderPlacedDate || ''), // Date from order details page
        escapeCSV(t.orderTotal || ''),
        escapeCSV(t.refundAmount || ''),
        escapeCSV(t.items || ''),
        escapeCSV(t.paymentMethod || ''),
        escapeCSV(t.status || ''),
        escapeCSV(t.orderUrl || '')
      ]);

      const csvRows = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ];

      return csvRows.join('\n');
    } else {
      // Old transaction format (backward compatibility)
      const headers = ['Order Number', 'Date', 'Total', 'Items', 'Status'];
      const rows = orders.map(t => [
        escapeCSV(t.orderNumber || ''),
        escapeCSV(t.date || ''),
        escapeCSV(t.total || ''),
        escapeCSV(t.items || ''),
        escapeCSV(t.status || '')
      ]);

      const csvRows = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ];

      return csvRows.join('\n');
    }
  }

  /**
   * Downloads a CSV file
   * @param {string} content - CSV content
   * @param {string} filename - Filename for download
   */
  function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }


  // Re-initialize when page content changes (for SPAs)
  const observer = new MutationObserver((mutations) => {
    if (!document.getElementById('amazon-export-btn')) {
      init();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

})();

