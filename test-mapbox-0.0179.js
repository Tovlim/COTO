// OPTIMIZED MAPBOX & AUTOCOMPLETE SCRIPT - Production Version 2025
// Enhanced with memory management, smart loading, and performance optimizations

// ========================
// MEMORY MANAGEMENT & CACHE LIMITS
// ========================

class CacheLimitedMap extends Map {
    constructor(maxSize = 100) {
        super();
        this.maxSize = maxSize;
    }
    
    set(key, value) {
        // Remove oldest entries when hitting limit
        if (this.size >= this.maxSize) {
            const firstKey = this.keys().next().value;
            this.delete(firstKey);
        }
        return super.set(key, value);
    }
}

// ========================
// PERFORMANCE UTILITIES
// ========================

// Batch operations using RAF
class RAFBatcher {
    constructor() {
        this.operations = [];
        this.pending = false;
    }
    
    add(operation, priority = 0) {
        this.operations.push({ fn: operation, priority });
        if (!this.pending) {
            this.pending = true;
            requestAnimationFrame(() => this.execute());
        }
    }
    
    execute() {
        // Sort by priority (higher = sooner)
        this.operations.sort((a, b) => b.priority - a.priority);
        
        this.operations.forEach(({ fn }) => {
            try { fn(); } catch (e) { console.error('RAF batch error:', e); }
        });
        
        this.operations = [];
        this.pending = false;
    }
}

// Global RAF batcher
const rafBatcher = new RAFBatcher();

// ========================
// INTERSECTION OBSERVER FOR VISIBILITY
// ========================

class VisibilityObserver {
    constructor() {
        this.cache = new CacheLimitedMap(500);
        this.observers = new Map();
        
        // Create observer with margins for better performance
        this.observer = new IntersectionObserver(
            (entries) => this.handleIntersections(entries),
            { rootMargin: '50px' }
        );
    }
    
    observe(element) {
        if (!element || this.observers.has(element)) return;
        
        this.observer.observe(element);
        this.observers.set(element, true);
    }
    
    handleIntersections(entries) {
        entries.forEach(entry => {
            this.cache.set(entry.target, entry.isIntersecting);
        });
    }
    
    isVisible(element) {
        if (this.cache.has(element)) {
            return this.cache.get(element);
        }
        
        // Fallback to manual check
        const rect = element.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
        this.cache.set(element, isVisible);
        
        // Start observing for future checks
        this.observe(element);
        
        return isVisible;
    }
    
    cleanup() {
        this.observer.disconnect();
        this.observers.clear();
        this.cache.clear();
    }
}

const visibilityObserver = new VisibilityObserver();

// ========================
// NETWORK UTILITIES WITH RETRY
// ========================

async function fetchWithRetry(url, options = {}, maxRetries = 3) {
    let lastError;
    let delay = 1000; // Start with 1 second
    
    for (let i = 0; i <= maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response;
        } catch (error) {
            lastError = error;
            if (i < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
            }
        }
    }
    
    throw lastError;
}

// ========================
// PRELOAD CRITICAL ASSETS
// ========================

function preloadCriticalAssets() {
    // Preload Mapbox fonts
    const fonts = [
        'https://api.mapbox.com/fonts/v1/mapbox/open-sans-regular/0-255.pbf',
        'https://api.mapbox.com/fonts/v1/mapbox/open-sans-regular/256-511.pbf'
    ];
    
    fonts.forEach(font => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'fetch';
        link.href = font;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
    });
}

// Call immediately
preloadCriticalAssets();

// ========================
// OPTIMIZED AUTOCOMPLETE CLASS
// ========================

class OptimizedRealTimeAutocomplete {
    constructor(options = {}) {
        this.elementIds = {
            inputId: options.inputId || "refresh-on-enter",
            listId: options.listId || "search-terms",
            wrapperId: options.wrapperId || "searchTermsWrapper",
            clearId: options.clearId || "searchclear"
        };
        
        // Cached elements
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
        
        // Performance caches
        this.visibilityCache = new CacheLimitedMap(200);
        this.termsCache = { districts: [], localities: [], timestamp: 0 };
        this.cacheTimeout = 500; // Cache terms for 500ms
        
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
        
        // Start periodic cache cleanup
        this.startCacheCleanup();
    }
    
    startCacheCleanup() {
        // Clean caches every 30 seconds
        setInterval(() => {
            this.visibilityCache.clear();
            this.termsCache.timestamp = 0;
        }, 30000);
    }
    
    applyStyles() {
        // Minified inline styles
        const styles = `#${this.elementIds.wrapperId}::-webkit-scrollbar{display:none}`;
        if (!document.querySelector(`style[data-autocomplete="${this.elementIds.wrapperId}"]`)) {
            const style = document.createElement('style');
            style.setAttribute('data-autocomplete', this.elementIds.wrapperId);
            style.textContent = styles;
            document.head.appendChild(style);
        }
        
        this.elements.input.setAttribute('autocomplete', 'off');
        this.elements.input.setAttribute('spellcheck', 'false');
        
        Object.assign(this.elements.wrapper.style, {
            position: 'fixed',
            zIndex: '999999',
            display: 'none',
            visibility: 'visible',
            opacity: '1',
            minWidth: '200px',
            maxWidth: '400px',
            overflow: 'hidden',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
        });
    }
    
    setupEventListeners() {
        const debouncedInput = this.createDebouncer(
            (e) => this.handleInput(e), 
            this.debounceDelay,
            'input'
        );
        
        // Use single event delegation for performance
        this.attachEventHandler('input', 'input', debouncedInput);
        this.attachEventHandler('input', 'focus', () => this.handleFocus());
        this.attachEventHandler('input', 'blur', () => this.handleBlur());
        this.attachEventHandler('input', 'keydown', (e) => this.handleKeydown(e));
        
        // Delegate click events on list
        this.attachEventHandler('list', 'click', (e) => {
            if (e.target.classList.contains('list-term')) {
                this.handleDropdownClick(e);
            }
        });
        
        this.attachEventHandler('document', 'click', (e) => this.handleOutsideClick(e));
        
        if (this.elements.clear) {
            this.attachEventHandler('clear', 'click', () => this.handleClear());
        }
    }
    
    attachEventHandler(elementKey, eventType, handler) {
        const element = elementKey === 'document' ? document : this.elements[elementKey];
        if (!element) return;
        
        element.addEventListener(eventType, handler, { passive: true });
        
        const handlerKey = `${elementKey}-${eventType}`;
        this.eventHandlers.set(handlerKey, { element, eventType, handler });
    }
    
    createDebouncer(func, delay, timerId) {
        return (...args) => {
            const existingTimer = this.debounceTimers.get(timerId);
            if (existingTimer) clearTimeout(existingTimer);
            
            const timer = setTimeout(() => {
                this.debounceTimers.delete(timerId);
                func.apply(this, args);
            }, delay);
            
            this.debounceTimers.set(timerId, timer);
        };
    }
    
    // Optimized visibility checking with caching
    getCurrentlyVisibleTerms() {
        const now = Date.now();
        
        // Return cached results if still fresh
        if (now - this.termsCache.timestamp < this.cacheTimeout) {
            return [...this.termsCache.districts, ...this.termsCache.localities];
        }
        
        const container = this.getFilterContainer();
        if (!container) return [];
        
        const visibleDistricts = new Set();
        const visibleLocalities = new Set();
        
        // Use visibility observer for better performance
        const localityElements = container.querySelectorAll('.data-places-names-filter');
        const districtElements = container.querySelectorAll('.data-places-district-filter');
        
        localityElements.forEach(element => {
            if (visibilityObserver.isVisible(element)) {
                const term = element.textContent.trim();
                if (term) visibleLocalities.add(term);
            }
        });
        
        districtElements.forEach(element => {
            if (visibilityObserver.isVisible(element)) {
                const term = element.textContent.trim();
                if (term) visibleDistricts.add(term);
            }
        });
        
        // Update cache
        this.termsCache = {
            districts: [...visibleDistricts].sort(),
            localities: [...visibleLocalities].sort(),
            timestamp: now
        };
        
        return [...this.termsCache.districts, ...this.termsCache.localities];
    }
    
    getFilterContainer() {
        // Try cached container first
        if (this._cachedContainer && document.contains(this._cachedContainer)) {
            return this._cachedContainer;
        }
        
        let container = document.getElementById(this.targetCollection);
        if (container) {
            this._cachedContainer = container;
            return container;
        }
        
        // Fallback search
        for (let i = 1; i <= 10; i++) {
            container = document.getElementById(`cms-filter-list-${i}`);
            if (container) {
                this._cachedContainer = container;
                return container;
            }
        }
        
        return null;
    }
    
    getCurrentlyVisibleDistricts() {
        return this.termsCache.districts || [];
    }
    
    getCurrentlyVisibleLocalities() {
        return this.termsCache.localities || [];
    }
    
    // Rest of autocomplete methods remain the same but use cached data...
    handleInput(e) {
        if (document.activeElement === this.elements.input) {
            this.showVisibleTerms();
        }
    }
    
