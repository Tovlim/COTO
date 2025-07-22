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
    areaControlsSetup: false,
    skipNextReframe: false // New flag to skip reframing after boundary zoom
  }
};

window.isLinkClick = false;

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
  
  if (map.getLayer(boundaryFillId) && map.getLayer(boundaryBorderId)) {
    // Apply subtle red highlight
    map.setPaintProperty(boundaryFillId, 'fill-color', '#6e3500');
    map.setPaintProperty(boundaryFillId, 'fill-opacity', 0.25);
    map.setPaintProperty(boundaryBorderId, 'line-color', '#6e3500');
    map.setPaintProperty(boundaryBorderId, 'line-opacity', 0.6);
    
    // Move boundary layers ABOVE area overlays for visibility during highlight
    const areaLayers = ['area-a-layer', 'area-b-layer', 'area-c-layer'];
    const firstMarkerLayer = getFirstMarkerLayerId();
    
    try {
      // Move fill layer above areas but below markers
      if (firstMarkerLayer) {
        map.moveLayer(boundaryFillId, firstMarkerLayer);
        map.moveLayer(boundaryBorderId, firstMarkerLayer);
      } else {
        // If no markers yet, just move to top of areas
        const topAreaLayer = areaLayers.find(layerId => map.getLayer(layerId));
        if (topAreaLayer) {
          map.moveLayer(boundaryFillId);
          map.moveLayer(boundaryBorderId);
        }
      }
    } catch (e) {
      // Silent fail for layer movement
    }
    
    // Track the highlighted boundary
    state.highlightedBoundary = districtName;
  }
}

// Remove boundary highlight and move back below area overlays
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
      
      // Move boundary layers BELOW area overlays (back to normal position)
      const areaLayers = ['area-a-layer', 'area-b-layer', 'area-c-layer'];
      const firstAreaLayer = areaLayers.find(layerId => map.getLayer(layerId));
      
      try {
        if (firstAreaLayer) {
          // Move boundary layers below the first area layer
          map.moveLayer(boundaryFillId, firstAreaLayer);
          map.moveLayer(boundaryBorderId, firstAreaLayer);
        }
      } catch (e) {
        // Silent fail for layer movement
      }
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

