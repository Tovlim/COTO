// Optimized Mapbox Script - Conservative approach maintaining original structure
// Performance improvements: Smart caching, parallel loading, debounced events

// Mobile detection (immediate)
const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Show loading screen immediately
const loadingScreen = document.getElementById('loading-map-screen');
if (loadingScreen) {
  loadingScreen.style.display = 'flex';
}

// Fallback: Hide loading screen after max 10 seconds
setTimeout(() => {
  const loadingScreen = document.getElementById('loading-map-screen');
  if (loadingScreen && loadingScreen.style.display !== 'none') {
    loadingScreen.style.display = 'none';
  }
}, 10000);

// Initialize Mapbox
const lang = navigator.language.split('-')[0];
mapboxgl.accessToken = "pk.eyJ1Ijoibml0YWloYXJkeSIsImEiOiJjbWE0d2F2cHcwYTYxMnFzNmJtanFhZzltIn0.diooYfncR44nF0Y8E1jvbw";
if (['ar', 'he'].includes(lang)) {
  mapboxgl.setRTLTextPlugin("https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.3.0/mapbox-gl-rtl-text.js");
}

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/nitaihardy/cmbus40jb016n01s5dui12tre",
  center: [35.22, 31.85],
  zoom: isMobile ? 7.5 : 8.33,
  language: ['en','es','fr','de','zh','ja','ru','ar','he'].includes(lang) ? lang : 'en'
});

map.addControl(new mapboxgl.GeolocateControl({positionOptions: {enableHighAccuracy: true}, trackUserLocation: true, showUserHeading: true}));
map.addControl(new mapboxgl.NavigationControl({showCompass: false, showZoom: true, visualizePitch: false}), 'top-right');

// Performance optimization: DOM element caching
const domCache = {
  elements: new Map(),
  get(selector, useCache = true) {
    if (useCache && this.elements.has(selector)) {
      const cached = this.elements.get(selector);
      // Validate cache - check if first element still exists
      if (cached.length && cached[0]?.isConnected) {
        return cached;
      }
      this.elements.delete(selector);
    }
    const elements = Array.from(document.querySelectorAll(selector));
    if (useCache && elements.length) {
      this.elements.set(selector, elements);
    }
    return elements;
  },
  getSingle(selector, useCache = true) {
    const cacheKey = `single_${selector}`;
    if (useCache && this.elements.has(cacheKey)) {
      const cached = this.elements.get(cacheKey);
      if (cached?.isConnected) return cached;
      this.elements.delete(cacheKey);
    }
    const element = document.querySelector(selector);
    if (useCache && element) {
      this.elements.set(cacheKey, element);
    }
    return element;
  },
  clear() {
    this.elements.clear();
  }
};

// Optimized utility functions
const $ = (sel) => domCache.get(sel);
const $1 = (sel) => domCache.getSingle(sel);
const $id = (id) => domCache.getSingle(`#${id}`);

// Performance optimization: Timer management
const timerManager = {
  timers: new Map(),
  debounce(fn, delay, key = null) {
    if (key && this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }
    const timer = setTimeout(() => {
      fn();
      if (key) this.timers.delete(key);
    }, delay);
    if (key) this.timers.set(key, timer);
    return timer;
  },
  clear(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  },
  clearAll() {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }
};

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
        duration: 1000,
        essential: true
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
    this._container.parentNode?.removeChild(this._container);
    this._map = undefined;
  }
}

map.addControl(new MapResetControl(), 'top-right');

// Global state - consolidated
const state = {
  locationData: {type: "FeatureCollection", features: []},
  allLocalityFeatures: [],
  allDistrictFeatures: [],
  lastClickedMarker: null,
  lastClickTime: 0,
  markerInteractionLock: false,
  highlightedBoundary: null,
  flags: {
    isInitialLoad: true,
    mapInitialized: false,
    districtTagsLoaded: false,
    areaControlsSetup: false
  }
};

window.isLinkClick = false;
const MARKER_FONT = '"itc-avant-garde-gothic-pro", sans-serif';
const TRANSITIONS = {
  default: "200ms",
  district: 'opacity 300ms ease, background-color 0.3s ease'
};

// Optimized utilities
const utils = {
  triggerEvent: (el, events) => events.forEach(e => el.dispatchEvent(new Event(e, {bubbles: true}))),
  setStyles: (el, styles) => Object.assign(el.style, styles),
  debounce: (fn, delay, key) => timerManager.debounce(fn, delay, key),
  calculateCentroid: coordinates => {
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
    return pointCount > 0 ? [totalLng / pointCount, totalLat / pointCount] : [0, 0];
  }
};

// Toggle sidebar with improved logic
const toggleSidebar = (side, show = null) => {
  const sidebar = $id(`${side}Sidebar`);
  if (!sidebar) return;
  
  const isShowing = show !== null ? show : !sidebar.classList.contains('is-show');
  sidebar.classList.toggle('is-show', isShowing);
  
  const currentWidth = parseInt(getComputedStyle(sidebar).width) || 300;
  const marginProp = `margin${side}`;
  
  if (window.innerWidth > 478) {
    sidebar.style[marginProp] = isShowing ? '0' : `-${currentWidth + 1}px`;
  } else {
    sidebar.style[marginProp] = isShowing ? '0' : '';
    if (isShowing) toggleSidebar(side === 'Left' ? 'Right' : 'Left', false);
  }
  
  utils.setStyles(sidebar, {pointerEvents: isShowing ? 'auto' : ''});
  const arrowIcon = $1(`[arrow-icon="${side.toLowerCase()}"]`);
  if (arrowIcon) arrowIcon.style.transform = isShowing ? 'rotateY(180deg)' : 'rotateY(0deg)';
};

