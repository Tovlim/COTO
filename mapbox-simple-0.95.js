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

// Initialize Mapbox
const lang = navigator.language.split('-')[0];
mapboxgl.accessToken = "pk.eyJ1Ijoibml0YWloYXJkeSIsImEiOiJjbWE0d2F2cHcwYTYxMnFzNmJtanFhZzltIn0.diooYfncR44nF0Y8E1jvbw";
if (['ar', 'he'].includes(lang)) mapboxgl.setRTLTextPlugin("https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.3.0/mapbox-gl-rtl-text.js");

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/nitaihardy/cmbus40jb016n01s5dui12tre",
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

// Global state - consolidated
const state = {
  locationData: {type: "FeatureCollection", features: []},
  allLocalityFeatures: [],
  allDistrictFeatures: [],
  timers: {filter: null, zoom: null},
  lastClickedMarker: null,
  lastClickTime: 0,
  markerInteractionLock: false,
  highlightedBoundary: null, // Track currently highlighted boundary
  flags: {
    isInitialLoad: true,
    mapInitialized: false,
    forceFilteredReframe: false,
    isRefreshButtonAction: false,
    dropdownListenersSetup: false,
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
const $ = sel => document.querySelectorAll(sel);
const $1 = sel => document.querySelector(sel);
const $id = id => document.getElementById(id);

const utils = {
  triggerEvent: (el, events) => events.forEach(e => el.dispatchEvent(new Event(e, {bubbles: true}))),
  setStyles: (el, styles) => Object.assign(el.style, styles),
  debounce: (fn, delay) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },
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
  // Remove any existing highlight first
  removeBoundaryHighlight();
  
  const boundaryFillId = `${districtName.toLowerCase().replace(/\s+/g, '-')}-fill`;
  const boundaryBorderId = `${districtName.toLowerCase().replace(/\s+/g, '-')}-border`;
  
  if (map.getLayer(boundaryFillId) && map.getLayer(boundaryBorderId)) {
    // Apply subtle red highlight (using new district marker color but more subtle)
    map.setPaintProperty(boundaryFillId, 'fill-color', '#f50000'); // Updated to new district color
    map.setPaintProperty(boundaryFillId, 'fill-opacity', 0.25); // Keep same opacity
    map.setPaintProperty(boundaryBorderId, 'line-color', '#f50000'); // Updated to new district color
    map.setPaintProperty(boundaryBorderId, 'line-opacity', 0.6); // Keep same opacity
    
    // Track the highlighted boundary
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
      // Reset to default colors
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
  // Find all district and locality checkboxes
  const districtCheckboxes = $('[checkbox-filter="district"] input[fs-list-value]');
  const localityCheckboxes = $('[checkbox-filter="locality"] input[fs-list-value]');
  
  // Clear ALL district checkboxes first
  districtCheckboxes.forEach(checkbox => {
    if (checkbox.checked) {
      checkbox.checked = false;
      utils.triggerEvent(checkbox, ['change', 'input']);
      
      // Trigger form events for each cleared checkbox
      const form = checkbox.closest('form');
      if (form) {
        form.dispatchEvent(new Event('change', {bubbles: true}));
        form.dispatchEvent(new Event('input', {bubbles: true}));
      }
    }
  });
  
  // Clear ALL locality checkboxes first
  localityCheckboxes.forEach(checkbox => {
    if (checkbox.checked) {
      checkbox.checked = false;
      utils.triggerEvent(checkbox, ['change', 'input']);
      
      // Trigger form events for each cleared checkbox
      const form = checkbox.closest('form');
      if (form) {
        form.dispatchEvent(new Event('change', {bubbles: true}));
        form.dispatchEvent(new Event('input', {bubbles: true}));
      }
    }
  });
  
  // Find and check the matching district checkbox
  const targetCheckbox = Array.from(districtCheckboxes).find(checkbox => 
    checkbox.getAttribute('fs-list-value') === districtName
  );
  
  if (targetCheckbox) {
    targetCheckbox.checked = true;
    utils.triggerEvent(targetCheckbox, ['change', 'input']);
    
    // Trigger form events to ensure Finsweet registers the change
    const form = targetCheckbox.closest('form');
    if (form) {
      form.dispatchEvent(new Event('change', {bubbles: true}));
      form.dispatchEvent(new Event('input', {bubbles: true}));
    }
  }
}

// Select locality checkbox for filtering (triggered by map markers)
function selectLocalityCheckbox(localityName) {
  // Find all district and locality checkboxes
  const districtCheckboxes = $('[checkbox-filter="district"] input[fs-list-value]');
  const localityCheckboxes = $('[checkbox-filter="locality"] input[fs-list-value]');
  
  // Clear ALL district checkboxes first
  districtCheckboxes.forEach(checkbox => {
    if (checkbox.checked) {
      checkbox.checked = false;
      utils.triggerEvent(checkbox, ['change', 'input']);
      
      // Trigger form events for each cleared checkbox
      const form = checkbox.closest('form');
      if (form) {
        form.dispatchEvent(new Event('change', {bubbles: true}));
        form.dispatchEvent(new Event('input', {bubbles: true}));
      }
    }
  });
  
  // Clear ALL locality checkboxes first
  localityCheckboxes.forEach(checkbox => {
    if (checkbox.checked) {
      checkbox.checked = false;
      utils.triggerEvent(checkbox, ['change', 'input']);
      
      // Trigger form events for each cleared checkbox
      const form = checkbox.closest('form');
      if (form) {
        form.dispatchEvent(new Event('change', {bubbles: true}));
        form.dispatchEvent(new Event('input', {bubbles: true}));
      }
    }
  });
  
  // Find and check the matching locality checkbox
  const targetCheckbox = Array.from(localityCheckboxes).find(checkbox => 
    checkbox.getAttribute('fs-list-value') === localityName
  );
  
  if (targetCheckbox) {
    targetCheckbox.checked = true;
    utils.triggerEvent(targetCheckbox, ['change', 'input']);
    
    // Trigger form events to ensure Finsweet registers the change
    const form = targetCheckbox.closest('form');
    if (form) {
      form.dispatchEvent(new Event('change', {bubbles: true}));
      form.dispatchEvent(new Event('input', {bubbles: true}));
    }
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
  
  // Store all locality features for reset functionality
  state.allLocalityFeatures = [...state.locationData.features];
}

// Add native Mapbox markers using Symbol layers
function addNativeMarkers() {
  if (!state.locationData.features.length) return;
  
  // Add localities source and layers
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
    
    // Clustered points layer - make sure it's on top
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
        'text-halo-color': '#2563eb',
        'text-halo-width': 2
      }
    }); // Add to top of all layers
    
    // Individual locality points layer - also on top
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
        'text-halo-color': '#2563eb',
        'text-halo-width': 2,
        'text-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          isMobile ? 7.5 : 8.5, 0,
          isMobile ? 8.5 : 9.5, 1
        ]
      }
    }); // Add to top of all layers
  }
  
  setupNativeMarkerClicks();
}

