// HEAVILY OPTIMIZED Mapbox Script - Production Version 2025
// Major optimizations: DOM caching, event cleanup, map batching, smart initialization

// Detect mobile for better map experience
const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

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
  if (!loadingTracker.states.tabSwitcherSetup) {
    loadingTracker.markComplete('tabSwitcherSetup');
  }
  if (!loadingTracker.states.eventsSetup) {
    loadingTracker.markComplete('eventsSetup');
  }
  if (!loadingTracker.states.uiPositioned) {
    loadingTracker.markComplete('uiPositioned');
  }
  if (!loadingTracker.states.autocompleteReady) {
    loadingTracker.markComplete('autocompleteReady');
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

// Initialize Mapbox
const lang = navigator.language.split('-')[0];
mapboxgl.accessToken = "pk.eyJ1Ijoibml0YWloYXJkeSIsImEiOiJjbWE0d2F2cHcwYTYxMnFzNmJtanFhZzltIn0.diooYfncR44nF0Y8E1jvbw";
if (['ar', 'he'].includes(lang)) mapboxgl.setRTLTextPlugin("https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.3.0/mapbox-gl-rtl-text.js");

// Load the dual scale control library
const script = document.createElement('script');
script.src = 'https://unpkg.com/mapbox-gl-dual-scale-control@0.1.2/dist/mapbox-gl-dual-scale-control.min.js';
document.head.appendChild(script);

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/nitaihardy/cmdp8fjw100ex01s83b2d6jzf",
  center: [35.22, 31.85],
  zoom: isMobile ? 7.5 : 8.33,
  language: ['en','es','fr','de','zh','ja','ru','ar','he'].includes(lang) ? lang : 'en'
});

map.addControl(new mapboxgl.GeolocateControl({positionOptions: {enableHighAccuracy: true}, trackUserLocation: true, showUserHeading: true}));

// Add zoom controls (zoom in/out buttons)
map.addControl(new mapboxgl.NavigationControl({
  showCompass: false,  // Hide compass, only show zoom buttons
  showZoom: true,      // Show zoom in/out buttons
  visualizePitch: false // Hide pitch visualization
}), 'top-right');

// Add scale control showing both kilometers and miles in bottom right
const scaleControl = new mapboxgl.ScaleControl({
  maxWidth: 120,
  unit: 'both' // Shows both metric (km/m) and imperial (miles/ft)
});
map.addControl(scaleControl, 'bottom-right');

