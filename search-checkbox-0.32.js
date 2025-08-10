// Real-time Checkbox Group Filter with HYBRID FUZZY SEARCH - Optimized for Webflow
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
    // Fuzzy search configuration
    FUZZY: {
      MIN_RESULTS_THRESHOLD: 3, // If simple search returns fewer than this, try fuzzy
      MIN_SEARCH_LENGTH: 2,     // Minimum characters before fuzzy activates
      SCORE_THRESHOLD: 0.4,      // Minimum score to show in fuzzy results
      NGRAM_SIZE: 2,            // Size of n-grams (2 = bigrams)
      MAX_ITEMS_FOR_FUZZY: 500  // Disable fuzzy if group has more items than this
    }
  };
  
  // Optimized cache with pre-processed data
  const cache = {
    searchBoxes: new Map(),
    clearButtons: new Map(),
    checkboxGroups: new Map(), // Stores processed checkbox data with fuzzy tokens
    eventListeners: new Map(), // Track listeners for cleanup
    fuzzyEnabled: new Map()    // Track which groups should use fuzzy search
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
    cache.fuzzyEnabled.clear();
    
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
    
    // Process and cache checkbox data with fuzzy search tokens
    Object.entries(tempData.checkboxes).forEach(([groupName, elements]) => {
      const processedElements = elements.map(element => ({
        element: element,
        labelText: extractLabelText(element),
        normalizedText: '', // Will be set below
        searchTokens: null, // Will be set if fuzzy is enabled
        isVisible: true
      }));
      
      // Pre-normalize text for faster searching
      processedElements.forEach(item => {
        item.normalizedText = utils.normalizeText(item.labelText);
      });
      
      // Only create fuzzy search tokens if group is small enough
      const enableFuzzy = processedElements.length <= CONFIG.FUZZY.MAX_ITEMS_FOR_FUZZY;
      cache.fuzzyEnabled.set(groupName, enableFuzzy);
      
      if (enableFuzzy) {
        // Pre-compute fuzzy search tokens
        processedElements.forEach(item => {
          item.searchTokens = createSearchTokens(item.labelText);
        });
        console.log(`Fuzzy search enabled for ${groupName} (${processedElements.length} items)`);
      } else {
        console.log(`Fuzzy search disabled for ${groupName} (${processedElements.length} items - too many)`);
      }
      
      cache.checkboxGroups.set(groupName, processedElements);
    });
    
    console.log(`Hybrid filter initialized: ${cache.checkboxGroups.size} groups`);
  }
  
  function createSearchTokens(text) {
    const normalized = text.toLowerCase();
    const tokens = normalized.split(/\s+/);
    const ngrams = new Set();
    
    // Generate character n-grams for fuzzy matching
    const ngramSize = CONFIG.FUZZY.NGRAM_SIZE;
    for (let i = 0; i <= normalized.length - ngramSize; i++) {
      ngrams.add(normalized.substr(i, ngramSize));
    }
    
    // Also add word start bigrams for better matching
    tokens.forEach(token => {
      if (token.length >= ngramSize) {
        ngrams.add(token.substr(0, ngramSize));
      }
    });
    
    return {
      tokens: tokens,
      ngrams: Array.from(ngrams),
      normalized: normalized
    };
  }
  
  function calculateFuzzyScore(searchText, item) {
    if (!item.searchTokens) return 0;
    
    const searchLower = searchText.toLowerCase();
    const searchTokens = searchLower.split(/\s+/);
    
    let score = 0;
    
    // Exact match
    if (item.searchTokens.normalized === searchLower) {
      return 1.0;
    }
    
    // Starts with match (high score)
    if (item.searchTokens.normalized.startsWith(searchLower)) {
      score = 0.85;
    }
    // Contains match (medium score)
    else if (item.searchTokens.normalized.includes(searchLower)) {
      score = 0.7;
    }
    
    // Token-based matching for multi-word searches
    if (searchTokens.length > 1 && score < 0.7) {
      const matchedTokens = searchTokens.filter(searchToken => 
        item.searchTokens.tokens.some(itemToken => 
          itemToken.startsWith(searchToken) || searchToken.startsWith(itemToken)
        )
      );
      const tokenScore = matchedTokens.length / searchTokens.length * 0.75;
      score = Math.max(score, tokenScore);
    }
    
    // N-gram fuzzy matching (for typos)
    if (score < CONFIG.FUZZY.SCORE_THRESHOLD && searchLower.length >= CONFIG.FUZZY.NGRAM_SIZE) {
      const searchNgrams = new Set();
      for (let i = 0; i <= searchLower.length - CONFIG.FUZZY.NGRAM_SIZE; i++) {
        searchNgrams.add(searchLower.substr(i, CONFIG.FUZZY.NGRAM_SIZE));
      }
      
      let matches = 0;
      searchNgrams.forEach(ngram => {
        if (item.searchTokens.ngrams.includes(ngram)) matches++;
      });
      
      const ngramScore = matches / Math.max(searchNgrams.size, 1) * 0.6;
      score = Math.max(score, ngramScore);
    }
    
    return score;
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
      if (showAll) {
        // Show all items
        showAllItems(checkboxData);
      } else {
        // HYBRID APPROACH: Try simple search first
        const simpleResults = performSimpleSearch(checkboxData, normalizedSearchTerm);
        
        // Check if we need fuzzy search
        const needsFuzzy = cache.fuzzyEnabled.get(groupName) && 
                          simpleResults.visibleCount < CONFIG.FUZZY.MIN_RESULTS_THRESHOLD &&
                          normalizedSearchTerm.length >= CONFIG.FUZZY.MIN_SEARCH_LENGTH;
        
        if (needsFuzzy) {
          // Not enough results with simple search, try fuzzy
          console.log(`Activating fuzzy search for "${searchTerm}" in ${groupName} (only ${simpleResults.visibleCount} simple matches)`);
          performFuzzySearch(checkboxData, searchTerm, normalizedSearchTerm);
        } else {
          // Simple search gave enough results, apply them
          applyVisibilityChanges(simpleResults.toShow, simpleResults.toHide);
        }
      }
    });
  }
  
  function showAllItems(checkboxData) {
    const toShow = [];
    const toHide = [];
    
    checkboxData.forEach(item => {
      if (!item.isVisible) {
        toShow.push(item);
        item.isVisible = true;
      }
    });
    
    applyVisibilityChanges(toShow, toHide);
  }
  
  function performSimpleSearch(checkboxData, normalizedSearchTerm) {
    const toShow = [];
    const toHide = [];
    let visibleCount = 0;
    
    checkboxData.forEach(item => {
      // Check if checkbox is checked (always show checked items)
      const isChecked = isCheckboxChecked(item.element);
      
      let shouldShow = false;
      if (isChecked) {
        shouldShow = true;
      } else {
        // Simple substring matching
        shouldShow = item.normalizedText.includes(normalizedSearchTerm);
      }
      
      if (shouldShow) {
        visibleCount++;
        if (!item.isVisible) {
          toShow.push(item);
          item.isVisible = true;
        }
      } else {
        if (item.isVisible) {
          toHide.push(item);
          item.isVisible = false;
        }
      }
    });
    
    return { toShow, toHide, visibleCount };
  }
  
  function performFuzzySearch(checkboxData, searchText, normalizedSearchTerm) {
    const toShow = [];
    const toHide = [];
    const scoredItems = [];
    
    checkboxData.forEach(item => {
      // Always show checked items
      const isChecked = isCheckboxChecked(item.element);
      
      if (isChecked) {
        if (!item.isVisible) {
          toShow.push(item);
          item.isVisible = true;
        }
      } else {
        // Calculate fuzzy score
        const score = calculateFuzzyScore(searchText, item);
        
        if (score >= CONFIG.FUZZY.SCORE_THRESHOLD) {
          scoredItems.push({ item, score });
        } else {
          if (item.isVisible) {
            toHide.push(item);
            item.isVisible = false;
          }
        }
      }
    });
    
    // Sort by score and show the best matches
    scoredItems.sort((a, b) => b.score - a.score);
    
    scoredItems.forEach(({ item }) => {
      if (!item.isVisible) {
        toShow.push(item);
        item.isVisible = true;
      }
    });
    
    console.log(`Fuzzy search found ${scoredItems.length} matches (threshold: ${CONFIG.FUZZY.SCORE_THRESHOLD})`);
    
    applyVisibilityChanges(toShow, toHide);
  }
  
  function applyVisibilityChanges(toShow, toHide) {
    // Batch DOM updates for better performance
    toShow.forEach(item => showElement(item.element));
    toHide.forEach(item => hideElement(item.element));
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
  
  // Public API for debugging and manual control
  window.checkboxFilterScript = {
    recacheElements() {
      console.log('Re-caching checkbox filter elements with hybrid fuzzy search...');
      
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
    
    // Get cache statistics
    getCacheStats() {
      const stats = {};
      cache.checkboxGroups.forEach((data, groupName) => {
        stats[groupName] = {
          total: data.length,
          visible: data.filter(item => item.isVisible).length,
          fuzzyEnabled: cache.fuzzyEnabled.get(groupName)
        };
      });
      return stats;
    },
    
    // Toggle fuzzy search for a specific group
    toggleFuzzy(groupName, enable) {
      if (cache.checkboxGroups.has(groupName)) {
        cache.fuzzyEnabled.set(groupName, enable);
        console.log(`Fuzzy search ${enable ? 'enabled' : 'disabled'} for ${groupName}`);
        
        // Re-process tokens if enabling
        if (enable) {
          const items = cache.checkboxGroups.get(groupName);
          items.forEach(item => {
            if (!item.searchTokens) {
              item.searchTokens = createSearchTokens(item.labelText);
            }
          });
        }
      }
    },
    
    // Update fuzzy configuration
    updateConfig(newConfig) {
      Object.assign(CONFIG.FUZZY, newConfig);
      console.log('Fuzzy config updated:', CONFIG.FUZZY);
    }
  };
  
})();
