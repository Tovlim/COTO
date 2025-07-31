// REAL-TIME VISIBILITY AUTOCOMPLETE - Works with Finsweet's live filtering
// Shows only currently visible terms that Finsweet hasn't filtered out

class RealTimeVisibilityAutocomplete {
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
        this.targetCollection = options.targetCollection || "cms-filter-list-4";
        this.dataField = options.dataField || "names";
        this.debounceDelay = options.debounceDelay || 100;
        
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
        this.applyStyles();
        this.setupEventListeners();
        this.hideDropdown();
        console.log('Real-time visibility autocomplete initialized');
    }
    
    applyStyles() {
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
        
        // Hide scrollbar
        if (!document.querySelector(`#${this.elementIds.wrapperId}-scrollbar-style`)) {
            const style = document.createElement('style');
            style.id = `${this.elementIds.wrapperId}-scrollbar-style`;
            style.textContent = `#${this.elementIds.wrapperId}::-webkit-scrollbar { display: none; }`;
            document.head.appendChild(style);
        }
    }
    
    setupEventListeners() {
        const debouncedInput = this.createDebouncer(
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
    
    createDebouncer(func, delay, timerId) {
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
            this.showVisibleTerms();
        }
    }
    
    handleFocus() {
        const value = this.elements.input.value.trim();
        if (value.length > 0) {
            this.showVisibleTerms();
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
        
        const visibleItems = this.getDropdownItems();
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
    
    getDropdownItems() {
        return Array.from(this.elements.list.querySelectorAll('.list-term'));
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
    
    // CORE: Get currently visible terms from Finsweet-filtered collection
    getCurrentlyVisibleTerms() {
        const startTime = performance.now();
        const visibleTerms = [];
        
        try {
            // Target specific collection with fallback
            const container = this.getFilterContainer();
            if (!container) {
                console.warn('No filter container found');
                return [];
            }
            
            // Build selectors based on data field
            const selectors = this.getDataSelectors();
            if (selectors.length === 0) {
                console.warn('No valid selectors for data field:', this.dataField);
                return [];
            }
            
            // Find all elements matching our selectors
            const elements = container.querySelectorAll(selectors.join(', '));
            
            // Check each element's visibility (not filtered out by Finsweet)
            elements.forEach(element => {
                if (this.isElementVisible(element)) {
                    const term = element.textContent.trim();
                    if (term && term.length > 0) {
                        visibleTerms.push(term);
                    }
                }
            });
            
            // Remove duplicates and sort
            const uniqueTerms = [...new Set(visibleTerms)].sort();
            
            console.log(`Found ${uniqueTerms.length} visible terms in ${performance.now() - startTime}ms`);
            return uniqueTerms;
            
        } catch (error) {
            console.error('Error getting visible terms:', error);
            return [];
        }
    }
    
    getFilterContainer() {
        // Try target collection first
        let container = document.getElementById(this.targetCollection);
        if (container) return container;
        
        // Fallback to dynamic detection
        const maxCheck = 20;
        for (let i = 1; i <= maxCheck; i++) {
            const listId = `cms-filter-list-${i}`;
            container = document.getElementById(listId);
            if (container) {
                console.log(`Using fallback container: ${listId}`);
                return container;
            }
        }
        
        return null;
    }
    
    getDataSelectors() {
        const selectors = [];
        
        if (this.dataField === "names" || this.dataField === "both") {
            selectors.push('.data-places-names-filter');
        }
        if (this.dataField === "districts" || this.dataField === "both") {
            selectors.push('.data-places-district-filter');
        }
        
        return selectors;
    }
    
    isElementVisible(element) {
        // Check if element or any parent has display: none
        let current = element;
        while (current && current !== document) {
            const style = window.getComputedStyle(current);
            if (style.display === 'none') {
                return false;
            }
            current = current.parentElement;
        }
        return true;
    }
    
    // CORE: Show dropdown with currently visible terms
    showVisibleTerms() {
        const visibleTerms = this.getCurrentlyVisibleTerms();
        
        if (visibleTerms.length === 0) {
            this.hideDropdown();
            return;
        }
        
        this.updateDropdownContent(visibleTerms);
        this.updatePositioning();
        this.elements.wrapper.style.display = 'block';
    }
    
    updateDropdownContent(terms) {
        // Clear existing content
        this.elements.list.innerHTML = '';
        
        // Create new dropdown items
        const fragment = document.createDocumentFragment();
        
        terms.forEach(term => {
            const li = document.createElement('li');
            li.innerHTML = `<a href="#" class="list-term" data-term="${this.escapeHtml(term)}">${this.escapeHtml(term)}</a>`;
            fragment.appendChild(li);
        });
        
        this.elements.list.appendChild(fragment);
    }
    
    updatePositioning() {
        const inputRect = this.elements.input.getBoundingClientRect();
        const wrapperElement = this.findWrapperElement();
        const wrapperRect = wrapperElement ? wrapperElement.getBoundingClientRect() : inputRect;
        
        Object.assign(this.elements.wrapper.style, {
            top: (inputRect.bottom + window.scrollY + 4) + 'px',
            left: wrapperRect.left + 'px',
            width: wrapperRect.width + 'px'
        });
    }
    
    findWrapperElement() {
        // Try to find input wrapper element
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
        
        return wrapperElement;
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
        
        // Trigger Finsweet events
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
    
    // Manual refresh if needed
    refresh() {
        console.log('Refreshing autocomplete...');
        const value = this.elements.input.value.trim();
        if (value.length > 0) {
            this.showVisibleTerms();
        }
    }
    
    destroy() {
        console.log('Cleaning up autocomplete...');
        
        // Clear timers
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
        
        // Remove event listeners
        this.eventHandlers.forEach(({ element, eventType, handler }) => {
            element.removeEventListener(eventType, handler);
        });
        this.eventHandlers.clear();
        
        console.log('Autocomplete cleanup completed');
    }
    
    getStats() {
        const visibleTerms = this.getCurrentlyVisibleTerms();
        return {
            visibleTerms: visibleTerms.length,
            targetContainer: this.targetCollection,
            dataField: this.dataField,
            eventHandlers: this.eventHandlers.size,
            activeTimers: this.debounceTimers.size
        };
    }
}

// Initialize the autocomplete
function initRealTimeAutocomplete() {
    // Prevent multiple instances
    if (window.integratedAutocomplete) {
        console.log('Real-time autocomplete already initialized');
        return;
    }
    
    const initDelay = window.fsAttributes ? 300 : 100;
    
    setTimeout(() => {
        // Double-check before creating
        if (window.integratedAutocomplete) {
            return;
        }
        
        window.integratedAutocomplete = new RealTimeVisibilityAutocomplete({
            inputId: "refresh-on-enter",
            listId: "search-terms", 
            wrapperId: "searchTermsWrapper",
            clearId: "searchclear",
            targetCollection: "cms-filter-list-4",
            dataField: "names", // or "districts" or "both"
            debounceDelay: 100
        });
        
        // Global functions
        window.refreshAutocomplete = () => {
            if (window.integratedAutocomplete) {
                window.integratedAutocomplete.refresh();
            }
        };
        
        window.getAutocompleteStats = () => {
            if (window.integratedAutocomplete) {
                return window.integratedAutocomplete.getStats();
            }
        };
        
        console.log('Real-time visibility autocomplete initialized successfully');
        
    }, initDelay);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRealTimeAutocomplete);
} else {
    initRealTimeAutocomplete();
}

// Backup initialization
window.addEventListener('load', () => {
    if (!window.integratedAutocomplete) {
        initRealTimeAutocomplete();
    }
});
