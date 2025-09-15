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
  let mutationObserver = null;
  let pendingPaginatedItems = new Map(); // Store items that need to be re-added

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', initializeFilters);

  function initializeFilters() {
    setupElements();
    setupEventListeners();
    initializeGroups();
    setupMutationObserver();
    // Load all paginated items for containers
    loadAllPaginatedItems();
    isInitialized = true;
  }

  // Set up MutationObserver to detect when our paginated items are removed
  function setupMutationObserver() {
    if (mutationObserver) {
      mutationObserver.disconnect();
    }

    mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
          // Check if any of our paginated items were removed
          mutation.removedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE &&
                node.hasAttribute &&
                node.hasAttribute('data-paginated-item')) {

              const labelText = extractLabelText(node);
              console.log(`Detected removal of paginated item: "${labelText}" - re-adding it`);

              // Store the item to be re-added
              setTimeout(() => {
                const container = mutation.target;
                if (container && container.classList && container.classList.contains('w-dyn-items')) {
                  // Clone and re-add the item
                  const clonedElement = node.cloneNode(true);
                  clonedElement.style.display = 'block';
                  clonedElement.style.visibility = 'visible';
                  clonedElement.style.opacity = '1';
                  clonedElement.removeAttribute('data-filtered');

                  container.appendChild(clonedElement);
                  console.log(`Re-added paginated item: "${labelText}"`);
                }
              }, 10);
            }
          });
        }
      });
    });

    // Observe all containers
    const containers = document.querySelectorAll('.w-dyn-items');
    containers.forEach(container => {
      mutationObserver.observe(container, {
        childList: true,
        subtree: false
      });
    });

    console.log(`MutationObserver set up for ${containers.length} containers`);
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

        // Reapply any active search filters now that we have all items
        cache.searchBoxes.forEach((searchBox, groupName) => {
          if (searchBox.value && searchBox.value.trim()) {
            console.log(`Reapplying search for group "${groupName}" with term: "${searchBox.value}"`);
            filterCheckboxGroup(groupName, searchBox.value);
          }
        });
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

                // Immediately add to the main cache
                const groupName = checkbox.getAttribute('checkbox-filter');
                if (groupName) {
                  const labelText = extractLabelText(clonedCheckbox);
                  const processedCheckbox = {
                    element: clonedCheckbox,
                    labelText: labelText,
                    normalizedText: utils.normalizeText(labelText),
                    searchTokens: createSearchTokens(labelText),
                    isVisible: false, // Start hidden since it's from another page
                    isPaginated: true
                  };

                  if (!cache.checkboxGroups.has(groupName)) {
                    cache.checkboxGroups.set(groupName, []);
                  }

                  // Check if this checkbox already exists (avoid duplicates)
                  const existing = cache.checkboxGroups.get(groupName).find(
                    item => item.labelText === labelText
                  );

                  if (!existing) {
                    cache.checkboxGroups.get(groupName).push(processedCheckbox);
                    console.log(`Added checkbox "${labelText}" to group "${groupName}" from pagination`);
                  }
                }
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

            // Log the final state of checkbox groups
            cache.checkboxGroups.forEach((items, groupName) => {
              console.log(`Group "${groupName}" now has ${items.length} total items (${items.filter(i => i.isPaginated).length} from pagination)`);
            });

            // Reapply any active search filters now that we have all items
            cache.searchBoxes.forEach((searchBox, groupName) => {
              if (searchBox.value && searchBox.value.trim()) {
                console.log(`Reapplying search for group "${groupName}" with term: "${searchBox.value}"`);
                filterCheckboxGroup(groupName, searchBox.value);
              }
            });
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

    // Find the specific container for this checkbox group
    let targetContainer = null;
    let itemsContainer = null;

    // First, try to find a checkbox from this specific group to determine the correct container
    const firstGroupCheckbox = document.querySelector(`[checkbox-filter="${groupName}"]`);
    if (firstGroupCheckbox) {
      // Find the closest seamless container that contains this checkbox
      targetContainer = firstGroupCheckbox.closest('[seamless-replace="true"]');
      if (targetContainer) {
        itemsContainer = targetContainer.querySelector('.w-dyn-items');
        console.log(`Found specific container for group "${groupName}":`, targetContainer);
      }
    }

    // Fallback: if no seamless container found, find where the checkboxes are
    if (!itemsContainer && firstGroupCheckbox) {
      itemsContainer = firstGroupCheckbox.closest('.w-dyn-items') ||
                      firstGroupCheckbox.closest('.collection-list') ||
                      firstGroupCheckbox.parentElement;
      console.log(`Using fallback container for group "${groupName}":`, itemsContainer);
    }

    requestAnimationFrame(() => {
      const elementsToShow = [];
      const elementsToHide = [];
      const paginatedToShow = [];

      if (showAll) {
        // Show only current page items when search is empty
        console.log('Clearing search - showing only current page items');

        // Remove all paginated items from DOM
        if (itemsContainer) {
          const paginatedItems = itemsContainer.querySelectorAll('[data-paginated-item="true"]');
          console.log(`Removing ${paginatedItems.length} paginated items from DOM`);
          paginatedItems.forEach(item => item.remove());
        }

        checkboxData.forEach(item => {
          if (!item.isPaginated) {
            if (!item.isVisible) {
              elementsToShow.push(item);
              item.isVisible = true;
            }
          } else {
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

        // Temporarily disable other filtering scripts that might interfere
        if (window.fsAttributes) {
          console.log('Temporarily disabling fsAttributes');
          window.fsAttributes.destroy?.();
        }

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

        // Check if we're in "load more" mode (seamless-load-more.html is being used)
        const isLoadMoreMode = window.containerData && typeof window.containerData === 'object';

        if (isLoadMoreMode) {
          console.log('Load More mode detected - using container data for search');

          // Find the container index for this group
          let targetContainerIndex = null;
          const firstGroupCheckbox = document.querySelector(`[checkbox-filter="${groupName}"]`);
          if (firstGroupCheckbox) {
            const targetContainer = firstGroupCheckbox.closest('[seamless-replace="true"]');
            if (targetContainer) {
              targetContainerIndex = Array.from(document.querySelectorAll('[seamless-replace="true"]')).indexOf(targetContainer);
            }
          }

          if (targetContainerIndex !== null && window.containerData.has && window.containerData.has(targetContainerIndex)) {
            const containerDataMap = window.containerData.get(targetContainerIndex);
            console.log('Container data map:', containerDataMap);
            console.log('All items sample:', containerDataMap.allItems?.slice(0, 2));

            // Clear current items and search through ALL items in containerData
            if (itemsContainer && containerDataMap.allItems) {
              console.log(`Searching through ${containerDataMap.allItems.length} total items in load more data`);

              // Clear container
              itemsContainer.innerHTML = '';

              // Search through ALL items in containerData, not just cached ones
              let addedCount = 0;
              let matchCount = 0;

              containerDataMap.allItems.forEach((element, index) => {
                console.log(`Processing item ${index}:`, element);

                // Check if this element contains a checkbox for the current group
                const groupCheckbox = element.querySelector(`[checkbox-filter="${groupName}"]`);
                console.log(`Item ${index} - looking for checkbox-filter="${groupName}":`, groupCheckbox);
                if (!groupCheckbox) {
                  console.log(`Item ${index} - no checkbox found for group "${groupName}", skipping`);
                  return;
                }

                const labelText = extractLabelText(element);
                console.log(`Item ${index} - labelText:`, labelText);
                if (!labelText) {
                  console.log(`Item ${index} - no label text found, skipping`);
                  return;
                }

                let shouldShow = false;

                if (showAll) {
                  shouldShow = true;
                } else {
                  // Check if checkbox is checked (checked items always show)
                  const isChecked = isCheckboxChecked(element);
                  if (isChecked) {
                    shouldShow = true;
                  } else {
                    // Calculate match score for search
                    const normalizedLabel = utils.normalizeText(labelText);
                    const searchTokens = createSearchTokens(normalizedSearchTerm);
                    const itemData = {
                      normalizedText: normalizedLabel,
                      searchTokens: createSearchTokens(normalizedLabel)
                    };

                    const score = calculateMatchScore(normalizedSearchTerm, searchTokens, itemData);
                    shouldShow = score > CONFIG.SCORE_THRESHOLD;
                    if (shouldShow) matchCount++;

                    console.log(`Item "${labelText}": score=${score}, threshold=${CONFIG.SCORE_THRESHOLD}, shouldShow=${shouldShow}`);
                  }
                }

                if (shouldShow) {
                  const clonedElement = element.cloneNode(true);
                  clonedElement.style.display = 'block';
                  clonedElement.style.visibility = 'visible';
                  clonedElement.style.opacity = '1';
                  clonedElement.removeAttribute('data-filtered');
                  clonedElement.setAttribute('data-search-result', 'true');

                  itemsContainer.appendChild(clonedElement);
                  addedCount++;
                }
              });

              console.log(`Search complete: Found ${matchCount} matches, added ${addedCount} items to DOM`);
            }
          }
        } else {
          // Original pagination mode - add paginated items to the DOM
          if (paginatedToShow.length > 0 && itemsContainer) {
            console.log(`Attempting to add ${paginatedToShow.length} paginated items to DOM`);
            console.log('Items container:', itemsContainer);
            console.log('Items to show:', paginatedToShow.map(item => item.labelText));

            paginatedToShow.forEach((item, index) => {
              // Check if item is already in DOM by comparing label text
              const existingItem = Array.from(itemsContainer.querySelectorAll(CONFIG.SELECTORS.CHECKBOX))
                .find(el => extractLabelText(el) === item.labelText);

              if (!existingItem) {
                const clonedElement = item.element.cloneNode(true);

                console.log(`Cloning element for "${item.labelText}":`, clonedElement);

                // Make sure the cloned element is visible (override any hiding)
                clonedElement.style.display = 'block';
                clonedElement.style.visibility = 'visible';
                clonedElement.style.opacity = '1';
                clonedElement.removeAttribute('data-filtered');

                // Add a data attribute to identify it as a paginated item
                clonedElement.setAttribute('data-paginated-item', 'true');

                // Try appending to container
                console.log(`Attempting to append element to container...`);
                itemsContainer.appendChild(clonedElement);

                // Verify it was added
                const wasAdded = itemsContainer.contains(clonedElement);
                console.log(`Element added successfully: ${wasAdded}`);

                if (wasAdded) {
                  console.log(`Successfully added paginated item ${index + 1}: "${item.labelText}"`);

                  // Force visibility after DOM insertion
                  requestAnimationFrame(() => {
                    clonedElement.style.display = 'block';
                    clonedElement.style.visibility = 'visible';
                    clonedElement.style.opacity = '1';
                    clonedElement.removeAttribute('data-filtered');
                    showElement(clonedElement);
                  });
                } else {
                  console.error(`Failed to add element to DOM for: "${item.labelText}"`);
                }
              } else {
                console.log(`Item "${item.labelText}" already exists in DOM - showing it`);
                // Make sure existing item is visible if it matches
                showElement(existingItem);
              }
            });

          // Double-check the DOM state
          const totalCheckboxes = itemsContainer.querySelectorAll(CONFIG.SELECTORS.CHECKBOX).length;
          const paginatedCheckboxes = itemsContainer.querySelectorAll('[data-paginated-item="true"]').length;
          console.log(`DOM now contains ${totalCheckboxes} total checkbox items (${paginatedCheckboxes} paginated)`);

          // List all checkbox labels in the DOM
          const allLabels = Array.from(itemsContainer.querySelectorAll(CONFIG.SELECTORS.CHECKBOX))
            .map(el => extractLabelText(el));
          console.log('All checkbox labels in DOM:', allLabels);

          // Set up a periodic check to ensure items stay visible
          if (normalizedSearchTerm !== '') {
            const keepAliveInterval = setInterval(() => {
              const currentPaginatedItems = itemsContainer.querySelectorAll('[data-paginated-item="true"]');
              console.log(`Keep-alive check: ${currentPaginatedItems.length} paginated items in DOM`);

              if (currentPaginatedItems.length < paginatedToShow.length) {
                console.log('Some paginated items were removed - re-adding them');

                // Re-add missing items
                paginatedToShow.forEach(item => {
                  const exists = Array.from(itemsContainer.querySelectorAll(CONFIG.SELECTORS.CHECKBOX))
                    .some(el => extractLabelText(el) === item.labelText);

                  if (!exists) {
                    const clonedElement = item.element.cloneNode(true);
                    clonedElement.style.display = 'block';
                    clonedElement.style.visibility = 'visible';
                    clonedElement.style.opacity = '1';
                    clonedElement.removeAttribute('data-filtered');
                    clonedElement.setAttribute('data-paginated-item', 'true');

                    itemsContainer.appendChild(clonedElement);
                    console.log(`Re-added missing item: "${item.labelText}"`);
                  }
                });
              }

              // Make sure all paginated items are visible
              currentPaginatedItems.forEach(item => {
                item.style.display = 'block';
                item.style.visibility = 'visible';
                item.style.opacity = '1';
                item.removeAttribute('data-filtered');
              });

              // Clear interval if search is cleared
              const searchBox = cache.searchBoxes.get(groupName);
              if (!searchBox || !searchBox.value || !searchBox.value.trim()) {
                clearInterval(keepAliveInterval);
                console.log('Search cleared - stopping keep-alive check');
              }
            }, 100); // Check every 100ms
          }
        } else if (paginatedToShow.length > 0) {
          console.log(`Found ${paginatedToShow.length} items to show but no itemsContainer found`);
          console.log('itemsContainer:', itemsContainer);

          // Try to find alternative container
          const altContainer = document.querySelector('.w-dyn-items');
          console.log('Alternative container:', altContainer);
        }
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
    element.style.visibility = 'visible';
    element.style.opacity = '1';
    element.removeAttribute('data-filtered');

    // Also remove any hiding classes that might be applied
    element.classList.remove('hidden', 'hide', 'invisible');
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
