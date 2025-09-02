/**
 * MAPBOX INTEGRATED SCRIPT - FILTERS
 * Filter functionality, filter application, and checkbox selection
 */

// ========================
// SOURCE UPDATER
// ========================
const sourceUpdater = {
  pendingUpdates: new Map(),
  updateQueue: [],
  isProcessing: false,
  
  updateSource(sourceId, data) {
    // Batch updates for performance
    this.pendingUpdates.set(sourceId, data);
    
    if (!this.isProcessing) {
      this.isProcessing = true;
      requestAnimationFrame(() => this.processUpdates());
    }
  },
  
  processUpdates() {
    this.pendingUpdates.forEach((data, sourceId) => {
      if (map.getSource(sourceId)) {
        map.getSource(sourceId).setData(data);
      }
    });
    
    this.pendingUpdates.clear();
    this.isProcessing = false;
  }
};

// ========================
// FILTER APPLICATION
// ========================
function applyFilterToMarkers(shouldReframe = true) {
  if (state.flags.isInitialLoad && !checkMapMarkersFiltering()) return;
  
  if (state.flags.skipNextReframe) {
    return;
  }
  
  // Get checked checkboxes - force fresh DOM query
  const checkedRegions = Array.from(document.querySelectorAll('[checkbox-filter="Governorate"] input:checked')).map(cb => cb.getAttribute('fs-list-value'));
  const checkedSubregions = Array.from(document.querySelectorAll('[checkbox-filter="Region"] input:checked')).map(cb => cb.getAttribute('fs-list-value'));
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
        visibleCoordinates = [subregionFeature.geometry.coordinates];
      }
    } else {
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
    
    // For single region selection, use region centroid
    if (checkedRegions.length === 1 && state.allRegionFeatures) {
      const selectedRegion = checkedRegions[0];
      const regionFeature = state.allRegionFeatures.find(f => 
        f.properties.name === selectedRegion
      );
      
      if (regionFeature) {
        visibleCoordinates = [regionFeature.geometry.coordinates];
      }
    } else {
      visibleCoordinates = filteredLocalities.map(f => f.geometry.coordinates);
    }
  } else {
    // No location filters - show all localities
    if (mapLayers.hasSource('localities-source')) {
      sourceUpdater.updateSource('localities-source', state.locationData);
    }
    visibleCoordinates = state.allLocalityFeatures.map(f => f.geometry.coordinates);
  }
  
  // Filter settlements based on checkboxes
  if (checkedSettlements.length > 0) {
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
    visibleCoordinates = visibleCoordinates.concat(
      filteredSettlements.map(f => f.geometry.coordinates)
    );
  } else if (checkedLocalities.length > 0 || checkedRegions.length > 0 || checkedSubregions.length > 0) {
    // Hide settlements when location filters are active but no settlements selected
    if (mapLayers.hasSource('settlements-source')) {
      sourceUpdater.updateSource('settlements-source', {
        type: "FeatureCollection",
        features: []
      });
    }
  } else {
    // No filters - show all settlements
    if (mapLayers.hasSource('settlements-source')) {
      sourceUpdater.updateSource('settlements-source', state.settlementData);
    }
  }
  
  // Frame visible markers if needed
  if (shouldReframe && visibleCoordinates.length > 0 && !state.markerInteractionLock) {
    const shouldForceReframe = state.flags.forceFilteredReframe || 
                              state.flags.isRefreshButtonAction || 
                              (checkedLocalities.length + checkedSettlements.length + checkedRegions.length + checkedSubregions.length) > 0;
    
    if (shouldForceReframe) {
      const bounds = new mapboxgl.LngLatBounds();
      visibleCoordinates.forEach(coord => bounds.extend(coord));
      
      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: isMobile ? 40 : 80,
          duration: 1000,
          maxZoom: visibleCoordinates.length === 1 ? 13 : 11
        });
      }
    }
  }
  
  // Reset flags after processing
  state.flags.forceFilteredReframe = false;
  state.flags.isRefreshButtonAction = false;
}

// ========================
// FILTER UPDATE HANDLER
// ========================
const handleFilterUpdate = eventManager.debounce(() => {
  if (window.isLinkClick || window.isMarkerClick || state.markerInteractionLock) return;
  if (state.flags.skipNextReframe) return;
  
  state.flags.isRefreshButtonAction = true;
  applyFilterToMarkers();
  state.setTimer('filterCleanup', () => {
    state.flags.isRefreshButtonAction = false;
  }, 1000);
}, 150, 'filterUpdate');

