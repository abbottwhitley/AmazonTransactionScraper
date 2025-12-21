(function() {
  'use strict';

  /**
   * Button creation and event handling
   */
  class ExportButton {
    constructor() {
      this.button = null;
      this.config = window.CONFIG || {};
    }

    /**
     * Gets the appropriate button text based on current state
     * @param {Object} options - Button state options
     * @param {boolean} options.isExporting - Whether export is in progress
     * @param {Object} options.progress - Progress object with current and total
     * @param {string} options.customText - Custom text to display
     * @returns {string} Button text
     */
    getButtonText(options = {}) {
      const { isExporting = false, progress = null, customText = null } = options;
      
      if (customText) {
        return customText;
      }
      
      if (isExporting && progress) {
        return `🔄 Fetching order ${progress.current}/${progress.total}...`;
      }
      
      if (this.config.TEST_MODE) {
        return `🧪 Export Transactions (TEST MODE - First ${this.config.TEST_MODE_MAX_ORDERS || 20} Only)`;
      }
      
      return '📥 Export All Transactions to CSV';
    }

    /**
     * Creates and returns the export button element
     * @param {Function} onClickHandler - Click event handler
     * @returns {HTMLElement} Button element
     */
    create(onClickHandler) {
      // Check if button already exists
      const existingButton = document.getElementById('amazon-export-btn');
      if (existingButton) {
        return existingButton;
      }

      const button = document.createElement('button');
      button.id = 'amazon-export-btn';
      button.className = 'amazon-export-button';
      button.textContent = this.getButtonText();
      
      if (onClickHandler) {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          onClickHandler();
        });
      }

      this.button = button;
      return button;
    }

    /**
     * Updates button text
     * @param {Object} options - Button state options
     */
    updateText(options = {}) {
      if (this.button) {
        this.button.textContent = this.getButtonText(options);
      }
    }

    /**
     * Sets button disabled state
     * @param {boolean} disabled - Whether button should be disabled
     */
    setDisabled(disabled) {
      if (this.button) {
        this.button.disabled = disabled;
      }
    }

    /**
     * Resets the button to its default state
     */
    reset() {
      if (this.button) {
        this.button.textContent = this.getButtonText();
        this.button.disabled = false;
      }
    }

    /**
     * Gets the button element
     * @returns {HTMLElement|null} Button element
     */
    getElement() {
      return this.button || document.getElementById('amazon-export-btn');
    }
  }

  // Expose globally
  window.AmazonExporterButton = ExportButton;

})();