// Add native district markers using Symbol layers
function addNativeDistrictMarkers() {
  if (!state.allDistrictFeatures.length) return;
  
  console.log(`Adding ${state.allDistrictFeatures.length} district markers`);
  
  // Add districts source and layer
  if (map.getSource('districts-source')) {
    map.getSource('districts-source').setData({
      type: "FeatureCollection",
      features: state.allDistrictFeatures
    });
    
    // Update existing layer colors to correct red
    if (map.getLayer('district-points')) {
      map.setPaintProperty('district-points', 'text-halo-color', '#f50000');
    }
  } else {
    map.addSource('districts-source', {
      type: 'geojson',
      data: {
        type: "FeatureCollection",
        features: state.allDistrictFeatures
      }
    });
    
    // District name labels layer - add on top of everything with CORRECT RED COLOR
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
        'text-halo-color': '#f50000', // RED from start - no color flash
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
  }
  
  setupDistrictMarkerClicks();
}

// Setup click handlers for native markers
function setupNativeMarkerClicks() {
  // Handle locality clicks
  map.on('click', 'locality-points', (e) => {
    const feature = e.features[0];
    const locality = feature.properties.name;
    
    // Prevent rapid clicks
    const currentTime = Date.now();
    const markerKey = `locality-${locality}`;
    if (state.lastClickedMarker === markerKey && currentTime - state.lastClickTime < 1000) {
      return;
    }
    
    // Set global lock to prevent filter interference
    state.markerInteractionLock = true;
    state.lastClickedMarker = markerKey;
    state.lastClickTime = currentTime;
    
    window.isMarkerClick = true;
    
    // Remove any boundary highlight when clicking localities
    removeBoundaryHighlight();
    
    // Use checkbox selection for localities
    selectLocalityCheckbox(locality);
    
    // Show filtered elements and sidebar
    toggleShowWhenFilteredElements(true);
    toggleSidebar('Left', true);
    
    // Clear locks after all events have processed
    setTimeout(() => {
      window.isMarkerClick = false;
      state.markerInteractionLock = false;
    }, 1500);
  });
  
  // Handle cluster clicks
  map.on('click', 'locality-clusters', (e) => {
    // Remove any boundary highlight when clicking clusters
    removeBoundaryHighlight();
    
    const features = map.queryRenderedFeatures(e.point, {
      layers: ['locality-clusters']
    });
    
    // Use more aggressive zoom like in original script
    map.flyTo({
      center: features[0].geometry.coordinates,
      zoom: map.getZoom() + 2.5, // More dramatic zoom increase
      duration: 800 // Smooth animation
    });
  });
  
  // Change cursor on hover
  map.on('mouseenter', 'locality-clusters', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  
  map.on('mouseleave', 'locality-clusters', () => {
    map.getCanvas().style.cursor = '';
  });
  
  map.on('mouseenter', 'locality-points', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  
  map.on('mouseleave', 'locality-points', () => {
    map.getCanvas().style.cursor = '';
  });
}

// Setup click handlers for district markers
function setupDistrictMarkerClicks() {
  // Handle district clicks
  map.on('click', 'district-points', (e) => {
    const feature = e.features[0];
    const districtName = feature.properties.name;
    const districtSource = feature.properties.source; // 'boundary' or 'tag'
    
    // Prevent rapid clicks
    const currentTime = Date.now();
    const markerKey = `district-${districtName}`;
    if (state.lastClickedMarker === markerKey && currentTime - state.lastClickTime < 1000) {
      return;
    }
    
    // Set global lock to prevent filter interference
    state.markerInteractionLock = true;
    state.lastClickedMarker = markerKey;
    state.lastClickTime = currentTime;
    
    window.isMarkerClick = true;
    
    // Always use checkbox selection for both types
    selectDistrictCheckbox(districtName);
    
    // Show filtered elements and sidebar
    toggleShowWhenFilteredElements(true);
    toggleSidebar('Left', true);
    
    if (districtSource === 'boundary') {
      // District WITH boundary - reframe to boundary extents and highlight
      console.log(`District ${districtName} has boundary, reframing to boundary extents and highlighting`);
      
      // Highlight the boundary with subtle red
      highlightBoundary(districtName);
      
      // Get the boundary source data and reframe to its extents
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
        // Remove highlight since we're falling back
        removeBoundaryHighlight();
        // Fallback to dropdown if boundary source not available
        selectDistrictInDropdown(districtName);
        setTimeout(() => {
          state.flags.forceFilteredReframe = true;
          state.flags.isRefreshButtonAction = true;
          applyFilterToMarkers();
          setTimeout(() => {
            state.flags.forceFilteredReframe = false;
            state.flags.isRefreshButtonAction = false;
          }, 1000);
        }, 200);
      }
    } else {
      // District WITHOUT boundary (tag-based) - remove any existing highlight and use dropdown
      console.log(`District ${districtName} has no boundary, using dropdown selection`);
      
      // Remove any existing boundary highlight
      removeBoundaryHighlight();
      
      // Select district in dropdown and trigger map reframing
      selectDistrictInDropdown(districtName);
      
      // Trigger map reframing
      setTimeout(() => {
        state.flags.forceFilteredReframe = true;
        state.flags.isRefreshButtonAction = true;
        applyFilterToMarkers();
        setTimeout(() => {
          state.flags.forceFilteredReframe = false;
          state.flags.isRefreshButtonAction = false;
        }, 1000);
      }, 200);
    }
    
    // Clear locks after all processing is complete
    setTimeout(() => {
      window.isMarkerClick = false;
      state.markerInteractionLock = false;
    }, 1500);
  });
  
  // Change cursor on hover
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
    // Create coordinates from filtered data for reframing ONLY
    for (let i = 0; i < filteredLat.length; i++) {
      const lat = parseFloat(filteredLat[i]?.textContent.trim());
      const lon = parseFloat(filteredLon[i]?.textContent.trim());
      
      if (!isNaN(lat) && !isNaN(lon)) {
        visibleCoordinates.push([lon, lat]);
      }
    }
    
    // DO NOT update the source data - keep all markers visible
    // The localities source should always show all features
    if (map.getSource('localities-source')) {
      map.getSource('localities-source').setData({
        type: "FeatureCollection",
        features: state.allLocalityFeatures // Always show ALL markers
      });
    }
  } else {
    // No filtering - show all features and use all coordinates
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
    // Only use filtered coordinates for map reframing, but keep all markers visible
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

const handleFilterUpdate = utils.debounce(() => {
  if (window.isLinkClick || window.isMarkerClick || state.markerInteractionLock) return;
  state.flags.isRefreshButtonAction = true;
  applyFilterToMarkers();
  setTimeout(() => state.flags.isRefreshButtonAction = false, 1000);
}, 300);

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
    if (btn) {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', e => {e.preventDefault(); e.stopPropagation(); action();});
    }
  });
  
  // Optimized sidebar controls
  const setupSidebarControls = (selector, sidebarSide, eventType = 'click') => {
    $(selector).forEach(element => {
      const newElement = element.cloneNode(true);
      element.parentNode?.replaceChild(newElement, element);
      
      const handler = () => {
        const sidebar = $id(`${sidebarSide}Sidebar`);
        if (!sidebar) return;
        
        const openRightSidebar = newElement.getAttribute('open-right-sidebar');
        if (openRightSidebar === 'open-only') {
          toggleSidebar(sidebarSide, true);
        } else {
          toggleSidebar(sidebarSide, !sidebar.classList.contains('is-show'));
        }
        
        const groupName = newElement.getAttribute('open-tab');
        if (groupName) {
          setTimeout(() => $1(`[opened-tab="${groupName}"]`)?.click(), 50);
        }
      };
      
      if (eventType === 'change' && (newElement.type === 'radio' || newElement.type === 'checkbox')) {
        newElement.addEventListener('change', () => newElement.checked && handler());
      } else {
        newElement.addEventListener(eventType, e => {e.stopPropagation(); handler();});
      }
    });
  };
  
  setupSidebarControls('[open-right-sidebar="true"], [open-right-sidebar="open-only"]', 'Right');
  setupSidebarControls('.OpenLeftSidebar, [OpenLeftSidebar], [openleftsidebar]', 'Left', 'change');
  
  setupTabSwitcher();
  setupAreaKeyControls();
}

