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
    FUZZY: {
      enabled: true,
      threshold: 0.3, // Minimum score to show result (0-1)
      useNgrams: true, // Use character n-grams for better fuzzy matching
      ngramSize: 2, // Size of n-grams (2-3 recommended)
      prioritizeStartsWith: true, // Give higher score to items that start with search
      prioritizeWordBoundaries: true // Give higher score to word boundary matches
    }
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
    createInputEvent: () => new Event('input', { bubbles: true, cancelable: true }),
    
    // Generate n-grams for fuzzy matching
    generateNgrams: (text, size = CONFIG.FUZZY.ngramSize) => {
      const ngrams = new Set();
      const normalized = text.toLowerCase();
      
      for (let i = 0; i <= normalized.length - size; i++) {
        ngrams.add(normalized.substr(i, size));
      }
      
      return ngrams;
    },
    
    // Calculate fuzzy match score
    calculateFuzzyScore: (searchTerm, targetText, targetData) => {
      const searchLower = searchTerm.toLowerCase();
      const targetLower = targetText.toLowerCase();
      
      // Exact match
      if (targetLower === searchLower) {
        return 1.0;
      }
      
      // Starts with match (high priority)
      if (CONFIG.FUZZY.prioritizeStartsWith && targetLower.startsWith(searchLower)) {
        return 0.9;
      }
      
      // Contains exact match
      if (targetLower.includes(searchLower)) {
        // Score based on position (earlier = better)
        const position = targetLower.indexOf(searchLower);
        const positionScore = 1 - (position / targetLower.length);
        return 0.7 + (positionScore * 0.1);
      }
      
      // Word boundary matching
      if (CONFIG.FUZZY.prioritizeWordBoundaries) {
        const words = targetData.words || targetLower.split(/\s+/);
        const searchWords = searchLower.split(/\s+/);
        
        // Check if any word starts with search term
        for (const word of words) {
          if (word.startsWith(searchLower)) {
            return 0.75;
          }
        }
        
        // Multi-word search matching
        if (searchWords.length > 1) {
          let matchedWords = 0;
          for (const searchWord of searchWords) {
            if (words.some(word => word.includes(searchWord))) {
              matchedWords++;
            }
          }
          if (matchedWords > 0) {
            return (matchedWords / searchWords.length) * 0.65;
          }
        }
      }
      
      // N-gram based fuzzy matching
      if (CONFIG.FUZZY.useNgrams && targetData.ngrams) {
        const searchNgrams = utils.generateNgrams(searchLower);
        const targetNgrams = targetData.ngrams;
        
        let matches = 0;
        searchNgrams.forEach(ngram => {
          if (targetNgrams.has(ngram)) {
            matches++;
          }
        });
        
        if (matches > 0) {
          const score = matches / Math.max(searchNgrams.size, targetNgrams.size);
          return score * 0.6;
        }
      }
      
      // Levenshtein distance as fallback (simplified version)
      if (searchLower.length > 2) {
        const distance = utils.levenshteinDistance(searchLower, targetLower);
        const maxLen = Math.max(searchLower.length, targetLower.length);
        const similarity = 1 - (distance / maxLen);
        
        if (similarity > 0.5) {
          return similarity * 0.5;
        }
      }
      
      return 0;
    },
    
    // Simplified Levenshtein distance
    levenshteinDistance: (a, b) => {
      const matrix = [];
      
      for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
      }
      
      for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
      }
      
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
          }
        }
      }
      
      return matrix[b.length][a.length];
    }
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
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFilters);
  } else {
    initializeFilters();
  }
  
  function initializeFilters() {
    setupElements();
    setupEventListeners();
    initializeGroups();
    isInitialized = true;
    
    console.log('Fuzzy checkbox filter initialized with config:', CONFIG.FUZZY);
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
    
    // Process and cache checkbox data with fuzzy search preparation
    Object.entries(tempData.checkboxes).forEach(([groupName, elements]) => {
      const processedElements = elements.map(element => {
        const labelText = extractLabelText(element);
        const normalizedText = utils.normalizeText(labelText);
        
        return {
          element: element,
          labelText: labelText,
          normalizedText: normalizedText,
          words: normalizedText.split(/\s+/), // Pre-split words
          ngrams: CONFIG.FUZZY.useNgrams ? utils.generateNgrams(normalizedText) : null,
          isVisible: true,
          score: 0 // For fuzzy matching
        };
      });
      
      cache.checkboxGroups.set(groupName, processedElements);
    });
    
    console.log(`Cache built: ${cache.checkboxGroups.size} groups with fuzzy search data`);
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
  
  function setupEventListeners() {
    // Clean up old event listeners first
    cleanupEventListeners();
    
    // Bind search box events with debouncing for fuzzy search
    cache.searchBoxes.forEach((searchBox, groupName) => {
      let debounceTimer;
      const handler = (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          filterCheckboxGroup(groupName, e.target.value);
        }, 150); // Small debounce for fuzzy search performance
      };
      
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
      const elementsToShow = [];
      const elementsToHide = [];
      
      if (showAll) {
        // Show all elements
        checkboxData.forEach(item => {
          if (!item.isVisible) {
            elementsToShow.push(item);
            item.isVisible = true;
          }
          item.score = 0; // Reset scores
        });
      } else {
        // Calculate fuzzy scores for all items
        checkboxData.forEach(item => {
          // Always show checked checkboxes
          if (isCheckboxChecked(item.element)) {
            item.score = 1.0;
          } else if (CONFIG.FUZZY.enabled) {
            // Use fuzzy matching
            item.score = utils.calculateFuzzyScore(
              normalizedSearchTerm,
              item.labelText,
              item
            );
          } else {
            // Simple contains matching (fallback)
            item.score = item.normalizedText.includes(normalizedSearchTerm) ? 1.0 : 0;
          }
        });
        
        // Filter based on threshold and update visibility
        checkboxData.forEach(item => {
          const shouldShow = item.score >= CONFIG.FUZZY.threshold;
          
          if (shouldShow && !item.isVisible) {
            elementsToShow.push(item);
            item.isVisible = true;
          } else if (!shouldShow && item.isVisible) {
            elementsToHide.push(item);
            item.isVisible = false;
          }
        });
        
        // Optional: Sort visible items by score (best matches first)
        if (CONFIG.FUZZY.enabled) {
          const visibleItems = checkboxData.filter(item => item.isVisible);
          visibleItems.sort((a, b) => b.score - a.score);
          
          // Reorder DOM elements based on score
          visibleItems.forEach(item => {
            item.element.style.order = Math.round((1 - item.score) * 1000);
          });
        }
      }
      
      // Batch DOM updates
      elementsToShow.forEach(item => showElement(item.element));
      elementsToHide.forEach(item => hideElement(item.element));
      
      // Log results for debugging
      if (!showAll && CONFIG.FUZZY.enabled) {
        const shown = checkboxData.filter(item => item.isVisible).length;
        const total = checkboxData.length;
        console.log(`Fuzzy filter "${searchTerm}" in ${groupName}: ${shown}/${total} matches`);
      }
    });
  }
  
  function isCheckboxChecked(checkboxElement) {
    // Check if checkbox is checked (Finsweet uses 'is-list-active' class)
    const label = checkboxElement.querySelector('label');
    if (label?.classList.contains('is-list-active')) {
      return true;
    }
    
    // Fallback: check actual input
    const input = checkboxElement.querySelector('input[type="checkbox"]');
    return input?.checked || false;
  }
  
  function hideElement(element) {
    element.style.display = 'none';
    element.setAttribute('data-filtered', 'hidden');
  }
  
  function showElement(element) {
    element.style.display = '';
    element.style.order = ''; // Reset order
    element.removeAttribute('data-filtered');
  }
  
  // Enhanced public API
  window.checkboxFilterScript = {
    recacheElements() {
      console.log('Re-caching checkbox filter elements with fuzzy search...');
      
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
          visible: data.filter(item => item.isVisible).length,
          withScores: data.filter(item => item.score > 0).length
        };
      });
      return stats;
    },
    
    // Configure fuzzy search settings
    setFuzzyConfig(config) {
      Object.assign(CONFIG.FUZZY, config);
      console.log('Fuzzy config updated:', CONFIG.FUZZY);
    },
    
    // Get current fuzzy config
    getFuzzyConfig() {
      return { ...CONFIG.FUZZY };
    },
    
    // Test fuzzy matching
    testFuzzyMatch(searchTerm, targetText) {
      const data = {
        normalizedText: utils.normalizeText(targetText),
        words: utils.normalizeText(targetText).split(/\s+/),
        ngrams: utils.generateNgrams(utils.normalizeText(targetText))
      };
      
      const score = utils.calculateFuzzyScore(searchTerm, targetText, data);
      
      return {
        searchTerm,
        targetText,
        score,
        wouldShow: score >= CONFIG.FUZZY.threshold
      };
    }
  };
  
  console.log('✨ Fuzzy Checkbox Filter Ready - use checkboxFilterScript API to configure');
  
})();
