class OptimizedAutocomplete {
    constructor(options = {}) {
        // Configuration
        this.config = {
            inputId: options.inputId || "autocomplete-input",
            listId: options.listId || "autocomplete-list", 
            wrapperId: options.wrapperId || "autocomplete-wrapper",
            clearId: options.clearId || "autocomplete-clear",
            sourceClass: options.sourceClass || "autocomplete-source",
            debounceDelay: options.debounceDelay || 150,
            maxResults: options.maxResults || 50,
            minChars: options.minChars || 1
        };
        
        // DOM element cache
        this.elements = this.initializeElements();
        
        // State management
        this.state = {
            terms: new Set(),
            filteredTerms: [],
            activeIndex: -1,
            isVisible: false,
            lastQuery: ''
        };
        
        // Performance optimizations
        this.isMapboxIntegration = typeof window.isMarkerClick !== 'undefined';
        this.observers = new Map();
        this.eventHandlers = new Map();
        
        // Initialize if all required elements exist
        if (this.elements.input && this.elements.list && this.elements.wrapper) {
            this.init();
        } else {
            console.warn('Autocomplete: Required elements not found');
        }
    }
    
    initializeElements() {
        const elements = {};
        try {
            elements.input = document.getElementById(this.config.inputId);
            elements.list = document.getElementById(this.config.listId);
            elements.wrapper = document.getElementById(this.config.wrapperId);
            elements.clear = document.getElementById(this.config.clearId);
        } catch (error) {
            console.error('Autocomplete: Error initializing elements', error);
        }
        return elements;
    }
    
    init() {
        this.setupStyles();
        this.collectTerms();
        this.createEventHandlers();
        this.setupEventListeners();
        this.setupAccessibility();
        this.hide();
        
        // Setup mutation observer for dynamic content
        this.setupContentObserver();
    }
    
    setupStyles() {
        // Input field optimizations
        Object.assign(this.elements.input, {
            autocomplete: 'off',
            spellcheck: false
        });
        
        // Wrapper styles with CSS custom properties for better performance
        const styles = {
            position: 'fixed',
            zIndex: '999999',
            display: 'none',
            visibility: 'visible',
            opacity: '1',
            transform: 'translateZ(0)', // Force hardware acceleration
            willChange: 'transform, opacity', // Optimize for animations
            contain: 'layout style paint', // CSS containment for performance
            overflow: 'hidden',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            minWidth: '200px',
            maxWidth: '400px',
            maxHeight: '300px', // Prevent excessive height
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        };
        
        Object.assign(this.elements.wrapper.style, styles);
        
        // Inject CSS for better performance than inline styles
        this.injectCSS();
    }
    
