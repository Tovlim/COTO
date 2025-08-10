// ========================
// LAZY LOADED HIGH-PERFORMANCE AUTOCOMPLETE
// ========================

(function() {
    // Track loading state
    let autocompleteLoadState = 'pending'; // 'pending', 'loading', 'loaded'
    let autocompleteInstance = null;
    let loadPromise = null;
    
    // Lightweight stub that handles initial interactions
    class AutocompleteStub {
        constructor() {
            this.setupStubListeners();
        }
        
        setupStubListeners() {
            const searchInput = document.getElementById('map-search');
            if (!searchInput) {
                // Retry if element not found
                setTimeout(() => this.setupStubListeners(), 100);
                return;
            }
            
            // Track if user has interacted
            let hasInteracted = false;
            
            // Load on first focus
            const handleFirstFocus = () => {
                if (!hasInteracted) {
                    hasInteracted = true;
                    searchInput.removeEventListener('focus', handleFirstFocus);
                    searchInput.removeEventListener('mouseenter', handleFirstMouseEnter);
                    loadAutocomplete('user-interaction');
                }
            };
            
            // Preload on hover (gives us a head start)
            const handleFirstMouseEnter = () => {
                if (!hasInteracted && autocompleteLoadState === 'pending') {
                    hasInteracted = true;
                    searchInput.removeEventListener('mouseenter', handleFirstMouseEnter);
                    searchInput.removeEventListener('focus', handleFirstFocus);
                    loadAutocomplete('user-hover');
                }
            };
            
            // Add lightweight listeners
            searchInput.addEventListener('focus', handleFirstFocus, { once: true });
            searchInput.addEventListener('mouseenter', handleFirstMouseEnter, { once: true });
            
            // Also prevent form submission while autocomplete is not loaded
            const form = searchInput.closest('form');
            if (form) {
                form.addEventListener('submit', (e) => {
                    if (autocompleteLoadState !== 'loaded') {
                        e.preventDefault();
                    }
                });
            }
        }
    }
    
    // Function to load the actual autocomplete
    function loadAutocomplete(trigger = 'unknown') {
        // Prevent multiple simultaneous loads
        if (autocompleteLoadState === 'loading' || autocompleteLoadState === 'loaded') {
            return loadPromise;
        }
        
        console.log(`Loading autocomplete... (triggered by: ${trigger})`);
        autocompleteLoadState = 'loading';
        
        // Create a promise for the loading process
        loadPromise = new Promise((resolve) => {
            // Use requestIdleCallback if available, otherwise setTimeout
            const loadFunction = () => {
                try {
                    // Initialize the actual autocomplete
                    initializeFullAutocomplete();
                    autocompleteLoadState = 'loaded';
                    console.log('Autocomplete loaded successfully');
                    resolve();
                } catch (error) {
                    console.error('Failed to load autocomplete:', error);
                    autocompleteLoadState = 'pending'; // Reset to allow retry
                    resolve(); // Resolve anyway to prevent blocking
                }
            };
            
            if ('requestIdleCallback' in window) {
                requestIdleCallback(loadFunction, { timeout: 1000 });
            } else {
                setTimeout(loadFunction, 10);
            }
        });
        
        return loadPromise;
    }
    
    // The actual autocomplete implementation (wrapped in a function)
    function initializeFullAutocomplete() {
        // ========================
        // FULL AUTOCOMPLETE CLASS
        // ========================
        
        class HighPerformanceAutocomplete {
            constructor(options = {}) {
                // Configuration
                this.config = {
                    inputId: options.inputId || "map-search",
                    wrapperId: options.wrapperId || "searchTermsWrapper",
                    clearId: options.clearId || "searchclear",
                    virtualScroll: false,
                    itemHeight: options.itemHeight || 45,
                    visibleItems: options.visibleItems || 8,
                    fuzzySearch: options.fuzzySearch !== false,
                    maxResults: options.maxResults || 200,
                    debounceMs: options.debounceMs || 50,
                    highlightMatches: false,
                    scoreThreshold: options.scoreThreshold || 0.3,
                    mobileBreakpoint: 478,
                    mobileShowDelay: 400
                };
                
                // Data storage
                this.data = {
                    districts: [],
                    subregions: [],
                    localities: [],
                    filteredResults: [],
                    selectedIndex: -1
                };
                
                // Virtual scrolling state
                this.virtualScroll = {
                    scrollTop: 0,
                    startIndex: 0,
                    endIndex: this.config.visibleItems,
                    containerHeight: this.config.itemHeight * this.config.visibleItems
                };
                
                // Performance optimization
                this.cache = new Map();
                this.renderFrame = null;
                this.scrollFrame = null;
                this.filterTimeout = null;
                this.showTimeout = null;
                this.isFirstShow = true;
                
                // Initialize
                this.init();
            }
            
            init() {
                // Cache DOM elements
                this.elements = {
                    input: document.getElementById(this.config.inputId),
                    wrapper: document.getElementById(this.config.wrapperId),
                    clear: document.getElementById(this.config.clearId)
                };
                
                if (!this.elements.input || !this.elements.wrapper) {
                    console.error('Required elements not found');
                    return;
                }
                
                // Create optimized dropdown structure
                this.setupDropdownStructure();
                
                // Setup event listeners
                this.setupEventListeners();
                
                // Apply initial styles
                this.applyStyles();
                
                // Load data
                this.loadData();
                
                console.log('High-performance autocomplete initialized');
            }
            
            setupDropdownStructure() {
                this.elements.wrapper.innerHTML = `
                    <ul id="search-terms" class="autocomplete-list"></ul>
                `;
                
                this.elements.list = this.elements.wrapper.querySelector('.autocomplete-list');
            }
            
            loadData() {
                const startTime = performance.now();
                
                // Use Sets to prevent duplicates
                const districtSet = new Set();
                const subregionSet = new Set();
                const localitiesMap = new Map();
                
                // Find only first 5 lists for faster loading
                for (let i = 1; i <= 5; i++) {
                    const listContainer = document.getElementById(`cms-filter-list-${i}`);
                    if (!listContainer) continue;
                    
                    const items = listContainer.children;
                    
                    for (let j = 0; j < items.length; j++) {
                        const item = items[j];
                        
                        const nameEl = item.querySelector('.data-places-names-filter');
                        if (!nameEl) continue;
                        
                        const name = nameEl.textContent.trim();
                        if (!name) continue;
                        
                        const districtEl = item.querySelector('.data-places-district-filter');
                        const subregionEl = item.querySelector('.data-places-subregion-filter');
                        
                        const district = districtEl?.textContent.trim() || '';
                        const subregion = subregionEl?.textContent.trim() || '';
                        
                        if (district) districtSet.add(district);
                        if (subregion) subregionSet.add(subregion);
                        
                        if (!localitiesMap.has(name)) {
                            const latEl = item.querySelector('.data-places-latitudes-filter');
                            const lngEl = item.querySelector('.data-places-longitudes-filter');
                            
                            localitiesMap.set(name, {
                                name: name,
                                nameLower: name.toLowerCase(),
                                district: district,
                                subregion: subregion,
                                lat: parseFloat(latEl?.textContent) || 0,
                                lng: parseFloat(lngEl?.textContent) || 0,
                                type: 'locality',
                                searchTokens: this.createSearchTokens(name)
                            });
                        }
                    }
                }
                
                // Convert sets to arrays
                this.data.districts = Array.from(districtSet).map(district => ({
                    name: district,
                    nameLower: district.toLowerCase(),
                    type: 'district',
                    searchTokens: this.createSearchTokens(district)
                })).sort((a, b) => a.name.localeCompare(b.name));
                
                this.data.subregions = Array.from(subregionSet).map(subregion => ({
                    name: subregion,
                    nameLower: subregion.toLowerCase(),
                    type: 'subregion',
                    searchTokens: this.createSearchTokens(subregion)
                })).sort((a, b) => a.name.localeCompare(b.name));
                
                this.data.localities = Array.from(localitiesMap.values())
                    .sort((a, b) => a.name.localeCompare(b.name));
                
                console.log(`Data loaded in ${performance.now() - startTime}ms:`, {
                    districts: this.data.districts.length,
                    subregions: this.data.subregions.length,
                    localities: this.data.localities.length
                });
            }
            
            createSearchTokens(text) {
                const tokens = text.toLowerCase().split(/\s+/);
                const ngrams = [];
                
                for (let n = 2; n <= 3; n++) {
                    for (let i = 0; i <= text.length - n; i++) {
                        ngrams.push(text.toLowerCase().substr(i, n));
                    }
                }
                
                return { tokens, ngrams };
            }
            
            setupEventListeners() {
                let inputTimeout;
                
                // Input handling
                this.elements.input.addEventListener('input', (e) => {
                    clearTimeout(inputTimeout);
                    inputTimeout = setTimeout(() => this.handleInput(e.target.value), this.config.debounceMs);
                });
                
                // Focus/blur handling
                this.elements.input.addEventListener('focus', () => this.handleFocus());
                this.elements.input.addEventListener('blur', () => this.handleBlur());
                
                // Keyboard navigation
                this.elements.input.addEventListener('keydown', (e) => this.handleKeydown(e));
                
                // Prevent blur when interacting with dropdown
                this.elements.wrapper.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                });
                
                // Click handling
                this.elements.wrapper.addEventListener('click', (e) => this.handleItemClick(e));
                
                // Clear button
                if (this.elements.clear) {
                    this.elements.clear.addEventListener('mousedown', (e) => e.preventDefault());
                    this.elements.clear.addEventListener('click', () => this.handleClear());
                }
                
                // Prevent form submission
                const form = this.elements.input.closest('form');
                if (form) {
                    form.addEventListener('submit', (e) => e.preventDefault());
                }
            }
            
            handleInput(searchText) {
                clearTimeout(this.showTimeout);
                
                if (!searchText || searchText.length === 0) {
                    this.showAllItems();
                } else {
                    this.performSearch(searchText);
                }
                
                this.renderResults();
                
                const isMobile = window.innerWidth <= this.config.mobileBreakpoint;
                
                if (isMobile && document.activeElement === this.elements.input) {
                    this.showTimeout = setTimeout(() => {
                        this.showDropdown();
                    }, this.config.mobileShowDelay);
                } else {
                    this.showDropdown();
                }
            }
            
            showAllItems() {
                const maxDistrictsAndSubregions = 3;
                const combinedRegions = [];
                
                let districtIndex = 0;
                let subregionIndex = 0;
                
                while (combinedRegions.length < maxDistrictsAndSubregions && 
                       (districtIndex < this.data.districts.length || subregionIndex < this.data.subregions.length)) {
                    if (districtIndex < this.data.districts.length && combinedRegions.length < maxDistrictsAndSubregions) {
                        combinedRegions.push(this.data.districts[districtIndex]);
                        districtIndex++;
                    }
                    if (subregionIndex < this.data.subregions.length && combinedRegions.length < maxDistrictsAndSubregions) {
                        combinedRegions.push(this.data.subregions[subregionIndex]);
                        subregionIndex++;
                    }
                }
                
                this.data.filteredResults = [
                    ...combinedRegions,
                    ...this.data.localities.slice(0, this.config.maxResults)
                ];
            }
            
            performSearch(searchText) {
                const startTime = performance.now();
                const searchLower = searchText.toLowerCase();
                const searchTokens = searchText.toLowerCase().split(/\s+/);
                
                const scoredResults = [];
                
                // Search all categories
                [...this.data.districts, ...this.data.subregions, ...this.data.localities].forEach(item => {
                    const score = this.calculateMatchScore(searchLower, searchTokens, item);
                    if (score > this.config.scoreThreshold) {
                        scoredResults.push({ ...item, score });
                    }
                });
                
                // Sort by score and type
                scoredResults.sort((a, b) => {
                    if (Math.abs(b.score - a.score) > 0.1) {
                        return b.score - a.score;
                    }
                    if (a.type !== 'locality' && b.type === 'locality') return -1;
                    if (a.type === 'locality' && b.type !== 'locality') return 1;
                    return a.name.localeCompare(b.name);
                });
                
                // Limit districts/subregions to 3 total
                let regionCount = 0;
                const limitedResults = [];
                
                for (const result of scoredResults) {
                    if (result.type === 'district' || result.type === 'subregion') {
                        if (regionCount < 3) {
                            limitedResults.push(result);
                            regionCount++;
                        }
                    } else {
                        limitedResults.push(result);
                    }
                    
                    if (limitedResults.length >= this.config.maxResults) break;
                }
                
                this.data.filteredResults = limitedResults;
                
                console.log(`Search completed in ${performance.now() - startTime}ms, found ${this.data.filteredResults.length} results`);
            }
            
            calculateMatchScore(searchLower, searchTokens, item) {
                let score = 0;
                
                if (item.nameLower === searchLower) {
                    return 1.0;
                }
                
                if (item.nameLower.startsWith(searchLower)) {
                    score = 0.9;
                } else if (item.nameLower.includes(searchLower)) {
                    score = 0.7;
                }
                
                if (searchTokens.length > 1) {
                    const matchedTokens = searchTokens.filter(token => 
                        item.searchTokens.tokens.some(itemToken => itemToken.includes(token))
                    );
                    score = Math.max(score, matchedTokens.length / searchTokens.length * 0.8);
                }
                
                if (this.config.fuzzySearch && score < 0.5) {
                    const searchNgrams = new Set();
                    for (let i = 0; i <= searchLower.length - 2; i++) {
                        searchNgrams.add(searchLower.substr(i, 2));
                    }
                    
                    let matches = 0;
                    searchNgrams.forEach(ngram => {
                        if (item.searchTokens.ngrams.includes(ngram)) matches++;
                    });
                    
                    const fuzzyScore = matches / Math.max(searchNgrams.size, 1) * 0.6;
                    score = Math.max(score, fuzzyScore);
                }
                
                return score;
            }
            
            renderResults() {
                if (!this.data.filteredResults.length) {
                    this.elements.list.innerHTML = '<li class="no-results">No results found</li>';
                    return;
                }
                
                const fragment = document.createDocumentFragment();
                
                this.data.filteredResults.forEach((item, index) => {
                    fragment.appendChild(this.createItemElement(item, index));
                });
                
                this.elements.list.innerHTML = '';
                this.elements.list.appendChild(fragment);
            }
            
            createItemElement(item, index) {
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = '#';
                a.className = `list-term ${item.type}-term ${index === this.data.selectedIndex ? 'active' : ''}`;
                a.dataset.index = index;
                a.dataset.type = item.type;
                a.dataset.term = item.name;
                
                if (item.type === 'locality') {
                    const location = [item.subregion, item.district].filter(Boolean).join(', ');
                    a.innerHTML = `
                        <div class="locality-info">
                            <div class="locality-name">${item.name}</div>
                            ${location ? `<div class="locality-region">${location}</div>` : ''}
                        </div>
                        <span class="term-label">Locality</span>
                    `;
                } else {
                    const typeLabel = item.type === 'district' ? 'Region' : 'Sub-Region';
                    a.innerHTML = `${item.name} <span class="term-label">${typeLabel}</span>`;
                }
                
                li.appendChild(a);
                return li;
            }
            
            handleKeydown(e) {
                if (!this.isDropdownVisible()) return;
                
                const visibleItems = this.getDropdownItems();
                let currentActive = this.elements.list.querySelector('.list-term.active');
                let activeIndex = currentActive ? parseInt(currentActive.dataset.index) : -1;
                
                switch(e.key) {
                    case 'ArrowDown':
                        e.preventDefault();
                        activeIndex = Math.min(activeIndex + 1, this.data.filteredResults.length - 1);
                        this.setActiveItem(visibleItems, activeIndex);
                        break;
                    case 'ArrowUp':
                        e.preventDefault();
                        activeIndex = Math.max(activeIndex - 1, 0);
                        this.setActiveItem(visibleItems, activeIndex);
                        break;
                    case 'Enter':
                        e.preventDefault();
                        if (currentActive) {
                            const term = currentActive.getAttribute('data-term');
                            const type = currentActive.getAttribute('data-type');
                            this.selectTerm(term, type);
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
                items.forEach(item => item.classList.remove('active'));
                
                const activeItem = items.find(item => parseInt(item.dataset.index) === index);
                if (activeItem) {
                    activeItem.classList.add('active');
                    activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
                
                this.data.selectedIndex = index;
            }
            
            handleItemClick(e) {
                e.preventDefault();
                const termElement = e.target.closest('.list-term');
                if (!termElement) return;
                
                const term = termElement.getAttribute('data-term');
                const type = termElement.getAttribute('data-type');
                
                if (term) {
                    this.selectTerm(term, type);
                }
            }
            
            selectTerm(term, type) {
                this.elements.input.value = term;
                this.hideDropdown();
                this.elements.input.blur();
                
                if (type === 'district') {
                    this.triggerDistrictSelection(term);
                } else if (type === 'subregion') {
                    this.triggerSubregionSelection(term);
                } else if (type === 'locality') {
                    this.triggerLocalitySelection(term);
                }
            }
            
            triggerDistrictSelection(districtName) {
                window.isMarkerClick = true;
                
                if (window.mapUtilities && window.mapUtilities.state) {
                    window.mapUtilities.state.markerInteractionLock = false;
                }
                
                if (window.selectDistrictCheckbox) {
                    window.selectDistrictCheckbox(districtName);
                }
                
                if (window.mapUtilities?.toggleShowWhenFilteredElements) {
                    window.mapUtilities.toggleShowWhenFilteredElements(true);
                }
                
                if (window.innerWidth > 478 && window.mapUtilities?.toggleSidebar) {
                    window.mapUtilities.toggleSidebar('Left', true);
                }
                
                if (window.highlightBoundary) {
                    window.highlightBoundary(districtName);
                }
                
                setTimeout(() => {
                    window.isMarkerClick = false;
                    if (window.applyFilterToMarkers) {
                        window.applyFilterToMarkers();
                    }
                }, 100);
            }
            
            triggerSubregionSelection(subregionName) {
                const hiddenListSearch = document.getElementById('hidden-list-search');
                if (hiddenListSearch) {
                    hiddenListSearch.value = subregionName;
                    hiddenListSearch.dispatchEvent(new Event('input', { bubbles: true }));
                    hiddenListSearch.dispatchEvent(new Event('change', { bubbles: true }));
                }
                
                if (window.mapUtilities?.toggleShowWhenFilteredElements) {
                    window.mapUtilities.toggleShowWhenFilteredElements(true);
                }
                
                if (window.innerWidth > 478 && window.mapUtilities?.toggleSidebar) {
                    window.mapUtilities.toggleSidebar('Left', true);
                }
                
                setTimeout(() => {
                    if (window.applyFilterToMarkers) {
                        window.applyFilterToMarkers();
                    }
                }, 100);
            }
            
            triggerLocalitySelection(localityName) {
                window.isMarkerClick = true;
                
                if (window.mapUtilities && window.mapUtilities.state) {
                    window.mapUtilities.state.markerInteractionLock = false;
                }
                
                if (window.selectLocalityCheckbox) {
                    window.selectLocalityCheckbox(localityName);
                }
                
                if (window.mapUtilities?.toggleShowWhenFilteredElements) {
                    window.mapUtilities.toggleShowWhenFilteredElements(true);
                }
                
                if (window.innerWidth > 478 && window.mapUtilities?.toggleSidebar) {
                    window.mapUtilities.toggleSidebar('Left', true);
                }
                
                const locality = this.data.localities.find(l => l.name === localityName);
                if (window.map && locality && locality.lat && locality.lng) {
                    window.map.flyTo({
                        center: [locality.lng, locality.lat],
                        zoom: 13.5,
                        duration: 1000,
                        essential: true
                    });
                }
                
                setTimeout(() => {
                    window.isMarkerClick = false;
                }, 800);
            }
            
            handleFocus() {
                const hiddenListSearch = document.getElementById('hidden-list-search');
                if (hiddenListSearch) {
                    hiddenListSearch.value = '';
                    hiddenListSearch.dispatchEvent(new Event('input', { bubbles: true }));
                    hiddenListSearch.dispatchEvent(new Event('change', { bubbles: true }));
                }
                
                const searchIconsWrap = document.querySelector('.search-icons-wrap');
                const clearSearchWrap = document.querySelector('.clear-search-wrap');
                
                if (searchIconsWrap && searchIconsWrap.classList.contains('blurred')) {
                    searchIconsWrap.classList.remove('blurred');
                }
                if (clearSearchWrap && clearSearchWrap.classList.contains('blurred')) {
                    clearSearchWrap.classList.remove('blurred');
                }
                
                if (this.elements.input.value.length === 0) {
                    this.showAllItems();
                    this.renderResults();
                }
                
                const isMobile = window.innerWidth <= this.config.mobileBreakpoint;
                
                if (isMobile) {
                    clearTimeout(this.showTimeout);
                    this.showTimeout = setTimeout(() => {
                        this.showDropdown();
                    }, this.config.mobileShowDelay);
                } else {
                    this.showDropdown();
                }
            }
            
            handleBlur() {
                clearTimeout(this.showTimeout);
                
                const searchIconsWrap = document.querySelector('.search-icons-wrap');
                const clearSearchWrap = document.querySelector('.clear-search-wrap');
                
                if (searchIconsWrap && !searchIconsWrap.classList.contains('blurred')) {
                    searchIconsWrap.classList.add('blurred');
                }
                if (clearSearchWrap && !clearSearchWrap.classList.contains('blurred')) {
                    clearSearchWrap.classList.add('blurred');
                }
                
                this.hideDropdown();
            }
            
            handleClear() {
                if (this.elements.input.value) {
                    this.elements.input.value = '';
                    this.hideDropdown();
                    this.elements.input.focus();
                    this.showAllItems();
                    this.renderResults();
                    this.showDropdown();
                }
            }
            
            showDropdown() {
                if (this.data.filteredResults.length === 0) {
                    this.hideDropdown();
                    return;
                }
                
                this.updatePosition();
                
                if (this.isFirstShow) {
                    this.elements.wrapper.style.visibility = 'hidden';
                    this.elements.wrapper.style.display = 'block';
                    this.elements.wrapper.offsetHeight;
                    this.updatePosition();
                    this.elements.wrapper.style.visibility = 'visible';
                    this.isFirstShow = false;
                } else {
                    this.elements.wrapper.style.display = 'block';
                }
            }
            
            hideDropdown() {
                clearTimeout(this.showTimeout);
                this.elements.wrapper.style.display = 'none';
                this.elements.list.querySelectorAll('.list-term.active')
                    .forEach(item => item.classList.remove('active'));
                this.data.selectedIndex = -1;
            }
            
            isDropdownVisible() {
                return this.elements.wrapper.style.display === 'block';
            }
            
            updatePosition() {
                const inputRect = this.elements.input.getBoundingClientRect();
                const width = inputRect.width;
                
                Object.assign(this.elements.wrapper.style, {
                    position: 'fixed',
                    top: `${inputRect.bottom + 4}px`,
                    left: `${inputRect.left}px`,
                    width: `${width}px`,
                    maxHeight: `${this.config.itemHeight * this.config.visibleItems}px`,
                    overflowY: 'auto',
                    zIndex: '999999'
                });
            }
            
            applyStyles() {
                this.elements.input.setAttribute('autocomplete', 'off');
                this.elements.input.setAttribute('spellcheck', 'false');
                
                this.elements.wrapper.style.display = 'none';
                this.elements.wrapper.style.visibility = 'visible';
                
                if (!document.getElementById('hp-autocomplete-styles')) {
                    const style = document.createElement('style');
                    style.id = 'hp-autocomplete-styles';
                    style.textContent = `
                        #searchTermsWrapper::-webkit-scrollbar { display: none; }
                        #searchTermsWrapper { -ms-overflow-style: none; scrollbar-width: none; }
                        #search-terms { list-style: none; margin: 0; padding: 0; }
                        
                        .list-term {
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            padding: 8px 12px;
                            text-decoration: none;
                            color: inherit;
                            transition: background-color 0.2s;
                        }
                        
                        .list-term:hover { background-color: #f5f5f5; }
                        
                        .list-term.district-term,
                        .list-term.subregion-term {
                            font-weight: 600;
                            color: #6e3500;
                            background-color: #fdf6f0;
                            border-left: 3px solid #6e3500;
                        }
                        
                        .list-term.district-term:hover,
                        .list-term.subregion-term:hover {
                            background-color: #f5e6d3;
                        }
                        
                        .list-term.district-term .term-label,
                        .list-term.subregion-term .term-label {
                            color: #8f4500;
                        }
                        
                        .list-term.locality-term {
                            font-weight: 500;
                            color: #7e7800;
                            background-color: #fffef5;
                            border-left: 3px solid #7e7800;
                            padding: 10px 12px;
                        }
                        
                        .list-term.locality-term:hover { background-color: #f9f8e6; }
                        .list-term.locality-term * { pointer-events: none; }
                        .list-term.locality-term .term-label { color: #a49c00; }
                        
                        .locality-info {
                            flex-grow: 1;
                            display: flex;
                            flex-direction: column;
                            gap: 2px;
                        }
                        
                        .locality-name {
                            font-weight: 500;
                            color: #7e7800;
                        }
                        
                        .locality-region {
                            font-size: 0.75em;
                            color: #6e3500;
                            font-weight: normal;
                        }
                        
                        .term-label {
                            font-size: 0.75em;
                            font-weight: normal;
                            opacity: 0.8;
                            margin-left: 8px;
                            flex-shrink: 0;
                            align-self: flex-start;
                            margin-top: 2px;
                        }
                        
                        .list-term.active { background-color: #e8e8e8 !important; }
                        .no-results { padding: 20px; text-align: center; color: #666; }
                    `;
                    document.head.appendChild(style);
                }
            }
            
            refresh() {
                this.loadData();
                if (this.isDropdownVisible()) {
                    this.handleInput(this.elements.input.value);
                }
            }
            
            destroy() {
                clearTimeout(this.filterTimeout);
                clearTimeout(this.showTimeout);
                cancelAnimationFrame(this.renderFrame);
                cancelAnimationFrame(this.scrollFrame);
                
                this.elements.list.innerHTML = '';
                this.elements.wrapper.style.display = 'none';
                
                console.log('Autocomplete destroyed');
            }
            
            getStats() {
                return {
                    totalItems: this.data.districts.length + this.data.subregions.length + this.data.localities.length,
                    districts: this.data.districts.length,
                    subregions: this.data.subregions.length,
                    localities: this.data.localities.length,
                    filteredResults: this.data.filteredResults.length,
                    cacheSize: this.cache.size
                };
            }
        }
        
        // Clean up old instances
        if (window.integratedAutocomplete) {
            window.integratedAutocomplete.destroy();
            window.integratedAutocomplete = null;
        }
        
        if (window.hpAutocomplete) {
            window.hpAutocomplete.destroy();
            window.hpAutocomplete = null;
        }
        
        // Create new instance
        autocompleteInstance = new HighPerformanceAutocomplete({
            inputId: "map-search",
            wrapperId: "searchTermsWrapper",
            clearId: "searchclear"
        });
        
        // Expose global functions
        window.hpAutocomplete = autocompleteInstance;
        
        window.refreshAutocomplete = () => {
            if (autocompleteInstance) {
                autocompleteInstance.refresh();
            }
        };
        
        window.getAutocompleteStats = () => {
            if (autocompleteInstance) {
                return autocompleteInstance.getStats();
            }
        };
    }
    
    // Smart loading strategy
    function setupSmartLoading() {
        // Initialize the stub immediately
        new AutocompleteStub();
        
        // Strategy 1: Load after map is initialized (low priority)
        if (window.map && window.mapUtilities) {
            // Map is already loaded, wait a bit then load autocomplete
            setTimeout(() => {
                if (autocompleteLoadState === 'pending') {
                    loadAutocomplete('map-ready-delayed');
                }
            }, 2000);
        } else {
            // Wait for map to be ready
            const checkMapReady = setInterval(() => {
                if (window.map && window.mapUtilities) {
                    clearInterval(checkMapReady);
                    // Give map time to fully initialize, then load autocomplete
                    setTimeout(() => {
                        if (autocompleteLoadState === 'pending') {
                            loadAutocomplete('map-ready');
                        }
                    }, 3000);
                }
            }, 500);
            
            // Timeout after 10 seconds and load anyway
            setTimeout(() => {
                clearInterval(checkMapReady);
                if (autocompleteLoadState === 'pending') {
                    loadAutocomplete('timeout');
                }
            }, 10000);
        }
        
        // Strategy 2: Also load if page has been idle for 5 seconds
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                if (autocompleteLoadState === 'pending') {
                    loadAutocomplete('idle');
                }
            }, { timeout: 5000 });
        } else {
            setTimeout(() => {
                if (autocompleteLoadState === 'pending') {
                    loadAutocomplete('idle-fallback');
                }
            }, 5000);
        }
    }
    
    // Initialize smart loading
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupSmartLoading);
    } else {
        setupSmartLoading();
    }
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (autocompleteInstance) {
            autocompleteInstance.destroy();
        }
    });
})();