// Helper function to automatically discover all cms-filter-list containers
function getAvailableFilterLists() {
  const lists = [];
  let listNumber = 1;
  
  // Keep checking for cms-filter-list-{number} until we don't find any more
  while (true) {
    const listId = `cms-filter-list-${listNumber}`;
    const listContainer = $id(listId);
    
    if (listContainer) {
      lists.push(listId);
      listNumber++;
    } else {
      // If we don't find this number, check a few more in case there are gaps
      let gapCount = 0;
      let tempNumber = listNumber;
      
      // Check up to 5 numbers ahead for gaps (cms-filter-list-4 might exist even if cms-filter-list-3 doesn't)
      while (gapCount < 5) {
        tempNumber++;
        const tempListId = `cms-filter-list-${tempNumber}`;
        if ($id(tempListId)) {
          // Found a gap - add all the missing ones and continue
          for (let i = listNumber; i <= tempNumber; i++) {
            const gapListId = `cms-filter-list-${i}`;
            if ($id(gapListId)) {
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

// Optimized location data extraction - AUTOMATICALLY DISCOVERS ALL FILTER LISTS
function getLocationData() {
  state.locationData.features = [];
  
  // Automatically discover all available cms-filter-list containers
  const lists = getAvailableFilterLists();
  let totalLoaded = 0;
  
  if (lists.length === 0) {
    return;
  }
  
  lists.forEach((listId, listIndex) => {
    const listContainer = $id(listId);
    if (!listContainer) {
      return;
    }
    
    const selectors = [
      listContainer.querySelectorAll('.data-places-names-filter'),
      listContainer.querySelectorAll('.data-places-latitudes-filter'),
      listContainer.querySelectorAll('.data-places-longitudes-filter'),
      listContainer.querySelectorAll('.data-places-slug-filter'),
      listContainer.querySelectorAll('.data-places-district-filter')
    ];
    
    const [names, lats, lngs, slugs, districts] = selectors;
    if (!names.length) {
      return;
    }
    
    const minLength = Math.min(names.length, lats.length, lngs.length);
    for (let i = 0; i < minLength; i++) {
      const [lat, lng] = [parseFloat(lats[i].textContent), parseFloat(lngs[i].textContent)];
      if (isNaN(lat) || isNaN(lng)) continue;
      
      const feature = {
        type: "Feature",
        geometry: {type: "Point", coordinates: [lng, lat]},
        properties: {
          name: names[i].textContent.trim(),
          id: `location-${listIndex}-${i}`, // Unique ID per list
          popupIndex: totalLoaded + i, // Global index
          slug: slugs[i]?.textContent.trim() || '',
          district: districts[i]?.textContent.trim() || '',
          index: totalLoaded + i, // Global index
          listId: listId, // Track which list this came from
          type: 'locality'
        }
      };
      
      state.locationData.features.push(feature);
    }
    
    totalLoaded += minLength;
  });
  
  // Store all locality features for reset functionality
  state.allLocalityFeatures = [...state.locationData.features];
}

// Add native Mapbox markers using Symbol layers - GREEN FROM START!
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
    
    // Clustered points layer - GREEN color directly (NO beforeId - goes to top)
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
    
    // Individual locality points layer - GREEN color directly (NO beforeId - goes to top)
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
  }
  
  setupNativeMarkerClicks();
  
  // Ensure markers are always on top
  ensureMarkersOnTop();
}

// Add native district markers using Symbol layers - RED FROM START!
function addNativeDistrictMarkers() {
  if (!state.allDistrictFeatures.length) return;
  
  // Add districts source and layer
  if (map.getSource('districts-source')) {
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
    
    // District name labels layer - RED color directly (NO beforeId - goes to top)
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
  }
  
  setupDistrictMarkerClicks();
  
  // Ensure markers are always on top
  ensureMarkersOnTop();
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
    }, 800);
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
    }, 800);
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
  
  // Check filtering across all discovered cms-filter-list containers
  const lists = getAvailableFilterLists();
  let totalElements = 0;
  let totalVisible = 0;
  
  lists.forEach(listId => {
    const listContainer = $id(listId);
    if (!listContainer) return;
    
    const allFilteredLat = listContainer.querySelectorAll('.data-places-latitudes-filter');
    const visibleFilteredLat = Array.from(allFilteredLat).filter(el => {
      // Check if element itself or any parent is hidden
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
  
  return totalVisible > 0 && totalVisible < totalElements;
};

// Optimized filter application - AUTOMATICALLY HANDLES ALL DISCOVERED FILTER LISTS
function applyFilterToMarkers() {
  if (state.flags.isInitialLoad && !checkMapMarkersFiltering()) return;
  
  // Skip reframing if we just did a boundary zoom
  if (state.flags.skipNextReframe) {
    console.log('Skipping reframe due to boundary zoom');
    return;
  }
  
  // Helper function to check if element is truly visible (not hidden by Finsweet)
  const isElementVisible = (el) => {
    let current = el;
    while (current && current !== document.body) {
      const style = getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }
      current = current.parentElement;
    }
    return true;
  };
  
  // Collect elements from all discovered lists
  const lists = getAvailableFilterLists();
  let allFilteredLat = [];
  let allFilteredLon = [];
  let visibleFilteredLat = [];
  let visibleFilteredLon = [];
  
  lists.forEach(listId => {
    const listContainer = $id(listId);
    if (!listContainer) return;
    
    const listLat = Array.from(listContainer.querySelectorAll('.data-places-latitudes-filter'));
    const listLon = Array.from(listContainer.querySelectorAll('.data-places-longitudes-filter'));
    
    allFilteredLat = allFilteredLat.concat(listLat);
    allFilteredLon = allFilteredLon.concat(listLon);
    
    const visibleLat = listLat.filter(isElementVisible);
    const visibleLon = listLon.filter(isElementVisible);
    
    visibleFilteredLat = visibleFilteredLat.concat(visibleLat);
    visibleFilteredLon = visibleFilteredLon.concat(visibleLon);
  });
  
  let visibleCoordinates = [];
  
  if (visibleFilteredLat.length > 0 && visibleFilteredLat.length < allFilteredLat.length) {
    // Filtering is active - create coordinates from visible filtered data for reframing ONLY
    const minLength = Math.min(visibleFilteredLat.length, visibleFilteredLon.length);
    for (let i = 0; i < minLength; i++) {
      const lat = parseFloat(visibleFilteredLat[i]?.textContent.trim());
      const lon = parseFloat(visibleFilteredLon[i]?.textContent.trim());
      
      if (!isNaN(lat) && !isNaN(lon)) {
        visibleCoordinates.push([lon, lat]);
      }
    }
    
    // DO NOT update the source data - keep all markers visible
    if (map.getSource('localities-source')) {
      map.getSource('localities-source').setData({
        type: "FeatureCollection",
        features: state.allLocalityFeatures // Always show ALL markers from all lists
      });
    }
  } else if (visibleFilteredLat.length === allFilteredLat.length) {
    // No filtering - show all features and use all coordinates
    if (map.getSource('localities-source')) {
      map.getSource('localities-source').setData({
        type: "FeatureCollection",
        features: state.allLocalityFeatures
      });
    }
    visibleCoordinates = state.allLocalityFeatures.map(f => f.geometry.coordinates);
  } else {
    // All filtered out or no data
    visibleCoordinates = [];
  }
  
  const animationDuration = state.flags.isInitialLoad ? 600 : 1000;
  
  if (visibleCoordinates.length > 0) {
    // Use filtered coordinates for map reframing, but keep all markers visible
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
  // Skip if we just did a boundary zoom
  if (state.flags.skipNextReframe) return;
  
  state.flags.isRefreshButtonAction = true;
  applyFilterToMarkers();
  setTimeout(() => state.flags.isRefreshButtonAction = false, 1000);
}, 150);

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
    },
    'ToggleSecondLeft': () => {
      const secondLeftSidebar = $id('SecondLeftSidebar');
      if (secondLeftSidebar) toggleSidebar('SecondLeft', !secondLeftSidebar.classList.contains('is-show'));
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
        const openSecondLeftSidebar = newElement.getAttribute('open-second-left-sidebar');
        
        if (openRightSidebar === 'open-only') {
          toggleSidebar(sidebarSide, true);
        } else if (openSecondLeftSidebar === 'open-only') {
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
  setupSidebarControls('[open-second-left-sidebar="true"], [open-second-left-sidebar="open-only"]', 'SecondLeft');
  setupSidebarControls('.OpenLeftSidebar, [OpenLeftSidebar], [openleftsidebar]', 'Left', 'change');
  setupSidebarControls('.OpenSecondLeftSidebar, [OpenSecondLeftSidebar], [opensecondleftsidebar]', 'SecondLeft', 'change');
  
  setupTabSwitcher();
  setupAreaKeyControls();
}

// Optimized sidebar setup with performance improvements for three sidebars
function setupSidebars() {
  let zIndex = 1000;
  
  const setupSidebarElement = (side) => {
    const sidebar = $id(`${side}Sidebar`);
    const tab = $id(`${side}SideTab`);
    const close = $id(`${side}SidebarClose`);
    
    if (!sidebar || !tab || !close) return false;
    if (tab.dataset.setupComplete === 'true' && close.dataset.setupComplete === 'true') return true;
    
    // Fix CSS transition property naming - use dash format for CSS
    const cssTransitionProperty = side === 'SecondLeft' ? 'margin-left' : `margin-${side.toLowerCase()}`;
    sidebar.style.cssText += `transition: ${cssTransitionProperty} 0.25s cubic-bezier(0.4, 0, 0.2, 1); z-index: ${zIndex}; position: relative;`;
    tab.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
    
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
        // Use correct JavaScript property names for style manipulation
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
          // On mobile, close ALL other sidebars
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
    const secondLeftReady = setupSidebarElement('SecondLeft');
    const rightReady = setupSidebarElement('Right');
    
    if (leftReady && secondLeftReady && rightReady) {
      setupInitialMargins();
      setTimeout(setupControls, 50);
      return;
    }
    
    if (attempt < maxAttempts) {
      const delay = [50, 150, 250, 500][attempt - 1] || 500;
      setTimeout(() => attemptSetup(attempt + 1, maxAttempts), delay);
    } else {
      setupInitialMargins();
      setTimeout(setupControls, 100);
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

// Optimized event setup with consolidated handlers
function setupEvents() {
  const eventHandlers = [
    {selector: '[data-auto-sidebar="true"]', events: ['change', 'input'], handler: () => {
      // Only open sidebar on devices wider than 478px
      if (window.innerWidth > 478) {
        setTimeout(() => toggleSidebar('Left', true), 50);
      }
    }},
    {selector: '[data-auto-second-left-sidebar="true"]', events: ['change', 'input'], handler: () => {
      // Only open second left sidebar on devices wider than 478px
      if (window.innerWidth > 478) {
        setTimeout(() => toggleSidebar('SecondLeft', true), 100);
      }
    }},
    {selector: 'select, [fs-cmsfilter-element="select"]', events: ['change'], handler: () => setTimeout(handleFilterUpdate, 50)},
    {selector: '[fs-cmsfilter-element="filters"] input, [fs-cmsfilter-element="filters"] select', events: ['change'], handler: () => setTimeout(handleFilterUpdate, 50)}
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
    
    // For #refresh-on-enter, exclude 'click' events to prevent reframing on click
    let events;
    if (newElement.id === 'refresh-on-enter') {
      events = ['keypress', 'input']; // Only keypress and input, no click
    } else if (newElement.getAttribute('apply-map-filter') === 'true') {
      events = ['click', 'keypress', 'input'];
    } else {
      events = ['click'];
    }
    
    events.forEach(eventType => {
      newElement.addEventListener(eventType, (e) => {
        if (eventType === 'keypress' && e.key !== 'Enter') return;
        if (window.isMarkerClick) return;
        
        e.preventDefault();
        
        state.flags.forceFilteredReframe = true;
        state.flags.isRefreshButtonAction = true;
        
        const delay = eventType === 'input' ? 200 : 50;
        
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
        }, 150);
      }, 100);
    });
  });
  
  const selectField5 = $id('select-field-5');
  if (selectField5) {
    selectField5.addEventListener('change', (e) => {
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
          setTimeout(() => {
            state.flags.skipNextReframe = false;
          }, 1200);
        } else {
          // Fallback to regular filtering if boundary source not found
          setTimeout(() => {
            state.flags.forceFilteredReframe = true;
            state.flags.isRefreshButtonAction = true;
            
            setTimeout(() => {
              applyFilterToMarkers();
              setTimeout(() => {
                state.flags.forceFilteredReframe = false;
                state.flags.isRefreshButtonAction = false;
              }, 1000);
            }, 150);
          }, 100);
        }
      } else {
        // District without boundaries - use current behavior (zoom to filtered localities)
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
      }
    });
  }
}

// Load combined GeoJSON data (districts + areas) from single file
function loadCombinedGeoData() {
  console.log('Loading combined GeoJSON data...');
  
  fetch('https://cdn.jsdelivr.net/gh/Tovlim/COTO@main/Combined-GEOJSON-0.003.json')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(combinedData => {
      console.log('Combined GeoJSON data loaded successfully');
      
      // Separate districts and areas
      const districts = combinedData.features.filter(f => f.properties.type === 'district');
      const areas = combinedData.features.filter(f => f.properties.type === 'area');
      
      console.log(`Found ${districts.length} districts and ${areas.length} areas`);
      
      // Process districts (boundaries + markers)
      districts.forEach(districtFeature => {
        const name = districtFeature.properties.name;
        addDistrictBoundaryToMap(name, districtFeature);
      });
      
      // Process areas (overlays)
      areas.forEach(areaFeature => {
        const name = areaFeature.properties.name;
        addAreaOverlayToMap(name, areaFeature);
      });
      
      // Update district markers after all boundaries are processed
      console.log('All combined data processed, updating district markers');
      addNativeDistrictMarkers();
      
      // Ensure final layer order is correct
      setTimeout(ensureMarkersOnTop, 300);
      
    })
    .catch(error => {
      console.error('Error loading combined GeoJSON data:', error);
      // Still update district markers in case some data was loaded
      addNativeDistrictMarkers();
      setTimeout(ensureMarkersOnTop, 300);
    });
}

// Add district boundary to map from feature data
function addDistrictBoundaryToMap(name, districtFeature) {
  const boundary = {
    name,
    sourceId: `${name.toLowerCase().replace(/\s+/g, '-')}-boundary`,
    fillId: `${name.toLowerCase().replace(/\s+/g, '-')}-fill`,
    borderId: `${name.toLowerCase().replace(/\s+/g, '-')}-border`
  };
  
  console.log(`Adding district boundary: ${name}`);
  
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
    data: {
      type: "FeatureCollection",
      features: [districtFeature]
    }
  });
  
  // Add fill layer (visual only) - BELOW area overlays by default
  const areaLayers = ['area-a-layer', 'area-b-layer', 'area-c-layer'];
  const firstAreaLayer = areaLayers.find(layerId => map.getLayer(layerId));
  const beforeId = firstAreaLayer || getFirstMarkerLayerId();
  
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
  }, beforeId);
  
  // Add border layer (visual only) - BELOW area overlays by default
  map.addLayer({
    id: boundary.borderId,
    type: 'line',
    source: boundary.sourceId,
    layout: {
      'visibility': 'visible'
    },
    paint: {
      'line-color': '#888888',
      'line-width': 1,
      'line-opacity': 0.4
    }
  }, beforeId);
  
  console.log(`${name} district boundary added`);
  
  // Ensure markers stay on top after adding boundaries
  setTimeout(ensureMarkersOnTop, 50);
  
  // Calculate centroid and add district marker
  const existingFeature = state.allDistrictFeatures.find(f => f.properties.name === name && f.properties.source === 'boundary');
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
    console.log(`Added district marker for ${name} at centroid:`, centroid);
  }
}

