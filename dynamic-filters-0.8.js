/**
 * dynamic-filters.js v2.1.0
 *
 * Populates Webflow-built filter sections with dynamically-fetched CMS items.
 * Clones a checkbox template per item. Uses server-side search.
 * Lazy-loads featured items when a section is first expanded.
 * Supports "Show more" pagination to load additional items.
 *
 * Dependencies: cms-client-api.js (must load first, exposes window.cmsDebug)
 *
 * Webflow attribute reference:
 *
 *   Section wrapper:          data-filter-section="{key}"
 *   Header (collapse toggle): data-filter-header="{key}"
 *   Collapse target:          filter-collapse="target"          (inside section)
 *   Search input:             searchbox-filter="{key}"          (inside section)
 *   Clear search button:      clear-text-input="{key}"          (inside section)
 *   Clear all checked button: cms-clear-element="{key}"         (inside section)
 *   Checkbox list container:  data-filter-group="{key}"         (inside section)
 *   Checkbox template:        data-filter-template="{key}"      (single <label> inside list)
 *   Arrow indicator:          data-filter-arrow="{key}"         (optional, inside header)
 *   Active count badge:       data-filter-count="{key}"         (optional, inside header)
 *   Active indicator:          filter-indicator="{key}"          (optional, anywhere on page)
 *   Loading template:          data-filter-loading="{key}"       (optional, inside section, hidden & cloned while loading)
 *   Empty template:            data-filter-empty="{key}"         (optional, inside section, hidden & cloned when no results)
 *   Error template:            data-filter-error="{key}"         (optional, inside section, hidden & cloned on fetch error)
 *   Show more button:           data-filter-more="{key}"          (optional, inside section, hidden & shown when more results exist)
 *   Display override:          data-filter-display="block"       (optional, on any state template; defaults to "flex")
 *
 *   Inside template:
 *     <input cms-filter="{key}" cms-filter-value="" data-filter-initialized="true">
 *     <span data-filter-item="name"></span>
 *     <a data-filter-item="link"></a>         (optional, external link)
 *     <div data-filter-item="count"></div>    (optional, facet count)
 *
 * {key} = region | locality | reporter | topic | perpetrator | settlement | territory
 */
