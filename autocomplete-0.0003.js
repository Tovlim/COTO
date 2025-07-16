class IntegratedAutocomplete {
    constructor(options = {}) {
        this.elementIds = {
            inputId: options.inputId || "refresh-on-enter",
            listId: options.listId || "search-terms",
            wrapperId: options.wrapperId || "searchTermsWrapper",
            clearId: options.clearId || "searchclear"
        };
        
        this.inputField = document.getElementById(this.elementIds.inputId);
        this.searchList = document.getElementById(this.elementIds.listId);
        this.searchWrapper = document.getElementById(this.elementIds.wrapperId);
        this.clearButton = document.getElementById(this.elementIds.clearId);
        
        this.sourceClass = options.sourceClass || "autofill-title";
        this.useMapData = options.useMapData !== false; // Default to true
        this.terms = [];
        this.isMapboxIntegration = typeof window.isMarkerClick !== 'undefined';
        this.debounceDelay = options.debounceDelay || 150;
        
        if (this.inputField && this.searchList && this.searchWrapper) {
            this.init();
        }
    }
    
    init() {
        this.applyFunctionalStyles();
        this.collectTerms();
        this.populateDropdown();
        this.setupEventListeners();
        this.hideDropdown();
    }
    
    applyFunctionalStyles() {
        this.inputField.setAttribute('autocomplete', 'off');
        this.inputField.setAttribute('spellcheck', 'false');
        
        Object.assign(this.searchWrapper.style, {
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
            maxWidth: '400px'
        });
        
        const hideScrollbarStyle = document.createElement('style');
        hideScrollbarStyle.textContent = `#${this.elementIds.wrapperId}::-webkit-scrollbar { display: none; }`;
        document.head.appendChild(hideScrollbarStyle);
    }
    
    // ENHANCED: Now collects from map data OR fallback to DOM
    collectTerms() {
        const termSet = new Set();
        
        // Primary: Try to get data from map localities and districts
        if (this.useMapData && this.collectFromMapData(termSet)) {
            console.log('Autocomplete: Using map data for suggestions');
        } else {
            // Fallback: Use original DOM-based collection
            console.log('Autocomplete: Using DOM elements for suggestions');
            this.collectFromDOM(termSet);
        }
        
        this.terms = Array.from(termSet).sort();
        console.log(`Autocomplete: Collected ${this.terms.length} total suggestions`);
    }
    
    // NEW: Collect suggestions from map localities and districts
    collectFromMapData(termSet) {
        // Check if map state is available
        if (typeof window.state === 'undefined' || !window.state) {
            return false;
        }
        
        let localityCount = 0;
        let districtCount = 0;
        
        // Add all locality names
        if (window.state.allLocalityFeatures && Array.isArray(window.state.allLocalityFeatures)) {
            window.state.allLocalityFeatures.forEach(feature => {
                if (feature.properties && feature.properties.name) {
                    const name = feature.properties.name.trim();
                    if (name) {
                        termSet.add(name);
                        localityCount++;
                    }
                }
            });
        }
        
        // Add all district names
        if (window.state.allDistrictFeatures && Array.isArray(window.state.allDistrictFeatures)) {
            window.state.allDistrictFeatures.forEach(feature => {
                if (feature.properties && feature.properties.name) {
                    const name = feature.properties.name.trim();
                    if (name) {
                        termSet.add(name);
                        districtCount++;
                    }
                }
            });
        }
        
        console.log(`Autocomplete: Added ${localityCount} localities and ${districtCount} districts from map`);
        return localityCount > 0 || districtCount > 0;
    }
    
    // ORIGINAL: Fallback DOM collection method
    collectFromDOM(termSet) {
        const elements = document.getElementsByClassName(this.sourceClass);
        
        Array.from(elements).forEach(el => {
            const term = el.textContent.trim();
            if (term) termSet.add(term);
        });
    }
    
    populateDropdown() {
        if (this.terms.length === 0) return;
        
        const html = this.terms.map(term => `
            <li><a href="#" class="list-term" data-term="${this.escapeHtml(term)}">${this.escapeHtml(term)}</a></li>
        `).join('');
        
        this.searchList.innerHTML = html;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    setupEventListeners() {
        let inputTimeout;
        const debouncedInput = (e) => {
            clearTimeout(inputTimeout);
            inputTimeout = setTimeout(() => this.handleInput(e), this.debounceDelay);
        };
        
        this.inputField.addEventListener('input', debouncedInput);
        this.inputField.addEventListener('keyup', debouncedInput);
        this.inputField.addEventListener('focus', () => this.handleFocus());
        this.searchList.addEventListener('click', (e) => this.handleDropdownClick(e));
        
        if (this.clearButton) {
            this.clearButton.addEventListener('click', () => this.handleClear());
        }
        
        document.addEventListener('click', (e) => this.handleOutsideClick(e));
        this.inputField.addEventListener('keydown', (e) => this.handleKeydown(e));
    }
    
    handleInput(e) {
        const value = this.inputField.value.trim();
        value.length === 0 ? this.hideDropdown() : this.filterAndShowDropdown(value);
    }
    
    handleFocus() {
        const value = this.inputField.value.trim();
        if (value.length > 0) this.filterAndShowDropdown(value);
    }
    
    handleDropdownClick(e) {
        if (e.target.classList.contains('list-term')) {
            e.preventDefault();
            e.stopPropagation();
            this.selectTerm(e.target.getAttribute('data-term'));
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
    
    handleKeydown(e) {
        if (this.searchWrapper.style.display === 'none') return;
        
        const visibleItems = Array.from(this.searchList.querySelectorAll('li:not([style*="display: none"]) .list-term'));
        const currentActive = this.searchList.querySelector('.list-term.active');
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
                this.inputField.blur();
                break;
        }
    }
    
    setActiveItem(items, index) {
        items.forEach(item => item.classList.remove('active'));
        if (items[index]) {
            items[index].classList.add('active');
            items[index].scrollIntoView({ block: 'nearest' });
        }
    }
    
    filterAndShowDropdown(filter) {
        const inputRect = this.inputField.getBoundingClientRect();
        
        let wrapperElement = document.getElementById('refresh-on-enter-wrapper');
        if (!wrapperElement) {
            let parent = this.inputField.parentElement;
            while (parent && parent !== document.body) {
                if (parent.className.toLowerCase().includes('wrapper') || 
                    parent.className.toLowerCase().includes('container')) {
                    wrapperElement = parent;
                    break;
                }
                parent = parent.parentElement;
            }
            
            if (!wrapperElement) {
                const formWrapper = this.inputField.closest('.form-wrapper, .search-wrapper, .input-wrapper, [class*="wrapper"]');
                if (formWrapper) wrapperElement = formWrapper;
            }
            
            if (!wrapperElement) {
                const immediateParent = this.inputField.parentElement;
                const parentRect = immediateParent.getBoundingClientRect();
                if (parentRect.width > inputRect.width) wrapperElement = immediateParent;
            }
        }
        
        const sizeReference = wrapperElement || this.inputField;
        const wrapperRect = sizeReference.getBoundingClientRect();
        const remSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        const gap = remSize * 0.25;
        
        this.searchWrapper.style.top = (inputRect.bottom + window.scrollY + gap) + 'px';
        this.searchWrapper.style.left = wrapperRect.left + 'px';
        this.searchWrapper.style.width = wrapperRect.width + 'px';
        
        const filterUpper = filter.toUpperCase();
        let hasVisibleItems = false;
        
        Array.from(this.searchList.getElementsByTagName("li")).forEach(li => {
            const isMatch = (li.textContent || li.innerText).toUpperCase().includes(filterUpper);
            li.style.display = isMatch ? "block" : "none";
            if (isMatch) hasVisibleItems = true;
        });
        
        this.searchList.querySelectorAll('.list-term.active').forEach(item => item.classList.remove('active'));
        this.searchWrapper.style.display = hasVisibleItems ? 'block' : 'none';
    }
    
    hideDropdown() {
        this.searchWrapper.style.display = 'none';
        this.searchList.querySelectorAll('.list-term.active').forEach(item => item.classList.remove('active'));
    }
    
    selectTerm(term) {
        this.inputField.value = term;
        this.hideDropdown();
        this.triggerSearchEvents();
        
        if (this.isMapboxIntegration && window.isMarkerClick) return;
        setTimeout(() => this.inputField.focus(), 100);
    }
    
    triggerSearchEvents() {
        ['input', 'change', 'keyup'].forEach(eventType => {
            this.inputField.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
        });
        
        const form = this.inputField.closest('form');
        if (form) form.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        
        if (window.fsAttributes?.cmsfilter) {
            setTimeout(() => {
                window.fsAttributes.cmsfilter.reload();
                ['fs-cmsfilter-change', 'fs-cmsfilter-search'].forEach(type => {
                    document.dispatchEvent(new CustomEvent(type, {
                        bubbles: true,
                        detail: { value: this.inputField.value }
                    }));
                });
            }, 50);
        }
    }
    
    // ENHANCED: Better refresh with map data sync
    refresh() {
        console.log('Autocomplete: Refreshing suggestions...');
        this.collectTerms();
        this.populateDropdown();
    }
    
    // NEW: Force refresh from map data (useful after map loads)
    refreshFromMapData() {
        if (this.useMapData) {
            console.log('Autocomplete: Force refreshing from map data...');
            this.collectTerms();
            this.populateDropdown();
        }
    }
}

function initAutocomplete() {
    setTimeout(() => {
        window.integratedAutocomplete = new IntegratedAutocomplete({
            inputId: "refresh-on-enter",
            listId: "search-terms", 
            wrapperId: "searchTermsWrapper",
            clearId: "searchclear",
            sourceClass: "autofill-title", // Fallback for DOM collection
            useMapData: true, // NEW: Enable map data integration
            debounceDelay: 150
        });
        
        // Global refresh functions
        window.refreshAutocomplete = () => {
            if (window.integratedAutocomplete) window.integratedAutocomplete.refresh();
        };
        
        // NEW: Function to refresh specifically from map data
        window.refreshAutocompleteFromMap = () => {
            if (window.integratedAutocomplete) window.integratedAutocomplete.refreshFromMapData();
        };
        
        // NEW: Auto-refresh when map data changes
        if (typeof window.state !== 'undefined') {
            console.log('Autocomplete: Map state detected, will use map data for suggestions');
            setTimeout(() => window.refreshAutocompleteFromMap(), 1000);
        }
    }, 500);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutocomplete);
} else {
    initAutocomplete();
}

window.addEventListener('load', () => {
    if (!window.integratedAutocomplete) initAutocomplete();
    
    // NEW: Retry map data integration after everything loads
    setTimeout(() => {
        if (window.integratedAutocomplete && typeof window.state !== 'undefined') {
            window.refreshAutocompleteFromMap();
        }
    }, 2000);
});
