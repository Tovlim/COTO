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
        REPORTS_LIMIT: 15,
        REPORTS_PER_PAGE: 10,
        DEBUG: false,
        // Virtual scroll settings
        VIRTUAL_SCROLL: {
            enabled: true,
            itemHeight: 180,           // Estimated collapsed item height in pixels
            expandedItemHeight: 500,   // Estimated expanded item height
            bufferSize: 5,             // Number of items to render above/below viewport
            poolSize: 30               // Maximum number of DOM nodes in the pool
        }
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
                dateFrom: '',
                dateUntil: '',
                topic: [],
                region: [],
                locality: [],
                territory: [],
                reporter: [],
                urgent: null
            },

            // UI state
            isClearing: false,

            // Virtual scroll data store
            allReports: [],
            expandedItems: new Set(),
            virtualScrollEnabled: CONFIG.VIRTUAL_SCROLL.enabled
        },

        _subscribers: new Map(),
        _subscriberId: 0,

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
                dateFrom: '',
                dateUntil: '',
                topic: [],
                region: [],
                locality: [],
                territory: [],
                reporter: [],
                urgent: null
            };
            this._notify();
        },

        // Reset pagination
        resetPagination() {
            this._state.currentOffset = 0;
            this._state.hasMoreReports = true;
        },

        // Add reports to the data store
        addReports(reports, replace = false) {
            if (replace) {
                this._state.allReports = [...reports];
            } else {
                this._state.allReports = [...this._state.allReports, ...reports];
            }
        },

        // Get all reports
        getReports() {
            return this._state.allReports;
        },

        // Clear all reports
        clearReports() {
            this._state.allReports = [];
            this._state.expandedItems.clear();
        },

        // Track expanded items
        setExpanded(reportId, isExpanded) {
            if (isExpanded) {
                this._state.expandedItems.add(reportId);
            } else {
                this._state.expandedItems.delete(reportId);
            }
        },

        // Check if item is expanded
        isExpanded(reportId) {
            return this._state.expandedItems.has(reportId);
        },

        // Subscribe to state changes
        subscribe(callback, keys = null) {
            const id = ++this._subscriberId;
            this._subscribers.set(id, { callback, keys });
            return () => this._subscribers.delete(id);
        },

        // Notify all subscribers
        _notify(prevState = null) {
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
        format(dateString) {
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
                log('Date format error:', e);
                return '';
            }
        },

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

    // ===== LOGGING =====
    function log(...args) {
        if (CONFIG.DEBUG) {
            console.log('[CMS Client]', ...args);
        }
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

            reporterListWrap.classList.add('modal-click');
            reporterListWrap.style.display = 'flex';

            const modalPreWrap = DOM.$('.modal-pre-wrap', reporterListWrap);
            if (modalPreWrap) {
                modalPreWrap.classList.add('modal-click');
                const modalElements = DOM.$('[modal-elements="true"]', modalPreWrap);
                if (modalElements) modalElements.classList.add('modal-click');
            }
        },

        close(reporterListWrap) {
            if (!reporterListWrap) return;

            const modalPreWrap = DOM.$('.modal-pre-wrap', reporterListWrap);
            if (modalPreWrap) {
                modalPreWrap.classList.remove('modal-click');
                const modalElements = DOM.$('[modal-elements="true"]', modalPreWrap);
                if (modalElements) modalElements.classList.remove('modal-click');
            }

            reporterListWrap.classList.remove('modal-click');
            reporterListWrap.style.display = 'none';
        },

        setupTrigger(multiReporterWrap, reportersWrap) {
            if (!multiReporterWrap || multiReporterWrap.hasAttribute('data-modal-initialized')) return;

            multiReporterWrap.setAttribute('data-modal-initialized', 'true');
            multiReporterWrap.style.cursor = 'pointer';

            multiReporterWrap.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const reporterListWrap = DOM.$('[reporter-list-wrap="true"]', reportersWrap);
                this.open(reporterListWrap);
            });
        },

        setupClose(reporterListWrap) {
            if (!reporterListWrap) return;

            if (!reporterListWrap.hasAttribute('data-modal-bg-initialized')) {
                reporterListWrap.setAttribute('data-modal-bg-initialized', 'true');
                reporterListWrap.addEventListener('click', function(e) {
                    if (e.target === this) {
                        e.preventDefault();
                        ModalUtils.close(this);
                    }
                });
            }

            const modalPreWrap = DOM.$('.modal-pre-wrap', reporterListWrap);
            if (modalPreWrap) {
                const closeBtn = DOM.$('[modal-close-btn="true"]', modalPreWrap);
                if (closeBtn && !closeBtn.hasAttribute('data-modal-close-initialized')) {
                    closeBtn.setAttribute('data-modal-close-initialized', 'true');
                    closeBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        ModalUtils.close(this.closest('[reporter-list-wrap="true"]'));
                    });
                }
            }
        }
    };

    // ===== ACCORDION UTILITIES =====
    const AccordionUtils = {
        _overflowTimeouts: new WeakMap(),

        open(target, arrow, container) {
            if (!target) return;

            if (!target.style.transition) {
                target.style.transition = 'height 300ms ease';
            }

            setTimeout(() => {
                target.style.height = target.scrollHeight + 'px';
                if (arrow) arrow.style.transform = 'rotateZ(180deg)';

                // Clear any existing timeout
                if (this._overflowTimeouts.has(container)) {
                    clearTimeout(this._overflowTimeouts.get(container));
                }

                // Set overflow visible after transition
                const timeoutId = setTimeout(() => {
                    target.style.overflow = 'visible';
                    this._overflowTimeouts.delete(container);
                }, 300);

                this._overflowTimeouts.set(container, timeoutId);
            }, 10);
        },

        close(target, arrow, container) {
            if (!target) return;

            // Clear any pending overflow timeout
            if (this._overflowTimeouts.has(container)) {
                clearTimeout(this._overflowTimeouts.get(container));
                this._overflowTimeouts.delete(container);
            }

            if (!target.style.transition) {
                target.style.transition = 'height 300ms ease';
            }

            target.style.height = '0px';
            target.style.overflow = 'hidden';
            if (arrow) arrow.style.transform = 'rotateZ(0deg)';
        },

        isClosed(target) {
            return !target || target.style.height === '0px' ||
                   target.style.height === '0' || !target.style.height;
        },

        adjustHeight(target) {
            if (!target || this.isClosed(target)) return;

            const currentHeight = target.offsetHeight;
            const originalTransition = target.style.transition;

            target.style.transition = 'none';
            target.style.height = 'auto';
            const newHeight = target.scrollHeight;
            target.style.height = currentHeight + 'px';

            target.offsetHeight; // Force reflow

            target.style.transition = originalTransition || 'height 300ms ease';
            target.style.height = newHeight + 'px';
        }
    };

    // ===== VIRTUAL SCROLLER =====
    const VirtualScroller = {
        // Configuration (initialized from CONFIG.VIRTUAL_SCROLL)
        config: {
            itemHeight: CONFIG.VIRTUAL_SCROLL.itemHeight,
            expandedItemHeight: CONFIG.VIRTUAL_SCROLL.expandedItemHeight,
            bufferSize: CONFIG.VIRTUAL_SCROLL.bufferSize,
            poolSize: CONFIG.VIRTUAL_SCROLL.poolSize,
            throttleMs: 16             // Throttle scroll events (~60fps)
        },

        // State
        scrollContainer: null,
        listContainer: null,
        templateItem: null,
        nodePool: [],
        spacerTop: null,
        spacerBottom: null,
        lastScrollTop: 0,
        scrollRAF: null,
        isInitialized: false,
        visibleRange: { start: 0, end: 0 },

        // Initialize the virtual scroller
        init(scrollContainer, listContainer, templateItem) {
            if (this.isInitialized) {
                log('VirtualScroller already initialized');
                return;
            }

            this.scrollContainer = scrollContainer;
            this.listContainer = listContainer;
            this.templateItem = templateItem;

            // Setup template
            if (!templateItem.classList.contains('cms-template-original')) {
                templateItem.classList.add('cms-template-original');
            }
            templateItem.style.display = 'none';

            // Create spacers for virtual scroll height
            this.createSpacers();

            // Create initial node pool
            this.createNodePool();

            // Bind scroll handler
            this.bindScrollHandler();

            this.isInitialized = true;
            console.log('[CMS Client] VirtualScroller initialized with pool size:', this.config.poolSize);
        },

        // Create top and bottom spacers
        createSpacers() {
            // Remove existing spacers if any
            if (this.spacerTop) this.spacerTop.remove();
            if (this.spacerBottom) this.spacerBottom.remove();

            this.spacerTop = DOM.create('div', {
                className: 'virtual-spacer-top',
                style: { height: '0px', width: '100%', flexShrink: '0' }
            });

            this.spacerBottom = DOM.create('div', {
                className: 'virtual-spacer-bottom',
                style: { height: '0px', width: '100%', flexShrink: '0' }
            });

            // Insert spacers
            this.listContainer.insertBefore(this.spacerTop, this.listContainer.firstChild);

            const sentinel = DOM.$('[scroll-sentinel="true"]', this.listContainer);
            if (sentinel) {
                this.listContainer.insertBefore(this.spacerBottom, sentinel);
            } else {
                this.listContainer.appendChild(this.spacerBottom);
            }
        },

        // Create the DOM node pool
        createNodePool() {
            // Clear existing pool
            this.nodePool.forEach(node => {
                if (node.element && node.element.parentNode) {
                    node.element.remove();
                }
            });
            this.nodePool = [];

            // Create pool nodes
            for (let i = 0; i < this.config.poolSize; i++) {
                const element = this.templateItem.cloneNode(true);
                element.classList.remove('cms-template', 'cms-template-original');
                element.classList.add('virtual-pool-item');
                element.style.display = 'none';
                element.setAttribute('data-pool-index', i.toString());

                this.nodePool.push({
                    element,
                    dataIndex: -1,      // Index in allReports array
                    isActive: false,
                    isExpanded: false
                });
            }

            log('Created node pool with', this.config.poolSize, 'nodes');
        },

        // Bind scroll event handler with throttling
        bindScrollHandler() {
            const scrollTarget = this.scrollContainer || window;

            scrollTarget.addEventListener('scroll', () => {
                if (this.scrollRAF) return;

                this.scrollRAF = requestAnimationFrame(() => {
                    this.onScroll();
                    this.scrollRAF = null;
                });
            }, { passive: true });
        },

        // Handle scroll events
        onScroll() {
            if (!Store.get('virtualScrollEnabled')) return;

            const reports = Store.getReports();
            if (reports.length === 0) return;

            this.updateVisibleItems();
        },

        // Calculate which items should be visible
        calculateVisibleRange() {
            const reports = Store.getReports();
            if (reports.length === 0) return { start: 0, end: 0 };

            const scrollTop = this.scrollContainer ? this.scrollContainer.scrollTop : window.scrollY;
            const viewportHeight = this.scrollContainer
                ? this.scrollContainer.clientHeight
                : window.innerHeight;

            // Calculate cumulative heights considering expanded items
            let cumulativeHeight = 0;
            let startIndex = 0;
            let endIndex = reports.length;

            // Find start index
            for (let i = 0; i < reports.length; i++) {
                const itemHeight = Store.isExpanded(reports[i].id)
                    ? this.config.expandedItemHeight
                    : this.config.itemHeight;

                if (cumulativeHeight + itemHeight >= scrollTop) {
                    startIndex = Math.max(0, i - this.config.bufferSize);
                    break;
                }
                cumulativeHeight += itemHeight;
            }

            // Find end index
            cumulativeHeight = 0;
            for (let i = 0; i < reports.length; i++) {
                const itemHeight = Store.isExpanded(reports[i].id)
                    ? this.config.expandedItemHeight
                    : this.config.itemHeight;
                cumulativeHeight += itemHeight;

                if (cumulativeHeight >= scrollTop + viewportHeight) {
                    endIndex = Math.min(reports.length, i + this.config.bufferSize + 1);
                    break;
                }
            }

            // Ensure we don't exceed pool size
            const maxVisible = this.config.poolSize;
            if (endIndex - startIndex > maxVisible) {
                endIndex = startIndex + maxVisible;
            }

            return { start: startIndex, end: endIndex };
        },

        // Calculate height before a given index
        calculateHeightBefore(index) {
            const reports = Store.getReports();
            let height = 0;

            for (let i = 0; i < index && i < reports.length; i++) {
                height += Store.isExpanded(reports[i].id)
                    ? this.config.expandedItemHeight
                    : this.config.itemHeight;
            }

            return height;
        },

        // Calculate total content height
        calculateTotalHeight() {
            const reports = Store.getReports();
            let height = 0;

            for (let i = 0; i < reports.length; i++) {
                height += Store.isExpanded(reports[i].id)
                    ? this.config.expandedItemHeight
                    : this.config.itemHeight;
            }

            return height;
        },

        // Update visible items based on scroll position
        updateVisibleItems() {
            const reports = Store.getReports();
            if (reports.length === 0) return;

            const newRange = this.calculateVisibleRange();

            // Check if range changed significantly
            if (newRange.start === this.visibleRange.start &&
                newRange.end === this.visibleRange.end) {
                return;
            }

            this.visibleRange = newRange;
            log('Visible range:', newRange.start, 'to', newRange.end);

            // Update spacers
            const topHeight = this.calculateHeightBefore(newRange.start);
            const totalHeight = this.calculateTotalHeight();
            const visibleHeight = this.calculateHeightBefore(newRange.end) - topHeight;
            const bottomHeight = Math.max(0, totalHeight - topHeight - visibleHeight);

            this.spacerTop.style.height = topHeight + 'px';
            this.spacerBottom.style.height = bottomHeight + 'px';

            // Deactivate nodes that are out of range
            this.nodePool.forEach(node => {
                if (node.isActive &&
                    (node.dataIndex < newRange.start || node.dataIndex >= newRange.end)) {
                    this.deactivateNode(node);
                }
            });

            // Activate nodes for visible range
            for (let i = newRange.start; i < newRange.end; i++) {
                const report = reports[i];
                if (!report) continue;

                // Check if already rendered
                const existingNode = this.nodePool.find(n => n.isActive && n.dataIndex === i);
                if (existingNode) continue;

                // Find an available node
                const availableNode = this.nodePool.find(n => !n.isActive);
                if (!availableNode) {
                    console.warn('[VirtualScroller] No available nodes in pool');
                    continue;
                }

                this.activateNode(availableNode, i, report);
            }

            // Sort active nodes in DOM order
            this.reorderNodes();
        },

        // Activate a node with report data
        activateNode(node, dataIndex, report) {
            node.dataIndex = dataIndex;
            node.isActive = true;
            node.isExpanded = Store.isExpanded(report.id);

            // Clear previous state
            this.resetNodeElement(node.element);

            // Populate with new data
            populateReportItem(node.element, report, true);

            // Restore expanded state if needed
            if (node.isExpanded) {
                const target = DOM.$('[open-target]', node.element);
                if (target) {
                    lazyLoadReportContent(node.element);
                    target.style.height = 'auto';
                    target.style.overflow = 'visible';
                    const arrow = DOM.$('[dropdown-icon]', node.element);
                    if (arrow) arrow.style.transform = 'rotateZ(180deg)';
                }
            }

            node.element.style.display = '';
            node.element.setAttribute('data-virtual-index', dataIndex.toString());

            // Insert into DOM if not already there
            if (!node.element.parentNode || node.element.parentNode !== this.listContainer) {
                this.listContainer.insertBefore(node.element, this.spacerBottom);
            }
        },

        // Deactivate a node
        deactivateNode(node) {
            node.isActive = false;
            node.dataIndex = -1;
            node.isExpanded = false;
            node.element.style.display = 'none';
            node.element.removeAttribute('data-virtual-index');
        },

        // Reset a node element for reuse
        resetNodeElement(element) {
            // Reset accordion state
            const target = DOM.$('[open-target]', element);
            if (target) {
                target.style.height = '0px';
                target.style.overflow = 'hidden';
            }

            const arrow = DOM.$('[dropdown-icon]', element);
            if (arrow) {
                arrow.style.transform = 'rotateZ(0deg)';
            }

            // Reset tabs
            DOM.$$('[data-tab]', element).forEach(tab => tab.classList.remove('current'));
            DOM.$$('[data-tab-content]', element).forEach(content => {
                content.style.display = 'none';
            });

            // Reset content loaded flag
            element.setAttribute('data-content-loaded', 'false');

            // Remove modal initialization flags for re-initialization
            const multiReporterWrap = DOM.$('[multi-reporter-wrap="true"]', element);
            if (multiReporterWrap) {
                multiReporterWrap.removeAttribute('data-modal-initialized');
            }

            // Remove thumbnail initialization
            const thumbnail = DOM.$('[cms-content="header-thumbnail"]', element);
            if (thumbnail) {
                thumbnail.removeAttribute('data-thumbnail-initialized');
            }

            element.classList.remove('is--loaded');
            element.classList.add('is--loading');
        },

        // Reorder nodes in DOM to match data order
        reorderNodes() {
            const activeNodes = this.nodePool
                .filter(n => n.isActive)
                .sort((a, b) => a.dataIndex - b.dataIndex);

            activeNodes.forEach(node => {
                this.listContainer.insertBefore(node.element, this.spacerBottom);
            });
        },

        // Refresh the virtual scroll (call after data changes)
        refresh() {
            this.visibleRange = { start: 0, end: 0 };
            this.updateVisibleItems();
        },

        // Handle item expansion
        onItemExpanded(reportId) {
            Store.setExpanded(reportId, true);

            // Update the node's height tracking
            const node = this.nodePool.find(n => n.isActive && n.element.getAttribute('data-report-id') === reportId);
            if (node) {
                node.isExpanded = true;
            }

            // Recalculate spacers
            this.updateSpacerHeights();
        },

        // Handle item collapse
        onItemCollapsed(reportId) {
            Store.setExpanded(reportId, false);

            const node = this.nodePool.find(n => n.isActive && n.element.getAttribute('data-report-id') === reportId);
            if (node) {
                node.isExpanded = false;
            }

            this.updateSpacerHeights();
        },

        // Update spacer heights without full refresh
        updateSpacerHeights() {
            const topHeight = this.calculateHeightBefore(this.visibleRange.start);
            const totalHeight = this.calculateTotalHeight();
            const visibleHeight = this.calculateHeightBefore(this.visibleRange.end) - topHeight;
            const bottomHeight = Math.max(0, totalHeight - topHeight - visibleHeight);

            this.spacerTop.style.height = topHeight + 'px';
            this.spacerBottom.style.height = bottomHeight + 'px';
        },

        // Destroy and cleanup
        destroy() {
            // Remove all pool nodes
            this.nodePool.forEach(node => {
                if (node.element && node.element.parentNode) {
                    node.element.remove();
                }
            });
            this.nodePool = [];

            // Remove spacers
            if (this.spacerTop) this.spacerTop.remove();
            if (this.spacerBottom) this.spacerBottom.remove();

            this.isInitialized = false;
            this.visibleRange = { start: 0, end: 0 };
        },

        // Get debug info
        getDebugInfo() {
            return {
                isInitialized: this.isInitialized,
                poolSize: this.nodePool.length,
                activeNodes: this.nodePool.filter(n => n.isActive).length,
                visibleRange: this.visibleRange,
                totalReports: Store.getReports().length,
                expandedItems: Store.get('expandedItems').size,
                spacerTop: this.spacerTop?.style.height,
                spacerBottom: this.spacerBottom?.style.height
            };
        }
    };

    // ===== POPULATE FUNCTIONS =====

    // Populate header thumbnail with main image
    function populateHeaderThumbnail(itemElement, reportData) {
        const thumbnailElement = DOM.$('[cms-content="header-thumbnail"]', itemElement);
        if (!thumbnailElement) return;

        if (!reportData.photo?.url) {
            thumbnailElement.style.display = 'none';
            return;
        }

        const galleryId = 'gallery-' + reportData.id;
        const hasGalleryImages = reportData.reportImages && reportData.reportImages.length > 0;

        thumbnailElement.href = reportData.photo.url;
        thumbnailElement.removeAttribute('data-fancybox');
        thumbnailElement.setAttribute('data-caption', reportData.name || '');
        thumbnailElement.setAttribute('data-thumb', reportData.photo.url);

        const thumbnailImg = DOM.$('img', thumbnailElement);
        if (thumbnailImg) {
            thumbnailImg.src = reportData.photo.url;
            thumbnailImg.alt = reportData.name || '';
            thumbnailImg.classList.remove('lazy', 'loading');
            thumbnailImg.removeAttribute('data-ll-status');
        }

        if (!thumbnailElement.hasAttribute('data-thumbnail-initialized')) {
            thumbnailElement.setAttribute('data-thumbnail-initialized', 'true');

            thumbnailElement.addEventListener('click', function(e) {
                e.preventDefault();

                const openGallery = (startIndex = 0) => {
                    if (typeof Fancybox === 'undefined') return;

                    const galleryElements = document.querySelectorAll(`[data-fancybox="${galleryId}"]`);
                    const galleryImages = [...galleryElements].map(el => ({
                        src: el.href,
                        caption: el.getAttribute('data-caption') || '',
                        thumb: el.getAttribute('data-thumb') || el.href
                    }));

                    if (galleryImages.length > 0) {
                        Fancybox.show(galleryImages, { startIndex });
                    } else {
                        Fancybox.show([{
                            src: reportData.photo.url,
                            caption: reportData.name || '',
                            thumb: reportData.photo.url
                        }]);
                    }
                };

                if (hasGalleryImages && itemElement.getAttribute('data-content-loaded') !== 'true') {
                    lazyLoadReportContent(itemElement);
                    setTimeout(() => openGallery(0), 100);
                } else {
                    openGallery(0);
                }
            });
        }

        thumbnailElement.style.display = '';
    }

    // Populate reporter byline links
    function populateReporterBylineLinks(itemElement, reporters) {
        const templateLink = DOM.$('a[cms-link="reporter"]', itemElement);
        if (!templateLink || !reporters || reporters.length === 0) {
            if (templateLink) templateLink.style.display = 'none';
            return;
        }

        const parentContainer = templateLink.parentElement;
        if (!parentContainer) return;

        // Remove existing clones and separators
        DOM.$$('a[cms-link="reporter"]', parentContainer).forEach((link, index) => {
            if (index > 0) link.remove();
        });
        DOM.$$('.reporter-separator', parentContainer).forEach(sep => sep.remove());

        const separatorTemplate = DOM.create('div', {
            className: 'sub-text-block reporter-separator',
            textContent: '·'
        });

        let lastElement = templateLink;
        reporters.forEach((reporter, index) => {
            if (!reporter.slug) return;

            if (index > 0) {
                const separator = separatorTemplate.cloneNode(true);
                parentContainer.insertBefore(separator, lastElement.nextSibling);
                lastElement = separator;
            }

            let reporterLink;
            if (index === 0) {
                reporterLink = templateLink;
            } else {
                reporterLink = templateLink.cloneNode(true);
                parentContainer.insertBefore(reporterLink, lastElement.nextSibling);
            }

            reporterLink.href = `/reporter/${reporter.slug}`;
            const reporterField = DOM.$('[cms-field="reporters"]', reporterLink);
            if (reporterField) {
                reporterField.textContent = reporter.name;
            }
            reporterLink.style.display = '';
            lastElement = reporterLink;
        });

        if (reporters.filter(r => r.slug).length === 0) {
            templateLink.style.display = 'none';
        }
    }

    // Populate basic report fields
    function populateBasicFields(itemElement, reportData) {
        let successCount = 0;

        if (DOM.setText(DOM.$('[cms-field="title"]', itemElement), reportData.name)) successCount++;
        if (DOM.setImage(DOM.$('[cms-content="main-image"]', itemElement), reportData.photo?.url || '', reportData.name)) successCount++;

        const dateValue = reportData.date || reportData.createdOn;
        if (DOM.setText(DOM.$('[cms-field="date"]', itemElement), DateUtils.format(dateValue))) successCount++;

        DOM.setText(DOM.$('[cms-field="reporters"]', itemElement), formatReporterNames(reportData.reporters));

        // Handle topics
        const topicsWrap = DOM.$('[cms-wrap="topics"]', itemElement);
        const topicLinkTemplate = DOM.$('[cms-link="topic"]', itemElement);

        if (topicsWrap && topicLinkTemplate) {
            // Clear existing duplicated topics
            DOM.$$('[cms-link="topic"]', topicsWrap).forEach((link, index) => {
                if (index > 0) link.remove();
            });

            if (reportData.topic && Array.isArray(reportData.topic) && reportData.topic.length > 0) {
                reportData.topic.forEach((topic, index) => {
                    let topicLink = index === 0 ? topicLinkTemplate : topicLinkTemplate.cloneNode(true);
                    if (index > 0) topicsWrap.appendChild(topicLink);

                    topicLink.href = `/topic/${topic.slug}`;
                    topicLink.style.display = '';

                    const topicField = DOM.$('[cms-field="topic"]', topicLink);
                    DOM.setText(topicField || topicLink, topic.name);
                });
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

        // Handle urgent wrapper
        const urgentWrap = DOM.$('[cms-wrap="urgent"]', itemElement);
        if (urgentWrap) {
            urgentWrap.style.display = reportData.urgent === true ? '' : 'none';
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

        // Handle report links
        DOM.$$('[cms-link="report-link"]', itemElement).forEach(link => {
            const reportUrl = reportData.reporterEventLink ||
                            (reportData.slug ? `https://occupationcrimes.org/report/${reportData.slug}` : null);
            DOM.setLink(link, reportUrl);
        });

        return successCount;
    }

    // Populate location fields
    function populateLocationFields(itemElement, reportData) {
        const slashes = {};
        DOM.$$('[slash-for]', itemElement).forEach(slash => {
            slashes[slash.getAttribute('slash-for')] = slash;
        });

        LOCATION_FIELDS.forEach(config => {
            let data = reportData[config.dataKey];

            // Handle arrays - use first item
            if (Array.isArray(data)) {
                data = data.length > 0 ? data[0] : null;
            }

            const fieldElement = DOM.$(config.fieldSelector, itemElement);
            const linkElement = DOM.$(config.linkSelector, itemElement);
            const slash = config.slashAttr ? slashes[config.slashAttr] : null;

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

            const displayName = reporters.length === 2
                ? reporters.map(r => r.name).join(' & ')
                : `${firstReporter.name} + ${reporters.length - 1} more`;
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

            ModalUtils.setupTrigger(multiReporterWrap, reportersWrap);
            ModalUtils.setupClose(reporterListWrap);
        }

        const supportButton = DOM.$('.support-button-2', itemElement);
        const joinButton = DOM.$('.join-button-2', itemElement);
        DOM.setLink(supportButton, firstReporter.donationLink);
        DOM.setLink(joinButton, firstReporter.joinLink);
    }

    // Populate perpetrator info for full reports
    function populatePerpetratorInfo(itemElement, reportData) {
        const itemType = itemElement.getAttribute('cms-item-type');
        if (itemType !== 'full') return;

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
                perpLink.href = `/perpetrator/${perpetrator.slug}`;
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

        // Settlement
        const settlementLink = DOM.$('a[cms-link="Settlement"]', perpInfoWrap);
        const settlementField = DOM.$('div[cms-field="Settlement"]', perpInfoWrap);
        if (reportData.settlement) {
            if (settlementLink && reportData.settlement.slug) {
                settlementLink.href = `/settlement/${reportData.settlement.slug}`;
                settlementLink.style.display = '';
            } else {
                DOM.toggle(settlementLink, false);
            }
            DOM.setText(settlementField, reportData.settlement.name || reportData.settlement);
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
        DOM.toggle(fromText, !!reportData.settlement);

        const atText = DOM.$('[fs-list-field="Place"]', perpInfoWrap);
        DOM.toggle(atText, !!(reportData.place || reportData.locationType));

        const backerSection = DOM.$('.div-block-318671:last-child', perpInfoWrap);
        DOM.toggle(backerSection, !!reportData.backer);
    }

    // Populate content tabs
    function populateContent(itemElement, reportData, isLazyLoad = false) {
        const infoContent = DOM.$('[cms-content="info"]', itemElement);
        const descriptionContent = DOM.$('[cms-content="description"]', itemElement);
        if (reportData.description) {
            DOM.setRichText(infoContent, reportData.description);
            DOM.setRichText(descriptionContent, reportData.description);
        }

        populateVideos(itemElement, reportData.videos);
        populateImagesGallery(itemElement, reportData);

        if (isLazyLoad) return;

        const itemType = itemElement.getAttribute('cms-item-type');
        const isFullType = itemType === 'full';

        const hasImages = reportData.reportImages?.length > 0;
        const hasVideos = reportData.videos?.length > 0;

        const infoTab = DOM.$('[data-tab="1"]', itemElement);
        const imagesTab = DOM.$('[data-tab="2"]', itemElement);
        const videosTab = DOM.$('[data-tab="3"]', itemElement);
        const tabsWrap = DOM.$('[data-tab="wrap"]', itemElement);

        if (isFullType) {
            DOM.toggle(infoTab, true);
            DOM.toggle(imagesTab, hasImages);
            DOM.toggle(videosTab, hasVideos);
            DOM.toggle(tabsWrap, true);

            DOM.$$('[data-tab-content]', itemElement).forEach(content => {
                content.style.display = 'none';
            });

            DOM.$$('[data-tab]', itemElement).forEach(tab => {
                tab.classList.remove('current');
            });

            const target = DOM.$('[open-target]', itemElement);
            if (target) {
                target.style.height = '0px';
                target.style.overflow = 'hidden';
            }
        } else {
            DOM.toggle(imagesTab, hasImages);
            DOM.toggle(videosTab, hasVideos);
            if (tabsWrap) {
                tabsWrap.style.display = (!hasImages && !hasVideos) ? 'none' : '';
            }
        }
    }

    // Populate videos
    function populateVideos(itemElement, videos) {
        const videosWrap = DOM.$('[cms-deliver="videos-wrap"]', itemElement);
        if (!videosWrap || !videos || videos.length === 0) {
            DOM.toggle(videosWrap, false);
            return;
        }

        const templateVideoWrap = DOM.$('[cms-deliver="video-wrap"]', videosWrap);
        if (!templateVideoWrap) {
            console.warn('[CMS Client] No [cms-deliver="video-wrap"] template found');
            return;
        }

        // Clear existing except template
        DOM.$$('[cms-deliver="video-wrap"]', videosWrap).forEach((vw, index) => {
            if (index > 0) vw.remove();
        });

        videos.forEach((video, index) => {
            const videoWrap = templateVideoWrap.cloneNode(true);

            const richTextElement = DOM.$('[cms-field="video-rich-text"]', videoWrap);
            const videoLinkElement = DOM.$('[cms-field="video-link"]', videoWrap);
            const iframe = videoLinkElement?.querySelector('iframe');

            if (richTextElement && video.text) {
                DOM.setRichText(richTextElement, video.text);
            }

            if (iframe && video.url) {
                let embedUrl = video.url;

                if (embedUrl.includes('youtube.com/watch?v=')) {
                    const videoId = embedUrl.split('v=')[1].split('&')[0];
                    embedUrl = `https://www.youtube.com/embed/${videoId}`;
                } else if (embedUrl.includes('youtu.be/')) {
                    const videoId = embedUrl.split('youtu.be/')[1].split('?')[0];
                    embedUrl = `https://www.youtube.com/embed/${videoId}`;
                }

                iframe.setAttribute('data-src', embedUrl);
                iframe.src = embedUrl;
                iframe.loading = 'lazy';
                iframe.classList.remove('loading', 'exited');
                if (!iframe.classList.contains('entered')) {
                    iframe.classList.add('entered');
                }
            }

            videoWrap.style.display = '';

            if (index === 0) {
                templateVideoWrap.replaceWith(videoWrap);
            } else {
                videosWrap.appendChild(videoWrap);
            }
        });

        videosWrap.style.display = '';
    }

    // Populate images gallery
    function populateImagesGallery(itemElement, reportData) {
        const imagesWrap = DOM.$('[cms-deliver="images-wrap"]', itemElement);
        const reportImages = reportData.reportImages;
        const mainImage = reportData.photo?.url;

        if (!imagesWrap || !reportImages || reportImages.length === 0) {
            DOM.toggle(imagesWrap, false);
            return;
        }

        const allImages = [];
        const mainImageIsFirst = reportImages[0]?.url === mainImage;

        if (mainImage && !mainImageIsFirst && !reportImages.some(img => img.url === mainImage)) {
            allImages.push({
                url: mainImage,
                alt: reportData.name || 'Main image'
            });
        }

        allImages.push(...reportImages);

        const templateLightbox = DOM.$('.picturelightbox', imagesWrap);
        if (!templateLightbox) {
            console.warn('[CMS Client] No .picturelightbox template found');
            return;
        }

        DOM.$$('.picturelightbox', imagesWrap).forEach((lb, index) => {
            if (index > 0) lb.remove();
        });

        const galleryId = 'gallery-' + reportData.id;

        allImages.forEach((image, index) => {
            const lightbox = templateLightbox.cloneNode(true);

            const anchor = DOM.$('a[lightbox-image]', lightbox);
            const img = DOM.$('img', lightbox);

            if (anchor && img && image.url) {
                anchor.href = image.url;
                anchor.setAttribute('data-fancybox', galleryId);
                anchor.setAttribute('data-thumb', image.url);
                anchor.setAttribute('data-caption', image.alt || '');

                img.src = image.url;
                img.alt = image.alt || '';
                img.classList.remove('lazy', 'loading');
                img.removeAttribute('data-ll-status');
                img.loading = 'lazy';

                lightbox.style.display = '';

                if (index === 0) {
                    templateLightbox.replaceWith(lightbox);
                } else {
                    imagesWrap.appendChild(lightbox);
                }
            }
        });

        imagesWrap.style.display = '';

        if (typeof Fancybox !== 'undefined') {
            Fancybox.bind(`[data-fancybox="${galleryId}"]`, {
                Thumbs: { autoStart: true }
            });
        }
    }

    // Setup tab visibility for full type reports
    function setupFullTypeTabsVisibility(itemElement, reportData) {
        const itemType = itemElement.getAttribute('cms-item-type');
        if (itemType !== 'full') return;

        const hasDescription = reportData.description?.trim();
        const hasImages = reportData.reportImages?.length > 0;
        const hasVideos = reportData.videos?.length > 0;

        DOM.toggle(DOM.$('[data-tab="1"]', itemElement), !!hasDescription);
        DOM.toggle(DOM.$('[data-tab="2"]', itemElement), hasImages);
        DOM.toggle(DOM.$('[data-tab="3"]', itemElement), hasVideos);
        DOM.toggle(DOM.$('[data-tab="wrap"]', itemElement), true);

        DOM.$$('[data-tab-content]', itemElement).forEach(content => {
            content.style.display = 'none';
        });

        DOM.$$('[data-tab]', itemElement).forEach(tab => {
            tab.classList.remove('current');
        });

        const target = DOM.$('[open-target]', itemElement);
        if (target) {
            target.style.height = '0px';
            target.style.overflow = 'hidden';
        }

        itemElement.setAttribute('data-tabs-initialized', 'true');
    }

    // Setup tab visibility for mini type reports
    function setupMiniTypeTabsVisibility(itemElement, reportData) {
        const itemType = itemElement.getAttribute('cms-item-type');
        if (itemType === 'full') return;

        const hasImages = reportData.reportImages?.length > 0;
        const hasVideos = reportData.videos?.length > 0;

        DOM.toggle(DOM.$('[data-tab="2"]', itemElement), hasImages);
        DOM.toggle(DOM.$('[data-tab="3"]', itemElement), hasVideos);

        const tabsWrap = DOM.$('[data-tab="wrap"]', itemElement);
        if (tabsWrap) {
            tabsWrap.style.display = (!hasImages && !hasVideos) ? 'none' : '';
        }

        itemElement.setAttribute('data-tabs-initialized', 'true');
    }

    // Lazy load content for a report item
    function lazyLoadReportContent(itemElement) {
        if (itemElement.getAttribute('data-content-loaded') === 'true') return;

        const reportDataJson = itemElement.getAttribute('data-report-data');
        if (!reportDataJson) {
            console.warn('[CMS Client] No report data found for lazy loading');
            return;
        }

        try {
            const reportData = JSON.parse(reportDataJson);
            populateContent(itemElement, reportData, true);
            itemElement.setAttribute('data-content-loaded', 'true');
            log('Lazy loaded content for report:', reportData.name);
        } catch (error) {
            console.error('[CMS Client] Error lazy loading content:', error);
        }
    }

    // Main function to populate a report item
    function populateReportItem(itemElement, reportData, lazyLoadContent = true) {
        const successCount = populateBasicFields(itemElement, reportData);
        populateLocationFields(itemElement, reportData);
        populateReporterInfo(itemElement, reportData.reporters || []);

        const itemType = itemElement.getAttribute('cms-item-type');
        const isFullType = itemType === 'full';

        if (isFullType) {
            populatePerpetratorInfo(itemElement, reportData);
        }

        if (!lazyLoadContent) {
            populateContent(itemElement, reportData);
        } else {
            itemElement.setAttribute('data-report-data', JSON.stringify(reportData));
            itemElement.setAttribute('data-content-loaded', 'false');

            if (isFullType) {
                setupFullTypeTabsVisibility(itemElement, reportData);
            } else {
                setupMiniTypeTabsVisibility(itemElement, reportData);
            }
        }

        itemElement.setAttribute('data-report-id', reportData.id);
        itemElement.setAttribute('data-report-slug', reportData.slug || '');

        if (reportData.reporterEventLink) {
            itemElement.setAttribute('data-reporter-link', reportData.reporterEventLink);
        }

        itemElement.classList.remove('is--loading');
        itemElement.classList.add('is--loaded');

        return successCount > 0;
    }

    // Populate reports in the DOM (legacy mode - used when virtual scroll is disabled)
    async function populateReportsLegacy(items, listContainer, templateItem, appendMode = false) {
        if (!templateItem) {
            console.error('[CMS Client] Template item not found!');
            return 0;
        }

        if (!templateItem.classList.contains('cms-template-original')) {
            templateItem.classList.add('cms-template-original');
            templateItem.style.display = 'none';
        }

        if (!items || items.length === 0) {
            if (!appendMode) {
                DOM.$$('[cms-deliver="item"]:not(.cms-template-original)', listContainer)
                    .forEach(item => item.remove());

                const existingMsg = DOM.$('.no-search-results, .search-error', listContainer);
                if (existingMsg) existingMsg.remove();

                const noResultsMsg = DOM.create('div', {
                    className: 'no-search-results',
                    style: { padding: '40px 20px', textAlign: 'center', color: '#666' },
                    innerHTML: 'No reports match your filters'
                });

                const sentinel = DOM.$('[scroll-sentinel="true"]', listContainer);
                if (sentinel) {
                    listContainer.insertBefore(noResultsMsg, sentinel);
                } else {
                    listContainer.appendChild(noResultsMsg);
                }
            }
            return 0;
        }

        if (!appendMode) {
            DOM.$$('[cms-deliver="item"]:not(.cms-template-original)', listContainer)
                .forEach(item => item.remove());

            const existingMsg = DOM.$('.no-search-results, .search-error', listContainer);
            if (existingMsg) existingMsg.remove();
        }

        if (templateItem.parentNode !== listContainer) {
            console.error('[CMS Client] Template not in list container!');
            return 0;
        }

        const sentinel = DOM.$('[scroll-sentinel="true"]', listContainer);
        const fragment = document.createDocumentFragment();

        let successCount = 0;
        items.forEach((report, index) => {
            const newItem = templateItem.cloneNode(true);
            newItem.classList.remove('cms-template', 'is--loading', 'cms-template-original');
            newItem.style.display = '';

            if (populateReportItem(newItem, report)) {
                fragment.appendChild(newItem);
                successCount++;
            } else {
                console.warn(`[CMS Client] Failed to populate report ${index + 1}:`, report.name || 'Unknown');
            }
        });

        if (sentinel) {
            listContainer.insertBefore(fragment, sentinel);
        } else {
            listContainer.appendChild(fragment);
        }

        templateItem.style.display = 'none';

        console.log(`[CMS Client] Populated ${successCount} items in DOM`);

        return successCount;
    }

    // Populate reports using virtual scrolling
    async function populateReportsVirtual(items, listContainer, templateItem, appendMode = false) {
        if (!items || items.length === 0) {
            if (!appendMode) {
                Store.clearReports();
                VirtualScroller.refresh();

                const existingMsg = DOM.$('.no-search-results, .search-error', listContainer);
                if (existingMsg) existingMsg.remove();

                const noResultsMsg = DOM.create('div', {
                    className: 'no-search-results',
                    style: { padding: '40px 20px', textAlign: 'center', color: '#666' },
                    innerHTML: 'No reports match your filters'
                });

                const sentinel = DOM.$('[scroll-sentinel="true"]', listContainer);
                if (sentinel) {
                    listContainer.insertBefore(noResultsMsg, sentinel);
                } else {
                    listContainer.appendChild(noResultsMsg);
                }
            }
            return 0;
        }

        // Remove no results message if exists
        const existingMsg = DOM.$('.no-search-results, .search-error', listContainer);
        if (existingMsg) existingMsg.remove();

        // Add reports to the data store
        Store.addReports(items, !appendMode);

        // Initialize virtual scroller if not already done
        const scrollContainer = DOM.$('[cms-reports="scroll-wrap"]');
        if (!VirtualScroller.isInitialized) {
            VirtualScroller.init(scrollContainer, listContainer, templateItem);
        }

        // Refresh the virtual scroll to render visible items
        VirtualScroller.refresh();

        console.log(`[CMS Client] Virtual scroll: ${items.length} items added, total: ${Store.getReports().length}`);

        return items.length;
    }

    // Main populate function - delegates to virtual or legacy mode
    async function populateReports(items, listContainer, templateItem, appendMode = false) {
        if (Store.get('virtualScrollEnabled')) {
            return populateReportsVirtual(items, listContainer, templateItem, appendMode);
        } else {
            return populateReportsLegacy(items, listContainer, templateItem, appendMode);
        }
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

    // ===== TAG MANAGER =====
    const TagManager = {
        tagWrap: null,
        tagTemplate: null,

        init() {
            this.tagWrap = DOM.$('[cms-filter-element="tag-wrap"]');
            if (this.tagWrap) {
                this.tagTemplate = DOM.$('[cms-filter-element="tag"]', this.tagWrap);
                if (this.tagTemplate) {
                    this.tagTemplate.style.display = 'none';
                    this.tagTemplate.classList.add('tag-template');
                }

                // Event delegation for tag removal
                this.tagWrap.addEventListener('click', (e) => {
                    const removeBtn = e.target.closest('[cms-filter-element="tag-remove"]');
                    if (removeBtn) {
                        e.preventDefault();
                        e.stopPropagation();
                        const tag = removeBtn.closest('[cms-filter-element="tag"]');
                        if (tag && !tag.classList.contains('tag-template')) {
                            const filterKey = tag.getAttribute('data-filter-key');
                            const filterValue = tag.getAttribute('data-filter-value');
                            const isMultiValue = tag.hasAttribute('data-multi-value');

                            if (filterKey) {
                                if (isMultiValue) {
                                    this.removeAllValuesForKey(filterKey);
                                } else {
                                    this.removeTag(filterKey, filterValue);
                                }
                            }
                        }
                    }
                });
            }

            if (!this.tagWrap || !this.tagTemplate) {
                console.warn('[CMS Client] Tag elements not found');
            }
        },

        clearAllTags() {
            if (!this.tagWrap) return;
            DOM.$$('[cms-filter-element="tag"]:not(.tag-template)', this.tagWrap)
                .forEach(tag => tag.remove());
        },

        addTag(field, value, filterKey, individualValues = null) {
            if (!this.tagWrap || !this.tagTemplate) return;

            const tag = this.tagTemplate.cloneNode(true);
            tag.style.display = '';
            tag.classList.remove('tag-template');
            tag.setAttribute('data-filter-key', filterKey);
            tag.setAttribute('data-filter-value', value);

            if (individualValues?.length > 1) {
                tag.setAttribute('data-multi-value', 'true');
            }

            const fieldElements = DOM.$$('[cms-filter-element="tag-field"]', tag);
            if (fieldElements[0]) fieldElements[0].textContent = field;

            const valueElement = DOM.$('[cms-filter-element="tag-value"]', tag);
            if (valueElement) valueElement.textContent = value;

            this.tagWrap.appendChild(tag);
        },

        removeAllValuesForKey(filterKey) {
            Store.setState({ isClearing: true }, true);

            if (Array.isArray(Store.get('filters')[filterKey])) {
                Store.setFilter(filterKey, []);

                CheckboxUtils.findAll(filterKey).forEach(checkbox => {
                    if (checkbox.checked || CheckboxUtils.isChecked(checkbox)) {
                        CheckboxUtils.uncheck(checkbox);
                    }
                });
            }

            setTimeout(() => {
                Store.setState({ isClearing: false }, true);
                applyFilters();
            }, 20);
        },

        removeTag(filterKey, value) {
            const filters = Store.get('filters');

            if (filterKey === 'search') {
                Store.setFilter('search', '');
                const searchInput = DOM.$('[filter-reports="search"]');
                if (searchInput) searchInput.value = '';
            } else if (filterKey === 'dateFrom') {
                Store.setFilter('dateFrom', '');
                const dateInput = DOM.$('[cms-filter="From"]');
                if (dateInput) {
                    dateInput.value = '';
                    if (dateInput._flatpickr) dateInput._flatpickr.clear();
                }
            } else if (filterKey === 'dateUntil') {
                Store.setFilter('dateUntil', '');
                const dateInput = DOM.$('[cms-filter="Until"]');
                if (dateInput) {
                    dateInput.value = '';
                    if (dateInput._flatpickr) dateInput._flatpickr.clear();
                }
            } else if (Array.isArray(filters[filterKey])) {
                Store.setState({ isClearing: true }, true);

                const valuesToRemove = value.includes(',')
                    ? value.split(',').map(v => v.trim())
                    : [value];

                valuesToRemove.forEach(val => {
                    Store.removeFromFilter(filterKey, val);

                    const checkbox = CheckboxUtils.find(filterKey, val);
                    if (checkbox) {
                        CheckboxUtils.uncheck(checkbox);
                    }
                });

                setTimeout(() => {
                    Store.setState({ isClearing: false }, true);
                    applyFilters();
                }, 20);
                return;
            } else {
                Store.setFilter(filterKey, null);
            }

            applyFilters();
        },

        updateTags() {
            this.clearAllTags();

            const filters = Store.get('filters');

            if (filters.search) {
                this.addTag('Search', filters.search, 'search');
            }

            if (filters.dateFrom) {
                this.addTag('From', DateUtils.formatForTag(filters.dateFrom), 'dateFrom');
            }
            if (filters.dateUntil) {
                this.addTag('Until', DateUtils.formatForTag(filters.dateUntil), 'dateUntil');
            }

            ['topic', 'region', 'locality', 'territory', 'reporter'].forEach(filterKey => {
                if (filters[filterKey]?.length > 0) {
                    const fieldName = filterKey.charAt(0).toUpperCase() + filterKey.slice(1);
                    const values = filters[filterKey];

                    if (values.length === 1) {
                        this.addTag(fieldName, values[0], filterKey);
                    } else {
                        this.addTag(fieldName, values.join(', '), filterKey, values);
                    }
                }
            });

            if (filters.urgent !== null) {
                this.addTag('Urgent', filters.urgent ? 'Yes' : 'No', 'urgent');
            }
        }
    };

    // ===== FILTER SYSTEM =====

    // Build URL with current filters
    function buildFilterUrl(offset = 0, limit = CONFIG.REPORTS_LIMIT) {
        const filters = Store.get('filters');
        let url = `${CONFIG.WORKER_URL}/reports?limit=${limit}&offset=${offset}`;

        if (filters.search) {
            url += `&search=${encodeURIComponent(filters.search)}`;
        }

        if (filters.dateFrom) {
            url += `&dateFrom=${filters.dateFrom}`;
        }
        if (filters.dateUntil) {
            url += `&dateUntil=${filters.dateUntil}`;
        }

        ['topic', 'region', 'locality', 'territory', 'reporter'].forEach(filterKey => {
            if (filters[filterKey]?.length > 0) {
                url += `&${filterKey}=${encodeURIComponent(filters[filterKey].join(','))}`;
            }
        });

        if (filters.urgent !== null) {
            url += `&urgent=${filters.urgent}`;
        }

        url += `&_t=${Date.now()}`;

        return url;
    }

    // Apply current filters and reload reports
    async function applyFilters() {
        Store.resetPagination();
        Store.clearReports(); // Clear virtual scroll data
        TagManager.updateTags();

        const noMoreMsg = document.getElementById('no-more-reports');
        if (noMoreMsg) noMoreMsg.remove();

        const listContainer = DOM.$('[cms-deliver="list"]');
        const templateItem = listContainer?.querySelector('[cms-deliver="item"]');

        if (!listContainer || !templateItem) {
            console.error('[CMS Client] List container or template not found');
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

            Store.setState({
                currentOffset: CONFIG.REPORTS_LIMIT,
                totalReports: response_data.metadata?.total || items.length,
                hasMoreReports: CONFIG.REPORTS_LIMIT < (response_data.metadata?.total || items.length)
            }, true);

            await populateReports(items, listContainer, templateItem, false);

            updateResultsCount(Store.get('totalReports'));

            console.log(`[CMS Client] Filters applied: ${items.length} results (Total: ${Store.get('totalReports')})`);

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
        }
    }

    // Update results count display
    function updateResultsCount(count) {
        DOM.$$('[cms-filter-element="results-count"]').forEach(el => {
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

        initPicker('[cms-filter="From"]', 'dateFrom');
        initPicker('[cms-filter="Until"]', 'dateUntil');
    }

    // Initialize checkbox filters
    function initializeCheckboxFilters() {
        const filterForm = DOM.$('[cms-filter="form-block"]');
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
    function handleCheckboxChange(checkbox) {
        if (Store.get('isClearing')) return;

        if (checkbox.hasAttribute('data-processing')) return;
        checkbox.setAttribute('data-processing', 'true');

        setTimeout(() => {
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
        }, 10);
    }

    // Initialize clear buttons
    function initializeClearButtons() {
        DOM.$$('[cms-clear-element="all"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                clearAllFilters();
            });
        });

        DOM.$$('[cms-clear-element]').forEach(btn => {
            const clearTargets = btn.getAttribute('cms-clear-element');
            if (clearTargets === 'all') return;

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                clearTargets.split(',').map(t => t.trim()).forEach(clearSpecificFilter);
                setTimeout(() => applyFilters(), 10);
            });
        });
    }

    // Clear all filters
    function clearAllFilters() {
        Store.setState({ isClearing: true }, true);

        // Clear search
        Store.setFilter('search', '');
        const searchInput = DOM.$('[filter-reports="search"]');
        if (searchInput) searchInput.value = '';

        // Clear dates
        Store.setFilter('dateFrom', '');
        Store.setFilter('dateUntil', '');

        const fromInput = DOM.$('[cms-filter="From"]');
        const untilInput = DOM.$('[cms-filter="Until"]');
        if (fromInput) {
            fromInput.value = '';
            if (fromInput._flatpickr) fromInput._flatpickr.clear();
        }
        if (untilInput) {
            untilInput.value = '';
            if (untilInput._flatpickr) untilInput._flatpickr.clear();
        }

        // Clear arrays
        ['topic', 'region', 'locality', 'territory', 'reporter'].forEach(key => {
            Store.setFilter(key, []);
        });

        // Uncheck all checkboxes
        DOM.$$('input[type="checkbox"][cms-filter]').forEach(cb => {
            if (cb.checked || CheckboxUtils.isChecked(cb)) {
                CheckboxUtils.uncheck(cb);
            }
        });

        Store.setFilter('urgent', null);

        setTimeout(() => {
            Store.setState({ isClearing: false }, true);
            applyFilters();
        }, 20);
    }

    // Clear specific filter
    function clearSpecificFilter(filterName) {
        if (filterName === 'From') {
            Store.setFilter('dateFrom', '');
            const input = DOM.$('[cms-filter="From"]');
            if (input) {
                input.value = '';
                if (input._flatpickr) input._flatpickr.clear();
            }
        } else if (filterName === 'Until') {
            Store.setFilter('dateUntil', '');
            const input = DOM.$('[cms-filter="Until"]');
            if (input) {
                input.value = '';
                if (input._flatpickr) input._flatpickr.clear();
            }
        } else if (filterName === 'search') {
            Store.setFilter('search', '');
            const input = DOM.$('[filter-reports="search"]');
            if (input) input.value = '';
        } else {
            const filters = Store.get('filters');
            if (Array.isArray(filters[filterName])) {
                Store.setFilter(filterName, []);
                CheckboxUtils.findAll(filterName).forEach(cb => {
                    if (CheckboxUtils.isChecked(cb)) {
                        CheckboxUtils.uncheck(cb);
                        cb.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });
            } else {
                Store.setFilter(filterName, null);
            }
        }
    }

    // ===== INFINITE SCROLL =====

    async function loadMoreReports() {
        const state = Store.getState();
        if (state.isLoading || !state.hasMoreReports) {
            log('Skipping load more - isLoading:', state.isLoading, 'hasMoreReports:', state.hasMoreReports);
            return;
        }

        Store.setState({ isLoading: true }, true);
        log('Loading more reports...');

        const listContainer = DOM.$('[cms-deliver="list"]');
        const templateItem = listContainer?.querySelector('[cms-deliver="item"]');

        if (!listContainer || !templateItem) {
            console.error('[CMS Client] List container or template not found');
            Store.setState({ isLoading: false }, true);
            return;
        }

        showLoadingIndicator(listContainer);

        try {
            const newOffset = state.currentOffset + CONFIG.REPORTS_PER_PAGE;
            const url = buildFilterUrl(newOffset, CONFIG.REPORTS_PER_PAGE);
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const response_data = await response.json();
            const items = response_data.data || [];

            const successCount = await populateReports(items, listContainer, templateItem, true);

            const totalReports = response_data.metadata?.total || state.totalReports;
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
            Store.setState({ isLoading: false }, true);
        }
    }

    // ===== MAIN LOAD FUNCTION =====

    async function loadReports(initializeUI = true) {
        try {
            const listContainer = await DOM.waitFor('[cms-deliver="list"]', 5000);

            if (!listContainer) {
                console.error('[CMS Client] List container not found');
                return;
            }

            const templateItem = DOM.$('[cms-deliver="item"]', listContainer);

            if (!templateItem) {
                console.error('[CMS Client] Template item not found');
                return;
            }

            // Clear any existing reports data
            Store.clearReports();

            const response = await fetch(`${CONFIG.WORKER_URL}/reports?limit=${CONFIG.REPORTS_LIMIT}&_t=${Date.now()}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const response_data = await response.json();
            const items = response_data.data || [];

            const successCount = await populateReports(items, listContainer, templateItem);

            const totalReports = response_data.metadata?.total || items.length;
            Store.setState({
                currentOffset: CONFIG.REPORTS_LIMIT,
                totalReports,
                hasMoreReports: CONFIG.REPORTS_LIMIT < totalReports
            }, true);

            // Reset filters
            Store.resetFilters();

            updateResultsCount(totalReports);

            console.log(`[CMS Client] Loaded ${successCount} reports. Total: ${totalReports}`);

            if (totalReports <= 40 && Store.get('hasMoreReports')) {
                console.log(`[CMS Client] Total reports is ${totalReports}, loading all immediately`);
                setTimeout(() => {
                    if (Store.get('hasMoreReports') && !Store.get('isLoading')) {
                        loadMoreReports();
                    }
                }, 500);
            }

            if (initializeUI) {
                initializeInteractions();
                initializeInfiniteScroll(listContainer);
                initializeFilters();
            }

            window.dispatchEvent(new CustomEvent('cmsDataLoaded', {
                detail: { count: successCount, total: totalReports }
            }));

        } catch (error) {
            console.error('[CMS Client] Error:', error);

            const listContainer = DOM.$('[cms-deliver="list"]');
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
        initializeDatePickers();
        initializeCheckboxFilters();
        initializeClearButtons();
    }

    // ===== INTERACTION HANDLERS =====

    let interactionsInitialized = false;

    function initializeTabsAndAccordion() {
        if (interactionsInitialized) return;
        interactionsInitialized = true;

        // Tab switching - event delegation
        document.addEventListener('click', function(e) {
            const tab = e.target.closest('[data-tab]');
            if (!tab) return;

            e.preventDefault();
            const tabId = tab.getAttribute('data-tab');
            if (tabId === 'wrap') return;

            const container = tab.closest('[cms-deliver="item"]');
            if (!container) return;

            const itemType = container.getAttribute('cms-item-type');
            const isFullType = itemType === 'full';
            const target = DOM.$('[open-target]', container);
            const arrow = DOM.$('[dropdown-icon]', container);

            if (isFullType) {
                const isCurrentTab = tab.classList.contains('current');
                const isClosed = AccordionUtils.isClosed(target);

                if (isCurrentTab && !isClosed && target) {
                    tab.classList.remove('current');
                    AccordionUtils.close(target, arrow, container);

                    // Track collapsed state for virtual scrolling
                    const reportId = container.getAttribute('data-report-id');
                    if (reportId && VirtualScroller.isInitialized) {
                        VirtualScroller.onItemCollapsed(reportId);
                    }
                    return;
                }

                DOM.$$('[data-tab]', container).forEach(t => t.classList.remove('current'));
                tab.classList.add('current');

                DOM.$$('[data-tab-content]', container).forEach(content => {
                    content.style.display = content.getAttribute('data-tab-content') === tabId ? 'block' : 'none';
                });

                if (isClosed && target) {
                    if (container.getAttribute('data-content-loaded') !== 'true') {
                        lazyLoadReportContent(container);
                    }
                    AccordionUtils.open(target, arrow, container);

                    // Track expanded state for virtual scrolling
                    const reportId = container.getAttribute('data-report-id');
                    if (reportId && VirtualScroller.isInitialized) {
                        VirtualScroller.onItemExpanded(reportId);
                    }
                } else if (!AccordionUtils.isClosed(target)) {
                    AccordionUtils.adjustHeight(target);
                }
                return;
            }

            // Mini type behavior
            const isCurrentTab = tab.classList.contains('current');

            if (isCurrentTab) {
                AccordionUtils.close(target, arrow, container);

                // Track collapsed state for virtual scrolling
                const reportId = container.getAttribute('data-report-id');
                if (reportId && VirtualScroller.isInitialized) {
                    VirtualScroller.onItemCollapsed(reportId);
                }
                return;
            }

            DOM.$$('[data-tab]', container).forEach(t => t.classList.remove('current'));
            tab.classList.add('current');

            DOM.$$('[data-tab-content]', container).forEach(content => {
                content.style.display = content.getAttribute('data-tab-content') === tabId ? 'block' : 'none';
            });

            if (!AccordionUtils.isClosed(target)) {
                AccordionUtils.adjustHeight(target);
            }
        });

        // Accordion open/close - event delegation
        document.addEventListener('click', function(e) {
            const trigger = e.target.closest('[open-trigger]');
            if (!trigger) return;

            const clickedLink = e.target.closest('a');
            if (clickedLink && trigger.contains(clickedLink)) return;

            e.preventDefault();

            const container = trigger.closest('[cms-deliver="item"]');
            const target = DOM.$('[open-target]', container);
            const arrow = DOM.$('[dropdown-icon]', container);

            if (!target) return;

            const itemType = container?.getAttribute('cms-item-type');
            if (itemType === 'full') return;

            const isClosed = AccordionUtils.isClosed(target);
            const reportId = container.getAttribute('data-report-id');

            if (isClosed) {
                lazyLoadReportContent(container);
                AccordionUtils.open(target, arrow, container);

                // Track expanded state for virtual scrolling
                if (reportId && VirtualScroller.isInitialized) {
                    VirtualScroller.onItemExpanded(reportId);
                }
            } else {
                AccordionUtils.close(target, arrow, container);

                // Track collapsed state for virtual scrolling
                if (reportId && VirtualScroller.isInitialized) {
                    VirtualScroller.onItemCollapsed(reportId);
                }
            }
        });
    }

    function initializeScrollToTop() {
        const scrollWrap = DOM.$('[cms-reports="scroll-wrap"]');
        const jumpButton = DOM.$('[cms-reports="jump-to-top"]');

        if (!scrollWrap || !jumpButton) {
            console.warn('[CMS Client] Scroll-to-top elements not found');
            return;
        }

        // Add scrollbar styling
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

        jumpButton.style.opacity = '0';
        jumpButton.style.pointerEvents = 'none';

        scrollWrap.addEventListener('scroll', function() {
            const opacity = Math.min(this.scrollTop / 300, 1);
            jumpButton.style.opacity = opacity.toString();
            jumpButton.style.pointerEvents = opacity > 0 ? 'auto' : 'none';
        });

        jumpButton.addEventListener('click', (e) => {
            e.preventDefault();
            scrollWrap.scrollTo({ top: 0, behavior: 'smooth' });
        });

        console.log('[CMS Client] Scroll-to-top initialized');
    }

    // Share button functionality
    const shareButtonTimeouts = new Map();

    function initializeShareButtons() {
        document.addEventListener('click', async function(e) {
            const shareBtn = e.target.closest('[cms-action="share"]');
            if (!shareBtn) return;

            e.preventDefault();
            e.stopPropagation();

            const reportItem = shareBtn.closest('[cms-deliver="item"]');
            if (!reportItem) return;

            const reporterLink = reportItem.getAttribute('data-reporter-link');
            const reportSlug = reportItem.getAttribute('data-report-slug');
            const shareUrl = reporterLink || (reportSlug ? `https://occupationcrimes.org/report/${reportSlug}` : null);

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

    function initializeInteractions() {
        initializeTabsAndAccordion();
        initializeSearch();
        initializeScrollToTop();
        initializeShareButtons();
    }

    function initializeInfiniteScroll(listContainer) {
        const sentinel = DOM.$('[scroll-sentinel="true"]', listContainer);

        if (!sentinel) {
            console.error('[CMS Client] Scroll sentinel not found!');
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && Store.get('hasMoreReports') && !Store.get('isLoading')) {
                    log('Sentinel visible, loading more reports...');
                    loadMoreReports();
                }
            });
        }, {
            root: null,
            rootMargin: '500px',
            threshold: 0.1
        });

        observer.observe(sentinel);

        console.log('[CMS Client] Infinite scroll initialized');

        setTimeout(() => {
            const remaining = Store.get('totalReports') - Store.get('currentOffset');
            if (remaining > 0 && remaining <= 25 && Store.get('hasMoreReports')) {
                console.log(`[CMS Client] Auto-loading remaining ${remaining} reports`);
                loadMoreReports();
            }
        }, 1000);

        setTimeout(() => {
            if (Store.get('hasMoreReports') && !Store.get('isLoading')) {
                const viewportHeight = window.innerHeight;
                const documentHeight = document.documentElement.scrollHeight;

                if (viewportHeight > documentHeight * 0.5) {
                    console.log('[CMS Client] Viewport tall enough, loading more');
                    loadMoreReports();
                }
            }
        }, 100);
    }

    function initializeSearch() {
        const searchInput = DOM.$('[filter-reports="search"]');
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
        loadReports,
        Store,
        applyFilters,
        clearAllFilters,
        TagManager,
        VirtualScroller,
        checkElements() {
            const list = DOM.$('[cms-deliver="list"]');
            const item = DOM.$('[cms-deliver="item"]');
            const title = item ? DOM.$('[cms-field="title"]', item) : null;
            const mainImage = item ? DOM.$('[cms-content="main-image"]', item) : null;
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
        },
        // Virtual scroll utilities
        getVirtualScrollInfo() {
            return VirtualScroller.getDebugInfo();
        },
        enableVirtualScroll() {
            Store.setState({ virtualScrollEnabled: true }, true);
            console.log('[CMS Client] Virtual scroll enabled');
        },
        disableVirtualScroll() {
            Store.setState({ virtualScrollEnabled: false }, true);
            VirtualScroller.destroy();
            console.log('[CMS Client] Virtual scroll disabled - reload page to use legacy mode');
        },
        refreshVirtualScroll() {
            if (VirtualScroller.isInitialized) {
                VirtualScroller.refresh();
                console.log('[CMS Client] Virtual scroll refreshed');
            } else {
                console.log('[CMS Client] Virtual scroll not initialized');
            }
        },
        getReportsData() {
            return Store.getReports();
        }
    };

    console.log('[CMS Client] Mini Reports with Filters script loaded. Debug available at window.cmsDebug');

})();