// ========================
// OPTIMIZED MAPBOX SCRIPT - Production Version 2025
// With Enhanced Memory Management, State Machine, and Modular Loading
// ========================

(function() {
    'use strict';
    
    // ========================
    // CORE CONFIGURATION
    // ========================
    
    const CONFIG = {
        mapbox: {
            accessToken: "pk.eyJ1Ijoibml0YWloYXJkeSIsImEiOiJjbWRzNGIxemIwMHVsMm1zaWp3aDl2Y3RsIn0.l_GLzIUCO84SF5_4TcmF3g",
            style: "mapbox://styles/nitaihardy/cmdp8fjw100ex01s83b2d6jzf",
            rtlLanguages: ['ar', 'he', 'fa', 'ur', 'yi']
        },
        cache: {
            maxSize: 100,
            ttl: 5000, // 5 seconds
            domCacheSize: 50,
            centroidCacheSize: 50
        },
        loading: {
            maxWaitTime: 20000, // 20 seconds max loading screen
            fallbackCompleteTime: 12000 // 12 seconds to mark incomplete as complete
        },
        viewport: {
            mobile: {
                breakpoint: 768,
                center: [34.85, 31.7],
                zoom: 7.1
            },
            desktop: {
                center: [35.22, 31.85],
                zoom: 8.33
            }
        }
    };
    
    // ========================
    // STATE MACHINE IMPLEMENTATION
    // ========================
    
    class StateMachine {
        constructor() {
            this.states = {
                INIT: 'INIT',
                LOADING_MAP: 'LOADING_MAP',
                LOADING_DATA: 'LOADING_DATA',
                MAP_READY: 'MAP_READY',
                IDLE: 'IDLE',
                FILTERING: 'FILTERING',
                MARKER_INTERACTION: 'MARKER_INTERACTION',
                SIDEBAR_TRANSITION: 'SIDEBAR_TRANSITION',
                ERROR: 'ERROR'
            };
            
            this.currentState = this.states.INIT;
            this.previousState = null;
            this.stateData = {};
            this.listeners = new Map();
            
            // Define valid transitions
            this.transitions = {
                INIT: ['LOADING_MAP', 'ERROR'],
                LOADING_MAP: ['LOADING_DATA', 'ERROR'],
                LOADING_DATA: ['MAP_READY', 'ERROR'],
                MAP_READY: ['IDLE', 'ERROR'],
                IDLE: ['FILTERING', 'MARKER_INTERACTION', 'SIDEBAR_TRANSITION', 'ERROR'],
                FILTERING: ['IDLE', 'ERROR'],
                MARKER_INTERACTION: ['IDLE', 'FILTERING', 'ERROR'],
                SIDEBAR_TRANSITION: ['IDLE', 'ERROR'],
                ERROR: ['INIT']
            };
        }
        
        transition(newState, data = {}) {
            if (!this.canTransition(newState)) {
                console.warn(`Invalid transition from ${this.currentState} to ${newState}`);
                return false;
            }
            
            this.previousState = this.currentState;
            this.currentState = newState;
            this.stateData = data;
            
            this.emit('transition', {
                from: this.previousState,
                to: this.currentState,
                data: this.stateData
            });
            
            return true;
        }
        
        canTransition(newState) {
            return this.transitions[this.currentState]?.includes(newState) || false;
        }
        
        is(state) {
            return this.currentState === state;
        }
        
        on(event, callback) {
            if (!this.listeners.has(event)) {
                this.listeners.set(event, new Set());
            }
            this.listeners.get(event).add(callback);
        }
        
        off(event, callback) {
            this.listeners.get(event)?.delete(callback);
        }
        
        emit(event, data) {
            this.listeners.get(event)?.forEach(callback => callback(data));
        }
    }
    
    // ========================
    // MEMORY-MANAGED CACHE SYSTEM
    // ========================
    
    class LRUCache {
        constructor(maxSize = 100, ttl = 5000) {
            this.maxSize = maxSize;
            this.ttl = ttl;
            this.cache = new Map();
            this.accessOrder = [];
            this.timestamps = new Map();
        }
        
        get(key) {
            if (!this.cache.has(key)) return null;
            
            // Check if expired
            const timestamp = this.timestamps.get(key);
            if (Date.now() - timestamp > this.ttl) {
                this.delete(key);
                return null;
            }
            
            // Update access order
            this.updateAccessOrder(key);
            return this.cache.get(key);
        }
        
        set(key, value) {
            // Remove oldest if at capacity
            if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
                const oldest = this.accessOrder[0];
                this.delete(oldest);
            }
            
            this.cache.set(key, value);
            this.timestamps.set(key, Date.now());
            this.updateAccessOrder(key);
        }
        
        updateAccessOrder(key) {
            const index = this.accessOrder.indexOf(key);
            if (index > -1) {
                this.accessOrder.splice(index, 1);
            }
            this.accessOrder.push(key);
        }
        
        delete(key) {
            this.cache.delete(key);
            this.timestamps.delete(key);
            const index = this.accessOrder.indexOf(key);
            if (index > -1) {
                this.accessOrder.splice(index, 1);
            }
        }
        
        clear() {
            this.cache.clear();
            this.timestamps.clear();
            this.accessOrder = [];
        }
        
        cleanup() {
            const now = Date.now();
            const expired = [];
            
            this.timestamps.forEach((timestamp, key) => {
                if (now - timestamp > this.ttl) {
                    expired.push(key);
                }
            });
            
            expired.forEach(key => this.delete(key));
        }
        
        get size() {
            return this.cache.size;
        }
    }
    
    // ========================
    // ENHANCED DOM CACHE WITH MEMORY MANAGEMENT
    // ========================
    
    class ManagedDOMCache {
        constructor(maxSize = 50) {
            this.elementCache = new LRUCache(maxSize, 10000); // 10s TTL for DOM elements
            this.selectorCache = new LRUCache(maxSize, 5000);  // 5s TTL for selectors
            this.weakRefs = new WeakMap(); // For DOM elements that might be removed
        }
        
        $id(id) {
            const cached = this.elementCache.get(`id:${id}`);
            if (cached) return cached;
            
            const element = document.getElementById(id);
            if (element) {
                this.elementCache.set(`id:${id}`, element);
            }
            return element;
        }
        
        $1(selector) {
            const cached = this.selectorCache.get(`s1:${selector}`);
            if (cached) return cached;
            
            const element = document.querySelector(selector);
            if (element) {
                this.selectorCache.set(`s1:${selector}`, element);
            }
            return element;
        }
        
        $(selector) {
            const cached = this.selectorCache.get(`s:${selector}`);
            if (cached) return cached;
            
            const elements = Array.from(document.querySelectorAll(selector));
            this.selectorCache.set(`s:${selector}`, elements);
            return elements;
        }
        
        cleanup() {
            this.elementCache.cleanup();
            this.selectorCache.cleanup();
        }
        
        clear() {
            this.elementCache.clear();
            this.selectorCache.clear();
        }
    }
    
    // ========================
    // ENHANCED EVENT MANAGER WITH CLEANUP
    // ========================
    
    class ManagedEventSystem {
        constructor() {
            this.listeners = new Map();
            this.delegated = new Map();
            this.timers = new Map();
            this.maxTimers = 20; // Limit concurrent timers
        }
        
        on(element, event, handler, options = {}) {
            if (typeof element === 'string') {
                element = domCache.$id(element) || domCache.$1(element);
            }
            if (!element) return false;
            
            const key = this.getElementKey(element);
            if (!this.listeners.has(key)) {
                this.listeners.set(key, new Map());
            }
            
            const elementListeners = this.listeners.get(key);
            if (!elementListeners.has(event)) {
                elementListeners.set(event, new Set());
            }
            
            elementListeners.get(event).add({ handler, options });
            element.addEventListener(event, handler, options);
            
            return () => this.off(element, event, handler);
        }
        
        off(element, event, handler) {
            if (typeof element === 'string') {
                element = domCache.$id(element) || domCache.$1(element);
            }
            if (!element) return;
            
            const key = this.getElementKey(element);
            const elementListeners = this.listeners.get(key);
            if (!elementListeners) return;
            
            const eventHandlers = elementListeners.get(event);
            if (eventHandlers) {
                eventHandlers.forEach(({ handler: h, options }) => {
                    if (h === handler) {
                        element.removeEventListener(event, handler, options);
                        eventHandlers.delete({ handler: h, options });
                    }
                });
            }
        }
        
        delegate(parent, event, selector, handler) {
            if (typeof parent === 'string') {
                parent = domCache.$1(parent);
            }
            if (!parent) return false;
            
            const delegatedHandler = (e) => {
                const target = e.target.closest(selector);
                if (target) {
                    handler.call(target, e);
                }
            };
            
            const key = `${event}:${selector}`;
            this.delegated.set(key, { parent, handler: delegatedHandler });
            parent.addEventListener(event, delegatedHandler);
            
            return () => {
                parent.removeEventListener(event, delegatedHandler);
                this.delegated.delete(key);
            };
        }
        
        debounce(fn, delay, id) {
            return (...args) => {
                // Clean up old timer
                if (this.timers.has(id)) {
                    clearTimeout(this.timers.get(id));
                }
                
                // Limit concurrent timers
                if (this.timers.size >= this.maxTimers) {
                    const firstKey = this.timers.keys().next().value;
                    clearTimeout(this.timers.get(firstKey));
                    this.timers.delete(firstKey);
                }
                
                const timer = setTimeout(() => {
                    this.timers.delete(id);
                    fn(...args);
                }, delay);
                
                this.timers.set(id, timer);
            };
        }
        
        getElementKey(element) {
            return element.id || `el_${Math.random().toString(36).substr(2, 9)}`;
        }
        
        cleanup() {
            // Clear all event listeners
            this.listeners.forEach((elementListeners, key) => {
                elementListeners.forEach((handlers, event) => {
                    handlers.forEach(({ handler, options }) => {
                        const element = document.querySelector(`#${key}`) || 
                                       document.querySelector(`[data-event-key="${key}"]`);
                        if (element) {
                            element.removeEventListener(event, handler, options);
                        }
                    });
                });
            });
            
            // Clear delegated listeners
            this.delegated.forEach(({ parent, handler }, key) => {
                const [event] = key.split(':');
                parent.removeEventListener(event, handler);
            });
            
            // Clear all timers
            this.timers.forEach(timer => clearTimeout(timer));
            
            // Clear maps
            this.listeners.clear();
            this.delegated.clear();
            this.timers.clear();
        }
    }
    
    // ========================
    // GLOBAL INSTANCES
    // ========================
    
    const stateMachine = new StateMachine();
    const domCache = new ManagedDOMCache(CONFIG.cache.domCacheSize);
    const eventSystem = new ManagedEventSystem();
    const filterCache = new LRUCache(50, 1000);
    const centroidCache = new LRUCache(CONFIG.cache.centroidCacheSize, 60000);
    
    // Convenience functions
    const $ = (selector) => domCache.$(selector);
    const $1 = (selector) => domCache.$1(selector);
    const $id = (id) => domCache.$id(id);
    
    // ========================
    // CORE MAP MODULE
    // ========================
    
    const MapModule = (() => {
        let map = null;
        let markers = {
            localities: [],
            districts: []
        };
        
        const isMobile = window.innerWidth <= CONFIG.viewport.mobile.breakpoint || 
                        /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        function initialize() {
            stateMachine.transition(stateMachine.states.LOADING_MAP);
            
            // Pre-inject styles
            injectMapStyles();
            
            // Show loading screen
            const loadingScreen = $id('loading-map-screen');
            if (loadingScreen) {
                loadingScreen.style.display = 'flex';
            }
            
            // Initialize Mapbox
            const lang = navigator.language.split('-')[0];
            mapboxgl.accessToken = CONFIG.mapbox.accessToken;
            
            // RTL support
            if (CONFIG.mapbox.rtlLanguages.includes(lang)) {
                mapboxgl.setRTLTextPlugin(
                    "https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.3.0/mapbox-gl-rtl-text.js",
                    null,
                    true
                );
            }
            
            // Create map
            const viewport = isMobile ? CONFIG.viewport.mobile : CONFIG.viewport.desktop;
            map = new mapboxgl.Map({
                container: "map",
                style: CONFIG.mapbox.style,
                center: viewport.center,
                zoom: viewport.zoom,
                language: ['en','es','fr','de','zh','ja','ru','ar','he','fa','ur'].includes(lang) ? lang : 'en'
            });
            
            // Add controls
            setupMapControls();
            
            // Setup map events
            map.on('load', () => {
                stateMachine.transition(stateMachine.states.LOADING_DATA);
                DataModule.loadLocationData();
                LayerModule.initialize(map);
                
                // Defer non-critical features
                setTimeout(() => {
                    if (ControlsModule) ControlsModule.initialize();
                }, 1000);
                
                setTimeout(() => {
                    if (GeoDataModule) GeoDataModule.loadBoundaries();
                }, 2000);
                
                stateMachine.transition(stateMachine.states.MAP_READY);
                setTimeout(() => {
                    stateMachine.transition(stateMachine.states.IDLE);
                    hideLoadingScreen();
                }, 500);
            });
            
            return map;
        }
        
        function setupMapControls() {
            // Geolocation
            map.addControl(new mapboxgl.GeolocateControl({
                positionOptions: { enableHighAccuracy: true },
                trackUserLocation: true,
                showUserHeading: true
            }));
            
            // Navigation
            map.addControl(new mapboxgl.NavigationControl({
                showCompass: false,
                showZoom: true,
                visualizePitch: false
            }), 'top-right');
            
            // Scale
            const scalePosition = window.innerWidth <= 478 ? 'bottom-left' : 'bottom-right';
            map.addControl(new mapboxgl.ScaleControl({ maxWidth: 100, unit: 'metric' }), scalePosition);
            map.addControl(new mapboxgl.ScaleControl({ maxWidth: 100, unit: 'imperial' }), scalePosition);
            
            // Custom reset control
            map.addControl(new MapResetControl(), 'top-right');
        }
        
        function injectMapStyles() {
            if (!document.querySelector('#map-control-styles')) {
                const style = document.createElement('style');
                style.id = 'map-control-styles';
                style.textContent = `
                    .mapboxgl-ctrl-group > button {
                        background-color: #272727 !important;
                        color: #ffffff !important;
                    }
                    .mapboxgl-ctrl-group > button:hover {
                        background-color: #3a3a3a !important;
                    }
                    .mapboxgl-ctrl button.mapboxgl-ctrl-zoom-in .mapboxgl-ctrl-icon {
                        background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath style='fill:%23ffffff;' d='M 10 6 C 9.446 6 9 6.4459904 9 7 L 9 9 L 7 9 C 6.446 9 6 9.446 6 10 C 6 10.554 6.446 11 7 11 L 9 11 L 9 13 C 9 13.55401 9.446 14 10 14 C 10.554 14 11 13.55401 11 13 L 11 11 L 13 11 C 13.554 11 14 10.554 14 10 C 14 9.446 13.554 9 13 9 L 11 9 L 11 7 C 11 6.4459904 10.554 6 10 6 z'/%3E%3C/svg%3E") !important;
                    }
                    .mapboxgl-ctrl button.mapboxgl-ctrl-zoom-out .mapboxgl-ctrl-icon {
                        background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath style='fill:%23ffffff;' d='M 7 9 C 6.446 9 6 9.446 6 10 C 6 10.554 6.446 11 7 11 L 13 11 C 13.554 11 14 10.554 14 10 C 14 9.446 13.554 9 13 9 L 7 9 z'/%3E%3C/svg%3E") !important;
                    }
                    .mapboxgl-ctrl-scale {
                        pointer-events: none !important;
                        user-select: none !important;
                    }
                    .mapboxgl-ctrl-top-right {
                        top: 4rem !important;
                        right: 0.5rem !important;
                        z-index: 10 !important;
                    }
                `;
                document.head.appendChild(style);
            }
        }
        
        function hideLoadingScreen() {
            const loadingScreen = $id('loading-map-screen');
            if (loadingScreen) {
                loadingScreen.style.display = 'none';
            }
        }
        
        // Custom Reset Control
        class MapResetControl {
            onAdd(map) {
                this._map = map;
                this._container = document.createElement('div');
                this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
                
                this._button = document.createElement('button');
                this._button.className = 'mapboxgl-ctrl-icon';
                this._button.type = 'button';
                this._button.title = 'Reset view';
                this._button.setAttribute('aria-label', 'Reset view');
                
                this._button.style.cssText = `
                    background-image: url("https://cdn.prod.website-files.com/6824fc6dd9bace7c31d8a0d9/688f42ee2ee6b3760ab68bac_reset%20icon.svg");
                    background-repeat: no-repeat;
                    background-position: center;
                    background-size: 15px 15px;
                    background-color: #272727;
                `;
                
                this._button.addEventListener('click', () => {
                    const viewport = isMobile ? CONFIG.viewport.mobile : CONFIG.viewport.desktop;
                    this._map.flyTo({
                        center: viewport.center,
                        zoom: viewport.zoom,
                        duration: 1000,
                        essential: true
                    });
                    
                    FilterModule.clearFilters();
                });
                
                this._container.appendChild(this._button);
                return this._container;
            }
            
            onRemove() {
                this._container.parentNode.removeChild(this._container);
                this._map = undefined;
            }
        }
        
        return {
            initialize,
            getMap: () => map,
            flyTo: (coords, zoom = 13.5) => {
                if (map) {
                    map.flyTo({
                        center: coords,
                        zoom: zoom,
                        duration: 1000,
                        essential: true
                    });
                }
            },
            fitBounds: (bounds, options = {}) => {
                if (map) {
                    map.fitBounds(bounds, {
                        padding: options.padding || 50,
                        duration: options.duration || 1000,
                        essential: true,
                        ...options
                    });
                }
            }
        };
    })();
    
    // ========================
    // DATA MODULE
    // ========================
    
    const DataModule = (() => {
        const data = {
            localities: [],
            districts: [],
            allLocalityFeatures: [],
            allDistrictFeatures: []
        };
        
        function loadLocationData() {
            const lists = findFilterLists();
            let totalLoaded = 0;
            
            lists.forEach((listId, listIndex) => {
                const listContainer = $id(listId);
                if (!listContainer) return;
                
                // Optimized element collection
                const items = listContainer.children;
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    
                    const nameEl = item.querySelector('.data-places-names-filter');
                    const latEl = item.querySelector('.data-places-latitudes-filter');
                    const lngEl = item.querySelector('.data-places-longitudes-filter');
                    const districtEl = item.querySelector('.data-places-district-filter');
                    const slugEl = item.querySelector('.data-places-slug-filter');
                    
                    if (nameEl && latEl && lngEl) {
                        const lat = parseFloat(latEl.textContent);
                        const lng = parseFloat(lngEl.textContent);
                        
                        if (!isNaN(lat) && !isNaN(lng)) {
                            const feature = {
                                type: "Feature",
                                geometry: { type: "Point", coordinates: [lng, lat] },
                                properties: {
                                    name: nameEl.textContent.trim(),
                                    id: `location-${listIndex}-${i}`,
                                    district: districtEl?.textContent.trim() || '',
                                    slug: slugEl?.textContent.trim() || '',
                                    index: totalLoaded++,
                                    type: 'locality'
                                }
                            };
                            
                            data.localities.push(feature);
                            data.allLocalityFeatures.push(feature);
                        }
                    }
                }
            });
            
            // Load district tags
            loadDistrictTags();
            
            return data;
        }
        
        function loadDistrictTags() {
            const districtTagCollection = $id('district-tag-collection');
            if (!districtTagCollection) return;
            
            const districtTagItems = districtTagCollection.querySelectorAll('#district-tag-item');
            
            districtTagItems.forEach((tagItem) => {
                if (getComputedStyle(tagItem).display === 'none') return;
                
                const name = tagItem.getAttribute('district-tag-name');
                const lat = parseFloat(tagItem.getAttribute('district-tag-lattitude'));
                const lng = parseFloat(tagItem.getAttribute('district-tag-longitude'));
                
                if (name && !isNaN(lat) && !isNaN(lng)) {
                    data.allDistrictFeatures.push({
                        type: "Feature",
                        geometry: { type: "Point", coordinates: [lng, lat] },
                        properties: {
                            name: name,
                            id: `district-tag-${name.toLowerCase().replace(/\s+/g, '-')}`,
                            type: 'district',
                            source: 'tag'
                        }
                    });
                }
            });
        }
        
        function findFilterLists() {
            const lists = [];
            for (let i = 1; i <= 10; i++) {
                const listId = `cms-filter-list-${i}`;
                if ($id(listId)) {
                    lists.push(listId);
                } else if (lists.length === 0 && i > 3) {
                    break; // Early termination if no lists found
                }
            }
            return lists;
        }
        
        return {
            loadLocationData,
            getData: () => data,
            getLocalities: () => data.allLocalityFeatures,
            getDistricts: () => data.allDistrictFeatures
        };
    })();
    
    // ========================
    // LAYER MODULE
    // ========================
    
    const LayerModule = (() => {
        let map = null;
        const layerState = new Map();
        const sourceState = new Map();
        
        function initialize(mapInstance) {
            map = mapInstance;
            addLocalityMarkers();
            addDistrictMarkers();
        }
        
        function addLocalityMarkers() {
            const localities = DataModule.getLocalities();
            if (!localities.length) return;
            
            const sourceData = {
                type: "FeatureCollection",
                features: localities
            };
            
            if (map.getSource('localities-source')) {
                map.getSource('localities-source').setData(sourceData);
            } else {
                map.addSource('localities-source', {
                    type: 'geojson',
                    data: sourceData,
                    cluster: true,
                    clusterMaxZoom: 14,
                    clusterRadius: 50
                });
                
                // Cluster layer
                map.addLayer({
                    id: 'locality-clusters',
                    type: 'symbol',
                    source: 'localities-source',
                    filter: ['has', 'point_count'],
                    layout: {
                        'text-field': '{point_count_abbreviated}',
                        'text-font': ['Open Sans Regular'],
                        'text-size': 16,
                        'text-allow-overlap': true,
                        'text-ignore-placement': true
                    },
                    paint: {
                        'text-color': '#ffffff',
                        'text-halo-color': '#7e7800',
                        'text-halo-width': 2
                    }
                });
                
                // Individual points
                map.addLayer({
                    id: 'locality-points',
                    type: 'symbol',
                    source: 'localities-source',
                    filter: ['!', ['has', 'point_count']],
                    layout: {
                        'text-field': ['get', 'name'],
                        'text-font': ['Open Sans Regular'],
                        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 10, 12, 14, 16, 16],
                        'text-allow-overlap': false,
                        'text-ignore-placement': false,
                        'text-optional': true,
                        'text-padding': 4,
                        'text-offset': [0, 1.5],
                        'text-anchor': 'top'
                    },
                    paint: {
                        'text-color': '#ffffff',
                        'text-halo-color': '#7e7800',
                        'text-halo-width': 2,
                        'text-opacity': ['interpolate', ['linear'], ['zoom'], 8.5, 0, 9.5, 1]
                    }
                });
                
                setupLocalityClicks();
            }
            
            layerState.set('localities', true);
        }
        
        function addDistrictMarkers() {
            const districts = DataModule.getDistricts();
            if (!districts.length) return;
            
            const sourceData = {
                type: "FeatureCollection",
                features: districts
            };
            
            if (map.getSource('districts-source')) {
                map.getSource('districts-source').setData(sourceData);
            } else {
                map.addSource('districts-source', {
                    type: 'geojson',
                    data: sourceData
                });
                
                map.addLayer({
                    id: 'district-points',
                    type: 'symbol',
                    source: 'districts-source',
                    layout: {
                        'text-field': ['get', 'name'],
                        'text-font': ['Open Sans Regular'],
                        'text-size': ['interpolate', ['linear'], ['zoom'], 6, 12, 10, 16, 14, 18],
                        'text-allow-overlap': false,
                        'text-ignore-placement': false,
                        'text-optional': true,
                        'text-padding': 6,
                        'text-anchor': 'center'
                    },
                    paint: {
                        'text-color': '#ffffff',
                        'text-halo-color': '#6e3500',
                        'text-halo-width': 2,
                        'text-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0, 6, 1]
                    }
                });
                
                setupDistrictClicks();
            }
            
            layerState.set('districts', true);
        }
        
        function setupLocalityClicks() {
            map.on('click', 'locality-points', (e) => {
                if (stateMachine.is(stateMachine.states.MARKER_INTERACTION)) return;
                
                stateMachine.transition(stateMachine.states.MARKER_INTERACTION, {
                    type: 'locality',
                    name: e.features[0].properties.name
                });
                
                const locality = e.features[0].properties.name;
                FilterModule.selectLocality(locality);
                
                setTimeout(() => {
                    stateMachine.transition(stateMachine.states.IDLE);
                }, 800);
            });
            
            map.on('click', 'locality-clusters', (e) => {
                const features = map.queryRenderedFeatures(e.point, {
                    layers: ['locality-clusters']
                });
                
                map.flyTo({
                    center: features[0].geometry.coordinates,
                    zoom: map.getZoom() + 2.5,
                    duration: 800
                });
            });
            
            // Cursor management
            ['locality-clusters', 'locality-points'].forEach(layerId => {
                map.on('mouseenter', layerId, () => map.getCanvas().style.cursor = 'pointer');
                map.on('mouseleave', layerId, () => map.getCanvas().style.cursor = '');
            });
        }
        
        function setupDistrictClicks() {
            map.on('click', 'district-points', (e) => {
                if (stateMachine.is(stateMachine.states.MARKER_INTERACTION)) return;
                
                stateMachine.transition(stateMachine.states.MARKER_INTERACTION, {
                    type: 'district',
                    name: e.features[0].properties.name
                });
                
                const districtName = e.features[0].properties.name;
                FilterModule.selectDistrict(districtName);
                
                setTimeout(() => {
                    stateMachine.transition(stateMachine.states.IDLE);
                }, 800);
            });
            
            map.on('mouseenter', 'district-points', () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', 'district-points', () => map.getCanvas().style.cursor = '');
        }
        
        function updateLocalityLayer(features) {
            if (map && map.getSource('localities-source')) {
                map.getSource('localities-source').setData({
                    type: "FeatureCollection",
                    features: features
                });
            }
        }
        
        return {
            initialize,
            updateLocalityLayer,
            hasLayer: (id) => layerState.has(id),
            hasSource: (id) => sourceState.has(id)
        };
    })();
    
    // ========================
    // FILTER MODULE
    // ========================
    
    const FilterModule = (() => {
        const filterState = {
            activeFilters: new Set(),
            selectedLocality: null,
            selectedDistrict: null,
            searchText: '',
            isFiltering: false
        };
        
        function selectLocality(localityName) {
            filterState.selectedLocality = localityName;
            filterState.selectedDistrict = null;
            
            updateCheckboxes('locality', localityName);
            toggleFilteredElements(true);
            applyFilters();
        }
        
        function selectDistrict(districtName) {
            filterState.selectedDistrict = districtName;
            filterState.selectedLocality = null;
            
            updateCheckboxes('district', districtName);
            toggleFilteredElements(true);
            applyFilters();
        }
        
        function updateCheckboxes(type, value) {
            const allCheckboxes = $('[checkbox-filter] input[type="checkbox"]');
            
            // Clear all checkboxes
            allCheckboxes.forEach(checkbox => {
                if (checkbox.checked) {
                    checkbox.checked = false;
                    triggerCheckboxEvents(checkbox);
                }
            });
            
            // Check target checkbox
            const targetCheckbox = Array.from(allCheckboxes).find(checkbox => {
                const filterType = checkbox.closest('[checkbox-filter]').getAttribute('checkbox-filter');
                return filterType === type && checkbox.getAttribute('fs-list-value') === value;
            });
            
            if (targetCheckbox) {
                targetCheckbox.checked = true;
                triggerCheckboxEvents(targetCheckbox);
            }
        }
        
        function triggerCheckboxEvents(checkbox) {
            ['change', 'input'].forEach(eventType => {
                checkbox.dispatchEvent(new Event(eventType, { bubbles: true }));
            });
            
            const form = checkbox.closest('form');
            if (form) {
                form.dispatchEvent(new Event('change', { bubbles: true }));
                form.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
        
        function applyFilters() {
            if (!stateMachine.is(stateMachine.states.IDLE)) return;
            
            stateMachine.transition(stateMachine.states.FILTERING);
            
            // Get visible elements
            const visibleLocalities = getVisibleLocalities();
            
            // Update map
            if (visibleLocalities.length > 0) {
                LayerModule.updateLocalityLayer(visibleLocalities);
                
                // Fit bounds
                const bounds = new mapboxgl.LngLatBounds();
                visibleLocalities.forEach(feature => {
                    bounds.extend(feature.geometry.coordinates);
                });
                
                MapModule.fitBounds(bounds, {
                    padding: { top: 100, bottom: 100, left: 100, right: 100 },
                    maxZoom: 13
                });
            } else {
                // Reset view
                const viewport = window.innerWidth <= 768 ? 
                    CONFIG.viewport.mobile : CONFIG.viewport.desktop;
                MapModule.flyTo(viewport.center, viewport.zoom);
            }
            
            setTimeout(() => {
                stateMachine.transition(stateMachine.states.IDLE);
            }, 1000);
        }
        
        function getVisibleLocalities() {
            // Check cache first
            const cacheKey = `${filterState.selectedLocality}:${filterState.selectedDistrict}:${filterState.searchText}`;
            const cached = filterCache.get(cacheKey);
            if (cached) return cached;
            
            let visibleLocalities = DataModule.getLocalities();
            
            if (filterState.selectedLocality) {
                visibleLocalities = visibleLocalities.filter(f => 
                    f.properties.name === filterState.selectedLocality
                );
            } else if (filterState.selectedDistrict) {
                visibleLocalities = visibleLocalities.filter(f => 
                    f.properties.district === filterState.selectedDistrict
                );
            }
            
            // Cache result
            filterCache.set(cacheKey, visibleLocalities);
            
            return visibleLocalities;
        }
        
        function toggleFilteredElements(show) {
            const elements = document.querySelectorAll('[show-when-filtered="true"]');
            elements.forEach(element => {
                element.style.display = show ? 'block' : 'none';
                element.style.visibility = show ? 'visible' : 'hidden';
                element.style.opacity = show ? '1' : '0';
                element.style.pointerEvents = show ? 'auto' : 'none';
            });
        }
        
        function clearFilters() {
            filterState.selectedLocality = null;
            filterState.selectedDistrict = null;
            filterState.searchText = '';
            filterState.activeFilters.clear();
            
            updateCheckboxes(null, null);
            toggleFilteredElements(false);
            LayerModule.updateLocalityLayer(DataModule.getLocalities());
        }
        
        function isFiltering() {
            return filterState.selectedLocality !== null || 
                   filterState.selectedDistrict !== null ||
                   filterState.searchText !== '' ||
                   filterState.activeFilters.size > 0;
        }
        
        return {
            selectLocality,
            selectDistrict,
            applyFilters,
            clearFilters,
            isFiltering,
            getState: () => filterState
        };
    })();
    
    // ========================
    // SIDEBAR MODULE (DEFERRED)
    // ========================
    
    const SidebarModule = (() => {
        const sidebarState = {
            left: false,
            secondLeft: false,
            right: false
        };
        
        const sidebarCache = new Map();
        
        function initialize() {
            setupSidebarElements();
            setupSidebarEvents();
        }
        
        function setupSidebarElements() {
            ['Left', 'SecondLeft', 'Right'].forEach(side => {
                const sidebar = $id(`${side}Sidebar`);
                const tab = $id(`${side}SideTab`);
                const close = $id(`${side}SidebarClose`);
                
                if (sidebar && tab && close) {
                    sidebarCache.set(side, { sidebar, tab, close });
                    
                    // Setup events
                    eventSystem.on(tab, 'click', (e) => {
                        e.preventDefault();
                        toggleSidebar(side);
                    });
                    
                    eventSystem.on(close, 'click', (e) => {
                        e.preventDefault();
                        closeSidebar(side);
                    });
                }
            });
        }
        
        function setupSidebarEvents() {
            // Auto-open sidebars
            eventSystem.delegate(document, 'change', '[data-auto-sidebar="true"]', () => {
                if (window.innerWidth > 991) {
                    setTimeout(() => openSidebar('Left'), 50);
                }
            });
            
            eventSystem.delegate(document, 'change', '[data-auto-second-left-sidebar="true"]', () => {
                if (window.innerWidth > 991) {
                    setTimeout(() => openSidebar('SecondLeft'), 50);
                }
            });
        }
        
        function toggleSidebar(side, forceState = null) {
            if (!stateMachine.is(stateMachine.states.IDLE)) return;
            
            stateMachine.transition(stateMachine.states.SIDEBAR_TRANSITION, { side });
            
            const elements = sidebarCache.get(side);
            if (!elements) {
                stateMachine.transition(stateMachine.states.IDLE);
                return;
            }
            
            const isOpen = forceState !== null ? forceState : !sidebarState[side.toLowerCase()];
            sidebarState[side.toLowerCase()] = isOpen;
            
            elements.sidebar.classList.toggle('is-show', isOpen);
            
            // Handle margins and animations
            if (window.innerWidth > 478) {
                const width = parseInt(getComputedStyle(elements.sidebar).width) || 300;
                const marginProp = side === 'SecondLeft' ? 'marginLeft' : `margin${side}`;
                elements.sidebar.style[marginProp] = isOpen ? '0' : `-${width + 1}px`;
            }
            
            // Close other sidebars on mobile
            if (isOpen && window.innerWidth <= 991) {
                ['Left', 'SecondLeft', 'Right'].forEach(otherSide => {
                    if (otherSide !== side) closeSidebar(otherSide);
                });
            }
            
            setTimeout(() => {
                stateMachine.transition(stateMachine.states.IDLE);
            }, 250);
        }
        
        function openSidebar(side) {
            toggleSidebar(side, true);
        }
        
        function closeSidebar(side) {
            toggleSidebar(side, false);
        }
        
        return {
            initialize,
            toggleSidebar,
            openSidebar,
            closeSidebar,
            getState: () => sidebarState
        };
    })();
    
    // ========================
    // CONTROLS MODULE (DEFERRED)
    // ========================
    
    const ControlsModule = (() => {
        function initialize() {
            setupAreaControls();
            setupBackToTop();
            setupTabSwitcher();
        }
        
        function setupAreaControls() {
            const areaControls = [
                { keyId: 'area-a-key', layerId: 'area-a-layer' },
                { keyId: 'area-b-key', layerId: 'area-b-layer' },
                { keyId: 'area-c-key', layerId: 'area-c-layer' },
                { keyId: 'firing-zones-key', layerId: 'firing-zones-layer' }
            ];
            
            areaControls.forEach(control => {
                const checkbox = $id(control.keyId);
                if (!checkbox) return;
                
                checkbox.checked = false;
                
                eventSystem.on(checkbox, 'change', () => {
                    const map = MapModule.getMap();
                    if (!map || !map.getLayer(control.layerId)) return;
                    
                    const visibility = checkbox.checked ? 'none' : 'visible';
                    map.setLayoutProperty(control.layerId, 'visibility', visibility);
                });
            });
        }
        
        function setupBackToTop() {
            const button = $id('jump-to-top');
            const scrollContainer = $id('scroll-wrap');
            
            if (!button || !scrollContainer) return;
            
            let isVisible = false;
            const scrollThreshold = 100;
            
            const updateVisibility = () => {
                const scrollTop = scrollContainer.scrollTop;
                const shouldShow = scrollTop > scrollThreshold;
                
                if (shouldShow !== isVisible) {
                    isVisible = shouldShow;
                    button.style.opacity = shouldShow ? '1' : '0';
                    button.style.pointerEvents = shouldShow ? 'auto' : 'none';
                }
            };
            
            eventSystem.on(scrollContainer, 'scroll', eventSystem.debounce(updateVisibility, 100, 'scroll-top'));
            
            eventSystem.on(button, 'click', (e) => {
                e.preventDefault();
                scrollContainer.scrollTo({ top: 0, behavior: 'auto' });
            });
        }
        
        function setupTabSwitcher() {
            eventSystem.delegate(document, 'click', '[open-tab]', function(e) {
                if (!this.hasAttribute('open-right-sidebar')) {
                    e.preventDefault();
                }
                
                const groupName = this.getAttribute('open-tab');
                const targetTab = $1(`[opened-tab="${groupName}"]`);
                if (targetTab) targetTab.click();
            });
        }
        
        return {
            initialize
        };
    })();
    
    // ========================
    // GEODATA MODULE (DEFERRED)
    // ========================
    
    const GeoDataModule = (() => {
        function loadBoundaries() {
            fetch('https://cdn.jsdelivr.net/gh/Tovlim/COTO@main/Combined-GEOJSON-0.006.json')
                .then(response => response.json())
                .then(data => processBoundaries(data))
                .catch(error => console.error('Failed to load boundaries:', error));
        }
        
        function processBoundaries(data) {
            const map = MapModule.getMap();
            if (!map) return;
            
            data.features.forEach(feature => {
                if (feature.properties.type === 'district') {
                    addDistrictBoundary(feature);
                } else if (feature.properties.type === 'area') {
                    addAreaOverlay(feature);
                }
            });
        }
        
        function addDistrictBoundary(feature) {
            const map = MapModule.getMap();
            const name = feature.properties.name;
            const sourceId = `${name.toLowerCase().replace(/\s+/g, '-')}-boundary`;
            
            if (!map.getSource(sourceId)) {
                map.addSource(sourceId, {
                    type: 'geojson',
                    data: { type: "FeatureCollection", features: [feature] }
                });
                
                map.addLayer({
                    id: `${sourceId}-fill`,
                    type: 'fill',
                    source: sourceId,
                    paint: {
                        'fill-color': '#1a1b1e',
                        'fill-opacity': 0.15
                    }
                }, 'locality-clusters');
                
                map.addLayer({
                    id: `${sourceId}-border`,
                    type: 'line',
                    source: sourceId,
                    paint: {
                        'line-color': '#888888',
                        'line-width': 1,
                        'line-opacity': 0.4
                    }
                }, 'locality-clusters');
            }
        }
        
        function addAreaOverlay(feature) {
            const map = MapModule.getMap();
            const areaConfig = {
                'Area A': { color: '#adc278', layerId: 'area-a-layer' },
                'Area B': { color: '#ffdcc6', layerId: 'area-b-layer' },
                'Area C': { color: '#889c9b', layerId: 'area-c-layer' },
                'Firing Zones': { color: '#c51d3c', layerId: 'firing-zones-layer' }
            };
            
            const config = areaConfig[feature.properties.name];
            if (!config) return;
            
            const sourceId = `${config.layerId}-source`;
            
            if (!map.getSource(sourceId)) {
                map.addSource(sourceId, {
                    type: 'geojson',
                    data: { type: "FeatureCollection", features: [feature] }
                });
                
                map.addLayer({
                    id: config.layerId,
                    type: 'fill',
                    source: sourceId,
                    paint: {
                        'fill-color': config.color,
                        'fill-opacity': 0.5,
                        'fill-outline-color': config.color
                    }
                }, 'locality-clusters');
            }
        }
        
        return {
            loadBoundaries
        };
    })();
    
    // ========================
    // UTILITY FUNCTIONS
    // ========================
    
    const Utils = {
        calculateCentroid: (coordinates) => {
            // Check cache first
            const cacheKey = JSON.stringify(coordinates).substring(0, 100); // Limit key size
            const cached = centroidCache.get(cacheKey);
            if (cached) return cached;
            
            let totalLat = 0, totalLng = 0, pointCount = 0;
            
            const processCoords = coords => {
                if (Array.isArray(coords) && coords.length > 0) {
                    if (typeof coords[0] === 'number') {
                        totalLng += coords[0];
                        totalLat += coords[1];
                        pointCount++;
                    } else {
                        coords.forEach(processCoords);
                    }
                }
            };
            
            processCoords(coordinates);
            const result = pointCount > 0 ? [totalLng / pointCount, totalLat / pointCount] : [0, 0];
            
            // Cache result
            centroidCache.set(cacheKey, result);
            
            return result;
        }
    };
    
    // ========================
    // INITIALIZATION
    // ========================
    
    function initialize() {
        // Start state machine
        stateMachine.on('transition', (data) => {
            console.log(`State transition: ${data.from} → ${data.to}`);
        });
        
        // Initialize core modules
        MapModule.initialize();
        
        // Defer non-critical modules
        setTimeout(() => {
            SidebarModule.initialize();
        }, 1500);
        
        // Setup periodic cleanup
        setInterval(() => {
            domCache.cleanup();
            filterCache.cleanup();
            centroidCache.cleanup();
            
            // Clean up event system if too many timers
            if (eventSystem.timers.size > 15) {
                console.log('Cleaning up excessive timers');
                const timersToKeep = 10;
                let count = 0;
                eventSystem.timers.forEach((timer, key) => {
                    if (count >= timersToKeep) {
                        clearTimeout(timer);
                        eventSystem.timers.delete(key);
                    }
                    count++;
                });
            }
        }, 30000); // Every 30 seconds
        
        // Handle page unload
        window.addEventListener('beforeunload', cleanup);
    }
    
    function cleanup() {
        // Clean up all resources
        eventSystem.cleanup();
        domCache.clear();
        filterCache.clear();
        centroidCache.clear();
        
        // Clean up map
        const map = MapModule.getMap();
        if (map) {
            map.remove();
        }
    }
    
    // ========================
    // PUBLIC API
    // ========================
    
    window.MapApplication = {
        initialize,
        cleanup,
        state: stateMachine,
        modules: {
            map: MapModule,
            data: DataModule,
            filter: FilterModule,
            sidebar: SidebarModule
        },
        utils: Utils
    };
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    // Global exports for backward compatibility
    window.selectDistrictCheckbox = (name) => FilterModule.selectDistrict(name);
    window.selectLocalityCheckbox = (name) => FilterModule.selectLocality(name);
    window.applyFilterToMarkers = () => FilterModule.applyFilters();
    window.mapUtilities = {
        toggleSidebar: (side, state) => SidebarModule.toggleSidebar(side, state),
        toggleShowWhenFilteredElements: (show) => {
            const elements = document.querySelectorAll('[show-when-filtered="true"]');
            elements.forEach(el => {
                el.style.display = show ? 'block' : 'none';
            });
        },
        state: {
            markerInteractionLock: false
        }
    };
    
})();
