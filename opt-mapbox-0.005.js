// HEAVILY OPTIMIZED Mapbox Script - Performance Enhanced 2025
// Major optimizations: DOM caching, event cleanup, map batching, smart initialization

// Detect mobile for better map experience
const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Show loading screen at start
const loadingScreen = document.getElementById('loading-map-screen');
if (loadingScreen) {
  loadingScreen.style.display = 'flex';
}

// Fallback: Hide loading screen after max 10 seconds regardless
setTimeout(() => {
  const loadingScreen = document.getElementById('loading-map-screen');
  if (loadingScreen && loadingScreen.style.display !== 'none') {
    loadingScreen.style.display = 'none';
  }
}, 10000);

// OPTIMIZED: Ultra-fast DOM Element Cache with aggressive caching
class OptimizedDOMCache {
  constructor() {
    this.cache = new Map();
    this.selectorCache = new Map();
    this.listCache = new Map();
    this.negativeCache = new Set(); // Cache for elements that don't exist
    this._isStale = false;
  }
  
  // Single element getters with aggressive caching
  $id(id) {
    if (this.negativeCache.has(`id:${id}`)) return null;
    if (!this.cache.has(id)) {
      const element = document.getElementById(id);
      if (element) {
        this.cache.set(id, element);
      } else {
        this.negativeCache.add(`id:${id}`);
        return null;
      }
    }
    return this.cache.get(id);
  }
  
  $1(selector) {
    if (this.negativeCache.has(`sel:${selector}`)) return null;
    if (!this.selectorCache.has(selector)) {
      const element = document.querySelector(selector);
      if (element) {
        this.selectorCache.set(selector, element);
      } else {
        this.negativeCache.add(`sel:${selector}`);
        return null;
      }
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
  
  // Smart invalidation
  invalidate() {
    this.cache.clear();
    this.selectorCache.clear(); 
    this.listCache.clear();
    this.negativeCache.clear();
    this._isStale = false;
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

// OPTIMIZED: Lightweight Event Manager
class OptimizedEventManager {
  constructor() {
    this.listeners = new Map();
    this.debounceTimers = new Map();
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
    this.debounceTimers.clear();
  }
  
  getStats() {
    return {
      trackedListeners: Array.from(this.listeners.values()).reduce((sum, arr) => sum + arr.length, 0),
      activeTimers: this.debounceTimers.size
    };
  }
}

// OPTIMIZED: Global event manager
const eventManager = new OptimizedEventManager();

// Initialize Mapbox
const lang = navigator.language.split('-')[0];
mapboxgl.accessToken = "pk.eyJ1Ijoibml0YWloYXJkeSIsImEiOiJjbWE0d2F2cHcwYTYxMnFzNmJtanFhZzltIn0.diooYfncR44nF0Y8E1jvbw";
if (['ar', 'he'].includes(lang)) mapboxgl.setRTLTextPlugin("https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.3.0/mapbox-gl-rtl-text.js");

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/nitaihardy/cmdevdvum013y01quaexr4dek",
  center: [35.22, 31.85],
  zoom: isMobile ? 7.5 : 8.33,
  language: ['en','es','fr','de','zh','ja','ru','ar','he'].includes(lang) ? lang : 'en'
});

map.addControl(new mapboxgl.GeolocateControl({positionOptions: {enableHighAccuracy: true}, trackUserLocation: true, showUserHeading: true}));

// Add zoom controls
map.addControl(new mapboxgl.NavigationControl({
  showCompass: false,
  showZoom: true,
  visualizePitch: false
}), 'top-right');

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
        center: [35.22, 31.85],
        zoom: isMobile ? 7.5 : 8.33,
        duration: 1200,
        essential: true,
        easing: t => t * (2 - t) // Smooth easing
      });
      
      if (this._map.getSource('localities-source')) {
        this._map.getSource('localities-source').setData({type: "FeatureCollection", features: state.allLocalityFeatures});
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

// OPTIMIZED: Streamlined State Management  
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
    
    this.performance = {
      initStartTime: performance.now(),
      loadTimes: new Map()
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
  }
}

