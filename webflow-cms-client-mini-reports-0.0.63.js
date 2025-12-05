/**
 * Webflow CMS Client Script - Mini Reports Version with Advanced Filtering
 * Refactored version with improved structure and performance
 */

(function() {
    'use strict';

    console.log('[CMS Client] Mini Reports with Filters script loading...');

    // ============================================================================
    // CONFIGURATION
    // ============================================================================

    const CONFIG = {
        WORKER_URL: 'https://cms-reports-api.occupation-crimes.workers.dev',
        REPORTS_LIMIT: 15,
        REPORTS_PER_PAGE: 10,
        DEBUG: false
    };

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================

    /**
     * Safe console logging
     * @param {...any} args - Arguments to log
     */
    function log(...args) {
        if (CONFIG.DEBUG) {
            console.log('[CMS Client]', ...args);
        }
    }

    /**
     * Safely set text content of an element
     * @param {HTMLElement} element - Target element
     * @param {string} text - Text to set
     * @returns {boolean} - Success status
     */
    function setText(element, text) {
        if (!element) return false;
        const finalText = text?.toString() || '';
        element.textContent = finalText;
        return finalText !== '';
    }

    /**
     * Safely set href of a link element
     * @param {HTMLElement} element - Link element
     * @param {string} url - URL to set
     * @returns {boolean} - Success status
     */
    function setLink(element, url) {
        if (!element) return false;
        if (url) {
            element.href = url;
            element.style.display = '';
            return true;
        }
        element.style.display = 'none';
        return false;
    }

    /**
     * Set multiple links with same selector
     * @param {string} selector - CSS selector
     * @param {HTMLElement} parent - Parent element
     * @param {string} url - URL to set
     */
    function setLinks(selector, parent, url) {
        const elements = parent.querySelectorAll(selector);
        elements.forEach(el => setLink(el, url));
    }

    /**
     * Format date for display
     * @param {string} dateString - ISO date string
     * @param {boolean} short - Use short format
     * @returns {string} - Formatted date
     */
    function formatDate(dateString, short = false) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return '';

            const options = short ? {
                month: 'short',
                day: 'numeric'
            } : {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            };

            return date.toLocaleDateString('en-US', options);
        } catch (e) {
            log('Date format error:', e);
            return '';
        }
    }

    /**
     * Format reporter names for display
     * @param {Array} reporters - Array of reporter objects
     * @returns {string} - Formatted reporter names
     */
    function formatReporterNames(reporters) {
        if (!reporters?.length) return '';

        const names = reporters.map(r => r.name).filter(Boolean);
        if (names.length === 0) return '';
        if (names.length === 1) return names[0];
        if (names.length === 2) return names.join(' and ');

        const last = names.pop();
        return `${names.join(', ')}, and ${last}`;
    }

    /**
     * Debounce function execution
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in ms
     * @returns {Function} - Debounced function
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Wait for element to appear in DOM
     * @param {string} selector - CSS selector
     * @param {number} timeout - Max wait time
     * @returns {Promise<HTMLElement|null>} - Element or null
     */
    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver((mutations, obs) => {
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

    /**
     * Build URL with query parameters
     * @param {string} baseUrl - Base URL
     * @param {Object} params - Query parameters
     * @returns {string} - Full URL
     */
    function buildUrl(baseUrl, params) {
        const url = new URL(baseUrl);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                if (Array.isArray(value) && value.length > 0) {
                    url.searchParams.append(key, value.join(','));
                } else if (!Array.isArray(value)) {
                    url.searchParams.append(key, value);
                }
            }
        });
        return url.toString();
    }

    // ============================================================================
    // DOM CACHE MANAGER
    // ============================================================================

    class DOMCache {
        constructor() {
            this.cache = new Map();
            this.parentCache = new WeakMap();
        }

        /**
         * Get element(s) from cache or query DOM
         * @param {string} selector - CSS selector
         * @param {HTMLElement} parent - Parent element
         * @param {boolean} multiple - Query all matching elements
         * @returns {HTMLElement|NodeList|null}
         */
        get(selector, parent = document, multiple = false) {
            // Create cache key
            const cacheKey = `${selector}_${multiple}`;

            // Check parent-specific cache
            if (parent !== document) {
                if (!this.parentCache.has(parent)) {
                    this.parentCache.set(parent, new Map());
                }
                const parentMap = this.parentCache.get(parent);
                if (parentMap.has(cacheKey)) {
                    return parentMap.get(cacheKey);
                }

                // Query and cache
                const result = multiple ?
                    parent.querySelectorAll(selector) :
                    parent.querySelector(selector);
                parentMap.set(cacheKey, result);
                return result;
            }

            // Check global cache
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            // Query and cache
            const result = multiple ?
                document.querySelectorAll(selector) :
                document.querySelector(selector);
            this.cache.set(cacheKey, result);
            return result;
        }

        /**
         * Clear cache
         */
        clear() {
            this.cache.clear();
            // WeakMap cleans itself up
        }
    }

    // ============================================================================
    // FILTER STATE MANAGER
    // ============================================================================

    class FilterState {
        constructor() {
            this.filters = {
                search: '',
                dateFrom: '',
                dateUntil: '',
                topic: [],
                region: [],
                locality: [],
                territory: [],
                reporter: [],
                urgent: null
            };
            this.listeners = [];
        }

        /**
         * Get current filter state
         * @returns {Object} Current filters
         */
        get() {
            return { ...this.filters };
        }

        /**
         * Update filter value
         * @param {string} key - Filter key
         * @param {any} value - New value
         */
        set(key, value) {
            const oldValue = this.filters[key];
            this.filters[key] = value;

            if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
                this.notifyListeners(key, value, oldValue);
            }
        }

        /**
         * Update multiple filters
         * @param {Object} updates - Filter updates
         */
        update(updates) {
            Object.entries(updates).forEach(([key, value]) => {
                this.set(key, value);
            });
        }

        /**
         * Reset all filters
         */
        reset() {
            this.filters = {
                search: '',
                dateFrom: '',
                dateUntil: '',
                topic: [],
                region: [],
                locality: [],
                territory: [],
                reporter: [],
                urgent: null
            };
            this.notifyListeners('reset', null, null);
        }

        /**
         * Check if any filters are active
         * @returns {boolean}
         */
        hasActiveFilters() {
            return Object.entries(this.filters).some(([key, value]) => {
                if (Array.isArray(value)) return value.length > 0;
                if (key === 'urgent') return value !== null;
                return value !== '';
            });
        }

        /**
         * Add change listener
         * @param {Function} callback - Listener function
         */
        onChange(callback) {
            this.listeners.push(callback);
        }

        /**
         * Notify all listeners
         * @param {string} key - Changed key
         * @param {any} newValue - New value
         * @param {any} oldValue - Old value
         */
        notifyListeners(key, newValue, oldValue) {
            this.listeners.forEach(callback => {
                callback(key, newValue, oldValue);
            });
        }

        /**
         * Get filter parameters for API
         * @returns {Object} API parameters
         */
        toAPIParams() {
            const params = {};

            Object.entries(this.filters).forEach(([key, value]) => {
                if (Array.isArray(value) && value.length > 0) {
                    params[key] = value.join(',');
                } else if (value !== '' && value !== null && !Array.isArray(value)) {
                    params[key] = value;
                }
            });

            return params;
        }
    }

    // ============================================================================
    // MULTI-VALUE FIELD RENDERER
    // ============================================================================

    class MultiValueFieldRenderer {
        /**
         * Render multiple values by duplicating template elements
         * @param {HTMLElement} container - Container element
         * @param {HTMLElement} template - Template element to duplicate
         * @param {Array} values - Array of values to render
         * @param {Function} renderer - Function to render each value
         */
        static render(container, template, values, renderer) {
            if (!container || !template || !Array.isArray(values)) return;

            // Clear existing duplicates (keep template)
            const selector = template.tagName.toLowerCase();
            const attributes = Array.from(template.attributes)
                .map(attr => `[${attr.name}="${attr.value}"]`)
                .join('');

            const existingElements = container.querySelectorAll(`${selector}${attributes}`);
            existingElements.forEach((el, index) => {
                if (index > 0) el.remove();
            });

            // Render values
            if (values.length === 0) {
                template.style.display = 'none';
                return;
            }

            values.forEach((value, index) => {
                let element;
                if (index === 0) {
                    element = template;
                } else {
                    element = template.cloneNode(true);
                    container.appendChild(element);
                }

                element.style.display = '';
                renderer(element, value, index);
            });
        }

        /**
         * Render topic links
         * @param {HTMLElement} container - Topics wrapper element
         * @param {HTMLElement} template - Topic link template
         * @param {Array} topics - Array of topic objects
         */
        static renderTopics(container, template, topics) {
            this.render(container, template, topics, (element, topic) => {
                element.href = `/topic/${topic.slug}`;

                const field = element.querySelector('[cms-field="topic"]');
                if (field) {
                    setText(field, topic.name);
                } else {
                    setText(element, topic.name);
                }
            });
        }

        /**
         * Render location links (regions, localities)
         * @param {HTMLElement} container - Container element
         * @param {HTMLElement} template - Link template
         * @param {Array} locations - Array of location objects
         * @param {string} urlPrefix - URL prefix for links
         */
        static renderLocations(container, template, locations, urlPrefix) {
            this.render(container, template, locations, (element, location) => {
                if (location.slug) {
                    element.href = `${urlPrefix}${location.slug}`;
                    element.style.display = '';
                } else {
                    element.style.display = 'none';
                }

                const field = element.querySelector('[cms-field]');
                if (field) {
                    setText(field, location.name);
                } else {
                    setText(element, location.name);
                }
            });
        }
    }

    // ============================================================================
    // REPORT RENDERER
    // ============================================================================

    class ReportRenderer {
        constructor(domCache) {
            this.domCache = domCache;
            this.locationFields = [
                {
                    dataKey: 'subRegion',
                    fieldSelector: '[cms-field="region"]',
                    linkSelector: '[cms-link="region"]',
                    urlPrefix: '/region/',
                    slashAttr: 'region'
                },
                {
                    dataKey: 'region',
                    fieldSelector: '[cms-field="governorate"]',
                    linkSelector: '[cms-link="governorate"]',
                    urlPrefix: '/governorate/',
                    slashAttr: 'governorate'
                },
                {
                    dataKey: 'locality',
                    fieldSelector: '[cms-field="locality"]',
                    linkSelector: '[cms-link="locality"]',
                    urlPrefix: '/locality/',
                    slashAttr: 'locality'
                }
            ];
        }

        /**
         * Populate basic report fields
         * @param {HTMLElement} element - Report element
         * @param {Object} data - Report data
         * @returns {number} - Number of successful field updates
         */
        populateBasicFields(element, data) {
            let successCount = 0;

            // Title and link
            const titleEl = this.domCache.get('[cms-field="title"]', element);
            const linkEl = this.domCache.get('[cms-link="report"]', element);

            if (setText(titleEl, data.name)) successCount++;
            if (setLink(linkEl, `/report/${data.slug}`)) successCount++;

            // Date
            const dateEl = this.domCache.get('[cms-field="date"]', element);
            const dateValue = data.date || data.createdOn;
            if (setText(dateEl, formatDate(dateValue))) successCount++;

            // Byline
            const bylineEl = this.domCache.get('[cms-field="reporters"]', element);
            setText(bylineEl, formatReporterNames(data.reporters));

            // Topics
            const topicsWrap = this.domCache.get('[cms-wrap="topics"]', element);
            const topicTemplate = this.domCache.get('[cms-link="topic"]', element);

            if (topicsWrap && topicTemplate && data.topic) {
                const topics = Array.isArray(data.topic) ? data.topic : [data.topic];
                MultiValueFieldRenderer.renderTopics(topicsWrap, topicTemplate, topics);
                successCount++;
            }

            // Urgent indicator
            const urgentWrap = this.domCache.get('[cms-wrap="urgent"]', element);
            if (urgentWrap) {
                urgentWrap.style.display = data.urgent === true ? '' : 'none';
            }

            // Victims donation link
            const victimsLink = this.domCache.get('[cms-link="support-victims"]', element);
            setLink(victimsLink, data.victimsDonationLink);

            return successCount;
        }

        /**
         * Populate location fields
         * @param {HTMLElement} element - Report element
         * @param {Object} data - Report data
         */
        populateLocationFields(element, data) {
            // Get slash separators
            const slashes = {};
            this.domCache.get('[slash-for]', element, true).forEach(slash => {
                slashes[slash.getAttribute('slash-for')] = slash;
            });

            this.locationFields.forEach(config => {
                let locationData = data[config.dataKey];

                // Handle arrays - use first item
                if (Array.isArray(locationData)) {
                    locationData = locationData[0] || null;
                }

                const fieldEl = this.domCache.get(config.fieldSelector, element);
                const linkEl = this.domCache.get(config.linkSelector, element);
                const slash = config.slashAttr ? slashes[config.slashAttr] : null;

                if (locationData?.slug) {
                    setText(fieldEl, locationData.name);
                    setLink(linkEl, config.urlPrefix + locationData.slug);
                    if (slash) slash.style.display = '';
                } else if (locationData?.name) {
                    setText(fieldEl, locationData.name);
                    if (linkEl) linkEl.style.display = 'none';
                    if (slash) slash.style.display = '';
                } else {
                    if (linkEl) linkEl.style.display = 'none';
                    if (slash) slash.style.display = 'none';
                }
            });
        }

        /**
         * Populate reporter information
         * @param {HTMLElement} element - Report element
         * @param {Array} reporters - Array of reporter objects
         */
        populateReporterInfo(element, reporters) {
            if (!reporters?.length) return;

            const modalList = this.domCache.get('[cms-wrap="reporter-modal"]', element);
            const reporterTemplate = this.domCache.get('[cms-template="reporter"]', element);

            if (!modalList || !reporterTemplate) return;

            // Clear existing items
            modalList.innerHTML = '';

            // Create items for each reporter
            reporters.forEach(reporter => {
                const item = reporterTemplate.cloneNode(true);
                item.style.display = '';
                item.removeAttribute('cms-template');

                this.populateReporterItem(item, reporter);
                modalList.appendChild(item);
            });

            // Hide template
            reporterTemplate.style.display = 'none';
        }

        /**
         * Populate single reporter item
         * @param {HTMLElement} item - Reporter item element
         * @param {Object} reporter - Reporter data
         */
        populateReporterItem(item, reporter) {
            const link = this.domCache.get('[cms-link="reporter"]', item);

            if (link) {
                setLink(link, reporter.slug ? `/reporter/${reporter.slug}` : null);

                const nameEl = this.domCache.get('[cms-field="reporter"]', link);
                setText(nameEl || link, reporter.name);

                const imageEl = this.domCache.get('[cms-field="reporter-image"]', link);
                if (imageEl && reporter.photo) {
                    const photoUrl = reporter.photo.url || reporter.photo;
                    imageEl.src = photoUrl;
                    imageEl.alt = reporter.name;
                }
            }

            // Set action links
            setLinks('[cms-link="reporter-support"]', item, reporter.donationLink);
            setLinks('[cms-link="reporter-join"]', item, reporter.joinLink);
        }

        /**
         * Populate header thumbnail
         * @param {HTMLElement} element - Report element
         * @param {Object} data - Report data
         */
        populateHeaderThumbnail(element, data) {
            const thumbnailEl = this.domCache.get('[cms-field="header-thumbnail"]', element);

            if (!thumbnailEl) return;

            const firstImage = data.images?.[0];
            if (firstImage?.url) {
                thumbnailEl.src = firstImage.url;
                thumbnailEl.alt = firstImage.alt || data.name || 'Report image';
                thumbnailEl.style.display = '';
            } else {
                thumbnailEl.style.display = 'none';
            }
        }

        /**
         * Render full report
         * @param {HTMLElement} element - Report element
         * @param {Object} data - Report data
         * @returns {number} - Number of successful updates
         */
        render(element, data) {
            const successCount = this.populateBasicFields(element, data);
            this.populateLocationFields(element, data);
            this.populateReporterInfo(element, data.reporters);
            this.populateHeaderThumbnail(element, data);

            // Populate byline links
            this.populateReporterBylineLinks(element, data.reporters);

            // Handle perpetrators
            this.populatePerpetratorInfo(element, data.perpetrators);

            return successCount;
        }

        /**
         * Populate reporter byline links
         * @param {HTMLElement} element - Report element
         * @param {Array} reporters - Array of reporter objects
         */
        populateReporterBylineLinks(element, reporters) {
            const bylineWrap = this.domCache.get('[cms-wrap="byline-reporters"]', element);
            const template = this.domCache.get('[cms-link="byline-reporter"]', element);

            if (!bylineWrap || !template || !reporters?.length) {
                if (template) template.style.display = 'none';
                return;
            }

            MultiValueFieldRenderer.render(bylineWrap, template, reporters, (el, reporter) => {
                if (reporter.slug) {
                    el.href = `/reporter/${reporter.slug}`;
                    el.style.display = '';
                } else {
                    el.style.display = 'none';
                }

                const field = el.querySelector('[cms-field="byline-reporter"]');
                setText(field || el, reporter.name);
            });
        }

        /**
         * Populate perpetrator information
         * @param {HTMLElement} element - Report element
         * @param {Array} perpetrators - Array of perpetrator objects
         */
        populatePerpetratorInfo(element, perpetrators) {
            const perpField = this.domCache.get('[cms-field="perpetrator"]', element);
            const perpLink = this.domCache.get('[cms-link="perpetrator"]', element);

            if (!perpetrators?.length) {
                setText(perpField, '');
                if (perpLink) perpLink.style.display = 'none';
                return;
            }

            const firstPerp = perpetrators[0];
            setText(perpField, firstPerp.name);

            if (perpLink && firstPerp.slug) {
                perpLink.href = `/perpetrator/${firstPerp.slug}`;
                perpLink.style.display = '';
            } else if (perpLink) {
                perpLink.style.display = 'none';
            }
        }
    }

    // ============================================================================
    // API CLIENT
    // ============================================================================

    class APIClient {
        constructor(baseUrl) {
            this.baseUrl = baseUrl;
        }

        /**
         * Fetch reports from API
         * @param {Object} params - Query parameters
         * @returns {Promise<Object>} - API response
         */
        async fetchReports(params = {}) {
            const url = buildUrl(`${this.baseUrl}/reports`, {
                limit: params.limit || CONFIG.REPORTS_LIMIT,
                offset: params.offset || 0,
                ...params
            });

            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                return {
                    success: true,
                    data: data.reports || [],
                    total: data.total || 0,
                    hasMore: data.hasMore || false
                };
            } catch (error) {
                console.error('[CMS Client] Error fetching reports:', error);
                return {
                    success: false,
                    data: [],
                    total: 0,
                    hasMore: false,
                    error: error.message
                };
            }
        }
    }

    // ============================================================================
    // MAIN APPLICATION
    // ============================================================================

    class MiniReportsApp {
        constructor() {
            this.domCache = new DOMCache();
            this.filterState = new FilterState();
            this.apiClient = new APIClient(CONFIG.WORKER_URL);
            this.reportRenderer = new ReportRenderer(this.domCache);

            this.currentOffset = 0;
            this.totalReports = 0;
            this.isLoading = false;
            this.hasMoreReports = true;
            this.isClearing = false;

            this.observers = [];
            this.eventListeners = [];

            // Bind methods
            this.handleScroll = debounce(this.handleScroll.bind(this), 200);
            this.applyFilters = debounce(this.applyFilters.bind(this), 300);
        }

        /**
         * Initialize the application
         */
        async init() {
            console.log('[CMS Client] Initializing Mini Reports App...');

            // Wait for required elements
            const container = await waitForElement('[cms-list="reports"]', 5000);
            if (!container) {
                console.error('[CMS Client] Reports container not found');
                return;
            }

            this.container = container;
            this.template = this.domCache.get('[cms-template="report"]');

            if (!this.template) {
                console.error('[CMS Client] Report template not found');
                return;
            }

            // Setup components
            this.setupFilterListeners();
            this.setupInfiniteScroll();
            this.setupFilterStateListener();

            // Load initial reports
            await this.loadReports();

            console.log('[CMS Client] Mini Reports App initialized');
        }

        /**
         * Setup filter state change listener
         */
        setupFilterStateListener() {
            this.filterState.onChange((key, newValue, oldValue) => {
                if (key === 'reset') {
                    this.resetAllFilters();
                } else {
                    this.updateFilterDisplay(key, newValue);
                    if (!this.isClearing) {
                        this.applyFilters();
                    }
                }
            });
        }

        /**
         * Setup filter event listeners
         */
        setupFilterListeners() {
            // Search input
            const searchInput = this.domCache.get('[cms-filter="search"]');
            if (searchInput) {
                const handler = debounce((e) => {
                    this.filterState.set('search', e.target.value);
                }, 300);
                searchInput.addEventListener('input', handler);
                this.eventListeners.push({ element: searchInput, event: 'input', handler });
            }

            // Date inputs
            this.setupDateFilter('dateFrom', '[cms-filter="date-from"]');
            this.setupDateFilter('dateUntil', '[cms-filter="date-until"]');

            // Checkbox filters
            this.setupCheckboxFilters();

            // Clear button
            const clearButton = this.domCache.get('[cms-clear="filters"]');
            if (clearButton) {
                const handler = () => this.clearAllFilters();
                clearButton.addEventListener('click', handler);
                this.eventListeners.push({ element: clearButton, event: 'click', handler });
            }
        }

        /**
         * Setup date filter
         * @param {string} filterKey - Filter key
         * @param {string} selector - Input selector
         */
        setupDateFilter(filterKey, selector) {
            const input = this.domCache.get(selector);
            if (input) {
                const handler = (e) => {
                    this.filterState.set(filterKey, e.target.value);
                };
                input.addEventListener('change', handler);
                this.eventListeners.push({ element: input, event: 'change', handler });
            }
        }

        /**
         * Setup checkbox filters
         */
        setupCheckboxFilters() {
            const checkboxes = this.domCache.get('input[type="checkbox"][cms-filter]', document, true);

            checkboxes.forEach(checkbox => {
                const handler = (e) => {
                    if (this.isClearing) return;

                    const filterType = checkbox.getAttribute('cms-filter');
                    const filterValue = checkbox.getAttribute('cms-value') || checkbox.value;

                    if (!filterType || !filterValue) return;

                    const currentValues = this.filterState.get()[filterType];

                    if (filterType === 'urgent') {
                        this.filterState.set('urgent', e.target.checked ? true : null);
                    } else if (Array.isArray(currentValues)) {
                        const newValues = e.target.checked ?
                            [...currentValues, filterValue] :
                            currentValues.filter(v => v !== filterValue);
                        this.filterState.set(filterType, newValues);
                    }
                };

                checkbox.addEventListener('change', handler);
                this.eventListeners.push({ element: checkbox, event: 'change', handler });
            });
        }

        /**
         * Setup infinite scroll
         */
        setupInfiniteScroll() {
            // Using IntersectionObserver for better performance
            const sentinel = document.createElement('div');
            sentinel.className = 'scroll-sentinel';
            sentinel.style.height = '1px';
            this.container.parentElement.appendChild(sentinel);

            const observer = new IntersectionObserver(
                (entries) => {
                    if (entries[0].isIntersecting && !this.isLoading && this.hasMoreReports) {
                        this.loadMoreReports();
                    }
                },
                { rootMargin: '100px' }
            );

            observer.observe(sentinel);
            this.observers.push(observer);
        }

        /**
         * Load reports
         * @param {boolean} reset - Reset pagination
         */
        async loadReports(reset = false) {
            if (this.isLoading) return;

            this.isLoading = true;
            this.showLoading(true);

            if (reset) {
                this.currentOffset = 0;
                this.hasMoreReports = true;
                this.clearReportsList();
            }

            const params = {
                ...this.filterState.toAPIParams(),
                offset: this.currentOffset,
                limit: CONFIG.REPORTS_PER_PAGE
            };

            const result = await this.apiClient.fetchReports(params);

            if (result.success) {
                this.renderReports(result.data);
                this.totalReports = result.total;
                this.currentOffset += result.data.length;
                this.hasMoreReports = result.hasMore;
                this.updateResultsCount(result.total);
            } else {
                this.showError(result.error);
            }

            this.isLoading = false;
            this.showLoading(false);
        }

        /**
         * Load more reports (pagination)
         */
        async loadMoreReports() {
            await this.loadReports(false);
        }

        /**
         * Apply current filters
         */
        async applyFilters() {
            await this.loadReports(true);
            this.updateActiveFilterDisplay();
        }

        /**
         * Clear all filters
         */
        clearAllFilters() {
            this.isClearing = true;

            // Clear filter state
            this.filterState.reset();

            // Clear UI elements
            const searchInput = this.domCache.get('[cms-filter="search"]');
            if (searchInput) searchInput.value = '';

            const dateFrom = this.domCache.get('[cms-filter="date-from"]');
            if (dateFrom) dateFrom.value = '';

            const dateUntil = this.domCache.get('[cms-filter="date-until"]');
            if (dateUntil) dateUntil.value = '';

            // Uncheck all checkboxes
            const checkboxes = this.domCache.get('input[type="checkbox"][cms-filter]:checked', document, true);
            checkboxes.forEach(cb => cb.checked = false);

            this.isClearing = false;

            // Reload reports
            this.applyFilters();
        }

        /**
         * Render reports to DOM
         * @param {Array} reports - Array of report data
         */
        renderReports(reports) {
            reports.forEach(reportData => {
                const reportElement = this.template.cloneNode(true);
                reportElement.removeAttribute('cms-template');
                reportElement.style.display = '';

                const successCount = this.reportRenderer.render(reportElement, reportData);

                if (successCount > 0) {
                    this.container.appendChild(reportElement);
                    this.initializeReportInteractions(reportElement);
                }
            });
        }

        /**
         * Initialize interactions for a report element
         * @param {HTMLElement} element - Report element
         */
        initializeReportInteractions(element) {
            // Initialize Fancybox gallery if needed
            const images = element.querySelectorAll('[data-fancybox]');
            if (images.length > 0 && typeof Fancybox !== 'undefined') {
                Fancybox.bind(element, '[data-fancybox]', {
                    // Fancybox options
                });
            }

            // Initialize lazy loading for images
            const lazyImages = element.querySelectorAll('[loading="lazy"]');
            if ('IntersectionObserver' in window) {
                const imageObserver = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const img = entry.target;
                            img.src = img.dataset.src || img.src;
                            imageObserver.unobserve(img);
                        }
                    });
                });

                lazyImages.forEach(img => imageObserver.observe(img));
            }
        }

        /**
         * Clear reports list
         */
        clearReportsList() {
            const reports = this.container.querySelectorAll(':not([cms-template="report"])');
            reports.forEach(report => report.remove());
        }

        /**
         * Show/hide loading indicator
         * @param {boolean} show - Show or hide
         */
        showLoading(show) {
            const loader = this.domCache.get('[cms-element="loader"]');
            if (loader) {
                loader.style.display = show ? '' : 'none';
            }
        }

        /**
         * Show error message
         * @param {string} message - Error message
         */
        showError(message) {
            const errorElement = this.domCache.get('[cms-element="error"]');
            if (errorElement) {
                setText(errorElement, message);
                errorElement.style.display = '';
                setTimeout(() => {
                    errorElement.style.display = 'none';
                }, 5000);
            }
        }

        /**
         * Update results count display
         * @param {number} count - Total results
         */
        updateResultsCount(count) {
            const countElement = this.domCache.get('[cms-element="results-count"]');
            if (countElement) {
                setText(countElement, `${count} report${count !== 1 ? 's' : ''} found`);
            }
        }

        /**
         * Update active filter display
         */
        updateActiveFilterDisplay() {
            const activeFiltersEl = this.domCache.get('[cms-element="active-filters"]');
            if (!activeFiltersEl) return;

            const hasFilters = this.filterState.hasActiveFilters();
            activeFiltersEl.style.display = hasFilters ? '' : 'none';

            if (hasFilters) {
                // Update filter tags display
                this.renderFilterTags(activeFiltersEl);
            }
        }

        /**
         * Render filter tags
         * @param {HTMLElement} container - Container element
         */
        renderFilterTags(container) {
            const tagsContainer = container.querySelector('[cms-wrap="filter-tags"]');
            if (!tagsContainer) return;

            tagsContainer.innerHTML = '';
            const filters = this.filterState.get();

            Object.entries(filters).forEach(([key, value]) => {
                if (Array.isArray(value) && value.length > 0) {
                    value.forEach(v => this.createFilterTag(tagsContainer, key, v));
                } else if (value && !Array.isArray(value)) {
                    this.createFilterTag(tagsContainer, key, value);
                }
            });
        }

        /**
         * Create filter tag element
         * @param {HTMLElement} container - Container element
         * @param {string} type - Filter type
         * @param {string} value - Filter value
         */
        createFilterTag(container, type, value) {
            const tag = document.createElement('div');
            tag.className = 'filter-tag';
            tag.innerHTML = `
                <span>${type}: ${value}</span>
                <button class="filter-tag-remove" data-type="${type}" data-value="${value}">×</button>
            `;

            const removeBtn = tag.querySelector('.filter-tag-remove');
            removeBtn.addEventListener('click', () => {
                this.removeFilter(type, value);
            });

            container.appendChild(tag);
        }

        /**
         * Remove single filter
         * @param {string} type - Filter type
         * @param {string} value - Filter value
         */
        removeFilter(type, value) {
            const currentFilters = this.filterState.get();

            if (Array.isArray(currentFilters[type])) {
                const newValues = currentFilters[type].filter(v => v !== value);
                this.filterState.set(type, newValues);
            } else {
                this.filterState.set(type, type === 'urgent' ? null : '');
            }
        }

        /**
         * Update filter display
         * @param {string} key - Filter key
         * @param {any} value - Filter value
         */
        updateFilterDisplay(key, value) {
            // This method can be extended to update UI elements
            // based on filter state changes
            log(`Filter updated: ${key} = ${JSON.stringify(value)}`);
        }

        /**
         * Reset all filters UI
         */
        resetAllFilters() {
            this.clearAllFilters();
        }

        /**
         * Handle scroll event
         */
        handleScroll() {
            // Can be used for additional scroll-based functionality
        }

        /**
         * Cleanup resources
         */
        destroy() {
            // Remove event listeners
            this.eventListeners.forEach(({ element, event, handler }) => {
                element.removeEventListener(event, handler);
            });

            // Disconnect observers
            this.observers.forEach(observer => observer.disconnect());

            // Clear caches
            this.domCache.clear();

            // Clear references
            this.container = null;
            this.template = null;
            this.eventListeners = [];
            this.observers = [];

            console.log('[CMS Client] Mini Reports App destroyed');
        }
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    // Create and initialize app when DOM is ready
    let app = null;

    function initializeApp() {
        if (app) {
            app.destroy();
        }

        app = new MiniReportsApp();
        app.init().catch(error => {
            console.error('[CMS Client] Failed to initialize app:', error);
        });
    }

    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        initializeApp();
    }

    // Export for potential external use
    window.MiniReportsApp = MiniReportsApp;

})();
