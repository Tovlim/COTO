/*!
 * Cloudflare CMS Search Client v1.0.0
 * Real-time search using Cloudflare Workers API
 * Replaces search-checkbox-with-pagination-0.091.js
 *
 * Features:
 * - Server-side search via Cloudflare Workers
 * - Real-time results (no debounce delay)
 * - Dynamic checkbox generation from API results
 * - Full Finsweet CMS Filter integration
 * - Persistent checkbox states
 * - Empty state handling
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    API_BASE_URL: 'https://webflow-cms-search.occupation-crimes.workers.dev',
    SELECTORS: {
      CLOUDFLARE_CONTAINER: '[cloudflare-search]',
      SEARCH_BOX: '[searchbox-filter]',
      CLEAR_BUTTON: '[clear-text-input]',
      RESULTS_CONTAINER: '.w-dyn-items',
      SEARCHING_INDICATOR: '[seamless-replace="searching-indicator"]',
      EMPTY_STATE: '[seamless-replace="empty"]'
    },
    ENDPOINTS: {
      localities: '/search/localities',
      settlements: '/search/settlements'
    },
    URL_PATHS: {
      localities: '/locality',
      settlements: '/settlement'
    },
    SEARCH_LIMIT: 100, // Number of results to fetch
    DEBUG_MODE: false
  };

  // Cache for elements and state
  const cache = {
    containers: new Map(), // searchType -> container element
    searchBoxes: new Map(), // searchType -> search input
    clearButtons: new Map(), // searchType -> clear button
    resultsContainers: new Map(), // searchType -> results container
    searchingIndicators: new Map(), // searchType -> searching indicator
    emptyStates: new Map(), // searchType -> empty state
    eventListeners: new Map(), // searchType -> [listeners]
    persistentCheckedStates: new Map(), // searchType -> Map(itemName -> boolean)
    checkedItemSlugs: new Map(), // searchType -> Map(itemName -> slug)
    abortControllers: new Map() // searchType -> AbortController
  };

  let isInitialized = false;

  // Utility functions
  const utils = {
    log: (message, data) => {
      if (CONFIG.DEBUG_MODE) {
        console.log(`[CloudflareSearch] ${message}`, data || '');
      }
    },
    logError: (context, error) => {
      console.error(`[CloudflareSearch] ${context}:`, error);
    }
  };

  // ====================================================================
  // INITIALIZATION
  // ====================================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    try {
      utils.log('Initializing Cloudflare CMS Search');

      setupElements();
      setupEventListeners();

      isInitialized = true;
      utils.log('Initialization complete');

      // Sync with Finsweet after short delay
      setTimeout(() => {
        syncAllWithFinsweet();
      }, 100);

    } catch (error) {
      utils.logError('init', error);
    }
  }

  function setupElements() {
    try {
      // Find all cloudflare-search containers
      const containers = document.querySelectorAll(CONFIG.SELECTORS.CLOUDFLARE_CONTAINER);

      console.log('[CloudflareSearch] Found containers:', containers.length);

      containers.forEach(container => {
        const searchType = container.getAttribute('cloudflare-search');
        console.log('[CloudflareSearch] Container searchType attribute:', searchType, typeof searchType);

        if (!searchType) return;

        utils.log(`Found container for: ${searchType}`);

        // Cache container
        cache.containers.set(searchType, container);

        // Find and cache search input
        const searchBox = container.querySelector(CONFIG.SELECTORS.SEARCH_BOX);
        if (searchBox) {
          cache.searchBoxes.set(searchType, searchBox);
          utils.log(`  - Search box found with attribute: ${searchBox.getAttribute('searchbox-filter')}`);
        }

        // Find and cache clear button
        const clearButton = container.querySelector(CONFIG.SELECTORS.CLEAR_BUTTON);
        if (clearButton) {
          cache.clearButtons.set(searchType, clearButton);
        }

        // Find and cache results container
        const resultsContainer = container.querySelector(CONFIG.SELECTORS.RESULTS_CONTAINER);
        if (resultsContainer) {
          cache.resultsContainers.set(searchType, resultsContainer);
        }

        // Find and cache searching indicator
        const searchingIndicator = container.querySelector(CONFIG.SELECTORS.SEARCHING_INDICATOR);
        if (searchingIndicator) {
          cache.searchingIndicators.set(searchType, searchingIndicator);
          searchingIndicator.style.display = 'none';
        }

        // Find and cache empty state
        const emptyState = container.querySelector(CONFIG.SELECTORS.EMPTY_STATE);
        if (emptyState) {
          cache.emptyStates.set(searchType, emptyState);
          emptyState.style.display = 'none';
        }

        // Initialize persistent checked states
        cache.persistentCheckedStates.set(searchType, new Map());
      });

    } catch (error) {
      utils.logError('setupElements', error);
    }
  }

  function setupEventListeners() {
    try {
      cleanupEventListeners();

      // Setup search input listeners
      cache.searchBoxes.forEach((searchBox, searchType) => {
        const handler = (e) => {
          const searchTerm = e.target.value.trim();
          handleSearch(searchType, searchTerm);
        };

        searchBox.addEventListener('input', handler);

        if (!cache.eventListeners.has(searchType)) {
          cache.eventListeners.set(searchType, []);
        }
        cache.eventListeners.get(searchType).push({
          element: searchBox,
          event: 'input',
          handler: handler
        });
      });

      // Setup clear button listeners
      cache.clearButtons.forEach((clearButton, searchType) => {
        const handler = (e) => {
          e.preventDefault();
          clearSearch(searchType);
        };

        clearButton.addEventListener('click', handler);

        if (!cache.eventListeners.has(searchType)) {
          cache.eventListeners.set(searchType, []);
        }
        cache.eventListeners.get(searchType).push({
          element: clearButton,
          event: 'click',
          handler: handler
        });
      });

      // Setup Finsweet integration
      setupFinsweetIntegration();

    } catch (error) {
      utils.logError('setupEventListeners', error);
    }
  }

  function cleanupEventListeners() {
    cache.eventListeners.forEach((listeners) => {
      listeners.forEach(({ element, event, handler }) => {
        try {
          element.removeEventListener(event, handler);
        } catch (e) {
          // Silently fail
        }
      });
    });
    cache.eventListeners.clear();
  }

  // ====================================================================
  // SEARCH FUNCTIONALITY
  // ====================================================================

  /**
   * Capture checked states from DOM and store in persistent cache
   * Should be called BEFORE clearing/re-rendering DOM
   */
  function captureCheckedStatesFromDOM(searchType) {
    try {
      const fieldName = searchType === 'localities' ? 'Locality' : 'Settlement';
      const states = cache.persistentCheckedStates.get(searchType) || new Map();

      // Find all checkboxes for this field (checked and unchecked)
      const allCheckboxes = document.querySelectorAll(`input[fs-list-field="${fieldName}"]`);

      allCheckboxes.forEach(checkbox => {
        const name = checkbox.getAttribute('fs-list-value');
        if (!name) return;

        // Update state in persistent cache
        states.set(name, checkbox.checked);

        // Also cache the slug if checkbox is checked
        if (checkbox.checked) {
          const container = checkbox.closest('[checkbox-filter]') || checkbox.closest('.w-dyn-item');
          const link = container?.querySelector('a[href^="/"]');
          const href = link?.getAttribute('href');

          if (href) {
            const urlPath = CONFIG.URL_PATHS[searchType];
            if (href.startsWith(urlPath + '/')) {
              const slug = href.substring(urlPath.length + 1);
              // Store slug in a separate cache for checked items
              if (!cache.checkedItemSlugs) {
                cache.checkedItemSlugs = new Map();
              }
              if (!cache.checkedItemSlugs.has(searchType)) {
                cache.checkedItemSlugs.set(searchType, new Map());
              }
              cache.checkedItemSlugs.get(searchType).set(name, slug);
            }
          }
        }
      });

      cache.persistentCheckedStates.set(searchType, states);
      utils.log(`Captured ${states.size} checkbox states for ${searchType}`);

    } catch (error) {
      utils.logError('captureCheckedStatesFromDOM', error);
    }
  }

  /**
   * Get all currently checked items from persistent cache
   * Returns items marked as checked with their data
   */
  function getCheckedItems(searchType) {
    try {
      const checkedItems = [];
      const states = cache.persistentCheckedStates.get(searchType);

      if (!states) {
        utils.log(`No persistent states found for ${searchType}`);
        return [];
      }

      // Get cached slugs
      const slugCache = cache.checkedItemSlugs?.get(searchType) || new Map();

      // Iterate through persistent states to find checked items
      states.forEach((isChecked, name) => {
        if (!isChecked) return; // Skip unchecked items

        // Get slug from cache or generate from name
        let slug = slugCache.get(name);
        if (!slug) {
          slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        }

        checkedItems.push({
          name: name,
          slug: slug,
          isChecked: true // Mark as checked for rendering
        });
      });

      utils.log(`Found ${checkedItems.length} checked items from persistent cache for ${searchType}`);
      return checkedItems;

    } catch (error) {
      utils.logError('getCheckedItems', error);
      return [];
    }
  }

  /**
   * Merge checked items with API results
   * Checked items appear first, duplicates removed
   */
  function mergeCheckedWithResults(checkedItems, apiResults) {
    try {
      if (checkedItems.length === 0) {
        return apiResults;
      }

      // Create a Set of checked item names (lowercase for comparison)
      const checkedNames = new Set(checkedItems.map(item => item.name.toLowerCase()));

      // Filter out API results that are already checked
      const filteredApiResults = apiResults.filter(item =>
        !checkedNames.has(item.name.toLowerCase())
      );

      // Combine: checked items first, then API results
      const merged = [...checkedItems, ...filteredApiResults];

      utils.log(`Merged results: ${checkedItems.length} checked + ${filteredApiResults.length} search = ${merged.length} total`);
      return merged;

    } catch (error) {
      utils.logError('mergeCheckedWithResults', error);
      return apiResults;
    }
  }

  async function handleSearch(searchType, searchTerm) {
    try {
      utils.log(`Search triggered for ${searchType}:`, searchTerm);

      // Cancel any pending request
      if (cache.abortControllers.has(searchType)) {
        cache.abortControllers.get(searchType).abort();
      }

      // If empty search, clear results
      if (!searchTerm || searchTerm === '') {
        clearResults(searchType);
        return;
      }

      // IMPORTANT: Capture checked states from DOM BEFORE clearing
      // This preserves user's checkbox selections across searches
      captureCheckedStatesFromDOM(searchType);

      // Get currently checked items from persistent cache
      const checkedItems = getCheckedItems(searchType);

      // Show searching indicator
      showSearchingIndicator(searchType);

      // Create new abort controller
      const abortController = new AbortController();
      cache.abortControllers.set(searchType, abortController);

      // Build API URL
      const endpoint = CONFIG.ENDPOINTS[searchType];
      if (!endpoint) {
        throw new Error(`No endpoint configured for searchType: ${searchType}`);
      }

      const url = `${CONFIG.API_BASE_URL}${endpoint}?q=${encodeURIComponent(searchTerm)}&limit=${CONFIG.SEARCH_LIMIT}`;

      utils.log(`Fetching: ${url}`);

      // Fetch results
      const response = await fetch(url, {
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      utils.log(`Received ${data.results.length} results from API`);

      // Merge checked items with API results
      const mergedResults = mergeCheckedWithResults(checkedItems, data.results);

      // Render merged results
      renderResults(searchType, mergedResults);

      // Hide searching indicator
      hideSearchingIndicator(searchType);

      // Clean up abort controller
      cache.abortControllers.delete(searchType);

    } catch (error) {
      if (error.name === 'AbortError') {
        utils.log('Search aborted');
        return;
      }

      utils.logError('handleSearch', error);
      hideSearchingIndicator(searchType);
      showEmptyState(searchType);
    }
  }

  function clearSearch(searchType) {
    try {
      const searchBox = cache.searchBoxes.get(searchType);
      if (searchBox) {
        searchBox.value = '';

        // Instead of clearing results, show only checked items (initial state)
        showInitialState(searchType);

        searchBox.focus();
      }
    } catch (error) {
      utils.logError('clearSearch', error);
    }
  }

  function clearResults(searchType) {
    try {
      const resultsContainer = cache.resultsContainers.get(searchType);
      if (resultsContainer) {
        resultsContainer.innerHTML = '';
      }

      hideSearchingIndicator(searchType);
      hideEmptyState(searchType);

    } catch (error) {
      utils.logError('clearResults', error);
    }
  }

  /**
   * Show initial state - only checked checkboxes visible
   * Called when user clears the search input
   */
  function showInitialState(searchType) {
    try {
      // Capture current states first
      captureCheckedStatesFromDOM(searchType);

      // Get checked items
      const checkedItems = getCheckedItems(searchType);

      const resultsContainer = cache.resultsContainers.get(searchType);
      if (!resultsContainer) return;

      // Clear container
      resultsContainer.innerHTML = '';

      // If no checked items, just hide empty state and leave container empty
      if (checkedItems.length === 0) {
        hideEmptyState(searchType);
        utils.log(`No checked items to show for ${searchType}`);
        return;
      }

      // Render only checked items
      checkedItems.forEach(result => {
        const checkboxHtml = generateCheckboxHtml(searchType, result);
        resultsContainer.insertAdjacentHTML('beforeend', checkboxHtml);
      });

      hideEmptyState(searchType);
      utils.log(`Showing ${checkedItems.length} checked items for ${searchType}`);

      // Sync with Finsweet
      setTimeout(() => {
        syncWithFinsweet(searchType);
      }, 50);

    } catch (error) {
      utils.logError('showInitialState', error);
    }
  }

  // ====================================================================
  // RESULTS RENDERING
  // ====================================================================

  function renderResults(searchType, results) {
    try {
      const resultsContainer = cache.resultsContainers.get(searchType);
      if (!resultsContainer) return;

      // Clear existing results
      resultsContainer.innerHTML = '';

      // If no results, show empty state
      if (results.length === 0) {
        showEmptyState(searchType);
        return;
      }

      // Hide empty state
      hideEmptyState(searchType);

      // Render each result as a checkbox item
      // Checked state is already embedded in the HTML via generateCheckboxHtml
      results.forEach(result => {
        const checkboxHtml = generateCheckboxHtml(searchType, result);
        resultsContainer.insertAdjacentHTML('beforeend', checkboxHtml);
      });

      // No need to restore checked states - they're already set in the HTML
      // But we still sync with Finsweet for facet counts and other features
      setTimeout(() => {
        syncWithFinsweet(searchType);
      }, 50);

    } catch (error) {
      utils.logError('renderResults', error);
    }
  }

  function generateCheckboxHtml(searchType, result) {
    const name = result.name;
    const slug = result.slug;
    const urlPath = CONFIG.URL_PATHS[searchType];
    const isChecked = result.isChecked || false; // Check if item was marked as checked

    // Determine field name for Finsweet
    const fieldName = searchType === 'localities' ? 'Locality' : 'Settlement';
    const filterName = searchType === 'localities' ? 'locality' : 'settlement';

    // Build checked classes if needed
    const labelClass = isChecked ? 'w-checkbox reporterwrap-copy is-list-active' : 'w-checkbox reporterwrap-copy';
    const checkboxInputClass = isChecked ? 'w-checkbox-input w-checkbox-input--inputType-custom toggleable w--redirected-checked' : 'w-checkbox-input w-checkbox-input--inputType-custom toggleable';
    const checkedAttr = isChecked ? 'checked' : '';

    // Build the checkbox HTML matching the exact structure
    return `
      <div checkbox-filter="${filterName}" role="listitem" class="collection-item-3 w-dyn-item">
        <label${searchType === 'localities' ? ' id="locality-checkbox"' : ''} class="${labelClass}">
          <a open="" href="${urlPath}/${slug}" target="_blank" class="open-in-new-tab w-inline-block">
            <svg xmlns="http://www.w3.org/2000/svg" id="Layer_1" viewBox="0 0 151.49 151.49" width="100%" fill="currentColor" class="svg-3">
              <polygon class="cls-1" points="151.49 0 151.49 151.49 120.32 151.49 120.32 53.21 22.04 151.49 0 129.45 98.27 31.17 0 31.17 0 0 151.49 0"></polygon>
            </svg>
          </a>
          <div class="${checkboxInputClass}"></div>
          <input
            data-auto-sidebar="true"
            fs-list-value="${name}"
            fs-list-field="${fieldName}"
            name="${filterName}"
            data-name="${filterName}"
            activate-filter-indicator="place"
            type="checkbox"
            ${searchType === 'localities' ? 'id="locality"' : ''}
            ${checkedAttr}
            style="opacity:0;position:absolute;z-index:-1">
          <span class="test3 w-form-label" for="${filterName}">${name}</span>
          <div class="div-block-31834">
            <div fs-list-element="facet-count" class="test33">0</div>
          </div>
        </label>
      </div>
    `.trim();
  }

  // ====================================================================
  // CHECKBOX STATE MANAGEMENT
  // ====================================================================
  // Note: Checkbox state management is now handled by:
  // 1. captureCheckedStatesFromDOM() - captures states before search
  // 2. getCheckedItems() - retrieves checked items from cache
  // 3. generateCheckboxHtml() - renders with correct checked state

  // ====================================================================
  // UI STATE MANAGEMENT
  // ====================================================================

  function showSearchingIndicator(searchType) {
    const indicator = cache.searchingIndicators.get(searchType);
    if (indicator) {
      indicator.style.display = 'flex';
    }
  }

  function hideSearchingIndicator(searchType) {
    const indicator = cache.searchingIndicators.get(searchType);
    if (indicator) {
      indicator.style.display = 'none';
    }
  }

  function showEmptyState(searchType) {
    const emptyState = cache.emptyStates.get(searchType);
    if (emptyState) {
      emptyState.style.display = 'flex';
    }
  }

  function hideEmptyState(searchType) {
    const emptyState = cache.emptyStates.get(searchType);
    if (emptyState) {
      emptyState.style.display = 'none';
    }
  }

  // ====================================================================
  // FINSWEET INTEGRATION
  // ====================================================================

  function setupFinsweetIntegration() {
    try {
      const finsweetEvents = [
        'fs-cmsfilter-change',
        'fs-cmsfilter-reset',
        'fs-cmsfilter-click'
      ];

      finsweetEvents.forEach(eventName => {
        const handler = () => {
          syncAllWithFinsweet();
        };

        document.addEventListener(eventName, handler);

        if (!cache.eventListeners.has('finsweet')) {
          cache.eventListeners.set('finsweet', []);
        }
        cache.eventListeners.get('finsweet').push({
          element: document,
          event: eventName,
          handler: handler
        });
      });

    } catch (error) {
      utils.logError('setupFinsweetIntegration', error);
    }
  }

  function syncWithFinsweet(searchType) {
    try {
      const resultsContainer = cache.resultsContainers.get(searchType);
      if (!resultsContainer) return;

      // Get all active Finsweet tags
      const activeTags = document.querySelectorAll('[fs-list-element="tag-label"]');
      const activeTagTexts = new Set();
      activeTags.forEach(tag => {
        const text = tag.textContent?.trim();
        if (text) activeTagTexts.add(text.toLowerCase());
      });

      // Get all checked Finsweet inputs
      const checkedInputs = document.querySelectorAll('input[fs-list-field][fs-list-value]:checked');
      const activeValues = new Set();
      checkedInputs.forEach(input => {
        const value = input.getAttribute('fs-list-value');
        if (value) activeValues.add(value.toLowerCase());
      });

      // Update checkboxes in our results
      const checkboxes = resultsContainer.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(checkbox => {
        const name = checkbox.getAttribute('fs-list-value');
        if (!name) return;

        const isActive = activeTagTexts.has(name.toLowerCase()) || activeValues.has(name.toLowerCase());

        checkbox.checked = isActive;

        const label = checkbox.closest('label');
        const checkboxInput = checkbox.parentElement.querySelector('.w-checkbox-input');

        if (isActive) {
          if (label) label.classList.add('is-list-active');
          if (checkboxInput) checkboxInput.classList.add('w--redirected-checked');
        } else {
          if (label) label.classList.remove('is-list-active');
          if (checkboxInput) checkboxInput.classList.remove('w--redirected-checked');
        }

        // Update persistent state
        const states = cache.persistentCheckedStates.get(searchType);
        if (states) {
          states.set(name, isActive);
        }
      });

    } catch (error) {
      utils.logError('syncWithFinsweet', error);
    }
  }

  function syncAllWithFinsweet() {
    cache.containers.forEach((container, searchType) => {
      syncWithFinsweet(searchType);
    });
  }

  // ====================================================================
  // PUBLIC API
  // ====================================================================

  window.cloudflareSearch = {
    search(searchType, query) {
      handleSearch(searchType, query);
    },

    clear(searchType) {
      clearSearch(searchType);
    },

    recache() {
      setupElements();
      setupEventListeners();
    },

    syncWithFinsweet() {
      syncAllWithFinsweet();
    },

    setDebugMode(enabled) {
      CONFIG.DEBUG_MODE = !!enabled;
      if (enabled) {
        console.log('[CloudflareSearch] Debug mode enabled');
      }
    },

    getState() {
      const state = {};
      cache.persistentCheckedStates.forEach((states, searchType) => {
        state[searchType] = Array.from(states.entries());
      });
      return state;
    }
  };

})();