    handleFocus() {
        const hiddenListSearch = document.getElementById('hidden-list-search');
        if (hiddenListSearch) {
            hiddenListSearch.value = '';
            hiddenListSearch.dispatchEvent(new Event('input', { bubbles: true }));
            hiddenListSearch.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        this.showVisibleTerms();
    }
    
    handleBlur() {
        setTimeout(() => {
            if (!this.elements.wrapper.matches(':hover')) {
                this.hideDropdown();
            }
        }, 200);
    }
    
    handleDropdownClick(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const term = e.target.getAttribute('data-term');
        const type = e.target.getAttribute('data-type');
        
        this.selectTerm(term, type);
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
                    const term = currentActive.getAttribute('data-term');
                    const type = currentActive.getAttribute('data-type') || 'locality';
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
        rafBatcher.add(() => {
            items.forEach(item => item.classList.remove('active'));
            if (items[index]) {
                items[index].classList.add('active');
                items[index].scrollIntoView({ block: 'nearest' });
            }
        });
    }
    
    showVisibleTerms() {
        const visibleDistricts = this.getCurrentlyVisibleDistricts();
        const visibleLocalities = this.getCurrentlyVisibleLocalities();
        
        if (visibleDistricts.length === 0 && visibleLocalities.length === 0) {
            this.hideDropdown();
            return;
        }
        
        this.updateDropdownContent(visibleDistricts, visibleLocalities);
        this.updatePositioning();
        this.elements.wrapper.style.display = 'block';
    }
    
    updateDropdownContent(districts, localities) {
        this.elements.list.innerHTML = '';
        
        const searchText = this.elements.input.value.trim();
        
        const sortedDistricts = this.sortTermsByRelevance(districts, searchText);
        const sortedLocalities = this.sortTermsByRelevance(localities, searchText);
        
        const fragment = document.createDocumentFragment();
        
        if (sortedDistricts.length > 0) {
            sortedDistricts.forEach(district => {
                const li = document.createElement('li');
                li.innerHTML = `<a href="#" class="list-term district-term" data-term="${this.escapeHtml(district)}" data-type="district">${this.escapeHtml(district)} <span class="term-label">Region</span></a>`;
                fragment.appendChild(li);
            });
        }
        
        sortedLocalities.forEach(locality => {
            const li = document.createElement('li');
            li.innerHTML = `<a href="#" class="list-term locality-term" data-term="${this.escapeHtml(locality)}" data-type="locality">${this.escapeHtml(locality)} <span class="term-label">Locality</span></a>`;
            fragment.appendChild(li);
        });
        
        this.elements.list.appendChild(fragment);
        
        this.addDistrictStyling();
    }
    
    sortTermsByRelevance(terms, searchText) {
        if (!searchText) return terms;
        
        const search = searchText.toLowerCase();
        
        const startsWithSearch = [];
        const containsSearch = [];
        const others = [];
        
        terms.forEach(term => {
            const termLower = term.toLowerCase();
            if (termLower.startsWith(search)) {
                startsWithSearch.push(term);
            } else if (termLower.includes(search)) {
                containsSearch.push(term);
            } else {
                others.push(term);
            }
        });
        
        return [
            ...startsWithSearch.sort(),
            ...containsSearch.sort(),
            ...others.sort()
        ];
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
        if (this._cachedWrapper) return this._cachedWrapper;
        
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
        
        this._cachedWrapper = wrapperElement;
        return wrapperElement;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    hideDropdown() {
        this.elements.wrapper.style.display = 'none';
        this.elements.list.querySelectorAll('.list-term.active')
            .forEach(item => item.classList.remove('active'));
    }
    
    selectTerm(term, type = 'locality') {
        if (type === 'district') {
            this.elements.input.value = term;
            this.hideDropdown();
            this.triggerDistrictSelection(term);
        } else {
            this.elements.input.value = term;
            this.hideDropdown();
            this.triggerLocalitySelection(term);
        }
        
        setTimeout(() => {
            if (!this.isMapboxIntegration || !window.isMarkerClick) {
                this.elements.input.focus();
            }
        }, 50);
    }
    
    triggerDistrictSelection(districtName) {
        window.isMarkerClick = true;
        
        if (window.mapUtilities && window.mapUtilities.state) {
            window.mapUtilities.state.markerInteractionLock = false;
        }
        
        if (typeof window.selectDistrictCheckbox === 'function') {
            window.selectDistrictCheckbox(districtName);
        }
        
        if (window.mapUtilities && typeof window.mapUtilities.toggleShowWhenFilteredElements === 'function') {
            window.mapUtilities.toggleShowWhenFilteredElements(true);
        }
        
        if (window.mapUtilities && typeof window.mapUtilities.toggleSidebar === 'function') {
            window.mapUtilities.toggleSidebar('Left', true);
        }
        
        const cleanupFlags = () => {
            window.isMarkerClick = false;
            if (window.mapUtilities && window.mapUtilities.state) {
                window.mapUtilities.state.markerInteractionLock = false;
                window.mapUtilities.state.flags.forceFilteredReframe = false;
                window.mapUtilities.state.flags.isRefreshButtonAction = false;
            }
        };
        
        const districtFeature = window.mapUtilities?.state?.allDistrictFeatures?.find(f => 
            f.properties.name === districtName
        );
        
        if (districtFeature && districtFeature.properties.source === 'tag') {
            const hiddenListSearch = document.getElementById('hidden-list-search');
            if (hiddenListSearch) {
                hiddenListSearch.value = districtName;
                hiddenListSearch.dispatchEvent(new Event('input', { bubbles: true }));
                hiddenListSearch.dispatchEvent(new Event('change', { bubbles: true }));
            }
            
            setTimeout(() => {
                if (window.mapUtilities && window.mapUtilities.state) {
                    const state = window.mapUtilities.state;
                    state.flags.forceFilteredReframe = true;
                    state.flags.isRefreshButtonAction = true;
                    
                    if (typeof window.applyFilterToMarkers === 'function') {
                        window.applyFilterToMarkers();
                        setTimeout(cleanupFlags, 1000);
                    } else {
                        setTimeout(cleanupFlags, 500);
                    }
                } else {
                    setTimeout(cleanupFlags, 500);
                }
            }, 100);
            
            return;
        }
        
        if (window.mapUtilities && window.mapUtilities.state && typeof window.highlightBoundary === 'function') {
            const boundarySourceId = `${districtName.toLowerCase().replace(/\s+/g, '-')}-boundary`;
            
            if (window.map && window.map.getSource && window.map.getSource(boundarySourceId)) {
                const source = window.map.getSource(boundarySourceId);
                if (source && source._data) {
                    window.highlightBoundary(districtName);
                    
                    const bounds = new window.mapboxgl.LngLatBounds();
                    const addCoords = coords => {
                        if (Array.isArray(coords) && coords.length > 0) {
                            if (typeof coords[0] === 'number') bounds.extend(coords);
                            else coords.forEach(addCoords);
                        }
                    };
                    
                    source._data.features.forEach(feature => addCoords(feature.geometry.coordinates));
                    window.map.fitBounds(bounds, {padding: 50, duration: 1000, essential: true});
                    
                    setTimeout(cleanupFlags, 1200);
                    return;
                }
            }
        }
        
        setTimeout(() => {
            if (window.mapUtilities && window.mapUtilities.state) {
                const state = window.mapUtilities.state;
                state.flags.forceFilteredReframe = true;
                state.flags.isRefreshButtonAction = true;
                
                if (typeof window.applyFilterToMarkers === 'function') {
                    window.applyFilterToMarkers();
                    setTimeout(cleanupFlags, 1000);
                } else {
                    setTimeout(cleanupFlags, 500);
                }
            } else {
                setTimeout(cleanupFlags, 500);
            }
        }, 100);
    }
    
    triggerLocalitySelection(localityName) {
        window.isMarkerClick = true;
        
        if (window.mapUtilities && window.mapUtilities.state) {
            window.mapUtilities.state.markerInteractionLock = false;
        }
        
        if (typeof window.selectLocalityCheckbox === 'function') {
            window.selectLocalityCheckbox(localityName);
        }
        
        if (window.mapUtilities && typeof window.mapUtilities.toggleShowWhenFilteredElements === 'function') {
            window.mapUtilities.toggleShowWhenFilteredElements(true);
        }
        
        if (window.mapUtilities && typeof window.mapUtilities.toggleSidebar === 'function') {
            window.mapUtilities.toggleSidebar('Left', true);
        }
        
        const cleanupFlags = () => {
            window.isMarkerClick = false;
            if (window.mapUtilities && window.mapUtilities.state) {
                window.mapUtilities.state.markerInteractionLock = false;
                window.mapUtilities.state.flags.forceFilteredReframe = false;
                window.mapUtilities.state.flags.isRefreshButtonAction = false;
            }
        };
        
        const localityFeature = window.mapUtilities?.state?.allLocalityFeatures?.find(f => 
            f.properties.name === localityName
        );
        
        if (localityFeature && window.map) {
            window.map.flyTo({
                center: localityFeature.geometry.coordinates,
                zoom: 13.5,
                duration: 1000,
                essential: true
            });
            
            setTimeout(cleanupFlags, 1200);
        } else {
            setTimeout(cleanupFlags, 500);
        }
        
        this.triggerSearchEvents();
    }
    
    addDistrictStyling() {
        if (document.querySelector('#autocomplete-district-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'autocomplete-district-styles';
        // Minified CSS
        style.textContent = `.list-term.district-term,.list-term.locality-term{display:flex;align-items:center;justify-content:space-between;padding:8px 12px}.list-term.district-term{font-weight:600;color:#6e3500;background-color:#fdf6f0;border-left:3px solid #6e3500}.list-term.district-term:hover{background-color:#f5e6d3}.list-term.locality-term{font-weight:500;color:#7e7800;background-color:#fffef5;border-left:3px solid #7e7800}.list-term.locality-term:hover{background-color:#f9f8e6}.term-label{font-size:.75em;font-weight:normal;opacity:.8;margin-left:8px;flex-shrink:0}.list-term.district-term .term-label{color:#8f4500}.list-term.locality-term .term-label{color:#a49c00}`;
        document.head.appendChild(style);
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
    
    refresh() {
        if (document.activeElement === this.elements.input) {
            this.showVisibleTerms();
        }
    }
    
    destroy() {
        // Clear timers
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
        
        // Remove event listeners
        this.eventHandlers.forEach(({ element, eventType, handler }) => {
            element.removeEventListener(eventType, handler);
        });
        this.eventHandlers.clear();
        
        // Clear caches
        this.visibilityCache.clear();
        this.termsCache = { districts: [], localities: [], timestamp: 0 };
    }
    
    getStats() {
        const visibleDistricts = this.getCurrentlyVisibleDistricts();
        const visibleLocalities = this.getCurrentlyVisibleLocalities();
        return {
            visibleDistricts: visibleDistricts.length,
            visibleLocalities: visibleLocalities.length,
            totalVisible: visibleDistricts.length + visibleLocalities.length,
            targetContainer: this.targetCollection,
            dataField: this.dataField,
            eventHandlers: this.eventHandlers.size,
            activeTimers: this.debounceTimers.size,
            cacheSize: this.visibilityCache.size
        };
    }
}

// ========================
// MAIN MAP SCRIPT - OPTIMIZED
// ========================

// Detect mobile
const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Show loading screen at start
const loadingScreen = document.getElementById('loading-map-screen');
if (loadingScreen) loadingScreen.style.display = 'flex';

// Optimized DOM Cache with size limits
class OptimizedDOMCache {
    constructor() {
        this.cache = new CacheLimitedMap(50);
        this.selectorCache = new CacheLimitedMap(100);
        this.listCache = new CacheLimitedMap(50);
    }
    
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
    
    $(selector) {
        if (!this.listCache.has(selector)) {
            this.listCache.set(selector, Array.from(document.querySelectorAll(selector)));
        }
        return this.listCache.get(selector);
    }
    
    invalidate() {
        this.cache.clear();
        this.selectorCache.clear(); 
        this.listCache.clear();
    }
}

const domCache = new OptimizedDOMCache();
const $ = (selector) => domCache.$(selector);
const $1 = (selector) => domCache.$1(selector);  
const $id = (id) => domCache.$id(id);

// Optimized Event Manager with delegation
class OptimizedEventManager {
    constructor() {
        this.listeners = new Map();
        this.delegatedListeners = new Map();
        this.debounceTimers = new Map();
        
        // Setup global delegated listeners
        this.setupGlobalDelegation();
    }
    
    setupGlobalDelegation() {
        // Single global click handler
        document.addEventListener('click', (e) => {
            const delegated = this.delegatedListeners.get('click');
            if (!delegated) return;
            
            delegated.forEach(({ selector, handler }) => {
                const target = e.target.closest(selector);
                if (target) handler.call(target, e);
            });
        }, { passive: true });
        
        // Single global change handler
        document.addEventListener('change', (e) => {
            const delegated = this.delegatedListeners.get('change');
            if (!delegated) return;
            
            delegated.forEach(({ selector, handler }) => {
                const target = e.target.closest(selector);
                if (target) handler.call(target, e);
            });
        }, { passive: true });
    }
    
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
    
    delegate(event, selector, handler) {
        if (!this.delegatedListeners.has(event)) {
            this.delegatedListeners.set(event, []);
        }
        
        this.delegatedListeners.get(event).push({ selector, handler });
        return true;
    }
    
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
    
    cleanup() {
        this.listeners.forEach((listeners) => {
            listeners.forEach(({ element, event, handler, options }) => {
                element.removeEventListener(event, handler, options);
            });
        });
        
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        
        this.listeners.clear();
        this.delegatedListeners.clear();
        this.debounceTimers.clear();
    }
}

const eventManager = new OptimizedEventManager();

// Initialize Mapbox
const lang = navigator.language.split('-')[0];
mapboxgl.accessToken = "pk.eyJ1Ijoibml0YWloYXJkeSIsImEiOiJjbWRzNGIxemIwMHVsMm1zaWp3aDl2Y3RsIn0.l_GLzIUCO84SF5_4TcmF3g";

// RTL support
const rtlLanguages = ['ar', 'he', 'fa', 'ur', 'yi'];
if (rtlLanguages.includes(lang)) {
    mapboxgl.setRTLTextPlugin(
        "https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.3.0/mapbox-gl-rtl-text.js",
        null,
        true
    );
}

const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/nitaihardy/cmdp8fjw100ex01s83b2d6jzf",
    center: isMobile ? [34.85, 31.7] : [35.22, 31.85],
    zoom: isMobile ? 7.1 : 8.33,
    language: ['en','es','fr','de','zh','ja','ru','ar','he','fa','ur'].includes(lang) ? lang : 'en'
});

map.addControl(new mapboxgl.GeolocateControl({
    positionOptions: {enableHighAccuracy: true}, 
    trackUserLocation: true, 
    showUserHeading: true
}));

map.addControl(new mapboxgl.NavigationControl({
    showCompass: false,
    showZoom: true,
    visualizePitch: false
}), 'top-right');

const scaleControl = new mapboxgl.ScaleControl({
    maxWidth: 100,
    unit: 'metric'
});
const scalePosition = window.innerWidth <= 478 ? 'bottom-left' : 'bottom-right';
map.addControl(scaleControl, scalePosition);

// Custom Map Reset Control
class MapResetControl {
    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
        
        this._button = document.createElement('button');
        this._button.className = 'mapboxgl-ctrl-icon';
        this._button.type = 'button';
        this._button.title = 'Reset map to default view';
        this._button.setAttribute('aria-label', 'Reset map to default view');
        
        this._button.style.cssText = `
            background-image: url("https://cdn.prod.website-files.com/6824fc6dd9bace7c31d8a0d9/6873aecae0c1702f3d417a81_reset%20icon%203.svg");
            background-repeat: no-repeat;
            background-position: center;
            background-size: 15px 15px;
        `;
        
        this._button.addEventListener('click', () => {
            this._map.flyTo({
                center: isMobile ? [34.85, 31.7] : [35.22, 31.85],
                zoom: isMobile ? 7.1 : 8.33,
                duration: 1000,
                essential: true
            });
            
            if (this._map.getSource('localities-source')) {
                this._map.getSource('localities-source').setData({
                    type: "FeatureCollection", 
                    features: state.allLocalityFeatures
                });
            }
            
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

map.addControl(new MapResetControl(), 'top-right');

// Optimized Map State without duplicate storage
class OptimizedMapState {
    constructor() {
        // Only store feature IDs and essential data, not full features
        this.featureIndex = new Map(); // id -> essential properties
        this.districtIndex = new Map(); // name -> id
        this.localityIndex = new Map(); // name -> id
        
        this.timers = new Map();
        this.lastClickedMarker = null;
        this.lastClickTime = 0;
        this.markerInteractionLock = false;
        this.highlightedBoundary = null;
        
        this.flags = {
            isInitialLoad: true,
            mapInitialized: false,
            forceFilteredReframe: false,
            isRefreshButtonAction: false,
            dropdownListenersSetup: false,
            districtTagsLoaded: false,
            areaControlsSetup: false,
            skipNextReframe: false
        };
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
        this.featureIndex.clear();
        this.districtIndex.clear();
        this.localityIndex.clear();
    }
    
    // Getters for backward compatibility
    get allLocalityFeatures() {
        const features = [];
        this.localityIndex.forEach((id) => {
            const props = this.featureIndex.get(id);
            if (props) {
                features.push({
                    type: "Feature",
                    geometry: { type: "Point", coordinates: props.coordinates },
                    properties: props
                });
            }
        });
        return features;
    }
    
    get allDistrictFeatures() {
        const features = [];
        this.districtIndex.forEach((id) => {
            const props = this.featureIndex.get(id);
            if (props) {
                features.push({
                    type: "Feature",
                    geometry: { type: "Point", coordinates: props.coordinates },
                    properties: props
                });
            }
        });
        return features;
    }
}

// Enhanced loading tracker with smart priorities
const loadingTracker = {
    critical: {
        mapInitialized: false,
        markersAdded: false
    },
    
    secondary: {
        locationDataLoaded: false,
        geoDataLoaded: false,
        districtTagsLoaded: false
    },
    
    tertiary: {
        controlsSetup: false,
        sidebarSetup: false,
        tabSwitcherSetup: false,
        eventsSetup: false,
        uiPositioned: false,
        autocompleteReady: false,
        backToTopSetup: false
    },
    
    markComplete(stateName) {
        // Find and update the state
        for (const priority of ['critical', 'secondary', 'tertiary']) {
            if (this[priority].hasOwnProperty(stateName)) {
                this[priority][stateName] = true;
                this.checkProgress();
                return;
            }
        }
    },
    
    checkProgress() {
        const criticalComplete = Object.values(this.critical).every(v => v);
        const secondaryComplete = Object.values(this.secondary).every(v => v);
        
        // Show partial UI as soon as critical steps complete
        if (criticalComplete && loadingScreen) {
            loadingScreen.style.opacity = '0.5';
        }
        
        // Hide loading screen when critical + secondary complete
        if (criticalComplete && secondaryComplete) {
            this.hideLoadingScreen();
        }
    },
    
    hideLoadingScreen() {
        if (loadingScreen && loadingScreen.style.display !== 'none') {
            loadingScreen.style.display = 'none';
        }
    }
};

// Remove long fallback timeouts - use shorter progressive ones
setTimeout(() => {
    if (loadingScreen && loadingScreen.style.display !== 'none') {
        loadingScreen.style.opacity = '0.7';
    }
}, 3000);

setTimeout(() => {
    loadingTracker.hideLoadingScreen();
}, 5000);

const state = new OptimizedMapState();
window.isLinkClick = false;

// Optimized utilities
const utils = {
    triggerEvent: (el, events) => {
        events.forEach(eventType => {
            el.dispatchEvent(new Event(eventType, {bubbles: true}));
        });
    },
    
    setStyles: (el, styles) => {
        rafBatcher.add(() => {
            Object.assign(el.style, styles);
        });
    },
    
    calculateCentroid: (() => {
        const cache = new CacheLimitedMap(50);
        
        return (coordinates) => {
            const key = JSON.stringify(coordinates);
            if (cache.has(key)) return cache.get(key);
            
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
            cache.set(key, result);
            return result;
        };
    })()
};

// Optimized Map Layer Management with debounced reordering
class OptimizedMapLayers {
    constructor(map) {
        this.map = map;
        this.layerOrder = [];
        this.sourceCache = new CacheLimitedMap(50);
        this.layerCache = new CacheLimitedMap(100);
        this.batchOperations = [];
        this.pendingBatch = false;
        
        // Debounce layer reordering
        this.optimizeLayerOrder = eventManager.debounce(
            this._optimizeLayerOrder.bind(this),
            500,
            'layerReorder'
        );
    }
    
    addToBatch(operation) {
        this.batchOperations.push(operation);
        if (!this.pendingBatch) {
            this.pendingBatch = true;
            rafBatcher.add(() => this.processBatch(), 2);
        }
    }
    
    processBatch() {
        this.batchOperations.forEach(operation => {
            try { operation(); } catch (error) { }
        });
        
        this.batchOperations = [];
        this.pendingBatch = false;
        
        // Schedule layer optimization
        this.optimizeLayerOrder();
    }
    
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
    
    _optimizeLayerOrder() {
        const markerLayers = ['locality-clusters', 'locality-points', 'district-points'];
        const currentOrder = this.map.getStyle().layers.map(l => l.id);
        
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
                            this.layerCache.delete(layerId);
                        }
                    } catch (e) { }
                }
            });
        }
    }
    
