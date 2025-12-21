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
      if (!this.settings.enabled) {
        return orderLinks;
      }

      // Check if we have any orders with transaction dates
      const ordersWithDates = orderLinks.filter(link => link.transactionDate).length;
      if (ordersWithDates === 0 && orderLinks.length > 0) {
        if (window.AmazonExporterLogger) {
          window.AmazonExporterLogger.warn('WARNING: Date filtering is enabled but no transaction dates were extracted for any orders.');
          window.AmazonExporterLogger.warn('This might indicate an issue with date extraction. Proceeding without date filtering to avoid excluding all orders.');
        }
        return orderLinks;
      }

      const filteredLinks = orderLinks.filter(orderLink => {
        if (!orderLink.transactionDate) {
          if (window.AmazonExporterLogger) {
            window.AmazonExporterLogger.warn(`Order ${orderLink.orderId} has no transaction date extracted. Including order anyway.`);
          }
          return true;
        }
        
        const inRange = this.isDateInRange(orderLink.transactionDate);
        if (inRange && window.AmazonExporterLogger) {
          window.AmazonExporterLogger.debug(`Order ${orderLink.orderId} with date ${orderLink.transactionDate.toLocaleDateString()} is IN date range`);
        } else if (window.AmazonExporterLogger) {
          window.AmazonExporterLogger.debug(`Order ${orderLink.orderId} with date ${orderLink.transactionDate.toLocaleDateString()} is OUT of date range, filtering out`);
        }
        return inRange;
      });

      if (window.AmazonExporterLogger) {
        window.AmazonExporterLogger.info(`Date filtering result: ${filteredLinks.length} of ${orderLinks.length} orders match the date range`);
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
