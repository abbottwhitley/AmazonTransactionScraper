# Amazon Transaction Exporter Chrome Extension

A Chrome extension that scrapes Amazon transaction pages and exports detailed order information to CSV. The extension extracts order links from the transactions page, navigates to each order detail page, and collects comprehensive order data.

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

### Export Process

When you click "Export":
1. The extension extracts all order links from the transactions page(s)
2. Filters orders by the selected date range (using transaction grouping dates)
3. Navigates to each order detail page and extracts comprehensive data
4. Generates a CSV file with all order details
5. Downloads the CSV file automatically

**Note:** The export process may take several minutes depending on the number of orders, as it fetches data from each individual order detail page.

## CSV Export Format

The exported CSV file includes the following columns:

- **Order Number**: Amazon order ID (e.g., "113-2409867-7588258")
- **Transaction Date**: Date from the transactions page grouping (used for filtering)
- **Order Placed Date**: Date when the order was placed (from order details page)
- **Order Total**: Grand total amount (net amount after refunds)
- **Refund Amount**: Refund amount if applicable (empty if no refund)
- **Items**: Comma-separated list of product names
- **Payment Method**: Payment method used (e.g., "Visa ending in 1234")
- **Status**: Order status (e.g., "Delivered", "Shipped")
- **Order URL**: Direct link to the order detail page

### Date Filtering

The extension filters orders by the **Transaction Date** (the grouping date shown on the transactions page), not the "Order Placed" date. This ensures the filtering matches what you see on the transactions page. Both dates are included in the CSV for reference.

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
- ✅ **Robust Error Handling**: Continues processing even if individual orders fail
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
- `host_permissions`: To access Amazon.com domains for fetching order detail pages

## File Structure

```
AmazonTransactionScraper/
├── manifest.json         # Extension manifest file
├── content.js            # Main script (scraping, data extraction, export logic)
├── styles.css            # Button and modal styling
├── README.md             # This file
└── IMPROVEMENTS.md       # Architecture and refactoring recommendations
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

## Future Improvements

See `IMPROVEMENTS.md` for detailed architectural recommendations and potential enhancements including:
- Modular code structure
- Parallel request processing
- Caching and performance optimizations
- TypeScript migration
- Enhanced error handling and retry logic

