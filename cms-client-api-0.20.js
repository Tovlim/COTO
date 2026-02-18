/**
 * Webflow CMS Client Script - Mini Reports Version with Advanced Filtering
 * Works with the new mini-report HTML structure and comprehensive filtering system
 *
 * Refactored with:
 * - Centralized state management (pub/sub pattern)
 * - Reduced code duplication via utility functions
 */

(function() {
    'use strict';

    console.log('[CMS Client] Mini Reports with Filters script loading...');

    // ===== CONFIGURATION =====
    const CONFIG = {
        WORKER_URL: 'https://cms-reports-api.occupation-crimes.workers.dev',
        INITIAL_REPORTS_LIMIT: 6, // Smaller initial fetch for faster first paint
        REPORTS_LIMIT: 15, // Standard batch size for subsequent loads
        REPORTS_PER_PAGE: 10,
        DEBUG: false,
        VIEW_MODE_STORAGE_KEY: 'cms-view-mode' // localStorage key for persisting view mode
    };

    // ===== SELECTORS =====
    // Centralized selector strings to avoid magic strings throughout the codebase
    const SELECTORS = {
        // CMS delivery elements
        list: '[cms-deliver="list"]',
        item: '[cms-deliver="item"]',
        itemMini: '[cms-deliver="item"][cms-item-type="mini"]',
        itemFull: '[cms-deliver="item"][cms-item-type="full"]',
        itemNotTemplate: '[cms-deliver="item"]:not(.cms-template-original)',
        videosWrap: '[cms-deliver="videos-wrap"]',
        videoWrap: '[cms-deliver="video-wrap"]',
        imagesWrap: '[cms-deliver="images-wrap"]',

        // Filter elements
        filterForm: '[cms-filter="form-block"]',
        date: '[cms-filter="Date"]',
        dateFrom: '[cms-filter="From"]',
        dateUntil: '[cms-filter="Until"]',
        searchInput: '[filter-reports="search"]',
        filterAttr: '[cms-filter]',

        // Filter UI elements - Tag system
        tagsSection: '[cms-filter-element="tags-section"]',
        tagWrap: '[cms-filter-element="tag-wrap"]',
        tagClearAll: '[cms-filter-element="clear-all"]',
        tagFieldWrap: '[cms-filter-element="tag-value-wrap"]',
        tag: '[cms-filter-element="tag"]',
        tagNotTemplate: '[cms-filter-element="tag"]:not(.tag-template):not(.tag-field-template)',
        tagFieldNotTemplate: '[cms-filter-element="tag-value-wrap"]:not(.tag-field-template)',
        tagValue: '[cms-filter-element="tag-value"]',
        resultsCount: '[cms-filter-element="results-count"]',

        // Scroll and loading
        scrollWrap: '[cms-reports="scroll-wrap"]',
        scrollWindow: '[cms-reports="scroll-window"]',
        paddingCalc: '[cms-reports="padding-calc"]',
        jumpToTop: '[cms-reports="jump-to-top"]',
        scrollSentinel: '[scroll-sentinel="true"]',
        loadingIndicator: '[cms-loading="indicator"]',
        skeletonList: '[cms-deliver="skeleton-list"]',

        // Content elements
        headerThumbnail: '[cms-content="header-thumbnail"]',
        mainImage: '[cms-content="main-image"]',
        infoContent: '[cms-content="info"]',
        descriptionContent: '[cms-content="description"]',

        // View toggle
        viewToggle: '[cms-view-toggle]',

        // Action buttons
        shareAction: '[cms-action="share"]',
        clearAll: '[cms-clear-element="all"]',
        clearElement: '[cms-clear-element]',

        // Conditional visibility
        cmsExtra: '[cms-extra]'
    };

    // ===== CENTRALIZED STATE STORE =====
    const Store = {
        _state: {
            // Pagination state
            currentOffset: 0,
            totalReports: 0,
            isLoading: false,
            hasMoreReports: true,

            // Filter state
            filters: {
                search: '',
                date: '',
                dateFrom: '',
                dateUntil: '',
                topic: [],
                region: [],
                locality: [],
                settlement: [],
                territory: [],
                reporter: [],
                perpetrator: [],
                urgent: null
            },

            // UI state
            isClearing: false,
            viewMode: 'mini', // 'mini' or 'full'
            cachedReports: [], // Cache reports for view switching without re-fetch

            // Page-based filter (from CMS page slug, e.g., /topic/gaza-genocide)
            // This filter is permanent and cannot be cleared by the user
            pageFilter: null // { type: 'topic'|'reporter'|'region'|etc, slug: 'the-slug' }
        },

        // Report data cache - stores full report data by ID to avoid JSON serialization
        _reportDataCache: new Map(),

        _subscribers: new Map(),
        _subscriberId: 0,
        _isNotifying: false,
        _pendingNotify: null,

        // Get current state (returns a shallow copy to prevent direct mutation)
        getState() {
            return { ...this._state };
        },

        // Get specific state property
        get(key) {
            if (key.includes('.')) {
                return key.split('.').reduce((obj, k) => obj?.[k], this._state);
            }
            return this._state[key];
        },

        // Update state and notify subscribers
        setState(updates, silent = false) {
            const prevState = { ...this._state };

            // Handle nested updates (e.g., 'filters.search')
            Object.entries(updates).forEach(([key, value]) => {
                if (key.includes('.')) {
                    const keys = key.split('.');
                    let obj = this._state;
                    for (let i = 0; i < keys.length - 1; i++) {
                        obj = obj[keys[i]];
                    }
                    obj[keys[keys.length - 1]] = value;
                } else {
                    this._state[key] = value;
                }
            });

            if (!silent) {
                this._notify(prevState);
            }
        },

        // Update a filter value
        setFilter(filterKey, value) {
            this._state.filters[filterKey] = value;
            this._notify();
        },

        // Add value to array filter
        addToFilter(filterKey, value) {
            if (!Array.isArray(this._state.filters[filterKey])) {
                this._state.filters[filterKey] = [];
            }
            if (!this._state.filters[filterKey].includes(value)) {
                this._state.filters[filterKey].push(value);
                this._notify();
                return true;
            }
            return false;
        },

        // Remove value from array filter
        removeFromFilter(filterKey, value) {
            if (Array.isArray(this._state.filters[filterKey])) {
                const index = this._state.filters[filterKey].indexOf(value);
                if (index > -1) {
                    this._state.filters[filterKey].splice(index, 1);
                    this._notify();
                    return true;
                }
            }
            return false;
        },

        // Reset all filters to initial state
        resetFilters() {
            this._state.filters = {
                search: '',
                date: '',
                dateFrom: '',
                dateUntil: '',
                topic: [],
                region: [],
                locality: [],
                territory: [],
                reporter: [],
                perpetrator: [],
                urgent: null
            };
            this._notify();
        },

        // Reset pagination
        resetPagination() {
            console.warn('[SCROLL-DEBUG] resetPagination called, offset 0', new Error().stack?.split('\n').slice(1,4).join(' <- '));
            this._state.currentOffset = 0;
            this._state.hasMoreReports = true;
        },

        // Store report data in cache
        cacheReportData(reportId, data) {
            this._reportDataCache.set(reportId, data);
        },

        // Get report data from cache
        getReportData(reportId) {
            return this._reportDataCache.get(reportId);
        },

        // Clear report data cache
        clearReportCache() {
            this._reportDataCache.clear();
        },

        // Subscribe to state changes
        subscribe(callback, keys = null) {
            const id = ++this._subscriberId;
            this._subscribers.set(id, { callback, keys });
            return () => this._subscribers.delete(id);
        },

        // Notify all subscribers (with guard against cascading updates)
        _notify(prevState = null) {
            // If already notifying, queue this notification for later
            if (this._isNotifying) {
                this._pendingNotify = prevState;
                return;
            }

            this._isNotifying = true;

            try {
                this._subscribers.forEach(({ callback, keys }) => {
                    if (keys) {
                        // Only notify if watched keys changed
                        const changed = keys.some(key =>
                            this.get(key) !== (prevState ?
                                key.split('.').reduce((obj, k) => obj?.[k], prevState) :
                                undefined)
                        );
                        if (changed) callback(this._state);
                    } else {
                        callback(this._state);
                    }
                });
            } finally {
                this._isNotifying = false;

                // Process any pending notification that was queued during this cycle
                if (this._pendingNotify !== null) {
                    const pending = this._pendingNotify;
                    this._pendingNotify = null;
                    this._notify(pending);
                }
            }
        }
    };

    // ===== DOM UTILITIES =====
    const DOM = {
        // Query with optional context
        $(selector, context = document) {
            return context.querySelector(selector);
        },

        // Query all with optional context
        $$(selector, context = document) {
            return context.querySelectorAll(selector);
        },

        // Safely set text content
        setText(element, text) {
            if (element) {
                element.textContent = text || '';
                return true;
            }
            return false;
        },

        // Safely set image source
        setImage(element, src, alt = '') {
            if (!element) return false;

            if (src) {
                element.src = src;
                element.alt = alt;
                element.classList.remove('lazy', 'loading');
                element.removeAttribute('data-ll-status');
                if (element.loading !== 'lazy') {
                    element.loading = 'eager';
                }
                return true;
            } else {
                element.src = 'https://cdn.prod.website-files.com/plugins/Basic/assets/placeholder.60f9b1840c.svg';
                element.alt = 'No image available';
                return false;
            }
        },

        // Safely set rich text (innerHTML)
        setRichText(element, htmlContent) {
            if (element && htmlContent) {
                element.innerHTML = htmlContent;
                return true;
            }
            return false;
        },

        // Safely set link href and visibility
        setLink(element, url) {
            if (!element) return false;
            if (url) {
                element.href = url;
                element.style.display = '';
                return true;
            } else {
                element.style.display = 'none';
                return false;
            }
        },

        // Set multiple links with same URL
        setLinks(selector, parentElement, url) {
            const elements = parentElement.querySelectorAll(selector);
            elements.forEach(el => this.setLink(el, url));
            return elements.length > 0;
        },

        // Show/hide element
        toggle(element, show) {
            if (element) {
                element.style.display = show ? '' : 'none';
            }
        },

        // Create element with optional properties
        create(tag, props = {}) {
            const el = document.createElement(tag);
            Object.entries(props).forEach(([key, value]) => {
                if (key === 'className') el.className = value;
                else if (key === 'style') Object.assign(el.style, value);
                else if (key === 'innerHTML') el.innerHTML = value;
                else if (key === 'textContent') el.textContent = value;
                else el.setAttribute(key, value);
            });
            return el;
        },

        // Wait for element to appear
        waitFor(selector, timeout = 10000) {
            return new Promise((resolve) => {
                const element = document.querySelector(selector);
                if (element) {
                    resolve(element);
                    return;
                }

                const observer = new MutationObserver((_, obs) => {
                    const element = document.querySelector(selector);
                    if (element) {
                        obs.disconnect();
                        resolve(element);
                    }
                });

                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });

                setTimeout(() => {
                    observer.disconnect();
                    resolve(null);
                }, timeout);
            });
        }
    };

    // ===== DOM BATCH UTILITIES =====
    // Helper functions for batching DOM operations
    const DOMBatch = {
        // Batch multiple elements into a DocumentFragment before insertion
        createFragment(elements) {
            const fragment = document.createDocumentFragment();
            elements.forEach(el => fragment.appendChild(el));
            return fragment;
        },

        // Batch remove multiple elements
        removeAll(elements) {
            const elementsArray = Array.from(elements);
            elementsArray.forEach(el => el.remove());
        }
    };

    // ===== SKELETON MANAGER =====
    // Manages skeleton placeholder list visibility during initial load
    const SkeletonManager = {
        _skeletonList: null,
        _realList: null,
        _initialized: false,

        init() {
            if (this._initialized) return;

            this._skeletonList = DOM.$(SELECTORS.skeletonList);
            this._realList = DOM.$(SELECTORS.list);

            if (this._skeletonList) {
                console.log('[CMS Client] SkeletonManager initialized');
                this._initialized = true;
            } else {
                log('SkeletonManager: No skeleton list found, skipping');
            }
        },

        // Show skeleton list, hide real list
        show() {
            if (!this._initialized) return;

            if (this._skeletonList) {
                this._skeletonList.style.display = 'flex';
            }
            if (this._realList) {
                this._realList.style.display = 'none';
            }
            log('Skeleton shown');
        },

        // Hide skeleton list, show real list
        hide() {
            if (!this._initialized) return;

            if (this._skeletonList) {
                this._skeletonList.style.display = 'none';
            }
            if (this._realList) {
                this._realList.style.display = 'flex';
            }
            log('Skeleton hidden');
        },

        // Check if skeleton is currently visible
        isVisible() {
            if (!this._skeletonList) return false;
            return this._skeletonList.style.display !== 'none';
        }
    };

    // ===== TOP OFFSET MANAGER =====
    // Manages dynamic top offset for fixed header compensation
    const TopOffset = {
        _value: 0,
        _element: null,
        _resizeObserver: null,
        _initialized: false,

        init() {
            if (this._initialized) return;

            // Only apply offset in window scroll mode
            const useWindowScroll = !!DOM.$(SELECTORS.scrollWindow);
            if (!useWindowScroll) {
                log('TopOffset: Skipping - not in window scroll mode');
                return;
            }

            this._element = DOM.$(SELECTORS.paddingCalc);
            if (!this._element) {
                log('TopOffset: No padding-calc element found');
                return;
            }

            // Initial measurement
            this._updateValue();

            // Watch for size changes
            this._resizeObserver = new ResizeObserver(() => {
                this._updateValue();
            });
            this._resizeObserver.observe(this._element);

            this._initialized = true;
            console.log('[CMS Client] TopOffset initialized:', this._value + 'px');
        },

        _updateValue() {
            if (!this._element) return;

            const newValue = this._element.offsetHeight;
            if (newValue !== this._value) {
                this._value = newValue;
                this._applyCssVariable();
                log('TopOffset updated:', this._value + 'px');
            }
        },

        _applyCssVariable() {
            document.documentElement.style.setProperty('--cms-top-offset', this._value + 'px');
        },

        // Get current offset value (for scroll calculations)
        get() {
            return this._value;
        },

        // Force recalculation and reapply CSS
        refresh() {
            if (this._element) {
                this._value = this._element.offsetHeight;
                this._applyCssVariable();
            }
        },

        // Cleanup
        destroy() {
            if (this._resizeObserver) {
                this._resizeObserver.disconnect();
                this._resizeObserver = null;
            }
            this._initialized = false;
        }
    };

    // ===== TEMPLATE MANAGER =====
    const TemplateManager = {
        templates: {
            mini: null,
            full: null
        },

        // Initialize templates from DOM
        init(listContainer) {
            // Find templates by cms-item-type attribute
            const miniTemplate = listContainer?.querySelector(SELECTORS.itemMini);
            const fullTemplate = listContainer?.querySelector(SELECTORS.itemFull);

            // Fallback: if no typed templates, use first item as mini
            if (!miniTemplate && !fullTemplate) {
                const defaultTemplate = listContainer?.querySelector(SELECTORS.item);
                if (defaultTemplate) {
                    defaultTemplate.setAttribute('cms-item-type', 'mini');
                    this.templates.mini = defaultTemplate.cloneNode(true);
                    console.log('[CMS Client] Using default template as mini');
                }
            } else {
                if (miniTemplate) {
                    this.templates.mini = miniTemplate.cloneNode(true);
                    miniTemplate.classList.add('cms-template-original');
                    miniTemplate.style.display = 'none';
                    console.log('[CMS Client] Mini template initialized');
                }
                if (fullTemplate) {
                    this.templates.full = fullTemplate.cloneNode(true);
                    fullTemplate.classList.add('cms-template-original');
                    fullTemplate.style.display = 'none';
                    console.log('[CMS Client] Full template initialized');
                }
            }

            return this.templates.mini || this.templates.full;
        },

        // Get the active template based on current view mode
        getActiveTemplate() {
            const viewMode = Store.get('viewMode');
            const template = this.templates[viewMode];

            if (!template) {
                console.warn(`[CMS Client] No template found for view mode: ${viewMode}, falling back`);
                return this.templates.mini || this.templates.full;
            }

            return template;
        },

        // Check if both templates are available
        hasBothTemplates() {
            return !!(this.templates.mini && this.templates.full);
        },

        // Get available view modes
        getAvailableModes() {
            const modes = [];
            if (this.templates.mini) modes.push('mini');
            if (this.templates.full) modes.push('full');
            return modes;
        }
    };

    // ===== CHECKBOX UTILITIES =====
    const CheckboxUtils = {
        // Check if a Webflow checkbox is checked (handles custom styling)
        isChecked(checkbox) {
            if (checkbox.checked) return true;

            // Check Webflow's redirected class on wrapper
            const wrapper = checkbox.closest('.w-checkbox-input');
            if (wrapper?.classList.contains('w--redirected-checked')) return true;

            // Check previous sibling (alternative Webflow structure)
            const siblingDiv = checkbox.previousElementSibling;
            if (siblingDiv?.classList.contains('w-checkbox-input') &&
                siblingDiv.classList.contains('w--redirected-checked')) {
                return true;
            }

            return false;
        },

        // Uncheck a Webflow checkbox (updates both input and styling)
        uncheck(checkbox) {
            checkbox.checked = false;

            // Update Webflow styling
            const checkboxDiv = checkbox.previousElementSibling ||
                               checkbox.closest('.w-checkbox-input');
            if (checkboxDiv) {
                checkboxDiv.classList.remove('w--redirected-checked');
            }
        },

        // Get filter key and value from checkbox
        getFilterInfo(checkbox) {
            return {
                key: checkbox.getAttribute('cms-filter')?.toLowerCase(),
                value: checkbox.getAttribute('cms-filter-value') || checkbox.value
            };
        },

        // Find checkbox by filter key and value
        find(filterKey, filterValue) {
            let checkbox = DOM.$(`[cms-filter="${filterKey}"][cms-filter-value="${filterValue}"]`);
            if (!checkbox) {
                const capitalizedKey = filterKey.charAt(0).toUpperCase() + filterKey.slice(1);
                checkbox = DOM.$(`[cms-filter="${capitalizedKey}"][cms-filter-value="${filterValue}"]`);
            }
            return checkbox;
        },

        // Get all checkboxes for a filter key
        findAll(filterKey) {
            let checkboxes = DOM.$$(`input[type="checkbox"][cms-filter="${filterKey}"]`);
            if (checkboxes.length === 0) {
                const capitalizedKey = filterKey.charAt(0).toUpperCase() + filterKey.slice(1);
                checkboxes = DOM.$$(`input[type="checkbox"][cms-filter="${capitalizedKey}"]`);
            }
            return checkboxes;
        }
    };

    // ===== DATE UTILITIES =====
    const DateUtils = {
        // Get start of calendar day (midnight) in local timezone
        _getStartOfDay(date) {
            const d = new Date(date);
            d.setHours(0, 0, 0, 0);
            return d;
        },

        // Calculate difference in calendar days between two dates
        _getDaysDifference(date1, date2) {
            const start1 = this._getStartOfDay(date1);
            const start2 = this._getStartOfDay(date2);
            const diffMs = start2 - start1;
            return Math.floor(diffMs / (1000 * 60 * 60 * 24));
        },

        // Format date with relative labels (Today, Yesterday, X days ago, Last week)
        format(dateString) {
            if (!dateString) return '';
            try {
                const date = new Date(dateString);
                if (isNaN(date.getTime())) return '';

                const today = new Date();
                const daysDiff = this._getDaysDifference(date, today);

                // Same calendar day
                if (daysDiff === 0) {
                    return 'Today';
                }

                // Previous calendar day
                if (daysDiff === 1) {
                    return 'Yesterday';
                }

                // 2-13 days ago
                if (daysDiff >= 2 && daysDiff <= 13) {
                    return `${daysDiff} days ago`;
                }

                // 14+ days ago - use full formatted date
                return date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
            } catch (e) {
                log('Date format error:', e);
                return '';
            }
        },

        // Format date for filter tags (always full date for clarity)
        formatForTag(dateString) {
            if (!dateString) return '';
            try {
                const date = new Date(dateString);
                if (isNaN(date.getTime())) return '';
                return date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
            } catch (e) {
                return dateString;
            }
        }
    };

    // ===== EXTRA VISIBILITY =====
    // Handles conditional visibility of elements based on cms-extra attribute
    // Usage: <div cms-extra="perpetrator"> will only show if report has perpetrator data
    const ExtraVisibility = {
        // Map of subject names to functions that check if data exists
        // Each function receives reportData and returns true if the subject has data
        _subjectChecks: {
            // Perpetrator - check both array and single object formats
            perpetrator: (data) => !!(data.perpetrators?.length > 0 || data.perpetrator),
            perp: (data) => !!(data.perpetrators?.length > 0 || data.perpetrator),

            // Settlement (array of { id, name, slug })
            settlement: (data) => Array.isArray(data.settlement) ? data.settlement.length > 0 : !!(data.settlement?.name || data.settlement?.slug),

            // Place / Location Type
            place: (data) => !!(data.place?.name || data.place?.slug || data.locationType?.name || data.locationType?.slug),
            locationType: (data) => !!(data.place?.name || data.place?.slug || data.locationType?.name || data.locationType?.slug),

            // Backer
            backer: (data) => !!(data.backer?.name || data.backer?.slug),

            // Description / Info content
            description: (data) => !!(data.description?.trim()),
            info: (data) => !!(data.description?.trim()),

            // Media
            videos: (data) => !!(data.videos?.length > 0),
            images: (data) => !!(data.reportImages?.length > 0),
            reportImages: (data) => !!(data.reportImages?.length > 0),
            photo: (data) => !!(data.photo?.url),

            // Victims donation link
            victimsDonationLink: (data) => !!(data.victimsDonationLink),
            victims: (data) => !!(data.victimsDonationLink),

            // Reporter event link
            reporterEventLink: (data) => !!(data.reporterEventLink),

            // Urgent flag
            urgent: (data) => data.urgent === true,

            // Topic
            topic: (data) => !!(data.topic?.length > 0 || data.topic?.slug),

            // Reporters
            reporters: (data) => !!(data.reporters?.length > 0),
            reporter: (data) => !!(data.reporters?.length > 0),

            // Location fields
            locality: (data) => !!(data.locality?.name || (Array.isArray(data.locality) && data.locality.length > 0)),
            region: (data) => !!(data.subRegion?.name || data.region?.name ||
                                (Array.isArray(data.subRegion) && data.subRegion.length > 0) ||
                                (Array.isArray(data.region) && data.region.length > 0)),
            territory: (data) => !!(data.territory?.name || (Array.isArray(data.territory) && data.territory.length > 0)),

            // Multi-location flags
            multiLocality: (data) => !!data.hasMultipleLocalities,
            multiRegion: (data) => !!data.hasMultipleSubRegions,
            multiTerritory: (data) => !!data.hasMultipleTerritories,
            multiGovernorate: (data) => !!data.hasMultipleRegions
        },

        // Apply visibility to all cms-extra elements within a container
        apply(itemElement, reportData) {
            const extraElements = DOM.$$(SELECTORS.cmsExtra, itemElement);

            if (extraElements.length === 0) return;

            extraElements.forEach(element => {
                const subject = element.getAttribute('cms-extra');
                if (!subject) return;

                // Support multiple subjects with comma separation (AND logic)
                // e.g., cms-extra="perpetrator,settlement" shows only if BOTH exist
                const subjects = subject.split(',').map(s => s.trim().toLowerCase());

                // Check if ALL subjects have data (AND logic)
                const shouldShow = subjects.every(subj => {
                    const check = this._subjectChecks[subj];
                    if (!check) {
                        log(`ExtraVisibility: Unknown subject "${subj}"`);
                        return false;
                    }
                    return check(reportData);
                });

                DOM.toggle(element, shouldShow);
            });

            log('ExtraVisibility applied:', extraElements.length, 'elements processed');
        },

        // Check if a specific subject has data (for external use)
        hasData(subject, reportData) {
            const check = this._subjectChecks[subject.toLowerCase()];
            return check ? check(reportData) : false;
        },

        // Get list of supported subjects
        getSupportedSubjects() {
            return Object.keys(this._subjectChecks);
        }
    };

    // ===== URL MANAGER =====
    // Handles URL parameter synchronization for shareable/bookmarkable filter states
    const UrlManager = {
        // Filter keys that are arrays (comma-separated in URL)
        _arrayFilters: ['topic', 'region', 'locality', 'settlement', 'territory', 'reporter', 'perpetrator'],

        // Parse URL parameters and return filter state
        parseUrl() {
            const params = new URLSearchParams(window.location.search);
            const filters = {
                search: '',
                date: '',
                dateFrom: '',
                dateUntil: '',
                topic: [],
                region: [],
                locality: [],
                settlement: [],
                territory: [],
                reporter: [],
                perpetrator: [],
                urgent: null
            };

            // Parse search
            if (params.has('search')) {
                filters.search = params.get('search') || '';
            }

            // Parse dates
            if (params.has('date')) {
                filters.date = params.get('date') || '';
            }
            if (params.has('dateFrom')) {
                filters.dateFrom = params.get('dateFrom') || '';
            }
            if (params.has('dateUntil')) {
                filters.dateUntil = params.get('dateUntil') || '';
            }

            // Parse array filters (comma-separated)
            this._arrayFilters.forEach(key => {
                if (params.has(key)) {
                    const value = params.get(key);
                    if (value) {
                        filters[key] = value.split(',').map(v => v.trim()).filter(v => v);
                    }
                }
            });

            // Parse urgent (boolean)
            if (params.has('urgent')) {
                const urgentVal = params.get('urgent');
                filters.urgent = urgentVal === 'true' ? true : urgentVal === 'false' ? false : null;
            }

            return filters;
        },

        // Build URL search string from current Store filters
        buildUrlParams() {
            const filters = Store.get('filters');
            const params = new URLSearchParams();

            // Note: Page filter is now part of the URL path (e.g., /map/by-btselem)
            // so we don't need to preserve it in query params

            // Add search
            if (filters.search) {
                params.set('search', filters.search);
            }

            // Add dates (single date takes precedence)
            if (filters.date) {
                params.set('date', filters.date);
            } else {
                if (filters.dateFrom) {
                    params.set('dateFrom', filters.dateFrom);
                }
                if (filters.dateUntil) {
                    params.set('dateUntil', filters.dateUntil);
                }
            }

            // Add array filters
            this._arrayFilters.forEach(key => {
                if (filters[key]?.length > 0) {
                    params.set(key, filters[key].join(','));
                }
            });

            // Add urgent
            if (filters.urgent !== null) {
                params.set('urgent', filters.urgent.toString());
            }

            return params.toString();
        },

        // Update browser URL without page reload
        updateUrl(useReplaceState = false) {
            const paramString = this.buildUrlParams();
            const newUrl = paramString
                ? `${window.location.pathname}?${paramString}`
                : window.location.pathname;

            if (useReplaceState) {
                window.history.replaceState({ filters: Store.get('filters') }, '', newUrl);
            } else {
                window.history.pushState({ filters: Store.get('filters') }, '', newUrl);
            }

            log('URL updated:', newUrl);
        },

        // Check if URL has any filter parameters
        hasFiltersInUrl() {
            const params = new URLSearchParams(window.location.search);
            const filterKeys = ['search', 'date', 'dateFrom', 'dateUntil', 'urgent', ...this._arrayFilters];
            return filterKeys.some(key => params.has(key));
        },

        // Apply URL filters to Store and sync UI elements
        applyUrlFiltersToStore() {
            const urlFilters = this.parseUrl();

            // Update Store with URL filters (silent to avoid triggering subscribers prematurely)
            Object.entries(urlFilters).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                    Store.setFilter(key, value);
                } else if (value !== '' && value !== null) {
                    Store.setFilter(key, value);
                }
            });

            return urlFilters;
        },

        // Sync UI elements with current Store filters
        syncUIWithFilters() {
            const filters = Store.get('filters');

            // Sync search input
            const searchInput = DOM.$(SELECTORS.searchInput);
            if (searchInput && filters.search) {
                searchInput.value = filters.search;

                // Open search wrap if there's a search filter from URL
                const searchWrap = DOM.$('.header-search-wrap');
                const searchToggles = DOM.$$('[filter-reports="search-toggle"]');
                if (searchWrap) {
                    searchWrap.classList.remove('hide--search');
                }
                searchToggles.forEach(toggle => toggle.classList.add('is--open'));
            }

            // Sync date inputs
            const dateInput = DOM.$(SELECTORS.date);
            if (dateInput && filters.date) {
                dateInput.value = filters.date;
                if (dateInput._flatpickr) {
                    dateInput._flatpickr.setDate(filters.date, false);
                }
            }

            const dateFromInput = DOM.$(SELECTORS.dateFrom);
            if (dateFromInput && filters.dateFrom) {
                dateFromInput.value = filters.dateFrom;
                if (dateFromInput._flatpickr) {
                    dateFromInput._flatpickr.setDate(filters.dateFrom, false);
                }
            }

            const dateUntilInput = DOM.$(SELECTORS.dateUntil);
            if (dateUntilInput && filters.dateUntil) {
                dateUntilInput.value = filters.dateUntil;
                if (dateUntilInput._flatpickr) {
                    dateUntilInput._flatpickr.setDate(filters.dateUntil, false);
                }
            }

            // Sync checkboxes for array filters
            this._arrayFilters.forEach(filterKey => {
                const values = filters[filterKey] || [];
                values.forEach(value => {
                    const checkbox = CheckboxUtils.find(filterKey, value);
                    if (checkbox && !CheckboxUtils.isChecked(checkbox)) {
                        checkbox.checked = true;
                        // Update Webflow visual state
                        const checkboxDiv = checkbox.previousElementSibling ||
                                           checkbox.closest('.w-checkbox-input');
                        if (checkboxDiv) {
                            checkboxDiv.classList.add('w--redirected-checked');
                        }
                    }
                });
            });

            log('UI synced with filters:', filters);
        },

        // Initialize popstate listener for browser back/forward
        initPopstateListener() {
            window.addEventListener('popstate', (event) => {
                log('Popstate event:', event.state);

                // Parse filters from URL (more reliable than event.state)
                const urlFilters = this.parseUrl();

                // Reset Store filters
                Store.resetFilters();

                // Apply URL filters to Store
                Object.entries(urlFilters).forEach(([key, value]) => {
                    Store.setFilter(key, value);
                });

                // Sync UI
                this.syncUIWithFilters();

                // Apply filters (this will fetch new data)
                applyFilters(true); // true = skip URL update since we're responding to URL change
            });

            console.log('[CMS Client] Popstate listener initialized');
        }
    };

    // ===== PAGE FILTER MANAGER =====
    // Detects and manages page-based filters from:
    // 1. Map collection URLs: /map/[prefix]-[slug] (e.g., /map/by-btselem, /map/loc-gaza)
    // 2. CMS page URLs: /topic/gaza-genocide, /reporter/btselem, etc.
    // These filters are permanent and cannot be cleared by the user
    const PageFilter = {
        // Supported page types and their URL patterns
        // The key is the filter type (matches API parameter), value is the URL prefix
        _pageTypes: {
            topic: '/topic/',
            reporter: '/reporter/',
            region: '/region/',
            locality: '/locality/',
            territory: '/territory/',
            perpetrator: '/perp/',
            settlement: '/settlement/'
        },

        // Map collection prefixes to filter types
        // Used for /map/[prefix]-[slug] pattern
        _mapPrefixes: {
            'by': 'reporter',      // /map/by-btselem
            'top': 'topic',        // /map/top-genocide
            'reg': 'region',       // /map/reg-gaza
            'loc': 'locality',     // /map/loc-gaza
            'ter': 'territory',    // /map/ter-west-bank
            'stl': 'settlement',   // /map/stl-ariel
            'prp': 'perpetrator',  // /map/prp-idf
            'of': 'custom'         // /map/of-siege-of-gaza (user-generated)
        },

        // Detect page filter from map collection URL or CMS page URL
        detect() {
            const path = window.location.pathname;

            // 1. Check for map collection pattern: /map/[prefix]-[slug]
            const mapMatch = path.match(/^\/map\/([a-z]+)-(.+?)\/?$/);
            if (mapMatch) {
                const prefix = mapMatch[1];
                const slug = mapMatch[2];
                const type = this._mapPrefixes[prefix];

                if (type) {
                    console.log('[CMS Client] Page filter from map collection:', type, slug);
                    return { type, slug, fromMapCollection: true };
                }
            }

            // 2. Check URL path patterns (e.g., /reporter/btselem)
            for (const [type, prefix] of Object.entries(this._pageTypes)) {
                if (path.startsWith(prefix)) {
                    // Extract slug from path (everything after the prefix, excluding trailing slash)
                    const slug = path.slice(prefix.length).replace(/\/$/, '');
                    if (slug) {
                        return { type, slug, fromMapCollection: false };
                    }
                }
            }

            return null;
        },

        // Initialize page filter from URL and store it
        init() {
            const pageFilter = this.detect();

            if (pageFilter) {
                Store.setState({ pageFilter }, true);
                console.log('[CMS Client] Page filter detected:', pageFilter);
            }

            return pageFilter;
        },

        // Get the current page filter
        get() {
            return Store.get('pageFilter');
        },

        // Check if there's an active page filter
        hasPageFilter() {
            return Store.get('pageFilter') !== null;
        },

        // Get page filter as URL parameter string (for API calls)
        toUrlParam() {
            const pageFilter = this.get();
            if (!pageFilter) return '';

            return `${pageFilter.type}=${encodeURIComponent(pageFilter.slug)}`;
        },

        // Get display info for the page filter (for showing in UI if needed)
        getDisplayInfo() {
            const pageFilter = this.get();
            if (!pageFilter) return null;

            // Convert slug to display name (replace hyphens with spaces, title case)
            const displayName = pageFilter.slug
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');

            return {
                type: pageFilter.type,
                slug: pageFilter.slug,
                displayName
            };
        }
    };

    // ===== LOGGING =====
    function log(...args) {
        if (CONFIG.DEBUG) {
            console.log('[CMS Client]', ...args);
        }
    }

    // ===== ASYNC UTILITIES =====
    // Wait for next frame - ensures DOM updates have been painted
    // Uses double rAF to guarantee paint has occurred
    function nextFrame() {
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                requestAnimationFrame(resolve);
            });
        });
    }

    // ===== CMS LOADING INDICATOR =====
    function setCmsLoadingIndicator(show) {
        document.querySelectorAll(SELECTORS.loadingIndicator).forEach(el => {
            el.style.display = show ? '' : 'none';
        });
    }

    // ===== LOCATION FIELDS CONFIG =====
    const LOCATION_FIELDS = [
        {
            dataKey: 'locality',
            fieldSelector: '[cms-field="locality"]',
            linkSelector: '[cms-link="locality"]',
            slashAttr: 'locality',
            urlPrefix: '/locality/'
        },
        {
            dataKey: 'subRegion',
            fieldSelector: '[cms-field="region"]',
            linkSelector: '[cms-link="region"]',
            slashAttr: 'region',
            urlPrefix: '/region/'
        },
        {
            dataKey: 'region',
            fieldSelector: '[cms-field="governorate"]',
            linkSelector: '[cms-link="governorate"]',
            slashAttr: 'governorate',
            urlPrefix: '/region/'
        },
        {
            dataKey: 'territory',
            fieldSelector: '[cms-field="territory"]',
            linkSelector: '[cms-link="territory"]',
            slashAttr: null,
            urlPrefix: '/territory/'
        }
    ];

    // ===== REPORTER HELPERS =====
    function formatReporterNames(reporters) {
        if (!reporters || reporters.length === 0) return 'Unknown source';

        const names = reporters.map(r => r.name);
        if (names.length === 1) return names[0];
        if (names.length === 2) return names.join(' & ');

        const lastReporter = names.pop();
        return names.join(', ') + ' & ' + lastReporter;
    }

    // ===== MODAL UTILITIES =====
    const ModalUtils = {
        open(reporterListWrap) {
            if (!reporterListWrap) return;

            // Batch all modal open operations in single frame
            requestAnimationFrame(() => {
                reporterListWrap.classList.add('modal-click');
                reporterListWrap.style.display = 'flex';

                const modalPreWrap = DOM.$('.modal-pre-wrap', reporterListWrap);
                if (modalPreWrap) {
                    modalPreWrap.classList.add('modal-click');
                    const modalElements = DOM.$('[modal-elements="true"]', modalPreWrap);
                    if (modalElements) modalElements.classList.add('modal-click');
                }
            });
        },

        close(reporterListWrap) {
            if (!reporterListWrap) return;

            // Batch all modal close operations in single frame
            requestAnimationFrame(() => {
                const modalPreWrap = DOM.$('.modal-pre-wrap', reporterListWrap);
                if (modalPreWrap) {
                    modalPreWrap.classList.remove('modal-click');
                    const modalElements = DOM.$('[modal-elements="true"]', modalPreWrap);
                    if (modalElements) modalElements.classList.remove('modal-click');
                }

                reporterListWrap.classList.remove('modal-click');
                reporterListWrap.style.display = 'none';
            });
        },

        // Mark element for delegation (no individual listeners needed)
        setupTrigger(multiReporterWrap) {
            if (!multiReporterWrap) return;
            multiReporterWrap.style.cursor = 'pointer';
        },

        // No-op - delegation handles close events
        setupClose() {
            // Delegated event handler manages all modal close interactions
        },

        // Initialize delegated event handlers (called once during app init)
        initDelegation() {
            if (this._delegationInitialized) return;
            this._delegationInitialized = true;

            document.addEventListener('click', (e) => {
                // Handle multi-reporter modal trigger
                const multiReporterWrap = e.target.closest('[multi-reporter-wrap="true"]');
                if (multiReporterWrap) {
                    e.preventDefault();
                    e.stopPropagation();
                    const reportersWrap = multiReporterWrap.closest('[reporters-wrap="true"]');
                    if (reportersWrap) {
                        const reporterListWrap = DOM.$('[reporter-list-wrap="true"]', reportersWrap);
                        this.open(reporterListWrap);
                    }
                    return;
                }

                // Handle modal close button
                const closeBtn = e.target.closest('[modal-close-btn="true"]');
                if (closeBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const reporterListWrap = closeBtn.closest('[reporter-list-wrap="true"]');
                    this.close(reporterListWrap);
                    return;
                }

                // Handle modal background click (close on backdrop)
                const reporterListWrap = e.target.closest('[reporter-list-wrap="true"]');
                if (reporterListWrap && e.target === reporterListWrap) {
                    e.preventDefault();
                    this.close(reporterListWrap);
                    return;
                }
            });

            log('ModalUtils delegation initialized');
        },

        _delegationInitialized: false
    };

    // ===== POPULATE FUNCTIONS =====

    // Populate header thumbnail with main image
    function populateHeaderThumbnail(itemElement, reportData) {
        const thumbnailElement = DOM.$(SELECTORS.headerThumbnail, itemElement);
        if (!thumbnailElement) return;

        if (!reportData.photo?.url) {
            thumbnailElement.style.display = 'none';
            return;
        }

        thumbnailElement.href = reportData.photo.url;
        thumbnailElement.removeAttribute('data-fancybox');
        thumbnailElement.setAttribute('data-caption', reportData.photo?.alt || reportData.name || '');
        thumbnailElement.setAttribute('data-thumb', reportData.photo.url);

        const thumbnailImg = DOM.$('img', thumbnailElement);
        if (thumbnailImg) {
            thumbnailImg.src = reportData.photo.url;
            thumbnailImg.alt = reportData.name || '';
            thumbnailImg.classList.remove('lazy', 'loading');
            thumbnailImg.removeAttribute('data-ll-status');
        }

        // No individual listener - handled by ThumbnailHandler delegation
        thumbnailElement.style.display = '';
    }

    // ===== THUMBNAIL HANDLER (Delegated) =====
    const ThumbnailHandler = {
        _initialized: false,

        init() {
            if (this._initialized) return;
            this._initialized = true;

            document.addEventListener('click', (e) => {
                const thumbnail = e.target.closest(SELECTORS.headerThumbnail);
                if (!thumbnail) return;

                e.preventDefault();

                if (typeof Fancybox === 'undefined') return;

                const itemElement = thumbnail.closest(SELECTORS.item);
                const reportId = itemElement?.getAttribute('data-report-id');
                const reportData = reportId ? Store.getReportData(reportId) : null;

                // Show single main photo in lightbox (full gallery on report page)
                const src = reportData?.photo?.url || thumbnail.href;
                const caption = reportData?.photo?.alt || reportData?.name || thumbnail.getAttribute('data-caption') || '';
                Fancybox.show([{ src, caption, thumb: src }], { hideScrollbar: false });
            });

            log('ThumbnailHandler delegation initialized');
        }
    };

    // Populate reporter byline links
    function populateReporterBylineLinks(itemElement, reporters) {
        const templateLink = DOM.$('a[cms-link="reporter"]', itemElement);
        if (!templateLink || !reporters || reporters.length === 0) {
            if (templateLink) templateLink.style.display = 'none';
            return;
        }

        const parentContainer = templateLink.parentElement;
        if (!parentContainer) return;

        // Batch remove existing clones and separators
        const existingLinks = Array.from(DOM.$$('a[cms-link="reporter"]', parentContainer));
        const existingSeparators = Array.from(DOM.$$('.reporter-separator', parentContainer));
        DOMBatch.removeAll(existingLinks.slice(1)); // Keep first link (template)
        DOMBatch.removeAll(existingSeparators);

        const separatorTemplate = DOM.create('div', {
            className: 'sub-text-block reporter-separator',
            textContent: '·'
        });

        // Build all elements first, then insert in one batch
        const elementsToInsert = [];
        const validReporters = reporters.filter(r => r.slug);

        validReporters.forEach((reporter, index) => {
            let reporterLink;
            if (index === 0) {
                // Update template link in place
                reporterLink = templateLink;
            } else {
                // Create separator and new link
                elementsToInsert.push(separatorTemplate.cloneNode(true));
                reporterLink = templateLink.cloneNode(true);
                elementsToInsert.push(reporterLink);
            }

            reporterLink.href = `/reporter/${reporter.slug}`;
            const reporterField = DOM.$('[cms-field="reporters"]', reporterLink);
            if (reporterField) {
                reporterField.textContent = reporter.name;
            }
            reporterLink.style.display = '';
        });

        // Single batch insertion after template link
        if (elementsToInsert.length > 0) {
            const fragment = DOMBatch.createFragment(elementsToInsert);
            templateLink.after(fragment);
        }

        if (validReporters.length === 0) {
            templateLink.style.display = 'none';
        }
    }

    // Populate basic report fields
    function populateBasicFields(itemElement, reportData) {
        let successCount = 0;

        if (DOM.setText(DOM.$('[cms-field="title"]', itemElement), reportData.name)) successCount++;
        if (DOM.setImage(DOM.$(SELECTORS.mainImage, itemElement), reportData.photo?.url || '', reportData.name)) successCount++;

        const dateValue = reportData.date || reportData.createdOn;
        if (DOM.setText(DOM.$('[cms-field="date"]', itemElement), DateUtils.format(dateValue))) successCount++;

        DOM.setText(DOM.$('[cms-field="reporters"]', itemElement), formatReporterNames(reportData.reporters));

        // Handle topics
        const topicsWrap = DOM.$('[cms-wrap="topics"]', itemElement);
        const topicLinkTemplate = DOM.$('[cms-link="topic"]', itemElement);

        if (topicsWrap && topicLinkTemplate) {
            // Batch remove existing duplicated topics
            const existingTopicLinks = Array.from(DOM.$$('[cms-link="topic"]', topicsWrap));
            DOMBatch.removeAll(existingTopicLinks.slice(1));

            if (reportData.topic && Array.isArray(reportData.topic) && reportData.topic.length > 0) {
                // Build all topic links first
                const topicElements = [];

                reportData.topic.forEach((topic, index) => {
                    let topicLink;
                    if (index === 0) {
                        topicLink = topicLinkTemplate;
                    } else {
                        topicLink = topicLinkTemplate.cloneNode(true);
                        topicElements.push(topicLink);
                    }

                    topicLink.href = `/topic/${topic.slug}`;
                    topicLink.style.display = '';

                    const topicField = DOM.$('[cms-field="topic"]', topicLink);
                    DOM.setText(topicField || topicLink, topic.name);
                });

                // Single batch insertion
                if (topicElements.length > 0) {
                    const fragment = DOMBatch.createFragment(topicElements);
                    topicsWrap.appendChild(fragment);
                }
                successCount++;
            } else if (reportData.topic?.slug) {
                topicLinkTemplate.href = `/topic/${reportData.topic.slug}`;
                topicLinkTemplate.style.display = '';
                const topicField = DOM.$('[cms-field="topic"]', topicLinkTemplate);
                DOM.setText(topicField || topicLinkTemplate, reportData.topic.name);
                successCount++;
            } else {
                topicLinkTemplate.style.display = 'none';
            }
        }

        // Handle urgent wrapper - only show if urgent AND within last 13 days
        const urgentWrap = DOM.$('[cms-wrap="urgent"]', itemElement);
        if (urgentWrap) {
            let showUrgent = false;
            if (reportData.urgent === true) {
                const reportDate = new Date(reportData.date || reportData.createdOn);
                if (!isNaN(reportDate.getTime())) {
                    const daysDiff = DateUtils._getDaysDifference(reportDate, new Date());
                    showUrgent = daysDiff <= 13;
                }
            }
            urgentWrap.style.display = showUrgent ? '' : 'none';
        }

        populateReporterBylineLinks(itemElement, reportData.reporters);

        // Handle victims donation link
        const victimsLink = DOM.$('[cms-link="support-victims"]', itemElement);
        if (victimsLink) {
            DOM.toggle(victimsLink, !!reportData.victimsDonationLink);
            if (reportData.victimsDonationLink) {
                victimsLink.href = reportData.victimsDonationLink;
            }
        }

        populateHeaderThumbnail(itemElement, reportData);

        // In-site report link
        DOM.$$('[cms-link="report-link"]', itemElement).forEach(link => {
            link.href = `https://cotoip.org/report/${reportData.slug}`;
        });

        // External report link — only shown if reporterEventLink exists
        DOM.$$('[cms-link="external-report-link"]', itemElement).forEach(link => {
            DOM.setLink(link, reportData.reporterEventLink || null);
            if (reportData.reporterEventLink) {
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer');
            }
        });

        return successCount;
    }

    // Populate location fields
    function populateLocationFields(itemElement, reportData) {
        const slashes = {};
        DOM.$$('[slash-for]', itemElement).forEach(slash => {
            slashes[slash.getAttribute('slash-for')] = slash;
        });

        // Map of dataKey to hasMultiple flag from API
        const multipleFlags = {
            locality: reportData.hasMultipleLocalities,
            subRegion: reportData.hasMultipleSubRegions,
            region: reportData.hasMultipleRegions,
            territory: reportData.hasMultipleTerritories
        };

        LOCATION_FIELDS.forEach(config => {
            let data = reportData[config.dataKey];

            const fieldElement = DOM.$(config.fieldSelector, itemElement);
            const linkElement = DOM.$(config.linkSelector, itemElement);
            const slash = config.slashAttr ? slashes[config.slashAttr] : null;

            // Check if this field has multiple values - if so, hide the condensed view
            // (multi-location fields in info tab will show the full list)
            const hasMultiple = multipleFlags[config.dataKey];

            if (hasMultiple && config.dataKey !== 'territory') {
                // Hide the field and its adjacent slash for locality/region/subRegion
                DOM.toggle(linkElement, false);
                if (slash) slash.style.display = 'none';
                return;
            }

            // Special handling for territory - always show all territories separated by /
            if (config.dataKey === 'territory' && Array.isArray(data) && data.length > 0) {
                const validTerritories = data.filter(t => t?.name);
                if (validTerritories.length > 0 && linkElement) {
                    // Get the parent container of the link element
                    const parentContainer = linkElement.parentElement;

                    // Set up the first territory using the existing link element
                    const firstTerritory = validTerritories[0];
                    DOM.setText(fieldElement, firstTerritory.name);
                    if (firstTerritory.slug) {
                        DOM.setLink(linkElement, config.urlPrefix + firstTerritory.slug);
                    } else {
                        DOM.toggle(linkElement, false);
                    }

                    // Add remaining territories with separators (if multiple)
                    for (let i = 1; i < validTerritories.length; i++) {
                        const territory = validTerritories[i];

                        // Create separator
                        const separator = document.createElement('span');
                        separator.textContent = ' / ';
                        separator.className = 'location-separator';
                        parentContainer.appendChild(separator);

                        // Clone and set up the link for this territory
                        const newLink = linkElement.cloneNode(true);
                        const newFieldElement = DOM.$(config.fieldSelector, newLink) || newLink;
                        DOM.setText(newFieldElement, territory.name);
                        if (territory.slug) {
                            DOM.setLink(newLink, config.urlPrefix + territory.slug);
                        } else {
                            newLink.removeAttribute('href');
                        }
                        parentContainer.appendChild(newLink);
                    }
                } else {
                    DOM.toggle(linkElement, false);
                }
                return; // Skip normal processing for territory
            }

            // Handle arrays - use first item (for non-territory fields with single value)
            if (Array.isArray(data)) {
                data = data.length > 0 ? data[0] : null;
            }

            if (data?.slug) {
                DOM.setText(fieldElement, data.name);
                DOM.setLink(linkElement, config.urlPrefix + data.slug);
                if (slash) slash.style.display = '';
            } else if (data?.name) {
                DOM.setText(fieldElement, data.name);
                DOM.toggle(linkElement, false);
                if (slash) slash.style.display = '';
            } else {
                DOM.toggle(linkElement, false);
                if (slash) slash.style.display = 'none';
            }
        });
    }

    // Populate multi-location fields in the info tab (for reports with multiple locations)
    function populateMultiLocationFields(itemElement, reportData) {
        // Configuration for multi-location fields
        const MULTI_LOCATION_FIELDS = [
            {
                dataKey: 'locality',
                hasMultipleFlag: 'hasMultipleLocalities',
                fieldSelector: '[cms-field="multi-locality"]',
                linkSelector: '[cms-link="multi-locality"]',
                urlPrefix: '/locality/'
            },
            {
                dataKey: 'subRegion',
                hasMultipleFlag: 'hasMultipleSubRegions',
                fieldSelector: '[cms-field="multi-region"]',
                linkSelector: '[cms-link="multi-region"]',
                urlPrefix: '/region/'
            },
            {
                dataKey: 'territory',
                hasMultipleFlag: 'hasMultipleTerritories',
                fieldSelector: '[cms-field="multi-territory"]',
                linkSelector: '[cms-link="multi-territory"]',
                urlPrefix: '/territory/'
            },
            {
                dataKey: 'region',
                hasMultipleFlag: 'hasMultipleRegions',
                fieldSelector: '[cms-field="multi-governorate"]',
                linkSelector: '[cms-link="multi-governorate"]',
                urlPrefix: '/region/'
            }
        ];

        // First, hide all template links by default (only show when populated)
        MULTI_LOCATION_FIELDS.forEach(config => {
            const linkElement = DOM.$(config.linkSelector, itemElement);
            if (linkElement) DOM.toggle(linkElement, false);
        });

        MULTI_LOCATION_FIELDS.forEach(config => {
            const data = reportData[config.dataKey];
            const linkElement = DOM.$(config.linkSelector, itemElement);

            if (!linkElement) return;

            // Get valid items with names
            const validItems = Array.isArray(data) ? data.filter(item => item?.name) : [];

            if (validItems.length === 0) return;

            // Show and set up the first item using the existing link element
            DOM.toggle(linkElement, true);
            const firstItem = validItems[0];
            const fieldElement = DOM.$(config.fieldSelector, linkElement) || linkElement;
            DOM.setText(fieldElement, firstItem.name);
            if (firstItem.slug) {
                DOM.setLink(linkElement, config.urlPrefix + firstItem.slug);
            } else {
                linkElement.removeAttribute('href');
            }

            // Add remaining items, inserted right after the previous sibling of the same type
            let lastInserted = linkElement;
            for (let i = 1; i < validItems.length; i++) {
                const item = validItems[i];

                // Clone and set up the link for this item
                const newLink = linkElement.cloneNode(true);
                const newFieldElement = DOM.$(config.fieldSelector, newLink) || newLink;
                DOM.setText(newFieldElement, item.name);
                if (item.slug) {
                    DOM.setLink(newLink, config.urlPrefix + item.slug);
                } else {
                    newLink.removeAttribute('href');
                }
                lastInserted.after(newLink);
                lastInserted = newLink;
            }
        });
    }

    // Set reporter action links
    function setReporterActionLinks(parentElement, reporter) {
        DOM.setLinks('[cms-link="reporter-support"]', parentElement, reporter.donationLink);
        DOM.setLinks('[cms-link="reporter-join"]', parentElement, reporter.joinLink);
    }

    // Populate a single reporter item (for modal list)
    function populateReporterItem(reporterItem, reporter) {
        // Clean up duplicates
        DOM.$$('[cms-link="reporter"]', reporterItem).forEach((link, index) => {
            if (index > 0) link.remove();
        });
        DOM.$$('.reporter-separator', reporterItem).forEach(sep => sep.remove());

        const reporterLink = DOM.$('[cms-link="reporter"]', reporterItem);
        if (reporterLink) {
            DOM.setLink(reporterLink, reporter.slug ? `/reporter/${reporter.slug}` : null);

            const nameElement = DOM.$('[cms-field="reporter"]', reporterLink);
            if (nameElement) DOM.setText(nameElement, reporter.name);

            const imageElement = DOM.$('[cms-field="reporter-image"]', reporterLink);
            if (imageElement && reporter.photo) {
                imageElement.src = reporter.photo.url || reporter.photo;
                imageElement.alt = reporter.name;
            }
        }

        DOM.setText(DOM.$('[fs-list-field="Reporter"]', reporterItem), reporter.name);

        const imgEl = DOM.$('[reporter-image="true"]', reporterItem);
        if (imgEl && reporter.photo) {
            imgEl.src = reporter.photo.url || reporter.photo;
            imgEl.alt = reporter.name;
        }

        setReporterActionLinks(reporterItem, reporter);
    }

    // Populate reporter information section
    function populateReporterInfo(itemElement, reporters) {
        const reportersWrap = DOM.$('[reporters-wrap="true"]', itemElement);
        const reporterElement = DOM.$('[fs-list-field="Reporter"]', itemElement);
        const reporterNameElement = DOM.$('[reporter]', itemElement);
        const reporterLinkElement = DOM.$('[cms-link="reporter"]', itemElement);
        const multiReporterNameElement = DOM.$('.multi-reporter-name', itemElement);
        const multiReporterWrap = DOM.$('[multi-reporter-wrap="true"]', itemElement);
        const reporterListWrap = DOM.$('[reporter-list-wrap="true"]', itemElement);
        const singleReporterNameElement = DOM.$('[cms-field="reporter"]', itemElement);
        const singleReporterImageElement = DOM.$('[cms-field="reporter-image"]', itemElement);

        if (!reporters || reporters.length === 0 || !reporters[0].slug) {
            DOM.toggle(reporterLinkElement, false);
            DOM.toggle(multiReporterWrap, false);
            DOM.toggle(reporterListWrap, false);
            return;
        }

        const firstReporter = reporters[0];
        DOM.setText(reporterElement, firstReporter.name);
        DOM.setText(reporterNameElement, firstReporter.name);
        DOM.setLink(reporterLinkElement, `/reporter/${firstReporter.slug}`);

        if (reporters.length === 1) {
            DOM.setText(singleReporterNameElement, firstReporter.name);
            if (singleReporterImageElement && firstReporter.photo) {
                singleReporterImageElement.src = firstReporter.photo.url || firstReporter.photo;
                singleReporterImageElement.alt = firstReporter.name;
            }
            DOM.setLinks('a[cms-link="reporter"]', itemElement, `/reporter/${firstReporter.slug}`);
            setReporterActionLinks(itemElement, firstReporter);

            DOM.toggle(multiReporterWrap, false);
            DOM.setText(multiReporterNameElement, firstReporter.name);
        } else if (multiReporterWrap && reporterListWrap && reportersWrap) {
            multiReporterWrap.style.display = 'flex';
            reporterListWrap.style.display = 'none';

            // Format: "Name1, Name2 and Name3" for 3+, "Name1 and Name2" for 2
            const displayName = reporters.length === 2
                ? reporters.map(r => r.name).join(' and ')
                : reporters.slice(0, -1).map(r => r.name).join(', ') + ' and ' + reporters[reporters.length - 1].name;
            DOM.setText(multiReporterNameElement, displayName);

            const firstReporterImage = DOM.$('[first-reporter-image="true"]', multiReporterWrap);
            const secondReporterImage = DOM.$('[second-reporter-image="true"]', multiReporterWrap);

            if (firstReporterImage && reporters[0].photo) {
                firstReporterImage.src = reporters[0].photo.url || reporters[0].photo;
                firstReporterImage.alt = reporters[0].name;
            }
            if (secondReporterImage && reporters[1]?.photo) {
                secondReporterImage.src = reporters[1].photo.url || reporters[1].photo;
                secondReporterImage.alt = reporters[1].name;
            }

            const modalPreWrap = DOM.$('.modal-pre-wrap', reporterListWrap);
            if (modalPreWrap) {
                const templateReporterItem = DOM.$('.collection-item-2', modalPreWrap);
                if (templateReporterItem) {
                    const itemsContainer = templateReporterItem.parentElement;
                    DOM.$$('.collection-item-2', itemsContainer).forEach((item, idx) => {
                        if (idx > 0) item.remove();
                    });
                    templateReporterItem.style.display = 'none';

                    reporters.forEach(reporter => {
                        const reporterItem = templateReporterItem.cloneNode(true);
                        reporterItem.style.display = '';
                        populateReporterItem(reporterItem, reporter);
                        itemsContainer.appendChild(reporterItem);
                    });
                }
            }

            ModalUtils.setupTrigger(multiReporterWrap);
            ModalUtils.setupClose();
        }

        const supportButton = DOM.$('.support-button-2', itemElement);
        const joinButton = DOM.$('.join-button-2', itemElement);
        DOM.setLink(supportButton, firstReporter.donationLink);
        DOM.setLink(joinButton, firstReporter.joinLink);
    }

    // Populate perpetrator info (works for both mini and full reports)
    function populatePerpetratorInfo(itemElement, reportData) {
        const perpInfoWrap = DOM.$('[cms-info="wrap"]', itemElement);
        if (!perpInfoWrap) return;

        log('Populating perpetrator info:', {
            perpetrators: reportData.perpetrators,
            settlement: reportData.settlement,
            place: reportData.place,
            locationType: reportData.locationType,
            backer: reportData.backer
        });

        const perpLink = DOM.$('a[cms-link="Perp"]', perpInfoWrap);
        const perpField = DOM.$('div[cms-field="Perp"]', perpInfoWrap);

        let perpetrator = null;
        if (reportData.perpetrators?.length > 0) {
            perpetrator = reportData.perpetrators[0];
        } else if (reportData.perpetrator) {
            perpetrator = reportData.perpetrator;
        }

        const perpetratedByText = Array.from(DOM.$$('.perpetrator-report-text', perpInfoWrap))
            .find(el => el.textContent === 'Perpetrated by');

        if (perpetrator) {
            if (perpLink && perpetrator.slug) {
                perpLink.href = `/perp/${perpetrator.slug}`;
                perpLink.style.display = '';
            } else {
                DOM.toggle(perpLink, false);
            }
            DOM.setText(perpField, perpetrator.name || perpetrator);
            DOM.toggle(perpetratedByText, true);
        } else {
            DOM.toggle(perpLink, false);
            DOM.toggle(perpField, false);
            DOM.toggle(perpetratedByText, false);
        }

        // Settlement (API returns an array of { id, name, slug })
        const settlementLink = DOM.$('a[cms-link="Settlement"]', perpInfoWrap);
        const settlementField = DOM.$('div[cms-field="Settlement"]', perpInfoWrap);
        const settlement = Array.isArray(reportData.settlement) ? reportData.settlement[0] : reportData.settlement;
        if (settlement) {
            if (settlementLink && settlement.slug) {
                settlementLink.href = `/settlement/${settlement.slug}`;
                settlementLink.style.display = '';
            } else {
                DOM.toggle(settlementLink, false);
            }
            DOM.setText(settlementField, settlement.name || settlement);
        } else {
            DOM.toggle(settlementLink, false);
            DOM.setText(settlementField, '');
        }

        // Place/location type
        const placeLink = DOM.$('a[cms-link="place"]', perpInfoWrap);
        const placeField = DOM.$('div[cms-field="Place"]', perpInfoWrap);
        if (reportData.place || reportData.locationType) {
            const placeName = reportData.place?.name || reportData.locationType?.name ||
                             reportData.place || reportData.locationType;
            const placeSlug = reportData.place?.slug || reportData.locationType?.slug;

            if (placeLink && placeSlug) {
                placeLink.href = `/place/${placeSlug}`;
                placeLink.style.display = '';
            } else {
                DOM.toggle(placeLink, false);
            }
            DOM.setText(placeField, placeName);
        } else {
            DOM.toggle(placeLink, false);
            DOM.setText(placeField, '');
        }

        // Backer
        const backerLink = DOM.$('a[cms-link="backer"]', perpInfoWrap);
        const backerField = DOM.$('div[cms-field="backer"]', perpInfoWrap);
        if (reportData.backer) {
            if (backerLink && reportData.backer.slug) {
                backerLink.href = `/backer/${reportData.backer.slug}`;
                backerLink.style.display = '';
            } else {
                DOM.toggle(backerLink, false);
            }
            DOM.setText(backerField, reportData.backer.name || reportData.backer);
        } else {
            DOM.toggle(backerLink, false);
            DOM.setText(backerField, '');
        }

        // Show/hide text elements
        const fromText = Array.from(DOM.$$('.perpetrator-report-text', perpInfoWrap))
            .find(el => el.textContent === 'From');
        const hasSettlement = Array.isArray(reportData.settlement) ? reportData.settlement.length > 0 : !!reportData.settlement;
        DOM.toggle(fromText, hasSettlement);

        const atText = DOM.$('[fs-list-field="Place"]', perpInfoWrap);
        DOM.toggle(atText, !!(reportData.place || reportData.locationType));

        const backerSection = DOM.$('.div-block-318671:last-child', perpInfoWrap);
        DOM.toggle(backerSection, !!reportData.backer);
    }

    // Main function to populate a report item
    function populateReportItem(itemElement, reportData) {
        const successCount = populateBasicFields(itemElement, reportData);
        populateLocationFields(itemElement, reportData);
        populateMultiLocationFields(itemElement, reportData);
        populateReporterInfo(itemElement, reportData.reporters || []);

        // Populate perpetrator/settlement/place/backer info (works for both mini and full)
        populatePerpetratorInfo(itemElement, reportData);

        // Apply conditional visibility for cms-extra elements (works for both mini and full)
        ExtraVisibility.apply(itemElement, reportData);

        // Set report ID (needed for thumbnail lightbox cache lookup)
        itemElement.setAttribute('data-report-id', reportData.id);

        // Cache report data for thumbnail lightbox
        Store.cacheReportData(reportData.id, reportData);

        // Hide expand/tab elements (accordion removed — full content on report page)
        DOM.toggle(DOM.$('[data-tab="wrap"]', itemElement), false);
        DOM.toggle(DOM.$('[open-target]', itemElement), false);
        DOM.toggle(DOM.$('[dropdown-icon]', itemElement), false);

        itemElement.setAttribute('data-report-slug', reportData.slug || '');

        if (reportData.reporterEventLink) {
            itemElement.setAttribute('data-reporter-link', reportData.reporterEventLink);
        }

        // Toggle visibility for elements with outsidelink attribute
        DOM.$$('[outsidelink="true"]', itemElement).forEach(el => {
            DOM.toggle(el, !!reportData.reporterEventLink);
        });

        itemElement.classList.remove('is--loading');
        itemElement.classList.add('is--loaded');

        return successCount > 0;
    }

    // Populate reports in the DOM
    async function populateReports(items, listContainer, templateItem, appendMode = false) {
        if (!templateItem) {
            console.error('[CMS Client] Template item not found!');
            return 0;
        }

        // templateItem is a cloned template from TemplateManager - no need to hide it
        // as it's not in the DOM, we just use it as a source for cloning

        if (!items || items.length === 0) {
            if (!appendMode) {
                // Batch remove all existing items
                DOMBatch.removeAll(
                    DOM.$$(SELECTORS.itemNotTemplate, listContainer)
                );

                const existingMsg = DOM.$('.no-search-results, .search-error', listContainer);
                if (existingMsg) existingMsg.remove();

                const noResultsMsg = DOM.create('div', {
                    className: 'no-search-results',
                    style: { padding: '40px 20px', textAlign: 'center', color: '#666' },
                    innerHTML: 'No reports match your filters'
                });

                const sentinel = DOM.$(SELECTORS.scrollSentinel, listContainer);
                if (sentinel) {
                    listContainer.insertBefore(noResultsMsg, sentinel);
                } else {
                    listContainer.appendChild(noResultsMsg);
                }
            }
            return 0;
        }

        if (!appendMode) {
            // Batch remove all existing items
            DOMBatch.removeAll(
                DOM.$$(SELECTORS.itemNotTemplate, listContainer)
            );

            const existingMsg = DOM.$('.no-search-results, .search-error', listContainer);
            if (existingMsg) existingMsg.remove();
        }

        // Note: templateItem may be a cloned template from TemplateManager (not in DOM)
        // so we no longer require it to be in listContainer - we just use it as a clone source

        const sentinel = DOM.$(SELECTORS.scrollSentinel, listContainer);

        // Build all items offscreen first, then insert once
        const preparedItems = [];
        let successCount = 0;

        items.forEach((report, index) => {
            const newItem = templateItem.cloneNode(true);
            // Batch class removal
            newItem.classList.remove('cms-template', 'is--loading', 'cms-template-original');
            newItem.style.display = '';

            if (populateReportItem(newItem, report)) {
                preparedItems.push(newItem);
                successCount++;
            } else {
                console.warn(`[CMS Client] Failed to populate report ${index + 1}:`, report.name || 'Unknown');
            }
        });

        // Single DOM insertion using fragment
        const fragment = DOMBatch.createFragment(preparedItems);

        if (sentinel) {
            listContainer.insertBefore(fragment, sentinel);
        } else {
            listContainer.appendChild(fragment);
        }

        // Re-initialize Webflow interactions for newly added elements (dropdowns, etc.)
        if (window.Webflow && window.Webflow.require) {
            try {
                const ix2 = window.Webflow.require('ix2');
                if (ix2 && ix2.init) {
                    ix2.init();
                }
            } catch (e) {
                // IX2 not available, try legacy dropdown init
            }
            // Also try the simpler ready() which reinits all Webflow components
            if (typeof window.Webflow.ready === 'function') {
                window.Webflow.ready();
            }
        }

        console.log(`[CMS Client] Populated ${successCount} items in DOM`);

        return successCount;
    }

    // Loading indicator functions
    function showLoadingIndicator(listContainer) {
        hideLoadingIndicator();

        const loader = DOM.create('div', {
            id: 'infinite-scroll-loader',
            style: { textAlign: 'center', padding: '20px', color: '#666' },
            innerHTML: '<div style="font-size: 14px;">Loading more reports...</div>'
        });
        listContainer.appendChild(loader);
    }

    function hideLoadingIndicator() {
        const loader = document.getElementById('infinite-scroll-loader');
        if (loader) loader.remove();
    }

    function showNoMoreMessage(listContainer) {
        if (document.getElementById('no-more-reports')) return;

        const message = DOM.create('div', {
            id: 'no-more-reports',
            style: { textAlign: 'center', padding: '20px', color: '#999', fontSize: '14px' },
            innerHTML: 'No more reports to load'
        });
        listContainer.appendChild(message);
    }

    // ===== FILTER INDICATORS =====
    // Shows/hides visual indicators on filter tabs based on active filter state
    const FilterIndicators = {
        // Map of groupName -> array of filter keys
        _groupToFiltersMap: new Map(),
        // Cache of indicator elements by group
        _indicatorCache: new Map(),
        // Store subscription unsubscribe function
        _unsubscribe: null,

        init() {
            this._buildGroupMap();
            this._cacheIndicators();
            this._subscribe();
            this.updateAll();
            console.log('[CMS Client] FilterIndicators initialized', {
                groups: Array.from(this._groupToFiltersMap.keys()),
                mappings: Object.fromEntries(this._groupToFiltersMap)
            });
        },

        // Scan wrappers and build map of group -> filter keys
        _buildGroupMap() {
            this._groupToFiltersMap.clear();
            const wrappers = DOM.$$('[filter-indicator-wrap]');

            wrappers.forEach(wrapper => {
                const groupName = wrapper.getAttribute('filter-indicator-wrap');
                if (!groupName) return;

                const filterKeys = new Set();

                // Find cms-filter checkboxes/inputs
                DOM.$$(SELECTORS.filterAttr, wrapper).forEach(el => {
                    const filterAttr = el.getAttribute('cms-filter');
                    if (filterAttr) {
                        // Map attribute names to Store filter keys
                        const keyMap = {
                            'date': 'date',
                            'from': 'dateFrom',
                            'until': 'dateUntil',
                            'topic': 'topic',
                            'region': 'region',
                            'locality': 'locality',
                            'territory': 'territory',
                            'reporter': 'reporter',
                            'urgent': 'urgent'
                        };
                        const storeKey = keyMap[filterAttr.toLowerCase()] || filterAttr.toLowerCase();
                        filterKeys.add(storeKey);
                    }
                });

                // Find search input
                if (DOM.$(SELECTORS.searchInput, wrapper)) {
                    filterKeys.add('search');
                }

                if (filterKeys.size > 0) {
                    this._groupToFiltersMap.set(groupName, Array.from(filterKeys));
                }
            });
        },

        // Cache indicator elements
        _cacheIndicators() {
            this._indicatorCache.clear();
            const indicators = DOM.$$('[filter-indicator]');

            indicators.forEach(indicator => {
                const groupName = indicator.getAttribute('filter-indicator');
                if (!groupName) return;

                if (!this._indicatorCache.has(groupName)) {
                    this._indicatorCache.set(groupName, []);
                }
                this._indicatorCache.get(groupName).push(indicator);
            });
        },

        // Subscribe to Store filter changes
        _subscribe() {
            if (this._unsubscribe) {
                this._unsubscribe();
            }

            this._unsubscribe = Store.subscribe(() => {
                this.updateAll();
            });
        },

        // Check if a filter key has active values
        _isFilterActive(filterKey) {
            const filters = Store.get('filters');
            const value = filters[filterKey];

            if (value === null || value === undefined) return false;
            if (Array.isArray(value)) return value.length > 0;
            if (typeof value === 'string') return value.trim() !== '';
            if (typeof value === 'boolean') return true; // urgent: true or false both count as active
            return false;
        },

        // Check if any filter in a group is active
        _isGroupActive(groupName) {
            const filterKeys = this._groupToFiltersMap.get(groupName);
            if (!filterKeys) return false;

            return filterKeys.some(key => this._isFilterActive(key));
        },

        // Toggle indicators for a group
        _toggleGroup(groupName, shouldShow) {
            const indicators = this._indicatorCache.get(groupName);
            if (!indicators) return;

            indicators.forEach(indicator => {
                indicator.style.display = shouldShow ? 'flex' : 'none';
            });
        },

        // Update all indicator groups
        updateAll() {
            this._groupToFiltersMap.forEach((_, groupName) => {
                const isActive = this._isGroupActive(groupName);
                this._toggleGroup(groupName, isActive);
            });
        },

        // Public API: rescan for new elements
        rescan() {
            this._buildGroupMap();
            this._cacheIndicators();
            this.updateAll();
            console.log('[CMS Client] FilterIndicators rescanned');
        },

        // Get current state for debugging
        getState() {
            const state = {};
            this._groupToFiltersMap.forEach((filterKeys, groupName) => {
                state[groupName] = {
                    filterKeys,
                    isActive: this._isGroupActive(groupName),
                    indicatorCount: this._indicatorCache.get(groupName)?.length || 0
                };
            });
            return state;
        }
    };

    // ===== TAG MANAGER =====
    // Manages the filter tags UI with grouped structure:
    // - Clear All button: clears all filters
    // - Field tags (tag-value-wrap): shows field name, clicking clears all values for that field
    // - Value tags (tag): shows individual values, clicking removes just that value
    const TagManager = {
        tagWrap: null,
        tagTemplate: null,
        tagFieldTemplate: null,
        clearAllButton: null,

        init() {
            this.tagWrap = DOM.$(SELECTORS.tagWrap);
            if (!this.tagWrap) {
                console.warn('[CMS Client] Tag wrap element not found');
                return;
            }

            // Get the individual value tag template
            this.tagTemplate = DOM.$(SELECTORS.tag, this.tagWrap);
            if (this.tagTemplate) {
                this.tagTemplate.style.display = 'none';
                this.tagTemplate.classList.add('tag-template');
            }

            // Get the field header tag template
            this.tagFieldTemplate = DOM.$(SELECTORS.tagFieldWrap, this.tagWrap);
            if (this.tagFieldTemplate) {
                this.tagFieldTemplate.style.display = 'none';
                this.tagFieldTemplate.classList.add('tag-field-template');
            }

            // Get the clear all button
            this.clearAllButton = DOM.$(SELECTORS.tagClearAll, this.tagWrap);
            if (this.clearAllButton) {
                this.clearAllButton.style.display = 'none';
            }

            // Event delegation for all tag interactions
            this.tagWrap.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Check for clear-all click
                const clearAllEl = e.target.closest(SELECTORS.tagClearAll);
                if (clearAllEl) {
                    this.clearAllFilters();
                    return;
                }

                // Check for field tag click (removes all values for that field)
                const fieldTag = e.target.closest(SELECTORS.tagFieldWrap);
                if (fieldTag && !fieldTag.classList.contains('tag-field-template')) {
                    const filterKey = fieldTag.getAttribute('data-filter-key');
                    if (filterKey) {
                        this.removeAllValuesForKey(filterKey);
                    }
                    return;
                }

                // Check for individual value tag click
                const valueTag = e.target.closest(SELECTORS.tag);
                if (valueTag && !valueTag.classList.contains('tag-template')) {
                    const filterKey = valueTag.getAttribute('data-filter-key');
                    const filterValue = valueTag.getAttribute('data-filter-value');
                    if (filterKey) {
                        this.removeSingleValue(filterKey, filterValue);
                    }
                    return;
                }
            });

            if (!this.tagTemplate) {
                console.warn('[CMS Client] Tag template not found');
            }
            if (!this.tagFieldTemplate) {
                console.warn('[CMS Client] Tag field template not found');
            }
        },

        clearAllTags() {
            if (!this.tagWrap) return;
            // Remove all non-template tags (both field and value tags)
            DOM.$$(SELECTORS.tagNotTemplate, this.tagWrap)
                .forEach(tag => tag.remove());
            DOM.$$(SELECTORS.tagFieldNotTemplate, this.tagWrap)
                .forEach(tag => tag.remove());
        },

        // Add a grouped tag: field header + individual value tags
        addTagGroup(fieldName, filterKey, values, mapFilterValue = null) {
            if (!this.tagWrap || !this.tagTemplate || !this.tagFieldTemplate) return;

            // Create field header tag
            const fieldTag = this.tagFieldTemplate.cloneNode(true);
            fieldTag.style.display = '';
            fieldTag.classList.remove('tag-field-template');
            fieldTag.setAttribute('data-filter-key', filterKey);

            const fieldValueEl = DOM.$(SELECTORS.tagValue, fieldTag);
            if (fieldValueEl) fieldValueEl.textContent = fieldName;

            this.tagWrap.appendChild(fieldTag);

            // Create individual value tags
            values.forEach(value => {
                const valueTag = this.tagTemplate.cloneNode(true);
                valueTag.style.display = '';
                valueTag.classList.remove('tag-template');
                valueTag.setAttribute('data-filter-key', filterKey);
                valueTag.setAttribute('data-filter-value', value);

                const valueEl = DOM.$(SELECTORS.tagValue, valueTag);
                if (valueEl) valueEl.textContent = value;

                // Show map icon if this specific value is from map selection
                if (mapFilterValue === value) {
                    const mapTagIcon = DOM.$('[cms-filter-element="map-tag"]', valueTag);
                    if (mapTagIcon) mapTagIcon.style.display = 'block';
                }

                this.tagWrap.appendChild(valueTag);
            });
        },

        // Add a single tag (for non-array filters like date, urgent)
        addSingleTag(fieldName, value, filterKey) {
            if (!this.tagWrap || !this.tagTemplate) return;

            // For single-value filters, just create one value tag
            const valueTag = this.tagTemplate.cloneNode(true);
            valueTag.style.display = '';
            valueTag.classList.remove('tag-template');
            valueTag.setAttribute('data-filter-key', filterKey);
            valueTag.setAttribute('data-filter-value', value);

            const valueEl = DOM.$(SELECTORS.tagValue, valueTag);
            if (valueEl) valueEl.textContent = `${fieldName}: ${value}`;

            this.tagWrap.appendChild(valueTag);
        },

        async clearAllFilters() {
            Store.setState({ isClearing: true }, true);

            // Clear all array filters
            ['topic', 'region', 'locality', 'settlement', 'territory', 'reporter', 'perpetrator'].forEach(filterKey => {
                Store.setFilter(filterKey, []);
                CheckboxUtils.findAll(filterKey).forEach(checkbox => {
                    if (checkbox.checked || CheckboxUtils.isChecked(checkbox)) {
                        CheckboxUtils.uncheck(checkbox);
                    }
                });
            });

            // Clear date filters
            Store.setFilter('date', '');
            Store.setFilter('dateFrom', '');
            Store.setFilter('dateUntil', '');
            [SELECTORS.date, SELECTORS.dateFrom, SELECTORS.dateUntil].forEach(sel => {
                const dateInput = DOM.$(sel);
                if (dateInput) {
                    dateInput.value = '';
                    if (dateInput._flatpickr) dateInput._flatpickr.clear();
                }
            });

            // Clear urgent filter
            Store.setFilter('urgent', null);

            await nextFrame();
            Store.setState({ isClearing: false }, true);
            applyFilters();
        },

        async removeAllValuesForKey(filterKey) {
            Store.setState({ isClearing: true }, true);

            const filters = Store.get('filters');

            if (Array.isArray(filters[filterKey])) {
                Store.setFilter(filterKey, []);
                CheckboxUtils.findAll(filterKey).forEach(checkbox => {
                    if (checkbox.checked || CheckboxUtils.isChecked(checkbox)) {
                        CheckboxUtils.uncheck(checkbox);
                    }
                });
            } else if (filterKey === 'date') {
                Store.setFilter('date', '');
                const dateInput = DOM.$(SELECTORS.date);
                if (dateInput) {
                    dateInput.value = '';
                    if (dateInput._flatpickr) dateInput._flatpickr.clear();
                }
            } else if (filterKey === 'dateFrom') {
                Store.setFilter('dateFrom', '');
                const dateInput = DOM.$(SELECTORS.dateFrom);
                if (dateInput) {
                    dateInput.value = '';
                    if (dateInput._flatpickr) dateInput._flatpickr.clear();
                }
            } else if (filterKey === 'dateUntil') {
                Store.setFilter('dateUntil', '');
                const dateInput = DOM.$(SELECTORS.dateUntil);
                if (dateInput) {
                    dateInput.value = '';
                    if (dateInput._flatpickr) dateInput._flatpickr.clear();
                }
            } else if (filterKey === 'urgent') {
                Store.setFilter('urgent', null);
            }

            await nextFrame();
            Store.setState({ isClearing: false }, true);
            applyFilters();
        },

        async removeSingleValue(filterKey, value) {
            const filters = Store.get('filters');

            if (Array.isArray(filters[filterKey])) {
                Store.setState({ isClearing: true }, true);

                Store.removeFromFilter(filterKey, value);

                const checkbox = CheckboxUtils.find(filterKey, value);
                if (checkbox) {
                    CheckboxUtils.uncheck(checkbox);
                }

                await nextFrame();
                Store.setState({ isClearing: false }, true);
            } else {
                // For non-array filters, removing the value clears the whole filter
                await this.removeAllValuesForKey(filterKey);
                return;
            }

            applyFilters();
        },

        updateTags() {
            this.clearAllTags();

            const filters = Store.get('filters');
            let hasNonSearchFilters = false;

            // Get current map selection to identify map-originated filters
            const mapSelection = window.MapboxCore?.getCurrentSelection?.() || null;

            // Date filters (single value, no field header needed)
            if (filters.date) {
                this.addSingleTag('Date', DateUtils.formatForTag(filters.date), 'date');
                hasNonSearchFilters = true;
            } else {
                if (filters.dateFrom) {
                    this.addSingleTag('From', DateUtils.formatForTag(filters.dateFrom), 'dateFrom');
                    hasNonSearchFilters = true;
                }
                if (filters.dateUntil) {
                    this.addSingleTag('Until', DateUtils.formatForTag(filters.dateUntil), 'dateUntil');
                    hasNonSearchFilters = true;
                }
            }

            // Array filters (grouped: field header + individual values)
            ['topic', 'region', 'locality', 'settlement', 'territory', 'reporter', 'perpetrator'].forEach(filterKey => {
                if (filters[filterKey]?.length > 0) {
                    const fieldName = filterKey.charAt(0).toUpperCase() + filterKey.slice(1);
                    const values = filters[filterKey];

                    // Check which value (if any) is from map selection
                    const mapFilterValue = (mapSelection &&
                        mapSelection.filterKey === filterKey &&
                        values.includes(mapSelection.filterValue))
                        ? mapSelection.filterValue
                        : null;

                    this.addTagGroup(fieldName, filterKey, values, mapFilterValue);
                    hasNonSearchFilters = true;
                }
            });

            // Urgent filter (single value)
            if (filters.urgent !== null) {
                this.addSingleTag('Urgent', filters.urgent ? 'Yes' : 'No', 'urgent');
                hasNonSearchFilters = true;
            }

            // Toggle tags-section and clear-all visibility
            const tagsSection = DOM.$(SELECTORS.tagsSection);
            if (tagsSection) {
                tagsSection.style.display = hasNonSearchFilters ? 'flex' : 'none';
            }
            if (this.clearAllButton) {
                this.clearAllButton.style.display = hasNonSearchFilters ? '' : 'none';
            }
        }
    };

    // ===== FILTER SYSTEM =====

    // Build URL with current filters
    function buildFilterUrl(offset = 0, limit = CONFIG.REPORTS_LIMIT) {
        const filters = Store.get('filters');
        const pageFilter = PageFilter.get();

        // Debug logging for page filter
        console.log('[CMS Client] buildFilterUrl - pageFilter:', pageFilter, 'filters:', JSON.stringify(filters));

        let url = `${CONFIG.WORKER_URL}/reports?limit=${limit}&offset=${offset}`;

        if (filters.search) {
            url += `&search=${encodeURIComponent(filters.search)}`;
        }

        // Single date filter - send as both dateFrom and dateUntil
        if (filters.date) {
            url += `&dateFrom=${filters.date}&dateUntil=${filters.date}`;
        } else {
            // Range date filters (only used if single date is not set)
            if (filters.dateFrom) {
                url += `&dateFrom=${filters.dateFrom}`;
            }
            if (filters.dateUntil) {
                url += `&dateUntil=${filters.dateUntil}`;
            }
        }

        // Build array filters with separate page filter parameters
        // Page filters use "page{Type}" (e.g., pageTopic) and are required (AND logic)
        // User filters use "{type}" (e.g., topic) and use OR logic among themselves
        ['topic', 'region', 'locality', 'settlement', 'territory', 'reporter', 'perpetrator'].forEach(filterKey => {
            const userValues = filters[filterKey] || [];

            // Send page filter as separate parameter (required, AND logic)
            if (pageFilter && pageFilter.type === filterKey) {
                const pageParamName = 'page' + filterKey.charAt(0).toUpperCase() + filterKey.slice(1);
                url += `&${pageParamName}=${encodeURIComponent(pageFilter.slug)}`;
            }

            // Send user filters separately (OR logic among themselves)
            if (userValues.length > 0) {
                url += `&${filterKey}=${encodeURIComponent(userValues.join(','))}`;
            }
        });

        if (filters.urgent !== null) {
            url += `&urgent=${filters.urgent}`;
        }

        url += `&_t=${Date.now()}`;

        console.log('[CMS Client] buildFilterUrl - final URL:', url);
        return url;
    }

    // Apply current filters and reload reports
    // skipUrlUpdate: true when responding to popstate (browser back/forward)
    async function applyFilters(skipUrlUpdate = false) {
        console.warn('[SCROLL-DEBUG] applyFilters() called, skipUrlUpdate:', skipUrlUpdate, new Error().stack?.split('\n').slice(1,4).join(' <- '));
        // Cancel any pending infinite scroll load
        cancelPendingLoad();

        Store.resetPagination();
        TagManager.updateTags();
        setCmsLoadingIndicator(true);

        // Update URL with current filters (unless responding to URL change)
        if (!skipUrlUpdate) {
            UrlManager.updateUrl();
        }

        const noMoreMsg = document.getElementById('no-more-reports');
        if (noMoreMsg) noMoreMsg.remove();

        const listContainer = DOM.$(SELECTORS.list);
        const templateItem = TemplateManager.getActiveTemplate();

        if (!listContainer || !templateItem) {
            console.error('[CMS Client] List container or template not found');
            setCmsLoadingIndicator(false);
            return;
        }

        try {
            const url = buildFilterUrl(0, CONFIG.REPORTS_LIMIT);
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const response_data = await response.json();
            const items = response_data.data || [];

            // Cache reports for view switching
            Store.setState({ cachedReports: items }, true);

            console.warn(`[SCROLL-DEBUG] applyFilters DONE | items=${items.length} | setting offset=${CONFIG.REPORTS_LIMIT} | total=${response_data.metadata?.total || items.length}`);
            Store.setState({
                currentOffset: CONFIG.REPORTS_LIMIT,
                totalReports: response_data.metadata?.total || items.length,
                hasMoreReports: CONFIG.REPORTS_LIMIT < (response_data.metadata?.total || items.length)
            }, true);

            await populateReports(items, listContainer, templateItem, false);

            // Scroll to top instantly after filter change
            const useWindowScroll = !!DOM.$(SELECTORS.scrollWindow);
            if (useWindowScroll) {
                window.scrollTo({ top: 0, behavior: 'instant' });
            } else {
                const scrollWrap = DOM.$(SELECTORS.scrollWrap);
                if (scrollWrap) {
                    scrollWrap.scrollTo({ top: 0, behavior: 'instant' });
                }
            }

            updateResultsCount(Store.get('totalReports'));

            console.log(`[CMS Client] Filters applied: ${items.length} results (Total: ${Store.get('totalReports')})`);

            // Notify map of filter changes for boundary highlighting
            document.dispatchEvent(new CustomEvent('cmsFilterChanged', {
                detail: {
                    territory: Store.get('filters').territory || [],
                    region: Store.get('filters').region || [],
                    locality: Store.get('filters').locality || [],
                    settlement: Store.get('filters').settlement || []
                }
            }));

        } catch (error) {
            console.error('[CMS Client] Filter error:', error);

            const errorMsg = DOM.create('div', {
                className: 'search-error',
                style: {
                    padding: '20px',
                    background: '#fee',
                    border: '1px solid #fcc',
                    borderRadius: '4px',
                    color: '#c00',
                    margin: '20px'
                },
                innerHTML: `
                    <strong>Filter error:</strong> ${error.message}<br>
                    <small>Please try again</small>
                `
            });
            listContainer.appendChild(errorMsg);
        } finally {
            setCmsLoadingIndicator(false);
        }
    }

    // Update results count display
    function updateResultsCount(count) {
        DOM.$$(SELECTORS.resultsCount).forEach(el => {
            el.textContent = count.toString();
        });
    }

    // Initialize date pickers
    function initializeDatePickers() {
        const initPicker = (selector, filterKey) => {
            const input = DOM.$(selector);
            if (!input) return;

            const onChange = (_, dateStr) => {
                Store.setFilter(filterKey, dateStr);
                applyFilters();
            };

            if (typeof flatpickr !== 'undefined') {
                if (!input._flatpickr) {
                    flatpickr(input, { dateFormat: 'Y-m-d', onChange });
                } else {
                    input._flatpickr.config.onChange.push(onChange);
                }
            } else {
                input.addEventListener('change', (e) => {
                    Store.setFilter(filterKey, e.target.value);
                    applyFilters();
                });
            }
        };

        initPicker(SELECTORS.date, 'date');
        initPicker(SELECTORS.dateFrom, 'dateFrom');
        initPicker(SELECTORS.dateUntil, 'dateUntil');
    }

    // Initialize checkbox filters
    function initializeCheckboxFilters() {
        const filterForm = DOM.$(SELECTORS.filterForm);
        if (!filterForm) return;

        const checkboxes = DOM.$$('input[type="checkbox"][cms-filter]', filterForm);

        checkboxes.forEach(checkbox => {
            if (checkbox.hasAttribute('data-filter-initialized')) return;
            checkbox.setAttribute('data-filter-initialized', 'true');

            const { key: filterKey, value: filterValue } = CheckboxUtils.getFilterInfo(checkbox);

            // Initialize filter array if needed
            const filters = Store.get('filters');
            if (!filters[filterKey]) {
                Store.setFilter(filterKey, []);
            }

            // Check initial state
            if (CheckboxUtils.isChecked(checkbox)) {
                Store.addToFilter(filterKey, filterValue);
            }

            checkbox.addEventListener('change', function() {
                if (!Store.get('isClearing')) {
                    handleCheckboxChange(this);
                }
            });
        });
    }

    // Handle checkbox state changes
    async function handleCheckboxChange(checkbox) {
        if (Store.get('isClearing')) return;

        if (checkbox.hasAttribute('data-processing')) return;
        checkbox.setAttribute('data-processing', 'true');

        // Wait for DOM to settle after checkbox visual update
        await nextFrame();

        checkbox.removeAttribute('data-processing');

        const { key: filterKey, value: filterValue } = CheckboxUtils.getFilterInfo(checkbox);

        const filters = Store.get('filters');
        if (!filters[filterKey]) {
            Store.setFilter(filterKey, []);
        }

        const isChecked = checkbox.checked;
        const currentlyInFilter = filters[filterKey].includes(filterValue);

        if (isChecked && !currentlyInFilter) {
            Store.addToFilter(filterKey, filterValue);
            applyFilters();
        } else if (!isChecked && currentlyInFilter) {
            Store.removeFromFilter(filterKey, filterValue);
            applyFilters();
        }
    }

    // Initialize clear buttons
    function initializeClearButtons() {
        DOM.$$(SELECTORS.clearAll).forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                clearAllFilters();
            });
        });

        DOM.$$(SELECTORS.clearElement).forEach(btn => {
            const clearTargets = btn.getAttribute('cms-clear-element');
            if (clearTargets === 'all') return;

            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                clearTargets.split(',').map(t => t.trim()).forEach(clearSpecificFilter);
                await nextFrame();
                applyFilters();
            });
        });
    }

    // Clear all filters
    async function clearAllFilters() {
        Store.setState({ isClearing: true }, true);

        // Clear search
        Store.setFilter('search', '');
        const searchInput = DOM.$(SELECTORS.searchInput);
        if (searchInput) searchInput.value = '';

        // Clear dates (single date and range)
        Store.setFilter('date', '');
        Store.setFilter('dateFrom', '');
        Store.setFilter('dateUntil', '');

        const dateInput = DOM.$(SELECTORS.date);
        const fromInput = DOM.$(SELECTORS.dateFrom);
        const untilInput = DOM.$(SELECTORS.dateUntil);
        if (dateInput) {
            dateInput.value = '';
            if (dateInput._flatpickr) dateInput._flatpickr.clear();
        }
        if (fromInput) {
            fromInput.value = '';
            if (fromInput._flatpickr) fromInput._flatpickr.clear();
        }
        if (untilInput) {
            untilInput.value = '';
            if (untilInput._flatpickr) untilInput._flatpickr.clear();
        }

        // Clear arrays
        ['topic', 'region', 'locality', 'settlement', 'territory', 'reporter', 'perpetrator'].forEach(key => {
            Store.setFilter(key, []);
        });

        // Uncheck all checkboxes
        DOM.$$('input[type="checkbox"][cms-filter]').forEach(cb => {
            if (cb.checked || CheckboxUtils.isChecked(cb)) {
                CheckboxUtils.uncheck(cb);
            }
        });

        Store.setFilter('urgent', null);

        await nextFrame();
        Store.setState({ isClearing: false }, true);
        applyFilters();
    }

    // Clear specific filter
    function clearSpecificFilter(filterName) {
        if (filterName === 'Date' || filterName === 'date') {
            Store.setFilter('date', '');
            const input = DOM.$(SELECTORS.date);
            if (input) {
                input.value = '';
                if (input._flatpickr) input._flatpickr.clear();
            }
        } else if (filterName === 'From') {
            Store.setFilter('dateFrom', '');
            const input = DOM.$(SELECTORS.dateFrom);
            if (input) {
                input.value = '';
                if (input._flatpickr) input._flatpickr.clear();
            }
        } else if (filterName === 'Until') {
            Store.setFilter('dateUntil', '');
            const input = DOM.$(SELECTORS.dateUntil);
            if (input) {
                input.value = '';
                if (input._flatpickr) input._flatpickr.clear();
            }
        } else if (filterName === 'search') {
            Store.setFilter('search', '');
            const input = DOM.$(SELECTORS.searchInput);
            if (input) input.value = '';
        } else {
            const filters = Store.get('filters');
            if (Array.isArray(filters[filterName])) {
                Store.setFilter(filterName, []);
                // Just uncheck visually - don't dispatch change event
                // The Store is already cleared, dispatching change would cause
                // handleCheckboxChange to see unchecked state and potentially
                // cause race conditions
                CheckboxUtils.findAll(filterName).forEach(cb => {
                    if (CheckboxUtils.isChecked(cb)) {
                        CheckboxUtils.uncheck(cb);
                    }
                });
            } else {
                Store.setFilter(filterName, null);
            }
        }
    }

    // ===== INFINITE SCROLL =====

    // Request tracking for race condition prevention
    let currentLoadRequestId = 0;
    let pendingLoadRequest = null;
    let infiniteScrollObserver = null;

    async function loadMoreReports() {
        // Check if already loading - return existing promise if so
        if (pendingLoadRequest) {
            console.warn('[SCROLL-DEBUG] loadMoreReports BLOCKED - pendingLoadRequest exists');
            return pendingLoadRequest;
        }

        const state = Store.getState();
        if (state.isLoading || !state.hasMoreReports) {
            console.warn('[SCROLL-DEBUG] loadMoreReports BLOCKED - isLoading:', state.isLoading, 'hasMoreReports:', state.hasMoreReports);
            return;
        }

        // Increment request ID to track this specific request
        const requestId = ++currentLoadRequestId;

        console.warn(`[SCROLL-DEBUG] loadMoreReports START #${requestId} | offset=${state.currentOffset} | storeOffset=${Store.get('currentOffset')}`);

        Store.setState({ isLoading: true }, true);
        setCmsLoadingIndicator(true);
        log('Loading more reports... (request #' + requestId + ')');

        const listContainer = DOM.$(SELECTORS.list);
        const templateItem = TemplateManager.getActiveTemplate();

        if (!listContainer || !templateItem) {
            console.error('[CMS Client] List container or template not found');
            Store.setState({ isLoading: false }, true);
            setCmsLoadingIndicator(false);
            return;
        }

        showLoadingIndicator(listContainer);

        // Create and store the promise
        pendingLoadRequest = (async () => {
            try {
                const currentOffset = state.currentOffset;
                const url = buildFilterUrl(currentOffset, CONFIG.REPORTS_PER_PAGE);
                console.warn(`[SCROLL-DEBUG] loadMoreReports FETCH #${requestId} | offset=${currentOffset} | url=${url.replace(CONFIG.WORKER_URL, '')}`);
                const response = await fetch(url);

                // Check if this request is still current (not superseded)
                if (requestId !== currentLoadRequestId) {
                    log('Request #' + requestId + ' superseded, discarding results');
                    return;
                }

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const responseData = await response.json();
                const items = responseData.data || [];

                // Double-check request is still current after parsing
                if (requestId !== currentLoadRequestId) {
                    log('Request #' + requestId + ' superseded after parse, discarding results');
                    return;
                }

                // Append to cached reports for view switching
                const currentCached = Store.get('cachedReports') || [];
                Store.setState({ cachedReports: [...currentCached, ...items] }, true);

                const successCount = await populateReports(items, listContainer, templateItem, true);

                const totalReports = responseData.metadata?.total || state.totalReports;
                const newOffset = currentOffset + items.length;
                console.warn(`[SCROLL-DEBUG] loadMoreReports DONE #${requestId} | fetched=${items.length} | oldOffset=${currentOffset} -> newOffset=${newOffset} | total=${totalReports} | hasMore=${newOffset < totalReports}`);
                Store.setState({
                    currentOffset: newOffset,
                    totalReports,
                    hasMoreReports: newOffset < totalReports
                }, true);

                log(`Loaded ${successCount} more reports. Total offset: ${newOffset}, Total: ${totalReports}`);

                if (!Store.get('hasMoreReports')) {
                    showNoMoreMessage(listContainer);
                }

            } catch (error) {
                console.error('[CMS Client] Error loading more reports:', error);
            } finally {
                hideLoadingIndicator();
                setCmsLoadingIndicator(false);
                console.warn(`[SCROLL-DEBUG] loadMoreReports FINALLY #${requestId} | setting isLoading=false, pendingLoadRequest=null | currentOffset now=${Store.get('currentOffset')}`);
                Store.setState({ isLoading: false }, true);
                pendingLoadRequest = null;
            }
        })();

        return pendingLoadRequest;
    }

    // Cancel any pending load request (useful when filters change)
    function cancelPendingLoad() {
        if (pendingLoadRequest) {
            currentLoadRequestId++; // Invalidate the current request
            console.warn(`[SCROLL-DEBUG] cancelPendingLoad | newRequestId=${currentLoadRequestId}`, new Error().stack?.split('\n').slice(1,3).join(' <- '));
            pendingLoadRequest = null;
            Store.setState({ isLoading: false }, true);
            hideLoadingIndicator();
            setCmsLoadingIndicator(false);
            log('Pending load request cancelled');
        }
    }

    // ===== MAIN LOAD FUNCTION =====

    async function loadReports(initializeUI = true) {
        setCmsLoadingIndicator(true);
        try {
            const listContainer = await DOM.waitFor(SELECTORS.list, 5000);

            if (!listContainer) {
                console.error('[CMS Client] List container not found');
                setCmsLoadingIndicator(false);
                return;
            }

            // Initialize template manager
            const templateItem = TemplateManager.init(listContainer);

            if (!templateItem) {
                console.error('[CMS Client] Template item not found');
                return;
            }

            // Restore saved view mode from localStorage, or use screen-size-based default
            let viewModeToApply = null;
            try {
                const savedViewMode = localStorage.getItem(CONFIG.VIEW_MODE_STORAGE_KEY);
                if (savedViewMode && (savedViewMode === 'mini' || savedViewMode === 'full')) {
                    // Only apply if the template for that mode exists
                    if (TemplateManager.templates[savedViewMode]) {
                        viewModeToApply = savedViewMode;
                        console.log('[CMS Client] Restored view mode from localStorage:', savedViewMode);
                    }
                }
            } catch (e) {
                // localStorage may be unavailable
                log('Could not read view mode from localStorage:', e);
            }

            // If no saved preference, use screen-size-based default (full on mobile, mini on desktop)
            if (!viewModeToApply) {
                viewModeToApply = getDefaultViewMode();
                console.log('[CMS Client] Using screen-based default view mode:', viewModeToApply);
            }

            // Apply the view mode
            Store.setState({ viewMode: viewModeToApply }, true);
            if (viewModeToApply === 'mini') {
                listContainer.classList.add('is-mini-reports');
            } else {
                listContainer.classList.remove('is-mini-reports');
            }

            // Initialize top offset for fixed header compensation
            TopOffset.init();

            // Initialize skeleton manager for loading state
            SkeletonManager.init();

            // Initialize page filter from URL path (e.g., /topic/gaza-genocide)
            // This must be done early, before any API calls
            const pageFilter = PageFilter.init();

            // Check if URL has filter parameters - if so, apply them
            const hasUrlFilters = UrlManager.hasFiltersInUrl();

            if (hasUrlFilters) {
                console.log('[CMS Client] URL filters detected, applying...');

                // Apply URL filters to Store
                UrlManager.applyUrlFiltersToStore();

                // Initialize TagManager and FilterIndicators BEFORE applyFilters
                // so that tags are displayed correctly on initial load
                TagManager.init();
                FilterIndicators.init();

                // Apply filters (will fetch filtered data and update URL with replaceState)
                // Note: buildFilterUrl will automatically include the page filter
                await applyFilters(true); // Skip URL update since we're loading from URL

                // Use replaceState to preserve the URL without adding to history
                UrlManager.updateUrl(true);

                // Hide skeleton, show real list
                SkeletonManager.hide();
                setCmsLoadingIndicator(false);

                // Dispatch cmsDataLoaded event so sidebars can open
                window.dispatchEvent(new CustomEvent('cmsDataLoaded', {
                    detail: { count: Store.get('totalReports'), total: Store.get('totalReports'), fromUrlFilters: true }
                }));

                // Defer remaining UI initializations to after first paint
                const deferredInit = () => {
                    if (initializeUI) {
                        initializeInteractions();
                        initializeInfiniteScroll(listContainer);
                        // Initialize remaining filter components (date pickers, checkboxes, clear buttons)
                        // TagManager and FilterIndicators already initialized above
                        initializeDatePickers();
                        initializeCheckboxFilters();
                        initializeClearButtons();
                        UrlManager.initPopstateListener();
                    }
                    // Sync UI elements with filters from URL (after filters are initialized)
                    UrlManager.syncUIWithFilters();
                };

                if (typeof requestIdleCallback === 'function') {
                    requestIdleCallback(deferredInit, { timeout: 200 });
                } else {
                    setTimeout(deferredInit, 0);
                }

                return;
            }

            // No URL query filters - check if we have a page filter
            // If so, use buildFilterUrl to include it; otherwise do a plain fetch
            // Use smaller initial limit for faster first paint
            const initialLimit = CONFIG.INITIAL_REPORTS_LIMIT;
            let initialUrl;
            if (pageFilter) {
                console.log('[CMS Client] Page filter active, using filtered initial load');
                initialUrl = buildFilterUrl(0, initialLimit);
            } else {
                initialUrl = `${CONFIG.WORKER_URL}/reports?limit=${initialLimit}&_t=${Date.now()}`;
            }

            const response = await fetch(initialUrl);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const response_data = await response.json();
            const items = response_data.data || [];

            // Cache reports for view switching
            Store.setState({ cachedReports: items }, true);

            // Use template from TemplateManager based on current viewMode
            const activeTemplate = TemplateManager.getActiveTemplate();
            const successCount = await populateReports(items, listContainer, activeTemplate);

            const totalReports = response_data.metadata?.total || items.length;
            console.warn(`[SCROLL-DEBUG] Initial load done | items=${items.length} | setting offset=${initialLimit} | total=${totalReports}`);
            Store.setState({
                currentOffset: initialLimit,
                totalReports,
                hasMoreReports: initialLimit < totalReports
            }, true);

            // Reset filters
            Store.resetFilters();

            updateResultsCount(totalReports);

            console.log(`[CMS Client] Loaded ${successCount} reports (initial batch). Total: ${totalReports}`);

            // Hide skeleton, show real list for fast first paint
            SkeletonManager.hide();
            setCmsLoadingIndicator(false);

            // Dispatch event so other components know data is ready
            window.dispatchEvent(new CustomEvent('cmsDataLoaded', {
                detail: { count: successCount, total: totalReports }
            }));

            // Defer non-critical initializations to after first paint
            // This allows the browser to render the initial reports first
            const deferredInit = () => {
                if (initializeUI) {
                    initializeInteractions();
                    initializeInfiniteScroll(listContainer);
                    initializeFilters();
                }

            };

            // Use requestIdleCallback if available, otherwise setTimeout
            if (typeof requestIdleCallback === 'function') {
                requestIdleCallback(deferredInit, { timeout: 200 });
            } else {
                setTimeout(deferredInit, 0);
            }

        } catch (error) {
            console.error('[CMS Client] Error:', error);
            // Hide skeleton and show list (to display error message)
            SkeletonManager.hide();
            setCmsLoadingIndicator(false);

            const listContainer = DOM.$(SELECTORS.list);
            if (listContainer) {
                listContainer.innerHTML = `
                    <div style="padding: 20px; background: #fee; border: 1px solid #fcc; border-radius: 4px; color: #c00;">
                        <strong>Error loading reports:</strong><br>
                        ${error.message}<br>
                        <small>Check browser console for details</small>
                    </div>
                `;
            }
        }
    }

    // Initialize all filter components
    function initializeFilters() {
        TagManager.init();
        FilterIndicators.init();
        initializeDatePickers();
        initializeCheckboxFilters();
        initializeClearButtons();

        // Initialize browser back/forward navigation handling
        UrlManager.initPopstateListener();
    }

    // ===== INTERACTION HANDLERS =====

    function initializeScrollToTop() {
        const scrollWrap = DOM.$(SELECTORS.scrollWrap);
        const useWindowScroll = !!DOM.$(SELECTORS.scrollWindow);
        const jumpButton = DOM.$(SELECTORS.jumpToTop);

        if ((!scrollWrap && !useWindowScroll) || !jumpButton) {
            console.warn('[CMS Client] Scroll-to-top elements not found');
            return;
        }

        // Add scrollbar styling (only for container-based scrolling)
        if (scrollWrap && !useWindowScroll) {
            const styleId = 'cms-scrollbar-styles';
            if (!document.getElementById(styleId)) {
                const style = DOM.create('style', { id: styleId });
                style.textContent = `
                    [cms-reports="scroll-wrap"]::-webkit-scrollbar-track { background: transparent; }
                    [cms-reports="scroll-wrap"]::-webkit-scrollbar-thumb {
                        background: transparent;
                        border-radius: 4px;
                        transition: background 0.3s ease;
                        border: 2px solid transparent;
                        background-clip: padding-box;
                    }
                    [cms-reports="scroll-wrap"]:hover::-webkit-scrollbar-thumb {
                        background: rgba(100, 100, 100, 0.7);
                        background-clip: padding-box;
                    }
                    [cms-reports="scroll-wrap"]::-webkit-scrollbar-thumb:hover {
                        background: rgba(120, 120, 120, 0.9);
                        background-clip: padding-box;
                    }
                    [cms-reports="scroll-wrap"] {
                        scrollbar-width: thin;
                        scrollbar-color: transparent transparent;
                        transition: scrollbar-color 0.3s ease;
                    }
                    [cms-reports="scroll-wrap"]:hover {
                        scrollbar-color: rgba(100, 100, 100, 0.7) transparent;
                    }
                `;
                document.head.appendChild(style);
            }
        }

        jumpButton.style.opacity = '0';
        jumpButton.style.pointerEvents = 'none';

        if (useWindowScroll) {
            // Window-level scrolling
            window.addEventListener('scroll', function() {
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const opacity = Math.min(scrollTop / 300, 1);
                jumpButton.style.opacity = opacity.toString();
                jumpButton.style.pointerEvents = opacity > 0 ? 'auto' : 'none';
            });

            jumpButton.addEventListener('click', (e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        } else {
            // Container-level scrolling
            scrollWrap.addEventListener('scroll', function() {
                const opacity = Math.min(this.scrollTop / 300, 1);
                jumpButton.style.opacity = opacity.toString();
                jumpButton.style.pointerEvents = opacity > 0 ? 'auto' : 'none';
            });

            jumpButton.addEventListener('click', (e) => {
                e.preventDefault();
                scrollWrap.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }

        console.log(`[CMS Client] Scroll-to-top initialized (${useWindowScroll ? 'window' : 'container'} mode)`);
    }

    // Share button functionality
    const shareButtonTimeouts = new Map();

    function initializeShareButtons() {
        document.addEventListener('click', async function(e) {
            const shareBtn = e.target.closest(SELECTORS.shareAction);
            if (!shareBtn) return;

            e.preventDefault();
            e.stopPropagation();

            const reportItem = shareBtn.closest(SELECTORS.item);
            if (!reportItem) return;

            const reporterLink = reportItem.getAttribute('data-reporter-link');
            const reportSlug = reportItem.getAttribute('data-report-slug');
            const shareUrl = reporterLink || (reportSlug ? `https://cotoip.org/report/${reportSlug}` : null);

            if (!shareUrl) {
                console.warn('[CMS Client] No share URL available');
                return;
            }

            // Try native share first
            if (navigator.share) {
                try {
                    await navigator.share({ url: shareUrl });
                    console.log('[CMS Client] Shared via native share');
                    return;
                } catch (err) {
                    console.log('[CMS Client] Native share failed, using clipboard');
                }
            }

            // Fallback to clipboard
            try {
                await navigator.clipboard.writeText(shareUrl);
            } catch (err) {
                const textArea = document.createElement('textarea');
                textArea.value = shareUrl;
                textArea.style.cssText = 'position:fixed;opacity:0';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }

            console.log('[CMS Client] Link copied to clipboard');

            const shareText = DOM.$('.share-text', shareBtn);
            if (shareText) {
                const originalText = shareText.textContent;
                shareText.textContent = 'Copied Link';

                if (shareButtonTimeouts.has(shareBtn)) {
                    clearTimeout(shareButtonTimeouts.get(shareBtn));
                }

                const timeoutId = setTimeout(() => {
                    shareText.textContent = originalText;
                    shareButtonTimeouts.delete(shareBtn);
                }, 2000);

                shareButtonTimeouts.set(shareBtn, timeoutId);
            }
        });

        console.log('[CMS Client] Share buttons initialized');
    }

    // Share page button functionality - shares current page URL with hash
    const sharePageButtonTimeouts = new Map();

    function initializeSharePageButton() {
        document.addEventListener('click', async function(e) {
            const shareBtn = e.target.closest('[share="page"]');
            if (!shareBtn) return;

            e.preventDefault();
            e.stopPropagation();

            // Get current page URL including hash
            const shareUrl = window.location.href;

            // Try native share first
            if (navigator.share) {
                try {
                    await navigator.share({ url: shareUrl });
                    console.log('[CMS Client] Page shared via native share');
                    return;
                } catch (err) {
                    console.log('[CMS Client] Native share failed, using clipboard');
                }
            }

            // Fallback to clipboard
            try {
                await navigator.clipboard.writeText(shareUrl);
            } catch (err) {
                const textArea = document.createElement('textarea');
                textArea.value = shareUrl;
                textArea.style.cssText = 'position:fixed;opacity:0';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }

            console.log('[CMS Client] Page link copied to clipboard');

            const shareText = DOM.$('.share-text', shareBtn);
            if (shareText) {
                const originalText = shareText.textContent;
                shareText.textContent = 'Copied Link';

                if (sharePageButtonTimeouts.has(shareBtn)) {
                    clearTimeout(sharePageButtonTimeouts.get(shareBtn));
                }

                const timeoutId = setTimeout(() => {
                    shareText.textContent = originalText;
                    sharePageButtonTimeouts.delete(shareBtn);
                }, 2000);

                sharePageButtonTimeouts.set(shareBtn, timeoutId);
            }
        });

        console.log('[CMS Client] Share page button initialized');
    }

    // Dropdown handler for report options menu
    // Uses [report-options="toggle"] for the trigger and [report-options="dropdown"] for the container
    function initializeReportOptionsDropdown() {
        document.addEventListener('click', function(e) {
            const toggle = e.target.closest('[report-options="toggle"]');
            if (!toggle) return;

            const dropdown = toggle.closest('[report-options="dropdown"]');
            if (!dropdown) return;

            const list = dropdown.querySelector('.w-dropdown-list');
            if (!list) return;

            e.preventDefault();
            e.stopPropagation();

            const isOpen = dropdown.classList.contains('w--open');

            // Close all other report option dropdowns first
            document.querySelectorAll('[report-options="dropdown"].w--open').forEach(d => {
                if (d !== dropdown) {
                    d.classList.remove('w--open');
                    const dList = d.querySelector('.w-dropdown-list');
                    if (dList) {
                        dList.classList.remove('w--open');
                        dList.style.display = '';
                    }
                }
            });

            // Toggle this dropdown
            if (isOpen) {
                dropdown.classList.remove('w--open');
                list.classList.remove('w--open');
                list.style.display = '';
            } else {
                dropdown.classList.add('w--open');
                list.classList.add('w--open');
                list.style.display = 'block';
            }
        });

        // Close report option dropdowns when clicking outside
        document.addEventListener('click', function(e) {
            if (!e.target.closest('[report-options="dropdown"]')) {
                document.querySelectorAll('[report-options="dropdown"].w--open').forEach(d => {
                    d.classList.remove('w--open');
                    const list = d.querySelector('.w-dropdown-list');
                    if (list) {
                        list.classList.remove('w--open');
                        list.style.display = '';
                    }
                });
            }
        });

        console.log('[CMS Client] Report options dropdown initialized');
    }

    // Date link click handler - filters by clicked report's date
    function initializeDateLinks() {
        document.addEventListener('click', function(e) {
            const dateLink = e.target.closest('[cms-link="date"]');
            if (!dateLink) return;

            e.preventDefault();
            e.stopPropagation();

            // Find the parent report item
            const reportItem = dateLink.closest(SELECTORS.item);
            if (!reportItem) return;

            // Get report ID and look up cached data
            const reportId = reportItem.getAttribute('data-report-id');
            if (!reportId) return;

            const reportData = Store.getReportData(reportId);
            if (!reportData) {
                console.warn('[CMS Client] No cached data for report:', reportId);
                return;
            }

            // Extract date (use occupation date or createdOn)
            const dateValue = reportData.date || reportData.createdOn;
            if (!dateValue) {
                console.warn('[CMS Client] No date found for report:', reportId);
                return;
            }

            // Format to YYYY-MM-DD for the filter
            const dateObj = new Date(dateValue);
            if (isNaN(dateObj.getTime())) {
                console.warn('[CMS Client] Invalid date:', dateValue);
                return;
            }

            const formattedDate = dateObj.toISOString().split('T')[0];

            console.log(`[CMS Client] Filtering by date: ${formattedDate}`);

            // Set the date filter and apply
            Store.setFilter('date', formattedDate);

            // Update the date picker input if it exists
            const dateInput = DOM.$(SELECTORS.date);
            if (dateInput) {
                dateInput.value = formattedDate;
                if (dateInput._flatpickr) {
                    dateInput._flatpickr.setDate(formattedDate, false);
                }
            }

            applyFilters();
        });

        console.log('[CMS Client] Date links initialized');
    }

    function initializeInteractions() {
        // Initialize delegated event handlers (single listeners for all items)
        ModalUtils.initDelegation();
        ThumbnailHandler.init();

        initializeSearch();
        initializeScrollToTop();
        initializeShareButtons();
        initializeSharePageButton();
        initializeReportOptionsDropdown();
        initializeDateLinks();
        initializeViewToggle();
    }

    // ===== VIEW TOGGLE =====
    function initializeViewToggle() {
        const toggleButtons = DOM.$$(SELECTORS.viewToggle);

        if (toggleButtons.length === 0) {
            console.log('[CMS Client] No view toggle buttons found');
            return;
        }

        // Check if we have both templates available
        if (!TemplateManager.hasBothTemplates()) {
            console.warn('[CMS Client] View toggle disabled - need both mini and full templates');
            toggleButtons.forEach(btn => btn.style.display = 'none');
            return;
        }

        // Set initial active state
        updateToggleButtonStates();

        // Set initial margin class based on current view mode
        const listContainer = DOM.$(SELECTORS.list);
        if (listContainer) {
            if (Store.get('viewMode') === 'mini') {
                listContainer.classList.add('is-mini-reports');
            } else {
                listContainer.classList.remove('is-mini-reports');
            }
        }

        // Event delegation for toggle clicks
        document.addEventListener('click', function(e) {
            const toggleBtn = e.target.closest(SELECTORS.viewToggle);
            if (!toggleBtn) return;

            const targetMode = toggleBtn.getAttribute('cms-view-toggle');
            const currentMode = Store.get('viewMode');

            if (targetMode === currentMode) return;

            if (targetMode === 'mini' || targetMode === 'full') {
                switchView(targetMode);
            } else {
                // Toggle between modes if no specific target
                switchView(currentMode === 'mini' ? 'full' : 'mini');
            }

            // Close the parent Webflow dropdown if toggle is inside one
            const wDropdown = toggleBtn.closest('.w-dropdown');
            if (wDropdown) {
                wDropdown.classList.remove('w--open');
                const dropdownList = wDropdown.querySelector('.w-dropdown-list');
                if (dropdownList) {
                    dropdownList.classList.remove('w--open');
                    dropdownList.style.display = '';
                }
            }
        });

        console.log('[CMS Client] View toggle initialized');
    }

    function updateToggleButtonStates() {
        const currentMode = Store.get('viewMode');

        DOM.$$(SELECTORS.viewToggle).forEach(btn => {
            const btnMode = btn.getAttribute('cms-view-toggle');

            if (btnMode === currentMode) {
                btn.classList.add('is--active');
            } else {
                btn.classList.remove('is--active');
            }
        });
    }

    // Mobile breakpoint for initial view mode default
    const MOBILE_BREAKPOINT = 478;

    // Get the appropriate default view mode based on screen size
    // Only used when there's no saved preference in localStorage
    function getDefaultViewMode() {
        return window.innerWidth <= MOBILE_BREAKPOINT ? 'full' : 'mini';
    }

    // Find the report ID of the topmost visible report item
    function getTopVisibleReportId() {
        const listContainer = DOM.$(SELECTORS.list);
        if (!listContainer) return null;

        const useWindowScroll = !!DOM.$(SELECTORS.scrollWindow);
        const items = DOM.$$(SELECTORS.itemNotTemplate, listContainer);
        let topVisibleId = null;
        let smallestOffset = Infinity;

        if (useWindowScroll) {
            // Window-level scrolling: use viewport top as reference, accounting for fixed header
            const topOffset = TopOffset.get();
            items.forEach(item => {
                const rect = item.getBoundingClientRect();
                // Adjust for fixed header - items at topOffset position are at the "top"
                const adjustedTop = rect.top - topOffset;
                // Find the item closest to the visible top (but still visible or just above)
                if (adjustedTop >= -rect.height && adjustedTop < smallestOffset) {
                    smallestOffset = adjustedTop;
                    topVisibleId = item.getAttribute('data-report-id');
                }
            });
        } else {
            // Container-level scrolling
            const scrollWrap = DOM.$(SELECTORS.scrollWrap) || listContainer;
            const containerRect = scrollWrap.getBoundingClientRect();

            items.forEach(item => {
                const rect = item.getBoundingClientRect();
                // Calculate position relative to the scroll container's top
                const offsetFromTop = rect.top - containerRect.top;

                // Find the item closest to the top of the viewport (but still visible or just above)
                if (offsetFromTop >= -rect.height && offsetFromTop < smallestOffset) {
                    smallestOffset = offsetFromTop;
                    topVisibleId = item.getAttribute('data-report-id');
                }
            });
        }

        return topVisibleId;
    }

    // Scroll to a specific report by ID
    function scrollToReportId(reportId) {
        if (!reportId) return;

        const listContainer = DOM.$(SELECTORS.list);
        if (!listContainer) return;

        const targetItem = DOM.$(`[data-report-id="${reportId}"]`, listContainer);
        if (!targetItem) {
            console.log(`[CMS Client] Could not find report ${reportId} to scroll to`);
            return;
        }

        const useWindowScroll = !!DOM.$(SELECTORS.scrollWindow);
        const scrollWrap = DOM.$(SELECTORS.scrollWrap);
        // Extra padding for mini reports only (0.5rem = 8px), no padding for full reports
        const isMiniMode = Store.get('viewMode') === 'mini';
        const scrollPadding = isMiniMode ? 8 : 0;

        if (useWindowScroll) {
            // Window-level scrolling - account for fixed header offset
            const itemRect = targetItem.getBoundingClientRect();
            const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const topOffset = TopOffset.get();

            const targetScrollTop = itemRect.top + currentScrollTop - topOffset - scrollPadding;

            window.scrollTo({
                top: targetScrollTop,
                behavior: 'instant'
            });
        } else if (scrollWrap) {
            // Container-level scrolling
            const containerRect = scrollWrap.getBoundingClientRect();
            const itemRect = targetItem.getBoundingClientRect();
            const currentScrollTop = scrollWrap.scrollTop;
            const offsetFromContainer = itemRect.top - containerRect.top + currentScrollTop - scrollPadding;

            scrollWrap.scrollTo({
                top: offsetFromContainer,
                behavior: 'instant'
            });
        } else {
            // Fallback to scrollIntoView
            targetItem.scrollIntoView({ block: 'start', behavior: 'instant' });
        }

        log(`[CMS Client] Scrolled to report: ${reportId}`);
    }

    async function switchView(newMode) {
        const currentMode = Store.get('viewMode');
        if (newMode === currentMode) return;

        console.log(`[CMS Client] Switching view: ${currentMode} → ${newMode}`);
        setCmsLoadingIndicator(true);

        // Capture the top visible report BEFORE switching
        const topVisibleReportId = getTopVisibleReportId();
        log(`[CMS Client] Top visible report before switch: ${topVisibleReportId}`);

        // Update state
        Store.setState({ viewMode: newMode }, true);

        // Persist view mode to localStorage
        try {
            localStorage.setItem(CONFIG.VIEW_MODE_STORAGE_KEY, newMode);
        } catch (e) {
            // localStorage may be unavailable (private browsing, etc.)
            log('Could not save view mode to localStorage:', e);
        }

        // Update button states
        updateToggleButtonStates();

        // Get cached reports
        const cachedReports = Store.get('cachedReports');

        if (!cachedReports || cachedReports.length === 0) {
            console.warn('[CMS Client] No cached reports for view switch');
            setCmsLoadingIndicator(false);
            return;
        }

        // Re-render with new template
        const listContainer = DOM.$(SELECTORS.list);
        if (!listContainer) {
            setCmsLoadingIndicator(false);
            return;
        }

        // Update list container margin class
        if (newMode === 'mini') {
            listContainer.classList.add('is-mini-reports');
        } else {
            listContainer.classList.remove('is-mini-reports');
        }

        // Get the new template
        const template = TemplateManager.getActiveTemplate();
        if (!template) {
            console.error('[CMS Client] No template available for mode:', newMode);
            setCmsLoadingIndicator(false);
            return;
        }

        // Re-populate with cached data
        await populateReports(cachedReports, listContainer, template, false);

        // Restore scroll position to the same report
        if (topVisibleReportId) {
            // Use requestAnimationFrame to ensure DOM is fully rendered
            requestAnimationFrame(() => {
                scrollToReportId(topVisibleReportId);
            });
        }

        setCmsLoadingIndicator(false);
        console.log(`[CMS Client] View switched to ${newMode}, rendered ${cachedReports.length} reports`);

        // Dispatch event for other scripts
        window.dispatchEvent(new CustomEvent('cmsViewChanged', {
            detail: { mode: newMode, previousMode: currentMode }
        }));
    }

    function initializeInfiniteScroll(listContainer) {
        const sentinel = DOM.$(SELECTORS.scrollSentinel, listContainer);

        if (!sentinel) {
            console.error('[CMS Client] Scroll sentinel not found!');
            return;
        }

        // Disconnect existing observer if present (prevents duplicates on re-init)
        if (infiniteScrollObserver) {
            infiniteScrollObserver.disconnect();
            infiniteScrollObserver = null;
        }

        // Track if initial render is complete to prevent immediate triggering
        let initialRenderComplete = false;

        infiniteScrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                // Skip if initial render hasn't completed yet
                if (!initialRenderComplete) {
                    log('Skipping intersection - initial render not complete');
                    return;
                }
                const hasMore = Store.get('hasMoreReports');
                const isLoading = Store.get('isLoading');
                const offset = Store.get('currentOffset');
                console.warn(`[SCROLL-DEBUG] Observer fired | isIntersecting=${entry.isIntersecting} | hasMore=${hasMore} | isLoading=${isLoading} | offset=${offset} | pendingReq=${!!pendingLoadRequest}`);
                if (entry.isIntersecting && hasMore && !isLoading) {
                    loadMoreReports();
                }
            });
        }, {
            root: null,
            rootMargin: '300px',
            threshold: 0.1
        });

        infiniteScrollObserver.observe(sentinel);

        // Delay enabling the observer to allow initial content to render
        // This prevents immediate triggering when sentinel is in viewport on load
        // Use setTimeout to ensure we're past the initial paint cycle
        setTimeout(() => {
            initialRenderComplete = true;
            log('Infinite scroll now active');

            // Manually check if sentinel is already visible (observer won't re-fire if already intersecting)
            // This handles the case where 6 reports don't fill the viewport
            const sentinelRect = sentinel.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const isVisible = sentinelRect.top < viewportHeight + 300; // 300px matches rootMargin

            if (isVisible && Store.get('hasMoreReports') && !Store.get('isLoading')) {
                log('Sentinel already visible after activation, loading more...');
                loadMoreReports();
            }
        }, 150); // Small delay to ensure initial paint is complete

        console.log('[CMS Client] Infinite scroll initialized (delayed activation)');
    }

    function initializeSearch() {
        const searchInput = DOM.$(SELECTORS.searchInput);
        if (!searchInput) return;

        let debounceTimer;

        searchInput.addEventListener('input', function(e) {
            const query = e.target.value.trim();
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                Store.setFilter('search', query);
                applyFilters();
            }, 500);
        });

        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(debounceTimer);
                Store.setFilter('search', e.target.value.trim());
                applyFilters();
            }
        });

        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                e.target.value = '';
                clearTimeout(debounceTimer);
                Store.setFilter('search', '');
                applyFilters();
            }
        });

        // Initialize search toggles (supports multiple toggle buttons)
        const searchToggles = DOM.$$('[filter-reports="search-toggle"]');
        const searchWrap = DOM.$('.header-search-wrap');

        if (searchToggles.length && searchWrap) {
            searchToggles.forEach(searchToggle => {
                searchToggle.addEventListener('click', function(e) {
                    e.preventDefault();
                    const isHidden = searchWrap.classList.contains('hide--search');

                    if (isHidden) {
                        // Show search
                        searchWrap.classList.remove('hide--search');
                        searchToggles.forEach(toggle => toggle.classList.add('is--open'));
                        // Focus the search input when opening
                        searchInput.focus();
                    } else {
                        // Hide search
                        searchWrap.classList.add('hide--search');
                        searchToggles.forEach(toggle => toggle.classList.remove('is--open'));
                        // Clear search input and filter when closing
                        if (searchInput.value.trim()) {
                            searchInput.value = '';
                            clearTimeout(debounceTimer);
                            Store.setFilter('search', '');
                            applyFilters();
                        }
                    }
                });
            });
            console.log('[CMS Client] Search toggle initialized for', searchToggles.length, 'elements');
        }

        console.log('[CMS Client] Search initialized');
    }

    // ===== INITIALIZATION =====

    function init() {

        if (window.Webflow?.env?.() === 'design') {
            console.log('[CMS Client] Skipping in Webflow Designer mode');
            return;
        }

        if (typeof window.jQuery !== 'undefined') {
            window.jQuery(document).ready(() => loadReports());
        } else {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', loadReports);
            } else {
                setTimeout(loadReports, 100);
            }
        }

        window.cmsLoadReports = loadReports;
    }

    init();

    // ===== DEBUG INTERFACE =====
    window.cmsDebug = {
        config: CONFIG,
        selectors: SELECTORS,
        loadReports,
        Store,
        DOMBatch,
        applyFilters,
        clearAllFilters,
        cancelPendingLoad,
        TagManager,
        FilterIndicators,
        TemplateManager,
        TopOffset,
        UrlManager,
        PageFilter,
        SkeletonManager,
        ModalUtils,
        ThumbnailHandler,
        ExtraVisibility,
        switchView,
        getViewMode: () => Store.get('viewMode'),
        setViewMode: (mode) => switchView(mode),
        getReportData: (id) => Store.getReportData(id),
        getUrlParams: () => UrlManager.buildUrlParams(),
        parseUrlFilters: () => UrlManager.parseUrl(),
        getPageFilter: () => PageFilter.get(),
        hasPageFilter: () => PageFilter.hasPageFilter(),
        checkElements() {
            const list = DOM.$(SELECTORS.list);
            const item = DOM.$(SELECTORS.item);
            const title = item ? DOM.$('[cms-field="title"]', item) : null;
            const mainImage = item ? DOM.$(SELECTORS.mainImage, item) : null;
            const date = item ? DOM.$('[cms-field="date"]', item) : null;
            const reporters = item ? DOM.$('[cms-field="reporters"]', item) : null;

            console.log('List container:', list);
            console.log('Template item:', item);
            console.log('Title element:', title);
            console.log('Main image element:', mainImage);
            console.log('Date element:', date);
            console.log('Reporters element:', reporters);

            return {
                hasList: !!list,
                hasItem: !!item,
                hasTitle: !!title,
                hasMainImage: !!mainImage,
                hasDate: !!date,
                hasReporters: !!reporters
            };
        },
        getState() {
            return Store.getState();
        }
    };

    console.log('[CMS Client] Mini Reports with Filters script loaded. Debug available at window.cmsDebug');

})();