// Highlight boundary with subtle red color
function highlightBoundary(districtName) {
  removeBoundaryHighlight();
  
  const boundaryFillId = `${districtName.toLowerCase().replace(/\s+/g, '-')}-fill`;
  const boundaryBorderId = `${districtName.toLowerCase().replace(/\s+/g, '-')}-border`;
  
  if (map.getLayer(boundaryFillId) && map.getLayer(boundaryBorderId)) {
    map.setPaintProperty(boundaryFillId, 'fill-color', '#f50000');
    map.setPaintProperty(boundaryFillId, 'fill-opacity', 0.25);
    map.setPaintProperty(boundaryBorderId, 'line-color', '#f50000');
    map.setPaintProperty(boundaryBorderId, 'line-opacity', 0.6);
    
    state.highlightedBoundary = districtName;
    console.log(`Highlighted boundary: ${districtName}`);
  }
}

// Remove boundary highlight
function removeBoundaryHighlight() {
  if (state.highlightedBoundary) {
    const boundaryFillId = `${state.highlightedBoundary.toLowerCase().replace(/\s+/g, '-')}-fill`;
    const boundaryBorderId = `${state.highlightedBoundary.toLowerCase().replace(/\s+/g, '-')}-border`;
    
    if (map.getLayer(boundaryFillId) && map.getLayer(boundaryBorderId)) {
      map.setPaintProperty(boundaryFillId, 'fill-color', '#1a1b1e');
      map.setPaintProperty(boundaryFillId, 'fill-opacity', 0.15);
      map.setPaintProperty(boundaryBorderId, 'line-color', '#888888');
      map.setPaintProperty(boundaryBorderId, 'line-opacity', 0.4);
      
      console.log(`Removed highlight from boundary: ${state.highlightedBoundary}`);
    }
    
    state.highlightedBoundary = null;
  }
}

// Toggle filtered elements
const toggleShowWhenFilteredElements = show => {
  $('[show-when-filtered="true"]').forEach(element => {
    utils.setStyles(element, {
      display: show ? 'block' : 'none',
      visibility: show ? 'visible' : 'hidden',
      opacity: show ? '1' : '0',
      pointerEvents: show ? 'auto' : 'none'
    });
  });
};

// Select district checkbox for filtering (triggered by map markers)
function selectDistrictCheckbox(districtName) {
  clearAllCheckboxes();
  const targetCheckbox = $('[checkbox-filter="district"] input[fs-list-value]').find(checkbox => 
    checkbox.getAttribute('fs-list-value') === districtName
  );
  
  if (targetCheckbox) {
    targetCheckbox.checked = true;
    utils.triggerEvent(targetCheckbox, ['change', 'input']);
    triggerFormEvents(targetCheckbox);
  }
}

// Select locality checkbox for filtering (triggered by map markers)
function selectLocalityCheckbox(localityName) {
  clearAllCheckboxes();
  const targetCheckbox = $('[checkbox-filter="locality"] input[fs-list-value]').find(checkbox => 
    checkbox.getAttribute('fs-list-value') === localityName
  );
  
  if (targetCheckbox) {
    targetCheckbox.checked = true;
    utils.triggerEvent(targetCheckbox, ['change', 'input']);
    triggerFormEvents(targetCheckbox);
  }
}

// Optimized checkbox clearing
function clearAllCheckboxes() {
  const allCheckboxes = $('[checkbox-filter] input[fs-list-value]');
  allCheckboxes.forEach(checkbox => {
    if (checkbox.checked) {
      checkbox.checked = false;
      utils.triggerEvent(checkbox, ['change', 'input']);
      triggerFormEvents(checkbox);
    }
  });
}

function triggerFormEvents(checkbox) {
  const form = checkbox.closest('form');
  if (form) {
    form.dispatchEvent(new Event('change', {bubbles: true}));
    form.dispatchEvent(new Event('input', {bubbles: true}));
  }
}

// Optimized location data extraction
function getLocationData() {
  state.locationData.features = [];
  const selectors = [
    $('.data-places-names, .data-place-name'),
    $('.data-places-latitudes, .data-place-latitude'),
    $('.data-places-longitudes, .data-place-longitude'),
    $('.data-places-slugs, .data-place-slug, .data-slug')
  ];
  
  const [names, lats, lngs, slugs] = selectors;
  if (!names.length) return;
  
  const minLength = Math.min(names.length, lats.length, lngs.length);
  for (let i = 0; i < minLength; i++) {
    const [lat, lng] = [parseFloat(lats[i].textContent), parseFloat(lngs[i].textContent)];
    if (isNaN(lat) || isNaN(lng)) continue;
    
    const feature = {
      type: "Feature",
      geometry: {type: "Point", coordinates: [lng, lat]},
      properties: {
        name: names[i].textContent.trim(),
        id: `location-${i}`,
        popupIndex: i,
        slug: slugs[i]?.textContent.trim() || '',
        index: i,
        type: 'locality'
      }
    };
    
    state.locationData.features.push(feature);
  }
  
  state.allLocalityFeatures = [...state.locationData.features];
}

// Add native Mapbox markers using Symbol layers
function addNativeMarkers() {
  if (!state.locationData.features.length) return;
  
  if (map.getSource('localities-source')) {
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
        'text-halo-color': '#739005',
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
          'interpolate', ['linear'], ['zoom'],
          8, 10, 12, 14, 16, 16
        ],
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-optional': true,
        'text-padding': 4,
        'text-offset': [0, 1.5],
        'text-anchor': 'top'
      ],
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#739005',
        'text-halo-width': 2,
        'text-opacity': [
          'interpolate', ['linear'], ['zoom'],
          isMobile ? 7.5 : 8.5, 0,
          isMobile ? 8.5 : 9.5, 1
        ]
      }
    });
  }
  
  setupNativeMarkerClicks();
}

