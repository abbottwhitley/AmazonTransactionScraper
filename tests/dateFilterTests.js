(function() {
  'use strict';

  /**
   * Tests for DateFilter functionality
   */
  function runDateFilterTests() {
    const tf = new TestFramework();
    const DateFilter = window.AmazonExporterDateFilter?.constructor;

    if (!DateFilter) {
      console.warn('DateFilter not available, skipping tests');
      return;
    }

    // Test date normalization
    tf.test('DateFilter normalizes dates correctly', () => {
      const filter = new DateFilter();
      const date = new Date(2024, 5, 15, 14, 30, 45); // June 15, 2024, 2:30:45 PM
      const normalized = filter.normalizeDate(date);
      
      tf.assertEquals(normalized.getHours(), 0, 'Hours should be 0');
      tf.assertEquals(normalized.getMinutes(), 0, 'Minutes should be 0');
      tf.assertEquals(normalized.getSeconds(), 0, 'Seconds should be 0');
      tf.assertEquals(normalized.getDate(), 15, 'Date should be 15');
      tf.assertEquals(normalized.getMonth(), 5, 'Month should be June (5)');
    });

    // Test date range filtering
    tf.test('DateFilter filters orders by date range', () => {
      const filter = new DateFilter({
        mode: 'custom',
        enabled: true,
        startDate: new Date(2024, 0, 1), // Jan 1, 2024
        endDate: new Date(2024, 11, 31)   // Dec 31, 2024
      });

      const orders = [
        { orderId: '1', transactionDate: new Date(2024, 5, 15) },  // In range
        { orderId: '2', transactionDate: new Date(2023, 11, 31) }, // Before range
        { orderId: '3', transactionDate: new Date(2025, 0, 1) },   // After range
        { orderId: '4', transactionDate: new Date(2024, 0, 1) },   // Start boundary
        { orderId: '5', transactionDate: new Date(2024, 11, 31) }  // End boundary
      ];

      const filtered = filter.filterOrdersByDateRange(orders);
      tf.assertEquals(filtered.length, 3, 'Should filter to 3 orders (1, 4, 5)');
      tf.assertTrue(filtered.some(o => o.orderId === '1'), 'Should include order 1');
      tf.assertTrue(filtered.some(o => o.orderId === '4'), 'Should include order 4');
      tf.assertTrue(filtered.some(o => o.orderId === '5'), 'Should include order 5');
    });

    // Test disabled filtering
    tf.test('DateFilter returns all orders when disabled', () => {
      const filter = new DateFilter({
        mode: 'current-page',
        enabled: false
      });

      const orders = [
        { orderId: '1', transactionDate: new Date(2024, 5, 15) },
        { orderId: '2', transactionDate: new Date(2023, 11, 31) }
      ];

      const filtered = filter.filterOrdersByDateRange(orders);
      tf.assertEquals(filtered.length, 2, 'Should return all orders when disabled');
    });

    return tf.run();
  }

  // Expose globally
  window.runDateFilterTests = runDateFilterTests;

})();
