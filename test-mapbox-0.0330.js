// ====================================================================
// COMPLETE MAPBOX SCRIPT - Uses Shared Core Module
// Depends on: shared-core.js (must be loaded first)
// Version: 0.0307 (Complete Refactored)
// ====================================================================

// Ensure shared-core is loaded
if (!window.SharedCore) {
  console.error('SharedCore module must be loaded before this script');
  throw new Error('Missing dependency: shared-core.js');
}

// Import from SharedCore
const { domCache, eventManager, state, geoCache, utils, sidebarCache, toggleSidebar, closeSidebar, checkAndToggleFilteredElements, monitorTags } = window.SharedCore;
const { $, $1, $id } = window.SharedCore;

// ====================================================================
// MOBILE DETECTION & EARLY OPTIMIZATIONS
// ====================================================================
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

// ====================================================================
// MAPBOX-SPECIFIC STATE EXTENSIONS
// ====================================================================
// Extend the shared state with map-specific properties
state.allLocalityFeatures = [];
state.allSettlementFeatures = [];
state.allRegionFeatures = [];
state.allSubregionFeatures = [];
state.visibleMarkers = [];
state.hiddenMarkers = [];
state.selectedPlace = null;
state.markerInteractionLock = false;
state.lastFilterState = null;
state.filterUpdateCount = 0;
state.lastBounds = null;
state.currentZoom = null;

// Map-specific flags
state.flags = {
  ...state.flags,
  isInitialLoad: true,
  mapInitialized: false,
  markersLoaded: false,
  settlementsLoaded: false,
  localitiesLoaded: false,
  dropdownListenersSetup: false,
  areaControlsSetup: false,
  mapLayoutReady: false,
  isRefreshButtonAction: false,
  forceFilteredReframe: false
};

// ====================================================================
// LOADING TRACKER
// ====================================================================
const loadingTracker = {
  states: {
    mapInitialized: false,
    locationDataLoaded: false,
    markersAdded: false,
    geoDataLoaded: false,
    regionsLoaded: false,
    localitiesLoaded: false,
    settlementsLoaded: false,
    sidebarSetup: false,
    eventsSetup: false,
    uiPositioned: false,
    backToTopSetup: false
  },
  startTime: Date.now(),
  
  markComplete(stateName) {
    if (this.states.hasOwnProperty(stateName)) {
      this.states[stateName] = true;
      const elapsed = Date.now() - this.startTime;
      console.log(`✓ ${stateName} (${elapsed}ms)`);
      this.checkAllComplete();
    }
  },
  
  checkAllComplete() {
    const allComplete = Object.values(this.states).every(state => state === true);
    if (allComplete) {
      this.onAllComplete();
    }
  },
  
  onAllComplete() {
    const totalTime = Date.now() - this.startTime;
    console.log(`All loading steps complete in ${totalTime}ms`);
    
    // Hide loading screen
    const loadingScreen = document.getElementById('loading-map-screen');
    if (loadingScreen && loadingScreen.style.display !== 'none') {
      loadingScreen.style.display = 'none';
    }
  }
};

// ====================================================================
// MAPBOX-SPECIFIC UTILITIES
// ====================================================================

// OPTIMIZED: Event setup with consolidated handlers and better management
function setupEvents() {
  const eventHandlers = [
    {selector: '[data-auto-sidebar="true"]', events: ['change', 'input'], handler: () => {
      if (window.innerWidth > 991) {
        state.setTimer('sidebarUpdate', () => toggleSidebar('Left', true), 50);
      }
    }},
    {selector: '[data-auto-second-left-sidebar="true"]', events: ['change', 'input'], handler: () => {
      if (window.innerWidth > 991) {
        state.setTimer('sidebarUpdate', () => toggleSidebar('SecondLeft', true), 50);
      }
    }},
    {selector: 'select, [fs-cmsfilter-element="select"]', events: ['change'], handler: () => state.setTimer('filterUpdate', handleFilterUpdate, 50)},
    {selector: '[fs-cmsfilter-element="filters"] input, [fs-cmsfilter-element="filters"] select', events: ['change'], handler: () => state.setTimer('filterUpdate', handleFilterUpdate, 50)}
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
      
      // Batch process districts as regions
      mapLayers.addToBatch(() => {
        districts.forEach(districtFeature => {
          const name = districtFeature.properties.name;
          addRegionBoundaryToMap(name, districtFeature);
        });
      });
      
      // Batch process areas
      mapLayers.addToBatch(() => {
        areas.forEach(areaFeature => {
          const name = areaFeature.properties.name;
          addAreaOverlayToMap(name, areaFeature);
        });
      });
      
      // Update region markers after processing
      state.setTimer('updateRegionMarkers', () => {
        addNativeRegionMarkers();
        
        state.setTimer('finalLayerOrder', () => mapLayers.optimizeLayerOrder(), 300);
        
        // Mark loading step complete
        loadingTracker.markComplete('geoDataLoaded');
      }, 100);
    })
    .catch(error => {
      // Still update region markers in case some data was loaded
      addNativeRegionMarkers();
      state.setTimer('errorLayerOrder', () => mapLayers.optimizeLayerOrder(), 300);
      
      // Mark as complete even with error to avoid infinite loading
      loadingTracker.markComplete('geoDataLoaded');
    });
}

