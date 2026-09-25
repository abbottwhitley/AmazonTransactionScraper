(function() {
  'use strict';

  // ============================================================================
  // MODULE INITIALIZATION
  // ============================================================================

  // Initialize modules (with fallbacks for backward compatibility)
  const logger = window.AmazonExporterLogger || {
    debug: console.debug.bind(console),
    info: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    group: console.group.bind(console),
    groupEnd: console.groupEnd.bind(console)
  };

  const CONFIG = window.CONFIG || {
    TEST_MODE: true,
    TEST_MODE_MAX_ORDERS: 30,
    TEST_MODE_DELAY_MS: 1000,
    PRODUCTION_DELAY_MS: 1000,
    LOG_LEVEL: 'INFO'
  };

  const appState = window.AmazonExporterAppState;
  const dateFilter = window.AmazonExporterDateFilter;
  const dateUtils = window.AmazonExporterDateUtils;
  const ExportButton = window.AmazonExporterButton;
  const ExportModal = window.AmazonExporterModal;
  const ProgressIndicator = window.AmazonExporterProgress;
  const getScraperForPage = window.AmazonExporterGetScraperForPage;
  const PaginationHandler = window.AmazonExporterPagination;
  const OrderRepository = window.AmazonExporterOrderRepository;
  const CSVExporter = window.AmazonExporterCSVExporter;
  const OrderModel = window.AmazonExporterOrderModel;

  // Initialize instances
  const button = ExportButton ? new ExportButton() : null;
  const modal = ExportModal ? new ExportModal() : null;
  const pagination = PaginationHandler ? new PaginationHandler() : null;
  const orderRepository = OrderRepository ? new OrderRepository() : null;

  // Legacy compatibility
  let dateFilterSettings = null;

  // ============================================================================
  // UTILITY FUNCTIONS (kept for backward compatibility and direct access)
  // ============================================================================

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function normalizeDate(date) {
    return dateUtils ? dateUtils.normalizeDate(date) : (() => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d;
    })();
  }

  function formatDateForInput(date) {
    return dateUtils ? dateUtils.formatDateForInput(date) : (() => {
      if (!date) return '';
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    })();
  }

  function parseDateFromTransaction(dateString) {
    return dateUtils ? dateUtils.parseDateFromTransaction(dateString) : (() => {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return {
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          date: date
        };
      }
      return null;
    })();
  }

  function getDateString() {
    return dateUtils ? dateUtils.getDateString() : (() => {
      const now = new Date();
      return now.toISOString().split('T')[0];
    })();
  }

  function escapeCSV(value) {
    return CSVExporter ? CSVExporter.escapeCSV(value) : (() => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    })();
  }

  // Date filtering helpers (delegate to DateFilter)
  function isDateInTargetRange(parsedDate) {
    if (dateFilter) {
      return dateFilter.isDateInTargetRange(parsedDate);
    }
    // Fallback
    if (!dateFilterSettings || !dateFilterSettings.enabled || !parsedDate || 
        !dateFilterSettings.startDate || !dateFilterSettings.endDate) {
      return true;
    }
    const transDateOnly = normalizeDate(parsedDate.date);
    const startDateOnly = normalizeDate(dateFilterSettings.startDate);
    const endDateOnly = normalizeDate(dateFilterSettings.endDate);
    return transDateOnly >= startDateOnly && transDateOnly <= endDateOnly;
  }

  function hasPassedTargetMonth(parsedDate) {
    if (dateFilter) {
      return dateFilter.hasPassedTargetMonth(parsedDate);
    }
    // Fallback
    if (!dateFilterSettings || !dateFilterSettings.enabled || !parsedDate || !dateFilterSettings.startDate) return false;
    const transDateOnly = normalizeDate(parsedDate.date);
    const startDateOnly = normalizeDate(dateFilterSettings.startDate);
    return transDateOnly < startDateOnly;
  }

  function shouldContinueCollecting(parsedDate) {
    if (dateFilter) {
      return dateFilter.shouldContinueCollecting(parsedDate);
    }
    // Fallback
    if (!dateFilterSettings || !dateFilterSettings.enabled || !parsedDate || !dateFilterSettings.endDate) return true;
    const transDateOnly = normalizeDate(parsedDate.date);
    const endDateOnly = normalizeDate(dateFilterSettings.endDate);
    return transDateOnly <= endDateOnly;
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  // Wait for page to fully load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  async function init() {
    // Initialize app state
    if (appState && !appState.initialized) {
      await appState.initialize();
      dateFilterSettings = appState.getDateFilterSettings();
    } else if (dateFilter) {
      dateFilterSettings = dateFilter.getSettings();
    } else {
      // Fallback default
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      dateFilterSettings = {
        mode: 'current-month',
        enabled: true,
        startDate: startDate,
        endDate: endDate
      };
    }

    // Check if button already exists
    if (document.getElementById('amazon-export-btn')) {
      logger.debug('Amazon Transaction Exporter: Button already exists');
      return;
    }

    logger.info('Amazon Transaction Exporter: Initializing...');
    logger.debug('Current URL:', window.location.href);

    // Create export button using Button module
    let exportButtonElement;
    if (button) {
      exportButtonElement = button.create(() => {
        logger.info('Amazon Transaction Exporter: Button clicked');
        showExportModal();
      });
    } else {
      // Fallback button creation
      exportButtonElement = document.createElement('button');
      exportButtonElement.id = 'amazon-export-btn';
      exportButtonElement.className = 'amazon-export-button';
      exportButtonElement.textContent = CONFIG.TEST_MODE ? 
        `🧪 Export Transactions (TEST MODE - First ${CONFIG.TEST_MODE_MAX_ORDERS} Only)` :
        '📥 Export All Transactions to CSV';
      exportButtonElement.addEventListener('click', (e) => {
        logger.info('Amazon Transaction Exporter: Button clicked');
        e.preventDefault();
        e.stopPropagation();
        showExportModal();
      });
    }

    // Insert button at the top of the orders/transactions section
    const ordersContainer = findOrdersContainer();
    if (ordersContainer) {
      logger.debug('Amazon Transaction Exporter: Found container, inserting button');
      ordersContainer.insertBefore(exportButtonElement, ordersContainer.firstChild);
    } else {
      logger.debug('Amazon Transaction Exporter: Container not found, using fallback');
      const CONST = window.CONFIG || window.CONSTANTS || {};
      const mainContent = CONST.findElementWithFallbacks ? 
        CONST.findElementWithFallbacks(CONST.COMMON?.mainContent || ['main', '[role="main"]', '#main-content', '.main-content']) || document.body :
        document.querySelector('main, [role="main"], #main-content, .main-content') || document.body;
      const firstChild = mainContent.firstChild;
      if (firstChild) {
        mainContent.insertBefore(exportButtonElement, firstChild);
      } else {
        mainContent.appendChild(exportButtonElement);
      }
    }
    
    logger.info('Amazon Transaction Exporter: Button added successfully');
  }

  function findOrdersContainer() {
    const isTransactionsPage = window.location.href.includes('/cpe/yourpayments/transactions');
    const CONST = window.CONFIG || window.CONSTANTS || {};
    
    const selectors = isTransactionsPage 
      ? (CONST.TRANSACTION_PAGE?.containers || ['table', '[class*="transaction"]', '[class*="Transaction"]', 'main', '[role="main"]', '#transactions-container', '.transactions-container'])
      : (CONST.ORDER_HISTORY_PAGE?.containers || ['[data-testid="order-card-container"]', '.order-card', '#ordersContainer', '.orders-container', '[data-testid="orders-container"]', 'div:has(.order-card)', '.your-orders-content']);

    const findElement = CONST.findElementWithFallbacks || 
      ((selectors) => {
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) return element;
        }
        return null;
      });

    const element = findElement(selectors);
    if (element) {
      return element.parentElement || element;
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

  // ============================================================================
  // MODAL HANDLING
  // ============================================================================

  function showExportModal() {
    if (modal) {
      modal.show(
        (settings) => {
          // On export confirmed - update all state sources to keep them in sync
          logger.info(`📥 Modal callback received settings:`);
          logger.info(`   Mode: ${settings.mode}`);
          logger.info(`   Enabled: ${settings.enabled}`);
          logger.info(`   Start: ${settings.startDate ? settings.startDate.toLocaleDateString() : 'null'}`);
          logger.info(`   End: ${settings.endDate ? settings.endDate.toLocaleDateString() : 'null'}`);
          
          if (appState) {
            appState.setDateFilterSettings(settings);
            // Verify what was set
            const verifySettings = appState.getDateFilterSettings();
            logger.info(`📥 AppState settings after update:`);
            logger.info(`   Start: ${verifySettings.startDate ? verifySettings.startDate.toLocaleDateString() : 'null'}`);
            logger.info(`   End: ${verifySettings.endDate ? verifySettings.endDate.toLocaleDateString() : 'null'}`);
          }
          // Always update dateFilter if it exists (not just when appState doesn't exist)
          // This ensures filterOrdersByDateRange() uses the correct settings
          if (dateFilter) {
            dateFilter.updateSettings(settings);
            // Verify what was set
            const verifySettings = dateFilter.getSettings();
            logger.info(`📥 DateFilter settings after update:`);
            logger.info(`   Start: ${verifySettings.startDate ? verifySettings.startDate.toLocaleDateString() : 'null'}`);
            logger.info(`   End: ${verifySettings.endDate ? verifySettings.endDate.toLocaleDateString() : 'null'}`);
          }
          // Update fallback variable
          dateFilterSettings = settings;
          exportToCSV();
        },
        () => {
          // On cancel
          logger.debug('Export modal cancelled');
        }
      );
    } else {
      // Fallback to old modal implementation
      showExportModalLegacy();
    }
  }

  function showExportModalLegacy() {
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
    const modalEl = document.createElement('div');
    modalEl.className = 'amazon-export-modal';

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const currentMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const currentMonthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    modalEl.innerHTML = `
      <h2>Export Transactions</h2>
      <div class="form-group">
        <label>Export Options:</label>
        <div style="margin-top: 8px;">
          <div style="margin-bottom: 12px;">
            <input type="radio" id="export-current-month" name="export-mode" value="current-month" ${dateFilterSettings?.mode === 'current-month' ? 'checked' : ''}>
            <label for="export-current-month" style="margin-left: 8px; font-weight: normal; cursor: pointer;">
              Current Month (${monthNames[currentMonth - 1]} ${currentYear})
            </label>
          </div>
          <div style="margin-bottom: 12px;">
            <input type="radio" id="export-current-page" name="export-mode" value="current-page" ${dateFilterSettings?.mode === 'current-page' ? 'checked' : ''}>
            <label for="export-current-page" style="margin-left: 8px; font-weight: normal; cursor: pointer;">
              Current Page Only
            </label>
          </div>
          <div>
            <input type="radio" id="export-custom" name="export-mode" value="custom" ${dateFilterSettings?.mode === 'custom' ? 'checked' : ''}>
            <label for="export-custom" style="margin-left: 8px; font-weight: normal; cursor: pointer;">
              Custom Date Range
            </label>
          </div>
        </div>
      </div>
      <div id="custom-date-options" style="display: ${dateFilterSettings?.mode === 'custom' ? 'block' : 'none'};">
        <div class="form-group">
          <label>Custom Date Range:</label>
          <div class="date-inputs">
            <div>
              <label for="start-date" style="font-size: 12px; margin-bottom: 5px;">Start Date</label>
              <input type="date" id="start-date" value="${dateFilterSettings?.startDate ? formatDateForInput(dateFilterSettings.startDate) : formatDateForInput(currentMonthStart)}">
            </div>
            <div>
              <label for="end-date" style="font-size: 12px; margin-bottom: 5px;">End Date</label>
              <input type="date" id="end-date" value="${dateFilterSettings?.endDate ? formatDateForInput(dateFilterSettings.endDate) : formatDateForInput(currentMonthEnd)}">
            </div>
          </div>
        </div>
      </div>
      <div class="button-group">
        <button class="btn-cancel" id="cancel-export">Cancel</button>
        <button class="btn-export" id="confirm-export">Export</button>
      </div>
    `;

    overlay.appendChild(modalEl);
    document.body.appendChild(overlay);

    // Set up event handlers
    const exportModeRadios = modalEl.querySelectorAll('input[name="export-mode"]');
    const customDateOptions = modalEl.getElementById('custom-date-options');
    const startDateInput = modalEl.getElementById('start-date');
    const endDateInput = modalEl.getElementById('end-date');
    const cancelBtn = modalEl.getElementById('cancel-export');
    const exportBtn = modalEl.getElementById('confirm-export');

    exportModeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
          customDateOptions.style.display = 'block';
        } else {
          customDateOptions.style.display = 'none';
        }
      });
    });

    cancelBtn.addEventListener('click', closeExportModal);

    exportBtn.addEventListener('click', () => {
      const selectedMode = modalEl.querySelector('input[name="export-mode"]:checked')?.value;
      
      let mode = 'current-page';
      let enabled = false;
      let startDate = null;
      let endDate = null;

      if (selectedMode === 'current-month') {
        mode = 'current-month';
        enabled = true;
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      } else if (selectedMode === 'custom') {
        mode = 'custom';
        enabled = true;
        const startValue = startDateInput.value;
        const endValue = endDateInput.value;

        if (!startValue || !endValue) {
          alert('Please select both start and end dates.');
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
        mode = 'current-page';
        enabled = false;
      }

      const newSettings = { mode, enabled, startDate, endDate };
      
      // Update all state sources to keep them in sync
      if (appState) {
        appState.setDateFilterSettings(newSettings);
      }
      // Always update dateFilter if it exists (not just when appState doesn't exist)
      if (dateFilter) {
        dateFilter.updateSettings(newSettings);
      }
      // Update fallback variable
      dateFilterSettings = newSettings;

      closeExportModal();
      exportToCSV();
    });
  }

  function closeExportModal() {
    if (modal) {
      modal.close();
    } else {
      const overlay = document.getElementById('amazon-export-modal-overlay');
      if (overlay) {
        overlay.remove();
      }
    }
  }

  // ============================================================================
  // SCRAPING FUNCTIONS (using Strategy pattern)
  // ============================================================================

  function extractTransactionDates() {
    const scraper = getScraperForPage ? getScraperForPage(window.location.href) : null;
    if (scraper) {
      return scraper.extractTransactionDates();
    }
    // Fallback implementation
    const CONST = window.CONFIG || window.CONSTANTS || {};
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
      const parsed = parseDateFromTransaction(text);
      if (parsed) {
        dates.push(parsed);
      }
    });
    
    const datePattern = CONST.DATE_PATTERN || 
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/gi;
    const pageText = document.body.textContent || '';
    let match;
    while ((match = datePattern.exec(pageText)) !== null) {
      const parsed = parseDateFromTransaction(match[0]);
      if (parsed) {
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

  function extractOrderLinks() {
    const scraper = getScraperForPage ? getScraperForPage(window.location.href) : null;
    if (scraper) {
      return scraper.extractOrderLinks();
    }
    // Fallback - return empty array
    logger.warn('No scraper available, cannot extract order links');
    return [];
  }

  async function clickNextPage() {
    if (pagination) {
      return await pagination.clickNextPage();
    }
    // Fallback implementation
    const CONST = window.CONFIG || window.CONSTANTS || {};
    const buttonSelectors = CONST.COMMON?.buttons || ['input[type="submit"]', 'button', 'a'];
    const findAllElements = CONST.findAllElementsWithFallbacks || 
      ((selectors) => Array.from(document.querySelectorAll(selectors.join(', '))));
    const allButtons = findAllElements(buttonSelectors);
    const nextButton = allButtons.find(btn => {
      const text = btn.textContent || btn.value || btn.getAttribute('aria-label') || '';
      return text.toLowerCase().includes('next page');
    });

    if (nextButton && !nextButton.disabled && nextButton.getAttribute('aria-disabled') !== 'true') {
      nextButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(CONST.SCROLL_DELAY_MS || 500);
      nextButton.click();
      await sleep(CONST.PAGE_LOAD_DELAY_MS || 2000);
      return true;
    }
    return false;
  }

  // ============================================================================
  // NAVIGATION AND COLLECTION
  // ============================================================================

  async function navigateToDateRange() {
    const settings = appState ? appState.getDateFilterSettings() : 
                     (dateFilter ? dateFilter.getSettings() : dateFilterSettings);
    if (!settings || !settings.enabled || !settings.startDate) return true;

    const CONST = window.CONFIG || window.CONSTANTS || {};
    let pageCount = 0;
    const maxPages = CONST.MAX_PAGES_TO_COLLECT || 50;

    while (pageCount < maxPages) {
      const dates = extractTransactionDates();
      logger.debug(`Page ${pageCount + 1}: Found ${dates.length} date headers`);

      if (dates.length === 0) {
        logger.debug('No dates found on current page');
        break;
      }

      const hasTargetDate = dates.some(d => isDateInTargetRange(d));
      const hasPassedTarget = dates.some(d => hasPassedTargetMonth(d));

      if (hasTargetDate) {
        logger.info(`Found target date range on page ${pageCount + 1}`);
        return true;
      }

      if (hasPassedTarget && !hasTargetDate) {
        logger.info(`Passed target date range, stopping pagination`);
        return false;
      }

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

  async function collectAllOrderLinks() {
    const allOrderLinks = [];
    let pageCount = 1; // Start at 1 since we're collecting from the current page
    const settings = appState ? appState.getDateFilterSettings() : 
                     (dateFilter ? dateFilter.getSettings() : dateFilterSettings);
    
    if (logger) {
      logger.info(`📦 collectAllOrderLinks() called`);
      logger.info(`   Settings: ${settings ? 'found' : 'not found'}`);
      if (settings) {
        logger.info(`   Enabled: ${settings.enabled}`);
        logger.info(`   StartDate: ${settings.startDate ? settings.startDate.toLocaleDateString() : 'null'}`);
        logger.info(`   EndDate: ${settings.endDate ? settings.endDate.toLocaleDateString() : 'null'}`);
      }
    }
    
    if (settings && settings.enabled && settings.startDate && settings.endDate) {
      const CONST = window.CONFIG || window.CONSTANTS || {};
      const maxPages = CONST.MAX_PAGES_TO_COLLECT || 50;
      let passedEndDate = false;
      
      if (logger) {
        logger.info(`🔍 Starting collection with date range: ${settings.startDate.toLocaleDateString()} to ${settings.endDate.toLocaleDateString()}`);
        logger.info(`🔍 Will stop when dates are before ${settings.startDate.toLocaleDateString()}`);
        logger.info(`🔍 Max pages to collect: ${maxPages}`);
      }

      while (pageCount <= maxPages && !passedEndDate) {
        if (logger) {
          logger.info(`\n📄 === COLLECTING FROM PAGE ${pageCount} ===`);
        }
        
        const pageOrderLinks = extractOrderLinks();
        if (logger) {
          logger.info(`📋 Page ${pageCount}: Found ${pageOrderLinks.length} order links`);
        }
        
        allOrderLinks.push(...pageOrderLinks);
        
        const dates = extractTransactionDates();
        const hasTargetDate = dates.some(d => isDateInTargetRange(d));
        
        // Check if we've gone too far back (before start date)
        // We should stop when ALL dates on the page are before the start date
        const hasPassedStart = dates.length > 0 && dates.every(d => hasPassedTargetMonth(d));
        
        // Also check if we've passed the end date (for forward pagination scenarios)
        // BUT: Don't stop if we're on the first page and all dates are after end date
        // This is because we might need to paginate BACKWARDS to find older dates
        const hasPassedEnd = dates.length > 0 && dates.every(d => !shouldContinueCollecting(d));
        
        if (logger) {
          logger.info(`📅 Page ${pageCount} date analysis:`);
          logger.info(`   - Dates found on page: ${dates.length}`);
          if (dates.length > 0) {
            const dateStrs = dates.map(d => `${d.date.toLocaleDateString()}`).join(', ');
            logger.info(`   - Dates on page: ${dateStrs}`);
          }
          logger.info(`   - Has target date (in range): ${hasTargetDate}`);
          logger.info(`   - Has passed start (all before ${settings.startDate.toLocaleDateString()}): ${hasPassedStart}`);
          logger.info(`   - Has passed end (all after ${settings.endDate.toLocaleDateString()}): ${hasPassedEnd}`);
        }
        
        // Stop if we've gone too far back (all dates are before start date)
        // This is the correct stopping condition: stop when we find October dates while looking for November
        if (hasPassedStart) {
          logger.info(`🛑 STOPPING: All dates on page ${pageCount} are before start date (${settings.startDate.toLocaleDateString()})`);
          passedEndDate = true;
          break;
        }
        
        // IMPORTANT: Don't stop if we've passed end date on the FIRST page
        // We need to continue paginating backwards to find dates in range
        // Only stop if we've passed end date AND we've already collected some target dates AND we're not on page 1
        if (hasPassedEnd && !hasTargetDate && pageCount > 1) {
          logger.info(`🛑 STOPPING: All dates on page ${pageCount} are after end date (${settings.endDate.toLocaleDateString()}) and no target dates found`);
          passedEndDate = true;
          break;
        }
        
        if (hasPassedEnd && !hasTargetDate && pageCount === 1) {
          logger.info(`⚠️ Page 1 has all dates after end date, but continuing to paginate backwards to find dates in range...`);
        }

        // Try to go to next page
        if (logger) {
          logger.info(`➡️ Attempting to click Next Page button...`);
        }
        const clicked = await clickNextPage();
        if (!clicked) {
          logger.info(`🛑 No more pages available - reached end of pagination at page ${pageCount}`);
          break;
        }
        
        if (logger) {
          logger.info(`✅ Successfully clicked Next Page, waiting for page to load...`);
        }

        // Wait a bit for the page to load before collecting from next page
        const delay = CONST.PAGE_LOAD_DELAY_MS || 2000;
        await sleep(delay);
        if (logger) {
          logger.info(`⏳ Waited ${delay}ms, moving to next page...`);
        }
        pageCount++;
      }
      
      if (logger) {
        logger.info(`\n✅ Collection complete: ${allOrderLinks.length} total links from ${pageCount} page(s)`);
      }
    } else {
      // No date filtering - just collect from current page
      if (logger) {
        logger.info(`📋 No date filtering enabled, collecting from current page only`);
      }
      const pageOrderLinks = extractOrderLinks();
      allOrderLinks.push(...pageOrderLinks);
      pageCount = 1;
    }

    logger.info(`📊 Collected ${allOrderLinks.length} total order links from ${pageCount} page(s)`);
    return allOrderLinks;
  }

  // ============================================================================
  // FILTERING
  // ============================================================================

  function filterOrdersByDateRange(orderLinks) {
    // Limit orders in test mode
    let filteredLinks = CONFIG.TEST_MODE 
      ? orderLinks.slice(0, CONFIG.TEST_MODE_MAX_ORDERS)
      : orderLinks;
    
    if (CONFIG.TEST_MODE) {
      logger.info(`🧪 TEST MODE: Processing only ${filteredLinks.length} of ${orderLinks.length} orders`);
    }

    // Filter by date range if enabled
    if (dateFilter && dateFilter.isEnabled()) {
      filteredLinks = dateFilter.filterOrdersByDateRange(filteredLinks);
    } else if (dateFilterSettings && dateFilterSettings.enabled) {
      // Fallback
      logger.info(`Filtering ${filteredLinks.length} orders by date range`);
      filteredLinks = filteredLinks.filter(orderLink => {
        if (!orderLink.transactionDate) {
          logger.warn(`Order ${orderLink.orderId} has no transaction date. Including anyway.`);
          return true;
        }
        const transactionDateObj = {
          date: orderLink.transactionDate,
          year: orderLink.transactionDate.getFullYear(),
          month: orderLink.transactionDate.getMonth() + 1
        };
        return isDateInTargetRange(transactionDateObj);
      });
      logger.info(`Date filtering result: ${filteredLinks.length} of ${orderLinks.length} orders match`);
    }

    return filteredLinks;
  }

  // ============================================================================
  // MAIN EXPORT FUNCTION (Pipeline Pattern)
  // ============================================================================

  async function exportToCSV() {
    const buttonElement = button ? button.getElement() : document.getElementById('amazon-export-btn');
    if (!buttonElement) {
      logger.error('Export button not found');
      return;
    }

    const progress = ProgressIndicator ? new ProgressIndicator(buttonElement, button) : null;

    try {
      if (progress) {
        progress.setMessage('🔄 Exporting...');
        progress.setExporting(true);
      } else {
        buttonElement.textContent = '🔄 Exporting...';
        buttonElement.disabled = true;
      }

      // Step 1: Navigate to target date range if needed
      let settings = appState ? appState.getDateFilterSettings() : 
                     (dateFilter ? dateFilter.getSettings() : dateFilterSettings);
      
      // Ensure settings object exists and has csvFormat
      if (!settings) {
        settings = {};
      }
      if (!settings.csvFormat && appState) {
        settings.csvFormat = appState.getCSVFormat();
      } else if (!settings.csvFormat) {
        settings.csvFormat = 'simplifi'; // Default
      }
      
      // Log the settings being used
      if (settings) {
        const startDateStr = settings.startDate ? settings.startDate.toLocaleDateString() : 'N/A';
        const endDateStr = settings.endDate ? settings.endDate.toLocaleDateString() : 'N/A';
        logger.info(`🚀 Export Settings: Mode=${settings.mode}, Enabled=${settings.enabled}`);
        logger.info(`🚀 Target Date Range: ${startDateStr} to ${endDateStr}`);
      }
      
      if (settings && settings.enabled && settings.startDate) {
        const startDateStr = settings.startDate.toLocaleDateString();
        if (progress) {
          progress.setMessage(`🔄 Navigating to ${startDateStr}...`);
        } else {
          buttonElement.textContent = `🔄 Navigating to ${startDateStr}...`;
        }
        const foundTarget = await navigateToDateRange();
        if (!foundTarget) {
          alert(`Could not find transactions for the selected date range. Make sure you navigate to the correct page manually.`);
          if (progress) {
            progress.reset();
          } else {
            buttonElement.textContent = CONFIG.TEST_MODE ? 
              `🧪 Export Transactions (TEST MODE - First ${CONFIG.TEST_MODE_MAX_ORDERS} Only)` :
              '📥 Export All Transactions to CSV';
            buttonElement.disabled = false;
          }
          return;
        }
      }

      // Step 2: Collect all order links
      const allOrderLinks = await collectAllOrderLinks();
      
      const ordersWithDates = allOrderLinks.filter(link => link.transactionDate).length;
      const ordersWithoutDates = allOrderLinks.length - ordersWithDates;
      logger.info(`Orders with transaction dates: ${ordersWithDates}, Orders without dates: ${ordersWithoutDates}`);

      if (allOrderLinks.length === 0) {
        alert('No order links found. Make sure you are on the Amazon Transactions page.');
        if (progress) {
          progress.reset();
        } else {
          buttonElement.textContent = CONFIG.TEST_MODE ? 
            `🧪 Export Transactions (TEST MODE - First ${CONFIG.TEST_MODE_MAX_ORDERS} Only)` :
            '📥 Export All Transactions to CSV';
          buttonElement.disabled = false;
        }
        return;
      }

      // Step 3: Filter orders by date range and test mode
      const ordersToProcess = filterOrdersByDateRange(allOrderLinks);
      
      logger.info(`📋 After filtering: ${ordersToProcess.length} orders to process`);

      if (ordersToProcess.length === 0) {
        let errorMessage = 'Could not find any orders to process. ';
        if (settings && settings.enabled) {
          errorMessage += `No orders found in the selected date range. Please check the date range or try exporting the current page only.`;
        } else {
          errorMessage += 'Please try again.';
        }
        alert(errorMessage);
        if (progress) {
          progress.reset();
        } else {
          buttonElement.textContent = CONFIG.TEST_MODE ? 
            `🧪 Export Transactions (TEST MODE - First ${CONFIG.TEST_MODE_MAX_ORDERS} Only)` :
            '📥 Export All Transactions to CSV';
          buttonElement.disabled = false;
        }
        return;
      }

      // Step 4: Fetch order details (using Repository pattern)
      logger.info(`🔄 Starting to fetch order details for ${ordersToProcess.length} orders...`);
      
      // Ensure button is disabled and shows initial status
      buttonElement.disabled = true;
      if (progress) {
        progress.setMessage(`🔄 Fetching ${ordersToProcess.length} orders...`);
        progress.setExporting(true);
      } else if (button) {
        button.updateText({ isExporting: true, progress: { current: 0, total: ordersToProcess.length } });
        button.setDisabled(true);
      } else {
        buttonElement.textContent = `🔄 Fetching 0/${ordersToProcess.length} orders...`;
      }
      
      let orderDetails = [];
      if (orderRepository) {
        logger.info(`✅ Using OrderRepository to fetch order details`);
        orderDetails = await orderRepository.fetchMultipleOrders(
          ordersToProcess,
          (current, total) => {
            logger.info(`📊 Progress: ${current}/${total} orders fetched`);
            if (progress) {
              progress.update(current, total);
            } else if (button) {
              button.updateText({ isExporting: true, progress: { current, total } });
            } else {
              buttonElement.textContent = `🔄 Fetching order ${current}/${total}...`;
            }
          }
        );
        logger.info(`✅ Fetched ${orderDetails.length} order details`);
      } else {
        logger.warn(`⚠️ OrderRepository not available, using fallback`);
        // Fallback implementation - fetch orders directly
        const delayMs = CONFIG.TEST_MODE ? CONFIG.TEST_MODE_DELAY_MS : CONFIG.PRODUCTION_DELAY_MS;
        if (progress) {
          progress.setMessage(`🔄 Fetching ${ordersToProcess.length} orders...`);
        } else {
          buttonElement.textContent = `🔄 Fetching ${ordersToProcess.length} orders...`;
        }

        for (let i = 0; i < ordersToProcess.length; i++) {
          const orderLink = ordersToProcess[i];
          if (progress) {
            progress.update(i + 1, ordersToProcess.length);
          } else {
            buttonElement.textContent = `🔄 Fetching order ${i + 1}/${ordersToProcess.length}...`;
          }
          
          try {
            const response = await fetch(orderLink.url, {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              }
            });

            if (response.ok) {
              const html = await response.text();
              const OrderParserClass = window.AmazonExporterOrderDetailPageParser;
              const parserInstance = window.AmazonExporterOrderParser;
              if (OrderParserClass) {
                const orderParser = new OrderParserClass();
                const details = orderParser.parse(html, orderLink.orderId, orderLink.url, orderLink.transactionDate);
                if (details) {
                  orderDetails.push(details);
                }
              } else if (parserInstance) {
                const details = parserInstance.parse(html, orderLink.orderId, orderLink.url, orderLink.transactionDate);
                if (details) {
                  orderDetails.push(details);
                }
              } else {
                logger.warn('OrderDetailPageParser not available, skipping order');
              }
            }
          } catch (error) {
            logger.error(`Error fetching order ${orderLink.orderId}:`, error);
          }
          
          if (i < ordersToProcess.length - 1) {
            await sleep(delayMs);
          }
        }
      }

      if (orderDetails.length === 0) {
        let errorMessage = 'Could not fetch any order details. ';
        if (settings && settings.enabled) {
          errorMessage += `No orders found in the selected date range. Please check the date range or try exporting the current page only.`;
        } else {
          errorMessage += 'Please try again.';
        }
        alert(errorMessage);
        if (progress) {
          progress.reset();
        } else {
          buttonElement.textContent = CONFIG.TEST_MODE ? 
            `🧪 Export Transactions (TEST MODE - First ${CONFIG.TEST_MODE_MAX_ORDERS} Only)` :
            '📥 Export All Transactions to CSV';
          buttonElement.disabled = false;
        }
        return;
      }

      // Step 5: Convert to CSV and download (using CSVExporter)
      logger.info(`📄 Converting ${orderDetails.length} orders to CSV...`);
      
      // Get CSV format from settings
      const csvFormat = settings?.csvFormat || (appState ? appState.getCSVFormat() : 'simplifi');
      logger.info(`📄 Using CSV format: ${csvFormat}`);
      
      // Update status to show CSV generation
      if (progress) {
        progress.setMessage(`📄 Generating CSV file (${csvFormat} format)...`);
      } else if (button) {
        button.updateText({ customText: `📄 Generating CSV file (${csvFormat} format)...` });
      } else {
        buttonElement.textContent = `📄 Generating CSV file (${csvFormat} format)...`;
      }
      
      const formatSuffix = csvFormat === 'simplifi' ? 'simplifi' : 'detailed';
      // Generate date range string for filename
      const dateRangeStr = dateUtils ? dateUtils.getDateRangeStringForFilename(settings) : getDateString();
      const filename = CONFIG.TEST_MODE
        ? `amazon_orders_TEST_${formatSuffix}_${dateRangeStr}.csv`
        : `amazon_orders_${formatSuffix}_${dateRangeStr}.csv`;

      if (CSVExporter) {
        logger.info(`✅ Using CSVExporter to export CSV: ${filename} (format: ${csvFormat})`);
        CSVExporter.export(orderDetails, filename, csvFormat);
        logger.info(`✅ CSV export completed: ${filename}`);
      } else {
        logger.warn(`⚠️ CSVExporter not available, using fallback`);
        // Fallback
        const csvContent = convertToCSV(orderDetails);
        downloadCSV(csvContent, filename);
        logger.info(`✅ CSV download completed (fallback): ${filename}`);
      }

      // Step 6: Show success message
      if (progress) {
        progress.showSuccess(`✅ Exported ${orderDetails.length} orders!`);
      } else if (button) {
        button.updateText({ customText: `✅ Exported ${orderDetails.length} orders!` });
        setTimeout(() => {
          button.reset();
          button.setDisabled(false);
        }, 3000);
      } else {
        buttonElement.textContent = `✅ Exported ${orderDetails.length} orders!`;
        setTimeout(() => {
          buttonElement.textContent = CONFIG.TEST_MODE ? 
            `🧪 Export Transactions (TEST MODE - First ${CONFIG.TEST_MODE_MAX_ORDERS} Only)` :
            '📥 Export All Transactions to CSV';
          buttonElement.disabled = false;
        }, 3000);
      }

    } catch (error) {
      logger.error('Export error:', error);
      alert('Error exporting transactions: ' + error.message);
      if (progress) {
        progress.reset();
      } else {
        buttonElement.textContent = CONFIG.TEST_MODE ? 
          `🧪 Export Transactions (TEST MODE - First ${CONFIG.TEST_MODE_MAX_ORDERS} Only)` :
          '📥 Export All Transactions to CSV';
        buttonElement.disabled = false;
      }
    }
  }

  // ============================================================================
  // FALLBACK FUNCTIONS (for backward compatibility)
  // ============================================================================

  function convertToCSV(orders) {
    if (CSVExporter) {
      return CSVExporter.convertToCSV(orders);
    }
    // Fallback implementation
    if (orders.length === 0) return '';
    const isOrderDetails = orders[0].hasOwnProperty('transactionDate') || 
                          orders[0].hasOwnProperty('orderPlacedDate') || 
                          orders[0].hasOwnProperty('orderTotal');
    if (isOrderDetails) {
      const headers = ['Order Number', 'Transaction Date', 'Order Placed Date', 'Order Total', 'Refund Amount', 'Items', 'Payment Method', 'Status', 'Order URL'];
      const rows = orders.map(t => [
        escapeCSV(t.orderNumber || ''),
        escapeCSV(t.transactionDate || ''),
        escapeCSV(t.orderPlacedDate || ''),
        escapeCSV(t.orderTotal || ''),
        escapeCSV(t.refundAmount || ''),
        escapeCSV(t.items || ''),
        escapeCSV(t.paymentMethod || ''),
        escapeCSV(t.status || ''),
        escapeCSV(t.orderUrl || '')
      ]);
      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    } else {
      const headers = ['Order Number', 'Date', 'Total', 'Items', 'Status'];
      const rows = orders.map(t => [
        escapeCSV(t.orderNumber || ''),
        escapeCSV(t.date || ''),
        escapeCSV(t.total || ''),
        escapeCSV(t.items || ''),
        escapeCSV(t.status || '')
      ]);
      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }
  }

  function downloadCSV(content, filename) {
    if (CSVExporter) {
      CSVExporter.downloadCSV(content, filename);
    } else {
      // Fallback
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
  }

  // ============================================================================
  // PAGE OBSERVER (for SPAs)
  // ============================================================================

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