    invalidateCache() {
        this.layerCache.clear();
        this.sourceCache.clear();
    }
}

const mapLayers = new OptimizedMapLayers(map);

// Sidebar cache
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

// Helper functions
const closeSidebar = (side) => {
    const sidebar = sidebarCache.getSidebar(side);
    if (!sidebar || !sidebar.classList.contains('is-show')) return;
    
    sidebar.classList.remove('is-show');
    
    const arrowIcon = sidebarCache.getArrow(side);
    if (arrowIcon) arrowIcon.style.transform = 'rotateY(0deg)';
    
    const jsMarginProperty = sidebarCache.getMarginProperty(side);
    if (window.innerWidth > 478) {
        const width = sidebarCache.getWidth(side);
        sidebar.style[jsMarginProperty] = `-${width + 1}px`;
    } else {
        sidebar.style[jsMarginProperty] = '';
    }
    
    sidebar.style.pointerEvents = '';
};

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
        
        if (isShowing) {
            if (window.innerWidth <= 991) {
                ['Left', 'SecondLeft', 'Right'].forEach(otherSide => {
                    if (otherSide !== side) closeSidebar(otherSide);
                });
            } else if (side === 'Left' || side === 'SecondLeft') {
                const otherLeftSide = side === 'Left' ? 'SecondLeft' : 'Left';
                closeSidebar(otherLeftSide);
            }
        }
    } else {
        sidebar.style[jsMarginProperty] = isShowing ? '0' : '';
        if (isShowing) {
            ['Left', 'SecondLeft', 'Right'].forEach(otherSide => {
                if (otherSide !== side) closeSidebar(otherSide);
            });
        }
    }
    
    utils.setStyles(sidebar, {pointerEvents: isShowing ? 'auto' : ''});
    if (arrowIcon) arrowIcon.style.transform = isShowing ? 'rotateY(180deg)' : 'rotateY(0deg)';
};

