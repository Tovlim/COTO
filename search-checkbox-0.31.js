// Real-time Checkbox Group Filter for Finsweet List Filter 2025 - OPTIMIZED
// Add this script before the closing </body> tag

(function() {
  'use strict';
  
  // Configuration
  const CONFIG = {
    SELECTORS: {
      SEARCH_BOX: '[searchbox-filter]',
      CLEAR_BUTTON: '[clear-text-input]',
      CHECKBOX: '[checkbox-filter]',
      FORM_LABEL: '.w-form-label',
      LABEL: 'label',
      CHECKBOX_INPUT: 'input[type="checkbox"]'
    }
  };
  
  // Optimized cache with pre-processed data
  const cache = {
    searchBoxes: new Map(),
    clearButtons: new Map(),
    checkboxGroups: new Map(), // Now stores processed checkbox data
    eventListeners: new Map() // Track listeners for cleanup
  };
  
  // Pre-compiled utilities
  const utils = {
    normalizeText: (text) => text.toLowerCase().trim(),
    createInputEvent: () => new Event('input', { bubbles: true, cancelable: true })
  };
  
  // Static label extraction methods (created once)
  const labelExtractionMethods = [
    (element) => element.querySelector(CONFIG.SELECTORS.FORM_LABEL)?.textContent,
    (element) => element.querySelector(CONFIG.SELECTORS.LABEL)?.textContent,
    (element) => {
      const input = element.querySelector(CONFIG.SELECTORS.CHECKBOX_INPUT);
      if (!input) return null;
      
      const sibling = input.nextElementSibling;
      if (sibling?.tagName === 'LABEL') return sibling.textContent;
      
      if (input.id) return document.querySelector(`label[for="${input.id}"]`)?.textContent;
      return null;
    },
    (element) => element.textContent?.replace(/\s+/g, ' ')
  ];
  
  let isInitialized = false;
  
  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', initializeFilters);
  
  function initializeFilters() {
    setupElements();
    setupEventListeners();
    initializeGroups();
    isInitialized = true;
  }
  
  function setupElements() {
    // Clear existing cache
    cache.searchBoxes.clear();
    cache.clearButtons.clear();
    cache.checkboxGroups.clear();
    
    // Single DOM scan - much more efficient
    const allElements = document.querySelectorAll(`
      ${CONFIG.SELECTORS.SEARCH_BOX},
      ${CONFIG.SELECTORS.CLEAR_BUTTON},
      ${CONFIG.SELECTORS.CHECKBOX}
    `);
    
    // Group data for processing
    const tempData = {
      searchBoxes: [],
      clearButtons: [],
      checkboxes: {}
    };
    
    // Categorize elements in single pass
    allElements.forEach(element => {
      if (element.hasAttribute('searchbox-filter')) {
        tempData.searchBoxes.push(element);
      } else if (element.hasAttribute('clear-text-input')) {
        tempData.clearButtons.push(element);
      } else if (element.hasAttribute('checkbox-filter')) {
        const groupName = element.getAttribute('checkbox-filter');
        if (groupName) {
          if (!tempData.checkboxes[groupName]) {
            tempData.checkboxes[groupName] = [];
          }
          tempData.checkboxes[groupName].push(element);
        }
      }
    });
    
    // Process search boxes
    tempData.searchBoxes.forEach(element => {
      const groupName = element.getAttribute('searchbox-filter');
      if (groupName) {
        cache.searchBoxes.set(groupName, element);
      }
    });
    
    // Process clear buttons
    tempData.clearButtons.forEach(element => {
      const groupName = element.getAttribute('clear-text-input');
      if (groupName) {
        cache.clearButtons.set(groupName, element);
      }
    });
    
    // Process and cache checkbox data (pre-process text)
    Object.entries(tempData.checkboxes).forEach(([groupName, elements]) => {
      const processedElements = elements.map(element => ({
        element: element,
        labelText: extractLabelText(element),
        normalizedText: '', // Will be set below
        isVisible: true
      }));
      
      // Pre-normalize text for faster searching
      processedElements.forEach(item => {
        item.normalizedText = utils.normalizeText(item.labelText);
      });
      
      cache.checkboxGroups.set(groupName, processedElements);
    });
    
    console.log(`Optimized cache: ${cache.checkboxGroups.get('locality')?.length || 0} locality checkboxes processed`);
  }
  
  function extractLabelText(checkboxElement) {
    // Use pre-compiled methods for better performance
    for (const method of labelExtractionMethods) {
      const text = method(checkboxElement);
      if (text?.trim()) {
        return text.trim();
      }
    }
    return '';
  }
  
  function setupEventListeners() {
    // Clean up old event listeners first
    cleanupEventListeners();
    
    // Bind search box events
    cache.searchBoxes.forEach((searchBox, groupName) => {
      const handler = (e) => filterCheckboxGroup(groupName, e.target.value);
      searchBox.addEventListener('input', handler);
      
      // Track for cleanup
      if (!cache.eventListeners.has(groupName)) {
        cache.eventListeners.set(groupName, []);
      }
      cache.eventListeners.get(groupName).push({
        element: searchBox,
        event: 'input',
        handler: handler
      });
    });
    
    // Bind clear button events
    cache.clearButtons.forEach((clearButton, groupName) => {
      const handler = (e) => {
        e.preventDefault();
        clearTextInput(groupName);
      };
      clearButton.addEventListener('click', handler);
      
      // Track for cleanup
      if (!cache.eventListeners.has(groupName)) {
        cache.eventListeners.set(groupName, []);
      }
      cache.eventListeners.get(groupName).push({
        element: clearButton,
        event: 'click',
        handler: handler
      });
    });
  }
  
  function cleanupEventListeners() {
    cache.eventListeners.forEach((listeners) => {
      listeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });
    });
    cache.eventListeners.clear();
  }
  
  function initializeGroups() {
    // Initialize all groups to show all checkboxes
    cache.checkboxGroups.forEach((_, groupName) => {
      filterCheckboxGroup(groupName, '');
    });
  }
  
  function clearTextInput(groupName) {
    const searchInput = cache.searchBoxes.get(groupName);
    
    if (!searchInput) return;
    
    searchInput.value = '';
    
    const hasCheckboxes = cache.checkboxGroups.has(groupName);
    
    if (hasCheckboxes) {
      filterCheckboxGroup(groupName, '');
    } else {
      searchInput.dispatchEvent(utils.createInputEvent());
    }
    
    searchInput.focus();
  }
  
  function filterCheckboxGroup(groupName, searchTerm) {
    const checkboxData = cache.checkboxGroups.get(groupName);
    
    if (!checkboxData) return;
    
    const normalizedSearchTerm = utils.normalizeText(searchTerm);
    const showAll = normalizedSearchTerm === '';
    
    // Use requestAnimationFrame for better performance
    requestAnimationFrame(() => {
      // Batch DOM operations for better performance
      const elementsToShow = [];
      const elementsToHide = [];
      
      checkboxData.forEach(item => {
        let shouldShow = false;
        
        if (showAll) {
          shouldShow = true;
        } else {
          // Check if checkbox is checked (optimized)
          const isChecked = isCheckboxChecked(item.element);
          
          if (isChecked) {
            shouldShow = true; // Always show checked checkboxes
          } else {
            // Use pre-normalized text for faster matching
            shouldShow = item.normalizedText.includes(normalizedSearchTerm);
          }
        }
        
        // Track visibility changes for batching
        if (shouldShow && !item.isVisible) {
          elementsToShow.push(item);
          item.isVisible = true;
        } else if (!shouldShow && item.isVisible) {
          elementsToHide.push(item);
          item.isVisible = false;
        }
      });
      
      // Batch DOM updates
      elementsToShow.forEach(item => showElement(item.element));
      elementsToHide.forEach(item => hideElement(item.element));
    });
  }
  
  function isCheckboxChecked(checkboxElement) {
    // Optimized: check label class directly
    const label = checkboxElement.querySelector('label');
    return label?.classList.contains('is-list-active') || false;
  }
  
  function hideElement(element) {
    element.style.display = 'none';
    element.setAttribute('data-filtered', 'hidden');
  }
  
  function showElement(element) {
    element.style.display = '';
    element.removeAttribute('data-filtered');
  }
  
  // Optimized public API
  window.checkboxFilterScript = {
    recacheElements() {
      console.log('Re-caching checkbox filter elements (optimized)...');
      
      if (isInitialized) {
        // Only refresh data, don't re-setup event listeners
        setupElements();
        initializeGroups();
      } else {
        // Full initialization
        initializeFilters();
      }
    },
    
    filterGroup(groupName, searchTerm) {
      filterCheckboxGroup(groupName, searchTerm);
    },
    
    // New: get cache stats for debugging
    getCacheStats() {
      const stats = {};
      cache.checkboxGroups.forEach((data, groupName) => {
        stats[groupName] = {
          total: data.length,
          visible: data.filter(item => item.isVisible).length
        };
      });
      return stats;
    }
  };
  
})();