// Add area overlay to map from feature data
function addAreaOverlayToMap(name, areaFeature) {
  // Map area names to colors and layer IDs
  const areaConfig = {
    'Area A': { color: '#adc278', layerId: 'area-a-layer', sourceId: 'area-a-source' },
    'Area B': { color: '#ffdcc6', layerId: 'area-b-layer', sourceId: 'area-b-source' },
    'Area C': { color: '#889c9b', layerId: 'area-c-layer', sourceId: 'area-c-source' }
  };
  
  const config = areaConfig[name];
  if (!config) {
    console.log(`Unknown area: ${name}`);
    return;
  }
  
  console.log(`Adding area overlay: ${name}`);
  
  // Remove existing layers/sources if they exist
  try {
    if (map.getLayer(config.layerId)) {
      map.removeLayer(config.layerId);
    }
    if (map.getSource(config.sourceId)) {
      map.removeSource(config.sourceId);
    }
  } catch (e) {
    // Silent fail for cleanup
  }
  
  // Add source
  map.addSource(config.sourceId, {
    type: 'geojson',
    data: {
      type: "FeatureCollection",
      features: [areaFeature]
    }
  });
  
  // Add the layer ABOVE boundaries but BELOW markers
  const firstMarkerLayer = getFirstMarkerLayerId();
  map.addLayer({
    id: config.layerId,
    type: 'fill',
    source: config.sourceId,
    layout: {
      'visibility': 'visible'
    },
    paint: {
      'fill-color': config.color,
      'fill-opacity': 0.5,
      'fill-outline-color': config.color
    }
  }, firstMarkerLayer);
  
  console.log(`${name} area overlay added`);
  
  // Ensure markers stay on top after adding GeoJSON
  setTimeout(ensureMarkersOnTop, 50);
}