// Optimized sidebar setup with performance improvements
function setupSidebars() {
  let zIndex = 1000;
  
  const setupSidebarElement = (side) => {
    const sidebar = $id(`${side}Sidebar`);
    const tab = $id(`${side}SideTab`);
    const close = $id(`${side}SidebarClose`);
    
    if (!sidebar || !tab || !close) return false;
    if (tab.dataset.setupComplete === 'true' && close.dataset.setupComplete === 'true') return true;
    
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
    
    if (!sidebar.dataset.clickSetup) {
      sidebar.addEventListener('click', () => {
        if (sidebar.classList.contains('is-show')) bringToFront();
      });
      sidebar.dataset.clickSetup = 'true';
    }
    
    if (tab.dataset.setupComplete !== 'true') {
      tab.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        toggle(!sidebar.classList.contains('is-show'));
      });
      tab.dataset.setupComplete = 'true';
    }
    
    if (close.dataset.setupComplete !== 'true') {
      close.addEventListener('click', e => {
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
    const rightReady = setupSidebarElement('Right');
    
    if (leftReady && rightReady) {
      setupInitialMargins();
      setTimeout(setupControls, 100);
      return;
    }
    
    if (attempt < maxAttempts) {
      const delay = [100, 300, 500, 1000][attempt - 1] || 1000;
      setTimeout(() => attemptSetup(attempt + 1, maxAttempts), delay);
    } else {
      setupInitialMargins();
      setTimeout(setupControls, 100);
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
      // Only open sidebar on devices wider than 478px
      if (window.innerWidth > 478) {
        setTimeout(() => toggleSidebar('Left', true), 100);
      }
    }},
    {selector: 'select, [fs-cmsfilter-element="select"]', events: ['change'], handler: () => setTimeout(handleFilterUpdate, 100)},
    {selector: '[fs-cmsfilter-element="filters"] input, [fs-cmsfilter-element="filters"] select', events: ['change'], handler: () => setTimeout(handleFilterUpdate, 100)}
  ];
  
  eventHandlers.forEach(({selector, events, handler}) => {
    $(selector).forEach(element => {
      events.forEach(event => {
        if (event === 'input' && ['text', 'search'].includes(element.type)) {
          element.addEventListener(event, handler);
        } else if (event !== 'input' || element.type !== 'text') {
          element.addEventListener(event, handler);
        }
      });
    });
  });
  
  // Consolidated apply-map-filter setup
  $('[apply-map-filter="true"], #refreshDiv, #refresh-on-enter, .filterrefresh, #filter-button').forEach(element => {
    const newElement = element.cloneNode(true);
    if (element.parentNode) element.parentNode.replaceChild(newElement, element);
    
    const events = newElement.id === 'refresh-on-enter' || newElement.getAttribute('apply-map-filter') === 'true' 
      ? ['click', 'keypress', 'input'] : ['click'];
    
    events.forEach(eventType => {
      newElement.addEventListener(eventType, (e) => {
        if (eventType === 'keypress' && e.key !== 'Enter') return;
        if (window.isMarkerClick) return;
        
        e.preventDefault();
        
        state.flags.forceFilteredReframe = true;
        state.flags.isRefreshButtonAction = true;
        
        const delay = eventType === 'input' ? 300 : 100;
        
        setTimeout(() => {
          applyFilterToMarkers();
          setTimeout(() => {
            state.flags.forceFilteredReframe = false;
            state.flags.isRefreshButtonAction = false;
          }, 1000);
        }, delay);
      });
    });
  });
  
  // Global event listeners
  ['fs-cmsfilter-filtered', 'fs-cmsfilter-pagination-page-changed'].forEach(event => {
    document.addEventListener(event, (e) => {
      // Skip if this is a marker interaction or if it's not related to Map filtering
      if (window.isMarkerClick || state.markerInteractionLock) return;
      handleFilterUpdate();
    });
  });
  
  // Firefox form handling
  if (navigator.userAgent.toLowerCase().includes('firefox')) {
    $('form').forEach(form => {
      const hasFilterElements = form.querySelector('[fs-cmsfilter-element]') !== null;
      const isNearMap = $id('map') && (form.contains($id('map')) || $id('map').contains(form) || form.parentElement === $id('map').parentElement);
      
      if (hasFilterElements || isNearMap) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          state.flags.forceFilteredReframe = true;
          state.flags.isRefreshButtonAction = true;
          
          setTimeout(() => {
            applyFilterToMarkers();
            setTimeout(() => {
              state.flags.forceFilteredReframe = false;
              state.flags.isRefreshButtonAction = false;
            }, 1000);
          }, 100);
          
          return false;
        }, true);
      }
    });
  }
  
  // Link click handlers
  $('a:not(.filterrefresh):not([fs-cmsfilter-element])').forEach(link => {
    link.onclick = () => {
      if (!link.closest('[fs-cmsfilter-element]') && !link.classList.contains('w-pagination-next') && !link.classList.contains('w-pagination-previous')) {
        window.isLinkClick = true;
        setTimeout(() => window.isLinkClick = false, 500);
      }
    };
  });
}

