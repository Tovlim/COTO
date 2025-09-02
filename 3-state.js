/**
 * MAPBOX INTEGRATED SCRIPT - STATE MANAGEMENT
 * State management classes and global state instance
 */

// ========================
// LAZY CHECKBOX STATE
// ========================
const LazyCheckboxState = {
  generatedCheckboxes: new Set(), // Track which checkboxes exist
  localitiesFullyGenerated: false,
  settlementsFullyGenerated: false,
  isGeneratingBulk: false,
  
  hasCheckbox(name, type) {
    return this.generatedCheckboxes.has(`${type}:${name}`);
  },
  
  addCheckbox(name, type) {
    this.generatedCheckboxes.add(`${type}:${name}`);
  },
  
  clearType(type) {
    // Remove all checkboxes of a specific type from tracking
    const toRemove = Array.from(this.generatedCheckboxes).filter(key => key.startsWith(`${type}:`));
    toRemove.forEach(key => this.generatedCheckboxes.delete(key));
    
    // Reset fully generated flag
    if (type === 'locality') this.localitiesFullyGenerated = false;
    if (type === 'settlement') this.settlementsFullyGenerated = false;
  },
  
  isFullyGenerated(type) {
    return type === 'locality' ? this.localitiesFullyGenerated : 
           type === 'settlement' ? this.settlementsFullyGenerated : false;
  },
  
  markFullyGenerated(type) {
    if (type === 'locality') this.localitiesFullyGenerated = true;
    if (type === 'settlement') this.settlementsFullyGenerated = true;
  }
};

// ========================
// OPTIMIZED MAP STATE CLASS
// ========================
class OptimizedMapState {
  constructor() {
    this.locationData = {type: "FeatureCollection", features: []};
    this.settlementData = {type: "FeatureCollection", features: []};
    this.allLocalityFeatures = [];
    this.allSettlementFeatures = [];
    this.allRegionFeatures = [];
    this.allSubregionFeatures = [];
    this.timers = new Map();
    this.lastClickedMarker = null;
    this.lastClickTime = 0;
    this.markerInteractionLock = false;
    this.highlightedBoundary = null;
    this.clickPriority = 999; // Higher number = lower priority, 999 = no click yet
    
    this.flags = new Proxy({
      isInitialLoad: true,
      mapInitialized: false,
      forceFilteredReframe: false,
      isRefreshButtonAction: false,
      dropdownListenersSetup: false,
      regionsLoaded: false,
      localitiesLoaded: false,
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
    // Clear all timers
    for (const [id, timer] of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}

// ========================
// GLOBAL STATE INSTANCES
// ========================
// Global state management
const state = new OptimizedMapState();

// Additional global variables for backwards compatibility
window.isLinkClick = false;

// Make LazyCheckboxState globally available
window.LazyCheckboxState = LazyCheckboxState;

// Make state globally available
window.state = state;