    injectCSS() {
        if (document.getElementById('autocomplete-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'autocomplete-styles';
        style.textContent = `
            #${this.config.wrapperId}::-webkit-scrollbar { display: none; }
            .autocomplete-item {
                padding: 8px 12px;
                cursor: pointer;
                transition: background-color 0.15s ease;
                border-bottom: 1px solid #f0f0f0;
            }
            .autocomplete-item:hover,
            .autocomplete-item.active {
                background-color: #f8f9fa;
            }
            .autocomplete-item:last-child {
                border-bottom: none;
            }
            .autocomplete-match {
                font-weight: 600;
                color: #0066cc;
            }
        `;
        document.head.appendChild(style);
    }
    
    setupAccessibility() {
        // ARIA attributes for better accessibility
        this.elements.input.setAttribute('role', 'combobox');
        this.elements.input.setAttribute('aria-expanded', 'false');
        this.elements.input.setAttribute('aria-autocomplete', 'list');
        this.elements.input.setAttribute('aria-haspopup', 'listbox');
        this.elements.input.setAttribute('aria-owns', this.config.listId);
        
        this.elements.list.setAttribute('role', 'listbox');
        this.elements.wrapper.setAttribute('aria-live', 'polite');
    }
    
    collectTerms() {
        const elements = document.getElementsByClassName(this.config.sourceClass);
        const newTerms = new Set();
        
        // Use DocumentFragment for better performance if we need to process many elements
        Array.from(elements).forEach(el => {
            const term = el.textContent?.trim();
            if (term && term.length >= this.config.minChars) {
                newTerms.add(term);
            }
        });
        
        // Only update if terms have changed
        if (newTerms.size !== this.state.terms.size || 
            !this.arraysEqual(Array.from(newTerms), Array.from(this.state.terms))) {
            this.state.terms = newTerms;
            this.rebuildDropdown();
        }
    }
    
    arraysEqual(a, b) {
        return a.length === b.length && a.every((val, i) => val === b[i]);
    }
    
    rebuildDropdown() {
        // Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        const sortedTerms = Array.from(this.state.terms).sort();
        
        sortedTerms.forEach((term, index) => {
            const li = document.createElement('li');
            li.className = 'autocomplete-item';
            li.setAttribute('role', 'option');
            li.setAttribute('data-term', term);
            li.setAttribute('data-index', index);
            li.textContent = term;
            fragment.appendChild(li);
        });
        
        // Single DOM update
        this.elements.list.innerHTML = '';
        this.elements.list.appendChild(fragment);
    }
    
    createEventHandlers() {
        // Create bound event handlers to avoid recreating functions
        this.eventHandlers.set('input', this.debounce(this.handleInput.bind(this), this.config.debounceDelay));
        this.eventHandlers.set('focus', this.handleFocus.bind(this));
        this.eventHandlers.set('keydown', this.handleKeydown.bind(this));
        this.eventHandlers.set('click', this.handleClick.bind(this));
        this.eventHandlers.set('outsideClick', this.handleOutsideClick.bind(this));
        this.eventHandlers.set('clear', this.handleClear.bind(this));
    }
    
    setupEventListeners() {
        const input = this.elements.input;
        
        input.addEventListener('input', this.eventHandlers.get('input'));
        input.addEventListener('focus', this.eventHandlers.get('focus'));
        input.addEventListener('keydown', this.eventHandlers.get('keydown'));
        
        this.elements.list.addEventListener('click', this.eventHandlers.get('click'));
        document.addEventListener('click', this.eventHandlers.get('outsideClick'));
        
        if (this.elements.clear) {
            this.elements.clear.addEventListener('click', this.eventHandlers.get('clear'));
        }
    }
    
    setupContentObserver() {
        // Observe for dynamic content changes
        if ('MutationObserver' in window) {
            const observer = new MutationObserver(this.debounce(() => {
                this.collectTerms();
            }, 500));
            
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class']
            });
            
            this.observers.set('content', observer);
        }
    }
    
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
    
    handleInput(e) {
        const query = this.elements.input.value.trim();
        
        if (query.length === 0) {
            this.hide();
            return;
        }
        
        if (query.length < this.config.minChars) return;
        
        // Avoid unnecessary filtering if query hasn't changed
        if (query === this.state.lastQuery && this.state.isVisible) return;
        
        this.state.lastQuery = query;
        this.filterAndShow(query);
    }
    
    handleFocus() {
        const query = this.elements.input.value.trim();
        if (query.length >= this.config.minChars) {
            this.filterAndShow(query);
        }
    }
    