// Optimized dropdown listeners
function setupDropdownListeners() {
  if (state.flags.dropdownListenersSetup) return;
  state.flags.dropdownListenersSetup = true;
  
  $('[districtselect]').forEach(element => {
    element.addEventListener('click', (e) => {
      if (window.isMarkerClick) return;
      
      setTimeout(() => {
        state.flags.forceFilteredReframe = true;
        state.flags.isRefreshButtonAction = true;
        
        setTimeout(() => {
          applyFilterToMarkers();
          setTimeout(() => {
            state.flags.forceFilteredReframe = false;
            state.flags.isRefreshButtonAction = false;
          }, 1000);
        }, 100);
      }, 50);
    });
  });
  
  const selectField5 = $id('select-field-5');
  if (selectField5) {
    selectField5.addEventListener('change', (e) => {
      if (window.isMarkerClick) return;
      
      setTimeout(() => {
        state.flags.forceFilteredReframe = true;
        state.flags.isRefreshButtonAction = true;
        
        setTimeout(() => {
          applyFilterToMarkers();
          setTimeout(() => {
            state.flags.forceFilteredReframe = false;
            state.flags.isRefreshButtonAction = false;
          }, 1000);
        }, 100);
      }, 50);
    });
  }
}

// Load area overlays with improved error handling
function loadAreaOverlays() {
  console.log('loadAreaOverlays() called');
  
  const areas = [
    {name: 'Area A', url: 'https://raw.githubusercontent.com/btselem/map-data/master/s10/area_a.geojson', sourceId: 'area-a-source', layerId: 'area-a-layer', color: '#98b074', opacity: 0.5},
    {name: 'Area B', url: 'https://raw.githubusercontent.com/btselem/map-data/master/s10/area_b.geojson', sourceId: 'area-b-source', layerId: 'area-b-layer', color: '#a84b4b', opacity: 0.5},
    {name: 'Area C', url: 'https://raw.githubusercontent.com/btselem/map-data/master/s10/area_c.geojson', sourceId: 'area-c-source', layerId: 'area-c-layer', color: '#e99797', opacity: 0.5}
  ];
  
  const addAreaToMap = area => {
    console.log(`Starting fetch for ${area.name} from ${area.url}`);
    fetch(area.url)
      .then(response => {
        console.log(`${area.name} fetch response:`, response.status, response.ok);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(geojsonData => {
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
        }, map.getLayer('locality-clusters') ? 'locality-clusters' : undefined); // Add before marker layers
        
        console.log(`${area.name} layer added successfully. Visibility:`, map.getLayoutProperty(area.layerId, 'visibility'));
        console.log(`Current map layers:`, map.getStyle().layers.map(l => l.id));
      })
      .catch(error => {
        console.error(`Error loading ${area.name}:`, error);
      });
  };
  
  areas.forEach(addAreaToMap);
}

