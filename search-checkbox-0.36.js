// Real-time Checkbox Group Filter with Fuzzy Search - Production Ready
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
    },
    SCORE_THRESHOLD: 0.3 // Same threshold as autocomplete
  };
  
  // Optimized cache with pre-processed data
  const cache = {
    searchBoxes: new Map(),
    clearButtons: new Map(),
    checkboxGroups: new Map(),
    eventListeners: new Map()
  };
  
  // Pre-compiled utilities
  const utils = {
    normalizeText: (text) => text.toLowerCase().trim(),
    createInputEvent: () => new Event('input', { bubbles: true, cancelable: true })
  };
  
  // Static label extraction methods
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
    
    // Single DOM scan
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
    
    // Process and cache checkbox data with search tokens
    Object.entries(tempData.checkboxes).forEach(([groupName, elements]) => {
      const processedElements = elements.map(element => {
        const labelText = extractLabelText(element);
        return {
          element: element,
          labelText: labelText,
          normalizedText: utils.normalizeText(labelText),
          searchTokens: createSearchTokens(labelText),
          isVisible: true
        };
      });
      
      cache.checkboxGroups.set(groupName, processedElements);
    });
  }
  
  function extractLabelText(checkboxElement) {
    for (const method of labelExtractionMethods) {
      const text = method(checkboxElement);
      if (text?.trim()) {
        return text.trim();
      }
    }
    return '';
  }
  
  function createSearchTokens(text) {
    // Same token generation as autocomplete
    const tokens = text.toLowerCase().split(/\s+/);
    const ngrams = [];
    
    // Generate character n-grams for fuzzy matching
    for (let n = 2; n <= 3; n++) {
      for (let i = 0; i <= text.length - n; i++) {
        ngrams.push(text.toLowerCase().substr(i, n));
      }
    }
    
    return { tokens, ngrams };
  }
  
  function calculateMatchScore(searchLower, searchTokens, item) {
    let score = 0;
    
    // Exact match
    if (item.normalizedText === searchLower) {
      return 1.0;
    }
    
    // Starts with match (high score)
    if (item.normalizedText.startsWith(searchLower)) {
      score = 0.9;
    }
    // Contains match (medium score)
    else if (item.normalizedText.includes(searchLower)) {
      score = 0.7;
    }
    
    // Token-based matching for multi-word searches
    if (searchTokens.length > 1) {
      const matchedTokens = searchTokens.filter(token => 
        item.searchTokens.tokens.some(itemToken => itemToken.includes(token))
      );
      score = Math.max(score, matchedTokens.length / searchTokens.length * 0.8);
    }
    
    // Fuzzy matching using n-grams (exact same as autocomplete)
    if (score < 0.5) {
      const searchNgrams = new Set();
      for (let i = 0; i <= searchLower.length - 2; i++) {
        searchNgrams.add(searchLower.substr(i, 2));
      }
      
      let matches = 0;
      searchNgrams.forEach(ngram => {
        if (item.searchTokens.ngrams.includes(ngram)) matches++;
      });
      
      const fuzzyScore = matches / Math.max(searchNgrams.size, 1) * 0.6;
      score = Math.max(score, fuzzyScore);
    }
    
    return score;
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
      // Batch DOM operations
      const elementsToShow = [];
      const elementsToHide = [];
      
      if (showAll) {
        // Show all when search is empty
        checkboxData.forEach(item => {
          if (!item.isVisible) {
            elementsToShow.push(item);
            item.isVisible = true;
          }
        });
      } else {
        // Prepare search tokens for fuzzy matching
        const searchTokens = normalizedSearchTerm.split(/\s+/);
        
        checkboxData.forEach(item => {
          let shouldShow = false;
          
          // Check if checkbox is checked
          const isChecked = isCheckboxChecked(item.element);
          
          if (isChecked) {
            shouldShow = true; // Always show checked checkboxes
          } else {
            // Calculate match score using same algorithm as autocomplete
            const score = calculateMatchScore(normalizedSearchTerm, searchTokens, item);
            shouldShow = score > CONFIG.SCORE_THRESHOLD;
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
      }
      
      // Batch DOM updates
      elementsToShow.forEach(item => showElement(item.element));
      elementsToHide.forEach(item => hideElement(item.element));
    });
  }
  
  function isCheckboxChecked(checkboxElement) {
    // Method 1: Check for is-list-active class (Finsweet style)
    const label = checkboxElement.querySelector('label');
    if (label?.classList.contains('is-list-active')) {
      return true;
    }
    
    // Method 2: Check actual checkbox input state (standard HTML)
    const input = checkboxElement.querySelector('input[type="checkbox"]');
    if (input?.checked) {
      return true;
    }
    
    return false;
  }
  
  function hideElement(element) {
    element.style.display = 'none';
    element.setAttribute('data-filtered', 'hidden');
  }
  
  function showElement(element) {
    element.style.display = '';
    element.removeAttribute('data-filtered');
  }
  
  // Public API
  window.checkboxFilterScript = {
    recacheElements() {
      if (isInitialized) {
        setupElements();
        initializeGroups();
      } else {
        initializeFilters();
      }
    },
    
    filterGroup(groupName, searchTerm) {
      filterCheckboxGroup(groupName, searchTerm);
    },
    
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
