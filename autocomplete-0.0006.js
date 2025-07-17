class IntegratedAutocomplete {
    constructor(options = {}) {
        this.elementIds = {
            inputId: options.inputId || "refresh-on-enter",
            listId: options.listId || "search-terms",
            wrapperId: options.wrapperId || "searchTermsWrapper",
            clearId: options.clearId || "searchclear"
        };
        
        // Cache DOM elements
        this.inputField = document.getElementById(this.elementIds.inputId);
        this.searchList = document.getElementById(this.elementIds.listId);
        this.searchWrapper = document.getElementById(this.elementIds.wrapperId);
        this.clearButton = document.getElementById(this.elementIds.clearId);
        
        // Configuration
        this.dataSource = options.dataSource || "cms-filter-lists";
        this.sourceClass = options.sourceClass || "autofill-title";
        this.dataField = options.dataField || "names";
        this.debounceDelay = options.debounceDelay || 100; // Reduced from 150ms
        this.maxResults = options.maxResults || 50; // Limit results for performance
        this.minSearchLength = options.minSearchLength || 1; // Minimum characters to search
        
        // Performance caches
        this.filterListsCache = null;
        this.termsCache = null;
        this.searchResultsCache = new Map(); // Cache search results
        this.lastSearchTerm = '';
        
        // State
        this.terms = [];
        this.filteredTerms = [];
        this.activeIndex = -1;
        this.isMapboxIntegration = typeof window.isMarkerClick !== 'undefined';
        this.isInitialized = false;
        
        // Bound methods for better performance
        this.boundHandleInput = this.debounce(this.handleInput.bind(this), this.debounceDelay);
        this.boundHandleKeydown = this.handleKeydown.bind(this);
        this.boundHandleOutsideClick = this.handleOutsideClick.bind(this);
        this.boundHandleDropdownClick = this.handleDropdownClick.bind(this);
        
        if (this.inputField && this.searchList && this.searchWrapper) {
            this.init();
        }
    }
    
    // Optimized debounce implementation
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // Optimized throttle for scroll events
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    init() {
        if (this.isInitialized) return;
        
        this.applyFunctionalStyles();
        this.collectTerms();
        this.populateDropdown();
        this.setupEventListeners();
        this.hideDropdown();
        this.addAccessibilityAttributes();
        
        this.isInitialized = true;
        console.log(`Optimized autocomplete initialized with ${this.terms.length} suggestions from ${this.dataSource}`);
    }
    
    // Cache filter lists for better performance
    getAvailableFilterLists() {
        if (this.filterListsCache) return this.filterListsCache;
        
        const lists = [];
        const maxCheck = 50; // Reasonable limit to prevent infinite loops
        let consecutiveGaps = 0;
        
        for (let listNumber = 1; listNumber <= maxCheck && consecutiveGaps < 5; listNumber++) {
            const listId = `cms-filter-list-${listNumber}`;
            const listContainer = document.getElementById(listId);
            
            if (listContainer) {
                lists.push(listId);
                consecutiveGaps = 0;
            } else {
                consecutiveGaps++;
            }
        }
        
        this.filterListsCache = lists;
        return lists;
    }
    
    applyFunctionalStyles() {
        // Batch DOM updates for better performance
        const inputStyles = {
            autocomplete: 'off',
            spellcheck: 'false',
            'aria-autocomplete': 'list',
            'aria-expanded': 'false',
            'aria-haspopup': 'listbox',
            role: 'combobox'
        };
        
        Object.entries(inputStyles).forEach(([key, value]) => {
            this.inputField.setAttribute(key, value);
        });
        
        // Optimized style application
        const wrapperStyles = {
            position: 'fixed',
            zIndex: '999999',
            display: 'none',
            visibility: 'visible',
            opacity: '1',
            transform: 'none',
            clip: 'auto',
            clipPath: 'none',
            mask: 'none',
            overflow: 'hidden',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            minWidth: '200px',
            maxWidth: '400px',
            maxHeight: '300px', // Limit height for performance
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        };
        
        Object.assign(this.searchWrapper.style, wrapperStyles);
        
        // Single style injection
        if (!document.getElementById('autocomplete-styles')) {
            const style = document.createElement('style');
            style.id = 'autocomplete-styles';
            style.textContent = `
                #${this.elementIds.wrapperId}::-webkit-scrollbar { display: none; }
                #${this.elementIds.wrapperId} .list-term:hover,
                #${this.elementIds.wrapperId} .list-term.active {
                    background-color: #f0f0f0;
                    transition: background-color 0.1s ease;
                }
                #${this.elementIds.wrapperId} li {
                    margin: 0;
                    padding: 0;
                }
                #${this.elementIds.wrapperId} .list-term {
                    display: block;
                    padding: 8px 12px;
                    text-decoration: none;
                    color: inherit;
                    border: none;
                    background: none;
                    width: 100%;
                    text-align: left;
                    cursor: pointer;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    addAccessibilityAttributes() {
        this.searchList.setAttribute('role', 'listbox');
        this.searchWrapper.setAttribute('aria-live', 'polite');
        this.inputField.setAttribute('aria-controls', this.elementIds.listId);
    }
    
    // Optimized term collection with caching
    collectTerms() {
        if (this.termsCache) {
            this.terms = this.termsCache;
            return;
        }
        
        const termSet = new Set();
        
        if (this.dataSource === "cms-filter-lists") {
            const lists = this.getAvailableFilterLists();
            
            // Use document fragments for better performance
            const selectors = [];
            if (this.dataField === "names" || this.dataField === "both") {
                selectors.push('.data-places-names-filter');
            }
            if (this.dataField === "districts" || this.dataField === "both") {
                selectors.push('.data-places-district-filter');
            }
            
            lists.forEach(listId => {
                const listContainer = document.getElementById(listId);
                if (!listContainer) return;
                
                selectors.forEach(selector => {
                    const elements = listContainer.querySelectorAll(selector);
                    // Use for...of for better performance than forEach
                    for (const el of elements) {
                        const term = el.textContent?.trim();
                        if (term && term.length > 0) {
                            termSet.add(term);
                        }
                    }
                });
            });
            
            console.log(`Collected ${termSet.size} unique terms from ${lists.length} filter lists`);
        } else {
            // Legacy mode - optimized
            const elements = document.getElementsByClassName(this.sourceClass);
            for (const el of elements) {
                const term = el.textContent?.trim();
                if (term && term.length > 0) {
                    termSet.add(term);
                }
            }
            
            console.log(`Collected ${termSet.size} terms from .${this.sourceClass} elements`);
        }
        
        // Convert to array and sort once
        this.terms = [...termSet].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        this.termsCache = this.terms;
    }
    
    // Optimized dropdown population with virtual scrolling for large lists
    populateDropdown() {
        if (this.terms.length === 0) return;
        
        // For very large lists, only populate visible items initially
        const termsToShow = this.terms.slice(0, this.maxResults);
        
        // Use template literal for faster string building
        const html = termsToShow.map((term, index) => 
            `<li role="option" data-index="${index}">
                <a href="#" class="list-term" data-term="${this.escapeHtml(term)}" tabindex="-1">
                    ${this.escapeHtml(term)}
                </a>
            </li>`
        ).join('');
        
        this.searchList.innerHTML = html;
    }
    
    // Optimized HTML escaping
    escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    
    setupEventListeners() {
        // Use passive listeners where possible
        this.inputField.addEventListener('input', this.boundHandleInput, { passive: true });
        this.inputField.addEventListener('keyup', this.boundHandleInput, { passive: true });
        this.inputField.addEventListener('focus', () => this.handleFocus(), { passive: true });
        this.inputField.addEventListener('keydown', this.boundHandleKeydown);
        
        this.searchList.addEventListener('click', this.boundHandleDropdownClick);
        
        if (this.clearButton) {
            this.clearButton.addEventListener('click', () => this.handleClear(), { passive: true });
        }
        
        document.addEventListener('click', this.boundHandleOutsideClick, { passive: true });
        
        // Optimize scroll handling if needed
        this.searchList.addEventListener('scroll', this.throttle(() => {
            // Future: Implement virtual scrolling here if needed
        }, 100), { passive: true });
    }
    
    // Optimized input handling
    handleInput(e) {
        const value = this.inputField.value.trim();
        
        if (value.length < this.minSearchLength) {
            this.hideDropdown();
            return;
        }
        
        this.filterAndShowDropdown(value);
    }
    
    handleFocus() {
        const value = this.inputField.value.trim();
        if (value.length >= this.minSearchLength) {
            this.filterAndShowDropdown(value);
        }
    }
    
    handleDropdownClick(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const term = e.target.closest('.list-term');
        if (term) {
            this.selectTerm(term.getAttribute('data-term'));
        }
    }
    
    handleClear() {
        if (this.inputField.value) {
            this.inputField.value = '';
            this.hideDropdown();
            this.triggerSearchEvents();
            this.inputField.focus();
        }
    }
    
    handleOutsideClick(e) {
        if (!this.inputField.contains(e.target) && 
            !this.searchWrapper.contains(e.target) && 
            e.target !== this.clearButton) {
            this.hideDropdown();
        }
    }
    
    // Optimized keyboard navigation
    handleKeydown(e) {
        if (this.searchWrapper.style.display === 'none') return;
        
        const visibleItems = this.searchList.querySelectorAll('li:not([style*="display: none"]) .list-term');
        const itemCount = visibleItems.length;
        
        switch(e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.activeIndex = Math.min(this.activeIndex + 1, itemCount - 1);
                this.updateActiveItem(visibleItems);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.activeIndex = Math.max(this.activeIndex - 1, 0);
                this.updateActiveItem(visibleItems);
                break;
            case 'Enter':
                if (this.activeIndex >= 0 && visibleItems[this.activeIndex]) {
                    e.preventDefault();
                    this.selectTerm(visibleItems[this.activeIndex].getAttribute('data-term'));
                }
                break;
            case 'Escape':
                this.hideDropdown();
                this.inputField.blur();
                break;
            case 'Tab':
                this.hideDropdown();
                break;
        }
    }
    
    // Optimized active item management
    updateActiveItem(items) {
        // Remove all active classes efficiently
        this.searchList.querySelectorAll('.list-term.active').forEach(item => {
            item.classList.remove('active');
            item.setAttribute('aria-selected', 'false');
        });
        
        if (items[this.activeIndex]) {
            const activeItem = items[this.activeIndex];
            activeItem.classList.add('active');
            activeItem.setAttribute('aria-selected', 'true');
            activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        
        // Update ARIA attributes
        this.inputField.setAttribute('aria-activedescendant', 
            items[this.activeIndex]?.id || '');
    }
    
    // Highly optimized filtering with caching
    filterAndShowDropdown(filter) {
        // Check cache first
        const cacheKey = filter.toLowerCase();
        if (this.searchResultsCache.has(cacheKey)) {
            this.showCachedResults(cacheKey);
            return;
        }
        
        // Position dropdown efficiently
        this.positionDropdown();
        
        // Fast case-insensitive filtering
        const filterLower = cacheKey;
        const matches = [];
        
        for (let i = 0; i < this.terms.length && matches.length < this.maxResults; i++) {
            const term = this.terms[i];
            if (term.toLowerCase().includes(filterLower)) {
                matches.push({ term, index: i });
            }
        }
        
        // Cache results
        this.searchResultsCache.set(cacheKey, matches);
        
        // Clear cache if it gets too large
        if (this.searchResultsCache.size > 100) {
            const firstKey = this.searchResultsCache.keys().next().value;
            this.searchResultsCache.delete(firstKey);
        }
        
        this.renderFilteredResults(matches);
    }
    
    showCachedResults(cacheKey) {
        const matches = this.searchResultsCache.get(cacheKey);
        this.positionDropdown();
        this.renderFilteredResults(matches);
    }
    
    positionDropdown() {
        const inputRect = this.inputField.getBoundingClientRect();
        const wrapperElement = this.findWrapperElement();
        const wrapperRect = (wrapperElement || this.inputField).getBoundingClientRect();
        
        const gap = 4; // Reduced from calculated rem value
        
        Object.assign(this.searchWrapper.style, {
            top: (inputRect.bottom + window.scrollY + gap) + 'px',
            left: wrapperRect.left + 'px',
            width: wrapperRect.width + 'px'
        });
    }
    
    findWrapperElement() {
        // Cache wrapper element lookup
        if (this.wrapperElementCache) return this.wrapperElementCache;
        
        let wrapperElement = document.getElementById('refresh-on-enter-wrapper');
        
        if (!wrapperElement) {
            wrapperElement = this.inputField.closest('.form-wrapper, .search-wrapper, .input-wrapper, [class*="wrapper"]');
        }
        
        this.wrapperElementCache = wrapperElement;
        return wrapperElement;
    }
    
    renderFilteredResults(matches) {
        if (matches.length === 0) {
            this.hideDropdown();
            return;
        }
        
        // Efficient DOM updates using innerHTML (faster for large lists)
        const html = matches.map((match, index) => 
            `<li role="option" data-index="${index}">
                <a href="#" class="list-term" data-term="${this.escapeHtml(match.term)}" tabindex="-1">
                    ${this.escapeHtml(match.term)}
                </a>
            </li>`
        ).join('');
        
        this.searchList.innerHTML = html;
        this.activeIndex = -1;
        this.searchWrapper.style.display = 'block';
        
        // Update ARIA attributes
        this.inputField.setAttribute('aria-expanded', 'true');
        this.searchWrapper.setAttribute('aria-label', `${matches.length} suggestions available`);
    }
    
    hideDropdown() {
        this.searchWrapper.style.display = 'none';
        this.activeIndex = -1;
        this.inputField.setAttribute('aria-expanded', 'false');
        this.inputField.removeAttribute('aria-activedescendant');
    }
    
    selectTerm(term) {
        this.inputField.value = term;
        this.hideDropdown();
        this.triggerSearchEvents();
        
        if (this.isMapboxIntegration && window.isMarkerClick) return;
        
        // Use requestAnimationFrame for smoother focus
        requestAnimationFrame(() => this.inputField.focus());
    }
    
    // Optimized event triggering
    triggerSearchEvents() {
        const events = ['input', 'change', 'keyup'];
        events.forEach(eventType => {
            this.inputField.dispatchEvent(new Event(eventType, { 
                bubbles: true, 
                cancelable: true 
            }));
        });
        
        const form = this.inputField.closest('form');
        if (form) {
            form.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        }
        
        if (window.fsAttributes?.cmsfilter) {
            // Use requestAnimationFrame for better performance
            requestAnimationFrame(() => {
                window.fsAttributes.cmsfilter.reload();
                ['fs-cmsfilter-change', 'fs-cmsfilter-search'].forEach(type => {
                    document.dispatchEvent(new CustomEvent(type, {
                        bubbles: true,
                        detail: { value: this.inputField.value }
                    }));
                });
            });
        }
    }
    
    // Optimized refresh with smart caching
    refresh() {
        console.log('Refreshing autocomplete suggestions...');
        
        // Clear caches
        this.filterListsCache = null;
        this.termsCache = null;
        this.searchResultsCache.clear();
        this.wrapperElementCache = null;
        
        this.collectTerms();
        this.populateDropdown();
        
        console.log(`Autocomplete refreshed with ${this.terms.length} suggestions`);
    }
    
    // Cleanup method for memory management
    destroy() {
        // Remove event listeners
        this.inputField.removeEventListener('input', this.boundHandleInput);
        this.inputField.removeEventListener('keyup', this.boundHandleInput);
        this.inputField.removeEventListener('keydown', this.boundHandleKeydown);
        this.searchList.removeEventListener('click', this.boundHandleDropdownClick);
        document.removeEventListener('click', this.boundHandleOutsideClick);
        
        if (this.clearButton) {
            this.clearButton.removeEventListener('click', this.handleClear);
        }
        
        // Clear caches
        this.searchResultsCache.clear();
        
        console.log('Autocomplete destroyed and cleaned up');
    }
}

// Optimized initialization
function initAutocomplete() {
    // Use requestIdleCallback if available for better performance
    const initFunction = () => {
        window.integratedAutocomplete = new IntegratedAutocomplete({
            inputId: "refresh-on-enter",
            listId: "search-terms", 
            wrapperId: "searchTermsWrapper",
            clearId: "searchclear",
            dataSource: "cms-filter-lists",
            dataField: "names",
            debounceDelay: 100, // Optimized delay
            maxResults: 50, // Limit for performance
            minSearchLength: 1
        });
        
        window.refreshAutocomplete = () => {
            window.integratedAutocomplete?.refresh();
        };
        
        // Optimized Finsweet integration
        if (typeof window.fsAttributes !== 'undefined') {
            let refreshTimeout;
            document.addEventListener('fs-cmsfilter-filtered', () => {
                clearTimeout(refreshTimeout);
                refreshTimeout = setTimeout(() => {
                    window.integratedAutocomplete?.refresh();
                }, 100);
            });
        }
    };
    
    if (window.requestIdleCallback) {
        requestIdleCallback(initFunction, { timeout: 1000 });
    } else {
        setTimeout(initFunction, 500);
    }
}

// Optimized DOM ready detection
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutocomplete);
} else {
    initAutocomplete();
}

window.addEventListener('load', () => {
    if (!window.integratedAutocomplete) initAutocomplete();
});
