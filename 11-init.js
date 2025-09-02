/**
 * MAPBOX INTEGRATED SCRIPT - INITIALIZATION
 * Initialization code, init function, setup functions, main execution
 */

// ========================
// DATA LOADING FUNCTIONS
// ========================
async function loadDataWithOptionalCache(url, storeName, processingType) {
  try {
    // Check cache first
    const cached = lightweightCache.get(storeName);
    if (cached && lightweightCache.isDataFresh(url)) {
      const processed = await lazyWorker.processData(processingType, cached.data);
      return processed;
    }

    // Fetch fresh data
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    
    // Cache the raw data
    lightweightCache.set(storeName, data, url);
    
    // Process and return
    const processed = await lazyWorker.processData(processingType, data);
    return processed;
  } catch (error) {
    // Fallback to cache even if stale
    const cached = lightweightCache.get(storeName);
    if (cached) {
      const processed = await lazyWorker.processData(processingType, cached.data);
      return processed;
    }
    throw error;
  }
}

// Combined GeoJSON loading with better performance
function loadCombinedGeoData() {
  fetch('https://cdn.jsdelivr.net/gh/Tovlim/COTO@main/Combined-GEOJSON-0.011.geojson')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(geoData => {
      if (!geoData.features || !Array.isArray(geoData.features)) {
        throw new Error('Invalid GeoJSON structure');
      }
      
      // Separate features by type
      const districts = [];
      const areas = [];
      const territories = [];
      
      geoData.features.forEach(feature => {
        if (feature.properties?.type === 'District') {
          districts.push(feature);
        } else if (feature.properties?.type?.startsWith('Area') || 
                   feature.properties?.name === 'Firing Zones') {
          areas.push(feature);
        } else if (feature.properties?.type === 'Territory') {
          territories.push(feature);
        }
      });
      
      // Batch process districts as regions
      mapLayers.addToBatch(() => {
        districts.forEach(districtFeature => {
          const name = districtFeature.properties.name;
          addRegionBoundaryToMap(name, districtFeature);
        });
      });
      
      // Batch process area overlays
      mapLayers.addToBatch(() => {
        areas.forEach(areaFeature => {
          const name = areaFeature.properties.name || areaFeature.properties.type;
          addAreaOverlayToMap(name, areaFeature);
        });
      });
      
      // Process territories for territory markers
      if (territories.length > 0) {
        window.territoryGeoJSON = {
          type: "FeatureCollection",
          features: territories.map(feature => ({
            type: "Feature",
            properties: {
              name: feature.properties.name,
              type: 'territory'
            },
            geometry: {
              type: "Point",
              coordinates: utils.calculateCentroid(feature.geometry.coordinates)
            }
          }))
        };
        
        // Add territory markers
        addTerritoryMarkersToMap();
        
        // Setup territory marker interactions
        if (window.setupTerritoryMarkerClicks) {
          window.setupTerritoryMarkerClicks();
        }
      }
      
      // Update region markers after processing
      state.setTimer('updateRegionMarkers', () => {
        addNativeRegionMarkers();
        
        state.setTimer('finalLayerOrder', () => mapLayers.optimizeLayerOrder(), 300);
        
      }, 100);
    })
    .catch(error => {
      console.error('Error loading combined GeoJSON:', error);
      
      // Still update region markers in case some data was loaded
      addNativeRegionMarkers();
      state.setTimer('errorLayerOrder', () => mapLayers.optimizeLayerOrder(), 300);
      
      // Continue even with error
    });
}

