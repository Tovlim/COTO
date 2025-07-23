// FIXED: Optimized Autocomplete - No Duplicates
// Replace your existing autocomplete script with this fixed version

class OptimizedIntegratedAutocomplete {
    constructor(options = {}) {
        this.elementIds = {
            inputId: options.inputId || "refresh-on-enter",
            listId: options.listId || "search-terms",
            wrapperId: options.wrapperId || "searchTermsWrapper",
            clearId: options.clearId || "searchclear"
        };
        
        // Cache DOM elements
        this.elements = {
            input: document.getElementById(this.elementIds.inputId),
            list: document.getElementById(this.elementIds.listId),
            wrapper: document.getElementById(this.elementIds.wrapperId),
            clear: document.getElementById(this.elementIds.clearId)
        };
        
        // Configuration
        this.dataSource = options.dataSource || "cms-filter-lists";
        this.sourceClass = options.sourceClass || "autofill-title";
        this.dataField = options.dataField || "names";
        this.debounceDelay = options.debounceDelay || 150;
        
        // Optimized data structures
        this.searchData = {
            rawTerms: new Set(),
            normalizedTerms: new Map(),
            searchIndex: new Map(),
            filteredCache: new Map()
        };
        
        // Performance tracking
        this.cache = {
            positioning: null,
            lastFilter: '',
            lastResults: [],
            visibleItems: new Set()
        };
        
        // Event management
        this.eventHandlers = new Map();
        this.debounceTimers = new Map();
        
        // Integration detection
        this.isMapboxIntegration = typeof window.isMarkerClick !== 'undefined';
        
        if (this.elements.input && this.elements.list && this.elements.wrapper) {
            this.init();
        }
    }
    
    init() {
        this.applyOptimizedStyles();
        this.collectAndProcessTerms();
        this.createOptimizedDropdown();
        this.setupOptimizedEventListeners();
        this.hideDropdown();
        
        console.log(`Optimized autocomplete: ${this.searchData.rawTerms.size} unique terms, ${this.searchData.searchIndex.size} index buckets`);
    }
    
    // FIXED: Use map script's function if available (prevents duplicates)
    getAvailableFilterLists() {
        // Check if map script has this function available
        if (window.mapUtilities && typeof window.mapUtilities.getAvailableFilterLists === 'function') {
            return window.mapUtilities.getAvailableFilterLists();
        }
        
        // Fallback to own implementation
        if (this._cachedFilterLists) {
            return this._cachedFilterLists;
        }
        
        const lists = [];
        const maxCheck = 20;
        
        for (let i = 1; i <= maxCheck; i++) {
            const listId = `cms-filter-list-${i}`;
            if (document.getElementById(listId)) {
                lists.push(listId);
            } else if (i > 5 && lists.length === 0) {
                break;
            }
        }
        
        this._cachedFilterLists = lists;
        return lists;
    }
    
    applyOptimizedStyles() {
        this.elements.input.setAttribute('autocomplete', 'off');
        this.elements.input.setAttribute('spellcheck', 'false');
        
        const wrapperStyles = {
            position: 'fixed',
            zIndex: '999999',
            display: 'none',
            visibility: 'visible',
            opacity: '1',
            transform: 'none',
            minWidth: '200px',
            maxWidth: '400px',
            overflow: 'hidden',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
        };
        
        Object.assign(this.elements.wrapper.style, wrapperStyles);
        
        if (!document.querySelector(`#${this.elementIds.wrapperId}-scrollbar-style`)) {
            const style = document.createElement('style');
            style.id = `${this.elementIds.wrapperId}-scrollbar-style`;
            style.textContent = `#${this.elementIds.wrapperId}::-webkit-scrollbar { display: none; }`;
            document.head.appendChild(style);
        }
    }
    
    // HEAVILY OPTIMIZED: Pre-process all data with smart deduplication
    collectAndProcessTerms() {
        const startTime = performance.now();
        
        // Clear existing data
        this.searchData.rawTerms.clear();
        this.searchData.normalizedTerms.clear();
        this.searchData.searchIndex.clear();
        this.searchData.filteredCache.clear();
        
        if (this.dataSource === "cms-filter-lists") {
            this.collectFromFilterLists();
        } else {
            this.collectFromClassElements();
        }
        
        // Build optimized search index
        this.buildSearchIndex();
        
        console.log(`Autocomplete data processing: ${performance.now() - startTime}ms for ${this.searchData.rawTerms.size} unique terms`);
    }
    
