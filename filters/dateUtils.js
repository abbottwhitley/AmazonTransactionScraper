(function() {
  'use strict';

  /**
   * Date utility functions for parsing, normalization, and comparison
   * Separated from dateFilter.js for reusability
   */
  class DateUtils {
    /**
     * Normalizes a date to midnight (00:00:00) for consistent date comparisons
     * @param {Date} date - The date to normalize
     * @returns {Date} A new Date object with time set to midnight
     */
    static normalizeDate(date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d;
    }

    /**
     * Formats a date for HTML date input fields (YYYY-MM-DD)
     * @param {Date} date - The date to format
     * @returns {string} Formatted date string or empty string if invalid
     */
    static formatDateForInput(date) {
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
    static parseDateFromTransaction(dateString) {
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
     * Generates a date string in ISO format (YYYY-MM-DD) for filenames
     * @returns {string} Current date in ISO format
     */
    static getDateString() {
      const now = new Date();
      return now.toISOString().split('T')[0];
    }

    /**
     * Compares two dates (normalized) and returns comparison result
     * @param {Date} date1 - First date
     * @param {Date} date2 - Second date
     * @returns {number} -1 if date1 < date2, 0 if equal, 1 if date1 > date2
     */
    static compareDates(date1, date2) {
      const d1 = this.normalizeDate(date1);
      const d2 = this.normalizeDate(date2);
      if (d1 < d2) return -1;
      if (d1 > d2) return 1;
      return 0;
    }

    /**
     * Checks if a date is within a date range (inclusive)
     * @param {Date} date - Date to check
     * @param {Date} startDate - Range start date
     * @param {Date} endDate - Range end date
     * @returns {boolean} True if date is within range
     */
    static isDateInRange(date, startDate, endDate) {
      const normalized = this.normalizeDate(date);
      const start = this.normalizeDate(startDate);
      const end = this.normalizeDate(endDate);
      return normalized >= start && normalized <= end;
    }
  }

  // Expose globally
  window.AmazonExporterDateUtils = DateUtils;

})();