// OPTIMIZED: Region boundary addition with batching
function addRegionBoundaryToMap(name, regionFeature) {
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
      features: [regionFeature]
    }
  });
  
  // Get layer positioning
  const areaLayers = ['area-a-layer', 'area-b-layer', 'area-c-layer', 'firing-zones-layer'];
  const firstAreaLayer = areaLayers.find(layerId => mapLayers.hasLayer(layerId));
  
  // Don't specify beforeId if the layer doesn't exist yet
  const layerConfig = {
    id: boundary.fillId,
    type: 'fill',
    source: boundary.sourceId,
    layout: { 'visibility': 'visible' },
    paint: {
      'fill-color': '#1a1b1e',
      'fill-opacity': 0.15
    }
  };
  
  // Only add beforeId if the layer exists - check settlement layers first
  if (firstAreaLayer) {
    map.addLayer(layerConfig, firstAreaLayer);
  } else if (mapLayers.hasLayer('settlement-clusters')) {
    map.addLayer(layerConfig, 'settlement-clusters');
  } else if (mapLayers.hasLayer('settlement-points')) {
    map.addLayer(layerConfig, 'settlement-points');
  } else if (mapLayers.hasLayer('locality-clusters')) {
    map.addLayer(layerConfig, 'locality-clusters');
  } else {
    map.addLayer(layerConfig);
  }
  
  // Add border layer
  const borderConfig = {
    id: boundary.borderId,
    type: 'line',
    source: boundary.sourceId,
    layout: { 'visibility': 'visible' },
    paint: {
      'line-color': '#888888',
      'line-width': 1,
      'line-opacity': 0.4
    }
  };
  
  // Only add beforeId if the layer exists - check settlement layers first
  if (firstAreaLayer) {
    map.addLayer(borderConfig, firstAreaLayer);
  } else if (mapLayers.hasLayer('settlement-clusters')) {
    map.addLayer(borderConfig, 'settlement-clusters');
  } else if (mapLayers.hasLayer('settlement-points')) {
    map.addLayer(borderConfig, 'settlement-points');
  } else if (mapLayers.hasLayer('locality-clusters')) {
    map.addLayer(borderConfig, 'locality-clusters');
  } else {
    map.addLayer(borderConfig);
  }
  
  // Update cache
  mapLayers.sourceCache.set(boundary.sourceId, true);
  mapLayers.layerCache.set(boundary.fillId, true);
  mapLayers.layerCache.set(boundary.borderId, true);
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
  const layerConfig = {
    id: config.layerId,
    type: 'fill',
    source: config.sourceId,
    layout: { 'visibility': 'visible' },
    paint: {
      'fill-color': config.color,
      'fill-opacity': 0.5,
      'fill-outline-color': config.color
    }
  };
  
  // Only add beforeId if the layer exists - check settlement layers first, then locality
  if (mapLayers.hasLayer('settlement-clusters')) {
    map.addLayer(layerConfig, 'settlement-clusters');
  } else if (mapLayers.hasLayer('settlement-points')) {
    map.addLayer(layerConfig, 'settlement-points');
  } else if (mapLayers.hasLayer('locality-clusters')) {
    map.addLayer(layerConfig, 'locality-clusters');
  } else {
    map.addLayer(layerConfig);
  }
  
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
        keyId: 'region-toggle-key', 
        wrapId: 'region-toggle-key-wrap',
        type: 'region',
        layers: ['region-points', 'subregion-points'],
        label: 'Region Markers & Boundaries'
      },
      {
        keyId: 'locality-toggle-key', 
        wrapId: 'locality-toggle-key-wrap',
        type: 'locality',
        layers: ['locality-clusters', 'locality-points'],
        label: 'Locality Markers'
      },
      {
        keyId: 'settlement-toggle-key', 
        wrapId: 'settlement-toggle-key-wrap',
        type: 'settlement',
        layers: ['settlement-clusters', 'settlement-points'],
        label: 'Settlement Markers'
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
          
          if (control.type === 'region') {
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
          } else if (control.type === 'settlement') {
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
          if (control.type === 'region') {
            if (mapLayers.hasLayer('region-points')) {
              map.setPaintProperty('region-points', 'text-halo-color', '#8f4500');
            }
            if (mapLayers.hasLayer('subregion-points')) {
              map.setPaintProperty('subregion-points', 'text-halo-color', '#8f4500');
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
          } else if (control.type === 'settlement') {
            if (mapLayers.hasLayer('settlement-clusters')) {
              map.setPaintProperty('settlement-clusters', 'text-halo-color', '#6a7a9c');
            }
            if (mapLayers.hasLayer('settlement-points')) {
              map.setPaintProperty('settlement-points', 'text-halo-color', '#6a7a9c');
            }
          }
        };
        
        const mouseLeaveHandler = () => {
          if (control.type === 'region') {
            if (mapLayers.hasLayer('region-points')) {
              map.setPaintProperty('region-points', 'text-halo-color', '#6e3500');
            }
            if (mapLayers.hasLayer('subregion-points')) {
              map.setPaintProperty('subregion-points', 'text-halo-color', '#6e3500');
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
          } else if (control.type === 'settlement') {
            if (mapLayers.hasLayer('settlement-clusters')) {
              map.setPaintProperty('settlement-clusters', 'text-halo-color', '#444B5C');
            }
            if (mapLayers.hasLayer('settlement-points')) {
              map.setPaintProperty('settlement-points', 'text-halo-color', '#444B5C');
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
    }
  };
  
  // Use requestIdleCallback if available, otherwise setTimeout
  if ('requestIdleCallback' in window) {
    requestIdleCallback(loadAreaControls, { timeout: 3000 });
  } else {
    setTimeout(loadAreaControls, 2000);
  }
}

// ====================================================================
// BOUNDARY MANAGEMENT FUNCTIONS
// ====================================================================

// Global function to frame region boundaries (used by both markers and autocomplete)
function frameRegionBoundary(regionName) {
  const boundarySourceId = `${regionName.toLowerCase().replace(/\s+/g, '-')}-boundary`;
  const source = map.getSource(boundarySourceId);
  
  if (source && source._data) {
    // Region has boundaries - frame them with cached bounds
    const cacheKey = `region-${regionName}`;
    const allCoordinates = source._data.features.flatMap(feature => feature.geometry.coordinates);
    const bounds = boundsCalculator.fromGeoJSON(allCoordinates, cacheKey);
    
    map.fitBounds(bounds, {padding: 50, duration: 1000, essential: true});
    return true; // Successfully framed
  }
  
  return false; // No boundary found
}

// Highlight boundary with subtle red color and move above area overlays
function highlightBoundary(regionName) {
  // Remove any existing highlight first
  removeBoundaryHighlight();
  
  const boundaryFillId = `${regionName.toLowerCase().replace(/\s+/g, '-')}-fill`;
  const boundaryBorderId = `${regionName.toLowerCase().replace(/\s+/g, '-')}-border`;
  
  if (mapLayers.hasLayer(boundaryFillId) && mapLayers.hasLayer(boundaryBorderId)) {
    // Batch boundary highlighting operations
    mapLayers.addToBatch(() => {
      map.setPaintProperty(boundaryFillId, 'fill-color', '#6e3500');
      map.setPaintProperty(boundaryFillId, 'fill-opacity', 0.25);
      map.setPaintProperty(boundaryBorderId, 'line-color', '#6e3500');
      map.setPaintProperty(boundaryBorderId, 'line-opacity', 0.6);
    });
    
    // Track the highlighted boundary
    state.highlightedBoundary = regionName;
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

// Toggle filtered elements with immediate DOM updates
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

// ====================================================================
// CHECKBOX SELECTION FUNCTIONS
// ====================================================================

// OPTIMIZED: Unified checkbox selection function
function selectCheckbox(type, value) {
  const checkboxTypes = ['region', 'subregion', 'locality', 'settlement'];
  
  requestAnimationFrame(() => {
    // Get all checkbox groups - using native queries to avoid caching
    const allCheckboxes = checkboxTypes.flatMap(checkboxType => 
      Array.from(document.querySelectorAll(`[checkbox-filter="${checkboxType}"] input[fs-list-value]`))
    );
    
    // Clear all checkboxes first
    allCheckboxes.forEach(checkbox => {
      if (checkbox.checked) {
        checkbox.checked = false;
        // Trigger events properly
        checkbox.dispatchEvent(new Event('change', {bubbles: true}));
        checkbox.dispatchEvent(new Event('input', {bubbles: true}));
        
        const form = checkbox.closest('form');
        if (form) {
          form.dispatchEvent(new Event('change', {bubbles: true}));
          form.dispatchEvent(new Event('input', {bubbles: true}));
        }
      }
    });
    
    // Now select the specific checkbox
    const targetCheckbox = document.querySelector(`[checkbox-filter="${type}"] input[fs-list-value="${value}"]`);
    if (targetCheckbox) {
      targetCheckbox.checked = true;
      targetCheckbox.dispatchEvent(new Event('change', {bubbles: true}));
      targetCheckbox.dispatchEvent(new Event('input', {bubbles: true}));
      
      const form = targetCheckbox.closest('form');
      if (form) {
        form.dispatchEvent(new Event('change', {bubbles: true}));
        form.dispatchEvent(new Event('input', {bubbles: true}));
      }
    }
  });
}

// Specific checkbox selection functions
function selectRegionCheckbox(regionName) {
  selectCheckbox('region', regionName);
}

function selectSubregionCheckbox(subregionName) {
  selectCheckbox('subregion', subregionName);
}

function selectLocalityCheckbox(localityName) {
  selectCheckbox('locality', localityName);
}

function selectSettlementCheckbox(settlementName) {
  selectCheckbox('settlement', settlementName);
}

// ====================================================================
// DATA LOADING FUNCTIONS
// ====================================================================

// MODIFY loadLocalitiesFromGeoJSON to extract both regions AND subregions
function loadLocalitiesFromGeoJSON() {
  fetch('https://cdn.jsdelivr.net/gh/Tovlim/COTO@main/localities-0.003.geojson')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(localityData => {
      // Store locality features
      state.locationData = localityData;
      state.allLocalityFeatures = localityData.features;
      
      // Extract unique regions from localities with their coordinates
      const regionMap = new Map();
      // Extract unique subregions from localities with their coordinates
      const subregionMap = new Map();
      
      localityData.features.forEach(feature => {
        const regionName = feature.properties.region;
        const subregionName = feature.properties.subRegion;
        
        // Process regions
        if (regionName && !regionMap.has(regionName)) {
          regionMap.set(regionName, []);
        }
        if (regionName) {
          regionMap.get(regionName).push(feature.geometry.coordinates);
        }
        
        // Process subregions
        if (subregionName && !subregionMap.has(subregionName)) {
          subregionMap.set(subregionName, []);
        }
        if (subregionName) {
          subregionMap.get(subregionName).push(feature.geometry.coordinates);
        }
      });
      
      // Create region features from the extracted data
      state.allRegionFeatures = Array.from(regionMap.entries()).map(([regionName, coordinates]) => {
        // Calculate centroid of all localities in this region
        let totalLat = 0, totalLng = 0;
        coordinates.forEach(coord => {
          totalLng += coord[0];
          totalLat += coord[1];
        });
        
        return {
          type: "Feature",
          properties: {
            name: regionName,
            type: "region"
          },
          geometry: {
            type: "Point",
            coordinates: [totalLng / coordinates.length, totalLat / coordinates.length]
          }
        };
      });
      
      // Create subregion features from the extracted data
      state.allSubregionFeatures = Array.from(subregionMap.entries()).map(([subregionName, coordinates]) => {
        // Calculate centroid of all localities in this subregion
        let totalLat = 0, totalLng = 0;
        coordinates.forEach(coord => {
          totalLng += coord[0];
          totalLat += coord[1];
        });
        
        return {
          type: "Feature",
          properties: {
            name: subregionName,
            type: "subregion"
          },
          geometry: {
            type: "Point",
            coordinates: [totalLng / coordinates.length, totalLat / coordinates.length]
          }
        };
      });
      
      // Add localities to map
      addNativeMarkers();
      
      // Add region markers to map
      addNativeRegionMarkers();

      // Add subregion markers to map
      addNativeSubregionMarkers();
      
      // Generate checkboxes - use shared-core for localities, map-specific for regions
      if (window.SharedCore) {
        state.setTimer('generateLocalityCheckboxes', window.SharedCore.generateLocalityCheckboxes, 500);
      }
      generateRegionCheckboxes();
      
      // Load settlements after locality/region layers are created for proper layer ordering
      state.setTimer('loadSettlements', () => {
        loadSettlements();
      }, 300);
      
      // Refresh autocomplete if it exists
      if (window.refreshAutocomplete) {
        state.setTimer('refreshAutocompleteAfterLocalities', window.refreshAutocomplete, 1000);
      }
      
      // Mark loading steps complete
      loadingTracker.markComplete('localitiesLoaded');
      loadingTracker.markComplete('regionsLoaded');
      loadingTracker.markComplete('locationDataLoaded');
    })
    .catch(error => {
      console.error('Failed to load localities:', error);
      loadingTracker.markComplete('localitiesLoaded');
      loadingTracker.markComplete('regionsLoaded');
      loadingTracker.markComplete('locationDataLoaded');
    });
}

// OPTIMIZED: Load and add settlement markers
function loadSettlements() {
  fetch('https://cdn.jsdelivr.net/gh/Tovlim/COTO@main/settlements-0.001.geojson')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(settlementData => {
      // Store settlement features
      state.settlementData = settlementData;
      state.allSettlementFeatures = settlementData.features;
      
      // Add settlements to map (will be inserted before localities for proper layer order)
      addSettlementMarkers();
      
      // Generate settlement checkboxes - use shared-core
      if (window.SharedCore) {
        state.setTimer('generateSettlementCheckboxes', window.SharedCore.generateSettlementCheckboxes, 500);
      }
      
      // Refresh autocomplete to include settlement data
      if (window.refreshAutocomplete) {
        state.setTimer('refreshAutocompleteAfterSettlements', window.refreshAutocomplete, 600);
      }
      
      loadingTracker.markComplete('settlementsLoaded');
    })
    .catch(error => {
      console.error('Failed to load settlements:', error);
      loadingTracker.markComplete('settlementsLoaded');
    });
}

// Helper function to debug layer order
function logLayerOrder(message) {
  const layers = map.getStyle().layers;
  const relevantLayers = layers.filter(layer => 
    layer.id.includes('locality') || 
    layer.id.includes('region') || 
    layer.id.includes('subregion') || 
    layer.id.includes('settlement')
  ).map(layer => layer.id);
  
  console.log(`[LAYER ORDER] ${message}:`, JSON.stringify(relevantLayers));
}

// ====================================================================
// MARKER MANAGEMENT FUNCTIONS
// ====================================================================

// Add settlement markers to map with updated color
function addSettlementMarkers() {
  
  if (!state.allSettlementFeatures.length) {
    return;
  }
  
  // Find proper insertion point - before locality layers but after areas
  const getBeforeLayerId = () => {
    const markerLayers = ['locality-clusters', 'locality-points', 'region-points'];
    const existingMarkerLayer = markerLayers.find(layerId => map.getLayer(layerId));
    
    if (existingMarkerLayer) {
      return existingMarkerLayer;
    }
    
    return null;
  };
  
  mapLayers.addToBatch(() => {
    if (mapLayers.hasSource('settlements-source')) {
      map.getSource('settlements-source').setData(state.settlementData);
    } else {
      // Add source first
      map.addSource('settlements-source', {
        type: 'geojson',
        data: state.settlementData,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 40
      });
      
      const beforeId = getBeforeLayerId();
      
      // Add clustered settlements layer with proper positioning
      const layerConfig = {
        id: 'settlement-clusters',
        type: 'symbol',
        source: 'settlements-source',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Open Sans Regular'],
          'text-size': 16,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'symbol-sort-key': 1,
          'visibility': 'visible'
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#444B5C',
          'text-halo-width': 2
        }
      };
      
      if (beforeId) {
        map.addLayer(layerConfig, beforeId);
      } else {
        map.addLayer(layerConfig);
      }
      
      // Add individual settlement points layer with proper positioning
      const pointsLayerConfig = {
        id: 'settlement-points',
        type: 'symbol',
        source: 'settlements-source',
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
          'text-anchor': 'top',
          'symbol-sort-key': 2,
          'visibility': 'visible'
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#444B5C',
          'text-halo-width': 2,
          'text-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            isMobile ? 7.1 : 8.5, 0,
            isMobile ? 8.1 : 9.5, 1
          ]
        }
      };
      
      if (beforeId) {
        map.addLayer(pointsLayerConfig, beforeId);
      } else {
        map.addLayer(pointsLayerConfig);
      }
      
      // Hide Mapbox base map settlement layers immediately
      try {
        const baseSettlementLayers = ['settlement-subdivision-label', 'settlement-minor-label', 'settlement-major-label'];
        baseSettlementLayers.forEach(layerId => {
          if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, 'visibility', 'none');
          }
        });
      } catch (error) {
        console.error('[DEBUG] Error hiding base layers:', error);
      }
      
      mapLayers.layerCache.set('settlement-clusters', true);
      mapLayers.layerCache.set('settlement-points', true);
      mapLayers.sourceCache.set('settlements-source', true);
    }
  });
  
  setupSettlementMarkerClicks();
}