    // FIXED: Smart collection that avoids dynamically generated elements AND prevents duplicates
    collectFromFilterLists() {
        const lists = this.getAvailableFilterLists();
        const selectors = [];
        
        // Build selectors based on data field
        if (this.dataField === "names" || this.dataField === "both") {
            selectors.push('.data-places-names-filter');
        }
        if (this.dataField === "districts" || this.dataField === "both") {
            selectors.push('.data-places-district-filter');
        }
        
        // FIXED: Track processed elements to avoid duplicates
        const processedElements = new Set();
        
        // FIXED: Only collect from original CMS data, skip dynamically generated checkboxes
        lists.forEach(listId => {
            const container = document.getElementById(listId);
            if (!container) return;
            
            const allElements = container.querySelectorAll(selectors.join(', '));
            for (const element of allElements) {
                // FIXED: Skip elements that are inside dynamically generated checkboxes
                const isInGeneratedCheckbox = element.closest('[checkbox-filter="locality"]') || 
                                            element.closest('#locality-check-list') ||
                                            element.closest('[data-generated="true"]');
                if (isInGeneratedCheckbox) {
                    continue;
                }
                
                // FIXED: Skip already processed elements (prevents duplicates from multiple sources)
                const elementKey = `${element.tagName}-${element.textContent.trim()}-${element.className}`;
                if (processedElements.has(elementKey)) {
                    continue;
                }
                processedElements.add(elementKey);
                
                const term = element.textContent.trim();
                if (term && term.length > 0) {
                    this.addTermToIndex(term);
                }
            }
        });
        
        console.log(`Collected from CMS lists (excluding generated checkboxes): ${this.searchData.rawTerms.size} unique terms`);
    }
    
    collectFromClassElements() {
        const elements = document.getElementsByClassName(this.sourceClass);
        const processedTerms = new Set();
        
        for (const element of elements) {
            const term = element.textContent.trim();
            if (term && term.length > 0 && !processedTerms.has(term)) {
                processedTerms.add(term);
                this.addTermToIndex(term);
            }
        }
    }
    
    // FIXED: Enhanced deduplication with better normalization
    addTermToIndex(term) {
        const cleanTerm = term.trim();
        if (!cleanTerm || this.searchData.rawTerms.has(cleanTerm)) return;
        
        this.searchData.rawTerms.add(cleanTerm);
        const normalized = this.normalizeText(cleanTerm);
        
        // Don't overwrite if normalized version already exists
        if (!this.searchData.normalizedTerms.has(normalized)) {
            this.searchData.normalizedTerms.set(normalized, cleanTerm);
        }
    }
    
    normalizeText(text) {
        return text.toLowerCase().trim().replace(/\s+/g, ' ');
    }
    
    buildSearchIndex() {
        this.searchData.normalizedTerms.forEach((original, normalized) => {
            const firstChar = normalized.charAt(0);
            const firstTwo = normalized.substring(0, 2);
            
            if (!this.searchData.searchIndex.has(firstChar)) {
                this.searchData.searchIndex.set(firstChar, new Set());
            }
            if (!this.searchData.searchIndex.has(firstTwo)) {
                this.searchData.searchIndex.set(firstTwo, new Set());
            }
            
            this.searchData.searchIndex.get(firstChar).add(original);
            this.searchData.searchIndex.get(firstTwo).add(original);
        });
    }
    
    // FIXED: Clear existing list before creating new dropdown (prevents duplicates)
    createOptimizedDropdown() {
        if (this.searchData.rawTerms.size === 0) return;
        
        // FIXED: Clear existing list first to prevent duplicates
        this.elements.list.innerHTML = '';
        
        const fragment = document.createDocumentFragment();
        const sortedTerms = Array.from(this.searchData.rawTerms).sort();
        
        // FIXED: Track added terms to prevent UI duplicates
        const addedTerms = new Set();
        
        sortedTerms.forEach(term => {
            if (!addedTerms.has(term)) {
                addedTerms.add(term);
                const li = document.createElement('li');
                li.innerHTML = `<a href="#" class="list-term" data-term="${this.escapeHtml(term)}">${this.escapeHtml(term)}</a>`;
                fragment.appendChild(li);
            }
        });
        
        this.elements.list.appendChild(fragment);
        console.log(`Dropdown created with ${addedTerms.size} unique terms`);
    }
    