// Add native district markers using Symbol layers
function addNativeDistrictMarkers() {
  if (!state.allDistrictFeatures.length) return;
  
  console.log(`Adding ${state.allDistrictFeatures.length} district markers`);
  
  if (map.getSource('districts-source')) {
    map.getSource('districts-source').setData({
      type: "FeatureCollection",
      features: state.allDistrictFeatures
    });
    
    if (map.getLayer('district-points')) {
      map.setPaintProperty('district-points', 'text-halo-color', '#f50000');
      console.log('Updated district markers to new color');
    }
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
          'interpolate', ['linear'], ['zoom'],
          6, 12, 10, 16, 14, 18
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
        'text-halo-color': '#f50000',
        'text-halo-width': 2,
        'text-opacity': [
          'interpolate', ['linear'], ['zoom'],
          5, 0, 6, 1
        ]
      }
    });
  }
  
  setupDistrictMarkerClicks();
}

// Setup click handlers for native markers
function setupNativeMarkerClicks() {
  map.on('click', 'locality-points', (e) => {
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
    
    timerManager.debounce(() => {
      window.isMarkerClick = false;
      state.markerInteractionLock = false;
    }, 1500, 'marker-interaction');
  });
  
  map.on('click', 'locality-clusters', (e) => {
    removeBoundaryHighlight();
    
    const features = map.queryRenderedFeatures(e.point, {
      layers: ['locality-clusters']
    });
    
    map.flyTo({
      center: features[0].geometry.coordinates,
      zoom: map.getZoom() + 2.5,
      duration: 800
    });
  });
  
  ['locality-clusters', 'locality-points'].forEach(layer => {
    map.on('mouseenter', layer, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', layer, () => {
      map.getCanvas().style.cursor = '';
    });
  });
}

// Setup click handlers for district markers
function setupDistrictMarkerClicks() {
  map.on('click', 'district-points', (e) => {
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
      console.log(`District ${districtName} has boundary, reframing to boundary extents and highlighting`);
      
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
        console.log(`Boundary source ${boundarySourceId} not found, falling back to dropdown`);
        removeBoundaryHighlight();
        selectDistrictInDropdown(districtName);
        timerManager.debounce(() => {
          applyFilterToMarkers();
        }, 200, 'district-fallback');
      }
    } else {
      console.log(`District ${districtName} has no boundary, using dropdown selection`);
      removeBoundaryHighlight();
      selectDistrictInDropdown(districtName);
      timerManager.debounce(() => {
        applyFilterToMarkers();
      }, 200, 'district-tag');
    }
    
    timerManager.debounce(() => {
      window.isMarkerClick = false;
      state.markerInteractionLock = false;
    }, 1500, 'marker-interaction');
  });
  
  map.on('mouseenter', 'district-points', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  
  map.on('mouseleave', 'district-points', () => {
    map.getCanvas().style.cursor = '';
  });
}

// Consolidated filtering checks
const checkFiltering = (instance) => {
  if (window.fsAttributes?.cmsfilter) {
    const filterInstance = window.fsAttributes.cmsfilter.getByInstance(instance);
    if (filterInstance) {
      const activeFilters = filterInstance.filtersData;
      if (activeFilters && Object.keys(activeFilters).length > 0) return true;
      
      const renderedItems = filterInstance.listInstance.items.filter(item => !item.element.style.display || item.element.style.display !== 'none');
      if (renderedItems.length > 0 && renderedItems.length < filterInstance.listInstance.items.length) return true;
    }
  }
  
  const filterList = $1(`[fs-list-instance="${instance}"]`);
  if (filterList) {
    const allItems = filterList.querySelectorAll('[fs-cmsfilter-element="list-item"]');
    const visibleItems = filterList.querySelectorAll('[fs-cmsfilter-element="list-item"]:not([style*="display: none"])');
    if (allItems.length > 0 && visibleItems.length > 0 && visibleItems.length < allItems.length) return true;
  }
  
  return false;
};

const checkFilterInstanceFiltering = () => checkFiltering('Filter');
const checkMapMarkersFiltering = () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (Array.from(urlParams.keys()).some(key => key.startsWith('mapmarkers_') || key.includes('mapmarkers') || key === 'district' || key === 'locality')) return true;
  
  if (checkFiltering('mapmarkers')) return true;
  
  const filteredLat = $('.data-places-latitudes-filter');
  const allLat = $('.data-places-latitudes, .data-place-latitude');
  return filteredLat.length > 0 && filteredLat.length < allLat.length;
};

// Optimized filter application
function applyFilterToMarkers() {
  if (state.flags.isInitialLoad && !checkMapMarkersFiltering()) return;
  
  const filteredLat = $('.data-places-latitudes-filter');
  const filteredLon = $('.data-places-longitudes-filter');
  const allLat = $('.data-places-latitudes, .data-place-latitude');
  
  let visibleCoordinates = [];
  
  if (filteredLat.length && filteredLon.length && filteredLat.length < allLat.length) {
    for (let i = 0; i < filteredLat.length; i++) {
      const lat = parseFloat(filteredLat[i]?.textContent.trim());
      const lon = parseFloat(filteredLon[i]?.textContent.trim());
      
      if (!isNaN(lat) && !isNaN(lon)) {
        visibleCoordinates.push([lon, lat]);
      }
    }
    
    if (map.getSource('localities-source')) {
      map.getSource('localities-source').setData({
        type: "FeatureCollection",
        features: state.allLocalityFeatures
      });
    }
  } else {
    if (map.getSource('localities-source')) {
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
      padding: {top: window.innerHeight * 0.15, bottom: window.innerHeight * 0.15, left: window.innerWidth * 0.15, right: window.innerWidth * 0.15},
      maxZoom: 13,
      duration: animationDuration,
      essential: true
    });
  } else {
    if (!state.flags.isInitialLoad || !checkMapMarkersFiltering()) {
      map.flyTo({center: [35.22, 31.85], zoom: isMobile ? 7.5 : 8.33, duration: animationDuration, essential: true});
    }
  }
}

