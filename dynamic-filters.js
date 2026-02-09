/**
 * dynamic-filters.js v1.0.0
 *
 * Replaces static Webflow checkboxes with dynamically-rendered filter options
 * fetched from the CMS API worker. Provides server-side search per filter group
 * and lazy-loads items when sections are expanded.
 *
 * Dependencies: cms-client-api.js (must load first, exposes window.cmsDebug)
 *
 * Webflow setup: Each filter group needs this HTML structure:
 *   <div data-filter-section="{key}">
 *     <div data-filter-header="{key}">
 *       <span>{Display Name}</span>
 *       <span data-filter-count="{key}"></span>
 *       <span data-filter-arrow="{key}"></span>
 *     </div>
 *     <div data-filter-group="{key}" style="display: none;"></div>
 *   </div>
 *
 * Where {key} is: region, locality, reporter, topic, perpetrator, settlement, territory
 */
(function () {
    'use strict';

    // ===== CONFIGURATION =====
    const CONFIG = {
        WORKER_URL: 'https://cms-reports-api.occupation-crimes.workers.dev',
        DEBOUNCE_MS: 300,
        FEATURED_LIMIT: 15,
        SEARCH_LIMIT: 20,
        MAX_CMS_WAIT: 10000,

        // Map filter keys to API collection endpoint names
        COLLECTION_MAP: {
            region: 'regions',
            locality: 'localities',
            reporter: 'reporters',
            topic: 'topics',
            perpetrator: 'perpetrators',
            settlement: 'settlements',
            territory: 'territories'
        },

        // Map filter keys to /featured category names (not all have featured endpoints)
        FEATURED_MAP: {
            region: 'regions',
            locality: 'localities',
            reporter: 'reporters',
            topic: 'topics',
            perpetrator: 'perpetrators'
        },

        // Display names for search placeholders
        DISPLAY_NAMES: {
            region: 'regions',
            locality: 'localities',
            reporter: 'reporters',
            topic: 'topics',
            perpetrator: 'perpetrators',
            settlement: 'settlements',
            territory: 'territories'
        }
    };

    // ===== PER-GROUP STATE =====
    const groupState = new Map();
    let internalUpdate = false; // Guard to skip Store subscriber during our own changes

    function getGroupState(filterKey) {
        if (!groupState.has(filterKey)) {
            groupState.set(filterKey, {
                loaded: false,
                expanded: false,
                loading: false,
                featuredItems: [],        // Cached featured/default items
                currentItems: [],         // Currently displayed items
                searchTerm: '',
                checkedSlugs: new Set(),  // Locally tracked checked slugs
                abortController: null,    // For cancelling in-flight search requests
                debounceTimer: null,
                elements: {
                    section: null,
                    header: null,
                    group: null,
                    arrow: null,
                    count: null,
                    searchInput: null,
                    clearButton: null,
                    listContainer: null,
                    loadingIndicator: null
                }
            });
        }
        return groupState.get(filterKey);
    }

    // ===== DOM HELPERS =====
    function $(selector, parent) {
        return (parent || document).querySelector(selector);
    }

    function $$(selector, parent) {
        return Array.from((parent || document).querySelectorAll(selector));
    }

    function createElement(tag, attrs, children) {
        const el = document.createElement(tag);
        if (attrs) {
            Object.entries(attrs).forEach(([key, value]) => {
                if (key === 'style' && typeof value === 'object') {
                    Object.assign(el.style, value);
                } else if (key === 'className') {
                    el.className = value;
                } else if (key.startsWith('data-') || key.startsWith('cms-') || key === 'checkbox-filter' || key === 'type' || key === 'placeholder' || key === 'name' || key === 'id' || key === 'for') {
                    el.setAttribute(key, value);
                } else {
                    el[key] = value;
                }
            });
        }
        if (children) {
            if (typeof children === 'string') {
                el.textContent = children;
            } else if (Array.isArray(children)) {
                children.forEach(child => {
                    if (child) el.appendChild(child);
                });
            } else {
                el.appendChild(children);
            }
        }
        return el;
    }

    // ===== COLLAPSIBLE SECTIONS =====

    function initSections() {
        const sections = $$('[data-filter-section]');
        sections.forEach(section => {
            const filterKey = section.getAttribute('data-filter-section');
            if (!CONFIG.COLLECTION_MAP[filterKey]) return;

            const state = getGroupState(filterKey);
            state.elements.section = section;
            state.elements.header = $(`[data-filter-header="${filterKey}"]`, section);
            state.elements.group = $(`[data-filter-group="${filterKey}"]`, section);
            state.elements.arrow = $(`[data-filter-arrow="${filterKey}"]`, section);
            state.elements.count = $(`[data-filter-count="${filterKey}"]`, section);

            if (!state.elements.header || !state.elements.group) return;

            // Build internal DOM inside the group container
            buildGroupContainer(filterKey, state);

            // Attach click handler to header
            state.elements.header.addEventListener('click', () => {
                toggleSection(filterKey);
            });
        });
    }

    function buildGroupContainer(filterKey, state) {
        const group = state.elements.group;

        // Search input
        const searchWrap = createElement('div', {
            className: 'dynamic-filter-search-wrap'
        });

        const searchInput = createElement('input', {
            type: 'text',
            'data-filter-search': filterKey,
            placeholder: `Search ${CONFIG.DISPLAY_NAMES[filterKey] || filterKey}...`,
            className: 'dynamic-filter-search-input'
        });

        const clearButton = createElement('button', {
            'data-filter-clear': filterKey,
            className: 'dynamic-filter-clear-btn',
            style: { display: 'none' }
        }, '\u00D7');

        searchWrap.appendChild(searchInput);
        searchWrap.appendChild(clearButton);
        group.appendChild(searchWrap);

        // List container for checkboxes
        const listContainer = createElement('div', {
            className: 'dynamic-filter-list',
            'data-filter-list': filterKey
        });
        group.appendChild(listContainer);

        // Loading indicator
        const loadingIndicator = createElement('div', {
            className: 'dynamic-filter-loading',
            style: { display: 'none' }
        }, 'Loading...');
        group.appendChild(loadingIndicator);

        // Store references
        state.elements.searchInput = searchInput;
        state.elements.clearButton = clearButton;
        state.elements.listContainer = listContainer;
        state.elements.loadingIndicator = loadingIndicator;

        // Search event handlers
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.trim();
            clearButton.style.display = term ? '' : 'none';
            handleSearchInput(filterKey, term);
        });

        clearButton.addEventListener('click', () => {
            searchInput.value = '';
            clearButton.style.display = 'none';
            handleSearchClear(filterKey);
            searchInput.focus();
        });
    }

    function toggleSection(filterKey) {
        const state = getGroupState(filterKey);
        if (!state.elements.group) return;

        const isExpanded = state.expanded;
        const newExpanded = !isExpanded;

        state.expanded = newExpanded;
        state.elements.group.style.display = newExpanded ? '' : 'none';

        // Rotate arrow
        if (state.elements.arrow) {
            state.elements.arrow.style.transform = newExpanded ? 'rotate(180deg)' : '';
        }

        // Lazy load on first expand
        if (newExpanded && !state.loaded && !state.loading) {
            loadFeaturedItems(filterKey);
        }
    }

    // ===== DATA FETCHING =====

    async function loadFeaturedItems(filterKey) {
        const state = getGroupState(filterKey);
        state.loading = true;
        showLoading(filterKey, true);

        try {
            let items;
            const featuredCategory = CONFIG.FEATURED_MAP[filterKey];

            if (featuredCategory) {
                // Fetch from /featured endpoint
                const response = await fetch(
                    `${CONFIG.WORKER_URL}/featured/${featuredCategory}?limit=${CONFIG.FEATURED_LIMIT}`
                );
                const data = await response.json();
                items = data.success ? (data.data || []) : [];
            } else {
                // No featured endpoint (settlements, territories) — fetch sorted list
                const collection = CONFIG.COLLECTION_MAP[filterKey];
                const response = await fetch(
                    `${CONFIG.WORKER_URL}/${collection}?limit=${CONFIG.FEATURED_LIMIT}&sort=name&order=asc`
                );
                const data = await response.json();
                items = data.success ? (data.data || []) : [];
            }

            // Normalize items to { name, slug } minimum
            const normalizedItems = items.map(item => ({
                name: item.name || '',
                slug: item.slug || '',
                region: item.region || item.territory || '',
                photoUrl: item.photoUrl || item.photo || ''
            }));

            state.featuredItems = normalizedItems;
            state.loaded = true;
            renderItems(filterKey, normalizedItems);
        } catch (error) {
            console.error(`[Dynamic Filters] Failed to load featured items for ${filterKey}:`, error);
            renderError(filterKey, 'Failed to load. Click to retry.', () => {
                loadFeaturedItems(filterKey);
            });
        } finally {
            state.loading = false;
            showLoading(filterKey, false);
        }
    }

    async function searchCollection(filterKey, query) {
        const state = getGroupState(filterKey);

        // Cancel any in-flight request
        if (state.abortController) {
            state.abortController.abort();
        }

        state.abortController = new AbortController();
        showLoading(filterKey, true);

        try {
            const collection = CONFIG.COLLECTION_MAP[filterKey];
            const response = await fetch(
                `${CONFIG.WORKER_URL}/search/${collection}?q=${encodeURIComponent(query)}&limit=${CONFIG.SEARCH_LIMIT}`,
                { signal: state.abortController.signal }
            );
            const data = await response.json();
            const results = (data.results || []).map(item => ({
                name: item.name || '',
                slug: item.slug || '',
                region: item.region || item.territory || '',
                photoUrl: item.photoUrl || ''
            }));

            state.currentItems = results;
            renderItems(filterKey, results);
        } catch (error) {
            if (error.name === 'AbortError') return; // Intentional cancellation
            console.error(`[Dynamic Filters] Search failed for ${filterKey}:`, error);
            renderError(filterKey, 'Search failed. Try again.', () => {
                searchCollection(filterKey, query);
            });
        } finally {
            state.abortController = null;
            showLoading(filterKey, false);
        }
    }

    // ===== SEARCH HANDLING =====

    function handleSearchInput(filterKey, term) {
        const state = getGroupState(filterKey);
        state.searchTerm = term;

        // Clear previous debounce
        if (state.debounceTimer) {
            clearTimeout(state.debounceTimer);
            state.debounceTimer = null;
        }

        if (!term) {
            // Empty search — restore featured items
            handleSearchClear(filterKey);
            return;
        }

        // Debounce the server search
        state.debounceTimer = setTimeout(() => {
            searchCollection(filterKey, term);
        }, CONFIG.DEBOUNCE_MS);
    }

    function handleSearchClear(filterKey) {
        const state = getGroupState(filterKey);
        state.searchTerm = '';

        // Cancel any pending search
        if (state.debounceTimer) {
            clearTimeout(state.debounceTimer);
            state.debounceTimer = null;
        }
        if (state.abortController) {
            state.abortController.abort();
            state.abortController = null;
        }

        // Restore featured items
        if (state.featuredItems.length > 0) {
            renderItems(filterKey, state.featuredItems);
        }
    }

    // ===== CHECKBOX RENDERING =====

    function renderItems(filterKey, items) {
        const state = getGroupState(filterKey);
        const container = state.elements.listContainer;
        if (!container) return;

        // Sync checked slugs from Store
        syncCheckedSlugsFromStore(filterKey);

        // Build the list: pinned checked items first, then results
        const checkedSlugs = state.checkedSlugs;
        const itemSlugs = new Set(items.map(i => i.slug));

        // Fragment for efficient DOM insertion
        const fragment = document.createDocumentFragment();

        // 1. Render pinned checked items that are NOT in current results
        checkedSlugs.forEach(slug => {
            if (!itemSlugs.has(slug)) {
                // This checked item isn't in the current result set — pin it at top
                const pinnedItem = { name: slug, slug, region: '', photoUrl: '' };

                // Try to find display name from featured items cache
                const cached = state.featuredItems.find(i => i.slug === slug);
                if (cached) {
                    pinnedItem.name = cached.name;
                    pinnedItem.region = cached.region;
                    pinnedItem.photoUrl = cached.photoUrl;
                }

                fragment.appendChild(createCheckboxElement(filterKey, pinnedItem, true, true));
            }
        });

        // 2. Render current results
        items.forEach(item => {
            const isChecked = checkedSlugs.has(item.slug);
            fragment.appendChild(createCheckboxElement(filterKey, item, isChecked, false));
        });

        // Clear and populate
        container.innerHTML = '';

        if (!fragment.hasChildNodes() && items.length === 0) {
            container.appendChild(createElement('div', {
                className: 'dynamic-filter-empty'
            }, 'No items found'));
        } else {
            container.appendChild(fragment);
        }

        state.currentItems = items;
    }

    function createCheckboxElement(filterKey, item, isChecked, isPinned) {
        // Outer wrapper — matches Webflow checkbox structure
        const wrapper = createElement('div', {
            'checkbox-filter': filterKey,
            className: 'checbox-item dynamic-filter-item' + (isPinned ? ' dynamic-filter-pinned' : '')
        });

        const label = createElement('label', {
            className: 'w-checkbox dynamic-filter-label'
        });

        // Custom checkbox visual
        const checkboxDiv = createElement('div', {
            className: 'w-checkbox-input w-checkbox-input--inputType-custom toggleable'
                + (isChecked ? ' w--redirected-checked' : '')
        });

        // Hidden actual input
        const input = createElement('input', {
            type: 'checkbox',
            'cms-filter': filterKey,
            'cms-filter-value': item.slug,
            'data-display-name': item.name,
            'data-filter-initialized': 'true', // Prevent cms-client-api.js from double-binding
            name: filterKey,
            style: { opacity: '0', position: 'absolute', zIndex: '-1' }
        });
        input.checked = isChecked;

        // Label text
        const labelText = createElement('span', {
            className: 'w-form-label dynamic-filter-item-name'
        }, item.name);

        // Attach change event
        input.addEventListener('change', function () {
            handleCheckboxChange(filterKey, item.slug, this.checked, checkboxDiv);
        });

        // Click on label toggles checkbox
        label.addEventListener('click', (e) => {
            // Prevent double-fire if clicking directly on input
            if (e.target === input) return;
            e.preventDefault();
            input.checked = !input.checked;
            input.dispatchEvent(new Event('change'));
        });

        label.appendChild(checkboxDiv);
        label.appendChild(input);
        label.appendChild(labelText);

        // Optional subtitle (region/territory info)
        if (item.region) {
            const subtitle = createElement('span', {
                className: 'dynamic-filter-item-subtitle'
            }, item.region);
            label.appendChild(subtitle);
        }

        wrapper.appendChild(label);
        return wrapper;
    }

    function handleCheckboxChange(filterKey, slug, isChecked, checkboxDiv) {
        const store = window.cmsDebug?.Store;
        if (!store || store.get('isClearing')) return;

        const state = getGroupState(filterKey);

        // Update Webflow visual
        if (checkboxDiv) {
            if (isChecked) {
                checkboxDiv.classList.add('w--redirected-checked');
            } else {
                checkboxDiv.classList.remove('w--redirected-checked');
            }
        }

        // Update Store (with guard to prevent our subscriber from re-processing)
        internalUpdate = true;
        if (isChecked) {
            store.addToFilter(filterKey, slug);
            state.checkedSlugs.add(slug);
        } else {
            store.removeFromFilter(filterKey, slug);
            state.checkedSlugs.delete(slug);
        }
        internalUpdate = false;

        // Update count badge immediately
        updateFilterCounts();

        // Trigger report refresh
        window.cmsDebug.applyFilters();
    }

    // ===== STATE SYNC =====

    function syncCheckedSlugsFromStore(filterKey) {
        const store = window.cmsDebug?.Store;
        if (!store) return;

        const state = getGroupState(filterKey);
        const storeValues = store.get('filters')[filterKey] || [];

        state.checkedSlugs = new Set(storeValues);
    }

    function updateFilterCounts() {
        const store = window.cmsDebug?.Store;
        if (!store) return;

        const filters = store.get('filters');

        $$('[data-filter-count]').forEach(el => {
            const key = el.getAttribute('data-filter-count');
            const count = filters[key]?.length || 0;
            el.textContent = count > 0 ? `(${count})` : '';
        });
    }

    function onStoreChange() {
        // Skip if this was triggered by our own checkbox change
        if (internalUpdate) return;

        // During bulk clearing, cms-client-api.js handles unchecking via CheckboxUtils.
        // We still need to sync our internal state when clearing finishes.
        // The Store's isClearing flag is set silently, so we can process normally.

        updateFilterCounts();

        // Sync checked state for expanded sections
        groupState.forEach((state, filterKey) => {
            const storeValues = window.cmsDebug?.Store?.get('filters')[filterKey] || [];
            const newChecked = new Set(storeValues);

            // Check if changed
            const oldChecked = state.checkedSlugs;
            const changed = newChecked.size !== oldChecked.size ||
                [...newChecked].some(v => !oldChecked.has(v)) ||
                [...oldChecked].some(v => !newChecked.has(v));

            if (changed) {
                state.checkedSlugs = newChecked;

                // If section is expanded and has rendered items, update checkbox visuals
                if (state.expanded && state.elements.listContainer) {
                    updateCheckboxVisuals(filterKey);
                }
            }
        });
    }

    function updateCheckboxVisuals(filterKey) {
        const state = getGroupState(filterKey);
        const container = state.elements.listContainer;
        if (!container) return;

        const checkedSlugs = state.checkedSlugs;

        // Update existing checkbox states
        const inputs = container.querySelectorAll('input[type="checkbox"][cms-filter]');
        inputs.forEach(input => {
            const slug = input.getAttribute('cms-filter-value');
            const shouldBeChecked = checkedSlugs.has(slug);

            if (input.checked !== shouldBeChecked) {
                input.checked = shouldBeChecked;
                const checkboxDiv = input.previousElementSibling;
                if (checkboxDiv && checkboxDiv.classList.contains('w-checkbox-input')) {
                    if (shouldBeChecked) {
                        checkboxDiv.classList.add('w--redirected-checked');
                    } else {
                        checkboxDiv.classList.remove('w--redirected-checked');
                    }
                }
            }
        });

        // Check if we need to add/remove pinned items
        const displayedSlugs = new Set();
        inputs.forEach(input => {
            displayedSlugs.add(input.getAttribute('cms-filter-value'));
        });

        // If there are checked slugs not displayed, re-render to add pinned items
        const missingChecked = [...checkedSlugs].some(slug => !displayedSlugs.has(slug));
        // If there are pinned items that are no longer checked, re-render to remove them
        const staleItems = container.querySelectorAll('.dynamic-filter-pinned');
        const hasStale = Array.from(staleItems).some(el => {
            const input = el.querySelector('input[type="checkbox"]');
            return input && !checkedSlugs.has(input.getAttribute('cms-filter-value'));
        });

        if (missingChecked || hasStale) {
            const itemsToRender = state.searchTerm ? state.currentItems : state.featuredItems;
            renderItems(filterKey, itemsToRender);
        }
    }

    // ===== UI HELPERS =====

    function showLoading(filterKey, show) {
        const state = getGroupState(filterKey);
        if (state.elements.loadingIndicator) {
            state.elements.loadingIndicator.style.display = show ? '' : 'none';
        }
    }

    function renderError(filterKey, message, retryCallback) {
        const state = getGroupState(filterKey);
        const container = state.elements.listContainer;
        if (!container) return;

        container.innerHTML = '';
        const errorEl = createElement('div', {
            className: 'dynamic-filter-error'
        });
        errorEl.textContent = message;
        if (retryCallback) {
            errorEl.style.cursor = 'pointer';
            errorEl.addEventListener('click', retryCallback);
        }
        container.appendChild(errorEl);
    }

    // ===== INITIALIZATION =====

    function initCore() {
        const store = window.cmsDebug?.Store;
        if (!store) {
            console.error('[Dynamic Filters] window.cmsDebug.Store not available');
            return;
        }

        // 1. Initialize all sections
        initSections();

        // 2. Subscribe to Store changes for count badges and checkbox sync
        store.subscribe(onStoreChange);

        // 3. Initial count update
        updateFilterCounts();

        // 4. Auto-expand sections that have active filters from URL
        const filters = store.get('filters');
        Object.keys(CONFIG.COLLECTION_MAP).forEach(filterKey => {
            if (filters[filterKey]?.length > 0) {
                const state = getGroupState(filterKey);
                if (state.elements.group && !state.expanded) {
                    toggleSection(filterKey);
                }
            }
        });

        console.log('[Dynamic Filters] Initialized');
    }

    function waitForCmsDebug(callback) {
        const start = Date.now();
        const check = () => {
            if (window.cmsDebug?.Store) {
                callback();
            } else if (Date.now() - start < CONFIG.MAX_CMS_WAIT) {
                requestAnimationFrame(check);
            } else {
                console.error('[Dynamic Filters] Timed out waiting for window.cmsDebug');
            }
        };
        check();
    }

    function init() {
        if (window.cmsDebug?.Store) {
            initCore();
            return;
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                waitForCmsDebug(initCore);
            });
        } else {
            waitForCmsDebug(initCore);
        }
    }

    // ===== PUBLIC API =====
    window.dynamicFilters = {
        toggleSection,
        refreshGroup(filterKey) {
            const state = getGroupState(filterKey);
            state.loaded = false;
            state.featuredItems = [];
            if (state.expanded) {
                loadFeaturedItems(filterKey);
            }
        },
        getState() {
            const result = {};
            groupState.forEach((state, key) => {
                result[key] = {
                    loaded: state.loaded,
                    expanded: state.expanded,
                    checkedCount: state.checkedSlugs.size,
                    featuredCount: state.featuredItems.length,
                    searchTerm: state.searchTerm
                };
            });
            return result;
        }
    };

    init();

})();