const state = new OptimizedMapState();
window.isLinkClick = false;

// OPTIMIZED: High-performance utilities
const utils = {
  _eventCache: new Map(),
  
  triggerEvent: (el, events) => {
    events.forEach(eventType => {
      if (!utils._eventCache.has(eventType)) {
        utils._eventCache.set(eventType, new Event(eventType, {bubbles: true}));
      }
      el.dispatchEvent(utils._eventCache.get(eventType));
    });
  },
  
  setStyles: (el, styles) => {
    requestAnimationFrame(() => Object.assign(el.style, styles));
  },
  
  calculateCentroid: (() => {
    const cache = new Map();
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
      
      if (cache.size < 100) cache.set(key, result);
      return result;
    };
  })()
};

// OPTIMIZED: Efficient Map Layer Management
class OptimizedMapLayers {
  constructor(map) {
    this.map = map;
    this.sourceCache = new Map();
    this.layerCache = new Map();
    this.batchOperations = [];
    this.pendingBatch = false;
  }
  
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
        console.warn('Batch operation failed:', error);
      }
    });
    
    this.batchOperations = [];
    this.pendingBatch = false;
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
  
  optimizeLayerOrder() {
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
          } catch (e) {
            console.warn(`Failed to reorder layer ${layerId}:`, e);
          }
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

// Toggle sidebar function
const toggleSidebar = (side, show = null) => {
  const sidebar = $id(`${side}Sidebar`);
  if (!sidebar) return;
  
  const isShowing = show !== null ? show : !sidebar.classList.contains('is-show');
  sidebar.classList.toggle('is-show', isShowing);
  
  const currentWidth = parseInt(getComputedStyle(sidebar).width) || 300;
  const jsMarginProperty = side === 'SecondLeft' ? 'marginLeft' : `margin${side}`;
  
  if (window.innerWidth > 478) {
    sidebar.style[jsMarginProperty] = isShowing ? '0' : `-${currentWidth + 1}px`;
    
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

// Boundary highlighting functions
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

// OPTIMIZED: Fast filtered elements toggle
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
  
  requestAnimationFrame(() => {
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
  });
}

function selectLocalityCheckbox(localityName) {
  const districtCheckboxes = $('[checkbox-filter="district"] input[fs-list-value]');
  const localityCheckboxes = $('[checkbox-filter="locality"] input[fs-list-value]');
  
  requestAnimationFrame(() => {
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
  });
}

// OPTIMIZED: Cached filter list discovery
const getAvailableFilterLists = (() => {
  let cachedLists = null;
  let lastCacheTime = 0;
  
  return () => {
    const now = Date.now();
    if (cachedLists && (now - lastCacheTime) < 5000) {
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

// OPTIMIZED: Fast location data processing
function getLocationData() {
  const startTime = performance.now();
  state.locationData.features = [];
  
  const lists = getAvailableFilterLists();
  let totalLoaded = 0;
  
  if (lists.length === 0) {
    console.warn('No filter lists found');
    return;
  }
  
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
  
  state.allLocalityFeatures = [...state.locationData.features];
  
  const loadTime = performance.now() - startTime;
  state.performance.loadTimes.set('locationData', loadTime);
}

// OPTIMIZED: Native markers
function addNativeMarkers() {
  if (!state.locationData.features.length) return;
  
  const startTime = performance.now();
  
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
            isMobile ? 7.5 : 8.5, 0,
            isMobile ? 8.5 : 9.5, 1
          ]
        }
      });
      
      mapLayers.invalidateCache();
    }
  });
  
  setupNativeMarkerClicks();
  state.performance.loadTimes.set('nativeMarkers', performance.now() - startTime);
}

// District markers
function addNativeDistrictMarkers() {
  if (!state.allDistrictFeatures.length) return;
  
  const startTime = performance.now();
  
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
        ],
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
  state.performance.loadTimes.set('districtMarkers', performance.now() - startTime);
}