    handleKeydown(e) {
        if (!this.state.isVisible) return;
        
        const visibleItems = this.getVisibleItems();
        
        switch(e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.setActiveIndex(Math.min(this.state.activeIndex + 1, visibleItems.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.setActiveIndex(Math.max(this.state.activeIndex - 1, 0));
                break;
            case 'Enter':
                if (this.state.activeIndex >= 0 && visibleItems[this.state.activeIndex]) {
                    e.preventDefault();
                    this.selectTerm(visibleItems[this.state.activeIndex].dataset.term);
                }
                break;
            case 'Escape':
                this.hide();
                this.elements.input.blur();
                break;
        }
    }
    
    handleClick(e) {
        const item = e.target.closest('.autocomplete-item');
        if (item) {
            e.preventDefault();
            e.stopPropagation();
            this.selectTerm(item.dataset.term);
        }
    }
    
    handleOutsideClick(e) {
        if (!this.elements.input.contains(e.target) && 
            !this.elements.wrapper.contains(e.target) && 
            e.target !== this.elements.clear) {
            this.hide();
        }
    }
    
    handleClear() {
        if (this.elements.input.value) {
            this.elements.input.value = '';
            this.hide();
            this.triggerEvents();
            this.elements.input.focus();
        }
    }
    
    filterAndShow(query) {
        const queryUpper = query.toUpperCase();
        const items = Array.from(this.elements.list.children);
        
        // Filter and highlight matches
        this.state.filteredTerms = [];
        let visibleCount = 0;
        
        items.forEach(item => {
            const term = item.dataset.term;
            const termUpper = term.toUpperCase();
            const isMatch = termUpper.includes(queryUpper);
            
            if (isMatch && visibleCount < this.config.maxResults) {
                item.style.display = 'block';
                item.innerHTML = this.highlightMatch(term, query);
                this.state.filteredTerms.push(item);
                visibleCount++;
            } else {
                item.style.display = 'none';
            }
        });
        
        if (visibleCount > 0) {
            this.show();
            this.setActiveIndex(-1); // Reset active index
        } else {
            this.hide();
        }
    }
    
    highlightMatch(text, query) {
        if (!query) return this.escapeHtml(text);
        
        const escapedText = this.escapeHtml(text);
        const escapedQuery = this.escapeHtml(query);
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        
        return escapedText.replace(regex, '<span class="autocomplete-match">$1</span>');
    }
    
    show() {
        if (this.state.isVisible) return;
        
        this.positionDropdown();
        this.elements.wrapper.style.display = 'block';
        this.elements.input.setAttribute('aria-expanded', 'true');
        this.state.isVisible = true;
    }
    
    hide() {
        if (!this.state.isVisible) return;
        
        this.elements.wrapper.style.display = 'none';
        this.elements.input.setAttribute('aria-expanded', 'false');
        this.setActiveIndex(-1);
        this.state.isVisible = false;
    }
    
    positionDropdown() {
        const inputRect = this.elements.input.getBoundingClientRect();
        const wrapper = this.findWrapper() || this.elements.input;
        const wrapperRect = wrapper.getBoundingClientRect();
        
        // Use rem for consistent spacing
        const gap = parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.25;
        
        // Optimized positioning
        Object.assign(this.elements.wrapper.style, {
            top: (inputRect.bottom + window.scrollY + gap) + 'px',
            left: wrapperRect.left + 'px',
            width: wrapperRect.width + 'px'
        });
    }
    
    findWrapper() {
        // Simplified wrapper detection
        return this.elements.input.closest('.wrapper, .container, .form-wrapper, .search-wrapper, .input-wrapper, [class*="wrapper"]') ||
               this.elements.input.parentElement;
    }
    
    getVisibleItems() {
        return Array.from(this.elements.list.children).filter(item => 
            item.style.display !== 'none'
        );
    }
    
    setActiveIndex(index) {
        const visibleItems = this.getVisibleItems();
        
        // Remove previous active state
        visibleItems.forEach((item, i) => {
            item.classList.toggle('active', i === index);
            item.setAttribute('aria-selected', i === index ? 'true' : 'false');
        });
        
        this.state.activeIndex = index;
        
        // Scroll into view if needed
        if (index >= 0 && visibleItems[index]) {
            visibleItems[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }
    
    selectTerm(term) {
        this.elements.input.value = term;
        this.hide();
        this.triggerEvents();
        
        // Focus management for different integrations
        if (!this.isMapboxIntegration || !window.isMarkerClick) {
            requestAnimationFrame(() => this.elements.input.focus());
        }
    }
    
    triggerEvents() {
        const events = ['input', 'change', 'keyup'];
        events.forEach(eventType => {
            this.elements.input.dispatchEvent(new Event(eventType, { 
                bubbles: true, 
                cancelable: true 
            }));
        });
        
        // Form integration
        const form = this.elements.input.closest('form');
        if (form) {
            form.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        }
        
        // Finsweet CMS Filter integration
        this.triggerFinsweet();
    }
    
    triggerFinsweet() {
        if (window.fsAttributes?.cmsfilter) {
            setTimeout(() => {
                window.fsAttributes.cmsfilter.reload();
                ['fs-cmsfilter-change', 'fs-cmsfilter-search'].forEach(type => {
                    document.dispatchEvent(new CustomEvent(type, {
                        bubbles: true,
                        detail: { value: this.elements.input.value }
                    }));
                });
            }, 50);
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Public methods
    refresh() {
        this.collectTerms();
    }
    
    destroy() {
        // Cleanup event listeners
        this.eventHandlers.forEach((handler, event) => {
            if (event === 'outsideClick') {
                document.removeEventListener('click', handler);
            } else if (event === 'clear' && this.elements.clear) {
                this.elements.clear.removeEventListener('click', handler);
            } else if (event === 'click') {
                this.elements.list.removeEventListener('click', handler);
            } else {
                this.elements.input.removeEventListener(event.replace('handle', '').toLowerCase(), handler);
            }
        });
        
        // Cleanup observers
        this.observers.forEach(observer => observer.disconnect());
        
        // Remove injected styles
        const styleEl = document.getElementById('autocomplete-styles');
        if (styleEl) styleEl.remove();
        
        // Clear references
        this.elements = null;
        this.state = null;
        this.eventHandlers.clear();
        this.observers.clear();
    }
    
    // Utility methods for external access
    getTerms() {
        return Array.from(this.state.terms);
    }
    
    addTerm(term) {
        if (term && term.trim()) {
            this.state.terms.add(term.trim());
            this.rebuildDropdown();
        }
    }
    
    removeTerm(term) {
        this.state.terms.delete(term);
        this.rebuildDropdown();
    }
}

// Initialize with improved error handling and configuration
function initAutocomplete(config = {}) {
    // Default configuration - update these IDs in your HTML
    const defaultConfig = {
        inputId: "autocomplete-input",      // Changed from "refresh-on-enter"
        listId: "autocomplete-list",       // Changed from "search-terms"
        wrapperId: "autocomplete-wrapper", // Changed from "searchTermsWrapper"
        clearId: "autocomplete-clear",     // Changed from "searchclear"
        sourceClass: "autocomplete-source", // Changed from "autofill-title"
        debounceDelay: 150,
        maxResults: 50,
        minChars: 1
    };
    
    const finalConfig = { ...defaultConfig, ...config };
    
    try {
        window.optimizedAutocomplete = new OptimizedAutocomplete(finalConfig);
        
        // Global refresh function
        window.refreshAutocomplete = () => {
            if (window.optimizedAutocomplete) {
                window.optimizedAutocomplete.refresh();
            }
        };
        
        console.log('Optimized Autocomplete initialized successfully');
        return window.optimizedAutocomplete;
    } catch (error) {
        console.error('Failed to initialize Optimized Autocomplete:', error);
        return null;
    }
}

// Improved initialization with retry mechanism
function initWithRetry(maxRetries = 3) {
    let retries = 0;
    
    function attemptInit() {
        const instance = initAutocomplete();
        
        if (!instance && retries < maxRetries) {
            retries++;
            console.log(`Autocomplete init retry ${retries}/${maxRetries}`);
            setTimeout(attemptInit, 500 * retries); // Exponential backoff
        }
        
        return instance;
    }
    
    return attemptInit();
}

// Smart initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initWithRetry());
} else {
    initWithRetry();
}

// Fallback initialization
window.addEventListener('load', () => {
    if (!window.optimizedAutocomplete) {
        initWithRetry();
    }
});
