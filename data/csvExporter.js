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
     * Converts an array of orders to CSV format
     * @param {Array} orders - Array of order objects
     * @returns {string} CSV content
     */
    static convertToCSV(orders) {
      if (orders.length === 0) return '';

      // Check if this is the new order details format or old transaction format
      const isOrderDetails = orders[0].hasOwnProperty('transactionDate') || 
                            orders[0].hasOwnProperty('orderPlacedDate') || 
                            orders[0].hasOwnProperty('orderTotal');

      if (isOrderDetails) {
        // New order details format
        const headers = ['Order Number', 'Transaction Date', 'Order Placed Date', 'Order Total', 'Refund Amount', 'Items', 'Payment Method', 'Status', 'Order URL'];
        const rows = orders.map(t => [
          this.escapeCSV(t.orderNumber || ''),
          this.escapeCSV(t.transactionDate || ''), // Date from transactions page grouping
          this.escapeCSV(t.orderPlacedDate || ''), // Date from order details page
          this.escapeCSV(t.orderTotal || ''),
          this.escapeCSV(t.refundAmount || ''),
          this.escapeCSV(t.items || ''),
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
     */
    static export(orders, filename) {
      const csvContent = this.convertToCSV(orders);
      this.downloadCSV(csvContent, filename);
    }
  }

  // Expose globally
  window.AmazonExporterCSVExporter = CSVExporter;

})();
