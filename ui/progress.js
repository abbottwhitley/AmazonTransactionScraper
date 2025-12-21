(function() {
  'use strict';

  /**
   * Progress indicators and status updates
   */
  class ProgressIndicator {
    constructor(button) {
      this.button = button;
      this.appState = window.AmazonExporterAppState;
    }

    /**
     * Updates progress on the button
     * @param {number} current - Current item number
     * @param {number} total - Total items
     */
    update(current, total) {
      if (this.button) {
        const buttonText = window.AmazonExporterButton ? 
          new window.AmazonExporterButton().getButtonText({ 
            isExporting: true, 
            progress: { current, total } 
          }) :
          `🔄 Fetching order ${current}/${total}...`;
        
        this.button.textContent = buttonText;
      }

      // Update app state if available
      if (this.appState) {
        this.appState.setProgress({ current, total });
      }
    }

    /**
     * Sets initial progress message
     * @param {string} message - Progress message
     */
    setMessage(message) {
      if (this.button) {
        const buttonText = window.AmazonExporterButton ? 
          new window.AmazonExporterButton().getButtonText({ customText: message }) :
          message;
        this.button.textContent = buttonText;
      }
    }

    /**
     * Sets exporting state
     * @param {boolean} isExporting - Whether export is in progress
     */
    setExporting(isExporting) {
      if (this.button) {
        this.button.disabled = isExporting;
      }

      if (this.appState) {
        this.appState.setExporting(isExporting);
      }
    }

    /**
     * Shows success message
     * @param {string} message - Success message
     * @param {number} durationMs - How long to show message (default: 3000ms)
     */
    showSuccess(message, durationMs = 3000) {
      if (this.button) {
        const buttonText = window.AmazonExporterButton ? 
          new window.AmazonExporterButton().getButtonText({ customText: message }) :
          message;
        this.button.textContent = buttonText;
        
        setTimeout(() => {
          this.reset();
        }, durationMs);
      }
    }

    /**
     * Resets progress indicator
     */
    reset() {
      if (this.button && window.AmazonExporterButton) {
        const button = new window.AmazonExporterButton();
        button.button = this.button;
        button.reset();
      } else if (this.button) {
        this.button.textContent = '📥 Export All Transactions to CSV';
        this.button.disabled = false;
      }

      if (this.appState) {
        this.appState.setExporting(false);
        this.appState.setProgress({ current: 0, total: 0 });
      }
    }
  }

  // Expose globally
  window.AmazonExporterProgress = ProgressIndicator;

})();