// Boundary highlighting
function highlightBoundary(districtName) {
    removeBoundaryHighlight();
    
    const boundaryFillId = `${districtName.toLowerCase().replace(/\s+/g, '-')}-fill`;
    const boundaryBorderId = `${districtName.toLowerCase().replace(/\s+/g, '-')}-border`;
    
    if (mapLayers.hasLayer(boundaryFillId) && mapLayers.hasLayer(boundaryBorderId)) {
        mapLayers.addToBatch(() => {
            map.setPaintProperty(boundaryFillId, 'fill-color', '#6e3500');
            map.setPaintProperty(boundaryFillId, 'fill-opacity', 0.25);
            map.setPaintProperty(boundaryBorderId, 'line-color', '#6e3500');
            map.setPaintProperty(boundaryBorderId, 'line-opacity', 0.6);
        });
        
        state.highlightedBoundary = districtName;
    }
}

function removeBoundaryHighlight() {
    if (state.highlightedBoundary) {
        const boundaryFillId = `${state.highlightedBoundary.toLowerCase().replace(/\s+/g, '-')}-fill`;
        const boundaryBorderId = `${state.highlightedBoundary.toLowerCase().replace(/\s+/g, '-')}-border`;
        
        if (mapLayers.hasLayer(boundaryFillId) && mapLayers.hasLayer(boundaryBorderId)) {
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

const toggleShowWhenFilteredElements = show => {
    const elements = document.querySelectorAll('[show-when-filtered="true"]');
    if (elements.length === 0) return;
    
    elements.forEach(element => {
        element.style.display = show ? 'block' : 'none';
        element.style.visibility = show ? 'visible' : 'hidden';
        element.style.opacity = show ? '1' : '0';
        element.style.pointerEvents = show ? 'auto' : 'none';
    });
};

// Checkbox selection functions
function selectDistrictCheckbox(districtName) {
    const districtCheckboxes = $('[checkbox-filter="district"] input[fs-list-value]');
    const localityCheckboxes = $('[checkbox-filter="locality"] input[fs-list-value]');
    
    rafBatcher.add(() => {
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
    }, 3);
}

function selectLocalityCheckbox(localityName) {
    const districtCheckboxes = $('[checkbox-filter="district"] input[fs-list-value]');
    const localityCheckboxes = $('[checkbox-filter="locality"] input[fs-list-value]');
    
    rafBatcher.add(() => {
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
    }, 3);
}

// Smart filter list discovery
const getAvailableFilterLists = (() => {
    let cachedLists = null;
    let lastCacheTime = 0;
    const cacheTimeout = 5000;
    
    return () => {
        const now = Date.now();
        if (cachedLists && (now - lastCacheTime) < cacheTimeout) {
            return cachedLists;
        }
        
        const lists = [];
        let consecutiveGaps = 0;
        
        for (let i = 1; i <= 20; i++) {
            const listId = `cms-filter-list-${i}`;
            if ($id(listId)) {
                lists.push(listId);
                consecutiveGaps = 0;
            } else {
                consecutiveGaps++;
                if (consecutiveGaps >= 3 && lists.length === 0) break;
                if (consecutiveGaps >= 5) break;
            }
        }
        
        cachedLists = lists;
        lastCacheTime = now;
        return lists;
    };
})();

// Get location data without duplicate storage
function getLocationData() {
    const lists = getAvailableFilterLists();
    let totalLoaded = 0;
    
    if (lists.length === 0) return;
    
    lists.forEach((listId, listIndex) => {
        const listContainer = $id(listId);
        if (!listContainer) return;
        
        const allElements = listContainer.querySelectorAll(`
            .data-places-names-filter,
            .data-places-latitudes-filter, 
            .data-places-longitudes-filter,
            .data-places-slug-filter,
            .data-places-district-filter
        `);
        
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
        
        for (let i = 0; i < minLength; i++) {
            const lat = parseFloat(elementsByType.lats[i].textContent);
            const lng = parseFloat(elementsByType.lngs[i].textContent);
            
            if (!isNaN(lat) && !isNaN(lng)) {
                const id = `location-${listIndex}-${i}`;
                const name = elementsByType.names[i].textContent.trim();
                
                // Store only essential data in state
                state.featureIndex.set(id, {
                    name: name,
                    id: id,
                    coordinates: [lng, lat],
                    popupIndex: totalLoaded + i,
                    slug: elementsByType.slugs[i]?.textContent.trim() || '',
                    district: elementsByType.districts[i]?.textContent.trim() || '',
                    index: totalLoaded + i,
                    listId: listId,
                    type: 'locality'
                });
                
                state.localityIndex.set(name, id);
            }
        }
        
        totalLoaded += minLength;
    });
    
    loadingTracker.markComplete('locationDataLoaded');
}

// Add native markers
function addNativeMarkers() {
    const features = state.allLocalityFeatures;
    if (!features.length) return;
    
    mapLayers.addToBatch(() => {
        if (mapLayers.hasSource('localities-source')) {
            map.getSource('localities-source').setData({
                type: "FeatureCollection",
                features: features
            });
        } else {
            map.addSource('localities-source', {
                type: 'geojson',
                data: {
                    type: "FeatureCollection",
                    features: features
                },
                cluster: true,
                clusterMaxZoom: 14,
                clusterRadius: 50
            });
            
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
                    'text-halo-color': '#7e7800',
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
            
            mapLayers.invalidateCache();
        }
    });
    
    setupNativeMarkerClicks();
    loadingTracker.markComplete('markersAdded');
}

// Add district markers
function addNativeDistrictMarkers() {
    const features = state.allDistrictFeatures;
    if (!features.length) return;
    
    mapLayers.addToBatch(() => {
        if (mapLayers.hasSource('districts-source')) {
            map.getSource('districts-source').setData({
                type: "FeatureCollection",
                features: features
            });
        } else {
            map.addSource('districts-source', {
                type: 'geojson',
                data: {
                    type: "FeatureCollection",
                    features: features
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
            
            mapLayers.invalidateCache();
        }
    });
    
    setupDistrictMarkerClicks();
}

// Setup marker clicks
function setupNativeMarkerClicks() {
    const localityClickHandler = (e) => {
        const feature = e.features[0];
        const locality = feature.properties.name;
        
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
        
        state.setTimer('markerCleanup', () => {
            window.isMarkerClick = false;
            state.markerInteractionLock = false;
        }, 800);
    };
    
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
    
    map.on('click', 'locality-points', localityClickHandler);
    map.on('click', 'locality-clusters', clusterClickHandler);
    
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

// Filtering checks
const checkFiltering = (() => {
    const cache = new CacheLimitedMap(10);
    const cacheTimeout = 1000;
    
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
        return result;
    };
})();

const checkFilterInstanceFiltering = () => checkFiltering('Filter');

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
        
        const searchInput = document.getElementById('refresh-on-enter');
        if (searchInput && searchInput.value.trim().length > 0) {
            lastResult = true;
            lastCheck = now;
            return true;
        }
        
        const hiddenListSearch = document.getElementById('hidden-list-search');
        if (hiddenListSearch && hiddenListSearch.value.trim().length > 0) {
            lastResult = true;
            lastCheck = now;
            return true;
        }
        
        const lists = getAvailableFilterLists();
        let totalElements = 0;
        let totalVisible = 0;
        
        lists.forEach(listId => {
            const listContainer = $id(listId);
            if (!listContainer) return;
            
            const allFilteredLat = listContainer.querySelectorAll('.data-places-latitudes-filter');
            const visibleFilteredLat = Array.from(allFilteredLat).filter(el => {
                return visibilityObserver.isVisible(el);
            });
            
            totalElements += allFilteredLat.length;
            totalVisible += visibleFilteredLat.length;
        });
        
        lastResult = totalElements > 0 && totalVisible < totalElements;
        lastCheck = now;
        return lastResult;
    };
})();

// Apply filter to markers
function applyFilterToMarkers(shouldReframe = true) {
    if (state.flags.isInitialLoad && !checkMapMarkersFiltering()) return;
    
    if (state.flags.skipNextReframe) return;
    
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
            .filter(pair => visibilityObserver.isVisible(pair.lat));
        visibleData.push(...visiblePairs);
    });
    
    let visibleCoordinates = [];
    
    if (visibleData.length > 0 && visibleData.length < allData.length) {
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
        
        if (mapLayers.hasSource('localities-source')) {
            map.getSource('localities-source').setData({
                type: "FeatureCollection",
                features: state.allLocalityFeatures
            });
        }
    } else if (visibleData.length === allData.length) {
        if (mapLayers.hasSource('localities-source')) {
            map.getSource('localities-source').setData({
                type: "FeatureCollection",
                features: state.allLocalityFeatures
            });
        }
        visibleCoordinates = state.allLocalityFeatures.map(f => f.geometry.coordinates);
    }
    
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

// Debounced filter update
const handleFilterUpdate = eventManager.debounce(() => {
    if (window.isLinkClick || window.isMarkerClick || state.markerInteractionLock) return;
    if (state.flags.skipNextReframe) return;
    
    state.flags.isRefreshButtonAction = true;
    applyFilterToMarkers();
    state.setTimer('filterCleanup', () => {
        state.flags.isRefreshButtonAction = false;
    }, 1000);
}, 150, 'filterUpdate');

// Back to top button
function setupBackToTopButton() {
    const button = $id('jump-to-top');
    const scrollContainer = $id('scroll-wrap');
    
    if (!button || !scrollContainer) return;
    
    button.style.opacity = '0';
    button.style.display = 'flex';
    button.style.pointerEvents = 'none';
    
    const scrollThreshold = 100;
    let isVisible = false;
    
    const updateButtonVisibility = () => {
        const scrollTop = scrollContainer.scrollTop;
        const shouldShow = scrollTop > scrollThreshold;
        
        if (shouldShow && !isVisible) {
            isVisible = true;
            button.style.display = 'flex';
            button.style.pointerEvents = 'auto';
            
            const opacity = Math.min(1, (scrollTop - scrollThreshold) / 100);
            button.style.opacity = opacity.toString();
            
        } else if (!shouldShow && isVisible) {
            isVisible = false;
            button.style.opacity = '0';
            button.style.pointerEvents = 'none';
            
        } else if (shouldShow && isVisible) {
            const opacity = Math.min(1, (scrollTop - scrollThreshold) / 100);
            button.style.opacity = opacity.toString();
        }
    };
    
    const scrollToTop = () => {
        scrollContainer.scrollTo({
            top: 0,
            behavior: 'auto'
        });
    };
    
    eventManager.add(scrollContainer, 'scroll', updateButtonVisibility);
    
    eventManager.add(button, 'click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        scrollToTop();
    });
    
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
        
        tagObserver.observe(tagParent, {
            childList: true,
            subtree: true,
            attributes: true
        });
        
        tagParent._tagObserver = tagObserver;
    }
    
    updateButtonVisibility();
    loadingTracker.markComplete('backToTopSetup');
}