// Marker click handlers
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
      duration: 1200,
      essential: true,
      easing: t => t * (2 - t) // Smooth easing
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
        map.fitBounds(bounds, {
          padding: {
            top: 80,
            bottom: 80, 
            left: 80,
            right: 80
          },
          duration: 1500,
          essential: true,
          easing: t => t * (2 - t) // Smooth easing function
        });
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

// OPTIMIZED: Efficient filtering checks
const checkFiltering = (() => {
  const cache = new Map();
  
  return (instance) => {
    const cacheKey = `${instance}-${Date.now() - (Date.now() % 1000)}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    
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
    if (cache.size > 10) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }
    
    return result;
  };
})();

const checkMapMarkersFiltering = (() => {
  let lastCheck = 0;
  let lastResult = false;
  
  return () => {
    const now = Date.now();
    if (now - lastCheck < 500) return lastResult;
    
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

// OPTIMIZED: Streamlined filter application
function applyFilterToMarkers() {
  if (state.flags.isInitialLoad && !checkMapMarkersFiltering()) return;
  
  if (state.flags.skipNextReframe) {
    console.log('Skipping reframe due to boundary zoom');
    return;
  }
  
  const startTime = performance.now();
  
  const visibilityCache = new Map();
  const isElementVisible = (el) => {
    if (visibilityCache.has(el)) return visibilityCache.get(el);
    
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
    visibleCoordinates = visibleData
      .map(pair => {
        const lat = parseFloat(pair.lat?.textContent.trim());
        const lon = parseFloat(pair.lon?.textContent.trim());
        return (!isNaN(lat) && !isNaN(lon)) ? [lon, lat] : null;
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
      essential: true,
      easing: t => t * (2 - t) // Smooth easing
    });
  } else {
    if (!state.flags.isInitialLoad || !checkMapMarkersFiltering()) {
      map.flyTo({
        center: [35.22, 31.85], 
        zoom: isMobile ? 7.5 : 8.33, 
        duration: animationDuration, 
        essential: true,
        easing: t => t * (2 - t) // Smooth easing
      });
    }
  }
  
  state.performance.loadTimes.set('filterApplication', performance.now() - startTime);
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
}

// Controls setup
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
  
  const setupSidebarControls = (selector, sidebarSide, eventType = 'click') => {
    const elements = $(selector);
    elements.forEach(element => {
      const handler = () => {
        const sidebar = $id(`${sidebarSide}Sidebar`);
        if (!sidebar) return;
        
        const openRightSidebar = element.getAttribute('open-right-sidebar');
        const openSecondLeftSidebar = element.getAttribute('open-second-left-sidebar');
        
        if (openRightSidebar === 'open-only') {
          toggleSidebar(sidebarSide, true);
        } else if (openSecondLeftSidebar === 'open-only') {
          toggleSidebar(sidebarSide, true);
        } else {
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
    });
  };
  
  setupSidebarControls('[open-right-sidebar="true"], [open-right-sidebar="open-only"]', 'Right');
  setupSidebarControls('[open-second-left-sidebar="true"], [open-second-left-sidebar="open-only"]', 'SecondLeft');
  setupSidebarControls('.OpenLeftSidebar, [OpenLeftSidebar], [openleftsidebar]', 'Left', 'change');
  setupSidebarControls('.OpenSecondLeftSidebar, [OpenSecondLeftSidebar], [opensecondleftsidebar]', 'SecondLeft', 'change');
  
  setupTabSwitcher();
  setupAreaKeyControls();
}

// OPTIMIZED: Streamlined sidebar setup
function setupSidebars() {
  let zIndex = 1000;
  
  const setupSidebarElement = (side) => {
    const sidebar = $id(`${side}Sidebar`);
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
      return;
    }
    
    if (attempt < maxAttempts) {
      const delay = [50, 150, 250, 500][attempt - 1] || 500;
      state.setTimer(`sidebarSetup-${attempt}`, () => attemptSetup(attempt + 1, maxAttempts), delay);
    } else {
      setupInitialMargins();
      state.setTimer('setupControls', setupControls, 50);
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

// Event setup
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
}

// Dropdown listeners
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
      
      const districtWithBoundary = state.allDistrictFeatures.find(
        f => f.properties.name === selectedDistrict && f.properties.source === 'boundary'
      );
      
      if (districtWithBoundary && selectedDistrict) {
        const boundarySourceId = `${selectedDistrict.toLowerCase().replace(/\s+/g, '-')}-boundary`;
        const source = map.getSource(boundarySourceId);
        
        if (source && source._data) {
          state.flags.skipNextReframe = true;
          
          const bounds = new mapboxgl.LngLatBounds();
          const addCoords = coords => {
            if (Array.isArray(coords) && coords.length > 0) {
              if (typeof coords[0] === 'number') bounds.extend(coords);
              else coords.forEach(addCoords);
            }
          };
          
          source._data.features.forEach(feature => addCoords(feature.geometry.coordinates));
          map.fitBounds(bounds, {
            padding: {
              top: 80,
              bottom: 80,
              left: 80, 
              right: 80
            },
            duration: 1500,
            essential: true,
            easing: t => t * (2 - t) // Smooth easing function
          });
          
          state.setTimer('skipReframeCleanup', () => {
            state.flags.skipNextReframe = false;
          }, 1200);
        } else {
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

// GeoJSON loading
function loadCombinedGeoData() {
  const startTime = performance.now();
  
  fetch('https://cdn.jsdelivr.net/gh/Tovlim/COTO@main/Combined-GEOJSON-0.003.json')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(combinedData => {
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
        state.setTimer('finalLayerOrder', () => mapLayers.optimizeLayerOrder(), 300);
      }, 100);
      
      state.performance.loadTimes.set('combinedGeoData', performance.now() - startTime);
    })
    .catch(error => {
      console.error('Error loading combined GeoJSON data:', error);
      addNativeDistrictMarkers();
      state.setTimer('errorLayerOrder', () => mapLayers.optimizeLayerOrder(), 300);
    });
}

// District boundary addition
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
  
  const areaLayers = ['area-a-layer', 'area-b-layer', 'area-c-layer'];
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

// Area overlay addition
function addAreaOverlayToMap(name, areaFeature) {
  const areaConfig = {
    'Area A': { color: '#adc278', layerId: 'area-a-layer', sourceId: 'area-a-source' },
    'Area B': { color: '#ffdcc6', layerId: 'area-b-layer', sourceId: 'area-b-source' },
    'Area C': { color: '#889c9b', layerId: 'area-c-layer', sourceId: 'area-c-source' }
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

// Area controls
function setupAreaKeyControls() {
  if (state.flags.areaControlsSetup) return;
  
  const areaControls = [
    {keyId: 'area-a-key', layerId: 'area-a-layer', wrapId: 'area-a-key-wrap'},
    {keyId: 'area-b-key', layerId: 'area-b-layer', wrapId: 'area-b-key-wrap'},
    {keyId: 'area-c-key', layerId: 'area-c-layer', wrapId: 'area-c-key-wrap'}
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
  
  areaControls.forEach(control => {
    const checkbox = $id(control.keyId);
    if (!checkbox || !mapLayers.hasLayer(control.layerId)) return;
    
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
      setupCount++;
    }
  });
  
  markerControls.forEach(control => {
    const checkbox = $id(control.keyId);
    if (!checkbox) return;
    
    checkbox.checked = false;
    
    if (!checkbox.dataset.mapboxListenerAdded) {
      eventManager.add(checkbox, 'change', () => {
        const visibility = checkbox.checked ? 'none' : 'visible';
        
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
      });
      checkbox.dataset.mapboxListenerAdded = 'true';
    }
    
    const wrapperDiv = $id(control.wrapId);
    if (wrapperDiv && !wrapperDiv.dataset.mapboxHoverAdded) {
      eventManager.add(wrapperDiv, 'mouseenter', () => {
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
      });
      
      eventManager.add(wrapperDiv, 'mouseleave', () => {
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
      });
      
      wrapperDiv.dataset.mapboxHoverAdded = 'true';
      setupCount++;
    }
  });
  
  const totalControls = areaControls.length + markerControls.length;
  if (setupCount >= totalControls - 2) {
    state.flags.areaControlsSetup = true;
  }
}

// Utility functions
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

function loadDistrictTags() {
  if (state.flags.districtTagsLoaded) return;
  
  const districtTagCollection = $id('district-tag-collection');
  if (!districtTagCollection) return;
  
  const districtTagItems = districtTagCollection.querySelectorAll('#district-tag-item');
  
  state.allDistrictFeatures = state.allDistrictFeatures.filter(f => f.properties.source !== 'tag');
  
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
  
  addNativeDistrictMarkers();
  state.setTimer('districtTagsLayerOrder', () => mapLayers.optimizeLayerOrder(), 100);
}

function generateLocalityCheckboxes() {
  const container = $id('locality-check-list');
  if (!container) return;
  
  const template = container.querySelector('[checkbox-filter="locality"]');
  if (!template) return;
  
  const localityNames = [...new Set(state.allLocalityFeatures.map(feature => feature.properties.name))].sort();
  
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
  domCache.markStale();
}

function setupCheckboxEvents(checkboxContainer) {
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
  
  const filterElements = checkboxContainer.querySelectorAll('[fs-cmsfilter-element="filters"] input, [fs-cmsfilter-element="filters"] select');
  filterElements.forEach(element => {
    eventManager.add(element, 'change', () => state.setTimer('checkboxFilter', handleFilterUpdate, 50));
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
    
    const allCheckboxes = document.querySelectorAll('[checkbox-filter] input[type="checkbox"]');
    allCheckboxes.forEach(checkbox => {
      if (!checkbox.dataset.filteredElementListener) {
        eventManager.add(checkbox, 'change', () => {
          setTimeout(checkAndToggleFilteredElements, 50);
        });
        checkbox.dataset.filteredElementListener = 'true';
      }
    });
    
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
    
    window.cleanupTagMonitoring = cleanup;
  };
})();

// OPTIMIZED: Streamlined initialization
function init() {
  const startTime = performance.now();
  
  getLocationData();
  addNativeMarkers();
  setupEvents();
  
  state.setTimer('generateCheckboxes', generateLocalityCheckboxes, 300);
  state.setTimer('initialLayerOrder', () => mapLayers.optimizeLayerOrder(), 100);
  
  const handleMapEvents = () => {
    state.clearTimer('mapEventHandler');
    state.setTimer('mapEventHandler', () => {}, 10);
  };
  
  map.on('moveend', handleMapEvents);
  map.on('zoomend', handleMapEvents);
  
  [300, 800].forEach(delay => 
    state.setTimer(`dropdownSetup-${delay}`, setupDropdownListeners, delay)
  );
  [200, 600, 1200].forEach(delay => 
    state.setTimer(`tabSetup-${delay}`, setupTabSwitcher, delay)
  );
  
  state.flags.mapInitialized = true;
  
  state.setTimer('hideLoading', () => {
    const loadingScreen = document.getElementById('loading-map-screen');
    if (loadingScreen) {
      loadingScreen.style.display = 'none';
    }
  }, 600);
  
  state.setTimer('initialFiltering', () => {
    if (state.flags.isInitialLoad) {
      const hasFiltering = checkMapMarkersFiltering();
      if (hasFiltering) {
        applyFilterToMarkers();
      }
      state.flags.isInitialLoad = false;
    }
    
    checkAndToggleFilteredElements();
  }, 300);
}

// Control positioning
state.setTimer('controlPositioning', () => {
  const ctrl = $1('.mapboxgl-ctrl-top-right');
  if (ctrl) {
    utils.setStyles(ctrl, {
      top: '4rem', 
      right: '0.5rem', 
      zIndex: '10'
    });
  }
}, 300);

// Map load event
map.on("load", () => {
  try {
    init();
    
    state.setTimer('loadCombinedData', loadCombinedGeoData, 100);
    state.setTimer('loadDistrictTags', loadDistrictTags, 800);
    state.setTimer('setupAreaControls', setupAreaKeyControls, 2000);
    state.setTimer('finalOptimization', () => mapLayers.optimizeLayerOrder(), 3000);
    
  } catch (error) {
    console.error('Map initialization error:', error);
    state.setTimer('errorHideLoading', () => {
      const loadingScreen = document.getElementById('loading-map-screen');
      if (loadingScreen) {
        loadingScreen.style.display = 'none';
      }
    }, 2000);
  }
});

// DOM ready handlers
document.addEventListener('DOMContentLoaded', () => {
  setupSidebars();
  setupTabSwitcher();
});

window.addEventListener('load', () => {
  setupSidebars();
  setupTabSwitcher();
  
  state.setTimer('loadFallbackInit', () => {
    if (!state.allLocalityFeatures.length && map.loaded()) {
      try { 
        init(); 
      } catch (error) { 
        console.warn('Fallback init failed:', error);
      }
    }
  }, 100);
  
  // Retry mechanisms
  if (!state.flags.districtTagsLoaded) {
    [1200, 2500].forEach(delay => 
      state.setTimer(`districtTagsRetry-${delay}`, () => {
        if (!state.flags.districtTagsLoaded) loadDistrictTags();
      }, delay)
    );
  }
  
  if (!state.flags.areaControlsSetup) {
    [2500, 4000].forEach(delay => 
      state.setTimer(`areaControlsRetry-${delay}`, () => {
        if (!state.flags.areaControlsSetup) setupAreaKeyControls();
      }, delay)
    );
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
    state.setTimer('reframeCheck1', () => {
      if (!checkAndReframe()) {
        state.setTimer('reframeCheck2', checkAndReframe, 1000);
      }
    }, 500);
  }
});

// Enhanced tag monitoring initialization
state.setTimer('initMonitorTags', monitorTags, 100);

// Additional check after page is fully loaded
window.addEventListener('load', () => {
  state.setTimer('loadCheckFiltered', checkAndToggleFilteredElements, 200);
});

// OPTIMIZED: Shared utilities for other scripts
window.mapUtilities = {
  getAvailableFilterLists,
  domCache,
  eventManager,
  state,
  utils,
  mapLayers,
  checkAndToggleFilteredElements,
  toggleShowWhenFilteredElements
};

// OPTIMIZED: Performance monitoring
window.getMapPerformanceStats = () => {
  return {
    totalInitTime: performance.now() - state.performance.initStartTime,
    loadTimes: Object.fromEntries(state.performance.loadTimes),
    activeTimers: state.timers.size,
    domCache: {
      cached: domCache.cache.size,
      selectors: domCache.selectorCache.size,
      lists: domCache.listCache.size,
      negativeCache: domCache.negativeCache.size
    },
    events: eventManager.getStats(),
    layers: {
      cachedLayers: mapLayers.layerCache.size,
      cachedSources: mapLayers.sourceCache.size,
      pendingBatch: mapLayers.pendingBatch,
      batchSize: mapLayers.batchOperations.length
    }
  };
};

// OPTIMIZED: Cleanup on page unload
window.addEventListener('beforeunload', () => {
  eventManager.cleanup();
  state.cleanup();
  
  const tagParent = $id('tagparent');
  if (tagParent && tagParent._mutationObserver) {
    tagParent._mutationObserver.disconnect();
  }
  
  if (map) {
    map.remove();
  }
});

// Performance-focused console logging (only in debug mode)
if (window.location.search.includes('debug=true')) {
  console.log('🚀 Optimized Mapbox Script Loaded');
  console.log('Performance monitoring available via window.getMapPerformanceStats()');
  console.log('Shared utilities available via window.mapUtilities');
}