(function () {
    'use strict';

    // ===== CONFIGURATION =====
    const CONFIG = {
        WORKER_URL: 'https://cms-reports-api.occupation-crimes.workers.dev',
        DEBOUNCE_MS: 300,
        FEATURED_LIMIT: 12,
        SEARCH_LIMIT: 20,
        MAX_CMS_WAIT: 10000,
        COLLAPSE_TRANSITION: 'height 0.3s ease',
        SHOW_MORE_LABEL: 'Show more',
        LOADING_MORE_LABEL: 'Loading…',

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
        }
    };

    // ===== PER-GROUP STATE =====
    const groupState = new Map();
    let internalUpdate = false;

    function getGroupState(filterKey) {
        if (!groupState.has(filterKey)) {
            groupState.set(filterKey, {
                loaded: false,
                expanded: false,
                loading: false,
                loadingMore: false,
                featuredItems: [],
                currentItems: [],
                searchTerm: '',
                checkedValues: new Set(),
                abortController: null,
                debounceTimer: null,
                offset: 0,
                hasMore: false,
                elements: {}
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

    // ===== SECTION INITIALIZATION =====

    function initSections() {
        $$('[data-filter-section]').forEach(section => {
            const key = section.getAttribute('data-filter-section');
            if (!CONFIG.COLLECTION_MAP[key]) return;

            const state = getGroupState(key);

            // Find all elements by attributes within this section
            state.elements = {
                section,
                header: $(`[data-filter-header="${key}"]`, section),
                collapseTarget: $('[filter-collapse="target"]', section),
                searchInput: $(`[searchbox-filter="${key}"]`, section),
                clearSearchBtn: $(`[clear-text-input="${key}"]`, section),
                clearFilterBtn: $(`[cms-clear-element="${key}"]`, section),
                group: $(`[data-filter-group="${key}"]`, section),
                template: $(`[data-filter-template="${key}"]`, section),
                arrow: $(`[data-filter-arrow="${key}"]`, section),
                count: $(`[data-filter-count="${key}"]`, section),
                loadingTemplate: $(`[data-filter-loading="${key}"]`, section),
                emptyTemplate: $(`[data-filter-empty="${key}"]`, section),
                errorTemplate: $(`[data-filter-error="${key}"]`, section),
                moreBtn: $(`[data-filter-more="${key}"]`, section)
            };

            if (!state.elements.header || !state.elements.group) {
                console.warn(`[Dynamic Filters] Missing header or group for "${key}"`);
                return;
            }

            // Hide templates
            if (state.elements.template) {
                state.elements.template.style.display = 'none';
            }
            if (state.elements.loadingTemplate) {
                state.elements.loadingTemplate.style.display = 'none';
            }
            if (state.elements.emptyTemplate) {
                state.elements.emptyTemplate.style.display = 'none';
            }
            if (state.elements.errorTemplate) {
                state.elements.errorTemplate.style.display = 'none';
            }
            if (state.elements.moreBtn) {
                state.elements.moreBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    loadMoreItems(key);
                });
            }

            // Set initial collapsed state on the collapse target
            if (state.elements.collapseTarget) {
                const ct = state.elements.collapseTarget;
                ct.style.height = '0';
                ct.style.overflow = 'hidden';
                ct.style.transition = CONFIG.COLLAPSE_TRANSITION;
            }

            attachSectionHandlers(key, state);
        });
    }

    function attachSectionHandlers(filterKey, state) {
        const { header, searchInput, clearSearchBtn, clearFilterBtn } = state.elements;

        // Collapse toggle on header click
        header.addEventListener('click', (e) => {
            // Don't toggle if clicking the clear-filter button inside the header
            if (e.target.closest(`[cms-clear-element="${filterKey}"]`)) return;
            toggleSection(filterKey);
        });

        // Search input
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.trim();
                handleSearchInput(filterKey, term);
            });
        }

        // Clear search button
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (searchInput) searchInput.value = '';
                handleSearchClear(filterKey);
                if (searchInput) searchInput.focus();
            });
        }

        // Clear all checked for this group
        if (clearFilterBtn) {
            clearFilterBtn.addEventListener('click', (e) => {
                e.preventDefault();
                clearGroupFilters(filterKey);
            });
        }
    }

    // ===== COLLAPSE =====

    function toggleSection(filterKey) {
        const state = getGroupState(filterKey);
        const ct = state.elements.collapseTarget;
        if (!ct) return;

        const newExpanded = !state.expanded;
        state.expanded = newExpanded;

        if (newExpanded) {
            // Expand: set height to scrollHeight, then auto after transition
            ct.style.height = ct.scrollHeight + 'px';
            const onEnd = () => {
                ct.removeEventListener('transitionend', onEnd);
                if (state.expanded) ct.style.height = 'auto';
            };
            ct.addEventListener('transitionend', onEnd);
        } else {
            // Collapse: set explicit height first, then 0 on next frame
            ct.style.height = ct.scrollHeight + 'px';
            requestAnimationFrame(() => {
                ct.style.height = '0';
            });
        }

        // Arrow rotation
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
        state.offset = 0;
        state.hasMore = false;

        showStateTemplate(filterKey, state.elements.loadingTemplate, 'Loading…');

        try {
            let items;
            let total = 0;
            const featuredCategory = CONFIG.FEATURED_MAP[filterKey];

            if (featuredCategory) {
                const response = await fetch(
                    `${CONFIG.WORKER_URL}/featured/${featuredCategory}?limit=${CONFIG.FEATURED_LIMIT}`
                );
                const data = await response.json();
                items = data.success ? (data.data || []) : [];
                // Featured endpoint may not return total; fall back to collection for "show more"
                total = data.metadata?.total ?? items.length;
            } else {
                const collection = CONFIG.COLLECTION_MAP[filterKey];
                const response = await fetch(
                    `${CONFIG.WORKER_URL}/${collection}?limit=${CONFIG.FEATURED_LIMIT}&sort=name&order=asc`
                );
                const data = await response.json();
                items = data.success ? (data.data || []) : [];
                total = data.metadata?.total ?? items.length;
            }

            const normalizedItems = items.map(normalizeItem);
            state.featuredItems = normalizedItems;
            state.offset = normalizedItems.length;
            state.hasMore = normalizedItems.length < total;
            state.loaded = true;
            renderItems(filterKey, normalizedItems);
        } catch (error) {
            console.error(`[Dynamic Filters] Failed to load featured items for ${filterKey}:`, error);
            showStateTemplate(filterKey, state.elements.errorTemplate, 'Failed to load. Click to retry.', () => loadFeaturedItems(filterKey));
        } finally {
            state.loading = false;
        }
    }

    async function searchCollection(filterKey, query) {
        const state = getGroupState(filterKey);

        // Cancel any in-flight request
        if (state.abortController) {
            state.abortController.abort();
        }
        state.abortController = new AbortController();
        state.offset = 0;
        state.hasMore = false;

        showStateTemplate(filterKey, state.elements.loadingTemplate, 'Searching…');

        try {
            const collection = CONFIG.COLLECTION_MAP[filterKey];
            const response = await fetch(
                `${CONFIG.WORKER_URL}/${collection}?search=${encodeURIComponent(query)}&limit=${CONFIG.SEARCH_LIMIT}`,
                { signal: state.abortController.signal }
            );
            const data = await response.json();
            const results = (data.data || []).map(normalizeItem);
            const total = data.metadata?.total ?? results.length;
            state.currentItems = results;
            state.offset = results.length;
            state.hasMore = results.length < total;
            renderItems(filterKey, results);
        } catch (error) {
            if (error.name === 'AbortError') return;
            console.error(`[Dynamic Filters] Search failed for ${filterKey}:`, error);
            showStateTemplate(filterKey, state.elements.errorTemplate, 'Search failed. Try again.', () => searchCollection(filterKey, query));
        } finally {
            state.abortController = null;
        }
    }

    async function loadMoreItems(filterKey) {
        const state = getGroupState(filterKey);
        if (state.loadingMore || !state.hasMore) return;

        state.loadingMore = true;
        const moreBtn = state.elements.moreBtn || state.elements.group?.querySelector('[data-filter-more-btn]');
        if (moreBtn) moreBtn.textContent = CONFIG.LOADING_MORE_LABEL;

        try {
            const collection = CONFIG.COLLECTION_MAP[filterKey];
            const limit = state.searchTerm ? CONFIG.SEARCH_LIMIT : CONFIG.FEATURED_LIMIT;
            let url = `${CONFIG.WORKER_URL}/${collection}?limit=${limit}&offset=${state.offset}&sort=name&order=asc`;
            if (state.searchTerm) {
                url = `${CONFIG.WORKER_URL}/${collection}?search=${encodeURIComponent(state.searchTerm)}&limit=${limit}&offset=${state.offset}`;
            }

            const response = await fetch(url);
            const data = await response.json();
            const newItems = (data.data || []).map(normalizeItem);
            const total = data.metadata?.total ?? (state.offset + newItems.length);

            state.offset += newItems.length;
            state.hasMore = state.offset < total;

            // Append to the appropriate items list
            if (state.searchTerm) {
                state.currentItems = state.currentItems.concat(newItems);
            } else {
                state.featuredItems = state.featuredItems.concat(newItems);
            }

            appendItems(filterKey, newItems);
        } catch (error) {
            console.error(`[Dynamic Filters] Failed to load more items for ${filterKey}:`, error);
            if (moreBtn) moreBtn.textContent = CONFIG.SHOW_MORE_LABEL;
        } finally {
            state.loadingMore = false;
        }
    }

    function normalizeItem(item) {
        return {
            name: item.name || '',
            slug: item.slug || '',
            region: item.region || item.territory || '',
            photoUrl: item.photoUrl || item.photo?.url || ''
        };
    }

    // ===== SEARCH HANDLING =====

    function handleSearchInput(filterKey, term) {
        const state = getGroupState(filterKey);
        state.searchTerm = term;

        if (state.debounceTimer) {
            clearTimeout(state.debounceTimer);
            state.debounceTimer = null;
        }

        if (!term) {
            handleSearchClear(filterKey);
            return;
        }

        state.debounceTimer = setTimeout(() => {
            searchCollection(filterKey, term);
        }, CONFIG.DEBOUNCE_MS);
    }

    function handleSearchClear(filterKey) {
        const state = getGroupState(filterKey);
        state.searchTerm = '';
        state.offset = state.featuredItems.length;
        state.hasMore = false;

        if (state.debounceTimer) {
            clearTimeout(state.debounceTimer);
            state.debounceTimer = null;
        }
        if (state.abortController) {
            state.abortController.abort();
            state.abortController = null;
        }

        if (state.featuredItems.length > 0) {
            renderItems(filterKey, state.featuredItems);
        }
    }

    // ===== CHECKBOX RENDERING =====

    function renderItems(filterKey, items) {
        const state = getGroupState(filterKey);
        const container = state.elements.group;
        const template = state.elements.template;
        if (!container || !template) return;

        // Sync checked names from Store
        syncCheckedFromStore(filterKey);

        const checkedNames = state.checkedValues;
        const itemNames = new Set(items.map(i => i.name));
        const fragment = document.createDocumentFragment();

        // 1. Pinned checked items not in current results
        checkedNames.forEach(name => {
            if (!itemNames.has(name)) {
                const pinnedItem = { name, slug: '', region: '', photoUrl: '' };
                const cached = state.featuredItems.find(i => i.name === name);
                if (cached) Object.assign(pinnedItem, cached);
                const el = cloneTemplate(filterKey, template, pinnedItem, true, true);
                if (el) fragment.appendChild(el);
            }
        });

        // 2. Current results
        items.forEach(item => {
            const isChecked = checkedNames.has(item.name);
            const el = cloneTemplate(filterKey, template, item, isChecked, false);
            if (el) fragment.appendChild(el);
        });

        // Clear existing cloned items and state templates
        clearClonedItems(container);
        hideAllStateTemplates(filterKey);

        if (!fragment.hasChildNodes() && items.length === 0) {
            showStateTemplate(filterKey, state.elements.emptyTemplate, 'No items found');
        } else {
            container.appendChild(fragment);
        }

        state.currentItems = items;
        updateShowMoreButton(filterKey);

        // Update collapse target height if expanded (content size changed)
        updateCollapseHeight(filterKey);
    }

    function appendItems(filterKey, newItems) {
        const state = getGroupState(filterKey);
        const container = state.elements.group;
        const template = state.elements.template;
        if (!container || !template) return;

        syncCheckedFromStore(filterKey);
        const checkedNames = state.checkedValues;
        const fragment = document.createDocumentFragment();

        newItems.forEach(item => {
            const isChecked = checkedNames.has(item.name);
            // Skip if already displayed (e.g. was pinned)
            const existing = container.querySelector(
                `input[cms-filter-value="${CSS.escape(item.name)}"]`
            );
            if (existing) return;
            const el = cloneTemplate(filterKey, template, item, isChecked, false);
            if (el) fragment.appendChild(el);
        });

        container.appendChild(fragment);
        updateShowMoreButton(filterKey);
        updateCollapseHeight(filterKey);
    }

    function updateShowMoreButton(filterKey) {
        const state = getGroupState(filterKey);
        const btn = state.elements.moreBtn;
        if (!btn) return;

        btn.textContent = CONFIG.SHOW_MORE_LABEL;
        btn.style.display = state.hasMore ? 'flex' : 'none';
    }

    function cloneTemplate(filterKey, template, item, isChecked, isPinned) {
        const clone = template.cloneNode(true);
        clone.style.display = '';
        clone.removeAttribute('data-filter-template');
        clone.setAttribute('data-filter-clone', 'true');

        if (isPinned) {
            clone.setAttribute('data-filter-pinned', 'true');
        }

        // Input — cms-filter-value uses name (for Store, tags, URL display)
        // data-filter-slug keeps the slug for link URLs
        const input = clone.querySelector('input[type="checkbox"]');
        if (input) {
            input.setAttribute('cms-filter-value', item.name);
            input.setAttribute('data-filter-slug', item.slug);
            input.setAttribute('data-filter-initialized', 'true');
            input.checked = isChecked;
            input.id = `${filterKey}-${item.slug}`;
        }

        // Checkbox visual
        const checkboxDiv = clone.querySelector('[class*="w-checkbox-input"]');
        if (checkboxDiv) {
            checkboxDiv.classList.toggle('w--redirected-checked', isChecked);
        }

        // Name
        const nameEl = clone.querySelector('[data-filter-item="name"]');
        if (nameEl) {
            nameEl.textContent = item.name;
            nameEl.setAttribute('for', `${filterKey}-${item.slug}`);
        }

        // Image
        const imgEl = clone.querySelector('[data-filter-item="image"]');
        if (imgEl) {
            if (item.photoUrl) {
                imgEl.src = item.photoUrl;
                imgEl.alt = item.name;
            } else {
                imgEl.style.display = 'none';
            }
        }

        // External link
        const linkEl = clone.querySelector('[data-filter-item="link"]');
        if (linkEl) {
            linkEl.href = `/${filterKey}/${item.slug}`;
        }

        // Attach change event to input
        if (input) {
            input.addEventListener('change', function () {
                handleCheckboxChange(filterKey, item.name, this.checked);
            });
        }

        // Click on label toggles checkbox (Webflow custom checkbox pattern)
        clone.addEventListener('click', (e) => {
            if (!input) return;
            if (e.target === input) return;
            // Don't toggle if clicking the external link
            if (e.target.closest('[data-filter-item="link"]')) return;
            e.preventDefault();
            input.checked = !input.checked;
            input.dispatchEvent(new Event('change'));
        });

        return clone;
    }

    function clearClonedItems(container) {
        // Remove all cloned items and any fallback state divs
        const clones = container.querySelectorAll('[data-filter-clone], [data-filter-state-fallback]');
        clones.forEach(el => el.remove());
    }

    function hideAllStateTemplates(filterKey) {
        const state = getGroupState(filterKey);
        const { loadingTemplate, emptyTemplate, errorTemplate } = state.elements;
        if (loadingTemplate) loadingTemplate.style.display = 'none';
        if (emptyTemplate) emptyTemplate.style.display = 'none';
        if (errorTemplate) errorTemplate.style.display = 'none';
        // Remove any click handler from error template
        if (errorTemplate) {
            const fresh = errorTemplate.cloneNode(true);
            fresh.style.display = 'none';
            errorTemplate.replaceWith(fresh);
            state.elements.errorTemplate = fresh;
        }
    }

    function showStateTemplate(filterKey, templateEl, fallbackText, onClick) {
        const state = getGroupState(filterKey);
        const container = state.elements.group;
        if (!container) return;

        clearClonedItems(container);
        hideAllStateTemplates(filterKey);

        if (templateEl) {
            templateEl.style.display = templateEl.getAttribute('data-filter-display') || 'flex';
            if (onClick) {
                templateEl.style.cursor = 'pointer';
                templateEl.addEventListener('click', onClick, { once: true });
            }
        } else {
            const el = document.createElement('div');
            el.setAttribute('data-filter-state-fallback', 'true');
            el.textContent = fallbackText;
            if (onClick) {
                el.style.cursor = 'pointer';
                el.addEventListener('click', onClick, { once: true });
            }
            container.appendChild(el);
        }

        updateCollapseHeight(filterKey);
    }

    function updateCollapseHeight(filterKey) {
        const state = getGroupState(filterKey);
        const ct = state.elements.collapseTarget;
        if (ct && state.expanded) {
            ct.style.height = 'auto';
        }
    }

    // ===== CHECKBOX EVENT HANDLING =====

    function handleCheckboxChange(filterKey, filterValue, isChecked) {
        const store = window.cmsDebug?.Store;
        if (!store || store.get('isClearing')) return;

        const state = getGroupState(filterKey);

        // Update Webflow visual for this checkbox
        const input = state.elements.group?.querySelector(
            `input[cms-filter-value="${CSS.escape(filterValue)}"]`
        );
        if (input) {
            const checkboxDiv = input.previousElementSibling;
            if (checkboxDiv && checkboxDiv.classList.contains('w-checkbox-input')) {
                checkboxDiv.classList.toggle('w--redirected-checked', isChecked);
            }
        }

        // Update Store with guard
        internalUpdate = true;
        if (isChecked) {
            store.addToFilter(filterKey, filterValue);
            state.checkedValues.add(filterValue);
        } else {
            store.removeFromFilter(filterKey, filterValue);
            state.checkedValues.delete(filterValue);
        }
        internalUpdate = false;

        updateFilterCounts();
        updateFilterIndicators(filterKey);
        window.cmsDebug.applyFilters();
    }

    // ===== CLEAR GROUP FILTERS =====

    function clearGroupFilters(filterKey) {
        const store = window.cmsDebug?.Store;
        if (!store) return;

        const filters = store.get('filters');
        if (!filters[filterKey]?.length) return;

        internalUpdate = true;
        store.setFilter(filterKey, []);
        internalUpdate = false;

        const state = getGroupState(filterKey);
        state.checkedValues.clear();

        // Update checkbox visuals
        if (state.expanded && state.elements.group) {
            const inputs = state.elements.group.querySelectorAll('input[type="checkbox"]');
            inputs.forEach(input => {
                input.checked = false;
                const checkboxDiv = input.previousElementSibling;
                if (checkboxDiv && checkboxDiv.classList.contains('w-checkbox-input')) {
                    checkboxDiv.classList.remove('w--redirected-checked');
                }
            });
        }

        updateFilterCounts();
        updateFilterIndicators(filterKey);
        window.cmsDebug.applyFilters();
    }

    // ===== STATE SYNC =====

    function syncCheckedFromStore(filterKey) {
        const store = window.cmsDebug?.Store;
        if (!store) return;

        const state = getGroupState(filterKey);
        const storeValues = store.get('filters')[filterKey] || [];
        state.checkedValues = new Set(storeValues);
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

    function updateFilterIndicators(filterKey) {
        const store = window.cmsDebug?.Store;
        if (!store) return;

        const count = store.get('filters')[filterKey]?.length || 0;
        const show = count > 0;

        $$(`[filter-indicator="${filterKey}"]`).forEach(el => {
            el.style.display = show ? 'flex' : 'none';
        });
    }

    function onStoreChange() {
        if (internalUpdate) return;

        updateFilterCounts();

        // Update per-key indicators for all groups
        groupState.forEach((_, filterKey) => {
            updateFilterIndicators(filterKey);
        });

        // Sync checked state for all initialized groups
        groupState.forEach((state, filterKey) => {
            const storeValues = window.cmsDebug?.Store?.get('filters')[filterKey] || [];
            const newChecked = new Set(storeValues);

            const oldChecked = state.checkedValues;
            const changed = newChecked.size !== oldChecked.size ||
                [...newChecked].some(v => !oldChecked.has(v)) ||
                [...oldChecked].some(v => !newChecked.has(v));

            if (changed) {
                state.checkedValues = newChecked;
                if (state.expanded && state.elements.group) {
                    updateCheckboxVisuals(filterKey);
                }
            }
        });
    }

    function updateCheckboxVisuals(filterKey) {
        const state = getGroupState(filterKey);
        const container = state.elements.group;
        if (!container) return;

        const checkedValues = state.checkedValues;

        // Update existing checkboxes
        const inputs = container.querySelectorAll('input[type="checkbox"][cms-filter]');
        inputs.forEach(input => {
            const value = input.getAttribute('cms-filter-value');
            const shouldBeChecked = checkedValues.has(value);

            if (input.checked !== shouldBeChecked) {
                input.checked = shouldBeChecked;
                const checkboxDiv = input.previousElementSibling;
                if (checkboxDiv && checkboxDiv.classList.contains('w-checkbox-input')) {
                    checkboxDiv.classList.toggle('w--redirected-checked', shouldBeChecked);
                }
            }
        });

        // Check if we need to re-render for pinned items
        const displayedValues = new Set();
        inputs.forEach(input => displayedValues.add(input.getAttribute('cms-filter-value')));

        const missingChecked = [...checkedValues].some(v => !displayedValues.has(v));
        const pinnedItems = container.querySelectorAll('[data-filter-pinned]');
        const hasStale = Array.from(pinnedItems).some(el => {
            const inp = el.querySelector('input[type="checkbox"]');
            return inp && !checkedValues.has(inp.getAttribute('cms-filter-value'));
        });

        if (missingChecked || hasStale) {
            const itemsToRender = state.searchTerm ? state.currentItems : state.featuredItems;
            renderItems(filterKey, itemsToRender);
        }
    }

    // ===== INITIALIZATION =====

    function initCore() {
        const store = window.cmsDebug?.Store;
        if (!store) {
            console.error('[Dynamic Filters] window.cmsDebug.Store not available');
            return;
        }

        initSections();

        store.subscribe(onStoreChange);
        updateFilterCounts();

        // Set initial indicator visibility for all keys
        Object.keys(CONFIG.COLLECTION_MAP).forEach(updateFilterIndicators);

        // Auto-expand sections that have active filters from URL
        const filters = store.get('filters');
        Object.keys(CONFIG.COLLECTION_MAP).forEach(filterKey => {
            if (filters[filterKey]?.length > 0) {
                const state = getGroupState(filterKey);
                if (state.elements.collapseTarget && !state.expanded) {
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
            document.addEventListener('DOMContentLoaded', () => waitForCmsDebug(initCore));
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
            state.offset = 0;
            state.hasMore = false;
            if (state.expanded) loadFeaturedItems(filterKey);
        },
        getState() {
            const result = {};
            groupState.forEach((state, key) => {
                result[key] = {
                    loaded: state.loaded,
                    expanded: state.expanded,
                    checkedCount: state.checkedValues.size,
                    featuredCount: state.featuredItems.length,
                    searchTerm: state.searchTerm,
                    hasMore: state.hasMore
                };
            });
            return result;
        }
    };

    init();

})();