// Optimized filter update handler
const handleFilterUpdate = utils.debounce(() => {
  if (window.isLinkClick || window.isMarkerClick || state.markerInteractionLock) return;
  applyFilterToMarkers();
}, 300, 'filter-update');

// Custom tab switcher
function setupTabSwitcher() {
  const tabTriggers = $('[open-tab]');
  
  tabTriggers.forEach(trigger => {
    if (trigger.dataset.tabSwitcherSetup === 'true') return;
    
    trigger.addEventListener('click', function(e) {
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

// Consolidated controls setup with optimization
function setupControls() {
  const controlMap = {
    'AllEvents': () => $id('ClearAll')?.click(),
    'ToggleLeft': () => {
      const leftSidebar = $id('LeftSidebar');
      if (leftSidebar) toggleSidebar('Left', !leftSidebar.classList.contains('is-show'));
    }
  };
  
  Object.entries(controlMap).forEach(([id, action]) => {
    const btn = $id(id);
    if (btn && !btn.dataset.optimizedSetup) {
      btn.addEventListener('click', e => {e.preventDefault(); e.stopPropagation(); action();});
      btn.dataset.optimizedSetup = 'true';
    }
  });
  
  const setupSidebarControls = (selector, sidebarSide, eventType = 'click') => {
    $(selector).forEach(element => {
      if (element.dataset.optimizedSetup === 'true') return;
      
      const handler = () => {
        const sidebar = $id(`${sidebarSide}Sidebar`);
        if (!sidebar) return;
        
        const openRightSidebar = element.getAttribute('open-right-sidebar');
        if (openRightSidebar === 'open-only') {
          toggleSidebar(sidebarSide, true);
        } else {
          toggleSidebar(sidebarSide, !sidebar.classList.contains('is-show'));
        }
        
        const groupName = element.getAttribute('open-tab');
        if (groupName) {
          timerManager.debounce(() => $1(`[opened-tab="${groupName}"]`)?.click(), 50, 'tab-switch');
        }
      };
      
      if (eventType === 'change' && (element.type === 'radio' || element.type === 'checkbox')) {
        element.addEventListener('change', () => element.checked && handler());
      } else {
        element.addEventListener(eventType, e => {e.stopPropagation(); handler();});
      }
      
      element.dataset.optimizedSetup = 'true';
    });
  };
  
  setupSidebarControls('[open-right-sidebar="true"], [open-right-sidebar="open-only"]', 'Right');
  setupSidebarControls('.OpenLeftSidebar, [OpenLeftSidebar], [openleftsidebar]', 'Left', 'change');
  
  setupTabSwitcher();
  setupAreaKeyControls();
}

// Optimized sidebar setup
function setupSidebars() {
  let zIndex = 1000;
  
  const setupSidebarElement = (side) => {
    const sidebar = $id(`${side}Sidebar`);
    const tab = $id(`${side}SideTab`);
    const close = $id(`${side}SidebarClose`);
    
    if (!sidebar || !tab || !close) return false;
    if (sidebar.dataset.optimizedSetup === 'true') return true;
    
    sidebar.style.cssText += `transition: margin-${side.toLowerCase()} 0.25s cubic-bezier(0.4, 0, 0.2, 1); z-index: ${zIndex}; position: relative;`;
    tab.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
    
    const bringToFront = () => {
      const newZ = ++zIndex;
      sidebar.style.zIndex = newZ;
      
      if (window.innerWidth <= 478) {
        tab.style.zIndex = newZ + 10;
        if (tab.parentElement) tab.parentElement.style.zIndex = newZ + 10;
      }
      
      const oppositeSide = side === 'Left' ? 'Right' : 'Left';
      const oppositeSidebar = $id(`${oppositeSide}Sidebar`);
      const oppositeTab = $id(`${oppositeSide}SideTab`);
      
      if (oppositeSidebar) oppositeSidebar.style.zIndex = newZ - 1;
      if (oppositeTab && window.innerWidth <= 478) {
        oppositeTab.style.zIndex = newZ + 5;
        if (oppositeTab.parentElement) oppositeTab.parentElement.style.zIndex = newZ + 5;
      }
    };

    const toggle = show => {
      if (show) bringToFront();
      sidebar.classList.toggle('is-show', show);
      
      const arrowIcon = $1(`[arrow-icon="${side.toLowerCase()}"]`);
      if (arrowIcon) arrowIcon.style.transform = show ? 'rotateY(180deg)' : 'rotateY(0deg)';
      
      if (window.innerWidth > 478) {
        const currentWidth = parseInt(getComputedStyle(sidebar).width) || 300;
        sidebar.style[`margin${side}`] = show ? '0' : `-${currentWidth + 1}px`;
      } else {
        sidebar.style[`margin${side}`] = show ? '0' : '';
        if (show) {
          const oppositeSide = side === 'Left' ? 'Right' : 'Left';
          const oppositeSidebar = $id(`${oppositeSide}Sidebar`);
          if (oppositeSidebar) {
            oppositeSidebar.classList.remove('is-show');
            const oppositeArrowIcon = $1(`[arrow-icon="${oppositeSide.toLowerCase()}"]`);
            if (oppositeArrowIcon) oppositeArrowIcon.style.transform = 'rotateY(0deg)';
            oppositeSidebar.style[`margin${oppositeSide}`] = '';
            oppositeSidebar.style.pointerEvents = '';
          }
        }
      }
      
      sidebar.style.pointerEvents = show ? 'auto' : '';
    };
    
    sidebar.addEventListener('click', () => {
      if (sidebar.classList.contains('is-show')) bringToFront();
    });
    
    tab.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      toggle(!sidebar.classList.contains('is-show'));
    });
    
    close.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      toggle(false);
    });
    
    sidebar.dataset.optimizedSetup = 'true';
    zIndex++;
    return true;
  };
  
  const attemptSetup = (attempt = 1, maxAttempts = 5) => {
    const leftReady = setupSidebarElement('Left');
    const rightReady = setupSidebarElement('Right');
    
    if (leftReady && rightReady) {
      setupInitialMargins();
      timerManager.debounce(setupControls, 100, 'setup-controls');
      return;
    }
    
    if (attempt < maxAttempts) {
      const delay = [100, 300, 500, 1000][attempt - 1] || 1000;
      timerManager.debounce(() => attemptSetup(attempt + 1, maxAttempts), delay, `sidebar-setup-${attempt}`);
    } else {
      setupInitialMargins();
      timerManager.debounce(setupControls, 100, 'setup-controls');
    }
  };
  
  const setupInitialMargins = () => {
    if (window.innerWidth <= 478) return;
    
    ['Left', 'Right'].forEach(side => {
      const sidebar = $id(`${side}Sidebar`);
      if (sidebar && !sidebar.classList.contains('is-show')) {
        const currentWidth = parseInt(getComputedStyle(sidebar).width) || 300;
        sidebar.style[`margin${side}`] = `-${currentWidth + 1}px`;
      }
    });
  };
  
  attemptSetup();
}

// Optimized event setup with consolidated handlers
function setupEvents() {
  const eventHandlers = [
    {selector: '[data-auto-sidebar="true"]', events: ['change', 'input'], handler: () => {
      if (window.innerWidth > 478) {
        timerManager.debounce(() => toggleSidebar('Left', true), 100, 'auto-sidebar');
      }
    }},
    {selector: 'select, [fs-cmsfilter-element="select"]', events: ['change'], handler: () => timerManager.debounce(handleFilterUpdate, 100, 'select-filter')},
    {selector: '[fs-cmsfilter-element="filters"] input, [fs-cmsfilter-element="filters"] select', events: ['change'], handler: () => timerManager.debounce(handleFilterUpdate, 100, 'input-filter')}
  ];
  
  eventHandlers.forEach(({selector, events, handler}) => {
    $(selector).forEach(element => {
      if (element.dataset.optimizedEvents === 'true') return;
      
      events.forEach(event => {
        if (event === 'input' && ['text', 'search'].includes(element.type)) {
          element.addEventListener(event, handler);
        } else if (event !== 'input' || element.type !== 'text') {
          element.addEventListener(event, handler);
        }
      });
      
      element.dataset.optimizedEvents = 'true';
    });
  });
  
  // Consolidated apply-map-filter setup
  $('[apply-map-filter="true"], #refreshDiv, #refresh-on-enter, .filterrefresh, #filter-button').forEach(element => {
    if (element.dataset.optimizedMapFilter === 'true') return;
    
    const events = element.id === 'refresh-on-enter' || element.getAttribute('apply-map-filter') === 'true' 
      ? ['click', 'keypress', 'input'] : ['click'];
    
    events.forEach(eventType => {
      element.addEventListener(eventType, (e) => {
        if (eventType === 'keypress' && e.key !== 'Enter') return;
        if (window.isMarkerClick) return;
        
        e.preventDefault();
        
        const delay = eventType === 'input' ? 300 : 100;
        timerManager.debounce(() => {
          applyFilterToMarkers();
        }, delay, 'map-filter');
      });
    });
    
    element.dataset.optimizedMapFilter = 'true';
  });
  
  // Global event listeners
  ['fs-cmsfilter-filtered', 'fs-cmsfilter-pagination-page-changed'].forEach(event => {
    document.addEventListener(event, (e) => {
      if (window.isMarkerClick || state.markerInteractionLock) return;
      handleFilterUpdate();
    });
  });
  
  // Firefox form handling
  if (navigator.userAgent.toLowerCase().includes('firefox')) {
    $('form').forEach(form => {
      if (form.dataset.optimizedFirefox === 'true') return;
      
      const hasFilterElements = form.querySelector('[fs-cmsfilter-element]') !== null;
      const isNearMap = $id('map') && (form.contains($id('map')) || $id('map').contains(form) || form.parentElement === $id('map').parentElement);
      
      if (hasFilterElements || isNearMap) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          timerManager.debounce(() => {
            applyFilterToMarkers();
          }, 100, 'firefox-submit');
          
          return false;
        }, true);
        
        form.dataset.optimizedFirefox = 'true';
      }
    });
  }
  
  // Link click handlers
  $('a:not(.filterrefresh):not([fs-cmsfilter-element])').forEach(link => {
    if (link.dataset.optimizedLink === 'true') return;
    
    link.onclick = () => {
      if (!link.closest('[fs-cmsfilter-element]') && !link.classList.contains('w-pagination-next') && !link.classList.contains('w-pagination-previous')) {
        window.isLinkClick = true;
        timerManager.debounce(() => window.isLinkClick = false, 500, 'link-click');
      }
    };
    
    link.dataset.optimizedLink = 'true';
  });
}