// ========================
// FILTER CHECKING
// ========================
function checkMapMarkersFiltering() {
  const allCheckboxes = document.querySelectorAll(`
    [checkbox-filter="Governorate"] input:checked,
    [checkbox-filter="Region"] input:checked,
    [checkbox-filter="locality"] input:checked,
    [checkbox-filter="settlement"] input:checked
  `);
  
  return allCheckboxes.length > 0;
}

// ========================
// FILTERED ELEMENTS MANAGEMENT
// ========================
// Check and toggle filtered elements
const checkAndToggleFilteredElements = () => {
  // Check for hiddentagparent (Finsweet official filtering indicator)
  const hiddenTagParent = document.getElementById('hiddentagparent');
  const shouldShow = !!hiddenTagParent;
  
  toggleShowWhenFilteredElements(shouldShow);
  return shouldShow;
};

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

// Enhanced tag monitoring with proper cleanup
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
    
    // Monitor checkboxes for changes that might indicate filtering
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      if (!checkbox.dataset.filteredElementListener) {
        eventManager.add(checkbox, 'change', () => {
          IdleExecution.scheduleUI(checkAndToggleFilteredElements);
        });
        checkbox.dataset.filteredElementListener = 'true';
      }
    });
    
    // Additional monitoring: Watch for form changes that might indicate filtering
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      if (!form.dataset.filteredElementListener) {
        eventManager.add(form, 'change', () => {
          IdleExecution.scheduleUI(checkAndToggleFilteredElements, { fallbackDelay: 100 });
        });
        eventManager.add(form, 'input', () => {
          IdleExecution.scheduleUI(checkAndToggleFilteredElements, { fallbackDelay: 100 });
        });
        form.dataset.filteredElementListener = 'true';
      }
    });
    
    // Fallback polling that doesn't recursively call monitorTags
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
    
    // Return cleanup function
    return cleanup;
  };
})();

// ========================
// CHECKBOX SELECTION
// ========================
// Unified checkbox selection function
function selectCheckbox(type, value) {
  const checkboxTypes = ['Governorate', 'Region', 'locality', 'settlement', 'territory'];
  
  requestAnimationFrame(() => {
    // Get all checkbox groups - using native queries to avoid caching
    const allCheckboxes = checkboxTypes.flatMap(checkboxType => 
      Array.from(document.querySelectorAll(`[checkbox-filter="${checkboxType}"] input[fs-list-value]`))
    );
    
    // Uncheck all other checkboxes first (only one location selection allowed)
    allCheckboxes.forEach(checkbox => {
      const checkboxType = checkbox.closest('[checkbox-filter]')?.getAttribute('checkbox-filter');
      const checkboxValue = checkbox.getAttribute('fs-list-value');
      
      if (checkboxType === type && checkboxValue === value) {
        // This is the checkbox we want to check
        checkbox.checked = true;
        utils.triggerEvent(checkbox, ['change', 'input']);
      } else {
        // Uncheck all others
        checkbox.checked = false;
        utils.triggerEvent(checkbox, ['change', 'input']);
      }
    });
  });
}

// Specific selection functions
function selectLocalityCheckbox(localityName) {
  selectCheckbox('locality', localityName);
}

function selectSettlementCheckbox(settlementName) {
  selectCheckbox('settlement', settlementName);
}

function selectRegionCheckbox(regionName) {
  selectCheckbox('Governorate', regionName);
}

function selectSubregionCheckbox(subregionName) {
  selectCheckbox('Region', subregionName);
}

function selectTerritoryCheckbox(territoryName) {
  selectCheckbox('territory', territoryName);
}

// ========================
// GLOBAL AVAILABILITY
// ========================
// Make functions globally available
window.applyFilterToMarkers = applyFilterToMarkers;
window.handleFilterUpdate = handleFilterUpdate;
window.checkMapMarkersFiltering = checkMapMarkersFiltering;
window.checkAndToggleFilteredElements = checkAndToggleFilteredElements;
window.toggleShowWhenFilteredElements = toggleShowWhenFilteredElements;
window.monitorTags = monitorTags;
window.selectCheckbox = selectCheckbox;
window.selectLocalityCheckbox = selectLocalityCheckbox;
window.selectSettlementCheckbox = selectSettlementCheckbox;
window.selectRegionCheckbox = selectRegionCheckbox;
window.selectSubregionCheckbox = selectSubregionCheckbox;
window.selectTerritoryCheckbox = selectTerritoryCheckbox;
window.sourceUpdater = sourceUpdater;