// Make scale control unclickable and ensure it shows both units
map.on('load', () => {
  // Style the scale control to be unclickable and ensure proper display
  const scaleElement = document.querySelector('.mapboxgl-ctrl-scale');
  if (scaleElement) {
    scaleElement.style.pointerEvents = 'none';
    scaleElement.style.userSelect = 'none';
    scaleElement.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
    scaleElement.style.borderRadius = '3px';
    scaleElement.style.padding = '2px 4px';
    scaleElement.style.fontSize = '11px';
    scaleElement.style.fontWeight = '500';
  }
});

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
    
    // Add custom reset icon styling
    this._button.style.cssText = `
      background-image: url("https://cdn.prod.website-files.com/6824fc6dd9bace7c31d8a0d9/6873aecae0c1702f3d417a81_reset%20icon%203.svg");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 15px 15px;
    `;
    
    this._button.addEventListener('click', () => {
      // Reset to default position
      this._map.flyTo({
        center: [35.22, 31.85],
        zoom: isMobile ? 7.5 : 8.33,
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

// ENHANCED: Loading state tracker
const loadingTracker = {
  states: {
    mapInitialized: false,
    locationDataLoaded: false,
    markersAdded: false,
    geoDataLoaded: false,
    districtTagsLoaded: false,
    controlsSetup: false,
    sidebarSetup: false,
    tabSwitcherSetup: false,
    eventsSetup: false,
    uiPositioned: false,
    autocompleteReady: false,
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
  },
  
  // Helper to check if autocomplete is ready
  checkAutocompleteReady() {
    if (window.integratedAutocomplete && !this.states.autocompleteReady) {
      this.markComplete('autocompleteReady');
    } else if (!this.states.autocompleteReady) {
      // Check again in a bit
      setTimeout(() => this.checkAutocompleteReady(), 500);
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

// Toggle sidebar with improved logic for multiple left sidebars
const toggleSidebar = (side, show = null) => {
  const sidebar = $id(`${side}Sidebar`);
  if (!sidebar) return;
  
  const isShowing = show !== null ? show : !sidebar.classList.contains('is-show');
  sidebar.classList.toggle('is-show', isShowing);
  
  const currentWidth = parseInt(getComputedStyle(sidebar).width) || 300;
  // Use correct JavaScript property names for style manipulation
  const jsMarginProperty = side === 'SecondLeft' ? 'marginLeft' : `margin${side}`;
  
  if (window.innerWidth > 478) {
    sidebar.style[jsMarginProperty] = isShowing ? '0' : `-${currentWidth + 1}px`;
    
    // Close other left sidebars when opening a left sidebar
    if (isShowing && (side === 'Left' || side === 'SecondLeft')) {
      const otherLeftSide = side === 'Left' ? 'SecondLeft' : 'Left';
      const otherLeftSidebar = $id(`${otherLeftSide}Sidebar`);
      if (otherLeftSidebar && otherLeftSidebar.classList.contains('is-show')) {
        toggleSidebar(otherLeftSide, false);
      }
    }
  } else {
    sidebar.style[jsMarginProperty] = isShowing ? '0' : '';
    if (isShowing) {
      // On mobile, close ALL other sidebars
      const allSides = ['Left', 'SecondLeft', 'Right'];
      allSides.forEach(otherSide => {
        if (otherSide !== side) {
          const otherSidebar = $id(`${otherSide}Sidebar`);
          if (otherSidebar && otherSidebar.classList.contains('is-show')) {
            toggleSidebar(otherSide, false);
          }
        }
      });
    }
  }
  
  utils.setStyles(sidebar, {pointerEvents: isShowing ? 'auto' : ''});
  const arrowIcon = $1(`[arrow-icon="${side === 'SecondLeft' ? 'secondleft' : side.toLowerCase()}"]`);
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
      
      // Add individual locality points layer
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
            isMobile ? 7.5 : 8.5, 0,
            isMobile ? 8.5 : 9.5, 1
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
        selectDistrictInDropdown(districtName);
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
      selectDistrictInDropdown(districtName);
      
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
    
    lastResult = totalVisible > 0 && totalVisible < totalElements;
    lastCheck = now;
    return lastResult;
  };
})();

// OPTIMIZED: Filter application with smart batching and caching
function applyFilterToMarkers() {
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
    
    allData.push(...listLat.map((el, i) => ({ lat: el, lon: listLon[i] })));
    
    const visiblePairs = listLat.map((latEl, i) => ({ lat: latEl, lon: listLon[i] }))
      .filter(pair => isElementVisible(pair.lat));
    visibleData.push(...visiblePairs);
  });
  
  let visibleCoordinates = [];
  
  if (visibleData.length > 0 && visibleData.length < allData.length) {
    // Filtering is active - batch coordinate extraction
    visibleCoordinates = visibleData
      .map(pair => {
        const lat = parseFloat(pair.lat?.textContent.trim());
        const lon = parseFloat(pair.lon?.textContent.trim());
        return (!isNaN(lat) && !isNaN(lon)) ? [lon, lat] : null;
      })
      .filter(coord => coord !== null);
    
    // Keep all markers visible
    if (mapLayers.hasSource('localities-source')) {
      map.getSource('localities-source').setData({
        type: "FeatureCollection",
        features: state.allLocalityFeatures
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
        center: [35.22, 31.85], 
        zoom: isMobile ? 7.5 : 8.33, 
        duration: animationDuration, 
        essential: true
      });
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

// Custom tab switcher
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
  
  // Mark UI loading step complete
  if (!loadingTracker.states.tabSwitcherSetup) {
    loadingTracker.markComplete('tabSwitcherSetup');
  }
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
        
        const groupName = element.getAttribute('open-tab');
        if (groupName) {
          state.setTimer(`openTab-${groupName}`, () => {
            const tab = $1(`[opened-tab="${groupName}"]`);
            if (tab) tab.click();
          }, 50);
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
  
  setupTabSwitcher();
  setupAreaKeyControls();
  setupBackToTopButton();
}

// OPTIMIZED: Sidebar setup with better performance and cleaner management
function setupSidebars() {
  let zIndex = 1000;
  
  const setupSidebarElement = (side) => {
    const sidebar = $id(`${side}Sidebar`);
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
          const otherSidebar = $id(`${otherSide}Sidebar`);
          const otherTab = $id(`${otherSide}SideTab`);
          
          if (otherSidebar) otherSidebar.style.zIndex = newZ - 1;
          if (otherTab && window.innerWidth <= 478) {
            otherTab.style.zIndex = newZ + 5;
            if (otherTab.parentElement) otherTab.parentElement.style.zIndex = newZ + 5;
          }
        }
      });
    };

    const toggle = show => {
      if (show) bringToFront();
      sidebar.classList.toggle('is-show', show);
      
      const arrowIcon = $1(`[arrow-icon="${side === 'SecondLeft' ? 'secondleft' : side.toLowerCase()}"]`);
      if (arrowIcon) arrowIcon.style.transform = show ? 'rotateY(180deg)' : 'rotateY(0deg)';
      
      if (window.innerWidth > 478) {
        const currentWidth = parseInt(getComputedStyle(sidebar).width) || 300;
        const jsMarginProperty = side === 'SecondLeft' ? 'marginLeft' : `margin${side}`;
        sidebar.style[jsMarginProperty] = show ? '0' : `-${currentWidth + 1}px`;
        
        // Close other left sidebars when opening a left sidebar
        if (show && (side === 'Left' || side === 'SecondLeft')) {
          const otherLeftSide = side === 'Left' ? 'SecondLeft' : 'Left';
          const otherLeftSidebar = $id(`${otherLeftSide}Sidebar`);
          if (otherLeftSidebar && otherLeftSidebar.classList.contains('is-show')) {
            otherLeftSidebar.classList.remove('is-show');
            const otherArrowIcon = $1(`[arrow-icon="${otherLeftSide === 'SecondLeft' ? 'secondleft' : otherLeftSide.toLowerCase()}"]`);
            if (otherArrowIcon) otherArrowIcon.style.transform = 'rotateY(0deg)';
            const otherJsMarginProperty = otherLeftSide === 'SecondLeft' ? 'marginLeft' : `margin${otherLeftSide}`;
            const otherWidth = parseInt(getComputedStyle(otherLeftSidebar).width) || 300;
            otherLeftSidebar.style[otherJsMarginProperty] = `-${otherWidth + 1}px`;
            otherLeftSidebar.style.pointerEvents = '';
          }
        }
      } else {
        const jsMarginProperty = side === 'SecondLeft' ? 'marginLeft' : `margin${side}`;
        sidebar.style[jsMarginProperty] = show ? '0' : '';
        if (show) {
          const allSides = ['Left', 'SecondLeft', 'Right'];
          allSides.forEach(otherSide => {
            if (otherSide !== side) {
              const otherSidebar = $id(`${otherSide}Sidebar`);
              if (otherSidebar && otherSidebar.classList.contains('is-show')) {
                otherSidebar.classList.remove('is-show');
                const otherArrowIcon = $1(`[arrow-icon="${otherSide === 'SecondLeft' ? 'secondleft' : otherSide.toLowerCase()}"]`);
                if (otherArrowIcon) otherArrowIcon.style.transform = 'rotateY(0deg)';
                const otherJsMarginProperty = otherSide === 'SecondLeft' ? 'marginLeft' : `margin${otherSide}`;
                otherSidebar.style[otherJsMarginProperty] = '';
                otherSidebar.style.pointerEvents = '';
              }
            }
          });
        }
      }
      
      sidebar.style.pointerEvents = show ? 'auto' : '';
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
        toggle(!sidebar.classList.contains('is-show'));
      });
      tab.dataset.setupComplete = 'true';
    }
    
    if (close.dataset.setupComplete !== 'true') {
      eventManager.add(close, 'click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(false);
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
      const sidebar = $id(`${side}Sidebar`);
      if (sidebar && !sidebar.classList.contains('is-show')) {
        const currentWidth = parseInt(getComputedStyle(sidebar).width) || 300;
        const jsMarginProperty = side === 'SecondLeft' ? 'marginLeft' : `margin${side}`;
        sidebar.style[jsMarginProperty] = `-${currentWidth + 1}px`;
      }
    });
  };
  
  attemptSetup();
}

