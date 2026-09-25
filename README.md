# Amazon Transaction Exporter Chrome Extension

A Chrome extension that scrapes Amazon transaction pages and exports detailed order information to CSV. The extension extracts order links from the transactions page, navigates to each order detail page, and collects comprehensive order data.

**Want this to run without clicking through it yourself?** See
[`automation/README.md`](automation/README.md) -- a Playwright script that
drives this same extension, unmodified, inside a real browser.

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the extension directory

## Usage

### Getting Started

1. Navigate to your Amazon Transactions page:
   - Go to Amazon.com and log in
   - Navigate to: https://www.amazon.com/cpe/yourpayments/transactions
   - The extension works on the Transactions page (not the standard Orders page)
2. You should see an "Export Transactions" button at the top of the page
3. Click the button to open the export modal

### Export Options

The extension provides three export modes:

1. **Current Month** (Default)
   - Exports all transactions from the current month
   - Automatically navigates through multiple pages to collect all orders
   - Uses quick month/year selectors for convenience

2. **Current Page Only**
   - Exports only the transactions visible on the current page
   - Faster option if you only need a subset of orders

3. **Custom Date Range**
   - Select a specific start and end date
   - Supports quick month/year selection or custom date inputs
   - Automatically navigates to the date range and collects all matching orders

### CSV Format Selection

The export modal includes a CSV format selector:

- **Simplifi Format** (Default): Optimized for budgeting apps like Simplifi
  - Simplified columns: Date, Payee, Amount, Category, Tags, Notes, Check_No
  - Amounts are negative (purchases)
  - Payee is always "Amazon"
  - Category is always "Shopping"
  
- **Detailed Format**: Comprehensive format with all order details
  - Includes all available fields: Order Number, Transaction Date, Order Placed Date, Order Total, Refund Amount, Items, Payment Method, Status, Order URL
  - Useful for detailed analysis or custom processing

Your format preference is saved and will be remembered for future exports.

### Export Process

When you click "Export":
1. The extension extracts all order links from the transactions page(s)
2. Filters orders by the selected date range (using transaction grouping dates)
3. Navigates to each order detail page and extracts comprehensive data
4. Generates a CSV file with all order details
5. Downloads the CSV file automatically

**Note:** The export process may take several minutes depending on the number of orders, as it fetches data from each individual order detail page.

## CSV Export Format

The extension supports two CSV export formats, which can be selected in the export modal:

### 1. Simplifi Format (Default)

Optimized for importing into Simplifi and other budgeting apps. Includes the following columns:

- **Date**: Transaction date in MM/DD/YYYY format (used for filtering)
- **Payee**: Always "Amazon"
- **Amount**: Order total as a negative number (purchases are negative in budgeting apps)
- **Category**: Always "Shopping"
- **Tags**: Blank (for manual tagging in your budgeting app)
- **Notes**: Items list (semicolon-separated) + Order URL (separated by ` | `)
- **Check_No**: Blank

**Example:**
```csv
Date,Payee,Amount,Category,Tags,Notes,Check_No
11/21/2025,Amazon,-123.45,Shopping,,"Item 1; Item 2 | https://amazon.com/...",
```

### 2. Detailed Format

Comprehensive format with all available order information. Includes the following columns:

- **Order Number**: Amazon order ID (e.g., "113-2409867-7588258")
- **Transaction Date**: Date from the transactions page grouping (used for filtering)
- **Order Placed Date**: Date when the order was placed (from order details page)
- **Grand Total**: Grand total amount from the order details page (before refunds)
- **Order Total**: Net amount after refunds (grand total - refund amount)
- **Refund Amount**: Refund amount if applicable (empty if no refund)
- **Items**: Semicolon-separated list of product names
- **Category**: Automatically categorized purchase category (e.g., "Groceries", "Baby Supplies", "Shopping")
- **Payment Method**: Payment method used (e.g., "Prime Visa ending in 9291")
- **Status**: Order status (e.g., "Delivered", "Shipped")
- **Order URL**: Direct link to the order detail page

**Note:** Categories are automatically assigned based on item names using keyword matching. Items that don't match specific categories default to "Shopping". Categories can be customized by editing `data/categoryRules.js`.

**Note:** 
- Your CSV format preference is saved and will be remembered for future exports.
- CSV files are automatically named using the date range of the export (e.g., `amazon_orders_detailed_2024-01-01_to_2024-01-31.csv`). For current page exports, today's date is used. For current month exports, the date range spans from the start of the month to today.

### Date Filtering

The extension filters orders by the **Transaction Date** (the grouping date shown on the transactions page), not the "Order Placed" date. This ensures the filtering matches what you see on the transactions page. In the Detailed format, both dates are included in the CSV for reference.