// Area key controls with improved functionality + District/Locality toggles
function setupAreaKeyControls() {
  // Prevent multiple executions
  if (state.flags.areaControlsSetup) {
    return;
  }
  
  const areaControls = [
    {keyId: 'area-a-key', layerId: 'area-a-layer', wrapId: 'area-a-key-wrap'},
    {keyId: 'area-b-key', layerId: 'area-b-layer', wrapId: 'area-b-key-wrap'},
    {keyId: 'area-c-key', layerId: 'area-c-layer', wrapId: 'area-c-key-wrap'}
  ];
  
  // District and Locality toggle controls
  const markerControls = [
    {
      keyId: 'district-toggle-key', 
      wrapId: 'district-toggle-key-wrap',
      type: 'district',
      layers: ['district-points'], // Will also handle boundary layers dynamically
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
  
  // Setup area controls (existing functionality)
  areaControls.forEach(control => {
    const checkbox = $id(control.keyId);
    if (!checkbox) {
      return;
    }
    
    // Check if layer exists
    if (!map.getLayer(control.layerId)) {
      return;
    }
    
    // Set initial state - unchecked means area is visible
    checkbox.checked = false;
    
    // Add our event listener WITHOUT removing existing ones
    // Use a unique identifier to prevent duplicate listeners from our script
    if (!checkbox.dataset.mapboxListenerAdded) {
      const mapboxChangeHandler = () => {
        if (!map.getLayer(control.layerId)) {
          return;
        }
        
        // Checkbox logic: checked = hidden, unchecked = visible
        const visibility = checkbox.checked ? 'none' : 'visible';
        map.setLayoutProperty(control.layerId, 'visibility', visibility);
      };
      
      checkbox.addEventListener('change', mapboxChangeHandler);
      checkbox.dataset.mapboxListenerAdded = 'true';
    }
    
    // Find the wrapper element for hover effects
    const wrapperDiv = $id(control.wrapId);
    
    if (wrapperDiv) {
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
      }
      
      setupCount++;
    }
  });
  
  // Setup marker controls (NEW functionality)
  markerControls.forEach(control => {
    const checkbox = $id(control.keyId);
    if (!checkbox) {
      return;
    }
    
    // Set initial state - unchecked means markers are visible
    checkbox.checked = false;
    
    // Add our event listener WITHOUT removing existing ones
    if (!checkbox.dataset.mapboxListenerAdded) {
      const mapboxChangeHandler = () => {
        // Checkbox logic: checked = hidden, unchecked = visible
        const visibility = checkbox.checked ? 'none' : 'visible';
        
        if (control.type === 'district') {
          // Handle district markers
          control.layers.forEach(layerId => {
            if (map.getLayer(layerId)) {
              map.setLayoutProperty(layerId, 'visibility', visibility);
            }
          });
          
          // Handle all district boundaries dynamically
          const allLayers = map.getStyle().layers;
          allLayers.forEach(layer => {
            if (layer.id.includes('-fill') || layer.id.includes('-border')) {
              map.setLayoutProperty(layer.id, 'visibility', visibility);
            }
          });
        } else if (control.type === 'locality') {
          // Handle locality markers
          control.layers.forEach(layerId => {
            if (map.getLayer(layerId)) {
              map.setLayoutProperty(layerId, 'visibility', visibility);
            }
          });
        }
      };
      
      checkbox.addEventListener('change', mapboxChangeHandler);
      checkbox.dataset.mapboxListenerAdded = 'true';
    }
    
    // Find the wrapper element for hover effects
    const wrapperDiv = $id(control.wrapId);
    
    if (wrapperDiv) {
      // Add hover effects WITHOUT removing existing ones
      if (!wrapperDiv.dataset.mapboxHoverAdded) {
        const mouseEnterHandler = () => {
          // Highlight effect for marker controls
          if (control.type === 'district') {
            // Highlight district markers with brighter color (30% brighter)
            if (map.getLayer('district-points')) {
              map.setPaintProperty('district-points', 'text-halo-color', '#8f4500');
            }
            
            // Highlight all district boundaries like when clicking
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
            // Highlight locality markers with brighter color (30% brighter)
            if (map.getLayer('locality-clusters')) {
              map.setPaintProperty('locality-clusters', 'text-halo-color', '#a49c00');
            }
            if (map.getLayer('locality-points')) {
              map.setPaintProperty('locality-points', 'text-halo-color', '#a49c00');
            }
          }
        };
        
        const mouseLeaveHandler = () => {
          // Reset highlight effect for marker controls
          if (control.type === 'district') {
            // Reset district markers to original color
            if (map.getLayer('district-points')) {
              map.setPaintProperty('district-points', 'text-halo-color', '#6e3500');
            }
            
            // Reset all district boundaries to default colors
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
            // Reset locality markers to original color
            if (map.getLayer('locality-clusters')) {
              map.setPaintProperty('locality-clusters', 'text-halo-color', '#7e7800');
            }
            if (map.getLayer('locality-points')) {
              map.setPaintProperty('locality-points', 'text-halo-color', '#7e7800');
            }
          }
        };
        
        wrapperDiv.addEventListener('mouseenter', mouseEnterHandler);
        wrapperDiv.addEventListener('mouseleave', mouseLeaveHandler);
        wrapperDiv.dataset.mapboxHoverAdded = 'true';
      }
      
      setupCount++;
    }
  });
  
  const totalControls = areaControls.length + markerControls.length;
  if (setupCount === totalControls) {
    state.flags.areaControlsSetup = true;
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
        
        // Add fill layer (visual only) - BELOW area overlays by default
        const areaLayers = ['area-a-layer', 'area-b-layer', 'area-c-layer'];
        const firstAreaLayer = areaLayers.find(layerId => map.getLayer(layerId));
        const beforeId = firstAreaLayer || getFirstMarkerLayerId();
        
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
        }, beforeId); // Add before area layers (below them) or markers
        
        // Add border layer (visual only) - BELOW area overlays by default
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
        }, beforeId); // Add before area layers (below them) or markers
        
        console.log(`${name} simplified boundary added below area overlays`);
        
        // Ensure markers stay on top after adding boundaries
        setTimeout(ensureMarkersOnTop, 100);
        
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
          // Ensure final layer order is correct
          setTimeout(ensureMarkersOnTop, 500);
        }
        
      })
      .catch(error => {
        console.error(`Error loading ${name} boundary:`, error);
        loadedCount++; // Still increment to prevent hanging
        if (loadedCount === totalCount) {
          console.log('All boundary attempts completed, updating district markers');
          addNativeDistrictMarkers();
          // Ensure final layer order is correct
          setTimeout(ensureMarkersOnTop, 500);
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
    return;
  }
  
  const districtTagCollection = $id('district-tag-collection');
  if (!districtTagCollection) {
    return;
  }
  
  const districtTagItems = districtTagCollection.querySelectorAll('#district-tag-item');
  
  // Clear existing tag-based features (keep boundary-based features)
  state.allDistrictFeatures = state.allDistrictFeatures.filter(f => f.properties.source !== 'tag');
  
  districtTagItems.forEach((tagItem, index) => {
    if (getComputedStyle(tagItem).display === 'none') {
      return;
    }
    
    const name = tagItem.getAttribute('district-tag-name');
    const lat = parseFloat(tagItem.getAttribute('district-tag-lattitude'));
    const lng = parseFloat(tagItem.getAttribute('district-tag-longitude'));
    
    if (!name || isNaN(lat) || isNaN(lng)) {
      return;
    }
    
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
  
  // Update district markers after adding tag features
  addNativeDistrictMarkers();
  
  // Ensure markers stay on top
  setTimeout(ensureMarkersOnTop, 100);
}

// Generate locality checkboxes from map data
function generateLocalityCheckboxes() {
  const container = $id('locality-check-list');
  if (!container) {
    console.log('Locality checkbox container not found');
    return;
  }
  
  // Find the template (parent div with checkbox-filter="locality")
  const template = container.querySelector('[checkbox-filter="locality"]');
  if (!template) {
    console.log('Locality checkbox template not found');
    return;
  }
  
  // Extract unique locality names from map data
  const localityNames = [...new Set(state.allLocalityFeatures.map(feature => feature.properties.name))].sort();
  
  if (localityNames.length === 0) {
    console.log('No locality names found in map data');
    return;
  }
  
  // Clear the container
  container.innerHTML = '';
  
  // Generate checkbox for each locality
  localityNames.forEach(localityName => {
    // Clone the template (entire div with checkbox-filter="locality")
    const checkbox = template.cloneNode(true);
    
    // Remove the ID from the label to avoid duplicate IDs
    const label = checkbox.querySelector('#locality-checkbox');
    if (label) {
      label.removeAttribute('id');
    }
    
    // Update fs-list-value attribute
    const input = checkbox.querySelector('input[name="locality"]');
    if (input) {
      input.setAttribute('fs-list-value', localityName);
    }
    
    // Update span text content
    const span = checkbox.querySelector('.test3.w-form-label');
    if (span) {
      span.textContent = localityName;
    }
    
    // Append to container
    container.appendChild(checkbox);
    
    // Add event listeners for attributes like data-auto-sidebar="true"
    setupCheckboxEvents(checkbox);
  });
  
  console.log(`Generated ${localityNames.length} locality checkboxes`);
  
  // Re-cache checkbox filter script if it exists
  if (window.checkboxFilterScript && typeof window.checkboxFilterScript.recacheElements === 'function') {
    setTimeout(() => {
      window.checkboxFilterScript.recacheElements();
    }, 100);
  }
}

// Setup events for a specific checkbox element (used for dynamically generated checkboxes)
function setupCheckboxEvents(checkboxContainer) {
  // Handle data-auto-sidebar="true"
  const autoSidebarElements = checkboxContainer.querySelectorAll('[data-auto-sidebar="true"]');
  autoSidebarElements.forEach(element => {
    ['change', 'input'].forEach(eventType => {
      element.addEventListener(eventType, () => {
        // Only open sidebar on devices wider than 478px
        if (window.innerWidth > 478) {
          setTimeout(() => toggleSidebar('Left', true), 100);
        }
      });
    });
  });
  
  // Handle fs-cmsfilter-element filters
  const filterElements = checkboxContainer.querySelectorAll('[fs-cmsfilter-element="filters"] input, [fs-cmsfilter-element="filters"] select');
  filterElements.forEach(element => {
    element.addEventListener('change', () => setTimeout(handleFilterUpdate, 100));
  });
  
  // Handle activate-filter-indicator functionality
  const indicatorActivators = checkboxContainer.querySelectorAll('[activate-filter-indicator]');
  indicatorActivators.forEach(activator => {
    const groupName = activator.getAttribute('activate-filter-indicator');
    if (!groupName) return;
    
    // Function to toggle indicators for this group
    const toggleIndicators = (shouldShow) => {
      const indicators = document.querySelectorAll(`[filter-indicator="${groupName}"]`);
      indicators.forEach(indicator => {
        indicator.style.display = shouldShow ? 'flex' : 'none';
      });
    };
    
    // Function to check if any activator in this group is active
    const hasActiveFilters = () => {
      const groupActivators = document.querySelectorAll(`[activate-filter-indicator="${groupName}"]`);
      return Array.from(groupActivators).some(el => {
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
      activator.addEventListener('change', () => {
        const shouldShow = hasActiveFilters();
        toggleIndicators(shouldShow);
      });
    }
  });
}

// Ensure markers are always on top of all other layers
function ensureMarkersOnTop() {
  const markerLayers = ['locality-clusters', 'locality-points', 'district-points'];
  
  markerLayers.forEach(layerId => {
    if (map.getLayer(layerId)) {
      try {
        // Move to top by removing and re-adding
        const layer = map.getStyle().layers.find(l => l.id === layerId);
        if (layer) {
          map.removeLayer(layerId);
          map.addLayer(layer);
        }
      } catch (e) {
        // Silent fail for layer movement
      }
    }
  });
}

// Get the first marker layer ID for use as beforeId in GeoJSON layers
function getFirstMarkerLayerId() {
  const markerLayers = ['locality-clusters', 'locality-points', 'district-points'];
  for (const layerId of markerLayers) {
    if (map.getLayer(layerId)) {
      return layerId;
    }
  }
  return null;
}

// Tag monitoring with optimized logic
const monitorTags = () => {
  const checkTags = () => toggleShowWhenFilteredElements($id('hiddentagparent') !== null);
  checkTags();
  
  const tagParent = $id('tagparent');
  if (tagParent) {
    new MutationObserver(() => setTimeout(checkTags, 25)).observe(tagParent, {childList: true, subtree: true});
  } else {
    setInterval(checkTags, 1000);
  }
};

// Optimized initialization
function init() {
  getLocationData();
  addNativeMarkers();
  setupEvents();
  
  // Generate locality checkboxes early, right after data is loaded
  setTimeout(() => {
    generateLocalityCheckboxes();
  }, 300);
  
  // Ensure markers are on top after initial setup
  setTimeout(ensureMarkersOnTop, 100);
  
  const handleMapEvents = () => {
    clearTimeout(state.timers.zoom);
    state.timers.zoom = setTimeout(() => {
      // No need for handleZoomBasedVisibility since we're using native markers
    }, 10);
  };
  
  map.on('moveend', handleMapEvents);
  map.on('zoomend', handleMapEvents);
  
  // Staggered setup with optimized timing
  [300, 800].forEach(delay => setTimeout(setupDropdownListeners, delay));
  [200, 600, 1200].forEach(delay => setTimeout(setupTabSwitcher, delay));
  
  state.flags.mapInitialized = true;
  
  // Hide loading screen as soon as core map functionality is ready
  setTimeout(() => {
    const loadingScreen = document.getElementById('loading-map-screen');
    if (loadingScreen) {
      loadingScreen.style.display = 'none';
    }
  }, 600);
  
  setTimeout(() => {
    if (state.flags.isInitialLoad) {
      const hasFiltering = checkMapMarkersFiltering();
      if (hasFiltering) {
        applyFilterToMarkers();
      }
      state.flags.isInitialLoad = false;
    }
  }, 300);
}

// Control positioning and event setup
setTimeout(() => {
  const ctrl = $1('.mapboxgl-ctrl-top-right');
  if (ctrl) utils.setStyles(ctrl, {top: '4rem', right: '0.5rem', zIndex: '10'});
}, 300);

// Optimized event handlers
map.on("load", () => {
  try {
    init();
    
    // Load combined GeoJSON data (districts + areas)
    setTimeout(() => {
      loadCombinedGeoData();
    }, 100);
    
    setTimeout(loadDistrictTags, 800);
    setTimeout(() => {
      setupAreaKeyControls();
    }, 2000); // Reduced delay to ensure areas are loaded first
    
    // Final layer order enforcement
    setTimeout(() => {
      ensureMarkersOnTop();
    }, 3000);
    
  } catch (error) {
    // Still hide loading screen on error
    setTimeout(() => {
      const loadingScreen = document.getElementById('loading-map-screen');
      if (loadingScreen) {
        loadingScreen.style.display = 'none';
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
      try { init(); } catch (error) { /* Silent fail */ }
    }
  }, 100);
  
  // Only retry if not already loaded
  if (!state.flags.districtTagsLoaded) {
    [1200, 2500].forEach(delay => setTimeout(() => {
      if (!state.flags.districtTagsLoaded) loadDistrictTags();
    }, delay));
  }
  
  if (!state.flags.areaControlsSetup) {
    [2500, 4000].forEach(delay => setTimeout(() => {
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

setTimeout(monitorTags, 600);