// Area key controls with improved functionality
function setupAreaKeyControls() {
  // Prevent multiple executions
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
    
    // Check if layer exists
    if (!map.getLayer(control.layerId)) {
      console.log(`Layer ${control.layerId} not found in map yet`);
      return;
    }
    
    // Set initial state - unchecked means area is visible
    checkbox.checked = false;
    
    // Add our event listener WITHOUT removing existing ones
    // Use a unique identifier to prevent duplicate listeners from our script
    if (!checkbox.dataset.mapboxListenerAdded) {
      const mapboxChangeHandler = () => {
        console.log(`Area control ${control.keyId} changed to:`, checkbox.checked);
        
        if (!map.getLayer(control.layerId)) {
          console.log(`Layer ${control.layerId} not found in map`);
          return;
        }
        
        // Checkbox logic: checked = hidden, unchecked = visible
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
    
    // Find the wrapper element for hover effects
    const wrapperDiv = $id(control.wrapId);
    
    if (wrapperDiv) {
      console.log(`Setting up hover effects for: ${control.wrapId}`);
      
      // Add hover effects WITHOUT removing existing ones
      if (!wrapperDiv.dataset.mapboxHoverAdded) {
        const mouseEnterHandler = () => {
          if (!map.getLayer(control.layerId)) return;
          // Removed: map.moveLayer() to keep z-axis static for all GeoJSON layers
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

// Load boundaries with improved error handling and district marker collection
function loadBoundaries() {
  const districts = [
    'Jerusalem', 'Hebron', 'Tulkarm', 'Tubas', 'Salfit', 'Ramallah', 
    'Nablus', 'Jericho', 'Jenin', 'Bethlehem', 'Qalqilya'
  ];
  
  // Additional districts with custom URLs and names
  const customDistricts = [
    {name: 'East Jerusalem', url: 'https://raw.githubusercontent.com/btselem/map-data/master/s0/east_jerusalem.json'},
    {name: 'Deir Al-Balah', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Deir%20Al-Balah.geojson'},
    {name: 'Rafah', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Rafah.geojson'},
    {name: 'North Gaza', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/North%20Gaza.geojson'},
    {name: 'Khan Younis', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Khan%20Younis.geojson'},
    {name: 'Gaza', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Gaza.geojson'}
  ];
  
  let loadedCount = 0;
  const totalCount = districts.length + customDistricts.length;
  
  const addBoundaryToMap = (name, customUrl = null) => {
    const boundary = {
      name,
      url: customUrl || `https://raw.githubusercontent.com/Tovlim/COTO/main/${name}.geojson`,
      sourceId: `${name.toLowerCase().replace(/\s+/g, '-')}-boundary`,
      fillId: `${name.toLowerCase().replace(/\s+/g, '-')}-fill`,
      borderId: `${name.toLowerCase().replace(/\s+/g, '-')}-border`
    };
    
    console.log(`Loading boundary: ${name} from ${boundary.url}`);
    
    fetch(boundary.url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(geojsonData => {
        console.log(`${name} boundary data loaded successfully`, geojsonData);
        
        // Remove existing layers/sources if they exist
        try {
          if (map.getLayer(boundary.borderId)) {
            map.removeLayer(boundary.borderId);
          }
          if (map.getLayer(boundary.fillId)) {
            map.removeLayer(boundary.fillId);
          }
          if (map.getSource(boundary.sourceId)) {
            map.removeSource(boundary.sourceId);
          }
        } catch (e) {
          console.log(`Cleanup error for ${name}:`, e);
        }
        
        // Add source and layers
        map.addSource(boundary.sourceId, {
          type: 'geojson',
          data: geojsonData
        });
        
        // Add fill layer first (lower layer)
        map.addLayer({
          id: boundary.fillId,
          type: 'fill',
          source: boundary.sourceId,
          layout: {
            'visibility': 'visible'
          },
          paint: {
            'fill-color': '#1a1b1e',
            'fill-opacity': 0.4
          }
        }, 'locality-clusters'); // Add before locality layers
        
        // Add border layer on top of fill
        map.addLayer({
          id: boundary.borderId,
          type: 'line',
          source: boundary.sourceId,
          layout: {
            'visibility': 'visible'
          },
          paint: {
            'line-color': '#1a1b1e',
            'line-width': 2,
            'line-opacity': 1
          }
        }, 'locality-clusters'); // Add before locality layers
        
        console.log(`${name} boundary layers added to map with visibility:`, 
          map.getLayoutProperty(boundary.fillId, 'visibility'),
          map.getLayoutProperty(boundary.borderId, 'visibility')
        );
        
        // Calculate centroid and add to district features
        if (geojsonData.features && geojsonData.features.length > 0) {
          const centroid = utils.calculateCentroid(geojsonData.features[0].geometry.coordinates);
          
          const districtFeature = {
            type: "Feature",
            geometry: {type: "Point", coordinates: centroid},
            properties: {
              name: name,
              id: `district-${name.toLowerCase().replace(/\s+/g, '-')}`,
              type: 'district',
              source: 'boundary'
            }
          };
          
          state.allDistrictFeatures.push(districtFeature);
        }
        
        // Boundary interaction handlers
        map.on('click', boundary.fillId, () => {
          const bounds = new mapboxgl.LngLatBounds();
          geojsonData.features.forEach(feature => {
            const addCoords = coords => {
              if (Array.isArray(coords) && coords.length > 0) {
                if (typeof coords[0] === 'number') bounds.extend(coords);
                else coords.forEach(addCoords);
              }
            };
            addCoords(feature.geometry.coordinates);
          });
          map.fitBounds(bounds, {padding: 50, duration: 1000});
        });
        
        map.on('mouseenter', boundary.fillId, () => {
          map.getCanvas().style.cursor = 'pointer';
          map.setPaintProperty(boundary.fillId, 'fill-color', '#e93119');
          map.setPaintProperty(boundary.borderId, 'line-color', '#e93119');
          // Removed: map.moveLayer() calls to prevent z-axis movement
        });
        
        map.on('mouseleave', boundary.fillId, () => {
          map.getCanvas().style.cursor = '';
          map.setPaintProperty(boundary.fillId, 'fill-color', '#1a1b1e');
          map.setPaintProperty(boundary.borderId, 'line-color', '#1a1b1e');
        });
        
        // Increment loaded count and update district markers when all are loaded
        loadedCount++;
        if (loadedCount === totalCount) {
          console.log('All boundaries loaded, updating district markers');
          addNativeDistrictMarkers();
        }
      })
      .catch(error => {
        console.error(`Error loading ${name} boundary:`, error);
        loadedCount++; // Still increment to prevent hanging
        if (loadedCount === totalCount) {
          console.log('All boundary attempts completed, updating district markers');
          addNativeDistrictMarkers();
        }
      });
  };
  
  const loadAllBoundaries = () => {
    console.log('Starting to load all boundaries');
    // Reset district features and loaded count
    state.allDistrictFeatures = [];
    loadedCount = 0;
    
    // Load standard districts
    districts.forEach(name => addBoundaryToMap(name));
    
    // Load custom districts with specific URLs
    customDistricts.forEach(district => addBoundaryToMap(district.name, district.url));
  };
  
  // Ensure we load after the map style is ready
  if (map.loaded() && map.isStyleLoaded()) {
    loadAllBoundaries();
  } else {
    map.on('style.load', () => {
      console.log('Style loaded, loading boundaries...');
      loadAllBoundaries();
    });
  }
}

// Load simplified district boundaries (visual only, no interactions)
function loadSimplifiedBoundaries() {
  console.log('loadSimplifiedBoundaries() called');
  
  const districts = [
    'Jerusalem', 'Hebron', 'Tulkarm', 'Tubas', 'Salfit', 'Ramallah', 
    'Nablus', 'Jericho', 'Jenin', 'Bethlehem', 'Qalqilya'
  ];
  
  // Additional districts with custom URLs and names
  const customDistricts = [
    {name: 'East Jerusalem', url: 'https://raw.githubusercontent.com/btselem/map-data/master/s0/east_jerusalem.json'},
    {name: 'Deir Al-Balah', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Deir%20Al-Balah.geojson'},
    {name: 'Rafah', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Rafah.geojson'},
    {name: 'North Gaza', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/North%20Gaza.geojson'},
    {name: 'Khan Younis', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Khan%20Younis.geojson'},
    {name: 'Gaza', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Gaza.geojson'}
  ];
  
  let loadedCount = 0;
  const totalCount = districts.length + customDistricts.length;
  console.log(`Starting to load ${totalCount} simplified boundaries`);
  
  const addSimpleBoundaryToMap = (name, customUrl = null) => {
    const boundary = {
      name,
      url: customUrl || `https://raw.githubusercontent.com/Tovlim/COTO/main/${name}.geojson`,
      sourceId: `${name.toLowerCase().replace(/\s+/g, '-')}-boundary`,
      fillId: `${name.toLowerCase().replace(/\s+/g, '-')}-fill`,
      borderId: `${name.toLowerCase().replace(/\s+/g, '-')}-border`
    };
    
    console.log(`Loading simplified boundary: ${name}`);
    
    fetch(boundary.url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(geojsonData => {
        console.log(`${name} boundary loaded successfully`);
        
        // Remove existing layers/sources if they exist
        try {
          if (map.getLayer(boundary.borderId)) {
            map.removeLayer(boundary.borderId);
          }
          if (map.getLayer(boundary.fillId)) {
            map.removeLayer(boundary.fillId);
          }
          if (map.getSource(boundary.sourceId)) {
            map.removeSource(boundary.sourceId);
          }
        } catch (e) {
          console.log(`Cleanup error for ${name}:`, e);
        }
        
        // Add source
        map.addSource(boundary.sourceId, {
          type: 'geojson',
          data: geojsonData
        });
        
        // Add fill layer (visual only) - BELOW marker layers
        map.addLayer({
          id: boundary.fillId,
          type: 'fill',
          source: boundary.sourceId,
          layout: {
            'visibility': 'visible'
          },
          paint: {
            'fill-color': '#1a1b1e',
            'fill-opacity': 0.15
          }
        }, map.getLayer('locality-clusters') ? 'locality-clusters' : undefined);
        
        // Add border layer (visual only) - BELOW marker layers
        map.addLayer({
          id: boundary.borderId,
          type: 'line',
          source: boundary.sourceId,
          layout: {
            'visibility': 'visible'
          },
          paint: {
            'line-color': '#888888', // Lighter gray
            'line-width': 1,
            'line-opacity': 0.4 // More see-through
          }
        }, map.getLayer('locality-clusters') ? 'locality-clusters' : undefined);
        
        console.log(`${name} simplified boundary added`);
        
        // Calculate centroid and add district marker (like the old system)
        if (geojsonData.features && geojsonData.features.length > 0) {
          const existingFeature = state.allDistrictFeatures.find(f => f.properties.name === name && f.properties.source === 'boundary');
          if (!existingFeature) {
            const centroid = utils.calculateCentroid(geojsonData.features[0].geometry.coordinates);
            
            const districtFeature = {
              type: "Feature",
              geometry: {type: "Point", coordinates: centroid},
              properties: {
                name: name,
                id: `district-${name.toLowerCase().replace(/\s+/g, '-')}`,
                type: 'district',
                source: 'boundary'
              }
            };
            
            state.allDistrictFeatures.push(districtFeature);
            console.log(`Added district marker for ${name} at centroid:`, centroid);
          } else {
            console.log(`District marker for ${name} already exists, skipping`);
          }
        }
        
        // NO interaction handlers added to boundaries (they remain visual only)
        
        // Increment loaded count and update district markers when all are loaded
        loadedCount++;
        console.log(`Loaded ${loadedCount}/${totalCount} boundaries`);
        if (loadedCount === totalCount) {
          console.log('All simplified boundaries loaded, updating district markers');
          addNativeDistrictMarkers();
          // No need for delayed color update since layers start with correct colors
        }
        
      })
      .catch(error => {
        console.error(`Error loading ${name} boundary:`, error);
        loadedCount++; // Still increment to prevent hanging
        if (loadedCount === totalCount) {
          console.log('All boundary attempts completed, updating district markers');
          addNativeDistrictMarkers();
          // No need for delayed color update since layers start with correct colors
        }
      });
  };
  
  // Load all boundaries
  districts.forEach(name => addSimpleBoundaryToMap(name));
  customDistricts.forEach(district => addSimpleBoundaryToMap(district.name, district.url));
}

// Function to select district in dropdown
function selectDistrictInDropdown(districtName) {
  const selectField = $id('select-field-5');
  if (!selectField) return;
  
  // Set the select value first
  selectField.value = districtName;
  
  // Trigger change event on the select element
  utils.triggerEvent(selectField, ['change', 'input']);
  
  // Form events will automatically trigger Finsweet v2
  // No manual reload needed since filtering updates automatically
  const form = selectField.closest('form');
  if (form) {
    form.dispatchEvent(new Event('change', {bubbles: true}));
    form.dispatchEvent(new Event('input', {bubbles: true}));
  }
}

// Load district tags and add to district features
function loadDistrictTags() {
  // Prevent multiple executions
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
  
  // Mark as loaded to prevent duplicates
  state.flags.districtTagsLoaded = true;
  console.log(`District tags loaded. Total district features: ${state.allDistrictFeatures.length}`);
  
  // Update district markers after adding tag features
  addNativeDistrictMarkers();
  
  // No need for delayed color update since layers start with correct colors
}

// Tag monitoring with optimized logic
const monitorTags = () => {
  const checkTags = () => toggleShowWhenFilteredElements($id('hiddentagparent') !== null);
  checkTags();
  
  const tagParent = $id('tagparent');
  if (tagParent) {
    new MutationObserver(() => setTimeout(checkTags, 50)).observe(tagParent, {childList: true, subtree: true});
  } else {
    setInterval(checkTags, 1000);
  }
};

// Update marker colors for existing layers
function updateMarkerColors() {
  console.log('Updating marker colors...');
  
  // Update locality colors
  if (map.getLayer('locality-clusters')) {
    map.setPaintProperty('locality-clusters', 'text-halo-color', '#739005');
    console.log('Updated locality cluster colors to green');
  }
  if (map.getLayer('locality-points')) {
    map.setPaintProperty('locality-points', 'text-halo-color', '#739005');
    console.log('Updated locality point colors to green');
  }
  
  // Update district colors
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
  
  // No need for delayed color updates since layers start with correct colors
  
  const handleMapEvents = () => {
    clearTimeout(state.timers.zoom);
    state.timers.zoom = setTimeout(() => {
      // No need for handleZoomBasedVisibility since we're using native markers
    }, 10);
  };
  
  map.on('moveend', handleMapEvents);
  map.on('zoomend', handleMapEvents);
  
  // Staggered setup with optimized timing
  [1000, 3000].forEach(delay => setTimeout(setupDropdownListeners, delay));
  [500, 1500, 3000].forEach(delay => setTimeout(setupTabSwitcher, delay));
  
  state.flags.mapInitialized = true;
  
  // Hide loading screen as soon as core map functionality is ready
  setTimeout(() => {
    const loadingScreen = document.getElementById('loading-map-screen');
    if (loadingScreen) {
      loadingScreen.style.display = 'none';
      console.log('Loading screen hidden - core map ready');
    }
  }, 1000); // Much shorter delay - hide when locality markers are ready
  
  setTimeout(() => {
    if (state.flags.isInitialLoad) {
      const hasFiltering = checkMapMarkersFiltering();
      if (hasFiltering) {
        applyFilterToMarkers();
      }
      state.flags.isInitialLoad = false;
    }
  }, 500);
}

// Control positioning and event setup
setTimeout(() => {
  const ctrl = $1('.mapboxgl-ctrl-top-right');
  if (ctrl) utils.setStyles(ctrl, {top: '4rem', right: '0.5rem', zIndex: '10'});
}, 500);

// Optimized event handlers
map.on("load", () => {
  try {
    console.log('Map loaded, starting initialization...');
    init();
    
    // Load area overlays and simplified boundaries
    setTimeout(() => {
      console.log('Loading area overlays...');
      loadAreaOverlays();
      console.log('Loading simplified boundaries...');
      loadSimplifiedBoundaries();
    }, 500);
    
    setTimeout(loadDistrictTags, 2000);
    setTimeout(() => {
      console.log('Setting up area key controls...');
      setupAreaKeyControls();
    }, 6000); // Increased delay to ensure areas are loaded first
    
  } catch (error) {
    console.error('Error during map initialization:', error);
    // Still hide loading screen on error
    setTimeout(() => {
      const loadingScreen = document.getElementById('loading-map-screen');
      if (loadingScreen) {
        loadingScreen.style.display = 'none';
        console.log('Loading screen hidden due to error');
      }
    }, 2000);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  setupSidebars();
  setupTabSwitcher();
});

window.addEventListener('load', () => {
  setupSidebars();
  setupTabSwitcher();
  setTimeout(() => {
    if (!state.allLocalityFeatures.length && map.loaded()) {
      try { init(); } catch (error) { console.error('Init error:', error); }
    }
  }, 200);
  
  // Only retry if not already loaded
  if (!state.flags.districtTagsLoaded) {
    [3000, 5000].forEach(delay => setTimeout(() => {
      if (!state.flags.districtTagsLoaded) loadDistrictTags();
    }, delay));
  }
  
  if (!state.flags.areaControlsSetup) {
    [8000, 10000].forEach(delay => setTimeout(() => {
      if (!state.flags.areaControlsSetup) setupAreaKeyControls();
    }, delay));
  }
  
  // Auto-trigger reframing with optimized logic
  const checkAndReframe = () => {
    if (map.loaded() && !map.isMoving() && checkMapMarkersFiltering()) {
      state.flags.forceFilteredReframe = true;
      state.flags.isRefreshButtonAction = true;
      applyFilterToMarkers();
      setTimeout(() => {
        state.flags.forceFilteredReframe = false;
        state.flags.isRefreshButtonAction = false;
      }, 1000);
      return true;
    }
    return false;
  };
  
  if (!checkAndReframe()) {
    setTimeout(() => !checkAndReframe() && setTimeout(checkAndReframe, 1000), 500);
  }
});

setTimeout(monitorTags, 1000);
