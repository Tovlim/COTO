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
        DEBUG: false
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
            viewMode: 'mini', // 'mini' or 'full'
            cachedReports: [] // Cache reports for view switching without re-fetch
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

    // ===== DOM BATCH UTILITIES =====
    // Batches DOM operations to minimize reflows/repaints
    const DOMBatch = {
        // Queue for deferred DOM operations
        _readQueue: [],
        _writeQueue: [],
        _scheduled: false,

        // Schedule a read operation (measurements)
        read(fn) {
            this._readQueue.push(fn);
            this._scheduleFlush();
        },

        // Schedule a write operation (mutations)
        write(fn) {
            this._writeQueue.push(fn);
            this._scheduleFlush();
        },

        // Schedule flush using requestAnimationFrame
        _scheduleFlush() {
            if (this._scheduled) return;
            this._scheduled = true;
            requestAnimationFrame(() => this._flush());
        },

        // Execute all queued operations: reads first, then writes
        _flush() {
            this._scheduled = false;

            // Execute all reads first (to avoid forced synchronous layouts)
            const reads = this._readQueue.slice();
            this._readQueue.length = 0;
            reads.forEach(fn => {
                try { fn(); } catch (e) { console.error('[DOMBatch] Read error:', e); }
            });

            // Then execute all writes
            const writes = this._writeQueue.slice();
            this._writeQueue.length = 0;
            writes.forEach(fn => {
                try { fn(); } catch (e) { console.error('[DOMBatch] Write error:', e); }
            });

            // If new operations were queued during execution, schedule another flush
            if (this._readQueue.length > 0 || this._writeQueue.length > 0) {
                this._scheduleFlush();
            }
        },

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
        },

        // Batch class operations on multiple elements
        batchClassList(elements, action, ...classNames) {
            const elementsArray = Array.from(elements);
            elementsArray.forEach(el => {
                if (el && el.classList) {
                    el.classList[action](...classNames);
                }
            });
        },

        // Batch style operations on multiple elements
        batchStyle(elements, styles) {
            const elementsArray = Array.from(elements);
            elementsArray.forEach(el => {
                if (el && el.style) {
                    Object.assign(el.style, styles);
                }
            });
        },

        // Batch attribute operations
        batchSetAttribute(elements, attr, value) {
            const elementsArray = Array.from(elements);
            elementsArray.forEach(el => {
                if (el) el.setAttribute(attr, value);
            });
        },

        // Prepare element offscreen before appending (reduces layout thrashing)
        prepareOffscreen(element, prepareFn) {
            // Temporarily hide to avoid intermediate repaints
            const originalDisplay = element.style.display;
            element.style.display = 'none';
            prepareFn(element);
            element.style.display = originalDisplay;
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
            const miniTemplate = listContainer?.querySelector('[cms-deliver="item"][cms-item-type="mini"]');
            const fullTemplate = listContainer?.querySelector('[cms-deliver="item"][cms-item-type="full"]');

            // Fallback: if no typed templates, use first item as mini
            if (!miniTemplate && !fullTemplate) {
                const defaultTemplate = listContainer?.querySelector('[cms-deliver="item"]');
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

    // ===== CMS LOADING INDICATOR =====
    function setCmsLoadingIndicator(show) {
        document.querySelectorAll('[cms-loading="indicator"]').forEach(el => {
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

            // Use requestAnimationFrame to batch visual updates
            requestAnimationFrame(() => {
                // Read phase: get scrollHeight
                const scrollHeight = target.scrollHeight;

                // Write phase: apply all style changes together
                requestAnimationFrame(() => {
                    if (!target.style.transition) {
                        target.style.transition = 'height 300ms ease';
                    }

                    target.style.height = scrollHeight + 'px';
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
                });
            });
        },

        close(target, arrow, container) {
            if (!target) return;

            // Clear any pending overflow timeout
            if (this._overflowTimeouts.has(container)) {
                clearTimeout(this._overflowTimeouts.get(container));
                this._overflowTimeouts.delete(container);
            }

            // Use requestAnimationFrame for batched visual update
            requestAnimationFrame(() => {
                if (!target.style.transition) {
                    target.style.transition = 'height 300ms ease';
                }

                // Batch all style mutations together
                target.style.height = '0px';
                target.style.overflow = 'hidden';
                if (arrow) arrow.style.transform = 'rotateZ(0deg)';
            });
        },

        isClosed(target) {
            return !target || target.style.height === '0px' ||
                   target.style.height === '0' || !target.style.height;
        },

        adjustHeight(target) {
            if (!target || this.isClosed(target)) return;

            // Use read/write pattern with requestAnimationFrame
            requestAnimationFrame(() => {
                // Read phase: measure current and new heights
                const currentHeight = target.offsetHeight;
                const originalTransition = target.style.transition;

                // Temporarily disable transition to measure
                target.style.transition = 'none';
                target.style.height = 'auto';
                const newHeight = target.scrollHeight;
                target.style.height = currentHeight + 'px';

                // Write phase: apply transition and new height
                requestAnimationFrame(() => {
                    target.style.transition = originalTransition || 'height 300ms ease';
                    target.style.height = newHeight + 'px';
                });
            });
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
        if (DOM.setImage(DOM.$('[cms-content="main-image"]', itemElement), reportData.photo?.url || '', reportData.name)) successCount++;

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

        // Batch remove existing except template
        const existingWraps = Array.from(DOM.$$('[cms-deliver="video-wrap"]', videosWrap));
        DOMBatch.removeAll(existingWraps.slice(1));

        // Build all video elements first
        const videoElements = [];
        let firstVideoWrap = null;

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
                firstVideoWrap = videoWrap;
            } else {
                videoElements.push(videoWrap);
            }
        });

        // Single batch DOM update
        if (firstVideoWrap) {
            templateVideoWrap.replaceWith(firstVideoWrap);
        }
        if (videoElements.length > 0) {
            const fragment = DOMBatch.createFragment(videoElements);
            videosWrap.appendChild(fragment);
        }

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

        // Batch remove existing lightboxes except template
        const existingLightboxes = Array.from(DOM.$$('.picturelightbox', imagesWrap));
        DOMBatch.removeAll(existingLightboxes.slice(1));

        const galleryId = 'gallery-' + reportData.id;

        // Build all lightbox elements first
        const lightboxElements = [];
        let firstLightbox = null;

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
                    firstLightbox = lightbox;
                } else {
                    lightboxElements.push(lightbox);
                }
            }
        });

        // Single batch DOM update
        if (firstLightbox) {
            templateLightbox.replaceWith(firstLightbox);
        }
        if (lightboxElements.length > 0) {
            const fragment = DOMBatch.createFragment(lightboxElements);
            imagesWrap.appendChild(fragment);
        }

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
                    DOM.$$('[cms-deliver="item"]:not(.cms-template-original)', listContainer)
                );

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
            // Batch remove all existing items
            DOMBatch.removeAll(
                DOM.$$('[cms-deliver="item"]:not(.cms-template-original)', listContainer)
            );

            const existingMsg = DOM.$('.no-search-results, .search-error', listContainer);
            if (existingMsg) existingMsg.remove();
        }

        // Note: templateItem may be a cloned template from TemplateManager (not in DOM)
        // so we no longer require it to be in listContainer - we just use it as a clone source

        const sentinel = DOM.$('[scroll-sentinel="true"]', listContainer);

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
                DOM.$$('[cms-filter]', wrapper).forEach(el => {
                    const filterAttr = el.getAttribute('cms-filter');
                    if (filterAttr) {
                        // Map attribute names to Store filter keys
                        const keyMap = {
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
                if (DOM.$('[filter-reports="search"]', wrapper)) {
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
        TagManager.updateTags();
        setCmsLoadingIndicator(true);

        const noMoreMsg = document.getElementById('no-more-reports');
        if (noMoreMsg) noMoreMsg.remove();

        const listContainer = DOM.$('[cms-deliver="list"]');
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
        } finally {
            setCmsLoadingIndicator(false);
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
        setCmsLoadingIndicator(true);
        log('Loading more reports...');

        const listContainer = DOM.$('[cms-deliver="list"]');
        const templateItem = TemplateManager.getActiveTemplate();

        if (!listContainer || !templateItem) {
            console.error('[CMS Client] List container or template not found');
            Store.setState({ isLoading: false }, true);
            setCmsLoadingIndicator(false);
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

            // Append to cached reports for view switching
            const currentCached = Store.get('cachedReports') || [];
            Store.setState({ cachedReports: [...currentCached, ...items] }, true);

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
            setCmsLoadingIndicator(false);
            Store.setState({ isLoading: false }, true);
        }
    }

    // ===== MAIN LOAD FUNCTION =====

    async function loadReports(initializeUI = true) {
        setCmsLoadingIndicator(true);
        try {
            const listContainer = await DOM.waitFor('[cms-deliver="list"]', 5000);

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

            const response = await fetch(`${CONFIG.WORKER_URL}/reports?limit=${CONFIG.REPORTS_LIMIT}&_t=${Date.now()}`);

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

            setCmsLoadingIndicator(false);
            window.dispatchEvent(new CustomEvent('cmsDataLoaded', {
                detail: { count: successCount, total: totalReports }
            }));

        } catch (error) {
            console.error('[CMS Client] Error:', error);
            setCmsLoadingIndicator(false);

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
        FilterIndicators.init();
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
                } else if (!AccordionUtils.isClosed(target)) {
                    AccordionUtils.adjustHeight(target);
                }
                return;
            }

            // Mini type behavior
            const isCurrentTab = tab.classList.contains('current');

            if (isCurrentTab) {
                AccordionUtils.close(target, arrow, container);
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

            if (isClosed) {
                lazyLoadReportContent(container);
                AccordionUtils.open(target, arrow, container);
            } else {
                AccordionUtils.close(target, arrow, container);
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
        initializeViewToggle();
    }

    // ===== VIEW TOGGLE =====
    function initializeViewToggle() {
        const toggleButtons = DOM.$$('[cms-view-toggle]');

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

        // Set initial margin class based on default view mode
        const listContainer = DOM.$('[cms-deliver="list"]');
        if (listContainer && Store.get('viewMode') === 'mini') {
            listContainer.classList.add('is-mini-reports');
        }

        // Event delegation for toggle clicks
        document.addEventListener('click', function(e) {
            const toggleBtn = e.target.closest('[cms-view-toggle]');
            if (!toggleBtn) return;

            e.preventDefault();

            const targetMode = toggleBtn.getAttribute('cms-view-toggle');
            const currentMode = Store.get('viewMode');

            if (targetMode === currentMode) return;

            if (targetMode === 'mini' || targetMode === 'full') {
                switchView(targetMode);
            } else {
                // Toggle between modes if no specific target
                switchView(currentMode === 'mini' ? 'full' : 'mini');
            }
        });

        console.log('[CMS Client] View toggle initialized');
    }

    function updateToggleButtonStates() {
        const currentMode = Store.get('viewMode');

        DOM.$$('[cms-view-toggle]').forEach(btn => {
            const btnMode = btn.getAttribute('cms-view-toggle');

            if (btnMode === currentMode) {
                btn.classList.add('is--active');
            } else {
                btn.classList.remove('is--active');
            }
        });
    }

    // Find the report ID of the topmost visible report item
    function getTopVisibleReportId() {
        const listContainer = DOM.$('[cms-deliver="list"]');
        if (!listContainer) return null;

        // Get the scroll container (could be the list itself or a parent wrapper)
        const scrollWrap = DOM.$('[cms-reports="scroll-wrap"]') || listContainer;
        const containerRect = scrollWrap.getBoundingClientRect();

        const items = DOM.$$('[cms-deliver="item"]:not(.cms-template-original)', listContainer);
        let topVisibleId = null;
        let smallestOffset = Infinity;

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

        return topVisibleId;
    }

    // Scroll to a specific report by ID
    function scrollToReportId(reportId) {
        if (!reportId) return;

        const listContainer = DOM.$('[cms-deliver="list"]');
        if (!listContainer) return;

        const targetItem = DOM.$(`[data-report-id="${reportId}"]`, listContainer);
        if (!targetItem) {
            console.log(`[CMS Client] Could not find report ${reportId} to scroll to`);
            return;
        }

        // Use the scroll wrapper if available
        const scrollWrap = DOM.$('[cms-reports="scroll-wrap"]');

        if (scrollWrap) {
            // Calculate the item's position relative to the scroll container
            const containerRect = scrollWrap.getBoundingClientRect();
            const itemRect = targetItem.getBoundingClientRect();
            const currentScrollTop = scrollWrap.scrollTop;
            const offsetFromContainer = itemRect.top - containerRect.top + currentScrollTop;

            scrollWrap.scrollTo({
                top: offsetFromContainer,
                behavior: 'instant' // Use instant for view switch to avoid jarring animation
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
        const listContainer = DOM.$('[cms-deliver="list"]');
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
        DOMBatch,
        applyFilters,
        clearAllFilters,
        TagManager,
        FilterIndicators,
        TemplateManager,
        switchView,
        getViewMode: () => Store.get('viewMode'),
        setViewMode: (mode) => switchView(mode),
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
        }
    };

    console.log('[CMS Client] Mini Reports with Filters script loaded. Debug available at window.cmsDebug');

})();
