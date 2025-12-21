(function() {
  'use strict';

  /**
   * Tests for error handling utilities
   */
  function runErrorHandlingTests() {
    const tf = new TestFramework();
    const Result = window.AmazonExporterResult;
    const RetryHandler = window.AmazonExporterRetryHandler;
    const CircuitBreaker = window.AmazonExporterCircuitBreaker;

    if (!Result) {
      console.warn('Error handling utilities not available, skipping tests');
      return;
    }

    // Test Result.success
    tf.test('Result.success creates successful result', () => {
      const result = Result.success({ data: 'test' });
      tf.assertTrue(result.success, 'Result should be successful');
      tf.assertEquals(result.data.data, 'test', 'Data should match');
    });

    // Test Result.failure
    tf.test('Result.failure creates failed result', () => {
      const result = Result.failure('Test error');
      tf.assertFalse(result.success, 'Result should be failed');
      tf.assertEquals(result.error, 'Test error', 'Error message should match');
    });

    // Test Result.wrap with success
    tf.test('Result.wrap wraps successful function', () => {
      const fn = () => 'success';
      const result = Result.wrap(fn);
      tf.assertTrue(result.success, 'Should be successful');
      tf.assertEquals(result.data, 'success', 'Data should match');
    });

    // Test Result.wrap with failure
    tf.test('Result.wrap wraps failed function', () => {
      const fn = () => { throw new Error('Test error'); };
      const result = Result.wrap(fn);
      tf.assertFalse(result.success, 'Should be failed');
      tf.assertEquals(result.error, 'Test error', 'Error should match');
    });

    // Test CircuitBreaker
    if (CircuitBreaker) {
      tf.test('CircuitBreaker opens after threshold failures', async () => {
        const breaker = new CircuitBreaker({ threshold: 2, timeoutMs: 1000 });
        
        // Cause failures
        try {
          await breaker.execute(() => { throw new Error('Fail'); });
        } catch (e) {}
        
        try {
          await breaker.execute(() => { throw new Error('Fail'); });
        } catch (e) {}
        
        tf.assertEquals(breaker.getState(), 'OPEN', 'Circuit should be open');
      });
    }

    return tf.run();
  }

  // Expose globally
  window.runErrorHandlingTests = runErrorHandlingTests;

})();
