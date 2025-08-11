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
                    scoreThreshold: options.scoreThreshold || 0.3
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
                if (!searchText || searchText.length === 0) {
                    this.showAllItems();
                } else {
                    this.performSearch(searchText);
                }
                
                this.renderResults();
                this.showDropdown();
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
                // Set marker click flag
                window.isMarkerClick = true;
                
                // Clear any locks
                if (window.mapUtilities && window.mapUtilities.state) {
                    window.mapUtilities.state.markerInteractionLock = false;
                }
                
                // Select district checkbox
                if (window.selectDistrictCheckbox) {
                    window.selectDistrictCheckbox(districtName);
                }
                
                // Show filtered elements
                if (window.mapUtilities?.toggleShowWhenFilteredElements) {
                    window.mapUtilities.toggleShowWhenFilteredElements(true);
                }
                
                // Open sidebar on desktop
                if (window.innerWidth > 478 && window.mapUtilities?.toggleSidebar) {
                    window.mapUtilities.toggleSidebar('Left', true);
                }
                
                // Check if this district has boundaries and zoom to them
                const boundarySourceId = `${districtName.toLowerCase().replace(/\s+/g, '-')}-boundary`;
                
                if (window.map && window.map.getSource && window.map.getSource(boundarySourceId)) {
                    // District has boundaries - highlight and zoom to them
                    if (window.highlightBoundary) {
                        window.highlightBoundary(districtName);
                    }
                    
                    const source = window.map.getSource(boundarySourceId);
                    if (source && source._data) {
                        const bounds = new window.mapboxgl.LngLatBounds();
                        
                        const addCoords = coords => {
                            if (Array.isArray(coords) && coords.length > 0) {
                                if (typeof coords[0] === 'number') {
                                    bounds.extend(coords);
                                } else {
                                    coords.forEach(addCoords);
                                }
                            }
                        };
                        
                        source._data.features.forEach(feature => {
                            addCoords(feature.geometry.coordinates);
                        });
                        
                        // Zoom to boundaries
                        window.map.fitBounds(bounds, {
                            padding: 50,
                            duration: 1000,
                            essential: true
                        });
                    }
                } else {
                    // District without boundaries - use text search and reframe to filtered markers
                    const hiddenListSearch = document.getElementById('hidden-list-search');
                    if (hiddenListSearch) {
                        hiddenListSearch.value = districtName;
                        hiddenListSearch.dispatchEvent(new Event('input', { bubbles: true }));
                        hiddenListSearch.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    
                    // Force reframing to filtered markers
                    setTimeout(() => {
                        if (window.mapUtilities && window.mapUtilities.state) {
                            const state = window.mapUtilities.state;
                            state.flags.forceFilteredReframe = true;
                            state.flags.isRefreshButtonAction = true;
                            
                            if (window.applyFilterToMarkers) {
                                window.applyFilterToMarkers();
                                
                                setTimeout(() => {
                                    state.flags.forceFilteredReframe = false;
                                    state.flags.isRefreshButtonAction = false;
                                }, 1000);
                            }
                        }
                    }, 200);
                }
                
                // Clean up marker click flag
                setTimeout(() => {
                    window.isMarkerClick = false;
                    if (window.mapUtilities && window.mapUtilities.state) {
                        window.mapUtilities.state.markerInteractionLock = false;
                    }
                }, 800);
            }
            
            triggerSubregionSelection(subregionName) {
                // Subregions use text-based search, not checkbox selection
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
                
                // Trigger filtering with reframe for subregions
                setTimeout(() => {
                    if (window.mapUtilities && window.mapUtilities.state) {
                        const state = window.mapUtilities.state;
                        state.flags.forceFilteredReframe = true;
                        state.flags.isRefreshButtonAction = true;
                        
                        if (window.applyFilterToMarkers) {
                            window.applyFilterToMarkers();
                            
                            setTimeout(() => {
                                state.flags.forceFilteredReframe = false;
                                state.flags.isRefreshButtonAction = false;
                            }, 1000);
                        }
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
                
                this.showDropdown();
            }
            
            handleBlur() {
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

// COMBINED MAPBOX SCRIPT - Production Version 2025
// Optimized version without autocomplete loading dependency

// Detect mobile for better map experience
const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Pre-inject map control styles before map loads to prevent flash of unstyled content
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
    .mapboxgl-ctrl button.mapboxgl-ctrl-geolocate .mapboxgl-ctrl-icon {
      background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath style='fill:%23ffffff;' d='M10 4C9 4 9 5 9 5v.1A5 5 0 0 0 5.1 9H5s-1 0-1 1 1 1 1 1h.1A5 5 0 0 0 9 14.9v.1s0 1 1 1 1-1 1-1v-.1a5 5 0 0 0 3.9-3.9h.1s1 0 1-1-1-1-1-1h-.1A5 5 0 0 0 11 5.1V5s0-1-1-1zm0 2.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 1 1 0-7z'/%3E%3Ccircle style='fill:%23ffffff;' cx='10' cy='10' r='2'/%3E%3C/svg%3E") !important;
    }
    .mapboxgl-ctrl button.mapboxgl-ctrl-geolocate-active .mapboxgl-ctrl-icon {
      background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath style='fill:%2333b5e5;' d='M10 4C9 4 9 5 9 5v.1A5 5 0 0 0 5.1 9H5s-1 0-1 1 1 1 1 1h.1A5 5 0 0 0 9 14.9v.1s0 1 1 1 1-1 1-1v-.1a5 5 0 0 0 3.9-3.9h.1s1 0 1-1-1-1-1-1h-.1A5 5 0 0 0 11 5.1V5s0-1-1-1zm0 2.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 1 1 0-7z'/%3E%3Ccircle style='fill:%2333b5e5;' cx='10' cy='10' r='2'/%3E%3C/svg%3E") !important;
    }
    /* Scale control styles */
    .mapboxgl-ctrl-scale {
      pointer-events: none !important;
      user-select: none !important;
      cursor: default !important;
    }
    .mapboxgl-ctrl-bottom-left .mapboxgl-ctrl-scale:first-child,
    .mapboxgl-ctrl-bottom-right .mapboxgl-ctrl-scale:first-child {
      margin-bottom: 0 !important;
    }
    .mapboxgl-ctrl-bottom-left .mapboxgl-ctrl-scale:last-child,
    .mapboxgl-ctrl-bottom-right .mapboxgl-ctrl-scale:last-child {
      margin-top: 0 !important;
    }
    /* Pre-position controls to prevent layout shift */
    .mapboxgl-ctrl-top-right {
      top: 4rem !important;
      right: 0.5rem !important;
      z-index: 10 !important;
    }
    .mapboxgl-ctrl-bottom-left {
      bottom: 0 !important;
      left: 0 !important;
    }
    .mapboxgl-ctrl-bottom-right {
      bottom: 0 !important;
      right: 0 !important;
    }
    /* Mobile adjustments */
    @media (max-width: 478px) {
      .mapboxgl-ctrl-bottom-left {
        bottom: 0 !important;
        left: 0 !important;
      }
    }
  `;
  document.head.appendChild(style);
}

// Show loading screen at start
const loadingScreen = document.getElementById('loading-map-screen');
if (loadingScreen) {
  loadingScreen.style.display = 'flex';
}

// Fallback: Hide loading screen after max 20 seconds regardless
setTimeout(() => {
  const loadingScreen = document.getElementById('loading-map-screen');
  if (loadingScreen && loadingScreen.style.display !== 'none') {
    loadingScreen.style.display = 'none';
  }
}, 20000);

// Additional fallback: Mark any incomplete UI states as complete after reasonable delay
setTimeout(() => {
  if (!loadingTracker.states.sidebarSetup) {
    loadingTracker.markComplete('sidebarSetup');
  }
  if (!loadingTracker.states.eventsSetup) {
    loadingTracker.markComplete('eventsSetup');
  }
  if (!loadingTracker.states.uiPositioned) {
    loadingTracker.markComplete('uiPositioned');
  }
  if (!loadingTracker.states.backToTopSetup) {
    loadingTracker.markComplete('backToTopSetup');
  }
}, 12000);

// OPTIMIZED: Comprehensive DOM Element Cache
class OptimizedDOMCache {
  constructor() {
    this.cache = new Map();
    this.selectorCache = new Map();
    this.listCache = new Map();
    this._isStale = false;
  }
  
  // Single element getters with caching
  $id(id) {
    if (!this.cache.has(id)) {
      this.cache.set(id, document.getElementById(id));
    }
    return this.cache.get(id);
  }
  
  $1(selector) {
    if (!this.selectorCache.has(selector)) {
      this.selectorCache.set(selector, document.querySelector(selector));
    }
    return this.selectorCache.get(selector);
  }
  
  // Multiple element getters with caching
  $(selector) {
    if (!this.listCache.has(selector)) {
      this.listCache.set(selector, Array.from(document.querySelectorAll(selector)));
    }
    return this.listCache.get(selector);
  }
  
  // Clear cache when DOM changes significantly
  invalidate() {
    this.cache.clear();
    this.selectorCache.clear(); 
    this.listCache.clear();
    this._isStale = false;
  }
  
  // Partial invalidation for specific elements
  invalidateElement(id) {
    this.cache.delete(id);
  }
  
  // Smart cache refresh (only refresh elements that might have changed)
  refresh() {
    if (this._isStale) {
      this.invalidate();
    }
  }
  
  markStale() {
    this._isStale = true;
  }
}

// OPTIMIZED: Global DOM cache instance
const domCache = new OptimizedDOMCache();
const $ = (selector) => domCache.$(selector);
const $1 = (selector) => domCache.$1(selector);  
const $id = (id) => domCache.$id(id);

// OPTIMIZED: Event Listener Management System
class OptimizedEventManager {
  constructor() {
    this.listeners = new Map(); // elementId -> [{event, handler, options}]
    this.delegatedListeners = new Map(); // event -> [{selector, handler}]
    this.debounceTimers = new Map();
  }
  
  // Add tracked event listener
  add(element, event, handler, options = {}) {
    if (typeof element === 'string') {
      element = domCache.$id(element) || domCache.$1(element);
    }
    if (!element) return false;
    
    const elementId = element.id || `element-${Math.random().toString(36).substr(2, 9)}`;
    element.addEventListener(event, handler, options);
    
    if (!this.listeners.has(elementId)) {
      this.listeners.set(elementId, []);
    }
    
    this.listeners.get(elementId).push({ event, handler, options, element });
    return true;
  }
  
  // Add event delegation
  delegate(parentSelector, event, childSelector, handler) {
    const parent = domCache.$1(parentSelector);
    if (!parent) return false;
    
    const delegatedHandler = (e) => {
      if (e.target.matches(childSelector)) {
        handler.call(e.target, e);
      }
    };
    
    parent.addEventListener(event, delegatedHandler);
    
    if (!this.delegatedListeners.has(event)) {
      this.delegatedListeners.set(event, []);
    }
    
    this.delegatedListeners.get(event).push({
      parent,
      parentSelector, 
      childSelector,
      handler: delegatedHandler,
      originalHandler: handler
    });
    
    return true;
  }
  
  // Optimized debounce with cleanup
  debounce(fn, delay, id) {
    return (...args) => {
      const existingTimer = this.debounceTimers.get(id);
      if (existingTimer) clearTimeout(existingTimer);
      
      const timer = setTimeout(() => {
        this.debounceTimers.delete(id);
        fn(...args);
      }, delay);
      
      this.debounceTimers.set(id, timer);
    };
  }
  
  // Remove specific listener
  remove(elementId, event, handler) {
    const listeners = this.listeners.get(elementId);
    if (!listeners) return;
    
    const index = listeners.findIndex(l => l.event === event && l.handler === handler);
    if (index !== -1) {
      const listener = listeners[index];
      listener.element.removeEventListener(event, handler, listener.options);
      listeners.splice(index, 1);
    }
  }
  
  // Clean up all listeners (prevent memory leaks)
  cleanup() {
    // Clean up regular listeners
    this.listeners.forEach((listeners, elementId) => {
      listeners.forEach(({ element, event, handler, options }) => {
        element.removeEventListener(event, handler, options);
      });
    });
    
    // Clean up delegated listeners  
    this.delegatedListeners.forEach((listeners) => {
      listeners.forEach(({ parent, handler }) => {
        parent.removeEventListener('click', handler);
      });
    });
    
    // Clean up timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    
    // Clear all maps
    this.listeners.clear();
    this.delegatedListeners.clear();
    this.debounceTimers.clear();
  }
}

// OPTIMIZED: Global event manager
const eventManager = new OptimizedEventManager();

// Initialize Mapbox with enhanced RTL support
const lang = navigator.language.split('-')[0];
mapboxgl.accessToken = "pk.eyJ1Ijoibml0YWloYXJkeSIsImEiOiJjbWRzNGIxemIwMHVsMm1zaWp3aDl2Y3RsIn0.l_GLzIUCO84SF5_4TcmF3g";

// Enhanced RTL text support for multiple languages
const rtlLanguages = ['ar', 'he', 'fa', 'ur', 'yi'];
if (rtlLanguages.includes(lang)) {
  mapboxgl.setRTLTextPlugin(
    "https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.3.0/mapbox-gl-rtl-text.js",
    null,
    true // Lazy load the plugin
  );
}

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/nitaihardy/cmdp8fjw100ex01s83b2d6jzf",
  center: isMobile ? [34.85, 31.7] : [35.22, 31.85], // Mobile: both West Bank & Gaza, Desktop: West Bank focused
  zoom: isMobile ? 7.1 : 8.33,
  language: ['en','es','fr','de','zh','ja','ru','ar','he','fa','ur'].includes(lang) ? lang : 'en'
});

map.addControl(new mapboxgl.GeolocateControl({positionOptions: {enableHighAccuracy: true}, trackUserLocation: true, showUserHeading: true}));

// Add zoom controls (zoom in/out buttons)
map.addControl(new mapboxgl.NavigationControl({
  showCompass: false,  // Hide compass, only show zoom buttons
  showZoom: true,      // Show zoom in/out buttons
  visualizePitch: false // Hide pitch visualization
}), 'top-right');

// Add scale control to bottom-right (desktop) or bottom-left (mobile)
const scaleControl = new mapboxgl.ScaleControl({
  maxWidth: 100,
  unit: 'metric'
});

// Add imperial scale control (miles/feet)
const imperialScaleControl = new mapboxgl.ScaleControl({
  maxWidth: 100,
  unit: 'imperial'
});

const scalePosition = window.innerWidth <= 478 ? 'bottom-left' : 'bottom-right';
map.addControl(scaleControl, scalePosition);
map.addControl(imperialScaleControl, scalePosition);

// Custom Map Reset Control
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
    
    // Add custom reset icon styling
    this._button.style.cssText = `
      background-image: url("https://cdn.prod.website-files.com/6824fc6dd9bace7c31d8a0d9/688f42ee2ee6b3760ab68bac_reset%20icon.svg");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 15px 15px;
      background-color: #272727;
    `;
    
    this._button.addEventListener('click', () => {
      // Reset to default position (responsive for mobile/desktop)
      this._map.flyTo({
        center: isMobile ? [34.85, 31.7] : [35.22, 31.85],
        zoom: isMobile ? 7.1 : 8.33,
        duration: 1000,
        essential: true
      });
      
      // Reset locality markers to show all
      if (this._map.getSource('localities-source')) {
        this._map.getSource('localities-source').setData({type: "FeatureCollection", features: state.allLocalityFeatures});
      }
      
      // Remove any boundary highlight
      removeBoundaryHighlight();
    });
    
    this._container.appendChild(this._button);
    return this._container;
  }
  
  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
  }
}

// Add the custom reset control
map.addControl(new MapResetControl(), 'top-right');

// OPTIMIZED: Smart State Management  
class OptimizedMapState {
  constructor() {
    this.locationData = {type: "FeatureCollection", features: []};
    this.allLocalityFeatures = [];
    this.allDistrictFeatures = [];
    this.timers = new Map();
    this.lastClickedMarker = null;
    this.lastClickTime = 0;
    this.markerInteractionLock = false;
    this.highlightedBoundary = null;
    
    this.flags = new Proxy({
      isInitialLoad: true,
      mapInitialized: false,
      forceFilteredReframe: false,
      isRefreshButtonAction: false,
      dropdownListenersSetup: false,
      districtTagsLoaded: false,
      areaControlsSetup: false,
      skipNextReframe: false
    }, {
      set: (target, property, value) => {
        target[property] = value;
        return true;
      }
    });
  }
  
  setTimer(id, callback, delay) {
    if (this.timers.has(id)) {
      clearTimeout(this.timers.get(id));
    }
    this.timers.set(id, setTimeout(() => {
      this.timers.delete(id);
      callback();
    }, delay));
  }
  
  clearTimer(id) {
    if (this.timers.has(id)) {
      clearTimeout(this.timers.get(id));
      this.timers.delete(id);
    }
  }
  
  cleanup() {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }
}

// OPTIMIZED: Global state management with loading tracker
const state = new OptimizedMapState();
window.isLinkClick = false;

// ENHANCED: Loading state tracker (removed autocompleteReady and tab switcher)
const loadingTracker = {
  states: {
    mapInitialized: false,
    locationDataLoaded: false,
    markersAdded: false,
    geoDataLoaded: false,
    districtTagsLoaded: false,
    sidebarSetup: false,
    eventsSetup: false,
    uiPositioned: false,
    backToTopSetup: false
  },
  
  markComplete(stateName) {
    if (this.states.hasOwnProperty(stateName)) {
      this.states[stateName] = true;
      this.checkAllComplete();
    }
  },
  
  checkAllComplete() {
    const allComplete = Object.values(this.states).every(state => state === true);
    if (allComplete) {
      this.hideLoadingScreen();
    }
  },
  
  hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-map-screen');
    if (loadingScreen && loadingScreen.style.display !== 'none') {
      loadingScreen.style.display = 'none';
    }
  }
};

// OPTIMIZED: High-performance utilities
const utils = {
  // Cached utility functions
  _eventCache: new Map(),
  _styleCache: new Map(),
  
  triggerEvent: (el, events) => {
    events.forEach(eventType => {
      if (!utils._eventCache.has(eventType)) {
        utils._eventCache.set(eventType, new Event(eventType, {bubbles: true}));
      }
      el.dispatchEvent(utils._eventCache.get(eventType));
    });
  },
  
  setStyles: (el, styles) => {
    // Batch style applications for better performance
    requestAnimationFrame(() => {
      Object.assign(el.style, styles);
    });
  },
  
  calculateCentroid: (() => {
    // Cache centroid calculations for same coordinate sets
    const cache = new Map();
    
    return (coordinates) => {
      const key = JSON.stringify(coordinates);
      if (cache.has(key)) {
        return cache.get(key);
      }
      
      let totalLat = 0, totalLng = 0, pointCount = 0;
      
      const processCoords = coords => {
        if (Array.isArray(coords) && coords.length > 0) {
          if (typeof coords[0] === 'number') {
            totalLng += coords[0];
            totalLat += coords[1];
            pointCount++;
          } else coords.forEach(processCoords);
        }
      };
      
      processCoords(coordinates);
      const result = pointCount > 0 ? [totalLng / pointCount, totalLat / pointCount] : [0, 0];
      
      // Cache result (limit cache size)
      if (cache.size < 100) {
        cache.set(key, result);
      }
      
      return result;
    };
  })()
};

// OPTIMIZED: Map Layer Management System
class OptimizedMapLayers {
  constructor(map) {
    this.map = map;
    this.layerOrder = [];
    this.sourceCache = new Map();
    this.layerCache = new Map();
    this.batchOperations = [];
    this.pendingBatch = false;
  }
  
  // Batch multiple operations for better performance
  addToBatch(operation) {
    this.batchOperations.push(operation);
    if (!this.pendingBatch) {
      this.pendingBatch = true;
      requestAnimationFrame(() => this.processBatch());
    }
  }
  
  processBatch() {
    this.batchOperations.forEach(operation => {
      try {
        operation();
      } catch (error) {
        // Silent error handling in production
      }
    });
    
    this.batchOperations = [];
    this.pendingBatch = false;
    
    // Optimize layer order once after batch
    this.optimizeLayerOrder();
  }
  
  // Optimized layer existence check with caching
  hasLayer(layerId) {
    if (this.layerCache.has(layerId)) {
      return this.layerCache.get(layerId);
    }
    
    const exists = !!this.map.getLayer(layerId);
    this.layerCache.set(layerId, exists);
    return exists;
  }
  
  hasSource(sourceId) {
    if (this.sourceCache.has(sourceId)) {
      return this.sourceCache.get(sourceId);
    }
    
    const exists = !!this.map.getSource(sourceId);
    this.sourceCache.set(sourceId, exists);
    return exists;
  }
  
  // Smart layer ordering - only reorder when necessary
  optimizeLayerOrder() {
    const markerLayers = ['locality-clusters', 'locality-points', 'district-points'];
    const currentOrder = this.map.getStyle().layers.map(l => l.id);
    
    // Check if reordering is needed
    const markerIndices = markerLayers
      .filter(id => this.hasLayer(id))
      .map(id => currentOrder.indexOf(id));
      
    const needsReorder = markerIndices.some((index, i) => {
      return i > 0 && index < markerIndices[i - 1];
    });
    
    if (needsReorder) {
      markerLayers.forEach(layerId => {
        if (this.hasLayer(layerId)) {
          try {
            const layer = this.map.getStyle().layers.find(l => l.id === layerId);
            if (layer) {
              this.map.removeLayer(layerId);
              this.map.addLayer(layer);
              this.layerCache.delete(layerId); // Invalidate cache
            }
          } catch (e) {
            // Silent error handling in production
          }
        }
      });
    }
  }
  
  // Clear caches when layers change significantly
  invalidateCache() {
    this.layerCache.clear();
    this.sourceCache.clear();
  }
}

// OPTIMIZED: Global layer manager
const mapLayers = new OptimizedMapLayers(map);

// OPTIMIZED: Sidebar element and arrow icon caching
const sidebarCache = {
  elements: new Map(),
  arrows: new Map(),
  widths: new Map(),
  
  getSidebar(side) {
    if (!this.elements.has(side)) {
      this.elements.set(side, $id(`${side}Sidebar`));
    }
    return this.elements.get(side);
  },
  
  getArrow(side) {
    if (!this.arrows.has(side)) {
      const arrowKey = side === 'SecondLeft' ? 'secondleft' : side.toLowerCase();
      this.arrows.set(side, $1(`[arrow-icon="${arrowKey}"]`));
    }
    return this.arrows.get(side);
  },
  
  getWidth(side) {
    if (!this.widths.has(side)) {
      const sidebar = this.getSidebar(side);
      if (sidebar) {
        this.widths.set(side, parseInt(getComputedStyle(sidebar).width) || 300);
      }
    }
    return this.widths.get(side) || 300;
  },
  
  getMarginProperty(side) {
    return side === 'SecondLeft' ? 'marginLeft' : `margin${side}`;
  },
  
  invalidate() {
    this.elements.clear();
    this.arrows.clear();
    this.widths.clear();
  }
};

// OPTIMIZED: Helper function to close a sidebar without recursion
const closeSidebar = (side) => {
  const sidebar = sidebarCache.getSidebar(side);
  if (!sidebar || !sidebar.classList.contains('is-show')) return;
  
  // Remove the show class
  sidebar.classList.remove('is-show');
  
  // Reset arrow icon
  const arrowIcon = sidebarCache.getArrow(side);
  if (arrowIcon) arrowIcon.style.transform = 'rotateY(0deg)';
  
  // Handle margin based on screen size
  const jsMarginProperty = sidebarCache.getMarginProperty(side);
  if (window.innerWidth > 478) {
    const width = sidebarCache.getWidth(side);
    sidebar.style[jsMarginProperty] = `-${width + 1}px`;
  } else {
    sidebar.style[jsMarginProperty] = '';
  }
  
  // Reset pointer events
  sidebar.style.pointerEvents = '';
};

// OPTIMIZED: Toggle sidebar with improved caching and helper functions
const toggleSidebar = (side, show = null) => {
  const sidebar = sidebarCache.getSidebar(side);
  if (!sidebar) return;
  
  const isShowing = show !== null ? show : !sidebar.classList.contains('is-show');
  sidebar.classList.toggle('is-show', isShowing);
  
  const jsMarginProperty = sidebarCache.getMarginProperty(side);
  const arrowIcon = sidebarCache.getArrow(side);
  
  if (window.innerWidth > 478) {
    const width = sidebarCache.getWidth(side);
    sidebar.style[jsMarginProperty] = isShowing ? '0' : `-${width + 1}px`;
    
    // Close other sidebars based on screen size
    if (isShowing) {
      if (window.innerWidth <= 991) {
        // Close ALL other sidebars on devices 991px and down
        ['Left', 'SecondLeft', 'Right'].forEach(otherSide => {
          if (otherSide !== side) closeSidebar(otherSide);
        });
      } else if (side === 'Left' || side === 'SecondLeft') {
        // On desktop (>991px): only close other left sidebars when opening a left sidebar
        const otherLeftSide = side === 'Left' ? 'SecondLeft' : 'Left';
        closeSidebar(otherLeftSide);
      }
    }
  } else {
    // Mobile (478px and down): use margin behavior and close all other sidebars
    sidebar.style[jsMarginProperty] = isShowing ? '0' : '';
    if (isShowing) {
      ['Left', 'SecondLeft', 'Right'].forEach(otherSide => {
        if (otherSide !== side) closeSidebar(otherSide);
      });
    }
  }
  
  // Set pointer events and arrow icon for the current sidebar
  utils.setStyles(sidebar, {pointerEvents: isShowing ? 'auto' : ''});
  if (arrowIcon) arrowIcon.style.transform = isShowing ? 'rotateY(180deg)' : 'rotateY(0deg)';
};

// Highlight boundary with subtle red color and move above area overlays
function highlightBoundary(districtName) {
  // Remove any existing highlight first
  removeBoundaryHighlight();
  
  const boundaryFillId = `${districtName.toLowerCase().replace(/\s+/g, '-')}-fill`;
  const boundaryBorderId = `${districtName.toLowerCase().replace(/\s+/g, '-')}-border`;
  
  if (mapLayers.hasLayer(boundaryFillId) && mapLayers.hasLayer(boundaryBorderId)) {
    // Batch boundary highlighting operations
    mapLayers.addToBatch(() => {
      map.setPaintProperty(boundaryFillId, 'fill-color', '#6e3500');
      map.setPaintProperty(boundaryFillId, 'fill-opacity', 0.25);
      map.setPaintProperty(boundaryBorderId, 'line-color', '#6e3500');
      map.setPaintProperty(boundaryBorderId, 'line-opacity', 0.6);
    });
    
    // Track the highlighted boundary
    state.highlightedBoundary = districtName;
  }
}

// Remove boundary highlight and move back below area overlays
function removeBoundaryHighlight() {
  if (state.highlightedBoundary) {
    const boundaryFillId = `${state.highlightedBoundary.toLowerCase().replace(/\s+/g, '-')}-fill`;
    const boundaryBorderId = `${state.highlightedBoundary.toLowerCase().replace(/\s+/g, '-')}-border`;
    
    if (mapLayers.hasLayer(boundaryFillId) && mapLayers.hasLayer(boundaryBorderId)) {
      // Batch boundary reset operations
      mapLayers.addToBatch(() => {
        map.setPaintProperty(boundaryFillId, 'fill-color', '#1a1b1e');
        map.setPaintProperty(boundaryFillId, 'fill-opacity', 0.15);
        map.setPaintProperty(boundaryBorderId, 'line-color', '#888888');
        map.setPaintProperty(boundaryBorderId, 'line-opacity', 0.4);
      });
    }
    
    state.highlightedBoundary = null;
  }
}

// FIXED: Toggle filtered elements with immediate DOM updates (no batching for critical UI)
const toggleShowWhenFilteredElements = show => {
  // Don't use cached results for critical filtering elements - always fresh query
  const elements = document.querySelectorAll('[show-when-filtered="true"]');
  if (elements.length === 0) return;
  
  // Apply changes immediately without requestAnimationFrame batching
  elements.forEach(element => {
    element.style.display = show ? 'block' : 'none';
    element.style.visibility = show ? 'visible' : 'hidden';
    element.style.opacity = show ? '1' : '0';
    element.style.pointerEvents = show ? 'auto' : 'none';
  });
};

// OPTIMIZED: Checkbox selection functions with batched operations
function selectDistrictCheckbox(districtName) {
  const districtCheckboxes = $('[checkbox-filter="district"] input[fs-list-value]');
  const localityCheckboxes = $('[checkbox-filter="locality"] input[fs-list-value]');
  
  // Batch checkbox operations
  requestAnimationFrame(() => {
    // Clear all checkboxes first (batch operation)
    [...districtCheckboxes, ...localityCheckboxes].forEach(checkbox => {
      if (checkbox.checked) {
        checkbox.checked = false;
        utils.triggerEvent(checkbox, ['change', 'input']);
        
        const form = checkbox.closest('form');
        if (form) {
          form.dispatchEvent(new Event('change', {bubbles: true}));
          form.dispatchEvent(new Event('input', {bubbles: true}));
        }
      }
    });
    
    // Find and check target checkbox
    const targetCheckbox = districtCheckboxes.find(checkbox => 
      checkbox.getAttribute('fs-list-value') === districtName
    );
    
    if (targetCheckbox) {
      targetCheckbox.checked = true;
      utils.triggerEvent(targetCheckbox, ['change', 'input']);
      
      const form = targetCheckbox.closest('form');
      if (form) {
        form.dispatchEvent(new Event('change', {bubbles: true}));
        form.dispatchEvent(new Event('input', {bubbles: true}));
      }
    }
  });
}

function selectLocalityCheckbox(localityName) {
  const districtCheckboxes = $('[checkbox-filter="district"] input[fs-list-value]');
  const localityCheckboxes = $('[checkbox-filter="locality"] input[fs-list-value]');
  
  // Batch checkbox operations
  requestAnimationFrame(() => {
    // Clear all checkboxes first
    [...districtCheckboxes, ...localityCheckboxes].forEach(checkbox => {
      if (checkbox.checked) {
        checkbox.checked = false;
        utils.triggerEvent(checkbox, ['change', 'input']);
        
        const form = checkbox.closest('form');
        if (form) {
          form.dispatchEvent(new Event('change', {bubbles: true}));
          form.dispatchEvent(new Event('input', {bubbles: true}));
        }
      }
    });
    
    // Find and check target checkbox
    const targetCheckbox = localityCheckboxes.find(checkbox => 
      checkbox.getAttribute('fs-list-value') === localityName
    );
    
    if (targetCheckbox) {
      targetCheckbox.checked = true;
      utils.triggerEvent(targetCheckbox, ['change', 'input']);
      
      const form = targetCheckbox.closest('form');
      if (form) {
        form.dispatchEvent(new Event('change', {bubbles: true}));
        form.dispatchEvent(new Event('input', {bubbles: true}));
      }
    }
  });
}

// OPTIMIZED: Smart filter list discovery with caching
const getAvailableFilterLists = (() => {
  let cachedLists = null;
  let lastCacheTime = 0;
  const cacheTimeout = 5000; // Cache for 5 seconds
  
  return () => {
    const now = Date.now();
    if (cachedLists && (now - lastCacheTime) < cacheTimeout) {
      return cachedLists;
    }
    
    const lists = [];
    let consecutiveGaps = 0;
    
    // More efficient scanning with early termination
    for (let i = 1; i <= 20; i++) {
      const listId = `cms-filter-list-${i}`;
      if ($id(listId)) {
        lists.push(listId);
        consecutiveGaps = 0;
      } else {
        consecutiveGaps++;
        if (consecutiveGaps >= 3 && lists.length === 0) {
          // Early termination if no lists found
          break;
        }
        if (consecutiveGaps >= 5) {
          // Stop after 5 consecutive gaps
          break;
        }
      }
    }
    
    cachedLists = lists;
    lastCacheTime = now;
    return lists;
  };
})();

// OPTIMIZED: Location data extraction with preprocessing and caching
function getLocationData() {
  state.locationData.features = [];
  
  const lists = getAvailableFilterLists();
  let totalLoaded = 0;
  
  if (lists.length === 0) {
    return;
  }
  
  // Batch process all lists
  lists.forEach((listId, listIndex) => {
    const listContainer = $id(listId);
    if (!listContainer) return;
    
    // Single query for all needed elements
    const allElements = listContainer.querySelectorAll(`
      .data-places-names-filter,
      .data-places-latitudes-filter, 
      .data-places-longitudes-filter,
      .data-places-slug-filter,
      .data-places-district-filter
    `);
    
    // Group elements by type for faster processing
    const elementsByType = {
      names: [],
      lats: [],
      lngs: [],
      slugs: [],
      districts: []
    };
    
    allElements.forEach(el => {
      if (el.classList.contains('data-places-names-filter')) elementsByType.names.push(el);
      else if (el.classList.contains('data-places-latitudes-filter')) elementsByType.lats.push(el);
      else if (el.classList.contains('data-places-longitudes-filter')) elementsByType.lngs.push(el);
      else if (el.classList.contains('data-places-slug-filter')) elementsByType.slugs.push(el);
      else if (el.classList.contains('data-places-district-filter')) elementsByType.districts.push(el);
    });
    
    const minLength = Math.min(
      elementsByType.names.length, 
      elementsByType.lats.length, 
      elementsByType.lngs.length
    );
    
    // Batch create features
    const features = [];
    for (let i = 0; i < minLength; i++) {
      const lat = parseFloat(elementsByType.lats[i].textContent);
      const lng = parseFloat(elementsByType.lngs[i].textContent);
      
      if (!isNaN(lat) && !isNaN(lng)) {
        features.push({
          type: "Feature",
          geometry: {type: "Point", coordinates: [lng, lat]},
          properties: {
            name: elementsByType.names[i].textContent.trim(),
            id: `location-${listIndex}-${i}`,
            popupIndex: totalLoaded + i,
            slug: elementsByType.slugs[i]?.textContent.trim() || '',
            district: elementsByType.districts[i]?.textContent.trim() || '',
            index: totalLoaded + i,
            listId: listId,
            type: 'locality'
          }
        });
      }
    }
    
    state.locationData.features.push(...features);
    totalLoaded += features.length;
  });
  
  // Store all locality features for reset functionality
  state.allLocalityFeatures = [...state.locationData.features];
  
  // Mark loading step complete
  loadingTracker.markComplete('locationDataLoaded');
}

// OPTIMIZED: Native markers with batched operations
function addNativeMarkers() {
  if (!state.locationData.features.length) return;
  
  // Batch add source and layers
  mapLayers.addToBatch(() => {
    if (mapLayers.hasSource('localities-source')) {
      map.getSource('localities-source').setData(state.locationData);
    } else {
      map.addSource('localities-source', {
        type: 'geojson',
        data: state.locationData,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50
      });
      
      // Add clustered points layer
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
      
      // Add individual locality points layer WITHOUT highlighting (FIX #2)
      map.addLayer({
        id: 'locality-points',
        type: 'symbol',
        source: 'localities-source',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 10,
            12, 14,
            16, 16
          ],
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'text-optional': true,
          'text-padding': 4,
          'text-offset': [0, 1.5],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#7e7800', // Always use normal color (no highlighting)
          'text-halo-width': 2,
          'text-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            isMobile ? 7.1 : 8.5, 0,
            isMobile ? 8.1 : 9.5, 1
          ]
        }
      });
      
      mapLayers.invalidateCache(); // Invalidate cache after adding layers
    }
  });
  
  setupNativeMarkerClicks();
  
  // Mark loading step complete
  loadingTracker.markComplete('markersAdded');
}

// OPTIMIZED: District markers with batched operations  
function addNativeDistrictMarkers() {
  if (!state.allDistrictFeatures.length) return;
  
  mapLayers.addToBatch(() => {
    if (mapLayers.hasSource('districts-source')) {
      map.getSource('districts-source').setData({
        type: "FeatureCollection",
        features: state.allDistrictFeatures
      });
    } else {
      map.addSource('districts-source', {
        type: 'geojson',
        data: {
          type: "FeatureCollection",
          features: state.allDistrictFeatures
        }
      });
      
      map.addLayer({
        id: 'district-points',
        type: 'symbol',
        source: 'districts-source',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            6, 12,
            10, 16,
            14, 18
          ],
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'text-optional': true,
          'text-padding': 6,
          'text-offset': [0, 0],
          'text-anchor': 'center'
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#6e3500',
          'text-halo-width': 2,
          'text-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5, 0,
            6, 1
          ]
        }
      });
      
      mapLayers.invalidateCache(); // Invalidate cache after adding layers
    }
  });
  
  setupDistrictMarkerClicks();
}

// OPTIMIZED: Event setup with proper management and delegation
function setupNativeMarkerClicks() {
  // Remove old listeners if they exist to prevent duplicates
  eventManager.listeners.forEach((listeners, elementId) => {
    if (elementId.includes('locality') || elementId.includes('district')) {
      listeners.forEach(({element, event, handler, options}) => {
        element.removeEventListener(event, handler, options);
      });
      eventManager.listeners.delete(elementId);
    }
  });
  
  // Locality point clicks
  const localityClickHandler = (e) => {
    const feature = e.features[0];
    const locality = feature.properties.name;
    
    // Prevent rapid clicks
    const currentTime = Date.now();
    const markerKey = `locality-${locality}`;
    if (state.lastClickedMarker === markerKey && currentTime - state.lastClickTime < 1000) {
      return;
    }
    
    state.markerInteractionLock = true;
    state.lastClickedMarker = markerKey;
    state.lastClickTime = currentTime;
    window.isMarkerClick = true;
    
    removeBoundaryHighlight();
    selectLocalityCheckbox(locality);
    toggleShowWhenFilteredElements(true);
    toggleSidebar('Left', true);
    
    // No flying/reframing when clicking map markers - user already sees where it is
    
    state.setTimer('markerCleanup', () => {
      window.isMarkerClick = false;
      state.markerInteractionLock = false;
    }, 800);
  };
  
  // Cluster clicks
  const clusterClickHandler = (e) => {
    removeBoundaryHighlight();
    
    const features = map.queryRenderedFeatures(e.point, {
      layers: ['locality-clusters']
    });
    
    map.flyTo({
      center: features[0].geometry.coordinates,
      zoom: map.getZoom() + 2.5,
      duration: 800
    });
  };
  
  // Use map event listeners (these are automatically managed by Mapbox)
  map.on('click', 'locality-points', localityClickHandler);
  map.on('click', 'locality-clusters', clusterClickHandler);
  
  // Cursor management
  ['locality-clusters', 'locality-points'].forEach(layerId => {
    map.on('mouseenter', layerId, () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', layerId, () => map.getCanvas().style.cursor = '');
  });
}

function setupDistrictMarkerClicks() {
  const districtClickHandler = (e) => {
    const feature = e.features[0];
    const districtName = feature.properties.name;
    const districtSource = feature.properties.source;
    
    // Prevent rapid clicks
    const currentTime = Date.now();
    const markerKey = `district-${districtName}`;
    if (state.lastClickedMarker === markerKey && currentTime - state.lastClickTime < 1000) {
      return;
    }
    
    state.markerInteractionLock = true;
    state.lastClickedMarker = markerKey;
    state.lastClickTime = currentTime;
    window.isMarkerClick = true;
    
    selectDistrictCheckbox(districtName);
    toggleShowWhenFilteredElements(true);
    toggleSidebar('Left', true);
    
    if (districtSource === 'boundary') {
      highlightBoundary(districtName);
      
      const boundarySourceId = `${districtName.toLowerCase().replace(/\s+/g, '-')}-boundary`;
      const source = map.getSource(boundarySourceId);
      if (source && source._data) {
        const bounds = new mapboxgl.LngLatBounds();
        const addCoords = coords => {
          if (Array.isArray(coords) && coords.length > 0) {
            if (typeof coords[0] === 'number') bounds.extend(coords);
            else coords.forEach(addCoords);
          }
        };
        
        source._data.features.forEach(feature => addCoords(feature.geometry.coordinates));
        map.fitBounds(bounds, {padding: 50, duration: 1000, essential: true});
      } else {
        removeBoundaryHighlight();
        state.setTimer('districtFallback', () => {
          state.flags.forceFilteredReframe = true;
          state.flags.isRefreshButtonAction = true;
          applyFilterToMarkers();
          state.setTimer('districtFallbackCleanup', () => {
            state.flags.forceFilteredReframe = false;
            state.flags.isRefreshButtonAction = false;
          }, 1000);
        }, 200);
      }
    } else {
      // District without boundary - paste to hidden-list-search
      removeBoundaryHighlight();
      
      const hiddenListSearch = document.getElementById('hidden-list-search');
      if (hiddenListSearch) {
        hiddenListSearch.value = districtName;
        hiddenListSearch.dispatchEvent(new Event('input', { bubbles: true }));
        hiddenListSearch.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      state.setTimer('districtTagBased', () => {
        state.flags.forceFilteredReframe = true;
        state.flags.isRefreshButtonAction = true;
        applyFilterToMarkers();
        state.setTimer('districtTagBasedCleanup', () => {
          state.flags.forceFilteredReframe = false;
          state.flags.isRefreshButtonAction = false;
        }, 1000);
      }, 200);
    }
    
    state.setTimer('markerCleanup', () => {
      window.isMarkerClick = false;
      state.markerInteractionLock = false;
    }, 800);
  };
  
  map.on('click', 'district-points', districtClickHandler);
  map.on('mouseenter', 'district-points', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'district-points', () => map.getCanvas().style.cursor = '');
}

// OPTIMIZED: Filtering checks with caching and memoization
const checkFiltering = (() => {
  const cache = new Map();
  const cacheTimeout = 1000; // Cache for 1 second
  
  return (instance) => {
    const cacheKey = `${instance}-${Date.now() - (Date.now() % cacheTimeout)}`;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }
    
    let result = false;
    
    if (window.fsAttributes?.cmsfilter) {
      const filterInstance = window.fsAttributes.cmsfilter.getByInstance(instance);
      if (filterInstance) {
        const activeFilters = filterInstance.filtersData;
        if (activeFilters && Object.keys(activeFilters).length > 0) {
          result = true;
        } else {
          const renderedItems = filterInstance.listInstance.items.filter(item => 
            !item.element.style.display || item.element.style.display !== 'none'
          );
          result = renderedItems.length > 0 && renderedItems.length < filterInstance.listInstance.items.length;
        }
      }
    }
    
    if (!result) {
      const filterList = $1(`[fs-list-instance="${instance}"]`);
      if (filterList) {
        const allItems = filterList.querySelectorAll('[fs-cmsfilter-element="list-item"]');
        const visibleItems = filterList.querySelectorAll('[fs-cmsfilter-element="list-item"]:not([style*="display: none"])');
        result = allItems.length > 0 && visibleItems.length > 0 && visibleItems.length < allItems.length;
      }
    }
    
    cache.set(cacheKey, result);
    
    // Clear old cache entries
    if (cache.size > 10) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }
    
    return result;
  };
})();

const checkFilterInstanceFiltering = () => checkFiltering('Filter');

// FIXED: Enhanced filtering detection that works with zero-result searches
const checkMapMarkersFiltering = (() => {
  let lastCheck = 0;
  let lastResult = false;
  const cacheTimeout = 500;
  
  return () => {
    const now = Date.now();
    if (now - lastCheck < cacheTimeout) {
      return lastResult;
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    if (Array.from(urlParams.keys()).some(key => 
      key.startsWith('mapmarkers_') || key.includes('mapmarkers') || 
      key === 'district' || key === 'locality'
    )) {
      lastResult = true;
      lastCheck = now;
      return true;
    }
    
    if (checkFiltering('mapmarkers')) {
      lastResult = true;
      lastCheck = now;
      return true;
    }
    
    // FIXED: Check if search box has content (indicates active search/filtering)
    const searchInput = document.getElementById('map-search');
    if (searchInput && searchInput.value.trim().length > 0) {
      lastResult = true;
      lastCheck = now;
      return true;
    }
    
    // Check hidden-list-search too
    const hiddenListSearch = document.getElementById('hidden-list-search');
    if (hiddenListSearch && hiddenListSearch.value.trim().length > 0) {
      lastResult = true;
      lastCheck = now;
      return true;
    }
    
    // Optimized filtering check across all lists
    const lists = getAvailableFilterLists();
    let totalElements = 0;
    let totalVisible = 0;
    
    lists.forEach(listId => {
      const listContainer = $id(listId);
      if (!listContainer) return;
      
      const allFilteredLat = listContainer.querySelectorAll('.data-places-latitudes-filter');
      const visibleFilteredLat = Array.from(allFilteredLat).filter(el => {
        let current = el;
        while (current && current !== document.body) {
          const style = getComputedStyle(current);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
          }
          current = current.parentElement;
        }
        return true;
      });
      
      totalElements += allFilteredLat.length;
      totalVisible += visibleFilteredLat.length;
    });
    
    // FIXED: Filtering is active if we have elements and visible count is different from total
    // This covers both "some results" and "zero results" scenarios
    lastResult = totalElements > 0 && totalVisible < totalElements;
    lastCheck = now;
    return lastResult;
  };
})();

// OPTIMIZED: Filter application WITHOUT highlighting (FIX #2)
function applyFilterToMarkers(shouldReframe = true) {
  if (state.flags.isInitialLoad && !checkMapMarkersFiltering()) return;
  
  if (state.flags.skipNextReframe) {
    return;
  }
  
  // Helper function to check if element is truly visible (cached)
  const visibilityCache = new Map();
  const isElementVisible = (el) => {
    if (visibilityCache.has(el)) {
      return visibilityCache.get(el);
    }
    
    let current = el;
    while (current && current !== document.body) {
      const style = getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden') {
        visibilityCache.set(el, false);
        return false;
      }
      current = current.parentElement;
    }
    
    visibilityCache.set(el, true);
    return true;
  };
  
  // Collect elements from all discovered lists (batch operation)
  const lists = getAvailableFilterLists();
  const allData = [];
  const visibleData = [];
  
  lists.forEach(listId => {
    const listContainer = $id(listId);
    if (!listContainer) return;
    
    const listLat = Array.from(listContainer.querySelectorAll('.data-places-latitudes-filter'));
    const listLon = Array.from(listContainer.querySelectorAll('.data-places-longitudes-filter'));
    const listNames = Array.from(listContainer.querySelectorAll('.data-places-names-filter'));
    
    allData.push(...listLat.map((el, i) => ({ lat: el, lon: listLon[i], name: listNames[i] })));
    
    const visiblePairs = listLat.map((latEl, i) => ({ lat: latEl, lon: listLon[i], name: listNames[i] }))
      .filter(pair => isElementVisible(pair.lat));
    visibleData.push(...visiblePairs);
  });
  
  let visibleCoordinates = [];
  
  if (visibleData.length > 0 && visibleData.length < allData.length) {
    // Filtering is active - batch coordinate extraction (NO HIGHLIGHTING)
    visibleCoordinates = visibleData
      .map(pair => {
        const lat = parseFloat(pair.lat?.textContent.trim());
        const lon = parseFloat(pair.lon?.textContent.trim());
        
        if (!isNaN(lat) && !isNaN(lon)) {
          return [lon, lat];
        }
        return null;
      })
      .filter(coord => coord !== null);
    
    // Update the map source WITHOUT highlighting
    if (mapLayers.hasSource('localities-source')) {
      map.getSource('localities-source').setData({
        type: "FeatureCollection",
        features: state.allLocalityFeatures // Show all features without highlighting
      });
    }
  } else if (visibleData.length === allData.length) {
    // No filtering - show all features
    if (mapLayers.hasSource('localities-source')) {
      map.getSource('localities-source').setData({
        type: "FeatureCollection",
        features: state.allLocalityFeatures
      });
    }
    visibleCoordinates = state.allLocalityFeatures.map(f => f.geometry.coordinates);
  }
  
  // Only reframe the map if shouldReframe is true
  if (shouldReframe) {
    const animationDuration = state.flags.isInitialLoad ? 600 : 1000;
    
    if (visibleCoordinates.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      visibleCoordinates.forEach(coord => bounds.extend(coord));
      
      map.fitBounds(bounds, {
        padding: {
          top: window.innerHeight * 0.15, 
          bottom: window.innerHeight * 0.15, 
          left: window.innerWidth * 0.15, 
          right: window.innerWidth * 0.15
        },
        maxZoom: 13,
        duration: animationDuration,
        essential: true
      });
    } else {
      if (!state.flags.isInitialLoad || !checkMapMarkersFiltering()) {
        map.flyTo({
          center: isMobile ? [34.85, 31.7] : [35.22, 31.85], 
          zoom: isMobile ? 7.1 : 8.33, 
          duration: animationDuration, 
          essential: true
        });
      }
    }
  }
}

// OPTIMIZED: Debounced filter update with smart timing
const handleFilterUpdate = eventManager.debounce(() => {
  if (window.isLinkClick || window.isMarkerClick || state.markerInteractionLock) return;
  if (state.flags.skipNextReframe) return;
  
  state.flags.isRefreshButtonAction = true;
  applyFilterToMarkers();
  state.setTimer('filterCleanup', () => {
    state.flags.isRefreshButtonAction = false;
  }, 1000);
}, 150, 'filterUpdate');

// OPTIMIZED: Back to top button functionality
function setupBackToTopButton() {
  const button = $id('jump-to-top');
  const scrollContainer = $id('scroll-wrap');
  
  if (!button || !scrollContainer) {
    return;
  }
  
  // Initialize button state
  button.style.opacity = '0';
  button.style.display = 'flex';
  button.style.pointerEvents = 'none';
  
  const scrollThreshold = 100;
  let isVisible = false;
  
  // Update button visibility and opacity based on scroll position
  const updateButtonVisibility = () => {
    const scrollTop = scrollContainer.scrollTop;
    const shouldShow = scrollTop > scrollThreshold;
    
    if (shouldShow && !isVisible) {
      // Show button
      isVisible = true;
      button.style.display = 'flex';
      button.style.pointerEvents = 'auto';
      
      // Animate opacity based on scroll distance
      const opacity = Math.min(1, (scrollTop - scrollThreshold) / 100);
      button.style.opacity = opacity.toString();
      
    } else if (!shouldShow && isVisible) {
      // Hide button
      isVisible = false;
      button.style.opacity = '0';
      button.style.pointerEvents = 'none';
      
    } else if (shouldShow && isVisible) {
      // Update opacity while scrolling
      const opacity = Math.min(1, (scrollTop - scrollThreshold) / 100);
      button.style.opacity = opacity.toString();
    }
  };
  
  // Scroll to top instantly
  const scrollToTop = () => {
    scrollContainer.scrollTo({
      top: 0,
      behavior: 'auto' // Instant scroll
    });
  };
  
  // Add scroll event listener
  eventManager.add(scrollContainer, 'scroll', updateButtonVisibility);
  
  // Add click event listener
  eventManager.add(button, 'click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    scrollToTop();
  });
  
  // Watch for changes in #tagparent and auto-scroll to top
  const tagParent = $id('tagparent');
  if (tagParent) {
    const tagObserver = new MutationObserver((mutations) => {
      let hasChanges = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'attributes') {
          hasChanges = true;
        }
      });
      
      if (hasChanges) {
        scrollToTop();
      }
    });
    
    // Observe changes in tagparent
    tagObserver.observe(tagParent, {
      childList: true,
      subtree: true,
      attributes: true
    });
    
    // Store observer for cleanup
    tagParent._tagObserver = tagObserver;
  }
  
  // Initial visibility check
  updateButtonVisibility();
  
  // Mark UI loading step complete
  loadingTracker.markComplete('backToTopSetup');
}

// OPTIMIZED: Consolidated controls with event delegation where possible
function setupControls() {
  const controlMap = {
    'AllEvents': () => $id('ClearAll')?.click(),
    'ToggleLeft': () => {
      const leftSidebar = $id('LeftSidebar');
      if (leftSidebar) toggleSidebar('Left', !leftSidebar.classList.contains('is-show'));
    },
    'ToggleSecondLeft': () => {
      const secondLeftSidebar = $id('SecondLeftSidebar');
      if (secondLeftSidebar) toggleSidebar('SecondLeft', !secondLeftSidebar.classList.contains('is-show'));
    }
  };
  
  Object.entries(controlMap).forEach(([id, action]) => {
    const btn = $id(id);
    if (btn) {
      eventManager.add(btn, 'click', (e) => {
        e.preventDefault(); 
        e.stopPropagation(); 
        action();
      });
    }
  });
  
  // OPTIMIZED: Sidebar controls - Fixed Right Sidebar Logic
  const setupSidebarControls = (selector, sidebarSide, eventType = 'click') => {
    const elements = $(selector);
    elements.forEach(element => {
      // Skip if already setup to prevent duplicate handlers
      if (element.dataset.sidebarSetup === 'true') return;
      
      const handler = () => {
        const sidebar = $id(`${sidebarSide}Sidebar`);
        if (!sidebar) return;
        
        const openRightSidebar = element.getAttribute('open-right-sidebar');
        const openSecondLeftSidebar = element.getAttribute('open-second-left-sidebar');
        
        // Handle Right sidebar specifically with working logic from your script
        if (sidebarSide === 'Right') {
          if (openRightSidebar === 'open-only') {
            toggleSidebar('Right', true);
          } else if (openRightSidebar === 'true') {
            const currentlyShowing = sidebar.classList.contains('is-show');
            toggleSidebar('Right', !currentlyShowing);
          }
        }
        // Handle SecondLeft sidebar specifically  
        else if (sidebarSide === 'SecondLeft') {
          if (openSecondLeftSidebar === 'open-only') {
            toggleSidebar('SecondLeft', true);
          } else if (openSecondLeftSidebar === 'true') {
            toggleSidebar('SecondLeft', !sidebar.classList.contains('is-show'));
          }
        }
        // Handle Left sidebar and other cases
        else {
          toggleSidebar(sidebarSide, !sidebar.classList.contains('is-show'));
        }
      };
      
      if (eventType === 'change' && (element.type === 'radio' || element.type === 'checkbox')) {
        eventManager.add(element, 'change', () => element.checked && handler());
      } else {
        eventManager.add(element, eventType, (e) => {
          e.stopPropagation(); 
          handler();
        });
      }
      
      element.dataset.sidebarSetup = 'true';
    });
  };
  
  setupSidebarControls('[open-right-sidebar="true"], [open-right-sidebar="open-only"]', 'Right');
  setupSidebarControls('[open-second-left-sidebar="true"], [open-second-left-sidebar="open-only"]', 'SecondLeft');
  setupSidebarControls('.OpenLeftSidebar, [OpenLeftSidebar], [openleftsidebar]', 'Left', 'change');
  setupSidebarControls('.OpenSecondLeftSidebar, [OpenSecondLeftSidebar], [opensecondleftsidebar]', 'SecondLeft', 'change');
  
  // Defer area controls loading
  setupDeferredAreaControls();
  setupBackToTopButton();
}

// OPTIMIZED: Sidebar setup with better performance and cleaner management
function setupSidebars() {
  let zIndex = 1000;
  
  const setupSidebarElement = (side) => {
    const sidebar = sidebarCache.getSidebar(side);
    const tab = $id(`${side}SideTab`);
    const close = $id(`${side}SidebarClose`);
    
    if (!sidebar || !tab || !close) return false;
    if (tab.dataset.setupComplete === 'true' && close.dataset.setupComplete === 'true') return true;
    
    // Batch style applications
    const cssTransitionProperty = side === 'SecondLeft' ? 'margin-left' : `margin-${side.toLowerCase()}`;
    utils.setStyles(sidebar, {
      transition: `${cssTransitionProperty} 0.25s cubic-bezier(0.4, 0, 0.2, 1)`,
      zIndex: zIndex,
      position: 'relative'
    });
    utils.setStyles(tab, {
      transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
    });
    
    const bringToFront = () => {
      const newZ = ++zIndex;
      sidebar.style.zIndex = newZ;
      
      if (window.innerWidth <= 478) {
        tab.style.zIndex = newZ + 10;
        if (tab.parentElement) tab.parentElement.style.zIndex = newZ + 10;
      }
      
      // Lower z-index for other sidebars
      const allSides = ['Left', 'SecondLeft', 'Right'];
      allSides.forEach(otherSide => {
        if (otherSide !== side) {
          const otherSidebar = sidebarCache.getSidebar(otherSide);
          const otherTab = $id(`${otherSide}SideTab`);
          
          if (otherSidebar) otherSidebar.style.zIndex = newZ - 1;
          if (otherTab && window.innerWidth <= 478) {
            otherTab.style.zIndex = newZ + 5;
            if (otherTab.parentElement) otherTab.parentElement.style.zIndex = newZ + 5;
          }
        }
      });
    };

    // Use the main toggleSidebar function instead of internal logic
    if (!sidebar.dataset.clickSetup) {
      eventManager.add(sidebar, 'click', () => {
        if (sidebar.classList.contains('is-show')) bringToFront();
      });
      sidebar.dataset.clickSetup = 'true';
    }
    
    if (tab.dataset.setupComplete !== 'true') {
      eventManager.add(tab, 'click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSidebar(side, !sidebar.classList.contains('is-show'));
      });
      tab.dataset.setupComplete = 'true';
    }
    
    if (close.dataset.setupComplete !== 'true') {
      eventManager.add(close, 'click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSidebar(side, false);
      });
      close.dataset.setupComplete = 'true';
    }
    
    zIndex++;
    return true;
  };
  
  const attemptSetup = (attempt = 1, maxAttempts = 5) => {
    const leftReady = setupSidebarElement('Left');
    const secondLeftReady = setupSidebarElement('SecondLeft');
    const rightReady = setupSidebarElement('Right');
    
    if (leftReady && secondLeftReady && rightReady) {
      setupInitialMargins();
      state.setTimer('setupControls', setupControls, 50);
      
      // Mark UI loading step complete
      loadingTracker.markComplete('sidebarSetup');
      return;
    }
    
    if (attempt < maxAttempts) {
      const delay = [50, 150, 250, 500][attempt - 1] || 500;
      state.setTimer(`sidebarSetup-${attempt}`, () => attemptSetup(attempt + 1, maxAttempts), delay);
    } else {
      setupInitialMargins();
      state.setTimer('setupControls', setupControls, 50);
      
      // Mark UI loading step complete even if some sidebars missing
      loadingTracker.markComplete('sidebarSetup');
    }
  };
  
  const setupInitialMargins = () => {
    if (window.innerWidth <= 478) return;
    
    ['Left', 'SecondLeft', 'Right'].forEach(side => {
      const sidebar = sidebarCache.getSidebar(side);
      if (sidebar && !sidebar.classList.contains('is-show')) {
        const width = sidebarCache.getWidth(side);
        const jsMarginProperty = sidebarCache.getMarginProperty(side);
        sidebar.style[jsMarginProperty] = `-${width + 1}px`;
      }
    });
  };
  
  attemptSetup();
}

// OPTIMIZED: Event setup with consolidated handlers and better management
function setupEvents() {
  const eventHandlers = [
    {selector: '[data-auto-sidebar="true"]', events: ['change', 'input'], handler: () => {
      if (window.innerWidth > 991) {
        state.setTimer('autoSidebar', () => toggleSidebar('Left', true), 50);
      }
    }},
    {selector: '[data-auto-second-left-sidebar="true"]', events: ['change', 'input'], handler: () => {
      if (window.innerWidth > 991) {
        state.setTimer('autoSecondSidebar', () => toggleSidebar('SecondLeft', true), 50);
      }
    }},
    {selector: 'select, [fs-cmsfilter-element="select"]', events: ['change'], handler: () => state.setTimer('selectChange', handleFilterUpdate, 50)},
    {selector: '[fs-cmsfilter-element="filters"] input, [fs-cmsfilter-element="filters"] select', events: ['change'], handler: () => state.setTimer('filterChange', handleFilterUpdate, 50)}
  ];
  
  eventHandlers.forEach(({selector, events, handler}) => {
    const elements = $(selector);
    elements.forEach(element => {
      events.forEach(event => {
        if (event === 'input' && ['text', 'search'].includes(element.type)) {
          eventManager.add(element, event, handler);
        } else if (event !== 'input' || element.type !== 'text') {
          eventManager.add(element, event, handler);
        }
      });
    });
  });
  
  // OPTIMIZED: Consolidated apply-map-filter setup with event delegation
  const filterElements = $('[apply-map-filter="true"], .filterrefresh, #filter-button');
  filterElements.forEach(element => {
    let events;
    if (element.getAttribute('apply-map-filter') === 'true') {
      events = ['click', 'keypress', 'input'];
    } else {
      events = ['click'];
    }
    
    events.forEach(eventType => {
      eventManager.add(element, eventType, (e) => {
        if (eventType === 'keypress' && e.key !== 'Enter') return;
        if (window.isMarkerClick) return;
        
        // Handle all filter elements
        e.preventDefault();
        
        state.flags.forceFilteredReframe = true;
        state.flags.isRefreshButtonAction = true;
        
        const delay = eventType === 'input' ? 200 : 50;
        
        state.setTimer('applyFilter', () => {
          applyFilterToMarkers(true); // true = full reframing
          state.setTimer('applyFilterCleanup', () => {
            state.flags.forceFilteredReframe = false;
            state.flags.isRefreshButtonAction = false;
          }, 1000);
        }, delay);
      });
    });
  });
  
  // Global event listeners with better management
  ['fs-cmsfilter-filtered', 'fs-cmsfilter-pagination-page-changed'].forEach(event => {
    eventManager.add(document, event, (e) => {
      if (window.isMarkerClick || state.markerInteractionLock) return;
      handleFilterUpdate();
      
      // FIXED: Also check and toggle filtered elements when Finsweet events fire
      setTimeout(checkAndToggleFilteredElements, 50);
    });
  });
  
  // FIXED: Additional Finsweet event listeners for filtered elements
  ['fs-cmsfilter-change', 'fs-cmsfilter-search', 'fs-cmsfilter-reset'].forEach(event => {
    eventManager.add(document, event, () => {
      setTimeout(checkAndToggleFilteredElements, 100);
    });
  });
  
  // Firefox form handling with event delegation
  if (navigator.userAgent.toLowerCase().includes('firefox')) {
    const forms = $('form');
    forms.forEach(form => {
      const hasFilterElements = form.querySelector('[fs-cmsfilter-element]') !== null;
      const isNearMap = $id('map') && (form.contains($id('map')) || $id('map').contains(form) || form.parentElement === $id('map').parentElement);
      
      if (hasFilterElements || isNearMap) {
        eventManager.add(form, 'submit', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          state.flags.forceFilteredReframe = true;
          state.flags.isRefreshButtonAction = true;
          
          state.setTimer('firefoxSubmit', () => {
            applyFilterToMarkers();
            state.setTimer('firefoxSubmitCleanup', () => {
              state.flags.forceFilteredReframe = false;
              state.flags.isRefreshButtonAction = false;
            }, 1000);
          }, 50);
          
          return false;
        }, {capture: true});
      }
    });
  }
  
  // Link click handlers with event delegation
  const links = $('a:not(.filterrefresh):not([fs-cmsfilter-element])');
  links.forEach(link => {
    eventManager.add(link, 'click', () => {
      if (!link.closest('[fs-cmsfilter-element]') && 
          !link.classList.contains('w-pagination-next') && 
          !link.classList.contains('w-pagination-previous')) {
        window.isLinkClick = true;
        state.setTimer('linkCleanup', () => window.isLinkClick = false, 500);
      }
    });
  });
  
  // Mark UI loading step complete
  loadingTracker.markComplete('eventsSetup');
}

// OPTIMIZED: Smart dropdown listeners with better timing
function setupDropdownListeners() {
  if (state.flags.dropdownListenersSetup) return;
  state.flags.dropdownListenersSetup = true;
  
  const districtSelectElements = $('[districtselect]');
  districtSelectElements.forEach(element => {
    eventManager.add(element, 'click', (e) => {
      if (window.isMarkerClick) return;
      
      state.setTimer('dropdownClick', () => {
        state.flags.forceFilteredReframe = true;
        state.flags.isRefreshButtonAction = true;
        
        state.setTimer('dropdownApplyFilter', () => {
          applyFilterToMarkers();
          state.setTimer('dropdownCleanup', () => {
            state.flags.forceFilteredReframe = false;
            state.flags.isRefreshButtonAction = false;
          }, 1000);
        }, 150);
      }, 100);
    });
  });
}

// OPTIMIZED: Combined GeoJSON loading with better performance
function loadCombinedGeoData() {
  fetch('https://cdn.jsdelivr.net/gh/Tovlim/COTO@main/Combined-GEOJSON-0.006.json')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(combinedData => {
      // Batch separate districts and areas
      const districts = [];
      const areas = [];
      
      combinedData.features.forEach(feature => {
        if (feature.properties.type === 'district') {
          districts.push(feature);
        } else if (feature.properties.type === 'area') {
          areas.push(feature);
        }
      });
      
      // Batch process districts
      mapLayers.addToBatch(() => {
        districts.forEach(districtFeature => {
          const name = districtFeature.properties.name;
          addDistrictBoundaryToMap(name, districtFeature);
        });
      });
      
      // Batch process areas
      mapLayers.addToBatch(() => {
        areas.forEach(areaFeature => {
          const name = areaFeature.properties.name;
          addAreaOverlayToMap(name, areaFeature);
        });
      });
      
      // Update district markers after processing
      state.setTimer('updateDistrictMarkers', () => {
        addNativeDistrictMarkers();
        
        state.setTimer('finalLayerOrder', () => mapLayers.optimizeLayerOrder(), 300);
        
        // Mark loading step complete
        loadingTracker.markComplete('geoDataLoaded');
      }, 100);
    })
    .catch(error => {
      // Still update district markers in case some data was loaded
      addNativeDistrictMarkers();
      state.setTimer('errorLayerOrder', () => mapLayers.optimizeLayerOrder(), 300);
      
      // Mark as complete even with error to avoid infinite loading
      loadingTracker.markComplete('geoDataLoaded');
    });
}

// OPTIMIZED: District boundary addition with batching
function addDistrictBoundaryToMap(name, districtFeature) {
  const boundary = {
    name,
    sourceId: `${name.toLowerCase().replace(/\s+/g, '-')}-boundary`,
    fillId: `${name.toLowerCase().replace(/\s+/g, '-')}-fill`,
    borderId: `${name.toLowerCase().replace(/\s+/g, '-')}-border`
  };
  
  // Remove existing layers/sources if they exist (batch operation)
  [boundary.borderId, boundary.fillId].forEach(layerId => {
    if (mapLayers.hasLayer(layerId)) {
      map.removeLayer(layerId);
      mapLayers.layerCache.delete(layerId);
    }
  });
  
  if (mapLayers.hasSource(boundary.sourceId)) {
    map.removeSource(boundary.sourceId);
    mapLayers.sourceCache.delete(boundary.sourceId);
  }
  
  // Add source
  map.addSource(boundary.sourceId, {
    type: 'geojson',
    data: {
      type: "FeatureCollection",
      features: [districtFeature]
    }
  });
  
  // Get layer positioning
  const areaLayers = ['area-a-layer', 'area-b-layer', 'area-c-layer', 'firing-zones-layer'];
  const firstAreaLayer = areaLayers.find(layerId => mapLayers.hasLayer(layerId));
  const beforeId = firstAreaLayer || 'locality-clusters';
  
  // Add fill layer
  map.addLayer({
    id: boundary.fillId,
    type: 'fill',
    source: boundary.sourceId,
    layout: { 'visibility': 'visible' },
    paint: {
      'fill-color': '#1a1b1e',
      'fill-opacity': 0.15
    }
  }, beforeId);
  
  // Add border layer
  map.addLayer({
    id: boundary.borderId,
    type: 'line',
    source: boundary.sourceId,
    layout: { 'visibility': 'visible' },
    paint: {
      'line-color': '#888888',
      'line-width': 1,
      'line-opacity': 0.4
    }
  }, beforeId);
  
  // Update cache
  mapLayers.sourceCache.set(boundary.sourceId, true);
  mapLayers.layerCache.set(boundary.fillId, true);
  mapLayers.layerCache.set(boundary.borderId, true);
  
  // Calculate centroid and add district marker
  const existingFeature = state.allDistrictFeatures.find(f => 
    f.properties.name === name && f.properties.source === 'boundary'
  );
  
  if (!existingFeature) {
    const centroid = utils.calculateCentroid(districtFeature.geometry.coordinates);
    
    const districtMarkerFeature = {
      type: "Feature",
      geometry: {type: "Point", coordinates: centroid},
      properties: {
        name: name,
        id: `district-${name.toLowerCase().replace(/\s+/g, '-')}`,
        type: 'district',
        source: 'boundary'
      }
    };
    
    state.allDistrictFeatures.push(districtMarkerFeature);
  }
}

// OPTIMIZED: Area overlay addition with batching
function addAreaOverlayToMap(name, areaFeature) {
  const areaConfig = {
    'Area A': { color: '#adc278', layerId: 'area-a-layer', sourceId: 'area-a-source' },
    'Area B': { color: '#ffdcc6', layerId: 'area-b-layer', sourceId: 'area-b-source' },
    'Area C': { color: '#889c9b', layerId: 'area-c-layer', sourceId: 'area-c-source' },
    'Firing Zones': { color: '#c51d3c', layerId: 'firing-zones-layer', sourceId: 'firing-zones-source' }
  };
  
  const config = areaConfig[name];
  if (!config) return;
  
  // Remove existing layers/sources if they exist
  if (mapLayers.hasLayer(config.layerId)) {
    map.removeLayer(config.layerId);
    mapLayers.layerCache.delete(config.layerId);
  }
  if (mapLayers.hasSource(config.sourceId)) {
    map.removeSource(config.sourceId);
    mapLayers.sourceCache.delete(config.sourceId);
  }
  
  // Add source
  map.addSource(config.sourceId, {
    type: 'geojson',
    data: {
      type: "FeatureCollection",
      features: [areaFeature]
    }
  });
  
  // Add layer
  const beforeId = 'locality-clusters';
  map.addLayer({
    id: config.layerId,
    type: 'fill',
    source: config.sourceId,
    layout: { 'visibility': 'visible' },
    paint: {
      'fill-color': config.color,
      'fill-opacity': 0.5,
      'fill-outline-color': config.color
    }
  }, beforeId);
  
  // Update cache
  mapLayers.sourceCache.set(config.sourceId, true);
  mapLayers.layerCache.set(config.layerId, true);
}

// DEFERRED: Area key controls - loads after main functionality
function setupDeferredAreaControls() {
  // Defer loading area controls to improve initial load time
  const loadAreaControls = () => {
    // Check if controls already setup
    if (state.flags.areaControlsSetup) return;
    
    const areaControls = [
      {keyId: 'area-a-key', layerId: 'area-a-layer', wrapId: 'area-a-key-wrap'},
      {keyId: 'area-b-key', layerId: 'area-b-layer', wrapId: 'area-b-key-wrap'},
      {keyId: 'area-c-key', layerId: 'area-c-layer', wrapId: 'area-c-key-wrap'},
      {keyId: 'firing-zones-key', layerId: 'firing-zones-layer', wrapId: 'firing-zones-key-wrap'}
    ];
    
    const markerControls = [
      {
        keyId: 'district-toggle-key', 
        wrapId: 'district-toggle-key-wrap',
        type: 'district',
        layers: ['district-points'],
        label: 'District Markers & Boundaries'
      },
      {
        keyId: 'locality-toggle-key', 
        wrapId: 'locality-toggle-key-wrap',
        type: 'locality',
        layers: ['locality-clusters', 'locality-points'],
        label: 'Locality Markers'
      }
    ];
    
    let setupCount = 0;
    
    // Setup area controls
    areaControls.forEach(control => {
      const checkbox = $id(control.keyId);
      if (!checkbox) return;
      
      checkbox.checked = false;
      
      if (!checkbox.dataset.mapboxListenerAdded) {
        checkbox.addEventListener('change', () => {
          if (!mapLayers.hasLayer(control.layerId)) return;
          
          const visibility = checkbox.checked ? 'none' : 'visible';
          map.setLayoutProperty(control.layerId, 'visibility', visibility);
        });
        checkbox.dataset.mapboxListenerAdded = 'true';
      }
      
      const wrapperDiv = $id(control.wrapId);
      if (wrapperDiv && !wrapperDiv.dataset.mapboxHoverAdded) {
        wrapperDiv.addEventListener('mouseenter', () => {
          if (!mapLayers.hasLayer(control.layerId)) return;
          map.setPaintProperty(control.layerId, 'fill-opacity', 0.8);
        });
        
        wrapperDiv.addEventListener('mouseleave', () => {
          if (!mapLayers.hasLayer(control.layerId)) return;
          map.setPaintProperty(control.layerId, 'fill-opacity', 0.5);
        });
        
        wrapperDiv.dataset.mapboxHoverAdded = 'true';
      }
      
      setupCount++;
    });
    
    // Setup marker controls
    markerControls.forEach(control => {
      const checkbox = $id(control.keyId);
      if (!checkbox) return;
      
      checkbox.checked = false;
      
      if (!checkbox.dataset.mapboxListenerAdded) {
        const changeHandler = (e) => {
          const visibility = e.target.checked ? 'none' : 'visible';
          
          if (control.type === 'district') {
            control.layers.forEach(layerId => {
              if (mapLayers.hasLayer(layerId)) {
                map.setLayoutProperty(layerId, 'visibility', visibility);
              }
            });
            
            const allLayers = map.getStyle().layers;
            allLayers.forEach(layer => {
              if (layer.id.includes('-fill') || layer.id.includes('-border')) {
                map.setLayoutProperty(layer.id, 'visibility', visibility);
              }
            });
            
          } else if (control.type === 'locality') {
            control.layers.forEach(layerId => {
              if (mapLayers.hasLayer(layerId)) {
                map.setLayoutProperty(layerId, 'visibility', visibility);
              }
            });
          }
        };
        
        checkbox.addEventListener('change', changeHandler);
        checkbox.dataset.mapboxListenerAdded = 'true';
      }
      
      const wrapperDiv = $id(control.wrapId);
      if (wrapperDiv && !wrapperDiv.dataset.mapboxHoverAdded) {
        const mouseEnterHandler = () => {
          if (control.type === 'district') {
            if (mapLayers.hasLayer('district-points')) {
              map.setPaintProperty('district-points', 'text-halo-color', '#8f4500');
            }
            
            const allLayers = map.getStyle().layers;
            allLayers.forEach(layer => {
              if (layer.id.includes('-fill')) {
                map.setPaintProperty(layer.id, 'fill-color', '#6e3500');
                map.setPaintProperty(layer.id, 'fill-opacity', 0.25);
              }
              if (layer.id.includes('-border')) {
                map.setPaintProperty(layer.id, 'line-color', '#6e3500');
                map.setPaintProperty(layer.id, 'line-opacity', 0.6);
              }
            });
          } else if (control.type === 'locality') {
            if (mapLayers.hasLayer('locality-clusters')) {
              map.setPaintProperty('locality-clusters', 'text-halo-color', '#a49c00');
            }
            if (mapLayers.hasLayer('locality-points')) {
              map.setPaintProperty('locality-points', 'text-halo-color', '#a49c00');
            }
          }
        };
        
        const mouseLeaveHandler = () => {
          if (control.type === 'district') {
            if (mapLayers.hasLayer('district-points')) {
              map.setPaintProperty('district-points', 'text-halo-color', '#6e3500');
            }
            
            const allLayers = map.getStyle().layers;
            allLayers.forEach(layer => {
              if (layer.id.includes('-fill')) {
                map.setPaintProperty(layer.id, 'fill-color', '#1a1b1e');
                map.setPaintProperty(layer.id, 'fill-opacity', 0.15);
              }
              if (layer.id.includes('-border')) {
                map.setPaintProperty(layer.id, 'line-color', '#888888');
                map.setPaintProperty(layer.id, 'line-opacity', 0.4);
              }
            });
          } else if (control.type === 'locality') {
            if (mapLayers.hasLayer('locality-clusters')) {
              map.setPaintProperty('locality-clusters', 'text-halo-color', '#7e7800');
            }
            if (mapLayers.hasLayer('locality-points')) {
              map.setPaintProperty('locality-points', 'text-halo-color', '#7e7800');
            }
          }
        };
        
        wrapperDiv.addEventListener('mouseenter', mouseEnterHandler);
        wrapperDiv.addEventListener('mouseleave', mouseLeaveHandler);
        wrapperDiv.dataset.mapboxHoverAdded = 'true';
      }
      
      setupCount++;
    });
    
    // Mark as complete
    if (setupCount > 0) {
      state.flags.areaControlsSetup = true;
      console.log('Area controls loaded');
    }
  };
  
  // Use requestIdleCallback if available, otherwise setTimeout
  if ('requestIdleCallback' in window) {
    requestIdleCallback(loadAreaControls, { timeout: 3000 });
  } else {
    setTimeout(loadAreaControls, 2000);
  }
}

// OPTIMIZED: Area key controls with better performance (OLD - REMOVED)
function setupAreaKeyControls() {
  if (state.flags.areaControlsSetup) return;
  
  const areaControls = [
    {keyId: 'area-a-key', layerId: 'area-a-layer', wrapId: 'area-a-key-wrap'},
    {keyId: 'area-b-key', layerId: 'area-b-layer', wrapId: 'area-b-key-wrap'},
    {keyId: 'area-c-key', layerId: 'area-c-layer', wrapId: 'area-c-key-wrap'},
    {keyId: 'firing-zones-key', layerId: 'firing-zones-layer', wrapId: 'firing-zones-key-wrap'}
  ];
  
  const markerControls = [
    {
      keyId: 'district-toggle-key', 
      wrapId: 'district-toggle-key-wrap',
      type: 'district',
      layers: ['district-points'],
      label: 'District Markers & Boundaries'
    },
    {
      keyId: 'locality-toggle-key', 
      wrapId: 'locality-toggle-key-wrap',
      type: 'locality',
      layers: ['locality-clusters', 'locality-points'],
      label: 'Locality Markers'
    }
  ];
  
  let areaSetupCount = 0;
  let markerSetupCount = 0;
  
  // Setup area controls
  areaControls.forEach(control => {
    const checkbox = $id(control.keyId);
    if (!checkbox) return;
    
    checkbox.checked = false;
    
    if (!checkbox.dataset.mapboxListenerAdded) {
      eventManager.add(checkbox, 'change', () => {
        if (!mapLayers.hasLayer(control.layerId)) return;
        
        const visibility = checkbox.checked ? 'none' : 'visible';
        map.setLayoutProperty(control.layerId, 'visibility', visibility);
      });
      checkbox.dataset.mapboxListenerAdded = 'true';
    }
    
    const wrapperDiv = $id(control.wrapId);
    if (wrapperDiv && !wrapperDiv.dataset.mapboxHoverAdded) {
      eventManager.add(wrapperDiv, 'mouseenter', () => {
        if (!mapLayers.hasLayer(control.layerId)) return;
        map.setPaintProperty(control.layerId, 'fill-opacity', 0.8);
      });
      
      eventManager.add(wrapperDiv, 'mouseleave', () => {
        if (!mapLayers.hasLayer(control.layerId)) return;
        map.setPaintProperty(control.layerId, 'fill-opacity', 0.5);
      });
      
      wrapperDiv.dataset.mapboxHoverAdded = 'true';
    }
    
    areaSetupCount++;
  });
  
  // Setup marker controls with direct DOM listeners (keeping highlighting for toggle key)
  markerControls.forEach(control => {
    const checkbox = $id(control.keyId);
    if (!checkbox) return;
    
    checkbox.checked = false;
    
    if (!checkbox.dataset.mapboxListenerAdded) {
      // Use direct DOM event listeners for marker controls
      const changeHandler = (e) => {
        const visibility = e.target.checked ? 'none' : 'visible';
        
        if (control.type === 'district') {
          // Handle district markers
          control.layers.forEach(layerId => {
            if (mapLayers.hasLayer(layerId)) {
              map.setLayoutProperty(layerId, 'visibility', visibility);
            }
          });
          
          // Handle district boundaries
          const allLayers = map.getStyle().layers;
          allLayers.forEach(layer => {
            if (layer.id.includes('-fill') || layer.id.includes('-border')) {
              map.setLayoutProperty(layer.id, 'visibility', visibility);
            }
          });
          
        } else if (control.type === 'locality') {
          // Handle locality markers
          control.layers.forEach(layerId => {
            if (mapLayers.hasLayer(layerId)) {
              map.setLayoutProperty(layerId, 'visibility', visibility);
            }
          });
        }
      };
      
      checkbox.addEventListener('change', changeHandler);
      checkbox.dataset.mapboxListenerAdded = 'true';
    }
    
    const wrapperDiv = $id(control.wrapId);
    if (wrapperDiv && !wrapperDiv.dataset.mapboxHoverAdded) {
      // Use direct DOM event listeners for marker control hovers (keeping highlighting)
      const mouseEnterHandler = () => {
        if (control.type === 'district') {
          if (mapLayers.hasLayer('district-points')) {
            map.setPaintProperty('district-points', 'text-halo-color', '#8f4500');
          }
          
          const allLayers = map.getStyle().layers;
          allLayers.forEach(layer => {
            if (layer.id.includes('-fill')) {
              map.setPaintProperty(layer.id, 'fill-color', '#6e3500');
              map.setPaintProperty(layer.id, 'fill-opacity', 0.25);
            }
            if (layer.id.includes('-border')) {
              map.setPaintProperty(layer.id, 'line-color', '#6e3500');
              map.setPaintProperty(layer.id, 'line-opacity', 0.6);
            }
          });
        } else if (control.type === 'locality') {
          if (mapLayers.hasLayer('locality-clusters')) {
            map.setPaintProperty('locality-clusters', 'text-halo-color', '#a49c00');
          }
          if (mapLayers.hasLayer('locality-points')) {
            map.setPaintProperty('locality-points', 'text-halo-color', '#a49c00');
          }
        }
      };
      
      const mouseLeaveHandler = () => {
        if (control.type === 'district') {
          if (mapLayers.hasLayer('district-points')) {
            map.setPaintProperty('district-points', 'text-halo-color', '#6e3500');
          }
          
          const allLayers = map.getStyle().layers;
          allLayers.forEach(layer => {
            if (layer.id.includes('-fill')) {
              map.setPaintProperty(layer.id, 'fill-color', '#1a1b1e');
              map.setPaintProperty(layer.id, 'fill-opacity', 0.15);
            }
            if (layer.id.includes('-border')) {
              map.setPaintProperty(layer.id, 'line-color', '#888888');
              map.setPaintProperty(layer.id, 'line-opacity', 0.4);
            }
          });
        } else if (control.type === 'locality') {
          if (mapLayers.hasLayer('locality-clusters')) {
            map.setPaintProperty('locality-clusters', 'text-halo-color', '#7e7800');
          }
          if (mapLayers.hasLayer('locality-points')) {
            map.setPaintProperty('locality-points', 'text-halo-color', '#7e7800');
          }
        }
      };
      
      wrapperDiv.addEventListener('mouseenter', mouseEnterHandler);
      wrapperDiv.addEventListener('mouseleave', mouseLeaveHandler);
      wrapperDiv.dataset.mapboxHoverAdded = 'true';
    }
    
    markerSetupCount++;
  });
  
  // Mark as complete if we got most controls
  if (areaSetupCount >= areaControls.length - 1 && markerSetupCount >= markerControls.length - 1) {
    state.flags.areaControlsSetup = true;
    
    // Mark loading step complete
    loadingTracker.markComplete('controlsSetup');
  }
}

// OPTIMIZED: District tags loading with batching
function loadDistrictTags() {
  if (state.flags.districtTagsLoaded) return;
  
  const districtTagCollection = $id('district-tag-collection');
  if (!districtTagCollection) {
    loadingTracker.markComplete('districtTagsLoaded');
    return;
  }
  
  const districtTagItems = districtTagCollection.querySelectorAll('#district-tag-item');
  
  // Filter existing tag-based features (keep boundary-based features)
  state.allDistrictFeatures = state.allDistrictFeatures.filter(f => f.properties.source !== 'tag');
  
  // Batch process tag items
  const newFeatures = [];
  districtTagItems.forEach((tagItem, index) => {
    if (getComputedStyle(tagItem).display === 'none') return;
    
    const name = tagItem.getAttribute('district-tag-name');
    const lat = parseFloat(tagItem.getAttribute('district-tag-lattitude'));
    const lng = parseFloat(tagItem.getAttribute('district-tag-longitude'));
    
    if (!name || isNaN(lat) || isNaN(lng)) return;
    
    newFeatures.push({
      type: "Feature",
      geometry: {type: "Point", coordinates: [lng, lat]},
      properties: {
        name: name,
        id: `district-tag-${name.toLowerCase().replace(/\s+/g, '-')}`,
        type: 'district',
        source: 'tag'
      }
    });
  });
  
  state.allDistrictFeatures.push(...newFeatures);
  state.flags.districtTagsLoaded = true;
  
  // Update district markers
  addNativeDistrictMarkers();
  
  state.setTimer('districtTagsLayerOrder', () => mapLayers.optimizeLayerOrder(), 100);
  
  // Mark loading step complete
  loadingTracker.markComplete('districtTagsLoaded');
}

// Generate locality checkboxes from map data
function generateLocalityCheckboxes() {
  const container = $id('locality-check-list');
  if (!container) {
    return;
  }
  
  const template = container.querySelector('[checkbox-filter="locality"]');
  if (!template) {
    return;
  }
  
  // Extract unique locality names from map data
  const localityNames = [...new Set(state.allLocalityFeatures.map(feature => feature.properties.name))].sort();
  
  if (localityNames.length === 0) {
    return;
  }
  
  // Clear the container
  container.innerHTML = '';
  
  // Batch generate checkboxes using document fragment
  const fragment = document.createDocumentFragment();
  localityNames.forEach(localityName => {
    const checkbox = template.cloneNode(true);
    
    // Remove ID to avoid duplicates
    const label = checkbox.querySelector('#locality-checkbox');
    if (label) label.removeAttribute('id');
    
    // Update attributes
    const input = checkbox.querySelector('input[name="locality"]');
    if (input) input.setAttribute('fs-list-value', localityName);
    
    const span = checkbox.querySelector('.test3.w-form-label');
    if (span) span.textContent = localityName;
    
    fragment.appendChild(checkbox);
    
    // Setup events for this checkbox
    setupCheckboxEvents(checkbox);
  });
  
  container.appendChild(fragment);
  
  // Re-cache checkbox filter script if it exists
  if (window.checkboxFilterScript?.recacheElements) {
    state.setTimer('recacheCheckboxFilter', () => {
      window.checkboxFilterScript.recacheElements();
    }, 100);
  }
  
  // FIXED: Check filtered elements after generating checkboxes
  state.setTimer('checkFilteredAfterGeneration', checkAndToggleFilteredElements, 200);
  
  // Invalidate DOM cache since we added new elements
  domCache.markStale();
}

// OPTIMIZED: Setup events for generated checkboxes with better performance
function setupCheckboxEvents(checkboxContainer) {
  // Handle data-auto-sidebar="true"
  const autoSidebarElements = checkboxContainer.querySelectorAll('[data-auto-sidebar="true"]');
  autoSidebarElements.forEach(element => {
    ['change', 'input'].forEach(eventType => {
      eventManager.add(element, eventType, () => {
        if (window.innerWidth > 991) {
          state.setTimer('checkboxAutoSidebar', () => toggleSidebar('Left', true), 50);
        }
      });
    });
  });
  
  // Handle fs-cmsfilter-element filters
  const filterElements = checkboxContainer.querySelectorAll('[fs-cmsfilter-element="filters"] input, [fs-cmsfilter-element="filters"] select');
  filterElements.forEach(element => {
    eventManager.add(element, 'change', () => state.setTimer('checkboxFilter', handleFilterUpdate, 50));
  });
  
  // Handle activate-filter-indicator functionality
  const indicatorActivators = checkboxContainer.querySelectorAll('[activate-filter-indicator]');
  indicatorActivators.forEach(activator => {
    const groupName = activator.getAttribute('activate-filter-indicator');
    if (!groupName) return;
    
    // Function to toggle indicators for this group
    const toggleIndicators = (shouldShow) => {
      const indicators = $(`[filter-indicator="${groupName}"]`);
      indicators.forEach(indicator => {
        indicator.style.display = shouldShow ? 'flex' : 'none';
      });
    };
    
    // Function to check if any activator in this group is active
    const hasActiveFilters = () => {
      const groupActivators = $(`[activate-filter-indicator="${groupName}"]`);
      return groupActivators.some(el => {
        if (el.type === 'checkbox' || el.type === 'radio') {
          return el.checked;
        } else if (el.tagName.toLowerCase() === 'select') {
          return el.selectedIndex > 0;
        } else {
          return el.value.trim() !== '';
        }
      });
    };
    
    // Add change event listener for checkboxes
    if (activator.type === 'checkbox' || activator.type === 'radio') {
      eventManager.add(activator, 'change', () => {
        const shouldShow = hasActiveFilters();
        toggleIndicators(shouldShow);
      });
    }
  });
}

// SIMPLIFIED: Only use hiddentagparent method for filtering detection
const checkAndToggleFilteredElements = () => {
  // Check for hiddentagparent (Finsweet official filtering indicator)
  const hiddenTagParent = document.getElementById('hiddentagparent');
  const shouldShow = !!hiddenTagParent;
  
  toggleShowWhenFilteredElements(shouldShow);
  return shouldShow;
};

// FIXED: Enhanced tag monitoring with proper cleanup and no recursion
const monitorTags = (() => {
  let isSetup = false; // Flag to prevent multiple setups
  let pollingTimer = null; // Store polling timer for cleanup
  
  return () => {
    // Prevent multiple setups
    if (isSetup) {
      return;
    }
    
    // Initial check
    checkAndToggleFilteredElements();
    
    // Don't use cached query for tagparent
    const tagParent = document.getElementById('tagparent');
    if (tagParent) {
      // Clean up existing observer if it exists
      if (tagParent._mutationObserver) {
        tagParent._mutationObserver.disconnect();
      }
      
      const observer = new MutationObserver(() => {
        // Immediate check when DOM changes
        checkAndToggleFilteredElements();
      });
      observer.observe(tagParent, {childList: true, subtree: true});
      
      // Store observer for cleanup
      tagParent._mutationObserver = observer;
    }
    
    // Additional monitoring: Watch for checkbox changes
    const allCheckboxes = document.querySelectorAll('[checkbox-filter] input[type="checkbox"]');
    allCheckboxes.forEach(checkbox => {
      if (!checkbox.dataset.filteredElementListener) {
        eventManager.add(checkbox, 'change', () => {
          setTimeout(checkAndToggleFilteredElements, 50);
        });
        checkbox.dataset.filteredElementListener = 'true';
      }
    });
    
    // Additional monitoring: Watch for form changes that might indicate filtering
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      if (!form.dataset.filteredElementListener) {
        eventManager.add(form, 'change', () => {
          setTimeout(checkAndToggleFilteredElements, 100);
        });
        eventManager.add(form, 'input', () => {
          setTimeout(checkAndToggleFilteredElements, 100);
        });
        form.dataset.filteredElementListener = 'true';
      }
    });
    
    // FIXED: Fallback polling that doesn't recursively call monitorTags
    const startPolling = () => {
      if (pollingTimer) {
        clearTimeout(pollingTimer);
      }
      
      pollingTimer = setTimeout(() => {
        checkAndToggleFilteredElements(); // Just check, don't setup again
        startPolling(); // Continue polling
      }, 1000);
    };
    
    // Start the polling
    startPolling();
    
    // Mark as setup
    isSetup = true;
    
    // Cleanup function (can be called to reset)
    const cleanup = () => {
      if (pollingTimer) {
        clearTimeout(pollingTimer);
        pollingTimer = null;
      }
      
      const tagParent = document.getElementById('tagparent');
      if (tagParent && tagParent._mutationObserver) {
        tagParent._mutationObserver.disconnect();
        tagParent._mutationObserver = null;
      }
      
      isSetup = false;
    };
    
    // Store cleanup function for external access
    window.cleanupTagMonitoring = cleanup;
  };
})();

// OPTIMIZED: Smart initialization with parallel loading
function init() {
  // Core initialization (parallel where possible)
  getLocationData();
  addNativeMarkers();
  setupEvents();
  
  // Generate locality checkboxes early
  state.setTimer('generateCheckboxes', generateLocalityCheckboxes, 300);
  
  // Layer optimization
  state.setTimer('initialLayerOrder', () => mapLayers.optimizeLayerOrder(), 100);
  
  const handleMapEvents = () => {
    state.clearTimer('mapEventHandler');
    state.setTimer('mapEventHandler', () => {
      // Map events handled by optimized layer management
    }, 10);
  };
  
  map.on('moveend', handleMapEvents);
  map.on('zoomend', handleMapEvents);
  
  // Staggered setup with smart timing
  [300, 800].forEach(delay => 
    state.setTimer(`dropdownSetup-${delay}`, setupDropdownListeners, delay)
  );
  
  state.flags.mapInitialized = true;
  
  // Mark loading step complete
  loadingTracker.markComplete('mapInitialized');
  
  // Initial filtering check
  state.setTimer('initialFiltering', () => {
    if (state.flags.isInitialLoad) {
      const hasFiltering = checkMapMarkersFiltering();
      if (hasFiltering) {
        applyFilterToMarkers();
      }
      state.flags.isInitialLoad = false;
    }
    
    // FIXED: Always check filtered elements on initial load
    checkAndToggleFilteredElements();
  }, 300);
}

// OPTIMIZED: Control positioning with better timing
state.setTimer('controlPositioning', () => {
  // Mark UI loading step complete (positioning is already handled by CSS)
  loadingTracker.markComplete('uiPositioned');
}, 300);

// OPTIMIZED: Map load event handler with parallel operations
map.on("load", () => {
  try {
    init();
    
    // Load combined data
    state.setTimer('loadCombinedData', loadCombinedGeoData, 100);
    
    // Load district tags
    state.setTimer('loadDistrictTags', loadDistrictTags, 800);
    
    // Final layer optimization
    state.setTimer('finalOptimization', () => mapLayers.optimizeLayerOrder(), 3000);
    
  } catch (error) {
    // Mark all loading steps as complete to hide loading screen on error
    Object.keys(loadingTracker.states).forEach(stateName => {
      loadingTracker.markComplete(stateName);
    });
  }
});

// OPTIMIZED: DOM ready handlers
document.addEventListener('DOMContentLoaded', () => {
  setupSidebars();
  setupBackToTopButton();
  
  // Early UI readiness checks
  state.setTimer('earlyUICheck', () => {
    // Check if controls are positioned early
    if (!loadingTracker.states.uiPositioned) {
      const ctrl = $1('.mapboxgl-ctrl-top-right');
      if (ctrl && ctrl.style.top) {
        loadingTracker.markComplete('uiPositioned');
      }
    }
    
    // Check if back to top is ready early
    if (!loadingTracker.states.backToTopSetup) {
      const button = $id('jump-to-top');
      const scrollContainer = $id('scroll-wrap');
      if (button && scrollContainer) {
        loadingTracker.markComplete('backToTopSetup');
      }
    }
  }, 2000);
});

window.addEventListener('load', () => {
  setupSidebars();
  setupBackToTopButton();
  
  state.setTimer('loadFallbackInit', () => {
    if (!state.allLocalityFeatures.length && map.loaded()) {
      try { 
        init(); 
      } catch (error) { 
        // Silent error handling in production
      }
    }
  }, 100);
  
  // Retry mechanisms with smart timing
  if (!state.flags.districtTagsLoaded) {
    [1200, 2500].forEach(delay => 
      state.setTimer(`districtTagsRetry-${delay}`, () => {
        if (!state.flags.districtTagsLoaded) {
          loadDistrictTags();
          // Fallback: mark as complete even if no tags found
          if (!loadingTracker.states.districtTagsLoaded) {
            state.setTimer('districtTagsFallback', () => {
              loadingTracker.markComplete('districtTagsLoaded');
            }, delay + 1000);
          }
        }
      }, delay)
    );
  }
  
  // OPTIMIZED: Auto-trigger reframing with smart logic
  const checkAndReframe = () => {
    if (map.loaded() && !map.isMoving() && checkMapMarkersFiltering()) {
      state.flags.forceFilteredReframe = true;
      state.flags.isRefreshButtonAction = true;
      applyFilterToMarkers();
      state.setTimer('autoReframeCleanup', () => {
        state.flags.forceFilteredReframe = false;
        state.flags.isRefreshButtonAction = false;
      }, 1000);
      
      // FIXED: Also check filtered elements when reframing
      checkAndToggleFilteredElements();
      return true;
    }
    return false;
  };
  
  if (!checkAndReframe()) {
    state.setTimer('reframeCheck1', () => {
      if (!checkAndReframe()) {
        state.setTimer('reframeCheck2', checkAndReframe, 1000);
      }
    }, 500);
  }
});

// FIXED: Enhanced tag monitoring initialization (immediate start)
state.setTimer('initMonitorTags', () => {
  monitorTags();
  
  // Mark monitoring as part of events setup
  state.setTimer('monitoringCheck', () => {
    if (!loadingTracker.states.eventsSetup) {
      loadingTracker.markComplete('eventsSetup');
    }
  }, 1000);
}, 100);

// FIXED: Additional check after page is fully loaded
window.addEventListener('load', () => {
  state.setTimer('loadCheckFiltered', checkAndToggleFilteredElements, 200);
});

// ========================
// GLOBAL EXPORTS & UTILITIES
// ========================

// Make functions available globally for autocomplete integration
window.selectDistrictCheckbox = selectDistrictCheckbox;
window.selectLocalityCheckbox = selectLocalityCheckbox;
window.applyFilterToMarkers = applyFilterToMarkers;
window.highlightBoundary = highlightBoundary;
window.map = map;
window.mapboxgl = mapboxgl;

// OPTIMIZED: Shared utilities for other scripts (integration optimization)
window.mapUtilities = {
  getAvailableFilterLists,
  domCache,
  eventManager,
  state,
  utils,
  mapLayers,
  sidebarCache,
  toggleSidebar,
  closeSidebar,
  checkAndToggleFilteredElements, // FIXED: Export the new filtered elements function
  toggleShowWhenFilteredElements // FIXED: Export the toggle function too
};

// ========================
// CLEANUP
// ========================

// OPTIMIZED: Cleanup on page unload (prevent memory leaks)
window.addEventListener('beforeunload', () => {
  // Clean up all managed resources
  eventManager.cleanup();
  state.cleanup();
  sidebarCache.invalidate();
  
  // Clean up mutation observers
  const tagParent = $id('tagparent');
  if (tagParent && tagParent._mutationObserver) {
    tagParent._mutationObserver.disconnect();
  }
  
  // Clean up back to top tag observer  
  if (tagParent && tagParent._tagObserver) {
    tagParent._tagObserver.disconnect();
  }
  
  // Clean up map resources
  if (map) {
    map.remove();
  }
});