// OPTIMIZED: Event setup with consolidated handlers and better management
function setupEvents() {
  const eventHandlers = [
    {selector: '[data-auto-sidebar="true"]', events: ['change', 'input'], handler: () => {
      if (window.innerWidth > 478) {
        state.setTimer('autoSidebar', () => toggleSidebar('Left', true), 50);
      }
    }},
    {selector: '[data-auto-second-left-sidebar="true"]', events: ['change', 'input'], handler: () => {
      if (window.innerWidth > 478) {
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
  const filterElements = $('[apply-map-filter="true"], #refreshDiv, #refresh-on-enter, .filterrefresh, #filter-button');
  filterElements.forEach(element => {
    // For #refresh-on-enter, exclude 'click' events to prevent reframing on click
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
        
        e.preventDefault();
        
        state.flags.forceFilteredReframe = true;
        state.flags.isRefreshButtonAction = true;
        
        const delay = eventType === 'input' ? 200 : 50;
        
        state.setTimer('applyFilter', () => {
          applyFilterToMarkers();
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
  
  const selectField5 = $id('select-field-5');
  if (selectField5) {
    eventManager.add(selectField5, 'change', (e) => {
      if (window.isMarkerClick) return;
      
      const selectedDistrict = e.target.value;
      
      // Check if this district has boundaries
      const districtWithBoundary = state.allDistrictFeatures.find(
        f => f.properties.name === selectedDistrict && f.properties.source === 'boundary'
      );
      
      if (districtWithBoundary && selectedDistrict) {
        // District has boundaries - zoom to boundary extents without filtering
        const boundarySourceId = `${selectedDistrict.toLowerCase().replace(/\s+/g, '-')}-boundary`;
        const source = map.getSource(boundarySourceId);
        
        if (source && source._data) {
          // Set flag to prevent automatic reframing by filtering system
          state.flags.skipNextReframe = true;
          
          const bounds = new mapboxgl.LngLatBounds();
          const addCoords = coords => {
            if (Array.isArray(coords) && coords.length > 0) {
              if (typeof coords[0] === 'number') bounds.extend(coords);
              else coords.forEach(addCoords);
            }
          };
          
          source._data.features.forEach(feature => addCoords(feature.geometry.coordinates));
          map.fitBounds(bounds, {padding: 50, duration: 1000, essential: true});
          
          // Clear flag after animation completes
          state.setTimer('skipReframeCleanup', () => {
            state.flags.skipNextReframe = false;
          }, 1200);
        } else {
          // Fallback to regular filtering if boundary source not found
          state.setTimer('boundaryFallback', () => {
            state.flags.forceFilteredReframe = true;
            state.flags.isRefreshButtonAction = true;
            
            state.setTimer('boundaryFallbackApply', () => {
              applyFilterToMarkers();
              state.setTimer('boundaryFallbackCleanup', () => {
                state.flags.forceFilteredReframe = false;
                state.flags.isRefreshButtonAction = false;
              }, 1000);
            }, 150);
          }, 100);
        }
      } else {
        // District without boundaries - use current behavior (zoom to filtered localities)
        state.setTimer('noBoundaryDistrict', () => {
          state.flags.forceFilteredReframe = true;
          state.flags.isRefreshButtonAction = true;
          
          state.setTimer('noBoundaryApply', () => {
            applyFilterToMarkers();
            state.setTimer('noBoundaryCleanup', () => {
              state.flags.forceFilteredReframe = false;
              state.flags.isRefreshButtonAction = false;
            }, 1000);
          }, 150);
        }, 100);
      }
    });
  }
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
    'Firing Zones': { color: '#af4256', layerId: 'firing-zones-layer', sourceId: 'firing-zones-source' }
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

// OPTIMIZED: Area key controls with better performance
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
  
  // Setup marker controls with direct DOM listeners
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
      // Use direct DOM event listeners for marker control hovers
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

// Function to select district in dropdown
function selectDistrictInDropdown(districtName) {
  const selectField = $id('select-field-5');
  if (!selectField) return;
  
  selectField.value = districtName;
  utils.triggerEvent(selectField, ['change', 'input']);
  
  const form = selectField.closest('form');
  if (form) {
    form.dispatchEvent(new Event('change', {bubbles: true}));
    form.dispatchEvent(new Event('input', {bubbles: true}));
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
        if (window.innerWidth > 478) {
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
  [200, 600, 1200].forEach(delay => 
    state.setTimer(`tabSetup-${delay}`, setupTabSwitcher, delay)
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
  const ctrl = $1('.mapboxgl-ctrl-top-right');
  if (ctrl) {
    utils.setStyles(ctrl, {
      top: '4rem', 
      right: '0.5rem', 
      zIndex: '10'
    });
  }
  
  // Mark UI loading step complete
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
    
    // Setup area controls
    state.setTimer('setupAreaControls', setupAreaKeyControls, 2000);
    
    // Final layer optimization
    state.setTimer('finalOptimization', () => mapLayers.optimizeLayerOrder(), 3000);
    
    // Setup scale control
    setupScaleControl();
    
  } catch (error) {
    // Mark all loading steps as complete to hide loading screen on error
    Object.keys(loadingTracker.states).forEach(stateName => {
      loadingTracker.markComplete(stateName);
    });
  }
});

// Fallback scale control function
function addFallbackScale() {
  const metricScale = new mapboxgl.ScaleControl({
    maxWidth: 120,
    unit: 'metric'
  });
  map.addControl(metricScale, 'bottom-right');
  
  setTimeout(() => {
    const scaleElement = document.querySelector('.mapboxgl-ctrl-scale');
    if (scaleElement) {
      scaleElement.style.pointerEvents = 'none';
      scaleElement.style.userSelect = 'none';
      scaleElement.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
      scaleElement.style.borderRadius = '3px';
      scaleElement.style.padding = '2px 4px';
      scaleElement.style.fontSize = '11px';
      scaleElement.style.fontWeight = '500';
    }
  }, 100);
}

// Setup scale control function
function setupScaleControl() {
  // Check if dual scale control is available
  if (typeof DualScaleControl !== 'undefined') {
    try {
      const dualScale = new DualScaleControl({
        maxWidth: 120
      });
      map.addControl(dualScale, 'bottom-right');
      
      // Make scale control unclickable and style it properly
      setTimeout(() => {
        const scaleElements = document.querySelectorAll('.mapboxgl-ctrl-scale');
        scaleElements.forEach(scaleElement => {
          scaleElement.style.pointerEvents = 'none';
          scaleElement.style.userSelect = 'none';
          scaleElement.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
          scaleElement.style.borderRadius = '3px';
          scaleElement.style.padding = '2px 4px';
          scaleElement.style.fontSize = '11px';
          scaleElement.style.fontWeight = '500';
        });
      }, 100);
      return;
    } catch (error) {
      // Fall through to regular scale control
    }
  }
  
  // Fallback to regular scale control
  addFallbackScale();
}

// OPTIMIZED: DOM ready handlers
document.addEventListener('DOMContentLoaded', () => {
  setupSidebars();
  setupTabSwitcher();
  setupBackToTopButton();
  
  // Early UI readiness checks
  state.setTimer('earlyUICheck', () => {
    // Check if tab switcher is ready early
    if (!loadingTracker.states.tabSwitcherSetup && $('[open-tab]').length > 0) {
      const hasSetupTabs = $('[open-tab]').some(tab => tab.dataset.tabSwitcherSetup === 'true');
      if (hasSetupTabs) {
        loadingTracker.markComplete('tabSwitcherSetup');
      }
    }
    
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
  setupTabSwitcher();
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
  
  if (!state.flags.areaControlsSetup) {
    [2500, 4000].forEach(delay => 
      state.setTimer(`areaControlsRetry-${delay}`, () => {
        if (!state.flags.areaControlsSetup) {
          setupAreaKeyControls();
          // Fallback: mark as complete even if setup seems incomplete
          if (!loadingTracker.states.controlsSetup) {
            state.setTimer('controlsFallback', () => {
              loadingTracker.markComplete('controlsSetup');
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
  
  // Check autocomplete readiness
  state.setTimer('checkAutocomplete', () => {
    loadingTracker.checkAutocompleteReady();
  }, 1000);
  
  // Additional autocomplete check after longer delay
  state.setTimer('checkAutocompleteLater', () => {
    loadingTracker.checkAutocompleteReady();
  }, 3000);
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

// OPTIMIZED: Shared utilities for other scripts (integration optimization)
window.mapUtilities = {
  getAvailableFilterLists,
  domCache,
  eventManager,
  state,
  utils,
  mapLayers,
  checkAndToggleFilteredElements, // FIXED: Export the new filtered elements function
  toggleShowWhenFilteredElements // FIXED: Export the toggle function too
};

// OPTIMIZED: Cleanup on page unload (prevent memory leaks)
window.addEventListener('beforeunload', () => {
  // Clean up all managed resources
  eventManager.cleanup();
  state.cleanup();
  
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
