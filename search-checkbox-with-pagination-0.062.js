/*!
 * Checkbox Filter with Pagination Support v1.8.0
 * Real-time checkbox filtering with fuzzy search and seamless pagination
 * Compatible with Webflow CMS, seamless-load-more.html, and Finsweet CMS Filter
 *
 * Features:
 * - Real-time search with fuzzy matching
 * - Seamless pagination support with load more
 * - Persistent checked states across searches and pagination
 * - Multiple container support
 * - Automatic state restoration
 * - Full Finsweet CMS Filter integration (syncs with tag-remove)
 * - Advanced performance optimizations (batching, WeakMap caching)
 * - Custom events for integration with other scripts
 * - Intelligent parallel page loading (Finsweet-inspired)
 * - Real-time search during pagination loading
 * - User-controlled searching indicator
 * - Automatic scroll position preservation
 * - Smart empty state handling
 *
 * Changelog v1.8.0 (Search UX Improvements):
 * - Load more button now hides automatically when user is searching
 * - Shows again when search is cleared
 * - Empty state now shows immediately when no results (even if pagination still loading)
 * - Provides instant feedback to users instead of waiting for all pages to load
 *
 * Changelog v1.7.0 (Scroll Preservation & Empty State):
 * - Added scroll position preservation during load more operations
 * - Scroll position of collection list wrapper is saved and restored
 * - Prevents unwanted scroll to top when clicking load more
 * - Added smart empty state support with seamless-replace="empty" attribute
 * - Empty state shows only when: actively searching, no results, and pagination complete
 * - Prevents false "no results" message while pages are still loading
 * - Empty state automatically hides when results exist or search is cleared
 *
 * Changelog v1.6.0 (Real-time Search During Pagination):
 * - MAJOR: Search now works in real-time while pages are still loading
 * - Results appear incrementally as matching checkboxes are found
 * - Searching indicator stays visible until all pages are searched
 * - Each page is filtered immediately as it loads if user is searching
 * - Dramatically improved user experience - no more "false negatives"
 * - Users can search immediately without waiting for all pages to load
 *
 * Changelog v1.5.0 (Searching Indicator):
 * - Replaced auto-created loading indicator with user-controlled searching indicator
 * - Uses custom div with attribute seamless-replace="searching-indicator" inside each container
 * - Shows indicator (display: flex) ONLY when actively searching checkboxes
 * - Fails silently if indicator element doesn't exist
 * - No animations or transitions for instant feedback
 *
 * Changelog v1.4.0 (Parallel Loading Optimization):
 * - Added intelligent page count detection from pagination elements
 * - Implemented parallel page loading when total pages known (MUCH faster!)
 * - Auto-detects pagination URL parameters for flexible integration
 * - Falls back to sequential loading when page count unavailable
 * - Added support for Webflow and Finsweet pagination count formats
 * - Dramatically improved initialization speed for multi-page collections
 * - Debug logging for parallel loading progress
 *
 * Changelog v1.3.0 (Advanced Performance Update):
 * - Added MutationObserver for Finsweet tags container (real-time sync)
 * - Implemented requestAnimationFrame batching for checkbox updates
 * - Added WeakMap for element metadata caching (prevents memory leaks)
 * - Added custom events: 'checkboxfilter:synccomplete'
 * - New API methods: flushUpdates(), setDebugMode()
 * - Enhanced cleanup on page unload
 * - Improved error logging with context
 *
 * Changelog v1.2.0:
 * - Improved Finsweet sync: Now uses fs-list-field/fs-list-value attributes
 * - Added debouncing for sync operations
 * - Added optional DEBUG_MODE for troubleshooting
 * - Better fallback handling for non-Finsweet checkboxes
 *
 * Changelog v1.1.0:
 * - Initial Finsweet CMS Filter integration
 * - Tag-remove button support
 */

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
    SCORE_THRESHOLD: 0.3,
    RESTORE_DELAY: 200,
    DEBUG_MODE: false // Set to true for console warnings
  };

  // Cache for checkbox elements and paginated data
  const cache = {
    searchBoxes: new Map(),
    clearButtons: new Map(),
    checkboxGroups: new Map(),
    eventListeners: new Map(),
    paginatedData: new Map(),
    loadingPromises: new Map(),
    persistentCheckedStates: new Map(),
    elementMetadata: new WeakMap() // Prevents memory leaks with detached elements
  };

  // Pre-compiled utilities
  const utils = {
    normalizeText: (text) => text.toLowerCase().trim(),
    createInputEvent: () => new Event('input', { bubbles: true, cancelable: true }),
    logError: (context, error) => {
      if (CONFIG.DEBUG_MODE) {
        console.warn(`[CheckboxFilter] ${context}:`, error);
      }
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
  let isInitializing = false;
  let isLoadingMore = false;
  let mutationObserver = null;
  let finsweetTagObserver = null;
  let pendingPaginatedItems = new Map();
  let syncDebounceTimer = null;
  let pendingCheckboxUpdates = new Map();
  let updateAnimationFrame = null;
  let loadingIndicator = null;

  // Track active search terms per group for filtering during pagination
  const activeSearchTerms = new Map(); // groupName -> searchTerm

  // Track scroll positions for restoration
  const scrollPositions = new Map(); // container -> scrollTop

  // ====================================================================
  // SCROLL POSITION HELPERS
  // ====================================================================

  function saveScrollPositions() {
    try {
      const containers = document.querySelectorAll('[seamless-replace="true"]');
      containers.forEach(container => {
        // Find the collection list wrapper (parent of .w-dyn-items)
        const dynItems = container.querySelector('.w-dyn-items');
        const wrapper = dynItems?.parentElement;
        if (wrapper) {
          scrollPositions.set(container, wrapper.scrollTop);
        }
      });
    } catch (error) {
      // Silently fail
    }
  }

  function restoreScrollPositions() {
    try {
      requestAnimationFrame(() => {
        scrollPositions.forEach((scrollTop, container) => {
          const dynItems = container.querySelector('.w-dyn-items');
          const wrapper = dynItems?.parentElement;
          if (wrapper) {
            wrapper.scrollTop = scrollTop;
          }
        });
      });
    } catch (error) {
      // Silently fail
    }
  }

  // ====================================================================
  // EMPTY STATE HELPERS
  // ====================================================================

  function showEmptyState(container) {
    if (!container) return;

    try {
      const emptyState = container.querySelector('[seamless-replace="empty"]');
      if (emptyState) {
        emptyState.style.display = 'flex';
      }
    } catch (error) {
      // Silently fail
    }
  }

  function hideEmptyState(container) {
    if (!container) return;

    try {
      const emptyState = container.querySelector('[seamless-replace="empty"]');
      if (emptyState) {
        emptyState.style.display = 'none';
      }
    } catch (error) {
      // Silently fail
    }
  }

  // ====================================================================
  // SEARCHING INDICATOR
  // ====================================================================

  function showSearchingIndicator(container) {
    if (!container) return;

    try {
      const indicator = container.querySelector('[seamless-replace="searching-indicator"]');
      if (indicator) {
        indicator.style.display = 'flex';
      }
    } catch (error) {
      // Silently fail
    }
  }

  function hideSearchingIndicator(container) {
    if (!container) return;

    try {
      const indicator = container.querySelector('[seamless-replace="searching-indicator"]');
      if (indicator) {
        indicator.style.display = 'none';
      }
    } catch (error) {
      // Silently fail
    }
  }

  function hideAllSearchingIndicators() {
    try {
      const indicators = document.querySelectorAll('[seamless-replace="searching-indicator"]');
      indicators.forEach(indicator => {
        indicator.style.display = 'none';
      });
    } catch (error) {
      // Silently fail
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFilters);
  } else {
    initializeFilters();
  }

  function initializeFilters() {
    try {
      if (isInitializing) return;

      isInitializing = true;

      setupElements();
      setupEventListeners();
      initializeGroups();
      setupMutationObserver();
      setupLoadMoreHandlers();
      loadAllPaginatedItems();

      // Sync with Finsweet on initial load
      setTimeout(() => {
        syncCheckboxStatesWithFinsweet();
      }, 100);

      isInitialized = true;
      isInitializing = false;
    } catch (error) {
      isInitializing = false;
      utils.logError('initializeFilters', error);
    }
  }

  function setupLoadMoreHandlers() {
    try {
      const seamlessContainers = document.querySelectorAll('[seamless-replace="true"]');
      seamlessContainers.forEach(container => {
        const loadMoreButton = container.querySelector('.w-pagination-next');
        if (loadMoreButton && !loadMoreButton.hasAttribute('data-filter-handler')) {
          loadMoreButton.setAttribute('data-filter-handler', 'true');
          loadMoreButton.addEventListener('click', function(e) {
            isLoadingMore = true;
            window.checkboxFilterScript.captureCurrentCheckedStates();
            // Note: isLoadingMore flag will be reset when seamless script calls recacheElements()
          }, true);
        }
      });
    } catch (error) {
      // Silently fail
    }
  }

  function setupMutationObserver() {
    if (mutationObserver) {
      mutationObserver.disconnect();
    }

    try {
      const observerConfig = { childList: true, subtree: false };
      const containers = new Set();

      cache.checkboxGroups.forEach((checkboxData) => {
        checkboxData.forEach(item => {
          if (item.element?.parentElement) {
            containers.add(item.element.parentElement);
          }
        });
      });

      if (containers.size > 0) {
        mutationObserver = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
              mutation.removedNodes.forEach(node => {
                if (node.nodeType === 1 && node.hasAttribute('data-paginated-item')) {
                  const groupName = node.getAttribute('checkbox-filter');
                  const labelText = extractLabelText(node);
                  if (groupName && labelText) {
                    if (!pendingPaginatedItems.has(groupName)) {
                      pendingPaginatedItems.set(groupName, new Map());
                    }
                    pendingPaginatedItems.get(groupName).set(labelText, node.cloneNode(true));
                  }
                }
              });
            }
          });

          if (pendingPaginatedItems.size > 0) {
            requestAnimationFrame(() => {
              pendingPaginatedItems.forEach((items, groupName) => {
                const checkboxData = cache.checkboxGroups.get(groupName);
                if (checkboxData) {
                  items.forEach((element, labelText) => {
                    const existingItem = checkboxData.find(item => item.labelText === labelText);
                    if (!existingItem) {
                      checkboxData.push({
                        element: element,
                        labelText: labelText,
                        normalizedText: utils.normalizeText(labelText),
                        searchTokens: createSearchTokens(labelText),
                        isVisible: true,
                        isPaginated: true
                      });
                    }
                  });
                }
              });
              pendingPaginatedItems.clear();
            });
          }
        });

        containers.forEach(container => {
          mutationObserver.observe(container, observerConfig);
        });
      }
    } catch (error) {
      // Silently fail
    }
  }

  function loadAllPaginatedItems() {
    try {
      const containers = document.querySelectorAll('[seamless-replace="true"]');

      containers.forEach((container, containerIndex) => {
        const containerKey = `container_${containerIndex}`;

        if (!cache.paginatedData.has(containerKey)) {
          cache.paginatedData.set(containerKey, {
            allCheckboxes: [],
            pagesLoaded: new Set(),
            isLoading: false
          });
        }

        const containerData = cache.paginatedData.get(containerKey);
        if (containerData.isLoading) return;

        containerData.isLoading = true;
        const currentPageUrl = window.location.href;
        containerData.pagesLoaded.add(currentPageUrl);

        const currentCheckboxes = container.querySelectorAll('[checkbox-filter]');
        currentCheckboxes.forEach(checkbox => {
          const groupName = checkbox.getAttribute('checkbox-filter');
          const labelText = extractLabelText(checkbox);
          if (groupName && labelText && !containerData.allCheckboxes.some(item =>
            item.groupName === groupName && item.labelText === labelText)) {
            containerData.allCheckboxes.push({ groupName, labelText, element: checkbox.cloneNode(true) });
          }
        });

        const paginationWrapper = container.querySelector('.w-pagination-wrapper');
        const nextLink = paginationWrapper?.querySelector('.w-pagination-next');

        if (nextLink?.getAttribute('href')) {
          // Check if we can get total pages from page count element (Finsweet optimization)
          const paginationCountElement = container.querySelector('.w-pagination-count, [fs-cmspagination-element="count"]');
          let totalPages = null;

          if (paginationCountElement) {
            const countText = paginationCountElement.textContent?.trim();
            const match = countText?.match(/\/\s*(\d+)/); // Extract "X / Y" format
            if (match) {
              totalPages = parseInt(match[1]);
              if (CONFIG.DEBUG_MODE) {
                console.log(`[CheckboxFilter] Found total pages: ${totalPages} for container ${containerIndex}`);
              }
            }
          }

          // Use parallel loading if we know total pages, otherwise fall back to sequential
          if (totalPages && totalPages > 1) {
            loadPagesInParallel(container, containerKey, totalPages);
          } else {
            loadNextPages(container, containerKey, nextLink.getAttribute('href'));
          }
        } else {
          containerData.isLoading = false;
          updateGroupsWithPaginatedData(containerKey);
        }
      });
    } catch (error) {
      utils.logError('loadAllPaginatedItems', error);
    }
  }

  // Parallel page loading (Finsweet-inspired optimization)
  async function loadPagesInParallel(container, containerKey, totalPages) {
    const containerData = cache.paginatedData.get(containerKey);
    if (!containerData) return;

    // Extract the pagination parameter from the URL
    const paginationWrapper = container.querySelector('.w-pagination-wrapper');
    const nextLink = paginationWrapper?.querySelector('.w-pagination-next');
    if (!nextLink) return;

    const nextUrl = new URL(nextLink.getAttribute('href'), window.location.origin);
    const urlParams = new URLSearchParams(nextUrl.search);

    // Find the pagination parameter (usually the first param in the next URL)
    let paginationParam = null;
    for (const [key, value] of urlParams.entries()) {
      if (value === '2') { // Next page is always 2
        paginationParam = key;
        break;
      }
    }

    if (!paginationParam) {
      // Fallback to sequential if we can't determine the param
      if (CONFIG.DEBUG_MODE) {
        console.warn('[CheckboxFilter] Could not determine pagination param, falling back to sequential');
      }
      loadNextPages(container, containerKey, nextLink.getAttribute('href'));
      return;
    }

    if (CONFIG.DEBUG_MODE) {
      console.log(`[CheckboxFilter] Loading ${totalPages} pages in parallel using param: ${paginationParam}`);
    }

    // Create fetch promises for all pages (starting from page 2)
    const fetchPromises = [];
    let pagesLoaded = 0;

    for (let pageNumber = 2; pageNumber <= totalPages; pageNumber++) {
      const pagePromise = (async () => {
        // Wait for the previous page to complete (maintains order)
        if (pageNumber > 2) {
          await fetchPromises[pageNumber - 3]; // -3 because array is 0-indexed and we start at page 2
        }

        const { origin, pathname } = window.location;
        const pageUrl = `${origin}${pathname}?${paginationParam}=${pageNumber}`;

        if (containerData.pagesLoaded.has(pageUrl)) return;

        try {
          const response = await fetch(pageUrl);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const html = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');

          const containers = doc.querySelectorAll('[seamless-replace="true"]');
          const containerIndex = Array.from(document.querySelectorAll('[seamless-replace="true"]')).indexOf(container);
          const newContainer = containers[containerIndex];

          if (newContainer) {
            const newCheckboxes = newContainer.querySelectorAll('[checkbox-filter]');
            newCheckboxes.forEach(checkbox => {
              const groupName = checkbox.getAttribute('checkbox-filter');
              const labelText = extractLabelText(checkbox);
              if (groupName && labelText && !containerData.allCheckboxes.some(item =>
                item.groupName === groupName && item.labelText === labelText)) {
                containerData.allCheckboxes.push({ groupName, labelText, element: checkbox.cloneNode(true) });

                // Immediately add to cache groups if there's an active search
                const searchTerm = activeSearchTerms.get(groupName);
                if (searchTerm !== undefined) {
                  const checkboxData = cache.checkboxGroups.get(groupName);
                  if (checkboxData && !checkboxData.some(item => item.labelText === labelText)) {
                    checkboxData.push({
                      element: checkbox.cloneNode(true),
                      labelText: labelText,
                      normalizedText: utils.normalizeText(labelText),
                      searchTokens: createSearchTokens(labelText),
                      isVisible: false,
                      isPaginated: true
                    });

                    // Trigger filter update for this group
                    filterCheckboxGroup(groupName, searchTerm);
                  }
                }
              }
            });

            containerData.pagesLoaded.add(pageUrl);
          }

          // Update progress
          pagesLoaded++;
        } catch (error) {
          utils.logError(`loadPagesInParallel page ${pageNumber}`, error);
        }
      })();

      fetchPromises.push(pagePromise);
    }

    // Wait for all pages to complete
    await Promise.all(fetchPromises);

    containerData.isLoading = false;
    updateGroupsWithPaginatedData(containerKey);

    // Hide searching indicator now that pagination is complete
    // Check if there's still an active search for any group in this container
    const hasActiveSearch = Array.from(activeSearchTerms.values()).some(term => term !== '');
    if (hasActiveSearch) {
      hideSearchingIndicator(container);
    }

    if (CONFIG.DEBUG_MODE) {
      console.log(`[CheckboxFilter] Parallel loading complete. Loaded ${containerData.pagesLoaded.size} pages`);
    }
  }

  function loadNextPages(container, containerKey, nextUrl) {
    const containerData = cache.paginatedData.get(containerKey);
    if (!containerData || containerData.pagesLoaded.has(nextUrl)) {
      containerData.isLoading = false;
      updateGroupsWithPaginatedData(containerKey);
      return;
    }

    fetch(nextUrl)
      .then(response => response.text())
      .then(html => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const containers = doc.querySelectorAll('[seamless-replace="true"]');
        const containerIndex = parseInt(containerKey.split('_')[1]);
        const newContainer = containers[containerIndex];

        if (newContainer) {
          const newCheckboxes = newContainer.querySelectorAll('[checkbox-filter]');
          newCheckboxes.forEach(checkbox => {
            const groupName = checkbox.getAttribute('checkbox-filter');
            const labelText = extractLabelText(checkbox);
            if (groupName && labelText && !containerData.allCheckboxes.some(item =>
              item.groupName === groupName && item.labelText === labelText)) {
              containerData.allCheckboxes.push({ groupName, labelText, element: checkbox.cloneNode(true) });
            }
          });

          containerData.pagesLoaded.add(nextUrl);

          const nextLink = newContainer.querySelector('.w-pagination-next');
          if (nextLink?.getAttribute('href')) {
            loadNextPages(container, containerKey, nextLink.getAttribute('href'));
          } else {
            containerData.isLoading = false;
            updateGroupsWithPaginatedData(containerKey);
          }
        } else {
          containerData.isLoading = false;
          updateGroupsWithPaginatedData(containerKey);
        }
      })
      .catch(() => {
        containerData.isLoading = false;
        updateGroupsWithPaginatedData(containerKey);
      });
  }

  function updateGroupsWithPaginatedData(containerKey) {
    try {
      const containerData = cache.paginatedData.get(containerKey);
      if (!containerData) return;

      containerData.allCheckboxes.forEach(({ groupName, labelText, element }) => {
        const checkboxData = cache.checkboxGroups.get(groupName);
        if (checkboxData && !checkboxData.some(item => item.labelText === labelText)) {
          checkboxData.push({
            element: element,
            labelText: labelText,
            normalizedText: utils.normalizeText(labelText),
            searchTokens: createSearchTokens(labelText),
            isVisible: false,
            isPaginated: true
          });
        }
      });
    } catch (error) {
      // Silently fail
    }
  }

  function setupElements() {
    try {
      cache.searchBoxes.clear();
      cache.clearButtons.clear();
      cache.checkboxGroups.clear();

      const allElements = document.querySelectorAll(`
        ${CONFIG.SELECTORS.SEARCH_BOX},
        ${CONFIG.SELECTORS.CLEAR_BUTTON},
        ${CONFIG.SELECTORS.CHECKBOX}
      `);

      const tempData = {
        searchBoxes: [],
        clearButtons: [],
        checkboxes: {}
      };

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

      tempData.searchBoxes.forEach(element => {
        const groupName = element.getAttribute('searchbox-filter');
        if (groupName) {
          cache.searchBoxes.set(groupName, element);
        }
      });

      tempData.clearButtons.forEach(element => {
        const groupName = element.getAttribute('clear-text-input');
        if (groupName) {
          cache.clearButtons.set(groupName, element);
        }
      });

      Object.entries(tempData.checkboxes).forEach(([groupName, elements]) => {
        const processedElements = elements.map(element => {
          const labelText = extractLabelText(element);
          return {
            element: element,
            labelText: labelText,
            normalizedText: utils.normalizeText(labelText),
            searchTokens: createSearchTokens(labelText),
            isVisible: true,
            isPaginated: false
          };
        });

        cache.checkboxGroups.set(groupName, processedElements);
      });
    } catch (error) {
      // Silently fail
    }
  }

  function extractLabelText(checkboxElement) {
    for (const method of labelExtractionMethods) {
      try {
        const text = method(checkboxElement);
        if (text?.trim()) {
          return text.trim();
        }
      } catch (e) {
        continue;
      }
    }
    return '';
  }

  function createSearchTokens(text) {
    const tokens = text.toLowerCase().split(/\s+/);
    const ngrams = [];

    for (let n = 2; n <= 3; n++) {
      for (let i = 0; i <= text.length - n; i++) {
        ngrams.push(text.toLowerCase().substr(i, n));
      }
    }

    return { tokens, ngrams };
  }

  function calculateMatchScore(searchLower, searchTokens, item) {
    let score = 0;

    if (item.normalizedText === searchLower) {
      return 1.0;
    }

    if (item.normalizedText.startsWith(searchLower)) {
      score = 0.9;
    }
    else if (item.normalizedText.includes(searchLower)) {
      score = 0.7;
    }

    if (searchTokens.length > 1) {
      const matchedTokens = searchTokens.filter(token =>
        item.searchTokens.tokens.some(itemToken => itemToken.includes(token))
      );
      score = Math.max(score, matchedTokens.length / searchTokens.length * 0.8);
    }

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

  // Setup MutationObserver for Finsweet tags container
  function setupFinsweetTagObserver() {
    try {
      // Find Finsweet tags container
      const tagsContainer = document.querySelector('[fs-list-element="tags"]');

      if (!tagsContainer) {
        if (CONFIG.DEBUG_MODE) {
          console.log('[CheckboxFilter] No Finsweet tags container found');
        }
        return;
      }

      // Disconnect existing observer
      if (finsweetTagObserver) {
        finsweetTagObserver.disconnect();
      }

      // Create new observer for tag container changes
      finsweetTagObserver = new MutationObserver((mutations) => {
        let shouldSync = false;

        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            // Tags were added or removed
            if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
              shouldSync = true;
            }
          }
        });

        if (shouldSync) {
          debouncedSyncWithFinsweet();
        }
      });

      // Observe the tags container
      finsweetTagObserver.observe(tagsContainer, {
        childList: true,
        subtree: true
      });

      if (CONFIG.DEBUG_MODE) {
        console.log('[CheckboxFilter] Finsweet tag observer initialized');
      }

    } catch (error) {
      utils.logError('setupFinsweetTagObserver', error);
    }
  }

  // Finsweet integration for tag removal
  function setupFinsweetIntegration() {
    try {
      // Setup MutationObserver for tags container
      setupFinsweetTagObserver();

      // Listen for Finsweet filter events
      const finsweetEvents = [
        'fs-cmsfilter-change',
        'fs-cmsfilter-reset',
        'fs-cmsfilter-click'
      ];

      finsweetEvents.forEach(eventName => {
        const handler = (e) => {
          // Sync checkbox states with Finsweet active filters (debounced)
          debouncedSyncWithFinsweet();
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

      // Listen for clicks on tag-remove elements using event delegation
      const tagRemoveHandler = (e) => {
        const tagRemove = e.target.closest('[fs-list-element="tag-remove"]');
        if (!tagRemove) return;

        // Use debounced sync to avoid excessive calls
        debouncedSyncWithFinsweet();
      };

      document.addEventListener('click', tagRemoveHandler, true);

      if (!cache.eventListeners.has('finsweet')) {
        cache.eventListeners.set('finsweet', []);
      }
      cache.eventListeners.get('finsweet').push({
        element: document,
        event: 'click',
        handler: tagRemoveHandler
      });

    } catch (error) {
      utils.logError('setupFinsweetIntegration', error);
    }
  }

  // Batched checkbox update system using requestAnimationFrame
  function batchCheckboxUpdate(element, updates) {
    if (!element) return;

    // Store pending updates
    if (!pendingCheckboxUpdates.has(element)) {
      pendingCheckboxUpdates.set(element, {});
    }
    Object.assign(pendingCheckboxUpdates.get(element), updates);

    // Schedule batch update if not already scheduled
    if (!updateAnimationFrame) {
      updateAnimationFrame = requestAnimationFrame(() => {
        flushCheckboxUpdates();
      });
    }
  }

  // Flush all pending checkbox updates in a single frame
  function flushCheckboxUpdates() {
    pendingCheckboxUpdates.forEach((updates, element) => {
      // Apply all updates at once
      if (updates.checked !== undefined) {
        const checkbox = element.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = updates.checked;
      }

      if (updates.labelClass !== undefined) {
        const label = element.querySelector('label');
        if (label) {
          if (updates.labelClass) {
            label.classList.add('is-list-active');
          } else {
            label.classList.remove('is-list-active');
          }
        }
      }

      if (updates.checkboxInputClass !== undefined) {
        const checkboxInput = element.querySelector('.w-checkbox-input');
        if (checkboxInput) {
          if (updates.checkboxInputClass) {
            checkboxInput.classList.add('w--redirected-checked');
          } else {
            checkboxInput.classList.remove('w--redirected-checked');
          }
        }
      }
    });

    // Clear pending updates
    pendingCheckboxUpdates.clear();
    updateAnimationFrame = null;

    // Dispatch custom event after updates complete
    dispatchSyncCompleteEvent();
  }

  // Custom event dispatch
  function dispatchSyncCompleteEvent() {
    const event = new CustomEvent('checkboxfilter:synccomplete', {
      detail: {
        timestamp: Date.now(),
        updatedCount: pendingCheckboxUpdates.size
      },
      bubbles: true,
      cancelable: false
    });
    document.dispatchEvent(event);
  }

  // Debounced sync function
  function debouncedSyncWithFinsweet() {
    if (syncDebounceTimer) {
      clearTimeout(syncDebounceTimer);
    }
    syncDebounceTimer = setTimeout(() => {
      syncCheckboxStatesWithFinsweet();
    }, 50);
  }

  // Sync checkbox states with Finsweet active filters
  function syncCheckboxStatesWithFinsweet() {
    try {
      // Get all checked Finsweet checkboxes directly
      const checkedInputs = document.querySelectorAll('input[fs-list-field][fs-list-value]:checked');
      const activeValues = new Map(); // field -> Set of values

      checkedInputs.forEach(input => {
        const field = input.getAttribute('fs-list-field');
        const value = input.getAttribute('fs-list-value');
        if (field && value) {
          if (!activeValues.has(field)) {
            activeValues.set(field, new Set());
          }
          activeValues.get(field).add(value.toLowerCase());
        }
      });

      // Check all checkboxes and sync their state (using batched updates)
      cache.checkboxGroups.forEach((checkboxData, groupName) => {
        checkboxData.forEach(item => {
          if (!item.element) return;

          // Cache metadata in WeakMap for better performance
          let metadata = cache.elementMetadata.get(item.element);
          if (!metadata) {
            const checkbox = item.element.querySelector('input[type="checkbox"]');
            metadata = {
              checkbox,
              fsListField: checkbox?.getAttribute('fs-list-field'),
              fsListValue: checkbox?.getAttribute('fs-list-value')
            };
            cache.elementMetadata.set(item.element, metadata);
          }

          let isActive = false;

          // Check by Finsweet attributes first (more reliable)
          if (metadata.fsListField && metadata.fsListValue && activeValues.has(metadata.fsListField)) {
            isActive = activeValues.get(metadata.fsListField).has(metadata.fsListValue.toLowerCase());
          }
          // Fallback to text matching for non-Finsweet checkboxes
          else {
            const activeTags = document.querySelectorAll('[fs-list-element="tag-label"]');
            const activeTagTexts = new Set();
            activeTags.forEach(tag => {
              const text = tag.textContent?.trim();
              if (text) activeTagTexts.add(text.toLowerCase());
            });
            isActive = activeTagTexts.has(item.labelText.toLowerCase());
          }

          // Use batched updates for better performance
          batchCheckboxUpdate(item.element, {
            checked: isActive,
            labelClass: isActive,
            checkboxInputClass: isActive
          });
        });
      });

      // Also update persistent checked states
      cache.persistentCheckedStates.forEach((groupStates, groupName) => {
        groupStates.forEach((isChecked, labelText) => {
          // Check if this labelText is in active values
          let shouldBeChecked = false;
          activeValues.forEach(valueSet => {
            if (valueSet.has(labelText.toLowerCase())) {
              shouldBeChecked = true;
            }
          });

          if (isChecked !== shouldBeChecked) {
            groupStates.set(labelText, shouldBeChecked);
          }
        });
      });

    } catch (error) {
      // Silently fail
    }
  }

  function setupEventListeners() {
    try {
      cleanupEventListeners();

      cache.searchBoxes.forEach((searchBox, groupName) => {
        const handler = (e) => filterCheckboxGroup(groupName, e.target.value);
        searchBox.addEventListener('input', handler);

        if (!cache.eventListeners.has(groupName)) {
          cache.eventListeners.set(groupName, []);
        }
        cache.eventListeners.get(groupName).push({
          element: searchBox,
          event: 'input',
          handler: handler
        });
      });

      cache.clearButtons.forEach((clearButton, groupName) => {
        const handler = (e) => {
          e.preventDefault();
          clearTextInput(groupName);
        };
        clearButton.addEventListener('click', handler);

        if (!cache.eventListeners.has(groupName)) {
          cache.eventListeners.set(groupName, []);
        }
        cache.eventListeners.get(groupName).push({
          element: clearButton,
          event: 'click',
          handler: handler
        });
      });

      // Finsweet filter integration - listen for tag removal
      setupFinsweetIntegration();
    } catch (error) {
      // Silently fail
    }
  }

  function cleanupEventListeners() {
    cache.eventListeners.forEach((listeners) => {
      listeners.forEach(({ element, event, handler }) => {
        try {
          element.removeEventListener(event, handler);
        } catch (e) {
          utils.logError('cleanupEventListeners', e);
        }
      });
    });
    cache.eventListeners.clear();

    // Cleanup observers
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }

    if (finsweetTagObserver) {
      finsweetTagObserver.disconnect();
      finsweetTagObserver = null;
    }

    // Cancel pending animation frames
    if (updateAnimationFrame) {
      cancelAnimationFrame(updateAnimationFrame);
      updateAnimationFrame = null;
    }

    // Clear pending updates
    pendingCheckboxUpdates.clear();
  }

  function initializeGroups() {
    if (isInitializing) return;

    cache.checkboxGroups.forEach((_, groupName) => {
      filterCheckboxGroup(groupName, '');
    });
  }

  function clearTextInput(groupName) {
    try {
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
    } catch (error) {
      // Silently fail
    }
  }

  function filterCheckboxGroup(groupName, searchTerm) {
    try {
      const checkboxData = cache.checkboxGroups.get(groupName);

      if (!checkboxData) return;

      const normalizedSearchTerm = utils.normalizeText(searchTerm);
      const showAll = normalizedSearchTerm === '';

      // Mode detection for seamless containers
      let targetContainer = null;
      let itemsContainer = null;

      const firstGroupCheckbox = document.querySelector(`[checkbox-filter="${groupName}"]`);
      if (firstGroupCheckbox) {
        targetContainer = firstGroupCheckbox.closest('[seamless-replace="true"]');
        if (targetContainer) {
          itemsContainer = targetContainer.querySelector('.w-dyn-items');
        }
      }

      // Track the active search term for this group
      if (showAll) {
        activeSearchTerms.delete(groupName);
      } else {
        activeSearchTerms.set(groupName, searchTerm);
      }

      // Show searching indicator when actually searching (not when clearing)
      if (!showAll && targetContainer) {
        showSearchingIndicator(targetContainer);
      }

      if (!itemsContainer && firstGroupCheckbox) {
        itemsContainer = firstGroupCheckbox.closest('.w-dyn-items') ||
                        firstGroupCheckbox.closest('.collection-list') ||
                        firstGroupCheckbox.parentElement;
      }

      let isLoadMoreMode = false;
      let seamlessContainer = null;

      if (firstGroupCheckbox) {
        seamlessContainer = firstGroupCheckbox.closest('[seamless-replace="true"]');
      } else if (window.containerData && typeof window.containerData === 'object') {
        const allSeamlessContainers = document.querySelectorAll('[seamless-replace="true"]');
        for (let container of allSeamlessContainers) {
          const containerIndex = Array.from(allSeamlessContainers).indexOf(container);
          if (window.containerData.has && window.containerData.has(containerIndex)) {
            const containerDataMap = window.containerData.get(containerIndex);
            if (containerDataMap.allItems && containerDataMap.allItems.some(item =>
              item.getAttribute && item.getAttribute('checkbox-filter') === groupName)) {
              seamlessContainer = container;
              break;
            }
          }
        }
      }

      if (seamlessContainer && window.containerData && typeof window.containerData === 'object') {
        const containerIndex = Array.from(document.querySelectorAll('[seamless-replace="true"]')).indexOf(seamlessContainer);
        isLoadMoreMode = containerIndex >= 0 && window.containerData.has && window.containerData.has(containerIndex);
      }

      // Check if pagination is still loading
      const containerIndex = targetContainer ? Array.from(document.querySelectorAll('[seamless-replace="true"]')).indexOf(targetContainer) : -1;
      const containerKey = containerIndex >= 0 ? `container_${containerIndex}` : null;
      const containerData = containerKey ? cache.paginatedData.get(containerKey) : null;
      const isPaginationLoading = containerData?.isLoading || false;

      if (isLoadMoreMode) {
        // Load More mode - search through all items
        let targetContainerIndex = Array.from(document.querySelectorAll('[seamless-replace="true"]')).indexOf(seamlessContainer);
        let loadMoreTargetContainer = seamlessContainer;

        if (loadMoreTargetContainer) {
          itemsContainer = loadMoreTargetContainer.querySelector('.w-dyn-items');
        }

        if (targetContainerIndex !== null && window.containerData.has && window.containerData.has(targetContainerIndex)) {
          const containerDataMap = window.containerData.get(targetContainerIndex);

          if (itemsContainer && containerDataMap.allItems) {
            if (!cache.persistentCheckedStates.has(groupName)) {
              cache.persistentCheckedStates.set(groupName, new Map());
            }
            const groupCheckedStates = cache.persistentCheckedStates.get(groupName);

            // Only update persistent states if NOT during load more
            if (!isLoadingMore) {
              const currentCheckboxes = document.querySelectorAll(`[checkbox-filter="${groupName}"]`);
              currentCheckboxes.forEach(checkbox => {
                const labelText = extractLabelText(checkbox);
                if (labelText) {
                  const isChecked = isCheckboxChecked(checkbox);
                  if (!groupCheckedStates.has(labelText) || groupCheckedStates.get(labelText) !== isChecked) {
                    groupCheckedStates.set(labelText, isChecked);
                  }
                }
              });
            }

            if (showAll) {
              // Restore normal pagination display
              const container = loadMoreTargetContainer;
              if (container) {
                const targetItemsContainer = container.querySelector('.w-dyn-items');
                if (targetItemsContainer) {
                  targetItemsContainer.innerHTML = '';

                  const $container = $(container);
                  const $nextButton = $container.find('.w-pagination-next');

                  const userLoadedMorePages = containerDataMap.currentPage > 1;
                  const buttonExplicitlyHidden = $nextButton.is(':hidden');
                  const allItemsLoaded = userLoadedMorePages && (buttonExplicitlyHidden || containerDataMap.currentPage * containerDataMap.itemsPerPage >= containerDataMap.allItems.length);

                  let itemsToShow;
                  if (allItemsLoaded) {
                    itemsToShow = containerDataMap.allItems.length;
                  } else {
                    itemsToShow = Math.max(containerDataMap.currentPage, 1) * containerDataMap.itemsPerPage;
                  }

                  const itemsToDisplay = containerDataMap.allItems.slice(0, itemsToShow);

                  itemsToDisplay.forEach(element => {
                    const clonedElement = element.cloneNode(true);
                    clonedElement.style.display = 'block';
                    clonedElement.style.visibility = 'visible';
                    clonedElement.style.opacity = '1';
                    clonedElement.removeAttribute('data-filtered');
                    clonedElement.removeAttribute('data-search-result');
                    targetItemsContainer.appendChild(clonedElement);

                    if (clonedElement.hasAttribute('checkbox-filter')) {
                      const elementGroupName = clonedElement.getAttribute('checkbox-filter');
                      restoreCheckedState(clonedElement, elementGroupName);
                    }
                  });

                  if (itemsToShow >= containerDataMap.allItems.length) {
                    $nextButton.hide();
                  } else {
                    $nextButton.show();
                  }

                  if (typeof Webflow !== 'undefined' && Webflow.require) {
                    Webflow.require('ix2').init();
                  }

                  // Hide searching indicator only if pagination is complete
                  if (loadMoreTargetContainer && !isPaginationLoading) {
                    hideSearchingIndicator(loadMoreTargetContainer);
                  }

                  // Hide empty state when showing all (no search)
                  hideEmptyState(loadMoreTargetContainer);
                }
              }
            } else {
              // Search mode
              itemsContainer.innerHTML = '';

              const $container = $(loadMoreTargetContainer);
              const $nextButton = $container.find('.w-pagination-next');

              // Hide load more button when searching
              $nextButton.hide();

              const searchTokens = normalizedSearchTerm.split(/\s+/);

              containerDataMap.allItems.forEach((element, index) => {
                const clonedForCheck = element.cloneNode(true);

                const hasCheckboxFilter = clonedForCheck.hasAttribute('checkbox-filter');
                const containsChild = clonedForCheck.querySelector('[checkbox-filter]');

                if (!hasCheckboxFilter && !containsChild) return;

                const workingElement = hasCheckboxFilter ? clonedForCheck : clonedForCheck.querySelector('[checkbox-filter]');
                if (!workingElement) return;

                const labelText = extractLabelText(workingElement);
                if (!labelText) return;

                const groupCheckedStates = cache.persistentCheckedStates.get(groupName) || new Map();
                const isChecked = groupCheckedStates.has(labelText) ? groupCheckedStates.get(labelText) : false;

                let shouldShow = false;

                if (isChecked) {
                  shouldShow = true;
                } else {
                  const normalizedLabel = utils.normalizeText(labelText);
                  const searchTokens = createSearchTokens(normalizedSearchTerm);
                  const itemData = {
                    normalizedText: normalizedLabel,
                    searchTokens: createSearchTokens(labelText)
                  };
                  const score = calculateMatchScore(normalizedSearchTerm, searchTokens.tokens, itemData);
                  shouldShow = score > CONFIG.SCORE_THRESHOLD;
                }

                if (shouldShow) {
                  const clonedElement = element.cloneNode(true);
                  clonedElement.style.display = 'block';
                  clonedElement.style.visibility = 'visible';
                  clonedElement.style.opacity = '1';
                  clonedElement.removeAttribute('data-filtered');
                  clonedElement.setAttribute('data-search-result', 'true');

                  itemsContainer.appendChild(clonedElement);
                  restoreCheckedState(clonedElement, groupName);
                }
              });

              // Hide searching indicator only if pagination is complete
              if (loadMoreTargetContainer && !isPaginationLoading) {
                hideSearchingIndicator(loadMoreTargetContainer);
              }

              // Show/hide empty state immediately based on current results
              const hasResults = itemsContainer.children.length > 0;
              if (!hasResults) {
                // Show empty state immediately when no results (even if pagination still loading)
                showEmptyState(loadMoreTargetContainer);
              } else {
                hideEmptyState(loadMoreTargetContainer);
              }
            }
          }
        }
        return;
      }

      // Regular mode
      requestAnimationFrame(() => {
        const elementsToShow = [];
        const elementsToHide = [];
        const searchTokens = normalizedSearchTerm.split(/\s+/);

        checkboxData.forEach(item => {
          let shouldShow = false;

          if (showAll) {
            shouldShow = true;
          } else {
            const isChecked = item.element && isCheckboxChecked(item.element);
            if (isChecked) {
              shouldShow = true;
            } else {
              const score = calculateMatchScore(normalizedSearchTerm, searchTokens, item);
              shouldShow = score > CONFIG.SCORE_THRESHOLD;
            }
          }

          if (shouldShow && !item.isVisible) {
            elementsToShow.push(item);
            item.isVisible = true;
          } else if (!shouldShow && item.isVisible) {
            elementsToHide.push(item);
            item.isVisible = false;
          }
        });

        elementsToShow.forEach(item => showElement(item.element));
        elementsToHide.forEach(item => hideElement(item.element));

        // Hide searching indicator only if pagination is complete
        if (targetContainer && !isPaginationLoading) {
          hideSearchingIndicator(targetContainer);
        }

        // Show/hide empty state based on results
        if (targetContainer) {
          const hasVisibleResults = elementsToShow.length > 0 || checkboxData.some(item => item.isVisible);
          if (!showAll && !hasVisibleResults) {
            // Show empty state immediately when no results (even if pagination still loading)
            showEmptyState(targetContainer);
          } else {
            hideEmptyState(targetContainer);
          }
        }
      });
    } catch (error) {
      // Silently fail
      // Hide indicator on error only if pagination is complete
      if (targetContainer && !isPaginationLoading) {
        hideSearchingIndicator(targetContainer);
      }
    }
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

  function restoreCheckedState(clonedElement, groupName) {
    try {
      const labelText = extractLabelText(clonedElement);
      if (!labelText) return;

      const groupCheckedStates = cache.persistentCheckedStates.get(groupName);
      if (!groupCheckedStates || !groupCheckedStates.has(labelText)) return;

      const shouldBeChecked = groupCheckedStates.get(labelText);
      if (!shouldBeChecked) return;

      const label = clonedElement.querySelector('label');
      if (label) {
        label.classList.add('is-list-active');
      }

      const checkboxInput = clonedElement.querySelector('.w-checkbox-input');
      if (checkboxInput) {
        checkboxInput.classList.add('w--redirected-checked');
      }

      const input = clonedElement.querySelector('input[type="checkbox"]');
      if (input) {
        input.checked = true;
      }
    } catch (error) {
      // Silently fail
    }
  }

  function hideElement(element) {
    if (element) {
      element.style.display = 'none';
      element.setAttribute('data-filtered', 'hidden');
    }
  }

  function showElement(element) {
    if (element) {
      element.style.display = '';
      element.removeAttribute('data-filtered');
      element.classList.remove('hidden', 'hide', 'invisible');
    }
  }

  // Public API
  /**
   * CheckboxFilter Public API
   *
   * Custom Events Dispatched:
   * - 'checkboxfilter:synccomplete' - Fired after Finsweet sync completes
   *   event.detail: { timestamp, updatedCount }
   *
   * Usage Example:
   * document.addEventListener('checkboxfilter:synccomplete', (e) => {
   *   console.log('Sync complete:', e.detail);
   * });
   */
  window.checkboxFilterScript = {
    // Recache all elements (call after DOM updates)
    recacheElements() {
      // Save scroll positions before DOM updates
      saveScrollPositions();

      // Reset load more flag - this indicates seamless script has finished updating DOM
      if (isLoadingMore) {
        isLoadingMore = false;
      }

      if (isInitialized) {
        setupElements();
        setupEventListeners();
        initializeGroups();
        setupLoadMoreHandlers();
        loadAllPaginatedItems();
        this.restoreAllCheckedStates();

        // Restore scroll positions after DOM updates
        restoreScrollPositions();
      } else {
        initializeFilters();
      }
    },

    // Force complete rebuild of all caches and listeners
    forceRebuild() {
      cache.searchBoxes.clear();
      cache.clearButtons.clear();
      cache.checkboxGroups.clear();
      cleanupEventListeners();

      setupElements();
      setupEventListeners();
      initializeGroups();
    },

    // Filter a specific checkbox group
    filterGroup(groupName, searchTerm) {
      filterCheckboxGroup(groupName, searchTerm);
    },

    // Get statistics about cached elements
    getCacheStats() {
      const stats = {};
      cache.checkboxGroups.forEach((data, groupName) => {
        stats[groupName] = {
          total: data.length,
          visible: data.filter(item => item.isVisible).length,
          paginated: data.filter(item => item.isPaginated).length
        };
      });

      stats.pagination = {};
      cache.paginatedData.forEach((data, key) => {
        stats.pagination[key] = {
          totalCheckboxes: data.allCheckboxes.length,
          pagesLoaded: data.pagesLoaded.size,
          isLoading: data.isLoading
        };
      });

      return stats;
    },

    // Restore checked states for all checkboxes
    restoreAllCheckedStates() {
      setTimeout(() => {
        cache.persistentCheckedStates.forEach((groupStates, groupName) => {
          const checkboxes = document.querySelectorAll(`[checkbox-filter="${groupName}"]`);
          checkboxes.forEach(checkbox => {
            restoreCheckedState(checkbox, groupName);
          });
        });
      }, CONFIG.RESTORE_DELAY);
    },

    // Capture current checked states
    captureCurrentCheckedStates() {
      cache.checkboxGroups.forEach((_, groupName) => {
        if (!cache.persistentCheckedStates.has(groupName)) {
          cache.persistentCheckedStates.set(groupName, new Map());
        }
        const groupStates = cache.persistentCheckedStates.get(groupName);

        const checkboxes = document.querySelectorAll(`[checkbox-filter="${groupName}"]`);
        checkboxes.forEach(checkbox => {
          const labelText = extractLabelText(checkbox);
          if (labelText) {
            const isChecked = isCheckboxChecked(checkbox);
            if (groupStates.get(labelText) !== isChecked) {
              groupStates.set(labelText, isChecked);
            }
          }
        });
      });
    },

    // Manually sync checkboxes with Finsweet filters (batched)
    syncWithFinsweet() {
      syncCheckboxStatesWithFinsweet();
    },

    // Flush pending checkbox updates immediately
    flushUpdates() {
      if (updateAnimationFrame) {
        cancelAnimationFrame(updateAnimationFrame);
        updateAnimationFrame = null;
      }
      flushCheckboxUpdates();
    },

    // Enable/disable debug mode
    setDebugMode(enabled) {
      CONFIG.DEBUG_MODE = !!enabled;
      if (enabled) {
        console.log('[CheckboxFilter] Debug mode enabled');
      }
    }
  };

})();