// Tab switcher
function setupTabSwitcher() {
    const tabTriggers = $('[open-tab]');
    
    tabTriggers.forEach(trigger => {
        if (trigger.dataset.tabSwitcherSetup === 'true') return;
        
        eventManager.add(trigger, 'click', function(e) {
            if (!this.hasAttribute('open-right-sidebar')) {
                e.preventDefault();
            }
            
            const groupName = this.getAttribute('open-tab');
            
            if (this.hasAttribute('open-right-sidebar')) {
                return;
            }
            
            const targetTab = $1(`[opened-tab="${groupName}"]`);
            if (targetTab) targetTab.click();
        });
        
        trigger.dataset.tabSwitcherSetup = 'true';
    });
    
    if (!loadingTracker.tertiary.tabSwitcherSetup) {
        loadingTracker.markComplete('tabSwitcherSetup');
    }
}

// Setup controls
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
    
    // Delegated sidebar controls
    eventManager.delegate('click', '[open-right-sidebar="true"], [open-right-sidebar="open-only"]', function() {
        const sidebar = $id('RightSidebar');
        if (!sidebar) return;
        
        const openRightSidebar = this.getAttribute('open-right-sidebar');
        
        if (openRightSidebar === 'open-only') {
            toggleSidebar('Right', true);
        } else if (openRightSidebar === 'true') {
            const currentlyShowing = sidebar.classList.contains('is-show');
            toggleSidebar('Right', !currentlyShowing);
        }
        
        const groupName = this.getAttribute('open-tab');
        if (groupName) {
            state.setTimer(`openTab-${groupName}`, () => {
                const tab = $1(`[opened-tab="${groupName}"]`);
                if (tab) tab.click();
            }, 50);
        }
    });
    
    eventManager.delegate('click', '[open-second-left-sidebar="true"], [open-second-left-sidebar="open-only"]', function() {
        const sidebar = $id('SecondLeftSidebar');
        if (!sidebar) return;
        
        const openSecondLeftSidebar = this.getAttribute('open-second-left-sidebar');
        
        if (openSecondLeftSidebar === 'open-only') {
            toggleSidebar('SecondLeft', true);
        } else if (openSecondLeftSidebar === 'true') {
            toggleSidebar('SecondLeft', !sidebar.classList.contains('is-show'));
        }
    });
    
    eventManager.delegate('change', '.OpenLeftSidebar, [OpenLeftSidebar], [openleftsidebar]', function() {
        if (this.checked) toggleSidebar('Left', true);
    });
    
    eventManager.delegate('change', '.OpenSecondLeftSidebar, [OpenSecondLeftSidebar], [opensecondleftsidebar]', function() {
        if (this.checked) toggleSidebar('SecondLeft', true);
    });
    
    setupTabSwitcher();
    setupAreaKeyControls();
    setupBackToTopButton();
}