// Optimized dropdown listeners
function setupDropdownListeners() {
  $('[districtselect]').forEach(element => {
    if (element.dataset.optimizedDropdown === 'true') return;
    
    element.addEventListener('click', (e) => {
      if (window.isMarkerClick) return;
      
      timerManager.debounce(() => {
        applyFilterToMarkers();
      }, 50, 'dropdown-district');
    });
    
    element.dataset.optimizedDropdown = 'true';
  });
  
  const selectField5 = $id('select-field-5');
  if (selectField5 && selectField5.dataset.optimizedSelect !== 'true') {
    selectField5.addEventListener('change', (e) => {
      if (window.isMarkerClick) return;
      
      timerManager.debounce(() => {
        applyFilterToMarkers();
      }, 50, 'select-change');
    });
    
    selectField5.dataset.optimizedSelect = 'true';
  }
}

// Performance optimization: Parallel area overlay loading
async function loadAreaOverlays() {
  console.log('loadAreaOverlays() called');
  
  const areas = [
    {name: 'Area A', url: 'https://raw.githubusercontent.com/btselem/map-data/master/s10/area_a.geojson', sourceId: 'area-a-source', layerId: 'area-a-layer', color: '#98b074', opacity: 0.5},
    {name: 'Area B', url: 'https://raw.githubusercontent.com/btselem/map-data/master/s10/area_b.geojson', sourceId: 'area-b-source', layerId: 'area-b-layer', color: '#a84b4b', opacity: 0.5},
    {name: 'Area C', url: 'https://raw.githubusercontent.com/btselem/map-data/master/s10/area_c.geojson', sourceId: 'area-c-source', layerId: 'area-c-layer', color: '#e99797', opacity: 0.5}
  ];
  
  // Load all areas in parallel
  const loadPromises = areas.map(async area => {
    try {
      console.log(`Starting fetch for ${area.name} from ${area.url}`);
      const response = await fetch(area.url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const geojsonData = await response.json();
      console.log(`${area.name} data loaded successfully:`, geojsonData.features ? `${geojsonData.features.length} features` : 'no features');
      
      // Remove existing layers/sources if they exist
      try {
        if (map.getLayer(area.layerId)) {
          console.log(`Removing existing layer: ${area.layerId}`);
          map.removeLayer(area.layerId);
        }
        if (map.getSource(area.sourceId)) {
          console.log(`Removing existing source: ${area.sourceId}`);
          map.removeSource(area.sourceId);
        }
      } catch (e) {
        console.log(`Cleanup error for ${area.name}:`, e);
      }
      
      // Add source
      console.log(`Adding source: ${area.sourceId}`);
      map.addSource(area.sourceId, {
        type: 'geojson',
        data: geojsonData
      });
      
      // Add the layer BELOW marker layers
      console.log(`Adding layer: ${area.layerId}`);
      map.addLayer({
        id: area.layerId,
        type: 'fill',
        source: area.sourceId,
        layout: {
          'visibility': 'visible'
        },
        paint: {
          'fill-color': area.color,
          'fill-opacity': area.opacity,
          'fill-outline-color': area.color
        }
      }, map.getLayer('locality-clusters') ? 'locality-clusters' : undefined);
      
      console.log(`${area.name} layer added successfully`);
    } catch (error) {
      console.error(`Error loading ${area.name}:`, error);
    }
  });
  
  await Promise.allSettled(loadPromises);
  console.log('All area overlays processing completed');
}

// Area key controls with improved functionality
function setupAreaKeyControls() {
  if (state.flags.areaControlsSetup) {
    console.log('Area controls already setup, skipping');
    return;
  }
  
  console.log('setupAreaKeyControls() called');
  
  const areaControls = [
    {keyId: 'area-a-key', layerId: 'area-a-layer', wrapId: 'area-a-key-wrap'},
    {keyId: 'area-b-key', layerId: 'area-b-layer', wrapId: 'area-b-key-wrap'},
    {keyId: 'area-c-key', layerId: 'area-c-layer', wrapId: 'area-c-key-wrap'}
  ];
  
  let setupCount = 0;
  
  areaControls.forEach(control => {
    const checkbox = $id(control.keyId);
    if (!checkbox) {
      console.log(`Checkbox ${control.keyId} not found`);
      return;
    }
    
    console.log(`Setting up area control: ${control.keyId}`);
    
    if (!map.getLayer(control.layerId)) {
      console.log(`Layer ${control.layerId} not found in map yet`);
      return;
    }
    
    checkbox.checked = false;
    
    if (!checkbox.dataset.mapboxListenerAdded) {
      const mapboxChangeHandler = () => {
        console.log(`Area control ${control.keyId} changed to:`, checkbox.checked);
        
        if (!map.getLayer(control.layerId)) {
          console.log(`Layer ${control.layerId} not found in map`);
          return;
        }
        
        const visibility = checkbox.checked ? 'none' : 'visible';
        map.setLayoutProperty(control.layerId, 'visibility', visibility);
        console.log(`${control.layerId} visibility set to: ${visibility}`);
      };
      
      checkbox.addEventListener('change', mapboxChangeHandler);
      checkbox.dataset.mapboxListenerAdded = 'true';
      console.log(`Added Mapbox change listener to ${control.keyId}`);
    } else {
      console.log(`Mapbox listener already exists for ${control.keyId}`);
    }
    
    const wrapperDiv = $id(control.wrapId);
    
    if (wrapperDiv) {
      console.log(`Setting up hover effects for: ${control.wrapId}`);
      
      if (!wrapperDiv.dataset.mapboxHoverAdded) {
        const mouseEnterHandler = () => {
          if (!map.getLayer(control.layerId)) return;
          map.setPaintProperty(control.layerId, 'fill-opacity', 0.8);
        };
        
        const mouseLeaveHandler = () => {
          if (!map.getLayer(control.layerId)) return;
          map.setPaintProperty(control.layerId, 'fill-opacity', 0.5);
        };
        
        wrapperDiv.addEventListener('mouseenter', mouseEnterHandler);
        wrapperDiv.addEventListener('mouseleave', mouseLeaveHandler);
        wrapperDiv.dataset.mapboxHoverAdded = 'true';
        console.log(`Added Mapbox hover listeners to ${control.wrapId}`);
      } else {
        console.log(`Mapbox hover listeners already exist for ${control.wrapId}`);
      }
      
      setupCount++;
    } else {
      console.log(`Wrapper ${control.wrapId} not found`);
    }
  });
  
  if (setupCount === areaControls.length) {
    state.flags.areaControlsSetup = true;
    console.log('Area controls setup completed successfully');
  } else {
    console.log(`Area controls setup incomplete: ${setupCount}/${areaControls.length} completed`);
  }
}

// Performance optimization: Parallel boundary loading
async function loadSimplifiedBoundaries() {
  console.log('loadSimplifiedBoundaries() called');
  
  const districts = [
    'Jerusalem', 'Hebron', 'Tulkarm', 'Tubas', 'Salfit', 'Ramallah', 
    'Nablus', 'Jericho', 'Jenin', 'Bethlehem', 'Qalqilya'
  ];
  
  const customDistricts = [
    {name: 'East Jerusalem', url: 'https://raw.githubusercontent.com/btselem/map-data/master/s0/east_jerusalem.json'},
    {name: 'Deir Al-Balah', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Deir%20Al-Balah.geojson'},
    {name: 'Rafah', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Rafah.geojson'},
    {name: 'North Gaza', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/North%20Gaza.geojson'},
    {name: 'Khan Younis', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Khan%20Younis.geojson'},
    {name: 'Gaza', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Gaza.geojson'}
  ];
  
  console.log(`Starting to load ${districts.length + customDistricts.length} simplified boundaries in parallel`);
  
  // Reset district features for boundary-based districts
  state.allDistrictFeatures = state.allDistrictFeatures.filter(f => f.properties.source !== 'boundary');
  
  const loadSingleBoundary = async (name, customUrl = null) => {
    try {
      const url = customUrl || `https://raw.githubusercontent.com/Tovlim/COTO/main/${name}.geojson`;
      console.log(`Loading simplified boundary: ${name}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const geojsonData = await response.json();
      console.log(`${name} boundary loaded successfully`);
      
      const baseId = name.toLowerCase().replace(/\s+/g, '-');
      const sourceId = `${baseId}-boundary`;
      const fillId = `${baseId}-fill`;
      const borderId = `${baseId}-border`;
      
      // Clean up existing layers
      try {
        if (map.getLayer(borderId)) map.removeLayer(borderId);
        if (map.getLayer(fillId)) map.removeLayer(fillId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch (e) {
        console.log(`Cleanup error for ${name}:`, e);
      }
      
      // Add source
      map.addSource(sourceId, {
        type: 'geojson',
        data: geojsonData
      });
      
      // Add fill layer (visual only) - BELOW marker layers
      map.addLayer({
        id: fillId,
        type: 'fill',
        source: sourceId,
        layout: { 'visibility': 'visible' },
        paint: {
          'fill-color': '#1a1b1e',
          'fill-opacity': 0.15
        }
      }, map.getLayer('locality-clusters') ? 'locality-clusters' : undefined);
      
      // Add border layer (visual only) - BELOW marker layers
      map.addLayer({
        id: borderId,
        type: 'line',
        source: sourceId,
        layout: { 'visibility': 'visible' },
        paint: {
          'line-color': '#888888',
          'line-width': 1,
          'line-opacity': 0.4
        }
      }, map.getLayer('locality-clusters') ? 'locality-clusters' : undefined);
      
      console.log(`${name} simplified boundary added`);
      
      // Calculate centroid and add district marker
      if (geojsonData.features?.length > 0) {
        const existingFeature = state.allDistrictFeatures.find(f => f.properties.name === name && f.properties.source === 'boundary');
        if (!existingFeature) {
          const centroid = utils.calculateCentroid(geojsonData.features[0].geometry.coordinates);
          
          state.allDistrictFeatures.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: centroid },
            properties: {
              name: name,
              id: `district-${baseId}`,
              type: 'district',
              source: 'boundary'
            }
          });
          console.log(`Added district marker for ${name} at centroid:`, centroid);
        } else {
          console.log(`District marker for ${name} already exists, skipping`);
        }
      }
      
    } catch (error) {
      console.error(`Error loading ${name} boundary:`, error);
    }
  };
  
  // Load all boundaries in parallel
  const boundaryPromises = [
    ...districts.map(name => loadSingleBoundary(name)),
    ...customDistricts.map(district => loadSingleBoundary(district.name, district.url))
  ];
  
  await Promise.allSettled(boundaryPromises);
  console.log('All simplified boundaries processing completed');
  
  // Update district markers
  addNativeDistrictMarkers();
  
  // Update colors after a short delay
  timerManager.debounce(updateMarkerColors, 500, 'update-colors');
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

// Load district tags and add to district features
function loadDistrictTags() {
  if (state.flags.districtTagsLoaded) {
    console.log('District tags already loaded, skipping');
    return;
  }
  
  console.log('loadDistrictTags() called');
  
  const districtTagCollection = $id('district-tag-collection');
  if (!districtTagCollection) {
    console.log('District tag collection not found');
    return;
  }
  
  const districtTagItems = districtTagCollection.querySelectorAll('#district-tag-item');
  console.log(`Found ${districtTagItems.length} district tag items`);
  
  // Clear existing tag-based features (keep boundary-based features)
  state.allDistrictFeatures = state.allDistrictFeatures.filter(f => f.properties.source !== 'tag');
  
  districtTagItems.forEach((tagItem, index) => {
    if (getComputedStyle(tagItem).display === 'none') {
      console.log(`Skipping hidden district tag item ${index}`);
      return;
    }
    
    const name = tagItem.getAttribute('district-tag-name');
    const lat = parseFloat(tagItem.getAttribute('district-tag-lattitude'));
    const lng = parseFloat(tagItem.getAttribute('district-tag-longitude'));
    
    if (!name || isNaN(lat) || isNaN(lng)) {
      console.log(`Invalid district tag data: ${name}, ${lat}, ${lng}`);
      return;
    }
    
    console.log(`Adding district tag: ${name} at [${lng}, ${lat}]`);
    
    const districtFeature = {
      type: "Feature",
      geometry: {type: "Point", coordinates: [lng, lat]},
      properties: {
        name: name,
        id: `district-tag-${name.toLowerCase().replace(/\s+/g, '-')}`,
        type: 'district',
        source: 'tag'
      }
    };
    
    state.allDistrictFeatures.push(districtFeature);
  });
  
  state.flags.districtTagsLoaded = true;
  console.log(`District tags loaded. Total district features: ${state.allDistrictFeatures.length}`);
  
  addNativeDistrictMarkers();
  timerManager.debounce(updateMarkerColors, 500, 'update-colors');
}

// Tag monitoring with optimized logic
const monitorTags = () => {
  const checkTags = () => toggleShowWhenFilteredElements($id('hiddentagparent') !== null);
  checkTags();
  
  const tagParent = $id('tagparent');
  if (tagParent) {
    new MutationObserver(() => timerManager.debounce(checkTags, 50, 'tag-check')).observe(tagParent, {childList: true, subtree: true});
  } else {
    setInterval(checkTags, 1000);
  }
};

// Update marker colors for existing layers
function updateMarkerColors() {
  console.log('Updating marker colors...');
  
  if (map.getLayer('locality-clusters')) {
    map.setPaintProperty('locality-clusters', 'text-halo-color', '#739005');
    console.log('Updated locality cluster colors to green');
  }
  if (map.getLayer('locality-points')) {
    map.setPaintProperty('locality-points', 'text-halo-color', '#739005');
    console.log('Updated locality point colors to green');
  }
  
  if (map.getLayer('district-points')) {
    map.setPaintProperty('district-points', 'text-halo-color', '#f50000');
    console.log('Updated district marker colors to red');
  }
}

// Optimized initialization
function init() {
  console.log('Initializing map...');
  getLocationData();
  addNativeMarkers();
  setupEvents();
  
  timerManager.debounce(() => {
    updateMarkerColors();
  }, 1500, 'initial-colors');
  
  const handleMapEvents = () => {
    timerManager.clear('zoom-handler');
    timerManager.debounce(() => {
      // Future: Add any zoom-based logic here
    }, 10, 'zoom-handler');
  };
  
  map.on('moveend', handleMapEvents);
  map.on('zoomend', handleMapEvents);
  
  // Staggered setup with optimized timing
  [1000, 3000].forEach(delay => timerManager.debounce(setupDropdownListeners, delay, `dropdown-${delay}`));
  [500, 1500, 3000].forEach(delay => timerManager.debounce(setupTabSwitcher, delay, `tab-${delay}`));
  
  state.flags.mapInitialized = true;
  
  // Hide loading screen as soon as core map functionality is ready
  timerManager.debounce(() => {
    const loadingScreen = document.getElementById('loading-map-screen');
    if (loadingScreen) {
      loadingScreen.style.display = 'none';
      console.log('Loading screen hidden - core map ready');
    }
  }, 1000, 'hide-loading');
  
  timerManager.debounce(() => {
    if (state.flags.isInitialLoad) {
      const hasFiltering = checkMapMarkersFiltering();
      if (hasFiltering) {
        applyFilterToMarkers();
      }
      state.flags.isInitialLoad = false;
    }
  }, 500, 'initial-filter');
}

// Control positioning and event setup
timerManager.debounce(() => {
  const ctrl = $1('.mapboxgl-ctrl-top-right');
  if (ctrl) utils.setStyles(ctrl, {top: '4rem', right: '0.5rem', zIndex: '10'});
}, 500, 'ctrl-position');

// Optimized event handlers
map.on("load", () => {
  try {
    console.log('Map loaded, starting initialization...');
    init();
    
    // Load secondary content in parallel
    timerManager.debounce(() => {
      console.log('Loading area overlays and simplified boundaries in parallel...');
      Promise.all([
        loadAreaOverlays(),
        loadSimplifiedBoundaries()
      ]).then(() => {
        console.log('Secondary content loading completed');
      }).catch(error => {
        console.error('Error loading secondary content:', error);
      });
    }, 500, 'secondary-load');
    
    timerManager.debounce(loadDistrictTags, 2000, 'district-tags');
    timerManager.debounce(() => {
      console.log('Setting up area key controls...');
      setupAreaKeyControls();
    }, 6000, 'area-controls');
    
  } catch (error) {
    console.error('Error during map initialization:', error);
    timerManager.debounce(() => {
      const loadingScreen = document.getElementById('loading-map-screen');
      if (loadingScreen) {
        loadingScreen.style.display = 'none';
        console.log('Loading screen hidden due to error');
      }
    }, 2000, 'error-hide-loading');
  }
});

document.addEventListener('DOMContentLoaded', () => {
  setupSidebars();
  setupTabSwitcher();
});

window.addEventListener('load', () => {
  setupSidebars();
  setupTabSwitcher();
  timerManager.debounce(() => {
    if (!state.allLocalityFeatures.length && map.loaded()) {
      try { init(); } catch (error) { console.error('Init error:', error); }
    }
  }, 200, 'window-load-init');
  
  // Retry mechanisms for district tags and area controls
  if (!state.flags.districtTagsLoaded) {
    [3000, 5000].forEach(delay => timerManager.debounce(() => {
      if (!state.flags.districtTagsLoaded) loadDistrictTags();
    }, delay, `retry-tags-${delay}`));
  }
  
  if (!state.flags.areaControlsSetup) {
    [8000, 10000].forEach(delay => timerManager.debounce(() => {
      if (!state.flags.areaControlsSetup) setupAreaKeyControls();
    }, delay, `retry-area-${delay}`));
  }
  
  // Auto-trigger reframing with optimized logic
  const checkAndReframe = () => {
    if (map.loaded() && !map.isMoving() && checkMapMarkersFiltering()) {
      applyFilterToMarkers();
      return true;
    }
    return false;
  };
  
  if (!checkAndReframe()) {
    timerManager.debounce(() => !checkAndReframe() && timerManager.debounce(checkAndReframe, 1000, 'reframe-retry'), 500, 'reframe-check');
  }
});

timerManager.debounce(monitorTags, 1000, 'monitor-tags');

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  timerManager.clearAll();
  domCache.clear();
});