// Setup settlement marker click handlers
function setupSettlementMarkerClicks() {
  // Settlement point clicks
  const settlementClickHandler = (e) => {
    const feature = e.features[0];
    const settlementName = feature.properties.name;
    
    // Prevent rapid clicks
    const currentTime = Date.now();
    const markerKey = `settlement-${settlementName}`;
    if (state.lastClickedMarker === markerKey && currentTime - state.lastClickTime < 1000) {
      return;
    }
    
    state.markerInteractionLock = true;
    state.lastClickedMarker = markerKey;
    state.lastClickTime = currentTime;
    window.isMarkerClick = true;
    
    removeBoundaryHighlight();
    selectSettlementCheckbox(settlementName);
    toggleShowWhenFilteredElements(true);
    toggleSidebar('Left', true);
    
    // No flying/reframing when clicking settlement markers - user already sees where it is
    
    state.setTimer('settlementMarkerCleanup', () => {
      window.isMarkerClick = false;
      state.markerInteractionLock = false;
    }, 800);
  };
  
  // Cluster clicks
  const settlementClusterClickHandler = (e) => {
    removeBoundaryHighlight();
    
    const features = map.queryRenderedFeatures(e.point, {
      layers: ['settlement-clusters']
    });
    
    map.flyTo({
      center: features[0].geometry.coordinates,
      zoom: map.getZoom() + 2.5,
      duration: 800
    });
  };
  
  // Add event listeners
  map.on('click', 'settlement-points', settlementClickHandler);
  map.on('click', 'settlement-clusters', settlementClusterClickHandler);
  
  // Cursor management
  ['settlement-clusters', 'settlement-points'].forEach(layerId => {
    map.on('mouseenter', layerId, () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', layerId, () => map.getCanvas().style.cursor = '');
  });
}

// OPTIMIZED: Native markers with batched operations
function addNativeMarkers() {
  if (!state.locationData.features.length) {
    return;
  }
  
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
      
      // Add individual locality points layer WITHOUT highlighting
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
          'text-anchor': 'top',
          'symbol-sort-key': 10 // Higher values render last (on top)
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
      
      logLayerOrder('After adding locality layers');
      
      mapLayers.layerCache.set('locality-clusters', true);
      mapLayers.layerCache.set('locality-points', true);
      mapLayers.sourceCache.set('localities-source', true);
    }
  });
  
  setupNativeMarkerClicks();
  
  // Mark loading step complete
  loadingTracker.markComplete('markersAdded');
}

// OPTIMIZED: Region markers with batched operations  
function addNativeRegionMarkers() {
  if (!state.allRegionFeatures.length) {
    return;
  }
  
  mapLayers.addToBatch(() => {
    if (mapLayers.hasSource('regions-source')) {
      map.getSource('regions-source').setData({
        type: "FeatureCollection",
        features: state.allRegionFeatures
      });
    } else {
      map.addSource('regions-source', {
        type: 'geojson',
        data: {
          type: "FeatureCollection",
          features: state.allRegionFeatures
        }
      });
      
      map.addLayer({
        id: 'region-points',
        type: 'symbol',
        source: 'regions-source',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            6, 12,
            8, 14,
            10, 16,
            12, 18
          ],
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'text-optional': true,
          'text-padding': 6,
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
          'symbol-sort-key': 5 // Regions render below localities but above base layers
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#6e3500',
          'text-halo-width': 2,
          'text-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            isMobile ? 5.5 : 6.5, 0,
            isMobile ? 6.5 : 7.5, 1
          ]
        }
      });
      
      mapLayers.layerCache.set('region-points', true);
      mapLayers.sourceCache.set('regions-source', true);
    }
  });
  
  setupRegionMarkerClicks();
}

// OPTIMIZED: Subregion markers with batched operations
function addNativeSubregionMarkers() {
  if (!state.allSubregionFeatures.length) {
    return;
  }
  
  mapLayers.addToBatch(() => {
    if (mapLayers.hasSource('subregions-source')) {
      map.getSource('subregions-source').setData({
        type: "FeatureCollection",
        features: state.allSubregionFeatures
      });
    } else {
      map.addSource('subregions-source', {
        type: 'geojson',
        data: {
          type: "FeatureCollection",
          features: state.allSubregionFeatures
        }
      });
      
      // Find insertion point - after regions, before settlements/localities
      const beforeLayerId = mapLayers.hasLayer('settlement-clusters') ? 'settlement-clusters' : 
                           mapLayers.hasLayer('locality-clusters') ? 'locality-clusters' : null;
      
      const layerConfig = {
        id: 'subregion-points',
        type: 'symbol',
        source: 'subregions-source',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7, 11,
            9, 13,
            11, 15,
            13, 17
          ],
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'text-optional': true,
          'text-padding': 5,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'symbol-sort-key': 7 // Subregions render between regions and settlements
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#6e3500',
          'text-halo-width': 2,
          'text-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            isMobile ? 6.5 : 7.5, 0,
            isMobile ? 7.5 : 8.5, 1
          ]
        }
      };
      
      if (beforeLayerId) {
        map.addLayer(layerConfig, beforeLayerId);
      } else {
        map.addLayer(layerConfig);
      }
      
      mapLayers.layerCache.set('subregion-points', true);
      mapLayers.sourceCache.set('subregions-source', true);
    }
  });
  
  setupSubregionMarkerClicks();
}

// ====================================================================
// MARKER CLICK HANDLERS
// ====================================================================