## Configuration

### Test Mode

The extension includes a test/debugging mode that can be enabled by editing `content.js`:

```javascript
const CONFIG = {
  TEST_MODE: true,              // Set to false for production
  TEST_MODE_MAX_ORDERS: 20,     // Limit number of orders in test mode
  TEST_MODE_DELAY_MS: 1000,     // Delay between requests in test mode (ms)
  PRODUCTION_DELAY_MS: 1000     // Delay between requests in production (ms)
};
```

**Test Mode Features:**
- Processes only the first N orders (configurable)
- Adds a "🧪 TEST MODE" indicator to the button
- Prefixes exported CSV filename with "TEST_"
- Useful for testing without processing hundreds of orders

## Features

- ✅ **Comprehensive Data Extraction**: Extracts detailed information from individual order detail pages
- ✅ **Smart Date Filtering**: Filter by transaction date with flexible date range options
- ✅ **Automatic Pagination**: Automatically navigates through multiple pages to collect all orders
- ✅ **Net Total Calculation**: Calculates order totals after refunds
- ✅ **Robust Error Handling**: Advanced error handling with retry logic, circuit breaker pattern, and structured error results
- ✅ **Progress Indicators**: Shows progress during export (current order X of Y)
- ✅ **Clean CSV Export**: Properly formatted CSV with escaping for special characters
- ✅ **Test Mode**: Built-in testing mode for development and debugging

## Supported Pages

The extension currently works on:
- `https://*.amazon.com/*/cpe/yourpayments/transactions*` (Primary - Transactions page)

It also loads on (but may not fully function):
- `https://*.amazon.com/*/gp/css/order-history*`
- `https://*.amazon.com/*/your-orders*`
- `https://*.amazon.com/your-orders*`

## Permissions

- `activeTab`: To access the current Amazon page
- `downloads`: To download the CSV file
- `storage`: To persist user preferences (date filter settings and CSV format preference)
- `host_permissions`: To access Amazon.com domains for fetching order detail pages

## File Structure

```
AmazonTransactionScraper/
├── manifest.json              # Extension manifest file (required at root)
├── content.js                 # Main orchestrator (initialization and coordination)
├── styles.css                 # Button and modal styling
├── README.md                  # This file
├── IMPROVEMENTS.md            # Architecture and refactoring recommendations
├── core/                      # Core infrastructure modules
│   ├── logger.js              # Structured logging utility
│   ├── constants.js           # Centralized selectors, patterns, and constants
│   ├── config.js             # Configuration and constants (combines CONFIG + constants)
│   ├── state.js               # State management (AppState with event system and Chrome storage)
│   └── errorHandling.js       # Error handling utilities (Result pattern, retry, circuit breaker)
├── ui/                        # UI modules
│   ├── button.js              # Button creation & event handling
│   ├── modal.js               # Export modal UI & interactions
│   └── progress.js            # Progress indicators & status updates
├── scrapers/                  # Scraper modules (Strategy pattern)
│   ├── transactionPage.js     # Extract order links from transactions page
│   ├── orderDetailPage.js     # Fetch & parse individual order pages (Repository pattern)
│   └── pagination.js          # Handle pagination & navigation
├── filters/                   # Filter modules
│   ├── dateFilter.js          # Date range filtering logic
│   └── dateUtils.js           # Date parsing, normalization, comparison utilities
├── data/                      # Data modules
│   ├── csvExporter.js         # CSV conversion & download
│   ├── orderModel.js          # Order data structure definitions
│   └── categoryRules.js       # Category classification rules and utilities
└── tests/                     # Test framework and test suites
    ├── testFramework.js       # Simple test framework
    ├── dateFilterTests.js     # Date filter unit tests
    ├── utilityTests.js        # Utility function tests
    ├── errorHandlingTests.js  # Error handling tests
    └── runAllTests.js         # Test runner
```

## Development

### Making Changes

1. Make changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Reload the Amazon transactions page to see changes

### Debugging

- Open Chrome DevTools (F12) to see console logs
- The extension logs detailed information about:
  - Order link extraction
  - Date filtering decisions
  - Order detail fetching progress
  - Any errors encountered
- Use Test Mode to limit processing during development

### Testing

The extension includes a test framework for validating functionality. Tests run in the browser console on any Amazon page where the extension is active.

#### Running Tests

**Method 1: Browser Console (Recommended)**

1. Navigate to any Amazon page where the extension is active (e.g., `https://www.amazon.com/cpe/yourpayments/transactions`)
2. Open Chrome DevTools (F12 or Right-click → Inspect)
3. Go to the **Console** tab
4. Run one of the following commands:

```javascript
// Run all test suites
await runAllTests();

// Run specific test suites
await runDateFilterTests();
await runErrorHandlingTests();
await runUtilityTests();
```

**Method 2: Auto-run on Page Load**

1. Add `?runTests=true` to the URL (e.g., `https://www.amazon.com/cpe/yourpayments/transactions?runTests=true`)
2. Tests will automatically run when the page loads (only if `TEST_MODE` is enabled in `core/config.js`)

#### Test Framework Features

- **Simple assertion methods:**
  - `assert(condition, message)` - Assert a condition is true
  - `assertEquals(actual, expected, message)` - Assert two values are equal
  - `assertTrue(value, message)` - Assert a value is truthy
  - `assertFalse(value, message)` - Assert a value is falsy
- **Async test support** - Tests can be async functions
- **Detailed results** - Test results show passed/failed counts and error messages
- **Grouped output** - Tests are grouped by suite in the console

#### Available Test Suites

- **Date Filter Tests** (`runDateFilterTests()`) - Tests date normalization and filtering logic
- **Error Handling Tests** (`runErrorHandlingTests()`) - Tests Result pattern, retry logic, and circuit breaker
  - **Note:** The circuit breaker test intentionally triggers failures, so you may see error messages in the console. This is expected behavior.
- **Utility Tests** (`runUtilityTests()`) - Placeholder for utility function tests

#### Troubleshooting Test Errors

**"Could not establish connection" errors:**
- These errors are typically from other Chrome extensions, not this extension
- To identify the source, check the stack trace in the error message
- You can disable other extensions temporarily to isolate the issue

**Circuit breaker errors during tests:**
- The error handling tests intentionally trigger failures to verify the circuit breaker pattern works correctly
- Seeing `[ERROR] Circuit breaker OPENED after 2 failures` is expected and indicates the test is working

## Troubleshooting

### Button doesn't appear
- Verify you're on the Transactions page: `https://www.amazon.com/cpe/yourpayments/transactions`
- Check browser console (F12) for errors
- Make sure the extension is enabled in `chrome://extensions/`

### Export returns "No orders found"
- If using date filtering, verify the date range includes transactions
- Try "Current Page Only" mode to test if the extension can extract orders
- Check console logs to see if order links are being extracted

### Extension stops working
- Amazon frequently updates their page structure
- Check console for selector errors
- You may need to update selectors in `content.js` to match Amazon's current HTML structure
- See `IMPROVEMENTS.md` for recommendations on making selectors more robust

### Export takes too long
- The extension fetches each order detail page individually (by design for accuracy)
- Use Test Mode to limit the number of orders processed
- Consider using "Current Page Only" for smaller exports
- Check `CONFIG.PRODUCTION_DELAY_MS` - reducing delay speeds up exports but may trigger rate limiting

### Date filtering not working correctly
- Ensure you're using the Transactions page (not Orders page)
- Check console logs - the extension logs date extraction and filtering decisions
- Transaction dates are extracted from the page grouping headers
- If dates aren't being extracted, the extension will warn in the console

## Limitations

- **Rate Limiting**: The extension includes delays between requests to avoid triggering Amazon's rate limiting. Processing hundreds of orders may take 10+ minutes.
- **Amazon Page Changes**: Amazon frequently updates their page structure. The extension may need updates if selectors break.
- **Browser Compatibility**: Designed for Chrome/Chromium browsers. Other browsers not tested.
- **Single Account**: Only exports data from the currently logged-in Amazon account.

## Architecture

The extension follows a modular architecture with separation of concerns and design patterns:

### Design Patterns Implemented

- **Strategy Pattern**: Pluggable scrapers for different page types (`TransactionPageScraper`, `OrderHistoryPageScraper`)
- **Repository Pattern**: Abstracted data access layer (`OrderRepository`) for fetching order details
- **State Management**: Centralized state with event system (`AppState`) and Chrome storage persistence
- **Pipeline Pattern**: Export process broken into discrete, chainable operations
- **Error Handling**: Result pattern, exponential backoff retry logic, and circuit breaker for resilience

### Module Organization

- **UI Modules**: Button, modal, and progress indicator handling
- **Scraper Modules**: Page-specific scraping logic with Strategy pattern
- **Filter Modules**: Date filtering and utility functions
- **Data Modules**: CSV export and order data models
- **Core Modules**: Logging, configuration, state management, error handling
- **Testing**: Built-in test framework for validation

## Future Improvements

See `IMPROVEMENTS.md` for detailed architectural recommendations and potential enhancements including:
- Further modularization (UI, scrapers, data modules)
- Parallel request processing
- Caching and performance optimizations
- TypeScript migration

