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
      const settings = this.appState ? this.appState.getDateFilterSettings() : {
        mode: 'current-month',
        enabled: true,
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
      };

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
            const month = parseInt(quickMonth.value);
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59, 999);
            
            startDateInput.value = formatDate(startDate);
            endDateInput.value = formatDate(endDate);
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

          startDate = new Date(startValue);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(endValue);
          endDate.setHours(23, 59, 59, 999);

          if (startDate > endDate) {
            alert('Start date must be before or equal to end date.');
            return;
          }
        } else {
          mode = 'current-page';
          enabled = false;
        }

        const newSettings = {
          mode: mode,
          enabled: enabled,
          startDate: startDate,
          endDate: endDate
        };

        // Update app state if available
        if (this.appState) {
          this.appState.setDateFilterSettings(newSettings);
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