// Setup sidebars
function setupSidebars() {
    let zIndex = 1000;
    
    const setupSidebarElement = (side) => {
        const sidebar = sidebarCache.getSidebar(side);
        const tab = $id(`${side}SideTab`);
        const close = $id(`${side}SidebarClose`);
        
        if (!sidebar || !tab || !close) return false;
        if (tab.dataset.setupComplete === 'true' && close.dataset.setupComplete === 'true') return true;
        
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
    
    const attemptSetup = (attempt = 1, maxAttempts = 3) => {
        const leftReady = setupSidebarElement('Left');
        const secondLeftReady = setupSidebarElement('SecondLeft');
        const rightReady = setupSidebarElement('Right');
        
        if (leftReady && secondLeftReady && rightReady) {
            setupInitialMargins();
            rafBatcher.add(() => setupControls(), 1);
            loadingTracker.markComplete('sidebarSetup');
            return;
        }
        
        if (attempt < maxAttempts) {
            const delay = [50, 150][attempt - 1] || 150;
            state.setTimer(`sidebarSetup-${attempt}`, () => attemptSetup(attempt + 1, maxAttempts), delay);
        } else {
            setupInitialMargins();
            rafBatcher.add(() => setupControls(), 1);
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

// Setup events with delegation
function setupEvents() {
    // Delegated handlers for better performance
    eventManager.delegate('change', '[data-auto-sidebar="true"]', function() {
        if (window.innerWidth > 991) {
            state.setTimer('autoSidebar', () => toggleSidebar('Left', true), 50);
        }
    });
    
    eventManager.delegate('change', '[data-auto-second-left-sidebar="true"]', function() {
        if (window.innerWidth > 991) {
            state.setTimer('autoSecondSidebar', () => toggleSidebar('SecondLeft', true), 50);
        }
    });
    
    eventManager.delegate('change', 'select, [fs-cmsfilter-element="select"]', () => {
        state.setTimer('selectChange', handleFilterUpdate, 50);
    });
    
    eventManager.delegate('change', '[fs-cmsfilter-element="filters"] input, [fs-cmsfilter-element="filters"] select', () => {
        state.setTimer('filterChange', handleFilterUpdate, 50);
    });
    
    // Apply map filter setup
    const filterElements = $('[apply-map-filter="true"], #refreshDiv, #refresh-on-enter, .filterrefresh, #filter-button');
    filterElements.forEach(element => {
        let events;
        if (element.id === 'refresh-on-enter') {
            events = ['keypress', 'input'];
        } else if (element.getAttribute('apply-map-filter') === 'true') {
            events = ['click', 'keypress', 'input'];
        } else {
            events = ['click'];
        }
        
        events.forEach(eventType => {
            eventManager.add(element, eventType, (e) => {
                if (eventType === 'keypress' && e.key !== 'Enter') return;
                if (window.isMarkerClick) return;
                
                if (element.id === 'refresh-on-enter' && eventType === 'input') {
                    state.setTimer('updateMapOnly', () => {
                        applyFilterToMarkers(false);
                    }, 100);
                    return;
                }
                
                if ((element.id === 'refresh-on-enter' && eventType === 'keypress') || 
                    (element.id === 'refreshDiv' && eventType === 'click')) {
                    e.preventDefault();
                    
                    state.flags.forceFilteredReframe = true;
                    state.flags.isRefreshButtonAction = true;
                    
                    state.setTimer('applyFilter', () => {
                        applyFilterToMarkers(true);
                        state.setTimer('applyFilterCleanup', () => {
                            state.flags.forceFilteredReframe = false;
                            state.flags.isRefreshButtonAction = false;
                        }, 1000);
                    }, 50);
                    return;
                }
                
                e.preventDefault();
                
                state.flags.forceFilteredReframe = true;
                state.flags.isRefreshButtonAction = true;
                
                const delay = eventType === 'input' ? 200 : 50;
                
                state.setTimer('applyFilter', () => {
                    applyFilterToMarkers(true);
                    state.setTimer('applyFilterCleanup', () => {
                        state.flags.forceFilteredReframe = false;
                        state.flags.isRefreshButtonAction = false;
                    }, 1000);
                }, delay);
            });
        });
    });
    
    // Global event listeners
    ['fs-cmsfilter-filtered', 'fs-cmsfilter-pagination-page-changed'].forEach(event => {
        eventManager.add(document, event, (e) => {
            if (window.isMarkerClick || state.markerInteractionLock) return;
            handleFilterUpdate();
            
            setTimeout(checkAndToggleFilteredElements, 50);
        });
    });
    
    ['fs-cmsfilter-change', 'fs-cmsfilter-search', 'fs-cmsfilter-reset'].forEach(event => {
        eventManager.add(document, event, () => {
            setTimeout(checkAndToggleFilteredElements, 100);
        });
    });
    
    // Firefox form handling
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
    
    // Link click delegation
    eventManager.delegate('click', 'a:not(.filterrefresh):not([fs-cmsfilter-element])', function() {
        if (!this.closest('[fs-cmsfilter-element]') && 
            !this.classList.contains('w-pagination-next') && 
            !this.classList.contains('w-pagination-previous')) {
            window.isLinkClick = true;
            state.setTimer('linkCleanup', () => window.isLinkClick = false, 500);
        }
    });
    
    loadingTracker.markComplete('eventsSetup');
}

// Setup dropdown listeners
function setupDropdownListeners() {
    if (state.flags.dropdownListenersSetup) return;
    state.flags.dropdownListenersSetup = true;
    
    eventManager.delegate('click', '[districtselect]', function() {
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
}

// Load combined geo data with retry and web worker support
async function loadCombinedGeoData() {
    try {
        const response = await fetchWithRetry(
            'https://cdn.jsdelivr.net/gh/Tovlim/COTO@main/Combined-GEOJSON-0.006.json'
        );
        
        const combinedData = await response.json();
        
        // Check if Web Worker is supported for processing
        if (window.Worker && combinedData.features.length > 100) {
            // For large datasets, consider using a Web Worker
            // For now, we'll process in chunks
            processGeoDataInChunks(combinedData);
        } else {
            // Process directly for smaller datasets
            processGeoData(combinedData);
        }
        
    } catch (error) {
        console.error('Failed to load geo data after retries:', error);
        // Still update district markers in case some data was loaded
        addNativeDistrictMarkers();
        mapLayers.optimizeLayerOrder();
        loadingTracker.markComplete('geoDataLoaded');
    }
}

// Process geo data in chunks to avoid blocking
function processGeoDataInChunks(combinedData) {
    const districts = [];
    const areas = [];
    const chunkSize = 50;
    let currentIndex = 0;
    
    function processChunk() {
        const endIndex = Math.min(currentIndex + chunkSize, combinedData.features.length);
        
        for (let i = currentIndex; i < endIndex; i++) {
            const feature = combinedData.features[i];
            if (feature.properties.type === 'district') {
                districts.push(feature);
            } else if (feature.properties.type === 'area') {
                areas.push(feature);
            }
        }
        
        currentIndex = endIndex;
        
        if (currentIndex < combinedData.features.length) {
            // Process next chunk
            rafBatcher.add(() => processChunk(), 1);
        } else {
            // All chunks processed
            mapLayers.addToBatch(() => {
                districts.forEach(districtFeature => {
                    const name = districtFeature.properties.name;
                    addDistrictBoundaryToMap(name, districtFeature);
                });
            });
            
            mapLayers.addToBatch(() => {
                areas.forEach(areaFeature => {
                    const name = areaFeature.properties.name;
                    addAreaOverlayToMap(name, areaFeature);
                });
            });
            
            state.setTimer('updateDistrictMarkers', () => {
                addNativeDistrictMarkers();
                mapLayers.optimizeLayerOrder();
                loadingTracker.markComplete('geoDataLoaded');
            }, 100);
        }
    }
    
    processChunk();
}

// Process geo data directly
function processGeoData(combinedData) {
    const districts = [];
    const areas = [];
    
    combinedData.features.forEach(feature => {
        if (feature.properties.type === 'district') {
            districts.push(feature);
        } else if (feature.properties.type === 'area') {
            areas.push(feature);
        }
    });
    
    mapLayers.addToBatch(() => {
        districts.forEach(districtFeature => {
            const name = districtFeature.properties.name;
            addDistrictBoundaryToMap(name, districtFeature);
        });
    });
    
    mapLayers.addToBatch(() => {
        areas.forEach(areaFeature => {
            const name = areaFeature.properties.name;
            addAreaOverlayToMap(name, areaFeature);
        });
    });
    
    state.setTimer('updateDistrictMarkers', () => {
        addNativeDistrictMarkers();
        mapLayers.optimizeLayerOrder();
        loadingTracker.markComplete('geoDataLoaded');
    }, 100);
}

// Add district boundary to map
function addDistrictBoundaryToMap(name, districtFeature) {
    const boundary = {
        name,
        sourceId: `${name.toLowerCase().replace(/\s+/g, '-')}-boundary`,
        fillId: `${name.toLowerCase().replace(/\s+/g, '-')}-fill`,
        borderId: `${name.toLowerCase().replace(/\s+/g, '-')}-border`
    };
    
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
    
    map.addSource(boundary.sourceId, {
        type: 'geojson',
        data: {
            type: "FeatureCollection",
            features: [districtFeature]
        }
    });
    
    const areaLayers = ['area-a-layer', 'area-b-layer', 'area-c-layer', 'firing-zones-layer'];
    const firstAreaLayer = areaLayers.find(layerId => mapLayers.hasLayer(layerId));
    const beforeId = firstAreaLayer || 'locality-clusters';
    
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
    
    mapLayers.sourceCache.set(boundary.sourceId, true);
    mapLayers.layerCache.set(boundary.fillId, true);
    mapLayers.layerCache.set(boundary.borderId, true);
    
    // Check if district marker already exists
    const existingId = state.districtIndex.get(name);
    if (!existingId) {
        const centroid = utils.calculateCentroid(districtFeature.geometry.coordinates);
        const id = `district-${name.toLowerCase().replace(/\s+/g, '-')}`;
        
        state.featureIndex.set(id, {
            name: name,
            id: id,
            coordinates: centroid,
            type: 'district',
            source: 'boundary'
        });
        
        state.districtIndex.set(name, id);
    }
}

// Add area overlay to map
function addAreaOverlayToMap(name, areaFeature) {
    const areaConfig = {
        'Area A': { color: '#adc278', layerId: 'area-a-layer', sourceId: 'area-a-source' },
        'Area B': { color: '#ffdcc6', layerId: 'area-b-layer', sourceId: 'area-b-source' },
        'Area C': { color: '#889c9b', layerId: 'area-c-layer', sourceId: 'area-c-source' },
        'Firing Zones': { color: '#af4256', layerId: 'firing-zones-layer', sourceId: 'firing-zones-source' }
    };
    
    const config = areaConfig[name];
    if (!config) return;
    
    if (mapLayers.hasLayer(config.layerId)) {
        map.removeLayer(config.layerId);
        mapLayers.layerCache.delete(config.layerId);
    }
    if (mapLayers.hasSource(config.sourceId)) {
        map.removeSource(config.sourceId);
        mapLayers.sourceCache.delete(config.sourceId);
    }
    
    map.addSource(config.sourceId, {
        type: 'geojson',
        data: {
            type: "FeatureCollection",
            features: [areaFeature]
        }
    });
    
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
    
    mapLayers.sourceCache.set(config.sourceId, true);
    mapLayers.layerCache.set(config.layerId, true);
}

// Setup area key controls
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
        
        markerSetupCount++;
    });
    
    if (areaSetupCount >= areaControls.length - 1 && markerSetupCount >= markerControls.length - 1) {
        state.flags.areaControlsSetup = true;
        loadingTracker.markComplete('controlsSetup');
    }
}

// Load district tags
function loadDistrictTags() {
    if (state.flags.districtTagsLoaded) return;
    
    const districtTagCollection = $id('district-tag-collection');
    if (!districtTagCollection) {
        loadingTracker.markComplete('districtTagsLoaded');
        return;
    }
    
    const districtTagItems = districtTagCollection.querySelectorAll('#district-tag-item');
    
    // Remove existing tag-based features from index
    state.districtIndex.forEach((id, name) => {
        const props = state.featureIndex.get(id);
        if (props && props.source === 'tag') {
            state.featureIndex.delete(id);
            state.districtIndex.delete(name);
        }
    });
    
    districtTagItems.forEach((tagItem) => {
        if (getComputedStyle(tagItem).display === 'none') return;
        
        const name = tagItem.getAttribute('district-tag-name');
        const lat = parseFloat(tagItem.getAttribute('district-tag-lattitude'));
        const lng = parseFloat(tagItem.getAttribute('district-tag-longitude'));
        
        if (!name || isNaN(lat) || isNaN(lng)) return;
        
        const id = `district-tag-${name.toLowerCase().replace(/\s+/g, '-')}`;
        
        state.featureIndex.set(id, {
            name: name,
            id: id,
            coordinates: [lng, lat],
            type: 'district',
            source: 'tag'
        });
        
        state.districtIndex.set(name, id);
    });
    
    state.flags.districtTagsLoaded = true;
    
    addNativeDistrictMarkers();
    mapLayers.optimizeLayerOrder();
    loadingTracker.markComplete('districtTagsLoaded');
}

// Generate locality checkboxes
function generateLocalityCheckboxes() {
    const container = $id('locality-check-list');
    if (!container) return;
    
    const template = container.querySelector('[checkbox-filter="locality"]');
    if (!template) return;
    
    const localityNames = [...new Set(
        Array.from(state.localityIndex.keys())
    )].sort();
    
    if (localityNames.length === 0) return;
    
    container.innerHTML = '';
    
    const fragment = document.createDocumentFragment();
    localityNames.forEach(localityName => {
        const checkbox = template.cloneNode(true);
        
        const label = checkbox.querySelector('#locality-checkbox');
        if (label) label.removeAttribute('id');
        
        const input = checkbox.querySelector('input[name="locality"]');
        if (input) input.setAttribute('fs-list-value', localityName);
        
        const span = checkbox.querySelector('.test3.w-form-label');
        if (span) span.textContent = localityName;
        
        fragment.appendChild(checkbox);
        
        setupCheckboxEvents(checkbox);
    });
    
    container.appendChild(fragment);
    
    if (window.checkboxFilterScript?.recacheElements) {
        state.setTimer('recacheCheckboxFilter', () => {
            window.checkboxFilterScript.recacheElements();
        }, 100);
    }
    
    state.setTimer('checkFilteredAfterGeneration', checkAndToggleFilteredElements, 200);
    
    domCache.invalidate();
}

// Setup checkbox events
function setupCheckboxEvents(checkboxContainer) {
    eventManager.delegate('change', '[data-auto-sidebar="true"]', function() {
        if (this.closest(checkboxContainer) && window.innerWidth > 991) {
            state.setTimer('checkboxAutoSidebar', () => toggleSidebar('Left', true), 50);
        }
    });
    
    eventManager.delegate('change', '[fs-cmsfilter-element="filters"] input, [fs-cmsfilter-element="filters"] select', function() {
        if (this.closest(checkboxContainer)) {
            state.setTimer('checkboxFilter', handleFilterUpdate, 50);
        }
    });
    
    const indicatorActivators = checkboxContainer.querySelectorAll('[activate-filter-indicator]');
    indicatorActivators.forEach(activator => {
        const groupName = activator.getAttribute('activate-filter-indicator');
        if (!groupName) return;
        
        const toggleIndicators = (shouldShow) => {
            const indicators = $(`[filter-indicator="${groupName}"]`);
            indicators.forEach(indicator => {
                indicator.style.display = shouldShow ? 'flex' : 'none';
            });
        };
        
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
        
        if (activator.type === 'checkbox' || activator.type === 'radio') {
            eventManager.add(activator, 'change', () => {
                const shouldShow = hasActiveFilters();
                toggleIndicators(shouldShow);
            });
        }
    });
}

// Check and toggle filtered elements
const checkAndToggleFilteredElements = () => {
    const hiddenTagParent = document.getElementById('hiddentagparent');
    const shouldShow = !!hiddenTagParent;
    
    toggleShowWhenFilteredElements(shouldShow);
    return shouldShow;
};

// Monitor tags
const monitorTags = (() => {
    let isSetup = false;
    let pollingTimer = null;
    
    return () => {
        if (isSetup) return;
        
        checkAndToggleFilteredElements();
        
        const tagParent = document.getElementById('tagparent');
        if (tagParent) {
            if (tagParent._mutationObserver) {
                tagParent._mutationObserver.disconnect();
            }
            
            const observer = new MutationObserver(() => {
                checkAndToggleFilteredElements();
            });
            observer.observe(tagParent, {childList: true, subtree: true});
            
            tagParent._mutationObserver = observer;
        }
        
        eventManager.delegate('change', '[checkbox-filter] input[type="checkbox"]', function() {
            if (!this.dataset.filteredElementListener) {
                setTimeout(checkAndToggleFilteredElements, 50);
                this.dataset.filteredElementListener = 'true';
            }
        });
        
        eventManager.delegate('change', 'form', function() {
            if (!this.dataset.filteredElementListener) {
                setTimeout(checkAndToggleFilteredElements, 100);
                this.dataset.filteredElementListener = 'true';
            }
        });
        
        eventManager.delegate('input', 'form', function() {
            if (!this.dataset.filteredElementListener) {
                setTimeout(checkAndToggleFilteredElements, 100);
                this.dataset.filteredElementListener = 'true';
            }
        });
        
        const startPolling = () => {
            if (pollingTimer) {
                clearTimeout(pollingTimer);
            }
            
            pollingTimer = setTimeout(() => {
                checkAndToggleFilteredElements();
                startPolling();
            }, 1000);
        };
        
        startPolling();
        isSetup = true;
        
        window.cleanupTagMonitoring = () => {
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
    };
})();

// Initialize map
function init() {
    // Critical operations first
    getLocationData();
    addNativeMarkers();
    
    // Secondary operations
    rafBatcher.add(() => {
        setupEvents();
        generateLocalityCheckboxes();
        mapLayers.optimizeLayerOrder();
    }, 2);
    
    const handleMapEvents = () => {
        state.clearTimer('mapEventHandler');
        state.setTimer('mapEventHandler', () => {
            // Map events handled by optimized layer management
        }, 10);
    };
    
    map.on('moveend', handleMapEvents);
    map.on('zoomend', handleMapEvents);
    
    // Consolidated timeouts using RAF
    rafBatcher.add(() => {
        setupDropdownListeners();
        setupTabSwitcher();
    }, 1);
    
    state.flags.mapInitialized = true;
    loadingTracker.markComplete('mapInitialized');
    
    // Initial filtering check
    rafBatcher.add(() => {
        if (state.flags.isInitialLoad) {
            const hasFiltering = checkMapMarkersFiltering();
            if (hasFiltering) {
                applyFilterToMarkers();
            }
            state.flags.isInitialLoad = false;
        }
        
        checkAndToggleFilteredElements();
    }, 1);
}

// Control positioning
rafBatcher.add(() => {
    const ctrl = $1('.mapboxgl-ctrl-top-right');
    if (ctrl) {
        utils.setStyles(ctrl, {
            top: '4rem', 
            right: '0.5rem', 
            zIndex: '10'
        });
    }
    
    loadingTracker.markComplete('uiPositioned');
}, 1);

// Map load event
map.on("load", () => {
    try {
        const scaleContainer = document.querySelector('.mapboxgl-ctrl-scale');
        if (scaleContainer) {
            scaleContainer.style.pointerEvents = 'none';
            scaleContainer.style.userSelect = 'none';
            scaleContainer.style.cursor = 'default';
        }
        
        init();
        
        // Load data with staggered priority
        rafBatcher.add(() => loadCombinedGeoData(), 2);
        rafBatcher.add(() => loadDistrictTags(), 1);
        rafBatcher.add(() => setupAreaKeyControls(), 0);
        
    } catch (error) {
        console.error('Map initialization error:', error);
        Object.keys(loadingTracker.critical).forEach(stateName => {
            loadingTracker.markComplete(stateName);
        });
        Object.keys(loadingTracker.secondary).forEach(stateName => {
            loadingTracker.markComplete(stateName);
        });
    }
});

// DOM ready
document.addEventListener('DOMContentLoaded', () => {
    rafBatcher.add(() => {
        setupSidebars();
        setupTabSwitcher();
        setupBackToTopButton();
    }, 3);
    
    // Early UI checks
    rafBatcher.add(() => {
        if (!loadingTracker.tertiary.tabSwitcherSetup && $('[open-tab]').length > 0) {
            const hasSetupTabs = $('[open-tab]').some(tab => tab.dataset.tabSwitcherSetup === 'true');
            if (hasSetupTabs) {
                loadingTracker.markComplete('tabSwitcherSetup');
            }
        }
        
        if (!loadingTracker.tertiary.uiPositioned) {
            const ctrl = $1('.mapboxgl-ctrl-top-right');
            if (ctrl && ctrl.style.top) {
                loadingTracker.markComplete('uiPositioned');
            }
        }
        
        if (!loadingTracker.tertiary.backToTopSetup) {
            const button = $id('jump-to-top');
            const scrollContainer = $id('scroll-wrap');
            if (button && scrollContainer) {
                loadingTracker.markComplete('backToTopSetup');
            }
        }
    }, 0);
});

// Window load
window.addEventListener('load', () => {
    rafBatcher.add(() => {
        setupSidebars();
        setupTabSwitcher();
        setupBackToTopButton();
        
        if (!state.featureIndex.size && map.loaded()) {
            try { 
                init(); 
            } catch (error) { 
                console.error('Fallback init error:', error);
            }
        }
    }, 2);
    
    // Retry mechanisms with shorter timeouts
    if (!state.flags.districtTagsLoaded) {
        rafBatcher.add(() => {
            if (!state.flags.districtTagsLoaded) {
                loadDistrictTags();
                state.setTimer('districtTagsFallback', () => {
                    loadingTracker.markComplete('districtTagsLoaded');
                }, 1000);
            }
        }, 0);
    }
    
    if (!state.flags.areaControlsSetup) {
        rafBatcher.add(() => {
            if (!state.flags.areaControlsSetup) {
                setupAreaKeyControls();
                state.setTimer('controlsFallback', () => {
                    loadingTracker.markComplete('controlsSetup');
                }, 1000);
            }
        }, 0);
    }
    
    // Auto-trigger reframing
    const checkAndReframe = () => {
        if (map.loaded() && !map.isMoving() && checkMapMarkersFiltering()) {
            state.flags.forceFilteredReframe = true;
            state.flags.isRefreshButtonAction = true;
            applyFilterToMarkers();
            state.setTimer('autoReframeCleanup', () => {
                state.flags.forceFilteredReframe = false;
                state.flags.isRefreshButtonAction = false;
            }, 1000);
            
            checkAndToggleFilteredElements();
            return true;
        }
        return false;
    };
    
    if (!checkAndReframe()) {
        state.setTimer('reframeCheck', checkAndReframe, 500);
    }
    
    // Check autocomplete readiness
    rafBatcher.add(() => {
        if (window.integratedAutocomplete && !loadingTracker.tertiary.autocompleteReady) {
            loadingTracker.markComplete('autocompleteReady');
        }
    }, 0);
});

// Initialize tag monitoring
rafBatcher.add(() => {
    monitorTags();
    
    state.setTimer('monitoringCheck', () => {
        if (!loadingTracker.tertiary.eventsSetup) {
            loadingTracker.markComplete('eventsSetup');
        }
    }, 1000);
}, 1);

// Additional filtered elements check
window.addEventListener('load', () => {
    state.setTimer('loadCheckFiltered', checkAndToggleFilteredElements, 200);
});

// ========================
// GLOBAL EXPORTS
// ========================

window.selectDistrictCheckbox = selectDistrictCheckbox;
window.selectLocalityCheckbox = selectLocalityCheckbox;
window.applyFilterToMarkers = applyFilterToMarkers;
window.highlightBoundary = highlightBoundary;
window.map = map;
window.mapboxgl = mapboxgl;

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
    checkAndToggleFilteredElements,
    toggleShowWhenFilteredElements
};

// ========================
// AUTOCOMPLETE INITIALIZATION
// ========================

function initOptimizedAutocomplete() {
    if (window.integratedAutocomplete) {
        console.log('Autocomplete already initialized');
        return;
    }
    
    const initDelay = window.fsAttributes ? 300 : 100;
    
    setTimeout(() => {
        if (window.integratedAutocomplete) return;
        
        window.integratedAutocomplete = new OptimizedRealTimeAutocomplete({
            inputId: "refresh-on-enter",
            listId: "search-terms", 
            wrapperId: "searchTermsWrapper",
            clearId: "searchclear",
            targetCollection: "cms-filter-list-4",
            dataField: "both",
            debounceDelay: 100
        });
        
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
        
        console.log('Optimized autocomplete initialized');
        
    }, initDelay);
}

// Initialize autocomplete
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

// ========================
// CLEANUP
// ========================

// Periodic cache cleanup
setInterval(() => {
    // Clean up old visibility observations
    visibilityObserver.cache.clear();
    
    // Clean DOM cache if it's getting large
    if (domCache.cache.size > 40) {
        domCache.cache = new CacheLimitedMap(50);
    }
    if (domCache.selectorCache.size > 80) {
        domCache.selectorCache = new CacheLimitedMap(100);
    }
    if (domCache.listCache.size > 40) {
        domCache.listCache = new CacheLimitedMap(50);
    }
}, 60000); // Every minute

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.integratedAutocomplete) {
        window.integratedAutocomplete.destroy();
    }
    
    // Clean up all resources
    visibilityObserver.cleanup();
    eventManager.cleanup();
    state.cleanup();
    sidebarCache.invalidate();
    
    // Clean up mutation observers
    const tagParent = $id('tagparent');
    if (tagParent) {
        if (tagParent._mutationObserver) {
            tagParent._mutationObserver.disconnect();
        }
        if (tagParent._tagObserver) {
            tagParent._tagObserver.disconnect();
        }
    }
    
    // Clean up map
    if (map) {
        map.remove();
    }
    
    // Clear all intervals/timeouts
    if (window.cleanupTagMonitoring) {
        window.cleanupTagMonitoring();
    }
});
