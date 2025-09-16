/*!
 * Checkbox Filter with Pagination Support v1.0.0
 * Real-time checkbox filtering with fuzzy search and seamless pagination
 * Compatible with Webflow CMS and seamless-load-more.html
 *
 * Features:
 * - Real-time search with fuzzy matching
 * - Seamless pagination support with load more
 * - Persistent checked states across searches and pagination
 * - Multiple container support
 * - Automatic state restoration
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
    LOAD_MORE_DELAY: 500,
    RESTORE_DELAY: 200
  };

  // Cache for checkbox elements and paginated data
  const cache = {
    searchBoxes: new Map(),
    clearButtons: new Map(),
    checkboxGroups: new Map(),
    eventListeners: new Map(),
    paginatedData: new Map(),
    loadingPromises: new Map(),
    persistentCheckedStates: new Map()
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
  let isInitializing = false;
  let isLoadingMore = false;
  let mutationObserver = null;
  let pendingPaginatedItems = new Map();

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
      isInitialized = true;
      isInitializing = false;
    } catch (error) {
      isInitializing = false;
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
            setTimeout(() => {
              isLoadingMore = false;
            }, CONFIG.LOAD_MORE_DELAY);
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
          loadNextPages(container, containerKey, nextLink.getAttribute('href'));
        } else {
          containerData.isLoading = false;
          updateGroupsWithPaginatedData(containerKey);
        }
      });
    } catch (error) {
      // Silently fail
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
          // Silently fail
        }
      });
    });
    cache.eventListeners.clear();
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

      if (isLoadMoreMode) {
        // Load More mode - search through all items
        let targetContainerIndex = Array.from(document.querySelectorAll('[seamless-replace="true"]')).indexOf(seamlessContainer);
        let targetContainer = seamlessContainer;

        if (targetContainer) {
          itemsContainer = targetContainer.querySelector('.w-dyn-items');
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
              const container = targetContainer;
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
                }
              }
            } else {
              // Search mode
              itemsContainer.innerHTML = '';

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
      });
    } catch (error) {
      // Silently fail
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
  window.checkboxFilterScript = {
    recacheElements() {
      if (isInitialized) {
        setupElements();
        setupEventListeners();
        initializeGroups();
        setupLoadMoreHandlers();
        loadAllPaginatedItems();
        this.restoreAllCheckedStates();
      } else {
        initializeFilters();
      }
    },

    forceRebuild() {
      cache.searchBoxes.clear();
      cache.clearButtons.clear();
      cache.checkboxGroups.clear();
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
    }
  };

})();