// Load localities from GeoJSON with enhanced processing
async function loadLocalitiesFromGeoJSON() {
  try {
    const result = await loadDataWithOptionalCache(
      APP_CONFIG.urls.localities,
      'localities',
      'processLocalities'
    );
    
    if (result && result.localities && result.features) {
      // Update state
      state.allLocalityFeatures = result.features;
      state.locationData = {
        type: "FeatureCollection", 
        features: result.features
      };
      
      // Extract region data from localities
      const regionMap = new Map();
      const subregionMap = new Map();
      
      result.localities.forEach(locality => {
        // Process regions
        if (locality.region && !regionMap.has(locality.region)) {
          const regionFeature = result.features.find(f => f.properties.region === locality.region);
          if (regionFeature) {
            regionMap.set(locality.region, {
              type: "Feature",
              properties: {
                name: locality.region,
                type: 'region'
              },
              geometry: {
                type: "Point",
                coordinates: [locality.lng, locality.lat] // Use first locality's coordinates as region center
              }
            });
          }
        }
        
        // Process subregions
        if (locality.subregion && !subregionMap.has(locality.subregion)) {
          const subregionFeature = result.features.find(f => f.properties.subRegion === locality.subregion);
          if (subregionFeature) {
            subregionMap.set(locality.subregion, {
              type: "Feature",
              properties: {
                name: locality.subregion,
                type: 'subregion'
              },
              geometry: {
                type: "Point",
                coordinates: [locality.lng, locality.lat] // Use first locality's coordinates as subregion center
              }
            });
          }
        }
      });
      
      // Convert to arrays
      state.allRegionFeatures = Array.from(regionMap.values());
      state.allSubregionFeatures = Array.from(subregionMap.values());
      
      // Add markers to map
      addLocalityMarkersToMap();
      addSubregionMarkers();
      
      // Setup marker interactions
      if (window.setupNativeMarkerClicks) {
        window.setupNativeMarkerClicks();
      }
      
      // Generate region checkboxes
      if (window.generateRegionCheckboxes) {
        generateRegionCheckboxes();
      }
      
      // Flag as loaded
      state.flags.localitiesLoaded = true;
      state.flags.regionsLoaded = true;
      
      // Load settlements after localities are loaded
      state.setTimer('loadSettlements', loadSettlementsFromCache, 300);
    }
    
  } catch (error) {
    console.error('Error loading localities:', error);
    
    // Try to continue with error handling
    ErrorHandler.handle(error, ErrorHandler.categories.NETWORK, {
      operation: 'loadLocalitiesFromGeoJSON',
      url: APP_CONFIG.urls.localities
    });
  }
}

// Load settlements from cache with worker processing
async function loadSettlementsFromCache() {
  try {
    const result = await loadDataWithOptionalCache(
      APP_CONFIG.urls.settlements,
      'settlements', 
      'processSettlements'
    );
    
    if (result && result.settlements && result.features) {
      // Update state
      state.allSettlementFeatures = result.features;
      state.settlementData = {
        type: "FeatureCollection",
        features: result.features
      };
      
      // Add settlement markers to map
      addSettlementMarkersToMap();
      
      // Setup settlement marker interactions
      if (window.setupSettlementMarkerClicks) {
        window.setupSettlementMarkerClicks();
      }
      
      // Emit settlement loaded event
      EventBus.emit('data:settlement-loaded');
    }
    
  } catch (error) {
    console.error('Error loading settlements:', error);
    
    ErrorHandler.handle(error, ErrorHandler.categories.NETWORK, {
      operation: 'loadSettlementsFromCache',
      url: APP_CONFIG.urls.settlements
    });
    
    // Emit settlement error event
    EventBus.emit('data:settlement-error', error);
  }
}

// ========================
// SETUP FUNCTIONS
// ========================
// Setup core event listeners and interactions
function setupEvents() {
  // Setup event delegation patterns
  EventSetup.setupSidebarEvents();
  EventSetup.setupFilterEvents(); 
  EventSetup.setupMapFilterEvents();
  EventSetup.setupFormEvents();
  EventSetup.setupFinsweetEvents();
}

// Setup dropdown listeners with retry mechanism
function setupDropdownListeners() {
  const dropdownElements = document.querySelectorAll('.dropdown-list');
  
  dropdownElements.forEach(element => {
    if (element.dataset.dropdownSetup === 'true') return;
    
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
    
    element.dataset.dropdownSetup = 'true';
  });
}

// Setup zoom-based marker loading implementation
function setupZoomBasedMarkerLoading() {
  // Mobile users get markers at lower zoom level for better experience
  const MARKER_ZOOM_THRESHOLD = window.innerWidth <= APP_CONFIG.breakpoints.mobile ? 9 : 10;
  let markersLoaded = false;
  
  async function checkZoomAndLoadMarkers() {
    const currentZoom = map.getZoom();
    
    if (currentZoom >= MARKER_ZOOM_THRESHOLD && !markersLoaded) {
      // Load markers only when zoomed in enough
      markersLoaded = true;
      
      // Load settlement data if not already loaded (localities loaded on initial load)
      if (!state.allSettlementFeatures || state.allSettlementFeatures.length === 0) {
        try {
          await loadSettlementsFromCache();
          EventBus.emit('data:settlement-loaded');
        } catch (error) {
          console.error('Error loading settlement data:', error);
          EventBus.emit('data:settlement-error', error);
        }
      }
      
      // Layers now use opacity interpolation for smooth fade in/out
      // No need to toggle visibility - opacity handles the transition
    } else if (currentZoom < MARKER_ZOOM_THRESHOLD) {
      // Reset flag so data can be loaded again when zooming back in
      markersLoaded = false;
    }
  }
  
  // Listen to zoom events
  map.on('zoom', checkZoomAndLoadMarkers);
  map.on('zoomend', checkZoomAndLoadMarkers);
  
  // Initial check when map is ready
  if (map.isStyleLoaded()) {
    checkZoomAndLoadMarkers();
  } else {
    map.on('style.load', checkZoomAndLoadMarkers);
  }
}

