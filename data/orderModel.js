(function() {
  'use strict';

  /**
   * Order data structure definitions and utilities
   */
  class OrderModel {
    /**
     * Creates an empty order details object
     * @returns {Object} Order details object with default values
     */
    static createEmpty() {
      return {
        orderNumber: '',
        orderUrl: '',
        transactionDate: '', // Date from transactions page grouping
        orderPlacedDate: '', // Date from order details page (when order was placed)
        grandTotal: '', // Grand total from order details page (before refunds)
        orderTotal: '', // Net amount after refunds
        refundAmount: '',
        paymentMethod: '',
        items: [],
        itemPrices: [], // parallel to items -- one price string (or null) per item
        itemAsins: [], // parallel to items -- one ASIN (or null) per item
        category: '', // Category based on item categorization
        status: ''
      };
    }

    /**
     * Creates an order link object
     * @param {string} orderId - Order ID
     * @param {string} url - Order URL
     * @param {Date} transactionDate - Transaction date
     * @param {string} text - Link text
     * @returns {Object} Order link object
     */
    static createOrderLink(orderId, url, transactionDate = null, text = '') {
      return {
        orderId: orderId,
        url: url,
        text: text || `Order #${orderId}`,
        transactionDate: transactionDate
      };
    }

    /**
     * Validates an order details object
     * @param {Object} order - Order details object
     * @returns {boolean} True if order is valid
     */
    static isValid(order) {
      return order && 
             typeof order.orderNumber === 'string' && 
             order.orderNumber.length > 0;
    }

    /**
     * Normalizes order details (ensures all fields exist)
     * @param {Object} order - Order details object
     * @returns {Object} Normalized order details
     */
    static normalize(order) {
      const normalized = this.createEmpty();
      return {
        ...normalized,
        ...order,
        items: Array.isArray(order.items) ? order.items : (order.items ? [order.items] : []),
        itemPrices: Array.isArray(order.itemPrices) ? order.itemPrices : (order.itemPrices ? [order.itemPrices] : []),
        itemAsins: Array.isArray(order.itemAsins) ? order.itemAsins : (order.itemAsins ? [order.itemAsins] : [])
      };
    }
  }

  // Expose globally
  window.AmazonExporterOrderModel = OrderModel;

})();
