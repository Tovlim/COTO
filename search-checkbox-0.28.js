class IntegratedAutocomplete {
    constructor(options = {}) {
        console.log('IntegratedAutocomplete constructor called with options:', options);
        
        this.elementIds = {
            inputId: options.inputId || "refresh-on-enter",
            listId: options.listId || "search-terms",
            wrapperId: options.wrapperId || "searchTermsWrapper",
            clearId: options.clearId || "searchclear"
        };
        
        console.log('Looking for elements with IDs:', this.elementIds);
        
        this.inputField = document.getElementById(this.elementIds.inputId);
        this.searchList = document.getElementById(this.elementIds.listId);
        this.searchWrapper = document.getElementById(this.elementIds.wrapperId);
        this.clearButton = document.getElementById(this.elementIds.clearId);
        
        console.log('Found elements:', {
            inputField: !!this.inputField,
            searchList: !!this.searchList,
            searchWrapper: !!this.searchWrapper,
            clearButton: !!this.clearButton
        });
        
        // NEW: Integration with cms-filter-list system
        this.dataSource = options.dataSource || "cms-filter-lists"; // "cms-filter-lists" or "autofill-title"
        this.sourceClass = options.sourceClass || "autofill-title"; // Fallback for legacy mode
        this.dataField = options.dataField || "names"; // "names", "districts", or "both"
        
        this.terms = [];
        this.isMapboxIntegration = typeof window.isMarkerClick !== 'undefined';
        this.debounceDelay = options.debounceDelay || 150;
        
        if (this.inputField && this.searchList && this.searchWrapper) {
            console.log('All required elements found, initializing...');
            this.init();
        } else {
            console.error('Missing required elements. Cannot initialize autocomplete.');
        }
    }
    
    init() {
        this.applyFunctionalStyles();
        this.collectTerms();
        this.populateDropdown();
        this.setupEventListeners();
        this.hideDropdown();
        
        // NEW: Log integration status
        console.log(`Autocomplete initialized with ${this.terms.length} suggestions from ${this.dataSource}`);
    }
    
    // NEW: Auto-discover cms-filter-list containers (same logic as map script)
    getAvailableFilterLists() {
        const lists = [];
        let listNumber = 1;
        
        // Keep checking for cms-filter-list-{number} until we don't find any more
        while (true) {
            const listId = `cms-filter-list-${listNumber}`;
            const listContainer = document.getElementById(listId);
            
            if (listContainer) {
                lists.push(listId);
                listNumber++;
            } else {
                // If we don't find this number, check a few more in case there are gaps
                let gapCount = 0;
                let tempNumber = listNumber;
                
                // Check up to 5 numbers ahead for gaps
                while (gapCount < 5) {
                    tempNumber++;
                    const tempListId = `cms-filter-list-${tempNumber}`;
                    if (document.getElementById(tempListId)) {
                        // Found a gap - add all the missing ones and continue
                        for (let i = listNumber; i <= tempNumber; i++) {
                            const gapListId = `cms-filter-list-${i}`;
                            if (document.getElementById(gapListId)) {
                                lists.push(gapListId);
                            }
                        }
                        listNumber = tempNumber + 1;
                        gapCount = 0; // Reset gap count
                    } else {
                        gapCount++;
                    }
                }
                
                // If we've checked 5 numbers ahead and found nothing, we're done
                if (gapCount >= 5) {
                    break;
                }
            }
        }
        
        return lists;
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
    
    // UPDATED: New method to collect terms from cms-filter-lists
    collectTerms() {
        const termSet = new Set();
        
        if (this.dataSource === "cms-filter-lists") {
            // NEW: Collect from cms-filter-list containers
            const lists = this.getAvailableFilterLists();
            console.log(`Collecting autocomplete terms from: ${lists.join(', ')}`);
            
            lists.forEach(listId => {
                const listContainer = document.getElementById(listId);
                if (!listContainer) return;
                
                // Collect based on specified data field
                if (this.dataField === "names" || this.dataField === "both") {
                    const nameElements = listContainer.querySelectorAll('.data-places-names-filter');
                    Array.from(nameElements).forEach(el => {
                        const term = el.textContent.trim();
                        if (term) termSet.add(term);
                    });
                }
                
                if (this.dataField === "districts" || this.dataField === "both") {
                    const districtElements = listContainer.querySelectorAll('.data-places-district-filter');
                    Array.from(districtElements).forEach(el => {
                        const term = el.textContent.trim();
                        if (term) termSet.add(term);
                    });
                }
            });
            
            console.log(`Collected ${termSet.size} unique terms from ${lists.length} filter lists`);
        } else {
            // LEGACY: Collect from class-based elements (original method)
            const elements = document.getElementsByClassName(this.sourceClass);
            Array.from(elements).forEach(el => {
                const term = el.textContent.trim();
                if (term) termSet.add(term);
            });
            
            console.log(`Collected ${termSet.size} terms from .${this.sourceClass} elements`);
        }
        
        this.terms = Array.from(termSet).sort();
    }
    
    // NEW: Helper method to check if a term corresponds to a checked checkbox
    isTermChecked(term) {
        const lists = this.getAvailableFilterLists();
        
        for (const listId of lists) {
            const listContainer = document.getElementById(listId);
            if (!listContainer) continue;
            
            // Look for checkbox containers with the checkbox-filter attribute
            const checkboxItems = listContainer.querySelectorAll('[checkbox-filter="locality"]');
            
            for (const item of checkboxItems) {
                const labelText = item.querySelector('.w-form-label');
                if (labelText && labelText.textContent.trim() === term) {
                    // Check if this checkbox is checked by looking for the is-list-active class
                    const labelElement = item.querySelector('label');
                    if (labelElement && labelElement.classList.contains('is-list-active')) {
                        console.log(`Found checked checkbox for term: ${term}`);
                        return true;
                    }
                }
            }
        }
        
        console.log(`No checked checkbox found for term: ${term}`);
        return false;
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
        console.log('handleInput called with value:', this.inputField.value);
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
    
    // UPDATED: Modified to always show checked checkboxes
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
            const term = (li.textContent || li.innerText).trim();
            const isMatch = term.toUpperCase().includes(filterUpper);
            const isChecked = this.isTermChecked(term);
            
            // Show item if it matches the filter OR if it's checked
            const shouldShow = isMatch || isChecked;
            
            if (isChecked) {
                console.log(`Keeping checked item visible: ${term}`);
            }
            
            li.style.display = shouldShow ? "block" : "none";
            if (shouldShow) hasVisibleItems = true;
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
    
    // UPDATED: Enhanced refresh method
    refresh() {
        console.log('Refreshing autocomplete suggestions...');
        this.collectTerms();
        this.populateDropdown();
        console.log(`Autocomplete refreshed with ${this.terms.length} suggestions`);
    }
}

// UPDATED: Initialization with cms-filter-list integration
function initAutocomplete() {
    console.log('initAutocomplete called');
    
    setTimeout(() => {
        console.log('Creating IntegratedAutocomplete instance...');
        
        window.integratedAutocomplete = new IntegratedAutocomplete({
            inputId: "refresh-on-enter",
            listId: "search-terms", 
            wrapperId: "searchTermsWrapper",
            clearId: "searchclear",
            dataSource: "cms-filter-lists", // NEW: Use cms-filter-list integration
            dataField: "names", // NEW: Use locality names for suggestions
            // sourceClass: "autofill-title", // LEGACY: Only used if dataSource is not "cms-filter-lists"
            debounceDelay: 150
        });
        
        // Global refresh function for external use
        window.refreshAutocomplete = () => {
            if (window.integratedAutocomplete) {
                window.integratedAutocomplete.refresh();
            }
        };
        
        // NEW: Auto-refresh when map data changes (if map script is present)
        if (typeof window.fsAttributes !== 'undefined') {
            document.addEventListener('fs-cmsfilter-filtered', () => {
                // Small delay to ensure DOM updates are complete
                setTimeout(() => {
                    if (window.integratedAutocomplete) {
                        window.integratedAutocomplete.refresh();
                    }
                }, 100);
            });
        }
    }, 500);
}

console.log('Script loaded, document.readyState:', document.readyState);

if (document.readyState === 'loading') {
    console.log('Document still loading, adding DOMContentLoaded listener');
    document.addEventListener('DOMContentLoaded', initAutocomplete);
} else {
    console.log('Document already loaded, calling initAutocomplete directly');
    initAutocomplete();
}

window.addEventListener('load', () => {
    console.log('Window load event fired');
    if (!window.integratedAutocomplete) {
        console.log('No integratedAutocomplete found, initializing...');
        initAutocomplete();
    } else {
        console.log('integratedAutocomplete already exists');
    }
});
