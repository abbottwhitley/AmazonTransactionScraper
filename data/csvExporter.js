(function() {
  'use strict';

  /**
   * CSV export utilities
   */
  class CSVExporter {
    /**
     * Escapes a value for CSV format (handles commas, quotes, newlines)
     * @param {*} value - The value to escape
     * @returns {string} Escaped CSV value
     */
    static escapeCSV(value) {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }

    /**
     * Formats a date to MM/DD/YYYY format
     * @param {string|Date} date - Date string or Date object
     * @returns {string} Formatted date string
     */
    static formatDate(date) {
      if (!date) return '';
      
      let dateObj;
      if (date instanceof Date) {
        dateObj = date;
      } else if (typeof date === 'string') {
        // Try to parse the date string
        dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
          // If parsing fails, try to parse common formats
          // Handle MM/DD/YYYY format
          const parts = date.split('/');
          if (parts.length === 3) {
            dateObj = new Date(parseInt(parts[2], 10), parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
          } else {
            return date; // Return as-is if we can't parse it
          }
        }
      } else {
        return '';
      }
      
      if (isNaN(dateObj.getTime())) return '';
      
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const year = dateObj.getFullYear();
      return `${month}/${day}/${year}`;
    }

    /**
     * Parses a dollar amount string and returns negative numeric value
     * @param {string} amountStr - Amount string like "$123.45" or "-$123.45"
     * @returns {number} Negative numeric value (or 0 if invalid)
     */
    static parseAmount(amountStr) {
      if (!amountStr) return 0;
      
      // Remove currency symbols and commas
      const cleaned = String(amountStr).replace(/[$,\s]/g, '');
      
      // Parse as float
      const amount = parseFloat(cleaned);
      
      if (isNaN(amount)) return 0;
      
      // Always return negative (purchases are negative in budgeting apps)
      // If already negative, keep it; otherwise make it negative
      return amount < 0 ? amount : -Math.abs(amount);
    }

    /**
     * Formats items and order URL into notes field
     * @param {string|Array} items - Items string or array
     * @param {string} orderUrl - Order URL
     * @returns {string} Formatted notes
     */
    static formatNotes(items, orderUrl) {
      let notes = '';
      
      // Format items
      if (items) {
        if (Array.isArray(items)) {
          notes = items.join('; ');
        } else {
          notes = String(items);
        }
      }
      
      // Add order URL
      if (orderUrl) {
        if (notes) {
          notes += ' | ';
        }
        notes += orderUrl;
      }
      
      return notes;
    }

    /**
     * Converts an array of orders to CSV format
     * @param {Array} orders - Array of order objects
     * @param {string} format - Format type: 'simplifi' or 'detailed' (default: 'simplifi')
     * @returns {string} CSV content
     */
    static convertToCSV(orders, format = 'simplifi') {
      if (orders.length === 0) return '';

      if (format === 'simplifi') {
        return this.convertToSimplifiFormat(orders);
      } else {
        return this.convertToDetailedFormat(orders);
      }
    }

    /**
     * Converts orders to Simplifi budgeting app format
     * @param {Array} orders - Array of order objects
     * @returns {string} CSV content
     */
    static convertToSimplifiFormat(orders) {
      // Simplifi format: Date, Payee, Amount, Category, Tags, Notes, Check_No
      const headers = ['Date', 'Payee', 'Amount', 'Category', 'Tags', 'Notes', 'Check_No'];
      
      const rows = orders.map(order => {
        // Date: Transaction Date (MM/DD/YYYY format)
        const date = this.formatDate(order.transactionDate || order.date || '');
        
        // Payee: Always "Amazon"
        const payee = 'Amazon';
        
        // Amount: Order Total as negative number
        const amount = this.parseAmount(order.orderTotal || order.total || '0');
        
        // Category: Always "Shopping"
        const category = 'Shopping';
        
        // Tags: Blank
        const tags = '';
        
        // Notes: Items list + Order URL
        const notes = this.formatNotes(order.items, order.orderUrl || order.url || '');
        
        // Check_No: Blank
        const checkNo = '';
        
        return [
          this.escapeCSV(date),
          this.escapeCSV(payee),
          this.escapeCSV(amount),
          this.escapeCSV(category),
          this.escapeCSV(tags),
          this.escapeCSV(notes),
          this.escapeCSV(checkNo)
        ];
      });

      const csvRows = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ];

      return csvRows.join('\n');
    }

    /**
     * Converts orders to detailed format (original format with all fields)
     * @param {Array} orders - Array of order objects
     * @returns {string} CSV content
     */
    static convertToDetailedFormat(orders) {
      // Check if this is the new order details format or old transaction format
      const isOrderDetails = orders[0].hasOwnProperty('transactionDate') || 
                            orders[0].hasOwnProperty('orderPlacedDate') || 
                            orders[0].hasOwnProperty('orderTotal');

      if (isOrderDetails) {
        // New order details format
        const headers = ['Order Number', 'Transaction Date', 'Order Placed Date', 'Grand Total', 'Order Total', 'Refund Amount', 'Items', 'Category', 'Payment Method', 'Status', 'Order URL'];
        const rows = orders.map(t => [
          this.escapeCSV(t.orderNumber || ''),
          this.escapeCSV(t.transactionDate || ''), // Date from transactions page grouping
          this.escapeCSV(t.orderPlacedDate || ''), // Date from order details page
          this.escapeCSV(t.grandTotal || ''),
          this.escapeCSV(t.orderTotal || ''),
          this.escapeCSV(t.refundAmount || ''),
          this.escapeCSV(t.items || ''),
          this.escapeCSV(t.category || 'Shopping'),
          this.escapeCSV(t.paymentMethod || ''),
          this.escapeCSV(t.status || ''),
          this.escapeCSV(t.orderUrl || '')
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
          this.escapeCSV(t.orderNumber || ''),
          this.escapeCSV(t.date || ''),
          this.escapeCSV(t.total || ''),
          this.escapeCSV(t.items || ''),
          this.escapeCSV(t.status || '')
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
    static downloadCSV(content, filename) {
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

    /**
     * Exports orders to CSV and downloads
     * @param {Array} orders - Array of order objects
     * @param {string} filename - Filename for download
     * @param {string} format - Format type: 'simplifi' or 'detailed' (default: 'simplifi')
     */
    static export(orders, filename, format = 'simplifi') {
      const csvContent = this.convertToCSV(orders, format);
      this.downloadCSV(csvContent, filename);
    }
  }

  // Expose globally
  window.AmazonExporterCSVExporter = CSVExporter;

})();
