(function() {
  'use strict';

  /**
   * Simple test framework for Chrome extension
   * Runs tests in the browser console
   */
  class TestFramework {
    constructor() {
      this.tests = [];
      this.results = [];
    }

    /**
     * Registers a test
     * @param {string} name - Test name
     * @param {Function} fn - Test function (can be async)
     */
    test(name, fn) {
      this.tests.push({ name, fn });
    }

    /**
     * Asserts that a condition is true
     * @param {boolean} condition - Condition to check
     * @param {string} message - Error message if assertion fails
     */
    assert(condition, message = 'Assertion failed') {
      if (!condition) {
        throw new Error(message);
      }
    }

    /**
     * Asserts that two values are equal
     * @param {*} actual - Actual value
     * @param {*} expected - Expected value
     * @param {string} message - Error message if assertion fails
     */
    assertEquals(actual, expected, message = `Expected ${expected}, got ${actual}`) {
      if (actual !== expected) {
        throw new Error(message);
      }
    }

    /**
     * Asserts that a value is truthy
     * @param {*} value - Value to check
     * @param {string} message - Error message if assertion fails
     */
    assertTrue(value, message = 'Expected truthy value') {
      if (!value) {
        throw new Error(message);
      }
    }

    /**
     * Asserts that a value is falsy
     * @param {*} value - Value to check
     * @param {string} message - Error message if assertion fails
     */
    assertFalse(value, message = 'Expected falsy value') {
      if (value) {
        throw new Error(message);
      }
    }

    /**
     * Runs all registered tests
     * @returns {Promise<Object>} Test results
     */
    async run() {
      this.results = [];
      let passed = 0;
      let failed = 0;

      console.group('🧪 Running Tests');
      
      for (const test of this.tests) {
        try {
          await test.fn();
          this.results.push({ name: test.name, status: 'PASSED' });
          passed++;
          console.log(`✅ ${test.name}`);
        } catch (error) {
          this.results.push({ name: test.name, status: 'FAILED', error: error.message });
          failed++;
          console.error(`❌ ${test.name}: ${error.message}`);
        }
      }

      console.groupEnd();
      console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${this.tests.length} tests`);

      return {
        total: this.tests.length,
        passed,
        failed,
        results: this.results
      };
    }
  }

  // Expose globally
  window.TestFramework = TestFramework;

})();