// Setup back to top button functionality
function setupBackToTopButton() {
  const button = document.getElementById('jump-to-top');
  const scrollContainer = document.getElementById('scroll-wrap');
  
  if (!button || !scrollContainer) {
    return;
  }
  
  // Initialize button state
  button.style.display = 'none';
  
  // Setup scroll listener
  let scrollTimer;
  const handleScroll = () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const shouldShow = scrollContainer.scrollTop > 300;
      button.style.display = shouldShow ? 'flex' : 'none';
    }, 100);
  };
  
  scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
  
  // Setup click handler
  eventManager.add(button, 'click', (e) => {
    e.preventDefault();
    scrollContainer.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

// Setup deferred area controls
function setupDeferredAreaControls() {
  // Check if controls already setup
  if (state.flags.areaControlsSetup) return;
  
  const areaControls = [
    {keyId: 'area-a-key', layerId: 'area-a-layer', wrapId: 'area-a-key-wrap', type: 'area'},
    {keyId: 'area-b-key', layerId: 'area-b-layer', wrapId: 'area-b-key-wrap', type: 'area'},
    {keyId: 'area-c-key', layerId: 'area-c-layer', wrapId: 'area-c-key-wrap', type: 'area'},
    {keyId: 'firing-zones-key', layerId: 'firing-zones-layer', wrapId: 'firing-zones-key-wrap', type: 'area'},
    {keyId: 'territory-key', layerId: 'territory-points', wrapId: 'territory-key-wrap', type: 'territory'},
    {keyId: 'region-key', layerId: 'region-points', wrapId: 'region-key-wrap', type: 'region'},
    {keyId: 'locality-key', layerId: 'locality-clusters', wrapId: 'locality-key-wrap', type: 'locality'},
    {keyId: 'settlement-key', layerId: 'settlement-clusters', wrapId: 'settlement-key-wrap', type: 'settlement'}
  ];

  areaControls.forEach(control => {
    const checkbox = document.getElementById(control.keyId);
    if (!checkbox) return;
    
    // Set initial state
    checkbox.checked = false;
    
    if (!checkbox.dataset.mapboxListenerAdded) {
      const changeHandler = (e) => {
        const visibility = e.target.checked ? 'none' : 'visible';
        
        if (control.type === 'territory') {
          control.layers = [control.layerId];
          control.layers.forEach(layerId => {
            if (mapLayers.hasLayer(layerId)) {
              map.setLayoutProperty(layerId, 'visibility', visibility);
            }
          });
        } else if (control.type === 'region') {
          control.layers = [control.layerId, 'subregion-points'];
          control.layers.forEach(layerId => {
            if (mapLayers.hasLayer(layerId)) {
              map.setLayoutProperty(layerId, 'visibility', visibility);
            }
          });
          
          // Handle region boundaries
          const allLayers = map.getStyle().layers;
          allLayers.forEach(layer => {
            if (layer.id.includes('-fill') || layer.id.includes('-border')) {
              map.setLayoutProperty(layer.id, 'visibility', visibility);
            }
          });
        } else if (control.type === 'locality') {
          control.layers = [control.layerId, 'locality-points'];
          control.layers.forEach(layerId => {
            if (mapLayers.hasLayer(layerId)) {
              map.setLayoutProperty(layerId, 'visibility', visibility);
            }
          });
        } else if (control.type === 'settlement') {
          control.layers = [control.layerId, 'settlement-points'];
          control.layers.forEach(layerId => {
            if (mapLayers.hasLayer(layerId)) {
              map.setLayoutProperty(layerId, 'visibility', visibility);
            }
          });
        } else {
          // Area layers
          if (mapLayers.hasLayer(control.layerId)) {
            map.setLayoutProperty(control.layerId, 'visibility', visibility);
          }
        }
      };
      
      checkbox.addEventListener('change', changeHandler);
      checkbox.dataset.mapboxListenerAdded = 'true';
    }
  });
  
  state.flags.areaControlsSetup = true;
}

// ========================
// MAIN INITIALIZATION
// ========================
// Main initialization function
function init() {
  // Core initialization - NO marker loading on initial page load
  setupEvents();
  
  // Only load overlays and regions initially (lightweight)
  setupZoomBasedMarkerLoading();
  
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
  
  // Setup zoom-based marker loading
  setupZoomBasedMarkerLoading();
  
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

// ========================
// GLOBAL EXPORTS
// ========================
function setupGlobalExports() {
  // Create global mapUtilities object
  window.mapUtilities = {
    // Core state and management
    state: state,
    cache: lightweightCache,
    eventManager: eventManager,
    
    // Sidebar operations
    sidebar: {
      toggle: toggleSidebar,
      close: closeSidebar
    },
    elements: {
      check: checkAndToggleFilteredElements,
      toggleFiltered: toggleShowWhenFilteredElements
    },
    
    // Map integration
    map: {
      instance: map,
      layers: mapLayers,
      operations: {
        applyFilter: applyFilterToMarkers,
        frameRegionBoundary: frameRegionBoundary
      }
    },
    
    // Debugging & development
    debug: {
      worker: lazyWorker,
      config: APP_CONFIG
    },
    
    // Metadata
    version: '2.1.0',
    build: 'Ultra Performance with Lazy Loading + Sidebar Optimizations',
    features: APP_CONFIG.features
  };
  
  // Create compact global exports
  window.mapState = {
    state,
    mapLayers,
    sidebarCache,
    toggleSidebar,
    closeSidebar,
    checkAndToggleFilteredElements,
    toggleShowWhenFilteredElements,
    lightweightCache,
    lazyWorker
  };
}

// ========================
// EVENT LISTENERS AND MAIN EXECUTION
// ========================
// DOM ready handlers
document.addEventListener('DOMContentLoaded', () => {
  // Initialize global instances
  lightweightCache = new LightweightCache();
  lazyWorker = new LazyWorkerManager();
  
  // Setup core functionality
  initializeSidebars();
  setupBackToTopButton();
  
  // Enhanced tag monitoring initialization
  state.setTimer('initMonitorTags', () => {
    monitorTags();
  }, 100);
  
  // Early UI readiness checks
  state.setTimer('earlyUICheck', () => {
    // Check UI elements early
  }, 2000);
});

window.addEventListener('load', () => {
  // Fallback sidebar setup
  initializeSidebars();
  setupBackToTopButton();
  
  // Fallback initialization
  state.setTimer('loadFallbackInit', () => {
    if (!state.allLocalityFeatures.length && map.loaded()) {
      try { 
        init(); 
      } catch (error) { 
        console.error('Fallback init error:', error);
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

// Setup global exports during idle time
IdleExecution.scheduleUI(setupGlobalExports, { fallbackDelay: 0 });

// Cleanup on page unload (prevent memory leaks)
window.addEventListener('beforeunload', () => {
  // Clean up all managed resources
  eventManager.destroy();
  state.cleanup();
  sidebarCache.invalidate();
  
  // Clean up mutation observers
  const tagParent = document.getElementById('tagparent');
  if (tagParent && tagParent._mutationObserver) {
    tagParent._mutationObserver.disconnect();
  }
  
  // Clean up back to top tag observer  
  if (tagParent && tagParent._tagObserver) {
    tagParent._tagObserver.disconnect();
  }
  
  // Terminate worker
  if (lazyWorker) {
    lazyWorker.terminate();
  }
  
  // Remove map instance
  if (map) {
    map.remove();
  }
});

// ========================
// GLOBAL AVAILABILITY
// ========================
// Make functions globally available
window.init = init;
window.setupEvents = setupEvents;
window.setupDropdownListeners = setupDropdownListeners;
window.setupZoomBasedMarkerLoading = setupZoomBasedMarkerLoading;
window.setupBackToTopButton = setupBackToTopButton;
window.setupDeferredAreaControls = setupDeferredAreaControls;
window.loadCombinedGeoData = loadCombinedGeoData;
window.loadLocalitiesFromGeoJSON = loadLocalitiesFromGeoJSON;
window.loadSettlementsFromCache = loadSettlementsFromCache;
window.loadDataWithOptionalCache = loadDataWithOptionalCache;
window.setupGlobalExports = setupGlobalExports;