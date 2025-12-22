(function() {
  'use strict';

  /**
   * Export modal UI and interactions
   */
  class ExportModal {
    constructor() {
      this.overlay = null;
      this.modal = null;
      this.dateUtils = window.AmazonExporterDateUtils;
      this.appState = window.AmazonExporterAppState;
    }

    /**
     * Shows the export modal
     * @param {Function} onExport - Callback when export is confirmed
     * @param {Function} onCancel - Callback when modal is cancelled
     */
    show(onExport, onCancel) {
      // Remove existing modal if any
      const existingModal = document.getElementById('amazon-export-modal-overlay');
      if (existingModal) {
        existingModal.remove();
      }

      // Get current date filter settings
      let settings = this.appState ? this.appState.getDateFilterSettings() : null;
      
      // If no settings or invalid dates, use defaults
      if (!settings || !settings.startDate || !settings.endDate || 
          isNaN(settings.startDate.getTime()) || isNaN(settings.endDate.getTime())) {
        const now = new Date();
        settings = {
          mode: 'current-month',
          enabled: true,
          startDate: new Date(now.getFullYear(), now.getMonth(), 1),
          endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
        };
      }
      
      // Get CSV format preference from appState
      if (this.appState && !settings.csvFormat) {
        settings.csvFormat = this.appState.getCSVFormat();
      } else if (!settings.csvFormat) {
        settings.csvFormat = 'simplifi'; // Default
      }

      // Create modal overlay
      const overlay = document.createElement('div');
      overlay.id = 'amazon-export-modal-overlay';
      overlay.className = 'amazon-export-modal-overlay';
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.close();
          if (onCancel) onCancel();
        }
      });

      // Create modal content
      const modal = document.createElement('div');
      modal.className = 'amazon-export-modal';

      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const currentMonthStart = new Date(currentYear, currentMonth - 1, 1);
      const currentMonthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      
      const formatDate = this.dateUtils ? this.dateUtils.formatDateForInput : (date) => {
        if (!date) return '';
        const d = new Date(date);
        // Check if date is valid
        if (isNaN(d.getTime())) {
          return '';
        }
        // Use local date components to avoid timezone issues
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      modal.innerHTML = `
        <h2>Export Transactions</h2>
        
        <div class="form-group">
          <label>Export Options:</label>
          <div style="margin-top: 8px;">
            <div style="margin-bottom: 12px;">
              <input type="radio" id="export-current-month" name="export-mode" value="current-month" ${settings.mode === 'current-month' ? 'checked' : ''}>
              <label for="export-current-month" style="margin-left: 8px; font-weight: normal; cursor: pointer;">
                Current Month (${monthNames[currentMonth - 1]} ${currentYear})
              </label>
            </div>
            <div style="margin-bottom: 12px;">
              <input type="radio" id="export-current-page" name="export-mode" value="current-page" ${settings.mode === 'current-page' ? 'checked' : ''}>
              <label for="export-current-page" style="margin-left: 8px; font-weight: normal; cursor: pointer;">
                Current Page Only
              </label>
            </div>
            <div>
              <input type="radio" id="export-custom" name="export-mode" value="custom" ${settings.mode === 'custom' ? 'checked' : ''}>
              <label for="export-custom" style="margin-left: 8px; font-weight: normal; cursor: pointer;">
                Custom Date Range
              </label>
            </div>
          </div>
        </div>

        <div id="custom-date-options" style="display: ${settings.mode === 'custom' ? 'block' : 'none'};">
          <div class="quick-select">
            <div class="quick-select-label">Quick Select:</div>
            <div class="month-year-selectors">
              <select id="quick-month">
                <option value="">Select Month</option>
                ${monthNames.map((name, idx) => 
                  `<option value="${idx + 1}" ${idx + 1 === currentMonth && settings.mode === 'current-month' ? 'selected' : ''}>${name}</option>`
                ).join('')}
              </select>
              <select id="quick-year">
                ${Array.from({ length: 5 }, (_, i) => currentYear - i).map(year => 
                  `<option value="${year}" ${year === currentYear ? 'selected' : ''}>${year}</option>`
                ).join('')}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Custom Date Range:</label>
            <div class="date-inputs">
              <div>
                <label for="start-date" style="font-size: 12px; margin-bottom: 5px;">Start Date</label>
                <input type="date" id="start-date" value="${settings.startDate ? formatDate(settings.startDate) : formatDate(currentMonthStart)}">
              </div>
              <div>
                <label for="end-date" style="font-size: 12px; margin-bottom: 5px;">End Date</label>
                <input type="date" id="end-date" value="${settings.endDate ? formatDate(settings.endDate) : formatDate(currentMonthEnd)}">
              </div>
            </div>
          </div>
        </div>

        <div class="form-group" style="margin-top: 16px;">
          <label>CSV Format:</label>
          <div style="margin-top: 8px;">
            <div style="margin-bottom: 8px;">
              <input type="radio" id="csv-format-simplifi" name="csv-format" value="simplifi" ${(settings.csvFormat || 'simplifi') === 'simplifi' ? 'checked' : ''}>
              <label for="csv-format-simplifi" style="margin-left: 8px; font-weight: normal; cursor: pointer;">
                Simplifi Format (Budgeting App)
              </label>
            </div>
            <div>
              <input type="radio" id="csv-format-detailed" name="csv-format" value="detailed" ${settings.csvFormat === 'detailed' ? 'checked' : ''}>
              <label for="csv-format-detailed" style="margin-left: 8px; font-weight: normal; cursor: pointer;">
                Detailed Format (All Fields)
              </label>
            </div>
          </div>
        </div>

        <div class="button-group">
          <button class="btn-cancel" id="cancel-export">Cancel</button>
          <button class="btn-export" id="confirm-export">Export</button>
        </div>
      `;

      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      this.overlay = overlay;
      this.modal = modal;

      // Set up event handlers
      this.setupEventHandlers(onExport, onCancel, formatDate);
    }

    /**
     * Sets up event handlers for modal interactions
     * @param {Function} onExport - Export callback
     * @param {Function} onCancel - Cancel callback
     * @param {Function} formatDate - Date formatting function
     */
    setupEventHandlers(onExport, onCancel, formatDate) {
      // Helper to parse date string without timezone issues
      const parseDateInput = (dateString) => {
        if (!dateString) return null;
        // Date string is in YYYY-MM-DD format
        const parts = dateString.split('-');
        if (parts.length !== 3) return null;
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Convert to 0-indexed
        const day = parseInt(parts[2], 10);
        return new Date(year, month, day);
      };
      
      const exportModeRadios = document.querySelectorAll('input[name="export-mode"]');
      const customDateOptions = document.getElementById('custom-date-options');
      const quickMonth = document.getElementById('quick-month');
      const quickYear = document.getElementById('quick-year');
      const startDateInput = document.getElementById('start-date');
      const endDateInput = document.getElementById('end-date');
      const cancelBtn = document.getElementById('cancel-export');
      const exportBtn = document.getElementById('confirm-export');

      // Handle radio button changes
      exportModeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          const customOptions = document.getElementById('custom-date-options');
          if (e.target.value === 'custom') {
            customOptions.style.display = 'block';
          } else {
            customOptions.style.display = 'none';
          }
        });
      });

      // Quick select month/year
      if (quickMonth && quickYear) {
        const updateDates = () => {
          if (quickMonth.value && quickYear.value) {
            const year = parseInt(quickYear.value);
            const month = parseInt(quickMonth.value); // month is 1-indexed (1=Jan, 11=Nov, 12=Dec)
            // Start date: first day of the selected month
            const startDate = new Date(year, month - 1, 1); // month - 1 because JS months are 0-indexed
            // End date: last day of the selected month
            // new Date(year, month, 0) gives last day of (month-1) in 0-indexed
            // For November (month=11, which is month-1=10 in 0-indexed):
            // new Date(2025, 11, 0) = last day of month 10 (November) = Nov 30, 2025 ✓
            const endDate = new Date(year, month, 0, 23, 59, 59, 999);
            
            // Verify the calculation is correct
            if (endDate.getMonth() !== (month - 1)) {
              // If the end date's month doesn't match, recalculate
              // This handles edge cases
              const lastDay = new Date(year, month, 0).getDate();
              const endDateCorrected = new Date(year, month - 1, lastDay, 23, 59, 59, 999);
              if (this.logger) {
                this.logger.warn(`Date calculation correction: ${endDate.toLocaleDateString()} → ${endDateCorrected.toLocaleDateString()}`);
              }
              // Use corrected date
              const tempEnd = endDateCorrected;
              endDate.setTime(tempEnd.getTime());
            }
            
            // Validate the dates
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
              console.error('Invalid date calculation in Quick Select');
              return;
            }
            
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            if (this.logger) {
              this.logger.info(`📅 Quick select: Month=${month} (${monthNames[month - 1]}), Year=${year}`);
              this.logger.info(`📅 Calculated dates: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
            }
            
            startDateInput.value = formatDate(startDate);
            endDateInput.value = formatDate(endDate);
            
            if (this.logger) {
              this.logger.info(`📅 Set input values: Start=${startDateInput.value}, End=${endDateInput.value}`);
            }
          }
        };

        quickMonth.addEventListener('change', updateDates);
        quickYear.addEventListener('change', updateDates);
      }

      cancelBtn.addEventListener('click', () => {
        this.close();
        if (onCancel) onCancel();
      });

      exportBtn.addEventListener('click', () => {
        const selectedMode = document.querySelector('input[name="export-mode"]:checked')?.value;
        const selectedFormat = document.querySelector('input[name="csv-format"]:checked')?.value || 'simplifi';
        
        let mode = 'current-page';
        let enabled = false;
        let startDate = null;
        let endDate = null;

        if (selectedMode === 'current-month') {
          mode = 'current-month';
          enabled = true;
          const now = new Date();
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        } else if (selectedMode === 'custom') {
          mode = 'custom';
          enabled = true;
          const startValue = startDateInput.value;
          const endValue = endDateInput.value;

          if (!startValue || !endValue) {
            alert('Please select both start and end dates, or use the Quick Select month/year.');
            return;
          }

          // Parse dates from input values (YYYY-MM-DD format)
          // Use local date parsing to avoid timezone issues
          startDate = parseDateInput(startValue);
          endDate = parseDateInput(endValue);
          
          if (!startDate || !endDate) {
            alert('Invalid date values. Please select valid dates.');
            return;
          }
          
          // Set time components explicitly
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(23, 59, 59, 999);
          
          // Validate dates
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            alert('Invalid date values. Please select valid dates.');
            return;
          }

          if (startDate > endDate) {
            alert('Start date must be before or equal to end date.');
            return;
          }
          
          // Log the dates being set
          if (this.logger) {
            this.logger.info(`📅 Modal: Setting date range from input values:`);
            this.logger.info(`   Start input: ${startValue} → ${startDate.toLocaleDateString()}`);
            this.logger.info(`   End input: ${endValue} → ${endDate.toLocaleDateString()}`);
          }
        } else {
          mode = 'current-page';
          enabled = false;
        }

        const newSettings = {
          mode: mode,
          enabled: enabled,
          startDate: startDate,
          endDate: endDate,
          csvFormat: selectedFormat
        };
        
        // Log final settings
        if (this.logger && startDate && endDate) {
          this.logger.info(`📅 Modal: Final settings - ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}, Format: ${selectedFormat}`);
        }

        // Update app state if available
        if (this.appState) {
          this.appState.setDateFilterSettings(newSettings);
          this.appState.setCSVFormat(selectedFormat);
        }

        this.close();
        if (onExport) onExport(newSettings);
      });
    }

    /**
     * Closes the modal
     */
    close() {
      if (this.overlay) {
        this.overlay.remove();
        this.overlay = null;
        this.modal = null;
      }
    }
  }

  // Expose globally
  window.AmazonExporterModal = ExportModal;

})();
