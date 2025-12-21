(function() {
  'use strict';

  /**
   * Runs all test suites
   */
  async function runAllTests() {
    console.log('🚀 Starting Test Suite...\n');

    const results = {
      dateFilter: null,
      utility: null,
      errorHandling: null
    };

    // Run date filter tests
    if (window.runDateFilterTests) {
      console.group('📅 Date Filter Tests');
      results.dateFilter = await window.runDateFilterTests();
      console.groupEnd();
    }

    // Run utility tests
    if (window.runUtilityTests) {
      console.group('🔧 Utility Tests');
      results.utility = await window.runUtilityTests();
      console.groupEnd();
    }

    // Run error handling tests
    if (window.runErrorHandlingTests) {
      console.group('⚠️ Error Handling Tests');
      results.errorHandling = await window.runErrorHandlingTests();
      console.groupEnd();
    }

    // Summary
    console.log('\n📊 Test Summary:');
    let totalPassed = 0;
    let totalFailed = 0;
    let totalTests = 0;

    Object.values(results).forEach(result => {
      if (result) {
        totalPassed += result.passed;
        totalFailed += result.failed;
        totalTests += result.total;
      }
    });

    console.log(`Total: ${totalTests} tests, ${totalPassed} passed, ${totalFailed} failed`);

    return results;
  }

  // Expose globally
  window.runAllTests = runAllTests;

  // Auto-run if in test mode (can be triggered from console)
  if (window.CONFIG?.TEST_MODE && window.location.search.includes('runTests=true')) {
    runAllTests();
  }

})();
