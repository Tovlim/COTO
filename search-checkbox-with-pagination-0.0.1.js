// Real-time Checkbox Group Filter with Fuzzy Search + Pagination Support
// This version loads all paginated items for complete search functionality

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
      CHECKBOX_INPUT: 'input[type="checkbox"]',
      SEAMLESS_CONTAINER: '[seamless-replace="true"]',
      PAGINATION_WRAPPER: '.w-pagination-wrapper',
      PAGINATION_NEXT: '.w-pagination-next',
      DYN_ITEM: '.w-dyn-item'
    },
    SCORE_THRESHOLD: 0.3
  };

  // Cache for checkbox elements and paginated data
  const cache = {
    searchBoxes: new Map(),
    clearButtons: new Map(),
    checkboxGroups: new Map(),
    eventListeners: new Map(),
    // New: Store all paginated items per container
    paginatedData: new Map(),
    loadingPromises: new Map()
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
    // Load all paginated items for containers
    loadAllPaginatedItems();
    isInitialized = true;
  }

  // New function to load all paginated items
  function loadAllPaginatedItems() {
    const containers = document.querySelectorAll(CONFIG.SELECTORS.SEAMLESS_CONTAINER);

    containers.forEach((container, index) => {
      const containerKey = `container_${index}`;

      // Initialize paginated data for this container
      if (!cache.paginatedData.has(containerKey)) {
        cache.paginatedData.set(containerKey, {
          allCheckboxes: [],
          currentCheckboxes: [],
          pagesLoaded: new Set(),
          isLoading: false,
          container: container
        });
      }

      // Start loading pagination
      loadContainerPagination(container, containerKey);
    });

    // Also check for checkboxes outside seamless containers
    if (containers.length === 0) {
      // If no seamless containers, still try to load paginated content
      console.log('No seamless containers found, checking for pagination globally');
      loadGlobalPagination();
    }
  }

  // Load pagination when checkboxes aren't in seamless containers
  function loadGlobalPagination() {
    const containerKey = 'global';

    if (!cache.paginatedData.has(containerKey)) {
      cache.paginatedData.set(containerKey, {
        allCheckboxes: [],
        currentCheckboxes: [],
        pagesLoaded: new Set(),
        isLoading: false,
        container: document.body
      });
    }

    const data = cache.paginatedData.get(containerKey);
    data.isLoading = true;

    // Store current page checkboxes
    const currentCheckboxes = document.querySelectorAll(CONFIG.SELECTORS.CHECKBOX);
    currentCheckboxes.forEach(checkbox => {
      const clonedCheckbox = checkbox.cloneNode(true);
      data.allCheckboxes.push(clonedCheckbox);
      data.currentCheckboxes.push(clonedCheckbox);
    });

    // Mark current page as loaded
    data.pagesLoaded.add(window.location.href);

    // Find any pagination wrapper
    const paginationWrapper = document.querySelector(CONFIG.SELECTORS.PAGINATION_WRAPPER);
    if (!paginationWrapper) {
      data.isLoading = false;
      return;
    }

    const nextLink = paginationWrapper.querySelector(CONFIG.SELECTORS.PAGINATION_NEXT);
    if (nextLink && nextLink.href) {
      loadNextPagesGlobal(containerKey, nextLink.href);
    } else {
      data.isLoading = false;
      console.log(`All items loaded (${data.allCheckboxes.length} checkboxes)`);
    }
  }

  function loadNextPagesGlobal(containerKey, nextUrl) {
    const data = cache.paginatedData.get(containerKey);

    if (data.pagesLoaded.has(nextUrl)) {
      data.isLoading = false;
      return;
    }

    fetch(nextUrl)
      .then(response => response.text())
      .then(html => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Extract all checkboxes from the loaded page
        const newCheckboxes = doc.querySelectorAll(CONFIG.SELECTORS.CHECKBOX);
        newCheckboxes.forEach(checkbox => {
          const clonedCheckbox = checkbox.cloneNode(true);
          data.allCheckboxes.push(clonedCheckbox);
        });

        // Mark this page as loaded
        data.pagesLoaded.add(nextUrl);

        // Find next page link
        const nextLink = doc.querySelector(CONFIG.SELECTORS.PAGINATION_NEXT);
        if (nextLink && nextLink.href) {
          return loadNextPagesGlobal(containerKey, nextLink.href);
        }

        data.isLoading = false;
        console.log(`All pages loaded (${data.allCheckboxes.length} total checkboxes)`);

        // Rebuild checkbox cache with all loaded items
        rebuildCheckboxCache();
      })
      .catch(error => {
        console.error(`Failed to load page ${nextUrl}:`, error);
        data.isLoading = false;
      });
  }

  function loadContainerPagination(container, containerKey) {
    const data = cache.paginatedData.get(containerKey);
    if (data.isLoading) return;

    data.isLoading = true;

    // Store current page checkboxes
    const currentCheckboxes = container.querySelectorAll(CONFIG.SELECTORS.CHECKBOX);
    currentCheckboxes.forEach(checkbox => {
      const clonedCheckbox = checkbox.cloneNode(true);
      data.allCheckboxes.push(clonedCheckbox);
      data.currentCheckboxes.push(clonedCheckbox);
    });

    // Mark current page as loaded
    data.pagesLoaded.add(window.location.href);

    // Find next page link
    const paginationWrapper = container.querySelector(CONFIG.SELECTORS.PAGINATION_WRAPPER);
    if (!paginationWrapper) {
      data.isLoading = false;
      console.log(`Container ${containerKey}: Single page, no pagination`);
      return;
    }

    const nextLink = paginationWrapper.querySelector(CONFIG.SELECTORS.PAGINATION_NEXT);
    if (nextLink && nextLink.href) {
      loadNextPages(containerKey, nextLink.href);
    } else {
      data.isLoading = false;
      console.log(`Container ${containerKey}: All items loaded (${data.allCheckboxes.length} checkboxes)`);
    }
  }

  function loadNextPages(containerKey, nextUrl) {
    const data = cache.paginatedData.get(containerKey);

    if (data.pagesLoaded.has(nextUrl)) {
      data.isLoading = false;
      return;
    }

    // Create loading promise if it doesn't exist
    if (!cache.loadingPromises.has(containerKey)) {
      cache.loadingPromises.set(containerKey,
        fetch(nextUrl)
          .then(response => response.text())
          .then(html => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Find all seamless containers in the loaded page
            const containers = doc.querySelectorAll(CONFIG.SELECTORS.SEAMLESS_CONTAINER);
            const containerIndex = parseInt(containerKey.split('_')[1]);
            const targetContainer = containers[containerIndex];

            if (targetContainer) {
              // Extract checkboxes from the loaded page
              const newCheckboxes = targetContainer.querySelectorAll(CONFIG.SELECTORS.CHECKBOX);
              newCheckboxes.forEach(checkbox => {
                const clonedCheckbox = checkbox.cloneNode(true);
                data.allCheckboxes.push(clonedCheckbox);
              });

              // Mark this page as loaded
              data.pagesLoaded.add(nextUrl);

              // Find next page link
              const nextLink = targetContainer.querySelector(CONFIG.SELECTORS.PAGINATION_NEXT);
              if (nextLink && nextLink.href) {
                // Clear the promise and load next page
                cache.loadingPromises.delete(containerKey);
                return loadNextPages(containerKey, nextLink.href);
              }
            }

            data.isLoading = false;
            cache.loadingPromises.delete(containerKey);
            console.log(`Container ${containerKey}: All pages loaded (${data.allCheckboxes.length} total checkboxes)`);

            // Rebuild checkbox cache with all loaded items
            rebuildCheckboxCache();
          })
          .catch(error => {
            console.error(`Failed to load page ${nextUrl}:`, error);
            data.isLoading = false;
            cache.loadingPromises.delete(containerKey);
          })
      );
    }

    return cache.loadingPromises.get(containerKey);
  }

  function rebuildCheckboxCache() {
    // Merge all paginated checkboxes into the main cache
    cache.paginatedData.forEach((data, containerKey) => {
      if (!data.isLoading && data.allCheckboxes.length > 0) {
        // Process each checkbox from paginated data
        data.allCheckboxes.forEach(checkbox => {
          const groupName = checkbox.getAttribute('checkbox-filter');
          if (groupName && !isCheckboxInCache(groupName, checkbox)) {
            addCheckboxToCache(groupName, checkbox);
          }
        });
      }
    });
  }

  function isCheckboxInCache(groupName, checkboxElement) {
    const group = cache.checkboxGroups.get(groupName);
    if (!group) return false;

    const labelText = extractLabelText(checkboxElement);
    return group.some(item => item.labelText === labelText);
  }

  function addCheckboxToCache(groupName, checkboxElement) {
    const labelText = extractLabelText(checkboxElement);
    const processedCheckbox = {
      element: checkboxElement,
      labelText: labelText,
      normalizedText: utils.normalizeText(labelText),
      searchTokens: createSearchTokens(labelText),
      isVisible: true,
      isPaginated: true // Mark as coming from pagination
    };

    if (!cache.checkboxGroups.has(groupName)) {
      cache.checkboxGroups.set(groupName, []);
    }

    cache.checkboxGroups.get(groupName).push(processedCheckbox);
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
          isVisible: true,
          isPaginated: false // Mark as currently visible on page
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

    // Fuzzy matching using n-grams
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

    if (!checkboxData) {
      console.log(`No checkbox data found for group: ${groupName}`);
      return;
    }

    const normalizedSearchTerm = utils.normalizeText(searchTerm);
    const showAll = normalizedSearchTerm === '';

    console.log(`Filtering group ${groupName} with term: "${searchTerm}", Total items: ${checkboxData.length}`);

    // Find the appropriate container (either seamless or the checkbox parent)
    let targetContainer = document.querySelector(`[seamless-replace="true"]`);
    let itemsContainer = targetContainer ? targetContainer.querySelector('.w-dyn-items') : null;

    // If no seamless container, find where the checkboxes are
    if (!itemsContainer) {
      const firstCheckbox = document.querySelector(CONFIG.SELECTORS.CHECKBOX);
      if (firstCheckbox) {
        // Try to find a common parent that contains the items
        itemsContainer = firstCheckbox.closest('.w-dyn-items') ||
                        firstCheckbox.closest('.collection-list') ||
                        firstCheckbox.parentElement;
      }
    }

    requestAnimationFrame(() => {
      const elementsToShow = [];
      const elementsToHide = [];
      const paginatedToShow = [];

      if (showAll) {
        // Show only current page items when search is empty
        checkboxData.forEach(item => {
          if (!item.isPaginated) {
            if (!item.isVisible) {
              elementsToShow.push(item);
              item.isVisible = true;
            }
          } else {
            // Remove paginated items from DOM when not searching
            if (item.element.parentNode && item.element.parentNode === itemsContainer) {
              item.element.remove();
            }
            item.isVisible = false;
          }
        });

        // Show pagination controls
        const pagination = document.querySelector(CONFIG.SELECTORS.PAGINATION_WRAPPER);
        if (pagination) pagination.style.display = '';
      } else {
        // Search mode - show matching items from all pages
        const searchTokens = normalizedSearchTerm.split(/\s+/);

        console.log(`Searching with tokens:`, searchTokens);
        let matchCount = 0;

        checkboxData.forEach(item => {
          let shouldShow = false;

          // Check if checkbox is checked
          const isChecked = isCheckboxChecked(item.element);

          if (isChecked) {
            shouldShow = true;
          } else {
            // Calculate match score
            const score = calculateMatchScore(normalizedSearchTerm, searchTokens, item);
            shouldShow = score > CONFIG.SCORE_THRESHOLD;
            if (shouldShow) matchCount++;
          }

          if (shouldShow) {
            if (!item.isVisible) {
              if (item.isPaginated) {
                paginatedToShow.push(item);
              } else {
                elementsToShow.push(item);
              }
              item.isVisible = true;
            }
          } else {
            if (item.isVisible) {
              elementsToHide.push(item);
              item.isVisible = false;
            }
          }
        });

        console.log(`Found ${matchCount} matches, ${paginatedToShow.length} from other pages`);

        // Hide pagination controls during search
        const pagination = document.querySelector(CONFIG.SELECTORS.PAGINATION_WRAPPER);
        if (pagination) pagination.style.display = 'none';

        // Add paginated items to the DOM if searching
        if (paginatedToShow.length > 0 && itemsContainer) {
          paginatedToShow.forEach(item => {
            // Check if item is already in DOM by comparing label text
            const existingItem = Array.from(itemsContainer.querySelectorAll(CONFIG.SELECTORS.CHECKBOX))
              .find(el => extractLabelText(el) === item.labelText);

            if (!existingItem) {
              const clonedElement = item.element.cloneNode(true);
              // Make sure the cloned element is visible
              clonedElement.style.display = '';
              clonedElement.removeAttribute('data-filtered');
              itemsContainer.appendChild(clonedElement);
            }
          });
        }
      }

      // Batch DOM updates for visibility
      elementsToShow.forEach(item => showElement(item.element));
      elementsToHide.forEach(item => hideElement(item.element));
    });
  }

  function isCheckboxChecked(checkboxElement) {
    const label = checkboxElement.querySelector('label');
    if (label?.classList.contains('is-list-active')) {
      return true;
    }

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
        setupEventListeners();
        initializeGroups();
        // Reload paginated items
        loadAllPaginatedItems();
        console.log('Checkbox filter recached:', this.getCacheStats());
      } else {
        initializeFilters();
      }
    },

    forceRebuild() {
      console.log('Forcing complete checkbox filter rebuild...');

      // Clear all caches
      cache.searchBoxes.clear();
      cache.clearButtons.clear();
      cache.checkboxGroups.clear();
      cache.paginatedData.clear();
      cache.loadingPromises.clear();
      cleanupEventListeners();

      // Rebuild everything
      setupElements();
      setupEventListeners();
      initializeGroups();
      loadAllPaginatedItems();

      console.log('Checkbox filter force rebuild completed:', this.getCacheStats());
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
          paginated: data.filter(item => item.isPaginated).length
        };
      });

      // Add pagination stats
      stats.pagination = {};
      cache.paginatedData.forEach((data, key) => {
        stats.pagination[key] = {
          totalCheckboxes: data.allCheckboxes.length,
          pagesLoaded: data.pagesLoaded.size,
          isLoading: data.isLoading
        };
      });

      return stats;
    }
  };

})();