// OPTIMIZED: Event setup with proper management and delegation
function setupNativeMarkerClicks() {
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

function setupRegionMarkerClicks() {
  const regionClickHandler = (e) => {
    const feature = e.features[0];
    const regionName = feature.properties.name;
    
    // Prevent rapid clicks
    const currentTime = Date.now();
    const markerKey = `region-${regionName}`;
    if (state.lastClickedMarker === markerKey && currentTime - state.lastClickTime < 1000) {
      return;
    }
    
    state.markerInteractionLock = true;
    state.lastClickedMarker = markerKey;
    state.lastClickTime = currentTime;
    window.isMarkerClick = true;
    
    selectRegionCheckbox(regionName);
    toggleShowWhenFilteredElements(true);
    toggleSidebar('Left', true);
    
    // Check if region has boundary
    const boundarySourceId = `${regionName.toLowerCase().replace(/\s+/g, '-')}-boundary`;
    if (map.getSource(boundarySourceId)) {
      highlightBoundary(regionName);
      
      // Use the global function to frame boundaries
      if (!frameRegionBoundary(regionName)) {
        // Fallback if no boundary found
        removeBoundaryHighlight();
        state.setTimer('regionFallback', () => {
          state.flags.forceFilteredReframe = true;
          state.flags.isRefreshButtonAction = true;
          applyFilterToMarkers();
          state.setTimer('regionFallbackCleanup', () => {
            state.flags.forceFilteredReframe = false;
            state.flags.isRefreshButtonAction = false;
          }, 1000);
        }, 200);
      }
    } else {
      // Region without boundary - use point location
      removeBoundaryHighlight();
      
      // Fly to region point
      map.flyTo({
        center: feature.geometry.coordinates,
        zoom: 10,
        duration: 1000,
        essential: true
      });
    }
    
    state.setTimer('markerCleanup', () => {
      window.isMarkerClick = false;
      state.markerInteractionLock = false;
    }, 800);
  };
  
  map.on('click', 'region-points', regionClickHandler);
  map.on('mouseenter', 'region-points', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'region-points', () => map.getCanvas().style.cursor = '');
}

function setupSubregionMarkerClicks() {
  const subregionClickHandler = (e) => {
    const feature = e.features[0];
    const subregionName = feature.properties.name;
    
    // Prevent rapid clicks
    const currentTime = Date.now();
    const markerKey = `subregion-${subregionName}`;
    if (state.lastClickedMarker === markerKey && currentTime - state.lastClickTime < 1000) {
      return;
    }
    
    state.markerInteractionLock = true;
    state.lastClickedMarker = markerKey;
    state.lastClickTime = currentTime;
    window.isMarkerClick = true;
    
    removeBoundaryHighlight();
    selectSubregionCheckbox(subregionName);
    toggleShowWhenFilteredElements(true);
    toggleSidebar('Left', true);
    
    // Fly to subregion point
    map.flyTo({
      center: feature.geometry.coordinates,
      zoom: 11,
      duration: 1000,
      essential: true
    });
    
    state.setTimer('markerCleanup', () => {
      window.isMarkerClick = false;
      state.markerInteractionLock = false;
    }, 800);
  };
  
  map.on('click', 'subregion-points', subregionClickHandler);
  map.on('mouseenter', 'subregion-points', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'subregion-points', () => map.getCanvas().style.cursor = '');
}

// ====================================================================
// FILTER SYSTEM IMPLEMENTATION
// ====================================================================

// SIMPLIFIED: Check for active filtering
function checkMapMarkersFiltering() {
  // Check if search box has content (indicates active search/filtering)
  const searchInput = document.getElementById('map-search');
  if (searchInput && searchInput.value.trim().length > 0) {
    return true;
  }
  
  // Check for active checkboxes
  const anyChecked = $('[checkbox-filter] input[type="checkbox"]:checked').length > 0;
  
  return anyChecked;
}

// SIMPLIFIED: Filter application based on checkboxes only
function applyFilterToMarkers(shouldReframe = true) {
  if (state.flags.isInitialLoad && !checkMapMarkersFiltering()) return;
  
  if (state.flags.skipNextReframe) {
    return;
  }
  
  // Get checked checkboxes - force fresh DOM query
  const checkedRegions = Array.from(document.querySelectorAll('[checkbox-filter="region"] input:checked')).map(cb => cb.getAttribute('fs-list-value'));
  const checkedSubregions = Array.from(document.querySelectorAll('[checkbox-filter="subregion"] input:checked')).map(cb => cb.getAttribute('fs-list-value'));
  const checkedLocalities = Array.from(document.querySelectorAll('[checkbox-filter="locality"] input:checked')).map(cb => cb.getAttribute('fs-list-value'));
  const checkedSettlements = Array.from(document.querySelectorAll('[checkbox-filter="settlement"] input:checked')).map(cb => cb.getAttribute('fs-list-value'));
  
  let visibleCoordinates = [];
  
  // Filter localities based on checkboxes
  if (checkedLocalities.length > 0) {
    const filteredLocalities = state.allLocalityFeatures.filter(f => 
      checkedLocalities.includes(f.properties.name)
    );
    
    if (mapLayers.hasSource('localities-source')) {
      sourceUpdater.updateSource('localities-source', {
        type: "FeatureCollection",
        features: filteredLocalities
      });
    }
    
    visibleCoordinates = filteredLocalities.map(f => f.geometry.coordinates);
  } else if (checkedSubregions.length > 0) {
    // Filter by subregion
    const filteredLocalities = state.allLocalityFeatures.filter(f => 
      checkedSubregions.includes(f.properties.subRegion)
    );
    
    if (mapLayers.hasSource('localities-source')) {
      sourceUpdater.updateSource('localities-source', {
        type: "FeatureCollection",
        features: filteredLocalities
      });
    }
    
    // For single subregion selection, use the subregion centroid instead of all localities
    if (checkedSubregions.length === 1 && state.allSubregionFeatures) {
      const selectedSubregion = checkedSubregions[0];
      const subregionFeature = state.allSubregionFeatures.find(f => 
        f.properties.name === selectedSubregion
      );
      
      if (subregionFeature) {
        // Use the subregion centroid for zooming
        visibleCoordinates = [subregionFeature.geometry.coordinates];
      } else {
        // Fallback to locality coordinates
        visibleCoordinates = filteredLocalities.map(f => f.geometry.coordinates);
      }
    } else {
      // Multiple subregions or fallback - use all locality coordinates
      visibleCoordinates = filteredLocalities.map(f => f.geometry.coordinates);
    }
  } else if (checkedRegions.length > 0) {
    // Filter by region
    const filteredLocalities = state.allLocalityFeatures.filter(f => 
      checkedRegions.includes(f.properties.region)
    );
    
    if (mapLayers.hasSource('localities-source')) {
      sourceUpdater.updateSource('localities-source', {
        type: "FeatureCollection",
        features: filteredLocalities
      });
    }
    
    visibleCoordinates = filteredLocalities.map(f => f.geometry.coordinates);
  } else {
    // No filtering - show all
    if (mapLayers.hasSource('localities-source')) {
      sourceUpdater.updateSource('localities-source', {
        type: "FeatureCollection",
        features: state.allLocalityFeatures
      });
    }
    visibleCoordinates = state.allLocalityFeatures.map(f => f.geometry.coordinates);
  }
  
  // Filter settlements based on checkboxes
  if (checkedSettlements.length > 0 && state.allSettlementFeatures) {
    const filteredSettlements = state.allSettlementFeatures.filter(f => 
      checkedSettlements.includes(f.properties.name)
    );
    
    if (mapLayers.hasSource('settlements-source')) {
      sourceUpdater.updateSource('settlements-source', {
        type: "FeatureCollection",
        features: filteredSettlements
      });
    }
    
    // Add settlement coordinates to visible coordinates
    const settlementCoords = filteredSettlements.map(f => f.geometry.coordinates);
    visibleCoordinates = visibleCoordinates.concat(settlementCoords);
  } else if (state.allSettlementFeatures && mapLayers.hasSource('settlements-source')) {
    // Show all settlements if no specific ones are selected
    sourceUpdater.updateSource('settlements-source', {
      type: "FeatureCollection",
      features: state.allSettlementFeatures
    });
  }
  
  // Only reframe the map if shouldReframe is true
  if (shouldReframe && visibleCoordinates.length > 0) {
    const animationDuration = state.flags.isInitialLoad ? 600 : 1000;
    
    // Use cached bounds calculation
    const bounds = boundsCalculator.fromCoordinates(visibleCoordinates);
    
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

// ====================================================================
// UI SETUP AND CONTROL FUNCTIONS
// ====================================================================

// OPTIMIZED: Back to top button functionality (integrates with shared-core)
function setupBackToTopButton() {
  // Use shared-core implementation if available
  if (window.SharedCore && window.SharedCore.setupBackToTopButton) {
    window.SharedCore.setupBackToTopButton();
    loadingTracker.markComplete('backToTopSetup');
    return;
  }
  
  // Fallback implementation
  const button = $id('jump-to-top');
  const scrollContainer = $id('scroll-wrap');
  
  if (!button || !scrollContainer) {
    loadingTracker.markComplete('backToTopSetup');
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
    if (btn && !btn.dataset.mapboxControlSetup) {
      eventManager.add(btn, 'click', (e) => {
        e.preventDefault();
        action();
      });
      btn.dataset.mapboxControlSetup = 'true';
    }
  });
  
  // Setup sidebar controls
  const setupSidebarControls = (selector, sidebarSide, eventType = 'click') => {
    const elements = $(selector);
    elements.forEach(element => {
      if (element.dataset.sidebarSetup === 'true') return;
      
      const handler = () => {
        const sidebar = $id(`${sidebarSide}Sidebar`);
        if (!sidebar) return;
        
        const openRightSidebar = element.getAttribute('open-right-sidebar');
        const openSecondLeftSidebar = element.getAttribute('open-second-left-sidebar');
        
        // Handle Right sidebar specifically
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
  
  // Position controls to prevent layout shift
  const topRightCtrl = $('.mapboxgl-ctrl-top-right')[0];
  if (topRightCtrl && !topRightCtrl.dataset.positioned) {
    topRightCtrl.style.top = '4rem';
    topRightCtrl.style.right = '0.5rem';
    topRightCtrl.style.zIndex = '10';
    topRightCtrl.dataset.positioned = 'true';
    
    loadingTracker.markComplete('uiPositioned');
  }
}

// OPTIMIZED: Sidebar setup (integrates with shared-core)
function setupSidebars() {
  // The shared-core handles sidebar functionality through its initialization
  // We only need to set up map-specific sidebar close buttons here
  const sidebars = ['LeftSidebar', 'SecondLeftSidebar', 'RightSidebar'];
  
  sidebars.forEach(sidebarId => {
    const sidebar = $id(sidebarId);
    const closeBtn = $id(`Close${sidebarId}`);
    
    if (sidebar && closeBtn && !closeBtn.dataset.mapboxSetup) {
      eventManager.add(closeBtn, 'click', () => {
        const side = sidebarId.replace('Sidebar', '');
        closeSidebar(side);
      });
      closeBtn.dataset.mapboxSetup = 'true';
    }
  });
  
  loadingTracker.markComplete('sidebarSetup');
}

// OPTIMIZED: Initialize optimization systems
function initializeOptimizationSystems() {
  // Initialize worker for heavy calculations
  if (workerManager && !workerManager.workers.has('mapWorker')) {
    workerManager.createWorker('mapWorker', enhancedMapWorker);
  }
  
  // Initialize progressive loader with map-specific steps
  if (progressiveLoader && progressiveLoader.loadingSteps.length === 0) {
    progressiveLoader.defineSteps([
      {
        name: 'map',
        loader: () => Promise.resolve(),
        userFacing: true,
        priority: 100
      },
      {
        name: 'ui',
        loader: () => Promise.resolve(),
        userFacing: true,
        priority: 90
      },
      {
        name: 'search',
        loader: () => Promise.resolve(),
        userFacing: true,
        priority: 80
      },
      {
        name: 'settlements',
        loader: () => loadSettlements(),
        userFacing: false,
        priority: 60
      }
    ]);
  }
  
  // Initialize performance monitoring
  if (performanceMonitor) {
    performanceMonitor.startMeasure('mapInit');
  }
}

// ====================================================================
// INITIALIZATION AND MAP EVENTS
// ====================================================================

// OPTIMIZED: Smart initialization with parallel loading
function init() {
  // Core initialization (parallel where possible)
  loadLocalitiesFromGeoJSON();
  setupEvents();
  setupControls();
  
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
    
    // Always check filtered elements on initial load
    checkAndToggleFilteredElements();
  }, 300);
}

// Generate region checkboxes (map-specific implementation extends shared-core)
function generateRegionCheckboxes() {
  const container = $id('region-check-list');
  if (!container) {
    return;
  }
  
  // Clear the container
  container.innerHTML = '';
  
  // Extract unique region names
  const regionNames = [...new Set(state.allRegionFeatures.map(feature => feature.properties.name))].sort();
  
  // Extract unique subregion names
  const subregionNames = state.allSubregionFeatures ? 
    [...new Set(state.allSubregionFeatures.map(feature => feature.properties.name))].sort() : [];
  
  if (regionNames.length === 0 && subregionNames.length === 0) {
    return;
  }
  
  // Combine both lists for alphabetical display
  const allItems = [
    ...regionNames.map(name => ({ name, type: 'region' })),
    ...subregionNames.map(name => ({ name, type: 'subregion' }))
  ].sort((a, b) => a.name.localeCompare(b.name));
  
  // Batch generate checkboxes using document fragment
  const fragment = document.createDocumentFragment();
  allItems.forEach(item => {
    // Create the wrapper div
    const wrapperDiv = document.createElement('div');
    wrapperDiv.setAttribute('checkbox-filter', item.type);
    wrapperDiv.setAttribute('role', 'listitem');
    wrapperDiv.className = 'collection-item-3 w-dyn-item';
    
    // Create the label
    const label = document.createElement('label');
    label.className = 'w-checkbox reporterwrap-copy';
    
    // Create the custom checkbox div
    const customCheckbox = document.createElement('div');
    customCheckbox.className = 'w-checkbox-input w-checkbox-input--inputType-custom toggleable';
    
    // Create the actual input
    const input = document.createElement('input');
    input.setAttribute('data-auto-sidebar', 'true');
    input.setAttribute('fs-list-value', item.name);
    input.setAttribute('fs-list-field', item.type === 'region' ? 'Region' : 'SubRegion');
    input.type = 'checkbox';
    input.name = item.type;
    input.setAttribute('data-name', item.type);
    input.setAttribute('activate-filter-indicator', 'place');
    input.id = item.type;
    input.style.opacity = '0';
    input.style.position = 'absolute';
    input.style.zIndex = '-1';
    
    // Create the span label
    const span = document.createElement('span');
    span.className = 'checkbox-text w-form-label';
    span.setAttribute('for', item.type);
    span.textContent = item.name;
    
    // Create the count div structure
    const countWrapper = document.createElement('div');
    countWrapper.className = 'div-block-31834';
    
    const countDiv = document.createElement('div');
    countDiv.setAttribute('fs-list-element', 'facet-count');
    countDiv.className = 'test33';
    countDiv.textContent = '0';
    
    countWrapper.appendChild(countDiv);
    
    // Assemble the structure
    label.appendChild(customCheckbox);
    label.appendChild(input);
    label.appendChild(span);
    label.appendChild(countWrapper);
    wrapperDiv.appendChild(label);
    fragment.appendChild(wrapperDiv);
    
    // Setup events for this checkbox
    setupCheckboxEvents(wrapperDiv);
  });
  
  container.appendChild(fragment);
  
  // Check filtered elements after generating checkboxes
  state.setTimer('checkFilteredAfterRegionGeneration', checkAndToggleFilteredElements, 200);
  
  // Invalidate DOM cache since we added new elements
  domCache.markStale();
}

// ====================================================================
// ENHANCED MAP WORKER FUNCTION
// ====================================================================

// Enhanced Worker function for multiple heavy calculations
function enhancedMapWorker() {
  self.onmessage = function(e) {
    const { id, type, data } = e.data;
    
    try {
      let result;
      
      switch(type) {
        case 'bounds_calculation':
          result = calculateBounds(data.coordinates);
          break;
          
        case 'search_indexing':
          result = buildSearchIndex(data.items);
          break;
          
        case 'distance_calculation':
          result = calculateDistances(data.points, data.center);
          break;
          
        case 'geojson_processing':
          result = processGeoJSON(data.features);
          break;
          
        case 'cluster_calculation':
          result = calculateClusters(data.points, data.zoom);
          break;
          
        default:
          throw new Error(`Unknown worker type: ${type}`);
      }
      
      self.postMessage({ id, result });
    } catch (error) {
      self.postMessage({ id, error: error.message });
    }
  };
  
  // Bounds calculation helper
  function calculateBounds(coordinates) {
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    
    coordinates.forEach(([lng, lat]) => {
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    });
    
    return {
      southwest: [minLng, minLat],
      northeast: [maxLng, maxLat]
    };
  }
  
  // Search index building helper
  function buildSearchIndex(items) {
    const index = {};
    items.forEach((item, idx) => {
      const terms = item.name.toLowerCase().split(/\s+/);
      terms.forEach(term => {
        if (!index[term]) index[term] = [];
        index[term].push(idx);
      });
    });
    return index;
  }
  
  // Distance calculation helper
  function calculateDistances(points, center) {
    return points.map(point => {
      const distance = haversineDistance(center, point.coordinates);
      return { ...point, distance };
    });
  }
  
  // Haversine distance formula
  function haversineDistance([lng1, lat1], [lng2, lat2]) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
  
  // GeoJSON processing helper
  function processGeoJSON(features) {
    return features.map(feature => ({
      id: feature.properties.id || feature.properties.name,
      name: feature.properties.name,
      type: feature.geometry.type,
      coordinates: feature.geometry.coordinates,
      bounds: feature.geometry.type === 'Point' ? 
        null : calculateBounds(flattenCoordinates(feature.geometry.coordinates))
    }));
  }
  
  // Cluster calculation helper
  function calculateClusters(points, zoom) {
    const clusters = [];
    const processed = new Set();
    const radius = 50 / Math.pow(2, zoom); // Adjust radius based on zoom
    
    points.forEach((point, i) => {
      if (processed.has(i)) return;
      
      const cluster = [point];
      processed.add(i);
      
      for (let j = i + 1; j < points.length; j++) {
        if (processed.has(j)) continue;
        
        const distance = haversineDistance(point.coordinates, points[j].coordinates);
        if (distance < radius) {
          cluster.push(points[j]);
          processed.add(j);
        }
      }
      
      if (cluster.length === 1) {
        clusters.push(cluster[0]);
      } else {
        const centerLat = cluster.reduce((sum, p) => sum + p.coordinates[1], 0) / cluster.length;
        const centerLng = cluster.reduce((sum, p) => sum + p.coordinates[0], 0) / cluster.length;
        clusters.push({
          type: 'cluster',
          coordinates: [centerLng, centerLat],
          count: cluster.length,
          items: cluster
        });
      }
    });
    
    return clusters;
  }
  
  // Helper to flatten nested coordinate arrays
  function flattenCoordinates(coords) {
    if (typeof coords[0] === 'number') return [coords];
    return coords.reduce((acc, coord) => {
      return acc.concat(flattenCoordinates(coord));
    }, []);
  }
}

// ====================================================================
// MAPBOX-SPECIFIC CLASSES (NOT IN SHARED-CORE)
// ====================================================================

// OPTIMIZED: Bounds calculator with caching for map viewport calculations
class BoundsCalculator {
  constructor() {
    this.boundsCache = new Map();
  }
  
  // Create bounds from coordinates with caching
  fromCoordinates(coordinates, cacheKey = null) {
    if (cacheKey && this.boundsCache.has(cacheKey)) {
      return this.boundsCache.get(cacheKey);
    }
    
    const bounds = new mapboxgl.LngLatBounds();
    coordinates.forEach(coord => bounds.extend(coord));
    
    if (cacheKey) {
      this.boundsCache.set(cacheKey, bounds);
    }
    
    return bounds;
  }
  
  // Create bounds from GeoJSON coordinates with recursive handling
  fromGeoJSON(geoJsonCoords, cacheKey = null) {
    if (cacheKey && this.boundsCache.has(cacheKey)) {
      return this.boundsCache.get(cacheKey);
    }
    
    const bounds = new mapboxgl.LngLatBounds();
    const addCoords = coords => {
      if (Array.isArray(coords) && coords.length > 0) {
        if (typeof coords[0] === 'number') bounds.extend(coords);
        else coords.forEach(addCoords);
      }
    };
    
    addCoords(geoJsonCoords);
    
    if (cacheKey) {
      this.boundsCache.set(cacheKey, bounds);
    }
    
    return bounds;
  }
  
  clearCache() {
    this.boundsCache.clear();
  }
}

// OPTIMIZED: Parallel data loader with caching and error handling
class DataLoader {
  constructor() {
    this.cache = new Map();
    this.loadingPromises = new Map();
  }
  
  // Parallel fetch with caching and compression support
  async fetchGeoJSON(url, cacheKey = null) {
    const key = cacheKey || url;
    
    // Return cached data if available
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    
    // Return existing promise if already loading
    if (this.loadingPromises.has(key)) {
      return this.loadingPromises.get(key);
    }
    
    // Create new loading promise
    const promise = fetch(url, {
      headers: {
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'application/json'
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      this.cache.set(key, data);
      this.loadingPromises.delete(key);
      return data;
    })
    .catch(error => {
      this.loadingPromises.delete(key);
      console.error(`Failed to load ${url}:`, error);
      throw error;
    });
    
    this.loadingPromises.set(key, promise);
    return promise;
  }
  
  // Load all GeoJSON data in parallel
  async loadAllData() {
    const urls = {
      localities: 'https://cdn.jsdelivr.net/gh/Tovlim/COTO@main/localities-0.003.geojson',
      settlements: 'https://cdn.jsdelivr.net/gh/Tovlim/COTO@main/settlements-0.001.geojson'
    };
    
    try {
      // Start all fetches in parallel
      const promises = Object.entries(urls).map(async ([key, url]) => {
        const data = await this.fetchGeoJSON(url, key);
        return { key, data };
      });
      
      // Wait for all to complete
      const results = await Promise.all(promises);
      
      // Return organized data
      const organizedData = {};
      results.forEach(({ key, data }) => {
        organizedData[key] = data;
      });
      
      return organizedData;
    } catch (error) {
      console.error('Failed to load data:', error);
      throw error;
    }
  }
  
  clearCache() {
    this.cache.clear();
  }
}

// OPTIMIZED: Debounced source update utility
class SourceUpdateManager {
  constructor() {
    this.pendingUpdates = new Map();
    this.updateTimers = new Map();
  }
  
  // Debounced source data update
  updateSource(sourceId, data, delay = 100) {
    // Store the latest data for this source
    this.pendingUpdates.set(sourceId, data);
    
    // Clear existing timer for this source
    if (this.updateTimers.has(sourceId)) {
      clearTimeout(this.updateTimers.get(sourceId));
    }
    
    // Set new debounced update
    const timer = setTimeout(() => {
      const source = map.getSource(sourceId);
      if (source && this.pendingUpdates.has(sourceId)) {
        source.setData(this.pendingUpdates.get(sourceId));
        this.pendingUpdates.delete(sourceId);
        this.updateTimers.delete(sourceId);
      }
    }, delay);
    
    this.updateTimers.set(sourceId, timer);
  }
  
  // Immediate source update (bypass debouncing)
  updateSourceImmediate(sourceId, data) {
    // Clear any pending update
    if (this.updateTimers.has(sourceId)) {
      clearTimeout(this.updateTimers.get(sourceId));
      this.updateTimers.delete(sourceId);
    }
    this.pendingUpdates.delete(sourceId);
    
    const source = map.getSource(sourceId);
    if (source) {
      source.setData(data);
    }
  }
}

// OPTIMIZED: Normalized data store to eliminate redundancy
class DataStore {
  constructor() {
    this.entities = {
      regions: new Map(),
      subregions: new Map(), 
      localities: new Map(),
      settlements: new Map()
    };
    
    this.indexes = {
      byRegion: new Map(),
      bySubregion: new Map(),
      coordinates: new Map(),
      searchIndex: new Map()
    };
    
    this.geoJsonCache = {
      localities: null,
      settlements: null,
      regions: null,
      subregions: null
    };
  }
  
  // Add entities with automatic indexing
  addEntity(type, id, data) {
    this.entities[type].set(id, data);
    
    // Build indexes
    if (data.region) {
      if (!this.indexes.byRegion.has(data.region)) {
        this.indexes.byRegion.set(data.region, new Set());
      }
      this.indexes.byRegion.get(data.region).add(id);
    }
    
    if (data.subRegion) {
      if (!this.indexes.bySubregion.has(data.subRegion)) {
        this.indexes.bySubregion.set(data.subRegion, new Set());
      }
      this.indexes.bySubregion.get(data.subRegion).add(id);
    }
    
    if (data.coordinates) {
      this.indexes.coordinates.set(id, data.coordinates);
    }
    
    // Build search index
    const searchTerms = [data.name, data.region, data.subRegion].filter(Boolean);
    searchTerms.forEach(term => {
      const normalized = term.toLowerCase();
      if (!this.indexes.searchIndex.has(normalized)) {
        this.indexes.searchIndex.set(normalized, new Set());
      }
      this.indexes.searchIndex.get(normalized).add(id);
    });
  }
  
  // Get entities with efficient filtering
  getEntities(type, filter = null) {
    if (!filter) {
      return Array.from(this.entities[type].values());
    }
    
    if (filter.region) {
      const ids = this.indexes.byRegion.get(filter.region) || new Set();
      return Array.from(ids).map(id => this.entities[type].get(id)).filter(Boolean);
    }
    
    if (filter.subregion) {
      const ids = this.indexes.bySubregion.get(filter.subregion) || new Set();
      return Array.from(ids).map(id => this.entities[type].get(id)).filter(Boolean);
    }
    
    return Array.from(this.entities[type].values());
  }
  
  clearCache() {
    this.geoJsonCache = {};
  }
}

// OPTIMIZED: Web Worker manager for heavy calculations
class WorkerManager {
  constructor() {
    this.workers = new Map();
    this.taskQueue = [];
    this.maxWorkers = navigator.hardwareConcurrency || 4;
    this.activeWorkers = 0;
  }
  
  // Create a worker from function code
  createWorker(name, workerFunction) {
    if (this.workers.has(name)) {
      return this.workers.get(name);
    }
    
    try {
      const blob = new Blob([`(${workerFunction.toString()})()`], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);
      
      worker.onmessage = (e) => this.handleWorkerMessage(name, e);
      worker.onerror = (e) => this.handleWorkerError(name, e);
      
      this.workers.set(name, {
        worker,
        busy: false,
        tasks: new Map()
      });
      
      URL.revokeObjectURL(workerUrl);
      return this.workers.get(name);
    } catch (error) {
      console.warn('Web Worker not supported:', error);
      return null;
    }
  }
  
  // Execute task in worker
  async executeInWorker(workerName, taskData, taskId = null) {
    const workerInfo = this.workers.get(workerName);
    if (!workerInfo) {
      // Fallback to main thread
      return this.executeInMainThread(taskData);
    }
    
    const id = taskId || Math.random().toString(36).substr(2, 9);
    
    return new Promise((resolve, reject) => {
      workerInfo.tasks.set(id, { resolve, reject, startTime: Date.now() });
      workerInfo.worker.postMessage({ id, ...taskData });
    });
  }
  
  // Handle worker responses
  handleWorkerMessage(workerName, event) {
    const { id, result, error } = event.data;
    const workerInfo = this.workers.get(workerName);
    
    if (workerInfo && workerInfo.tasks.has(id)) {
      const task = workerInfo.tasks.get(id);
      workerInfo.tasks.delete(id);
      
      if (error) {
        task.reject(new Error(error));
      } else {
        task.resolve(result);
      }
    }
  }
  
  // Handle worker errors
  handleWorkerError(workerName, error) {
    console.error(`Worker ${workerName} error:`, error);
    const workerInfo = this.workers.get(workerName);
    if (workerInfo) {
      // Reject all pending tasks
      workerInfo.tasks.forEach(task => {
        task.reject(new Error(`Worker error: ${error.message}`));
      });
      workerInfo.tasks.clear();
    }
  }
  
  // Fallback execution in main thread
  executeInMainThread(taskData) {
    // Simple fallback for clustering calculations
    if (taskData.type === 'cluster') {
      // Basic clustering algorithm fallback
      return Promise.resolve([]);
    }
    return Promise.resolve(null);
  }
  
  terminate() {
    this.workers.forEach(({ worker }) => {
      worker.terminate();
    });
    this.workers.clear();
  }
}

// Simple ProgressiveLoader with steps support
class ProgressiveLoader {
  constructor() {
    this.loadQueue = [];
    this.loadingSteps = [];
    this.currentStep = 0;
  }
  
  add(item) {
    this.loadQueue.push(item);
  }
  
  defineSteps(steps) {
    this.loadingSteps = steps;
  }
  
  process() {
    // Simple progressive loading
    const batch = this.loadQueue.splice(0, 10);
    return Promise.resolve(batch);
  }
  
  async executeSteps() {
    for (const step of this.loadingSteps) {
      try {
        if (step.loader) {
          await step.loader();
        }
      } catch (error) {
        console.warn(`Progressive loader step ${step.name} failed:`, error);
      }
    }
  }
}

// Create map-specific instances
const boundsCalculator = new BoundsCalculator();
const sourceUpdater = new SourceUpdateManager();
const dataLoader = new DataLoader();
const dataStore = new DataStore();
const workerManager = new WorkerManager();
const progressiveLoader = new ProgressiveLoader();

// Detect language and RTL support
const lang = navigator.language.split('-')[0];

// RTL languages list
const rtlLanguages = ['ar', 'he', 'fa', 'ur', 'yi'];

// Check if current language is RTL
const isRTL = rtlLanguages.includes(lang);

// Initialize Mapbox GL with correct access token
mapboxgl.accessToken = "pk.eyJ1Ijoibml0YWloYXJkeSIsImEiOiJjbWRzNGIxemIwMHVsMm1zaWp3aDl2Y3RsIn0.l_GLzIUCO84SF5_4TcmF3g";

// Enhanced RTL text support for multiple languages
if (rtlLanguages.includes(lang)) {
  document.documentElement.setAttribute('dir', 'rtl');
  mapboxgl.setRTLTextPlugin(
    "https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.3.0/mapbox-gl-rtl-text.js",
    null,
    true // Lazy load the plugin
  );
}

// Create the map with correct style
const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/nitaihardy/cmdp8fjw100ex01s83b2d6jzf",
  center: isMobile ? [34.85, 31.7] : [35.22, 31.85], // Mobile: both West Bank & Gaza, Desktop: West Bank focused
  zoom: isMobile ? 7.1 : 8.33,
  language: ['en','es','fr','de','zh','ja','ru','ar','he','fa','ur'].includes(lang) ? lang : 'en'
});

// Add scale control
const scaleControl = new mapboxgl.ScaleControl({
  maxWidth: 80,
  unit: 'metric'
});

const imperialScaleControl = new mapboxgl.ScaleControl({
  maxWidth: 80,
  unit: 'imperial'
});

const scalePosition = window.innerWidth <= 478 ? 'bottom-left' : 'bottom-right';
map.addControl(scaleControl, scalePosition);
map.addControl(imperialScaleControl, scalePosition);

// Custom reset control
class MapResetControl {
  onAdd(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
    
    const button = document.createElement('button');
    button.className = 'mapboxgl-ctrl-icon';
    button.type = 'button';
    button.title = 'Reset map view';
    button.innerHTML = '⟲';
    button.style.fontSize = '20px';
    button.style.lineHeight = '29px';
    
    button.onclick = () => {
      map.flyTo({
        center: isMobile ? [34.85, 31.7] : [35.22, 31.85],
        zoom: isMobile ? 7.1 : 8.33,
        duration: 1000
      });
    };
    
    this._container.appendChild(button);
    return this._container;
  }
  
  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
  }
}

map.addControl(new MapResetControl(), 'top-right');

// Map utilities
const mapUtils = {
  setStyles: (el, styles) => {
    if (!el) return;
    requestAnimationFrame(() => {
      Object.assign(el.style, styles);
    });
  },
  
  debounce: (fn, delay) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },
  
  throttle: (fn, limit) => {
    let inThrottle;
    return (...args) => {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },
  
  formatNumber: (num) => {
    return new Intl.NumberFormat(lang).format(num);
  },
  
  formatDistance: (meters) => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  },
  
  calculateBounds: (features) => {
    const bounds = new mapboxgl.LngLatBounds();
    features.forEach(feature => {
      if (feature.geometry.type === 'Point') {
        bounds.extend(feature.geometry.coordinates);
      }
    });
    return bounds;
  }
};

// OPTIMIZED: Map layer management
class OptimizedMapLayers {
  constructor(map) {
    this.map = map;
    this.layerCache = new Map();
    this.sourceCache = new Map();
    this.layerOrder = [];
    this.batchQueue = [];
    this.batchTimer = null;
  }
  
  // Check if layer exists
  hasLayer(layerId) {
    if (this.layerCache.has(layerId)) {
      return this.layerCache.get(layerId);
    }
    const exists = this.map.getLayer(layerId) !== undefined;
    this.layerCache.set(layerId, exists);
    return exists;
  }
  
  // Check if source exists
  hasSource(sourceId) {
    if (this.sourceCache.has(sourceId)) {
      return this.sourceCache.get(sourceId);
    }
    const exists = this.map.getSource(sourceId) !== undefined;
    this.sourceCache.set(sourceId, exists);
    return exists;
  }
  
  // Batch layer operations
  addToBatch(operation) {
    this.batchQueue.push(operation);
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    
    this.batchTimer = setTimeout(() => {
      this.executeBatch();
    }, 10);
  }
  
  // Execute batched operations
  executeBatch() {
    if (this.batchQueue.length === 0) return;
    
    // Group operations by type
    const operations = [...this.batchQueue];
    this.batchQueue = [];
    
    // Execute all operations
    operations.forEach(op => op());
    
    // Clear timer
    this.batchTimer = null;
  }
  
  // Optimize layer order for performance
  optimizeLayerOrder() {
    const layers = this.map.getStyle().layers;
    const optimizedOrder = [];
    
    // Group layers by type
    const groups = {
      background: [],
      fill: [],
      line: [],
      symbol: [],
      circle: [],
      other: []
    };
    
    layers.forEach(layer => {
      const group = groups[layer.type] || groups.other;
      group.push(layer);
    });
    
    // Optimal order: background -> fill -> line -> circle -> symbol
    optimizedOrder.push(...groups.background);
    optimizedOrder.push(...groups.fill);
    optimizedOrder.push(...groups.line);
    optimizedOrder.push(...groups.circle);
    optimizedOrder.push(...groups.symbol);
    optimizedOrder.push(...groups.other);
    
    this.layerOrder = optimizedOrder.map(l => l.id);
  }
}

const mapLayers = new OptimizedMapLayers(map);

// ====================================================================
// MAP EVENT HANDLERS AND FINAL INITIALIZATION
// ====================================================================

// When map loads, initialize everything
map.on('load', () => {
  loadingTracker.markComplete('mapLoaded');
  init();
  loadCombinedGeoData();
  setupDeferredAreaControls();
  initializeOptimizationSystems();
  
  // Use shared-core checkbox generation
  if (window.SharedCore) {
    window.SharedCore.generateLocalityCheckboxes();
    window.SharedCore.generateSettlementCheckboxes();
  }
  generateRegionCheckboxes(); // This one is map-specific
});

// ====================================================================
// DOM READY HANDLERS
// ====================================================================

document.addEventListener('DOMContentLoaded', () => {
  setupSidebars();
  setupBackToTopButton();
  
  // Enhanced tag monitoring initialization
  state.setTimer('initMonitorTags', () => {
    if (window.SharedCore && window.SharedCore.monitorTags) {
      window.SharedCore.monitorTags();
    }
    
    // Mark monitoring as part of events setup
    state.setTimer('monitoringCheck', () => {
      if (!loadingTracker.states.eventsSetup) {
        loadingTracker.markComplete('eventsSetup');
      }
    }, 1000);
  }, 100);
  
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
  
  // Auto-trigger reframing with smart logic
  const checkAndReframe = () => {
    if (map.loaded() && !map.isMoving() && checkMapMarkersFiltering()) {
      state.flags.forceFilteredReframe = true;
      state.flags.isRefreshButtonAction = true;
      applyFilterToMarkers();
      state.setTimer('autoReframeCleanup', () => {
        state.flags.forceFilteredReframe = false;
        state.flags.isRefreshButtonAction = false;
      }, 1000);
      
      // Also check filtered elements when reframing
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
  
  // Additional check after page is fully loaded
  state.setTimer('loadCheckFiltered', checkAndToggleFilteredElements, 200);
});

// ====================================================================
// GLOBAL EXPORTS
// ====================================================================

// Defer global exports until after everything is initialized
function setupGlobalExports() {
  // Make functions available globally for autocomplete integration
  window.selectRegionCheckbox = selectRegionCheckbox;
  window.selectSubregionCheckbox = selectSubregionCheckbox;
  window.selectLocalityCheckbox = selectLocalityCheckbox;
  window.selectSettlementCheckbox = selectSettlementCheckbox;
  window.applyFilterToMarkers = applyFilterToMarkers;
  window.highlightBoundary = highlightBoundary;
  window.frameRegionBoundary = frameRegionBoundary;
  window.map = map;
  window.mapboxgl = mapboxgl;

  // Shared utilities for other scripts (integration optimization)
  window.mapUtilities = {
    ...window.mapUtilities, // Include shared-core utilities
    state, // Add the enhanced state for autocomplete access
    boundsCalculator,
    sourceUpdater,
    dataLoader,
    dataStore,
    workerManager,
    progressiveLoader
  };
}

// Call setupGlobalExports after map is created
setTimeout(setupGlobalExports, 0);

// ====================================================================
// CLEANUP
// ====================================================================

// Cleanup on page unload (prevent memory leaks)
window.addEventListener('beforeunload', () => {
  // Clean up all managed resources
  if (window.SharedCore) {
    window.SharedCore.eventManager.cleanup();
    window.SharedCore.state.cleanup();
    window.SharedCore.sidebarCache.invalidate();
  }
  
  // Clean up mutation observers
  const tagParent = $id('tagparent');
  if (tagParent && tagParent._mutationObserver) {
    tagParent._mutationObserver.disconnect();
  }
  
  // Clean up back to top tag observer  
  if (tagParent && tagParent._tagObserver) {
    tagParent._tagObserver.disconnect();
  }
  
  // Clean up map-specific resources
  workerManager.terminate();
  
  // Clean up map resources
  if (map) {
    map.remove();
  }
});

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
            this.setupBlurredClassHandling();
        }
        
        setupBlurredClassHandling() {
            const searchInput = document.getElementById('map-search');
            const searchIconsWrap = document.querySelector('.search-icons-wrap');
            const clearSearchWrap = document.querySelector('.clear-search-wrap');
            
            if (!searchInput) {
                // Retry if element not found
                setTimeout(() => this.setupBlurredClassHandling(), 100);
                return;
            }
            
            // Ensure blurred class is applied initially (input not focused)
            if (document.activeElement !== searchInput) {
                if (searchIconsWrap && !searchIconsWrap.classList.contains('blurred')) {
                    searchIconsWrap.classList.add('blurred');
                }
                if (clearSearchWrap && !clearSearchWrap.classList.contains('blurred')) {
                    clearSearchWrap.classList.add('blurred');
                }
            }
            
            // Handle focus - remove blurred classes
            searchInput.addEventListener('focus', () => {
                if (searchIconsWrap && searchIconsWrap.classList.contains('blurred')) {
                    searchIconsWrap.classList.remove('blurred');
                }
                if (clearSearchWrap && clearSearchWrap.classList.contains('blurred')) {
                    clearSearchWrap.classList.remove('blurred');
                }
            });
            
            // Handle blur - add blurred classes back
            searchInput.addEventListener('blur', () => {
                if (searchIconsWrap && !searchIconsWrap.classList.contains('blurred')) {
                    searchIconsWrap.classList.add('blurred');
                }
                if (clearSearchWrap && !clearSearchWrap.classList.contains('blurred')) {
                    clearSearchWrap.classList.add('blurred');
                }
            });
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
        
        autocompleteLoadState = 'loading';
        
        // Create a promise for the loading process
        loadPromise = new Promise((resolve) => {
            // Use requestIdleCallback if available, otherwise setTimeout
            const loadFunction = () => {
                try {
                    // Initialize the actual autocomplete
                    initializeFullAutocomplete();
                    autocompleteLoadState = 'loaded';
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
                    regions: [],
                    subregions: [],
                    localities: [],
                    settlements: [],
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
                
                // Load data from window state when available
                this.waitForData();
                
            }
            
            setupDropdownStructure() {
                this.elements.wrapper.innerHTML = `
                    <ul id="search-terms" class="autocomplete-list"></ul>
                `;
                
                this.elements.list = this.elements.wrapper.querySelector('.autocomplete-list');
            }
            
            waitForData() {
                // Check if data is already loaded
                const checkData = () => {
                    if (window.mapUtilities && window.mapUtilities.state) {
                        const state = window.mapUtilities.state;
                        // Wait for actual data to be loaded - now regions come from localities
                        if (state.allLocalityFeatures.length > 0 || 
                            state.allSettlementFeatures.length > 0) {
                            this.loadDataFromState();
                            return true;
                        }
                    }
                    return false;
                };
                
                // Check immediately
                if (checkData()) return;
                
                // Otherwise wait and retry
                const retryInterval = setInterval(() => {
                    if (checkData()) {
                        clearInterval(retryInterval);
                    }
                }, 500);
                
                // Stop trying after 30 seconds
                setTimeout(() => clearInterval(retryInterval), 30000);
            }
            
            loadDataFromState() {
                const state = window.mapUtilities.state;
                
                // Load regions (districts) - now from extracted data
                if (state.allRegionFeatures && state.allRegionFeatures.length > 0) {
                    this.data.regions = state.allRegionFeatures
                        .filter(feature => feature.geometry && feature.geometry.coordinates)
                        .map(feature => ({
                            name: feature.properties.name,
                            nameLower: feature.properties.name.toLowerCase(),
                            type: 'region',
                            lat: feature.geometry.coordinates[1],
                            lng: feature.geometry.coordinates[0],
                            searchTokens: this.createSearchTokens(feature.properties.name)
                        }))
                        .sort((a, b) => a.name.localeCompare(b.name));
                }
                
                // Load subregions - now from extracted data
                if (state.allSubregionFeatures && state.allSubregionFeatures.length > 0) {
                    this.data.subregions = state.allSubregionFeatures
                        .filter(feature => feature.geometry && feature.geometry.coordinates)
                        .map(feature => ({
                            name: feature.properties.name,
                            nameLower: feature.properties.name.toLowerCase(),
                            type: 'subregion',
                            lat: feature.geometry.coordinates[1],
                            lng: feature.geometry.coordinates[0],
                            searchTokens: this.createSearchTokens(feature.properties.name)
                        }))
                        .sort((a, b) => a.name.localeCompare(b.name));
                }                
                // Load localities
                if (state.allLocalityFeatures && state.allLocalityFeatures.length > 0) {
                    // Extract unique subregions
                    const subregionSet = new Set();
                    
                    this.data.localities = state.allLocalityFeatures
                        .filter(feature => feature.geometry && feature.geometry.coordinates)
                        .map(feature => {
                            const subregion = feature.properties.subRegion;
                            if (subregion) {
                                subregionSet.add(subregion);
                            }
                            
                            return {
                                name: feature.properties.name,
                                nameLower: feature.properties.name.toLowerCase(),
                                region: feature.properties.region,
                                subregion: subregion,
                                lat: feature.geometry.coordinates[1],
                                lng: feature.geometry.coordinates[0],
                                type: 'locality',
                                searchTokens: this.createSearchTokens(feature.properties.name)
                            };
                        })
                        .sort((a, b) => a.name.localeCompare(b.name));
                    
                    // Create subregions array
                    this.data.subregions = Array.from(subregionSet)
                        .filter(subregion => subregion) // Filter out null/undefined
                        .map(subregion => ({
                            name: subregion,
                            nameLower: subregion.toLowerCase(),
                            type: 'subregion',
                            searchTokens: this.createSearchTokens(subregion)
                        }))
                        .sort((a, b) => a.name.localeCompare(b.name));
                }
                
                // Load settlements
                if (state.allSettlementFeatures && state.allSettlementFeatures.length > 0) {
                    this.data.settlements = state.allSettlementFeatures
                        .filter(feature => feature.geometry && feature.geometry.coordinates)
                        .map(feature => ({
                            name: feature.properties.name,
                            nameLower: feature.properties.name.toLowerCase(),
                            type: 'settlement',
                            region: feature.properties.region,
                            subRegion: feature.properties.subRegion,
                            lat: feature.geometry.coordinates[1],
                            lng: feature.geometry.coordinates[0],
                            searchTokens: this.createSearchTokens(feature.properties.name)
                        }))
                        .sort((a, b) => a.name.localeCompare(b.name));
                }
                
                // Shuffle each category once for variety in dropdown display
                this.shuffleArray(this.data.regions);
                this.shuffleArray(this.data.subregions);
                this.shuffleArray(this.data.localities);
                this.shuffleArray(this.data.settlements);
                
                console.log('Autocomplete data loaded:', {
                    regions: this.data.regions.length,
                    subregions: this.data.subregions.length,
                    localities: this.data.localities.length,
                    settlements: this.data.settlements.length
                });
                
                // Debug: Log first few items to verify hierarchical order
                console.log('First few subregions:', this.data.subregions.slice(0, 3).map(s => s.name));
                
                // If we have data, trigger a refresh of the current search
                if (this.elements.input && this.elements.input.value) {
                    this.handleInput(this.elements.input.value);
                }
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
            
            shuffleArray(array) {
                // Fisher-Yates shuffle algorithm
                for (let i = array.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [array[i], array[j]] = [array[j], array[i]];
                }
                return array;
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
                
                // Prevent blur only when clicking on dropdown items (not the whole wrapper)
                this.elements.wrapper.addEventListener('mousedown', (e) => {
                    // Only prevent default if clicking on an actual dropdown item
                    // This allows normal blur behavior when clicking elsewhere
                    if (e.target.closest('.dropdown-item, .subregion-select, .locality-item, .settlementlistitem')) {
                        e.preventDefault();
                    }
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
                // Make sure we have data before showing items
                if (this.data.regions.length === 0 && 
                    this.data.localities.length === 0 && 
                    this.data.settlements.length === 0) {
                    // Try to load data again
                    this.loadDataFromState();
                    
                    // If still no data, return empty
                    if (this.data.regions.length === 0 && 
                        this.data.localities.length === 0 && 
                        this.data.settlements.length === 0) {
                        this.data.filteredResults = [];
                        return;
                    }
                }
                
                // Hierarchical display: Regions → Subregions → Localities → Settlements
                const results = [];
                
                // 1. Show top 2-3 regions first (most important geographic areas)
                const maxRegions = Math.min(3, this.data.regions.length);
                const selectedRegions = this.data.regions.slice(0, maxRegions);
                results.push(...selectedRegions);
                
                // 2. Show top 2-3 subregions (subdivisions of regions)
                const maxSubregions = Math.min(3, this.data.subregions.length);
                const selectedSubregions = this.data.subregions.slice(0, maxSubregions);
                results.push(...selectedSubregions);
                
                // 3. Show 4-5 major localities (important cities/towns)
                const maxLocalities = Math.min(5, this.data.localities.length);
                const selectedLocalities = this.data.localities.slice(0, maxLocalities);
                results.push(...selectedLocalities);
                
                // 4. Show 2-3 settlements (smaller communities)
                const maxSettlements = Math.min(3, this.data.settlements.length);
                const selectedSettlements = this.data.settlements.slice(0, maxSettlements);
                results.push(...selectedSettlements);
                
                // Debug: Log what we're showing
                console.log('Hierarchical results:', {
                    regions: selectedRegions.map(r => r.name),
                    subregions: selectedSubregions.map(s => s.name),
                    localities: selectedLocalities.slice(0, 2).map(l => l.name),
                    settlements: selectedSettlements.map(s => s.name)
                });
                
                this.data.filteredResults = results;
            }
            
            performSearch(searchText) {
                const startTime = performance.now();
                const searchLower = searchText.toLowerCase();
                const searchTokens = searchText.toLowerCase().split(/\s+/);
                
                const scoredResults = [];
                
                // Search all categories including settlements
                [...this.data.regions, ...this.data.subregions, ...this.data.localities, ...this.data.settlements].forEach(item => {
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
                    if (a.type !== 'locality' && a.type !== 'settlement' && (b.type === 'locality' || b.type === 'settlement')) return -1;
                    if ((a.type === 'locality' || a.type === 'settlement') && b.type !== 'locality' && b.type !== 'settlement') return 1;
                    return a.name.localeCompare(b.name);
                });
                
                // Limit regions/subregions to 3 total
                let regionCount = 0;
                const limitedResults = [];
                
                for (const result of scoredResults) {
                    if (result.type === 'region' || result.type === 'subregion') {
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
                
                if (item.type === 'locality' || item.type === 'settlement') {
                    let location = '';
                    if (item.type === 'locality') {
                        location = [item.subregion, item.region].filter(Boolean).join(', ');
                    } else if (item.type === 'settlement') {
                        location = [item.subRegion, item.region].filter(Boolean).join(', ');
                    }
                    const typeLabel = item.type === 'locality' ? 'Locality' : 'Settlement';
                    
                    a.innerHTML = `
                        <div class="locality-info">
                            <div class="locality-name">${item.name}</div>
                            ${location ? `<div class="locality-region">${location}</div>` : ''}
                        </div>
                        <span class="term-label">${typeLabel}</span>
                    `;
                } else {
                    const typeLabel = item.type === 'region' ? 'Region' : 'Sub-Region';
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
                
                if (type === 'region') {
                    this.triggerRegionSelection(term);
                } else if (type === 'subregion') {
                    this.triggerSubregionSelection(term);
                } else if (type === 'locality') {
                    this.triggerLocalitySelection(term);
                } else if (type === 'settlement') {
                    this.triggerSettlementSelection(term);
                }
            }
            
            triggerSettlementSelection(settlementName) {
                // Set marker click flag
                window.isMarkerClick = true;
                
                if (window.mapUtilities && window.mapUtilities.state) {
                    window.mapUtilities.state.markerInteractionLock = false;
                }
                
                // Use checkbox selection for settlements
                if (window.selectSettlementCheckbox) {
                    window.selectSettlementCheckbox(settlementName);
                }
                
                if (window.SharedCore?.checkAndToggleFilteredElements) {
                    window.SharedCore.checkAndToggleFilteredElements(true);
                }
                
                if (window.innerWidth > 478 && window.SharedCore?.toggleSidebar) {
                    window.SharedCore.toggleSidebar('Left', true);
                }
                
                // Find settlement and fly to it
                const settlement = this.data.settlements.find(s => s.name === settlementName);
                if (window.map && settlement && settlement.lat && settlement.lng) {
                    window.map.flyTo({
                        center: [settlement.lng, settlement.lat],
                        zoom: 13.5,
                        duration: 1000,
                        essential: true
                    });
                }
                
                // Clean up flag
                setTimeout(() => {
                    window.isMarkerClick = false;
                }, 800);
            }
            
            triggerRegionSelection(regionName) {
                window.isMarkerClick = true;
                
                if (window.mapUtilities && window.mapUtilities.state) {
                    window.mapUtilities.state.markerInteractionLock = false;
                }
                
                if (window.selectRegionCheckbox) {
                    window.selectRegionCheckbox(regionName);
                }
                
                if (window.SharedCore?.checkAndToggleFilteredElements) {
                    window.SharedCore.checkAndToggleFilteredElements(true);
                }
                
                if (window.innerWidth > 478 && window.SharedCore?.toggleSidebar) {
                    window.SharedCore.toggleSidebar('Left', true);
                }
                
                // Highlight and frame region boundary
                if (window.highlightBoundary) {
                    window.highlightBoundary(regionName);
                }
                
                // Use the global function to frame region boundaries
                if (window.frameRegionBoundary) {
                    if (!window.frameRegionBoundary(regionName)) {
                        // No boundary found - fallback to filtered reframing
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
                } else {
                    // Fallback if frameRegionBoundary doesn't exist
                    setTimeout(() => {
                        window.isMarkerClick = false;
                        if (window.applyFilterToMarkers) {
                            window.applyFilterToMarkers();
                        }
                    }, 100);
                }
                
                setTimeout(() => {
                    window.isMarkerClick = false;
                }, 800);
            }
            
            triggerSubregionSelection(subregionName) {
                window.isMarkerClick = true;
                
                if (window.mapUtilities && window.mapUtilities.state) {
                    window.mapUtilities.state.markerInteractionLock = false;
                }
                
                // Use checkbox selection like regions do
                if (window.selectSubregionCheckbox) {
                    window.selectSubregionCheckbox(subregionName);
                }
                
                if (window.SharedCore?.checkAndToggleFilteredElements) {
                    window.SharedCore.checkAndToggleFilteredElements(true);
                }
                
                if (window.innerWidth > 478 && window.SharedCore?.toggleSidebar) {
                    window.SharedCore.toggleSidebar('Left', true);
                }
                
                // Trigger filtering with reframe for subregions - increased delay to ensure checkbox update
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
                }, 400);
                
                setTimeout(() => {
                    window.isMarkerClick = false;
                }, 800);
            }
            
            triggerLocalitySelection(localityName) {
                window.isMarkerClick = true;
                
                if (window.mapUtilities && window.mapUtilities.state) {
                    window.mapUtilities.state.markerInteractionLock = false;
                }
                
                if (window.selectLocalityCheckbox) {
                    window.selectLocalityCheckbox(localityName);
                }
                
                if (window.SharedCore?.checkAndToggleFilteredElements) {
                    window.SharedCore.checkAndToggleFilteredElements(true);
                }
                
                if (window.innerWidth > 478 && window.SharedCore?.toggleSidebar) {
                    window.SharedCore.toggleSidebar('Left', true);
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
                // Blurred classes are already handled by the stub
                // Just handle autocomplete-specific functionality
                
                if (this.elements.input.value.length === 0) {
                    this.showAllItems();
                    this.renderResults();
                }
                
                this.showDropdown();
            }
            
            handleBlur() {
                // Blurred classes are already handled by the stub
                // Just hide the dropdown
                this.hideDropdown();
            }
            
            handleClear() {
                if (this.elements.input.value) {
                    this.elements.input.value = '';
                    this.hideDropdown();
                    
                    // Only refocus on desktop or if not on iOS Safari
                    // iOS Safari has issues with programmatic focus after UI interactions
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                    const isMobileSafari = isIOS && /WebKit/.test(navigator.userAgent) && !/CriOS/.test(navigator.userAgent);
                    
                    if (!isMobileSafari) {
                        this.elements.input.focus();
                    }
                    
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
                        
                        .list-term.region-term,
                        .list-term.subregion-term {
                            font-weight: 600;
                            color: #6e3500;
                            background-color: #fdf6f0;
                            border-left: 3px solid #6e3500;
                        }
                        
                        .list-term.region-term:hover,
                        .list-term.subregion-term:hover {
                            background-color: #f5e6d3;
                        }
                        
                        .list-term.region-term .term-label,
                        .list-term.subregion-term .term-label {
                            color: #8f4500;
                        }
                        
                        .list-term.locality-term {
                            font-weight: 500;
                            color: #7e7800;
                            background-color: #f9f8e6;
                            border-left: 3px solid #7e7800;
                            padding: 10px 12px;
                        }
                        
                        .list-term.locality-term:hover { background-color: #f0eecc; }
                        .list-term.locality-term * { pointer-events: none; }
                        .list-term.locality-term .term-label { color: #a49c00; }
                        
                        .list-term.settlement-term {
                            font-weight: 500;
                            color: #444B5C;
                            background-color: #f5f7fa;
                            border-left: 3px solid #444B5C;
                            padding: 10px 12px;
                        }
                        
                        .list-term.settlement-term:hover { background-color: #e8ecf2; }
                        .list-term.settlement-term * { pointer-events: none; }
                        .list-term.settlement-term .term-label { color: #444B5C; }
                        
                        .list-term.settlement-term .locality-name {
                            color: #444B5C;
                        }
                        
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
                console.log('Refreshing autocomplete data...');
                
                // Clear any cached results to force fresh data
                this.cache.clear();
                this.data.filteredResults = [];
                
                // Reload data from state
                this.loadDataFromState();
                
                // If dropdown is visible, update it
                if (this.isDropdownVisible()) {
                    this.handleInput(this.elements.input.value);
                } else if (document.activeElement === this.elements.input && !this.elements.input.value) {
                    // If input is focused but empty, show all items with new data
                    this.showAllItems();
                    this.renderResults();
                    if (this.data.filteredResults.length > 0) {
                        this.showDropdown();
                    }
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
                    totalItems: this.data.regions.length + this.data.subregions.length + this.data.localities.length + this.data.settlements.length,
                    regions: this.data.regions.length,
                    subregions: this.data.subregions.length,
                    localities: this.data.localities.length,
                    settlements: this.data.settlements.length,
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

console.log('Complete Mapbox script loaded - using SharedCore utilities');
