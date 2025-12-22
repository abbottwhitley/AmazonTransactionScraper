(function() {
  'use strict';

  /**
   * DateFilter class - Consolidates all date-related filtering logic
   * @class DateFilter
   */
  class DateFilter {
    /**
     * Creates a new DateFilter instance
     * @param {Object} settings - Date filter settings
     * @param {string} settings.mode - Filter mode: 'current-month', 'current-page', 'custom'
     * @param {boolean} settings.enabled - Whether filtering is enabled
     * @param {Date} settings.startDate - Start date for filtering
     * @param {Date} settings.endDate - End date for filtering
     */
    constructor(settings = null) {
      this.settings = settings || this.getDefaultSettings();
    }

    /**
     * Gets default date filter settings (current month)
     * @returns {Object} Default settings object
     */
    getDefaultSettings() {
      const now = new Date();
      const startDate = this.normalizeDate(new Date(now.getFullYear(), now.getMonth(), 1));
      const endDate = this.normalizeDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      return {
        mode: 'current-month', // 'current-month', 'current-page', 'custom'
        enabled: true,
        startDate: startDate,
        endDate: endDate
      };
    }

    /**
     * Normalizes a date to midnight (00:00:00) for consistent date comparisons
     * @param {Date} date - The date to normalize
     * @returns {Date} A new Date object with time set to midnight
     */
    normalizeDate(date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d;
    }

    /**
     * Updates the filter settings
     * @param {Object} settings - New settings object
     */
    updateSettings(settings) {
      this.settings = { ...this.settings, ...settings };
      // Normalize dates if provided
      if (this.settings.startDate) {
        this.settings.startDate = this.normalizeDate(this.settings.startDate);
      }
      if (this.settings.endDate) {
        this.settings.endDate = this.normalizeDate(this.settings.endDate);
      }
    }

    /**
     * Checks if a parsed date is within the target date range
     * @param {Object} parsedDate - Parsed date object with date, year, month properties
     * @returns {boolean} True if date is in range or filtering is disabled
     */
    isDateInTargetRange(parsedDate) {
      if (!this.settings.enabled || !parsedDate || !this.settings.startDate || !this.settings.endDate) {
        return true;
      }
      const transDateOnly = this.normalizeDate(parsedDate.date);
      const startDateOnly = this.normalizeDate(this.settings.startDate);
      const endDateOnly = this.normalizeDate(this.settings.endDate);
      
      return transDateOnly >= startDateOnly && transDateOnly <= endDateOnly;
    }

    /**
     * Checks if a date object is within the target date range
     * @param {Date} date - Date to check
     * @returns {boolean} True if date is in range or filtering is disabled
     */
    isDateInRange(date) {
      if (!this.settings.enabled || !date || !this.settings.startDate || !this.settings.endDate) {
        return true;
      }
      const dateOnly = this.normalizeDate(date);
      const startDateOnly = this.normalizeDate(this.settings.startDate);
      const endDateOnly = this.normalizeDate(this.settings.endDate);
      
      return dateOnly >= startDateOnly && dateOnly <= endDateOnly;
    }

    /**
     * Checks if a parsed date is before the target start date
     * @param {Object} parsedDate - Parsed date object
     * @returns {boolean} True if date is before start date
     */
    hasPassedTargetMonth(parsedDate) {
      if (!this.settings.enabled || !parsedDate || !this.settings.startDate) return false;
      const transDateOnly = this.normalizeDate(parsedDate.date);
      const startDateOnly = this.normalizeDate(this.settings.startDate);
      return transDateOnly < startDateOnly;
    }

    /**
     * Checks if we should continue collecting (date is <= end date)
     * @param {Object} parsedDate - Parsed date object
     * @returns {boolean} True if date is within or before end date
     */
    shouldContinueCollecting(parsedDate) {
      if (!this.settings.enabled || !parsedDate || !this.settings.endDate) return true;
      const transDateOnly = this.normalizeDate(parsedDate.date);
      const endDateOnly = this.normalizeDate(this.settings.endDate);
      return transDateOnly <= endDateOnly;
    }

    /**
     * Filters an array of order links by date range
     * @param {Array} orderLinks - Array of order link objects with transactionDate property
     * @returns {Array} Filtered array of order links
     */
    filterOrdersByDateRange(orderLinks) {
      const logger = window.AmazonExporterLogger;
      
      if (!this.settings.enabled) {
        if (logger) {
          logger.info('Date filtering is disabled, returning all orders');
        }
        return orderLinks;
      }

      // Log the filter settings being used
      if (logger) {
        const startDateStr = this.settings.startDate ? this.settings.startDate.toLocaleDateString() : 'N/A';
        const endDateStr = this.settings.endDate ? this.settings.endDate.toLocaleDateString() : 'N/A';
        logger.info(`🔍 Date Filter Settings: Mode=${this.settings.mode}, Enabled=${this.settings.enabled}`);
        logger.info(`🔍 Date Range: ${startDateStr} to ${endDateStr}`);
      }

      // Check if we have any orders with transaction dates
      const ordersWithDates = orderLinks.filter(link => link.transactionDate).length;
      if (ordersWithDates === 0 && orderLinks.length > 0) {
        if (logger) {
          logger.warn('WARNING: Date filtering is enabled but no transaction dates were extracted for any orders.');
          logger.warn('This might indicate an issue with date extraction. Proceeding without date filtering to avoid excluding all orders.');
        }
        return orderLinks;
      }

      if (logger) {
        logger.info(`📊 Filtering ${orderLinks.length} orders (${ordersWithDates} with dates, ${orderLinks.length - ordersWithDates} without dates)`);
      }

      const filteredLinks = [];
      const excludedLinks = [];
      
      orderLinks.forEach(orderLink => {
        if (!orderLink.transactionDate) {
          if (logger) {
            logger.warn(`⚠️ Order ${orderLink.orderId} has no transaction date extracted. Including order anyway.`);
          }
          filteredLinks.push(orderLink);
          return;
        }
        
        const orderDateStr = orderLink.transactionDate.toLocaleDateString();
        const inRange = this.isDateInRange(orderLink.transactionDate);
        
        if (inRange) {
          if (logger) {
            logger.info(`✅ Order ${orderLink.orderId} with date ${orderDateStr} is IN date range`);
          }
          filteredLinks.push(orderLink);
        } else {
          if (logger) {
            logger.info(`❌ Order ${orderLink.orderId} with date ${orderDateStr} is OUT of date range, filtering out`);
          }
          excludedLinks.push({ orderId: orderLink.orderId, date: orderDateStr });
        }
      });

      if (logger) {
        logger.info(`📊 Date filtering result: ${filteredLinks.length} of ${orderLinks.length} orders match the date range`);
        if (excludedLinks.length > 0) {
          logger.info(`📋 Excluded ${excludedLinks.length} orders outside date range:`);
          excludedLinks.slice(0, 10).forEach(item => {
            logger.info(`   - Order ${item.orderId}: ${item.date}`);
          });
          if (excludedLinks.length > 10) {
            logger.info(`   ... and ${excludedLinks.length - 10} more`);
          }
        }
      }

      return filteredLinks;
    }

    /**
     * Gets the current settings
     * @returns {Object} Current settings object
     */
    getSettings() {
      return { ...this.settings };
    }

    /**
     * Checks if filtering is enabled
     * @returns {boolean} True if filtering is enabled
     */
    isEnabled() {
      return this.settings.enabled;
    }
  }

  // Create default DateFilter instance and expose it globally
  window.AmazonExporterDateFilter = new DateFilter();

})();
