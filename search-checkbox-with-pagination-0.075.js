/*!
 * Checkbox Filter with Pagination Support v2.0.0 (Web Worker Edition)
 * Real-time checkbox filtering with fuzzy search and seamless pagination
 * Compatible with Webflow CMS, seamless-load-more.html, and Finsweet CMS Filter
 *
 * Major Changes in v2.0.0:
 * - Web Worker implementation for off-thread filtering (Finsweet-inspired)
 * - Lightweight data model - stores field data instead of DOM clones
 * - Worker pool for parallel processing
 * - Significantly faster performance with large datasets
 * - Reduced memory footprint
 *
 * Features:
 * - Real-time search with fuzzy matching
 * - Seamless pagination support with load more
 * - Persistent checked states across searches and pagination
 * - Multiple container support
 * - Automatic state restoration
 * - Full Finsweet CMS Filter integration (syncs with tag-remove)
 * - Advanced performance optimizations (Web Workers, batching, WeakMap caching)
 * - Custom events for integration with other scripts
 * - Intelligent parallel page loading
 * - Real-time search during pagination loading
 * - User-controlled searching indicator
 * - Automatic scroll position preservation
 * - Smart empty state handling
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
    SEARCH_DEBOUNCE_MS: 150,
    WORKER_POOL_SIZE: navigator.hardwareConcurrency || 4,
    DEBUG_MODE: false
  };

  // Web Worker inline code (embedded to avoid external file dependency)
  const workerCode =
    'self.onmessage = (e) => {' +
    '  const { items, searchTerm, scoreThreshold } = e.data;' +
    '  if (!searchTerm || searchTerm.trim() === "") {' +
    '    self.postMessage({ filteredItems: items.map(item => ({ id: item.id, score: 0 })) });' +
    '    return;' +
    '  }' +
    '  const normalizedSearchTerm = searchTerm.toLowerCase().trim();' +
    '  const searchTokens = normalizedSearchTerm.split(/\\s+/);' +
    '  const results = [];' +
    '  for (const item of items) {' +
    '    let score = 0;' +
    '    const normalizedLabel = item.normalizedText;' +
    '    if (item.isChecked) {' +
    '      results.push({ id: item.id, score: 1.1 });' +
    '      continue;' +
    '    }' +
    '    if (normalizedLabel === normalizedSearchTerm) {' +
    '      score = 1.0;' +
    '    } else if (normalizedLabel.startsWith(normalizedSearchTerm)) {' +
    '      score = 0.9;' +
    '    } else if (normalizedLabel.includes(normalizedSearchTerm)) {' +
    '      score = 0.7;' +
    '    }' +
    '    if (searchTokens.length > 1) {' +
    '      const matchedTokens = searchTokens.filter(token => item.tokens.some(itemToken => itemToken.includes(token)));' +
    '      score = Math.max(score, matchedTokens.length / searchTokens.length * 0.8);' +
    '    }' +
    '    if (score < 0.5) {' +
    '      const searchNgrams = [];' +
    '      for (let i = 0; i <= normalizedSearchTerm.length - 2; i++) {' +
    '        searchNgrams.push(normalizedSearchTerm.substr(i, 2));' +
    '      }' +
    '      let matches = 0;' +
    '      for (const ngram of searchNgrams) {' +
    '        if (item.ngrams.includes(ngram)) matches++;' +
    '      }' +
    '      const fuzzyScore = matches / Math.max(searchNgrams.length, 1) * 0.6;' +
    '      score = Math.max(score, fuzzyScore);' +
    '    }' +
    '    if (score > scoreThreshold) {' +
    '      results.push({ id: item.id, score });' +
    '    }' +
    '  }' +
    '  results.sort((a, b) => b.score - a.score);' +
    '  self.postMessage({ filteredItems: results });' +
    '};';

  // Create worker pool
  const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
  const workerURL = URL.createObjectURL(workerBlob);
  const workers = Array.from({ length: CONFIG.WORKER_POOL_SIZE }, () => new Worker(workerURL));
  const freeWorkers = workers.slice();
  const taskQueue = [];

  // Process filter task using a worker
  const processFilterTask = (worker, task) => {
    const controller = new AbortController();
    const { signal } = controller;

    const conclude = () => {
      controller.abort();
      const nextTask = taskQueue.shift();
      if (nextTask) {
        processFilterTask(worker, nextTask);
      } else {
        freeWorkers.push(worker);
      }
    };

    worker.addEventListener('message', (event) => {
      task.resolve(event.data);
      conclude();
    }, { signal, once: true });

    worker.addEventListener('error', (error) => {
      task.reject(error);
      conclude();
    }, { signal, once: true });

    worker.postMessage(task.data);
  };

  // Queue a filter task
  const queueFilterTask = (task) => {
    const worker = freeWorkers.pop();
    if (worker) {
      processFilterTask(worker, task);
    } else {
      taskQueue.push(task);
    }
  };

  // Run filter task with worker pool
  const runFilterTask = (data) => {
    return new Promise((resolve, reject) => {
      queueFilterTask({ data, resolve, reject });
    });
  };

  // Cache for checkbox elements and paginated data
  const cache = {
    searchBoxes: new Map(),
    clearButtons: new Map(),
    checkboxGroups: new Map(), // Now stores lightweight data items
    checkboxItemsById: new Map(), // id -> full item data with element reference
    eventListeners: new Map(),
    paginatedData: new Map(),
    loadingPromises: new Map(),
    persistentCheckedStates: new Map(),
    elementMetadata: new WeakMap()
  };

  // Pre-compiled utilities
  const utils = {
    normalizeText: (text) => text.toLowerCase().trim(),
    createInputEvent: () => new Event('input', { bubbles: true, cancelable: true }),
    logError: (context, error) => {
      if (CONFIG.DEBUG_MODE) {
        console.warn(`[CheckboxFilter] ${context}:`, error);
      }
    },
    generateId: () => `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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
    (element) => element.textContent?.replace(/\\s+/g, ' ')
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

  const activeSearchTerms = new Map();
  const scrollPositions = new Map();
  const searchDebounceTimers = new Map();

  // ====================================================================
  // SCROLL POSITION HELPERS
  // ====================================================================

  function saveScrollPositions() {
    try {
      const containers = document.querySelectorAll('[seamless-replace="true"]');
      containers.forEach(container => {
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
  // SEARCHING INDICATOR (REMOVED)
  // ====================================================================
  // Searching indicator functionality has been removed as requested

  // ====================================================================
  // FIELD DATA EXTRACTION (Finsweet-inspired)
  // ====================================================================

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
    const tokens = text.toLowerCase().split(/\\s+/);
    const ngrams = [];

    for (let n = 2; n <= 3; n++) {
      for (let i = 0; i <= text.length - n; i++) {
        ngrams.push(text.toLowerCase().substr(i, n));
      }
    }

    return { tokens, ngrams };
  }

  // Create lightweight item data (no DOM cloning!)
  function createItemData(element, groupName) {
    const id = utils.generateId();
    const labelText = extractLabelText(element);
    const normalizedText = utils.normalizeText(labelText);
    const { tokens, ngrams } = createSearchTokens(labelText);

    // Store full item data with element reference
    const fullItem = {
      id,
      element,
      groupName,
      labelText,
      normalizedText,
      tokens,
      ngrams,
      isVisible: true,
      isPaginated: false
    };

    cache.checkboxItemsById.set(id, fullItem);

    // Return serializable data for worker
    return {
      id,
      labelText,
      normalizedText,
      tokens,
      ngrams,
      isChecked: false // Will be updated dynamically
    };
  }

  // Create item data from cloned element (for pagination)
  function createItemDataFromClone(clonedElement, groupName) {
    const id = utils.generateId();
    const labelText = extractLabelText(clonedElement);
    const normalizedText = utils.normalizeText(labelText);
    const { tokens, ngrams } = createSearchTokens(labelText);

    const fullItem = {
      id,
      element: clonedElement,
      groupName,
      labelText,
      normalizedText,
      tokens,
      ngrams,
      isVisible: false,
      isPaginated: true
    };

    cache.checkboxItemsById.set(id, fullItem);

    return {
      id,
      labelText,
      normalizedText,
      tokens,
      ngrams,
      isChecked: false
    };
  }

  // ====================================================================
  // INITIALIZATION
  // ====================================================================

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

  function setupElements() {
    try {
      cache.searchBoxes.clear();
      cache.clearButtons.clear();
      cache.checkboxGroups.clear();
      cache.checkboxItemsById.clear();

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
        const processedItems = elements.map(element => createItemData(element, groupName));
        cache.checkboxGroups.set(groupName, processedItems);
      });
    } catch (error) {
      // Silently fail
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

      cache.checkboxItemsById.forEach((item) => {
        if (item.element?.parentElement) {
          containers.add(item.element.parentElement);
        }
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
                      const newItemData = createItemDataFromClone(element, groupName);
                      checkboxData.push(newItemData);
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

  // ====================================================================
  // PAGINATION LOADING (Optimized - Extract field data only)
  // ====================================================================

  function loadAllPaginatedItems() {
    try {
      const containers = document.querySelectorAll('[seamless-replace="true"]');

      containers.forEach((container, containerIndex) => {
        const containerKey = `container_${containerIndex}`;

        if (!cache.paginatedData.has(containerKey)) {
          cache.paginatedData.set(containerKey, {
            allCheckboxes: [], // Now stores lightweight field data, not DOM clones
            pagesLoaded: new Set(),
            isLoading: false,
            abortController: null
          });
        }

        const containerData = cache.paginatedData.get(containerKey);
        if (containerData.isLoading) return;

        if (containerData.abortController) {
          containerData.abortController.abort();
        }

        containerData.abortController = new AbortController();
        containerData.isLoading = true;
        const currentPageUrl = window.location.href;
        containerData.pagesLoaded.add(currentPageUrl);

        const currentCheckboxes = container.querySelectorAll('[checkbox-filter]');
        currentCheckboxes.forEach(checkbox => {
          const groupName = checkbox.getAttribute('checkbox-filter');
          const labelText = extractLabelText(checkbox);
          if (groupName && labelText && !containerData.allCheckboxes.some(item =>
            item.groupName === groupName && item.labelText === labelText)) {

            // Store lightweight field data instead of full clone
            const itemData = {
              groupName,
              labelText,
              normalizedText: utils.normalizeText(labelText),
              ...createSearchTokens(labelText),
              elementHTML: checkbox.outerHTML // Store HTML string instead of cloned node
            };
            containerData.allCheckboxes.push(itemData);
          }
        });

        const paginationWrapper = container.querySelector('.w-pagination-wrapper');
        const nextLink = paginationWrapper?.querySelector('.w-pagination-next');

        if (nextLink?.getAttribute('href')) {
          const paginationCountElement = container.querySelector('.w-pagination-count, [fs-cmspagination-element="count"]');
          let totalPages = null;

          if (paginationCountElement) {
            const countText = paginationCountElement.textContent?.trim();
            const match = countText?.match(/\/\s*(\d+)/);
            if (match) {
              totalPages = parseInt(match[1]);
              if (CONFIG.DEBUG_MODE) {
                console.log(`[CheckboxFilter] Found total pages: ${totalPages} for container ${containerIndex}`);
              }
            }
          }

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

  async function loadPagesInParallel(container, containerKey, totalPages) {
    const containerData = cache.paginatedData.get(containerKey);
    if (!containerData) return;

    const paginationWrapper = container.querySelector('.w-pagination-wrapper');
    const nextLink = paginationWrapper?.querySelector('.w-pagination-next');
    if (!nextLink) return;

    const nextUrl = new URL(nextLink.getAttribute('href'), window.location.origin);
    const urlParams = new URLSearchParams(nextUrl.search);

    let paginationParam = null;
    for (const [key, value] of urlParams.entries()) {
      if (value === '2') {
        paginationParam = key;
        break;
      }
    }

    if (!paginationParam) {
      if (CONFIG.DEBUG_MODE) {
        console.warn('[CheckboxFilter] Could not determine pagination param, falling back to sequential');
      }
      loadNextPages(container, containerKey, nextLink.getAttribute('href'));
      return;
    }

    if (CONFIG.DEBUG_MODE) {
      console.log(`[CheckboxFilter] Loading ${totalPages} pages in parallel using param: ${paginationParam}`);
    }

    const signal = containerData.abortController?.signal;
    const fetchPromises = [];

    for (let pageNumber = 2; pageNumber <= totalPages; pageNumber++) {
      const pagePromise = (async () => {
        if (pageNumber > 2) {
          await fetchPromises[pageNumber - 3];
        }

        const { origin, pathname } = window.location;
        const pageUrl = `${origin}${pathname}?${paginationParam}=${pageNumber}`;

        if (containerData.pagesLoaded.has(pageUrl)) return;

        try {
          const response = await fetch(pageUrl, { signal });
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

                // Store lightweight field data
                const itemData = {
                  groupName,
                  labelText,
                  normalizedText: utils.normalizeText(labelText),
                  ...createSearchTokens(labelText),
                  elementHTML: checkbox.outerHTML
                };
                containerData.allCheckboxes.push(itemData);

                // Immediately add to cache groups if there's an active search
                const searchTerm = activeSearchTerms.get(groupName);
                if (searchTerm !== undefined) {
                  const checkboxData = cache.checkboxGroups.get(groupName);
                  if (checkboxData && !checkboxData.some(item => item.labelText === labelText)) {
                    const newItemData = createItemDataFromClone(checkbox.cloneNode(true), groupName);
                    checkboxData.push(newItemData);
                    filterCheckboxGroup(groupName, searchTerm);
                  }
                }
              }
            });

            containerData.pagesLoaded.add(pageUrl);
          }
        } catch (error) {
          if (error.name === 'AbortError') {
            if (CONFIG.DEBUG_MODE) {
              console.log(`[CheckboxFilter] Page ${pageNumber} fetch aborted`);
            }
          } else {
            utils.logError(`loadPagesInParallel page ${pageNumber}`, error);
          }
        }
      })();

      fetchPromises.push(pagePromise);
    }

    await Promise.all(fetchPromises);

    containerData.isLoading = false;
    containerData.abortController = null;
    updateGroupsWithPaginatedData(containerKey);

    const hasActiveSearch = Array.from(activeSearchTerms.values()).some(term => term !== '');

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

              const itemData = {
                groupName,
                labelText,
                normalizedText: utils.normalizeText(labelText),
                ...createSearchTokens(labelText),
                elementHTML: checkbox.outerHTML
              };
              containerData.allCheckboxes.push(itemData);
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

      containerData.allCheckboxes.forEach(({ groupName, labelText, elementHTML, normalizedText, tokens, ngrams }) => {
        const checkboxData = cache.checkboxGroups.get(groupName);
        if (checkboxData && !checkboxData.some(item => item.labelText === labelText)) {
          // Create element from HTML string only when needed
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = elementHTML;
          const element = tempDiv.firstElementChild;

          const newItemData = createItemDataFromClone(element, groupName);
          checkboxData.push(newItemData);
        }
      });
    } catch (error) {
      // Silently fail
    }
  }

  // ====================================================================
  // FILTERING WITH WEB WORKER
  // ====================================================================

  async function filterCheckboxGroup(groupName, searchTerm) {
    try {
      const checkboxData = cache.checkboxGroups.get(groupName);
      if (!checkboxData) return;

      const normalizedSearchTerm = utils.normalizeText(searchTerm);
      const showAll = normalizedSearchTerm === '';

      let targetContainer = null;
      let itemsContainer = null;

      const firstGroupCheckbox = document.querySelector(`[checkbox-filter="${groupName}"]`);
      if (firstGroupCheckbox) {
        targetContainer = firstGroupCheckbox.closest('[seamless-replace="true"]');
        if (targetContainer) {
          itemsContainer = targetContainer.querySelector('.w-dyn-items');
        }
      }

      if (showAll) {
        activeSearchTerms.delete(groupName);
      } else {
        activeSearchTerms.set(groupName, searchTerm);
      }

      if (!itemsContainer && firstGroupCheckbox) {
        itemsContainer = firstGroupCheckbox.closest('.w-dyn-items') ||
                        firstGroupCheckbox.closest('.collection-list') ||
                        firstGroupCheckbox.parentElement;
      }

      const containerIndex = targetContainer ? Array.from(document.querySelectorAll('[seamless-replace="true"]')).indexOf(targetContainer) : -1;
      const containerKey = containerIndex >= 0 ? `container_${containerIndex}` : null;
      const containerData = containerKey ? cache.paginatedData.get(containerKey) : null;
      const isPaginationLoading = containerData?.isLoading || false;

      // Check if we're in load more mode
      let isLoadMoreMode = false;
      let seamlessContainer = null;

      if (firstGroupCheckbox) {
        seamlessContainer = firstGroupCheckbox.closest('[seamless-replace="true"]');
      }

      if (seamlessContainer && window.containerData && typeof window.containerData === 'object') {
        const containerIndex = Array.from(document.querySelectorAll('[seamless-replace="true"]')).indexOf(seamlessContainer);
        isLoadMoreMode = containerIndex >= 0 && window.containerData.has && window.containerData.has(containerIndex);
      }

      if (isLoadMoreMode) {
        await filterLoadMoreMode(groupName, searchTerm, seamlessContainer, itemsContainer, isPaginationLoading);
      } else {
        await filterRegularMode(groupName, searchTerm, checkboxData, targetContainer, isPaginationLoading);
      }

    } catch (error) {
      utils.logError('filterCheckboxGroup', error);
    }
  }

  async function filterLoadMoreMode(groupName, searchTerm, seamlessContainer, itemsContainer, isPaginationLoading) {
    const normalizedSearchTerm = utils.normalizeText(searchTerm);
    const showAll = normalizedSearchTerm === '';

    const targetContainerIndex = Array.from(document.querySelectorAll('[seamless-replace="true"]')).indexOf(seamlessContainer);

    if (targetContainerIndex !== null && window.containerData.has && window.containerData.has(targetContainerIndex)) {
      const containerDataMap = window.containerData.get(targetContainerIndex);

      if (itemsContainer && containerDataMap.allItems) {
        if (!cache.persistentCheckedStates.has(groupName)) {
          cache.persistentCheckedStates.set(groupName, new Map());
        }
        const groupCheckedStates = cache.persistentCheckedStates.get(groupName);

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
          itemsContainer.innerHTML = '';

          const $container = $(seamlessContainer);
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
            itemsContainer.appendChild(clonedElement);

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

          hideEmptyState(seamlessContainer);
        } else {
          // Search mode - use Web Worker
          itemsContainer.innerHTML = '';

          const $container = $(seamlessContainer);
          const $nextButton = $container.find('.w-pagination-next');
          $nextButton.hide();

          // Prepare data for worker
          const workerItems = [];
          containerDataMap.allItems.forEach((element) => {
            const clonedForCheck = element.cloneNode(true);
            const hasCheckboxFilter = clonedForCheck.hasAttribute('checkbox-filter');
            const containsChild = clonedForCheck.querySelector('[checkbox-filter]');

            if (!hasCheckboxFilter && !containsChild) return;

            const workingElement = hasCheckboxFilter ? clonedForCheck : clonedForCheck.querySelector('[checkbox-filter]');
            if (!workingElement) return;

            const labelText = extractLabelText(workingElement);
            if (!labelText) return;

            const normalizedLabel = utils.normalizeText(labelText);
            const { tokens, ngrams } = createSearchTokens(labelText);
            const isChecked = groupCheckedStates.has(labelText) ? groupCheckedStates.get(labelText) : false;

            workerItems.push({
              id: labelText, // Use labelText as temp ID
              element: element, // Store reference for later rendering
              labelText,
              normalizedText: normalizedLabel,
              tokens,
              ngrams,
              isChecked
            });
          });

          // Run filter in worker
          const result = await runFilterTask({
            items: workerItems.map(({ element, ...rest }) => rest), // Remove element from worker data
            searchTerm: normalizedSearchTerm,
            scoreThreshold: CONFIG.SCORE_THRESHOLD
          });

          const matchedItemsMap = new Map();
          workerItems.forEach(item => {
            matchedItemsMap.set(item.id, item);
          });

          // Render filtered results
          result.filteredItems.forEach(({ id, score }) => {
            const matchedItem = matchedItemsMap.get(id);
            if (!matchedItem) return;

            const clonedElement = matchedItem.element.cloneNode(true);
            clonedElement.style.display = 'block';
            clonedElement.style.visibility = 'visible';
            clonedElement.style.opacity = '1';
            clonedElement.removeAttribute('data-filtered');
            clonedElement.setAttribute('data-search-result', 'true');

            itemsContainer.appendChild(clonedElement);
            restoreCheckedState(clonedElement, groupName);
          });

          const hasResults = itemsContainer.children.length > 0;
          if (!hasResults) {
            showEmptyState(seamlessContainer);
          } else {
            hideEmptyState(seamlessContainer);
          }
        }
      }
    }
  }

  async function filterRegularMode(groupName, searchTerm, checkboxData, targetContainer, isPaginationLoading) {
    const normalizedSearchTerm = utils.normalizeText(searchTerm);
    const showAll = normalizedSearchTerm === '';

    if (showAll) {
      // Show all items
      requestAnimationFrame(() => {
        checkboxData.forEach(itemData => {
          const fullItem = cache.checkboxItemsById.get(itemData.id);
          if (fullItem && fullItem.element) {
            showElement(fullItem.element);
            fullItem.isVisible = true;
          }
        });

        if (targetContainer) {
          hideEmptyState(targetContainer);
        }
      });
    } else {
      // Filter using Web Worker
      const workerItems = checkboxData.map(itemData => {
        const fullItem = cache.checkboxItemsById.get(itemData.id);
        const isChecked = fullItem && fullItem.element ? isCheckboxChecked(fullItem.element) : false;

        return {
          ...itemData,
          isChecked
        };
      });

      const result = await runFilterTask({
        items: workerItems,
        searchTerm: normalizedSearchTerm,
        scoreThreshold: CONFIG.SCORE_THRESHOLD
      });

      requestAnimationFrame(() => {
        const matchedIds = new Set(result.filteredItems.map(item => item.id));
        const itemsToShow = [];
        const itemsToHide = [];

        checkboxData.forEach(itemData => {
          const fullItem = cache.checkboxItemsById.get(itemData.id);
          if (!fullItem) return;

          const shouldShow = matchedIds.has(itemData.id);

          if (shouldShow) {
            if (!fullItem.isVisible) {
              itemsToShow.push(fullItem);
            }
            fullItem.isVisible = true;
          } else {
            if (fullItem.isVisible) {
              itemsToHide.push(fullItem);
            }
            fullItem.isVisible = false;
          }
        });

        // Sort and reorder by relevance
        if (result.filteredItems.length > 0) {
          const parent = itemsToShow[0]?.element?.parentElement;
          if (parent) {
            result.filteredItems.forEach(({ id }) => {
              const itemData = checkboxData.find(item => item.id === id);
              const fullItem = itemData ? cache.checkboxItemsById.get(itemData.id) : null;
              if (fullItem && fullItem.element && fullItem.element.parentElement === parent) {
                parent.appendChild(fullItem.element);
              }
            });
          }
        }

        itemsToShow.forEach(item => showElement(item.element));
        itemsToHide.forEach(item => hideElement(item.element));

        if (targetContainer) {
          const hasVisibleResults = itemsToShow.length > 0 || checkboxData.some(itemData => {
            const fullItem = cache.checkboxItemsById.get(itemData.id);
            return fullItem && fullItem.isVisible;
          });

          if (!hasVisibleResults) {
            showEmptyState(targetContainer);
          } else {
            hideEmptyState(targetContainer);
          }
        }
      });
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

  // ====================================================================
  // EVENT LISTENERS
  // ====================================================================

  function setupEventListeners() {
    try {
      cleanupEventListeners();

      cache.searchBoxes.forEach((searchBox, groupName) => {
        const handler = (e) => {
          const searchTerm = e.target.value;
          const normalizedSearchTerm = utils.normalizeText(searchTerm);

          if (searchDebounceTimers.has(groupName)) {
            clearTimeout(searchDebounceTimers.get(groupName));
          }

          if (normalizedSearchTerm === '') {
            filterCheckboxGroup(groupName, searchTerm);
            searchDebounceTimers.delete(groupName);
          } else {
            const timerId = setTimeout(() => {
              filterCheckboxGroup(groupName, searchTerm);
              searchDebounceTimers.delete(groupName);
            }, CONFIG.SEARCH_DEBOUNCE_MS);

            searchDebounceTimers.set(groupName, timerId);
          }
        };
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

    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }

    if (finsweetTagObserver) {
      finsweetTagObserver.disconnect();
      finsweetTagObserver = null;
    }

    if (updateAnimationFrame) {
      cancelAnimationFrame(updateAnimationFrame);
      updateAnimationFrame = null;
    }

    pendingCheckboxUpdates.clear();

    searchDebounceTimers.forEach((timerId) => {
      clearTimeout(timerId);
    });
    searchDebounceTimers.clear();

    cache.paginatedData.forEach((data) => {
      if (data.abortController) {
        data.abortController.abort();
        data.abortController = null;
      }
    });

    scrollPositions.clear();
    activeSearchTerms.clear();
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

  // ====================================================================
  // FINSWEET INTEGRATION
  // ====================================================================

  function setupFinsweetTagObserver() {
    try {
      const tagsContainer = document.querySelector('[fs-list-element="tags"]');

      if (!tagsContainer) {
        if (CONFIG.DEBUG_MODE) {
          console.log('[CheckboxFilter] No Finsweet tags container found');
        }
        return;
      }

      if (finsweetTagObserver) {
        finsweetTagObserver.disconnect();
      }

      finsweetTagObserver = new MutationObserver((mutations) => {
        let shouldSync = false;

        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
              shouldSync = true;
            }
          }
        });

        if (shouldSync) {
          debouncedSyncWithFinsweet();
        }
      });

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

  function setupFinsweetIntegration() {
    try {
      setupFinsweetTagObserver();

      const finsweetEvents = [
        'fs-cmsfilter-change',
        'fs-cmsfilter-reset',
        'fs-cmsfilter-click'
      ];

      finsweetEvents.forEach(eventName => {
        const handler = (e) => {
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

      const tagRemoveHandler = (e) => {
        const tagRemove = e.target.closest('[fs-list-element="tag-remove"]');
        if (!tagRemove) return;

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

  function batchCheckboxUpdate(element, updates) {
    if (!element) return;

    if (!pendingCheckboxUpdates.has(element)) {
      pendingCheckboxUpdates.set(element, {});
    }
    Object.assign(pendingCheckboxUpdates.get(element), updates);

    if (!updateAnimationFrame) {
      updateAnimationFrame = requestAnimationFrame(() => {
        flushCheckboxUpdates();
      });
    }
  }

  function flushCheckboxUpdates() {
    pendingCheckboxUpdates.forEach((updates, element) => {
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

    pendingCheckboxUpdates.clear();
    updateAnimationFrame = null;

    dispatchSyncCompleteEvent();
  }

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

  function debouncedSyncWithFinsweet() {
    if (syncDebounceTimer) {
      clearTimeout(syncDebounceTimer);
    }
    syncDebounceTimer = setTimeout(() => {
      syncCheckboxStatesWithFinsweet();
    }, 50);
  }

  function syncCheckboxStatesWithFinsweet() {
    try {
      const checkedInputs = document.querySelectorAll('input[fs-list-field][fs-list-value]:checked');
      const activeValues = new Map();

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

      cache.checkboxGroups.forEach((checkboxData, groupName) => {
        checkboxData.forEach(itemData => {
          const fullItem = cache.checkboxItemsById.get(itemData.id);
          if (!fullItem || !fullItem.element) return;

          let metadata = cache.elementMetadata.get(fullItem.element);
          if (!metadata) {
            const checkbox = fullItem.element.querySelector('input[type="checkbox"]');
            metadata = {
              checkbox,
              fsListField: checkbox?.getAttribute('fs-list-field'),
              fsListValue: checkbox?.getAttribute('fs-list-value')
            };
            cache.elementMetadata.set(fullItem.element, metadata);
          }

          let isActive = false;

          if (metadata.fsListField && metadata.fsListValue && activeValues.has(metadata.fsListField)) {
            isActive = activeValues.get(metadata.fsListField).has(metadata.fsListValue.toLowerCase());
          } else {
            const activeTags = document.querySelectorAll('[fs-list-element="tag-label"]');
            const activeTagTexts = new Set();
            activeTags.forEach(tag => {
              const text = tag.textContent?.trim();
              if (text) activeTagTexts.add(text.toLowerCase());
            });
            isActive = activeTagTexts.has(itemData.labelText.toLowerCase());
          }

          batchCheckboxUpdate(fullItem.element, {
            checked: isActive,
            labelClass: isActive,
            checkboxInputClass: isActive
          });
        });
      });

      cache.persistentCheckedStates.forEach((groupStates, groupName) => {
        groupStates.forEach((isChecked, labelText) => {
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

  // ====================================================================
  // PUBLIC API
  // ====================================================================

  window.checkboxFilterScript = {
    recacheElements() {
      saveScrollPositions();

      if (isLoadingMore) {
        isLoadingMore = false;
      }

      if (isInitialized) {
        const currentContainers = new Set(
          Array.from(document.querySelectorAll('[seamless-replace="true"]'))
        );

        scrollPositions.forEach((scrollTop, container) => {
          if (!currentContainers.has(container)) {
            scrollPositions.delete(container);
          }
        });

        const containerKeys = Array.from(cache.paginatedData.keys());
        containerKeys.forEach(key => {
          const containerIndex = parseInt(key.split('_')[1]);
          const container = document.querySelectorAll('[seamless-replace="true"]')[containerIndex];
          if (!container) {
            const data = cache.paginatedData.get(key);
            if (data?.abortController) {
              data.abortController.abort();
            }
            cache.paginatedData.delete(key);
          }
        });

        const currentGroups = new Set(cache.checkboxGroups.keys());
        activeSearchTerms.forEach((term, groupName) => {
          if (!currentGroups.has(groupName)) {
            activeSearchTerms.delete(groupName);
          }
        });

        searchDebounceTimers.forEach((timerId, groupName) => {
          if (!currentGroups.has(groupName)) {
            clearTimeout(timerId);
            searchDebounceTimers.delete(groupName);
          }
        });
      }

      if (isInitialized) {
        setupElements();
        setupEventListeners();
        initializeGroups();
        setupLoadMoreHandlers();
        loadAllPaginatedItems();
        this.restoreAllCheckedStates();

        restoreScrollPositions();
      } else {
        initializeFilters();
      }
    },

    forceRebuild() {
      cache.searchBoxes.clear();
      cache.clearButtons.clear();
      cache.checkboxGroups.clear();
      cache.checkboxItemsById.clear();
      cleanupEventListeners();

      setupElements();
      setupEventListeners();
      initializeGroups();
    },

    filterGroup(groupName, searchTerm) {
      filterCheckboxGroup(groupName, searchTerm);
    },

    getCacheStats() {
      const stats = {};
      cache.checkboxGroups.forEach((data, groupName) => {
        stats[groupName] = {
          total: data.length,
          visible: data.filter(itemData => {
            const fullItem = cache.checkboxItemsById.get(itemData.id);
            return fullItem && fullItem.isVisible;
          }).length,
          paginated: data.filter(itemData => {
            const fullItem = cache.checkboxItemsById.get(itemData.id);
            return fullItem && fullItem.isPaginated;
          }).length
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

      stats.workerPool = {
        totalWorkers: workers.length,
        freeWorkers: freeWorkers.length,
        queuedTasks: taskQueue.length
      };

      return stats;
    },

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

    syncWithFinsweet() {
      syncCheckboxStatesWithFinsweet();
    },

    flushUpdates() {
      if (updateAnimationFrame) {
        cancelAnimationFrame(updateAnimationFrame);
        updateAnimationFrame = null;
      }
      flushCheckboxUpdates();
    },

    setDebugMode(enabled) {
      CONFIG.DEBUG_MODE = !!enabled;
      if (enabled) {
        console.log('[CheckboxFilter] Debug mode enabled');
        console.log('Worker pool size:', workers.length);
      }
    }
  };

})();
