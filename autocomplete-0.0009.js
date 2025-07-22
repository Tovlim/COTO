// Integrated Autocomplete 2025 - HEAVILY OPTIMIZED
// Add this script before the closing </body> tag

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
            normalizedTerms: new Map(), // normalized -> original
            searchIndex: new Map(), // first char -> terms array
            filteredCache: new Map() // search term -> filtered results
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
        
        console.log(`Optimized autocomplete: ${this.searchData.rawTerms.size} terms, ${this.searchData.searchIndex.size} index buckets`);
    }
    
    // OPTIMIZED: Share utility with map script if available
    getAvailableFilterLists() {
        // Check if map script has this function available
        if (window.mapUtilities && typeof window.mapUtilities.getAvailableFilterLists === 'function') {
            return window.mapUtilities.getAvailableFilterLists();
        }
        
        // Optimized version - cache results and use more efficient scanning
        if (this._cachedFilterLists) {
            return this._cachedFilterLists;
        }
        
        const lists = [];
        const maxCheck = 20; // Reasonable upper limit
        
        // More efficient scanning with early termination
        for (let i = 1; i <= maxCheck; i++) {
            const listId = `cms-filter-list-${i}`;
            if (document.getElementById(listId)) {
                lists.push(listId);
            } else if (i > 5 && lists.length === 0) {
                // Early termination if we haven't found anything by list 5
                break;
            }
        }
        
        this._cachedFilterLists = lists;
        return lists;
    }
    
    applyOptimizedStyles() {
        // Batch style applications
        this.elements.input.setAttribute('autocomplete', 'off');
        this.elements.input.setAttribute('spellcheck', 'false');
        
        // More efficient style application
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
        
        // Add scrollbar hiding style only once
        if (!document.querySelector(`#${this.elementIds.wrapperId}-scrollbar-style`)) {
            const style = document.createElement('style');
            style.id = `${this.elementIds.wrapperId}-scrollbar-style`;
            style.textContent = `#${this.elementIds.wrapperId}::-webkit-scrollbar { display: none; }`;
            document.head.appendChild(style);
        }
    }
    
    // HEAVILY OPTIMIZED: Pre-process all data for lightning-fast searching
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
        
        console.log(`Data processing: ${performance.now() - startTime}ms for ${this.searchData.rawTerms.size} terms`);
    }
    
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
        
        // Single query per list for all needed selectors
        lists.forEach(listId => {
            const container = document.getElementById(listId);
            if (!container) return;
            
            const allElements = container.querySelectorAll(selectors.join(', '));
            for (const element of allElements) {
                const term = element.textContent.trim();
                if (term) {
                    this.addTermToIndex(term);
                }
            }
        });
    }
    
    collectFromClassElements() {
        const elements = document.getElementsByClassName(this.sourceClass);
        for (const element of elements) {
            const term = element.textContent.trim();
            if (term) {
                this.addTermToIndex(term);
            }
        }
    }
    
    addTermToIndex(term) {
        if (this.searchData.rawTerms.has(term)) return;
        
        this.searchData.rawTerms.add(term);
        const normalized = this.normalizeText(term);
        this.searchData.normalizedTerms.set(normalized, term);
    }
    
    // OPTIMIZED: Static method for better performance
    normalizeText(text) {
        return text.toLowerCase().trim();
    }
    
    buildSearchIndex() {
        // Create character-based index for ultra-fast filtering
        this.searchData.normalizedTerms.forEach((original, normalized) => {
            // Index by first character and first two characters for speed
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
    
    // OPTIMIZED: Create dropdown with virtual elements
    createOptimizedDropdown() {
        if (this.searchData.rawTerms.size === 0) return;
        
        // Use document fragment for better performance
        const fragment = document.createDocumentFragment();
        const sortedTerms = Array.from(this.searchData.rawTerms).sort();
        
        sortedTerms.forEach(term => {
            const li = document.createElement('li');
            li.innerHTML = `<a href="#" class="list-term" data-term="${this.escapeHtml(term)}">${this.escapeHtml(term)}</a>`;
            fragment.appendChild(li);
        });
        
        this.elements.list.appendChild(fragment);
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
        // Optimized debounced input handler
        const debouncedInput = this.createOptimizedDebouncer(
            (e) => this.handleInput(e), 
            this.debounceDelay,
            'input'
        );
        
        // Event handler mapping for easy cleanup
        const handlers = {
            input: ['input', debouncedInput],
            keyup: ['keyup', debouncedInput],
            focus: ['focus', () => this.handleFocus()],
            keydown: ['keydown', (e) => this.handleKeydown(e)],
            listClick: ['click', (e) => this.handleDropdownClick(e)],
            outsideClick: ['click', (e) => this.handleOutsideClick(e)]
        };
        
        // Attach events and track for cleanup
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
        
        // Track for cleanup
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
        // Batch DOM operations
        requestAnimationFrame(() => {
            items.forEach(item => item.classList.remove('active'));
            if (items[index]) {
                items[index].classList.add('active');
                items[index].scrollIntoView({ block: 'nearest' });
            }
        });
    }
    
    // HEAVILY OPTIMIZED: Ultra-fast filtering with caching and indexing
    optimizedFilterAndShow(filter) {
        const startTime = performance.now();
        
        // Check cache first
        const normalizedFilter = this.normalizeText(filter);
        if (this.searchData.filteredCache.has(normalizedFilter)) {
            this.showCachedResults(normalizedFilter);
            return;
        }
        
        // Use search index for faster filtering
        const matchingTerms = this.getMatchingTermsFromIndex(normalizedFilter);
        
        // Cache results
        this.searchData.filteredCache.set(normalizedFilter, matchingTerms);
        
        // Update positioning and show results
        this.updatePositioning();
        this.updateVisibleItems(matchingTerms);
        
        const hasResults = matchingTerms.length > 0;
        this.elements.wrapper.style.display = hasResults ? 'block' : 'none';
        
        console.log(`Filter "${filter}": ${performance.now() - startTime}ms, ${matchingTerms.length} results`);
    }
    
    getMatchingTermsFromIndex(normalizedFilter) {
        // Use index for faster initial filtering
        const candidateTerms = new Set();
        
        // Try different index approaches for best performance
        const firstChar = normalizedFilter.charAt(0);
        const firstTwo = normalizedFilter.substring(0, 2);
        
        // Start with most specific index
        if (this.searchData.searchIndex.has(firstTwo)) {
            this.searchData.searchIndex.get(firstTwo).forEach(term => candidateTerms.add(term));
        } else if (this.searchData.searchIndex.has(firstChar)) {
            this.searchData.searchIndex.get(firstChar).forEach(term => candidateTerms.add(term));
        } else {
            // Fallback to all terms (shouldn't happen often)
            this.searchData.rawTerms.forEach(term => candidateTerms.add(term));
        }
        
        // Filter candidates
        const results = [];
        const normalizedFilterUpper = normalizedFilter.toUpperCase();
        
        for (const term of candidateTerms) {
            if (term.toUpperCase().includes(normalizedFilterUpper)) {
                results.push(term);
            }
        }
        
        return results.sort();
    }
    
    showCachedResults(normalizedFilter) {
        const cachedResults = this.searchData.filteredCache.get(normalizedFilter);
        this.updatePositioning();
        this.updateVisibleItems(cachedResults);
        this.elements.wrapper.style.display = cachedResults.length > 0 ? 'block' : 'none';
    }
    
    updatePositioning() {
        // Cache positioning calculations
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
        
        // Apply cached positioning
        const pos = this.cache.positioning;
        Object.assign(this.elements.wrapper.style, {
            top: pos.inputBottom + 'px',
            left: pos.left + 'px',
            width: pos.width + 'px'
        });
    }
    
    findWrapperElement() {
        // Cache wrapper element discovery
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
    
    // OPTIMIZED: Only update items that actually changed
    updateVisibleItems(matchingTerms) {
        const matchingSet = new Set(matchingTerms);
        const listItems = Array.from(this.elements.list.getElementsByTagName("li"));
        
        // Batch DOM operations
        const toShow = [];
        const toHide = [];
        
        listItems.forEach(li => {
            const term = li.textContent.trim();
            const shouldShow = matchingSet.has(term);
            const isCurrentlyVisible = li.style.display !== 'none';
            
            if (shouldShow && !isCurrentlyVisible) {
                toShow.push(li);
            } else if (!shouldShow && isCurrentlyVisible) {
                toHide.push(li);
            }
        });
        
        // Apply changes in batches
        if (toShow.length || toHide.length) {
            requestAnimationFrame(() => {
                toShow.forEach(li => li.style.display = 'block');
                toHide.forEach(li => li.style.display = 'none');
                
                // Clear active states
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
        // Batch event triggering
        const events = ['input', 'change', 'keyup'];
        events.forEach(eventType => {
            this.elements.input.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
        });
        
        const form = this.elements.input.closest('form');
        if (form) {
            form.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        }
        
        // Finsweet integration
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
    
    // OPTIMIZED: Smart refresh - only update what changed
    smartRefresh() {
        const startTime = performance.now();
        console.log('Smart refreshing autocomplete...');
        
        const previousSize = this.searchData.rawTerms.size;
        
        // Clear cache but keep structure
        this.searchData.filteredCache.clear();
        this.cache.positioning = null;
        this._cachedFilterLists = null;
        
        // Collect new terms
        this.collectAndProcessTerms();
        
        // Only rebuild dropdown if data actually changed
        if (this.searchData.rawTerms.size !== previousSize) {
            this.elements.list.innerHTML = '';
            this.createOptimizedDropdown();
            console.log(`Dropdown rebuilt: ${previousSize} -> ${this.searchData.rawTerms.size} terms`);
        }
        
        console.log(`Smart refresh completed in ${performance.now() - startTime}ms`);
    }
    
    // OPTIMIZED: Comprehensive cleanup
    destroy() {
        console.log('Cleaning up autocomplete...');
        
        // Clear all timers
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
        
        // Remove all event listeners
        this.eventHandlers.forEach(({ element, eventType, handler }) => {
            element.removeEventListener(eventType, handler);
        });
        this.eventHandlers.clear();
        
        // Clear data structures
        this.searchData.rawTerms.clear();
        this.searchData.normalizedTerms.clear();
        this.searchData.searchIndex.clear();
        this.searchData.filteredCache.clear();
        
        // Clear cache
        this.cache = {};
        
        console.log('Autocomplete cleanup completed');
    }
    
    // Performance monitoring
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

// OPTIMIZED: Initialization with better timing and integration
function initOptimizedAutocomplete() {
    // Wait for other scripts to be ready
    const initDelay = window.fsAttributes ? 300 : 100;
    
    setTimeout(() => {
        window.integratedAutocomplete = new OptimizedIntegratedAutocomplete({
            inputId: "refresh-on-enter",
            listId: "search-terms", 
            wrapperId: "searchTermsWrapper",
            clearId: "searchclear",
            dataSource: "cms-filter-lists",
            dataField: "names",
            debounceDelay: 100 // Reduced for better responsiveness
        });
        
        // Global refresh function
        window.refreshAutocomplete = () => {
            if (window.integratedAutocomplete) {
                window.integratedAutocomplete.smartRefresh();
            }
        };
        
        // Performance monitoring (debug only)
        window.getAutocompleteStats = () => {
            if (window.integratedAutocomplete) {
                return window.integratedAutocomplete.getPerformanceStats();
            }
        };
        
        // Integration with other scripts
        if (window.checkboxFilterScript) {
            // Coordinate with checkbox filter updates
            const originalRecache = window.checkboxFilterScript.recacheElements;
            window.checkboxFilterScript.recacheElements = function() {
                originalRecache.call(this);
                setTimeout(() => window.refreshAutocomplete?.(), 50);
            };
        }
        
        // Auto-refresh on CMS filter changes
        if (typeof window.fsAttributes !== 'undefined') {
            document.addEventListener('fs-cmsfilter-filtered', () => {
                setTimeout(() => window.refreshAutocomplete?.(), 50);
            });
        }
        
    }, initDelay);
}

// Initialize based on document state
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOptimizedAutocomplete);
} else {
    initOptimizedAutocomplete();
}

// Fallback initialization
window.addEventListener('load', () => {
    if (!window.integratedAutocomplete) {
        initOptimizedAutocomplete();
    }
});
