(function() {
  'use strict';

  /**
   * AppState class - Centralized state management with event system
   * Implements Observer pattern for state changes
   */
  class AppState {
    constructor() {
      this.observers = [];
      this.dateFilterSettings = null;
      this.isExporting = false;
      this.currentProgress = { current: 0, total: 0 };
      this.initialized = false;
    }

    /**
     * Initializes state from Chrome storage or defaults
     * @returns {Promise<void>}
     */
    async initialize() {
      if (this.initialized) return;

      try {
        // Try to load from Chrome storage
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          const result = await chrome.storage.local.get('dateFilterSettings');
          if (result.dateFilterSettings) {
            this.dateFilterSettings = result.dateFilterSettings;
            // Convert date strings back to Date objects
            if (this.dateFilterSettings.startDate) {
              this.dateFilterSettings.startDate = new Date(this.dateFilterSettings.startDate);
            }
            if (this.dateFilterSettings.endDate) {
              this.dateFilterSettings.endDate = new Date(this.dateFilterSettings.endDate);
            }
          }
        }
      } catch (error) {
        if (window.AmazonExporterLogger) {
          window.AmazonExporterLogger.warn('Failed to load state from storage:', error);
        }
      }

      // Use default if nothing loaded
      if (!this.dateFilterSettings) {
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        
        this.dateFilterSettings = {
          mode: 'current-month',
          enabled: true,
          startDate: startDate,
          endDate: endDate
        };
      }

      this.initialized = true;
      this.notify('initialized', this.dateFilterSettings);
    }

    /**
     * Sets date filter settings and persists to storage
     * @param {Object} settings - Date filter settings
     * @returns {Promise<void>}
     */
    async setDateFilterSettings(settings) {
      this.dateFilterSettings = { ...settings };
      this.notify('dateFilterSettings', settings);
      
      // Persist to Chrome storage
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          await chrome.storage.local.set({ dateFilterSettings: settings });
        }
      } catch (error) {
        if (window.AmazonExporterLogger) {
          window.AmazonExporterLogger.warn('Failed to save state to storage:', error);
        }
      }
    }

    /**
     * Gets current date filter settings
     * @returns {Object} Date filter settings
     */
    getDateFilterSettings() {
      return { ...this.dateFilterSettings };
    }

    /**
     * Sets exporting state
     * @param {boolean} isExporting - Whether export is in progress
     */
    setExporting(isExporting) {
      this.isExporting = isExporting;
      this.notify('exporting', isExporting);
    }

    /**
     * Updates export progress
     * @param {Object} progress - Progress object with current and total
     */
    setProgress(progress) {
      this.currentProgress = { ...progress };
      this.notify('progress', progress);
    }

    /**
     * Subscribes to state changes
     * @param {Function} callback - Callback function(event, data)
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {
      this.observers.push(callback);
      
      // Return unsubscribe function
      return () => {
        const index = this.observers.indexOf(callback);
        if (index > -1) {
          this.observers.splice(index, 1);
        }
      };
    }

    /**
     * Notifies all observers of a state change
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    notify(event, data) {
      this.observers.forEach(callback => {
        try {
          callback(event, data);
        } catch (error) {
          if (window.AmazonExporterLogger) {
            window.AmazonExporterLogger.error('Error in state observer:', error);
          }
        }
      });
    }

    /**
     * Gets current state snapshot
     * @returns {Object} Current state
     */
    getState() {
      return {
        dateFilterSettings: this.getDateFilterSettings(),
        isExporting: this.isExporting,
        currentProgress: { ...this.currentProgress }
      };
    }
  }

  // Create singleton instance and expose globally
  window.AmazonExporterAppState = new AppState();

  // Auto-initialize if Chrome storage is available
  if (typeof chrome !== 'undefined' && chrome.storage) {
    window.AmazonExporterAppState.initialize();
  }

})();