    escapeHtml(text) {
        const escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return text.replace(/[&<>"']/g, match => escapeMap[match]);
    }
    
    setupOptimizedEventListeners() {
        const debouncedInput = this.createOptimizedDebouncer(
            (e) => this.handleInput(e), 
            this.debounceDelay,
            'input'
        );
        
        this.attachEventHandler('input', 'input', debouncedInput);
        this.attachEventHandler('input', 'keyup', debouncedInput);
        this.attachEventHandler('input', 'focus', () => this.handleFocus());
        this.attachEventHandler('input', 'keydown', (e) => this.handleKeydown(e));
        this.attachEventHandler('list', 'click', (e) => this.handleDropdownClick(e));
        this.attachEventHandler('document', 'click', (e) => this.handleOutsideClick(e));
        
        if (this.elements.clear) {
            this.attachEventHandler('clear', 'click', () => this.handleClear());
        }
    }
    
    attachEventHandler(elementKey, eventType, handler) {
        const element = elementKey === 'document' ? document : this.elements[elementKey];
        if (!element) return;
        
        element.addEventListener(eventType, handler);
        
        const handlerKey = `${elementKey}-${eventType}`;
        this.eventHandlers.set(handlerKey, { element, eventType, handler });
    }
    
    createOptimizedDebouncer(func, delay, timerId) {
        return (...args) => {
            const existingTimer = this.debounceTimers.get(timerId);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }
            
            const timer = setTimeout(() => {
                this.debounceTimers.delete(timerId);
                func.apply(this, args);
            }, delay);
            
            this.debounceTimers.set(timerId, timer);
        };
    }
    
    handleInput(e) {
        const value = this.elements.input.value.trim();
        if (value.length === 0) {
            this.hideDropdown();
        } else {
            this.optimizedFilterAndShow(value);
        }
    }
    
    handleFocus() {
        const value = this.elements.input.value.trim();
        if (value.length > 0) {
            this.optimizedFilterAndShow(value);
        }
    }
    
    handleDropdownClick(e) {
        if (e.target.classList.contains('list-term')) {
            e.preventDefault();
            e.stopPropagation();
            this.selectTerm(e.target.getAttribute('data-term'));
        }
    }
    
    handleClear() {
        if (this.elements.input.value) {
            this.elements.input.value = '';
            this.hideDropdown();
            this.triggerSearchEvents();
            this.elements.input.focus();
        }
    }
    
    handleOutsideClick(e) {
        if (!this.elements.input.contains(e.target) && 
            !this.elements.wrapper.contains(e.target) && 
            e.target !== this.elements.clear) {
            this.hideDropdown();
        }
    }
    
    handleKeydown(e) {
        if (this.elements.wrapper.style.display === 'none') return;
        
        const visibleItems = this.getVisibleItems();
        const currentActive = this.elements.list.querySelector('.list-term.active');
        let activeIndex = currentActive ? visibleItems.indexOf(currentActive) : -1;
        
        switch(e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.setActiveItem(visibleItems, Math.min(activeIndex + 1, visibleItems.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.setActiveItem(visibleItems, Math.max(activeIndex - 1, 0));
                break;
            case 'Enter':
                if (currentActive) {
                    e.preventDefault();
                    this.selectTerm(currentActive.getAttribute('data-term'));
                }
                break;
            case 'Escape':
                this.hideDropdown();
                this.elements.input.blur();
                break;
        }
    }
    
    getVisibleItems() {
        return Array.from(this.elements.list.querySelectorAll('li:not([style*="display: none"]) .list-term'));
    }
    
    setActiveItem(items, index) {
        requestAnimationFrame(() => {
            items.forEach(item => item.classList.remove('active'));
            if (items[index]) {
                items[index].classList.add('active');
                items[index].scrollIntoView({ block: 'nearest' });
            }
        });
    }
    
    optimizedFilterAndShow(filter) {
        const startTime = performance.now();
        
        const normalizedFilter = this.normalizeText(filter);
        if (this.searchData.filteredCache.has(normalizedFilter)) {
            this.showCachedResults(normalizedFilter);
            return;
        }
        
        const matchingTerms = this.getMatchingTermsFromIndex(normalizedFilter);
        this.searchData.filteredCache.set(normalizedFilter, matchingTerms);
        
        this.updatePositioning();
        this.updateVisibleItems(matchingTerms);
        
        const hasResults = matchingTerms.length > 0;
        this.elements.wrapper.style.display = hasResults ? 'block' : 'none';
        
        console.log(`Autocomplete filter "${filter}": ${performance.now() - startTime}ms, ${matchingTerms.length} unique results`);
    }
    
    getMatchingTermsFromIndex(normalizedFilter) {
        const candidateTerms = new Set();
        
        const firstChar = normalizedFilter.charAt(0);
        const firstTwo = normalizedFilter.substring(0, 2);
        
        if (this.searchData.searchIndex.has(firstTwo)) {
            this.searchData.searchIndex.get(firstTwo).forEach(term => candidateTerms.add(term));
        } else if (this.searchData.searchIndex.has(firstChar)) {
            this.searchData.searchIndex.get(firstChar).forEach(term => candidateTerms.add(term));
        } else {
            this.searchData.rawTerms.forEach(term => candidateTerms.add(term));
        }
        
        const results = [];
        const normalizedFilterUpper = normalizedFilter.toUpperCase();
        
        for (const term of candidateTerms) {
            if (term.toUpperCase().includes(normalizedFilterUpper)) {
                results.push(term);
            }
        }
        
        return [...new Set(results)].sort(); // FIXED: Additional deduplication
    }
    
    showCachedResults(normalizedFilter) {
        const cachedResults = this.searchData.filteredCache.get(normalizedFilter);
        this.updatePositioning();
        this.updateVisibleItems(cachedResults);
        this.elements.wrapper.style.display = cachedResults.length > 0 ? 'block' : 'none';
    }
    
    updatePositioning() {
        if (!this.cache.positioning) {
            const inputRect = this.elements.input.getBoundingClientRect();
            const wrapperElement = this.findWrapperElement();
            const wrapperRect = wrapperElement ? wrapperElement.getBoundingClientRect() : inputRect;
            
            this.cache.positioning = {
                left: wrapperRect.left,
                width: wrapperRect.width,
                inputBottom: inputRect.bottom + window.scrollY + 4
            };
        }
        
        const pos = this.cache.positioning;
        Object.assign(this.elements.wrapper.style, {
            top: pos.inputBottom + 'px',
            left: pos.left + 'px',
            width: pos.width + 'px'
        });
    }
    
    findWrapperElement() {
        if (this._cachedWrapperElement !== undefined) {
            return this._cachedWrapperElement;
        }
        
        let wrapperElement = document.getElementById('refresh-on-enter-wrapper');
        
        if (!wrapperElement) {
            let parent = this.elements.input.parentElement;
            while (parent && parent !== document.body) {
                const className = parent.className.toLowerCase();
                if (className.includes('wrapper') || className.includes('container')) {
                    wrapperElement = parent;
                    break;
                }
                parent = parent.parentElement;
            }
        }
        
        this._cachedWrapperElement = wrapperElement;
        return wrapperElement;
    }
    
    // FIXED: Enhanced visibility update with better duplicate prevention
    updateVisibleItems(matchingTerms) {
        const matchingSet = new Set(matchingTerms);
        const listItems = Array.from(this.elements.list.getElementsByTagName("li"));
        
        const toShow = [];
        const toHide = [];
        const seenTerms = new Set(); // FIXED: Track terms to prevent visual duplicates
        
        listItems.forEach(li => {
            const term = li.textContent.trim();
            const shouldShow = matchingSet.has(term) && !seenTerms.has(term);
            const isCurrentlyVisible = li.style.display !== 'none';
            
            if (shouldShow) {
                seenTerms.add(term); // FIXED: Mark term as seen
                if (!isCurrentlyVisible) {
                    toShow.push(li);
                }
            } else {
                if (isCurrentlyVisible) {
                    toHide.push(li);
                }
            }
        });
        
        if (toShow.length || toHide.length) {
            requestAnimationFrame(() => {
                toShow.forEach(li => li.style.display = 'block');
                toHide.forEach(li => li.style.display = 'none');
                
                this.elements.list.querySelectorAll('.list-term.active')
                    .forEach(item => item.classList.remove('active'));
            });
        }
    }
    
    hideDropdown() {
        this.elements.wrapper.style.display = 'none';
        this.elements.list.querySelectorAll('.list-term.active')
            .forEach(item => item.classList.remove('active'));
    }
    
    selectTerm(term) {
        this.elements.input.value = term;
        this.hideDropdown();
        this.triggerSearchEvents();
        
        if (this.isMapboxIntegration && window.isMarkerClick) return;
        setTimeout(() => this.elements.input.focus(), 50);
    }
    
    triggerSearchEvents() {
        const events = ['input', 'change', 'keyup'];
        events.forEach(eventType => {
            this.elements.input.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
        });
        
        const form = this.elements.input.closest('form');
        if (form) {
            form.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        }
        
        if (window.fsAttributes?.cmsfilter) {
            setTimeout(() => {
                window.fsAttributes.cmsfilter.reload();
                ['fs-cmsfilter-change', 'fs-cmsfilter-search'].forEach(type => {
                    document.dispatchEvent(new CustomEvent(type, {
                        bubbles: true,
                        detail: { value: this.elements.input.value }
                    }));
                });
            }, 25);
        }
    }
    
    // FIXED: Smart refresh that properly clears everything and rebuilds
    smartRefresh() {
        const startTime = performance.now();
        console.log('Smart refreshing autocomplete (avoiding duplicates)...');
        
        const previousSize = this.searchData.rawTerms.size;
        
        // Clear all caches
        this.searchData.filteredCache.clear();
        this.cache.positioning = null;
        this._cachedFilterLists = null;
        this._cachedWrapperElement = undefined;
        
        // Collect new terms (will automatically deduplicate)
        this.collectAndProcessTerms();
        
        // FIXED: Always rebuild dropdown to ensure no duplicates
        this.createOptimizedDropdown();
        console.log(`Autocomplete dropdown rebuilt: ${previousSize} -> ${this.searchData.rawTerms.size} unique terms`);
        
        console.log(`Autocomplete smart refresh completed in ${performance.now() - startTime}ms`);
    }
    
    destroy() {
        console.log('Cleaning up autocomplete...');
        
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
        
        this.eventHandlers.forEach(({ element, eventType, handler }) => {
            element.removeEventListener(eventType, handler);
        });
        this.eventHandlers.clear();
        
        this.searchData.rawTerms.clear();
        this.searchData.normalizedTerms.clear();
        this.searchData.searchIndex.clear();
        this.searchData.filteredCache.clear();
        
        this.cache = {};
        
        console.log('Autocomplete cleanup completed');
    }
    
    getPerformanceStats() {
        return {
            totalTerms: this.searchData.rawTerms.size,
            indexBuckets: this.searchData.searchIndex.size,
            cachedResults: this.searchData.filteredCache.size,
            eventHandlers: this.eventHandlers.size,
            activeTimers: this.debounceTimers.size
        };
    }
}

// FIXED: Prevent multiple instances and ensure clean initialization
function initOptimizedAutocomplete() {
    // FIXED: Prevent multiple instances
    if (window.integratedAutocomplete) {
        console.log('Autocomplete already initialized, skipping...');
        return;
    }
    
    const initDelay = window.fsAttributes ? 300 : 100;
    
    setTimeout(() => {
        // FIXED: Double-check before creating new instance
        if (window.integratedAutocomplete) {
            return;
        }
        
        window.integratedAutocomplete = new OptimizedIntegratedAutocomplete({
            inputId: "refresh-on-enter",
            listId: "search-terms", 
            wrapperId: "searchTermsWrapper",
            clearId: "searchclear",
            dataSource: "cms-filter-lists",
            dataField: "names",
            debounceDelay: 100
        });
        
        window.refreshAutocomplete = () => {
            if (window.integratedAutocomplete) {
                window.integratedAutocomplete.smartRefresh();
            }
        };
        
        window.getAutocompleteStats = () => {
            if (window.integratedAutocomplete) {
                return window.integratedAutocomplete.getPerformanceStats();
            }
        };
        
        // FIXED: Don't auto-refresh when checkboxes are generated (prevents duplicates)
        if (window.checkboxFilterScript) {
            const originalRecache = window.checkboxFilterScript.recacheElements;
            window.checkboxFilterScript.recacheElements = function() {
                originalRecache.call(this);
                // Removed automatic autocomplete refresh to prevent duplicates
                console.log('Checkbox filter recached - autocomplete not refreshed to avoid duplicates');
            };
        }
        
        // Auto-refresh only on actual CMS filter changes (not checkbox generation)
        if (typeof window.fsAttributes !== 'undefined') {
            document.addEventListener('fs-cmsfilter-filtered', (e) => {
                // Only refresh if it's not from our generated checkboxes
                if (!e.detail || !e.detail.fromGeneratedCheckboxes) {
                    setTimeout(() => window.refreshAutocomplete?.(), 50);
                }
            });
        }
        
        console.log('Autocomplete initialized successfully - no duplicates');
        
    }, initDelay);
}

// FIXED: Better initialization sequence
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOptimizedAutocomplete);
} else {
    initOptimizedAutocomplete();
}

window.addEventListener('load', () => {
    if (!window.integratedAutocomplete) {
        initOptimizedAutocomplete();
    }
});
