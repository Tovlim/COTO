/**
 * MAPBOX INTEGRATED SCRIPT - MAP CORE
 * Core map functionality, initialization, and basic setup
 */

// ========================
// CORE MAP VARIABLES
// ========================
// Use feature detection for mobile
const isMobile = FeatureDetection.isMobile;

// Define the bounding box for the map view
const mapBounds = [
  [34.15033592116498, 31.16632630001915], // Southwest coordinates
  [35.70311064830133, 32.60506354440827]  // Northeast coordinates
];

// ========================
// MAPBOX INITIALIZATION
// ========================
// Initialize Mapbox with enhanced RTL support
const lang = navigator.language.split('-')[0];
mapboxgl.accessToken = MAPBOX_CONFIG.accessToken;

// Enhanced RTL text support for multiple languages
if (MAPBOX_CONFIG.rtlLanguages.includes(lang)) {
  mapboxgl.setRTLTextPlugin(
    "https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.3.0/mapbox-gl-rtl-text.js",
    null,
    true // Lazy load the plugin
  );
}

// ========================
// MAP CREATION
// ========================
const map = new mapboxgl.Map({
  container: "map",
  style: MAPBOX_CONFIG.style,
  bounds: MAPBOX_CONFIG.bounds,
  fitBoundsOptions: {
    padding: isMobile ? 20 : 50 // Less padding on mobile, more on desktop
  },
  language: ['en','es','fr','de','zh','ja','ru','ar','he','fa','ur'].includes(lang) ? lang : 'en'
});

// ========================
// MAP LOAD EVENT
// ========================
// Map load event handler with parallel operations
map.on("load", () => {
  try {
    // Initialize core functionality
    if (window.init) {
      window.init();
    }
    
    // Load regions and territories immediately (they should always be visible)
    if (window.loadCombinedGeoData) {
      window.loadCombinedGeoData();
    }
    
    // Load locality data to extract region markers (but don't show locality markers yet)
    if (window.loadLocalitiesFromGeoJSON) {
      window.loadLocalitiesFromGeoJSON();
    }
    
    // Mark data as loaded for loading screen (markers are deferred)
    loadingTracker.markComplete('dataLoaded');
    
    // Mark map as ready
    loadingTracker.markComplete('mapReady');
    state.flags.mapInitialized = true;
  } catch (error) {
    const recovery = ErrorHandler.handle(error, ErrorHandler.categories.DOM, {
      operation: 'mapLoad',
      context: 'Map load event handler'
    });
    
    if (!recovery.recovered) {
      console.error('Failed to initialize map:', error);
    }
  }
});

// ========================
// MAP EVENT LISTENERS
// ========================
// Listen for map idle event to detect when rendering is complete
map.on('idle', () => {
  if (loadingTracker.onMapIdle) {
    loadingTracker.onMapIdle();
  }
});

// ========================
// MAP CONTROLS
// ========================
// Add geolocation control
map.addControl(new mapboxgl.GeolocateControl({
  positionOptions: {enableHighAccuracy: true}, 
  trackUserLocation: true, 
  showUserHeading: true
}));

// Add zoom controls (zoom in/out buttons)
map.addControl(new mapboxgl.NavigationControl({
  showCompass: false,  // Hide compass, only show zoom buttons
  showZoom: true,      // Show zoom in/out buttons
  visualizePitch: false // Hide pitch visualization
}), 'top-right');

// Add scale controls to bottom-right (desktop) or bottom-left (mobile)
const scaleControl = new mapboxgl.ScaleControl({
  maxWidth: 100,
  unit: 'metric'
});

const imperialScaleControl = new mapboxgl.ScaleControl({
  maxWidth: 100,
  unit: 'imperial'
});

const scalePosition = window.innerWidth <= 478 ? 'bottom-left' : 'bottom-right';
map.addControl(scaleControl, scalePosition);
map.addControl(imperialScaleControl, scalePosition);

// ========================
// CUSTOM MAP RESET CONTROL
// ========================
class MapResetControl {
  onAdd(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
    
    const button = document.createElement('button');
    button.className = 'mapboxgl-ctrl-icon';
    button.type = 'button';
    button.title = 'Reset map view';
    button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9.88 9.88" style="width: 20px; height: 20px; display: block; margin: auto;">
      <path fill="currentColor" d="M5.15,2.23c-.38,0-.73.07-1.05.21s-.62.34-.86.58-.44.53-.58.86-.21.68-.21,1.06v.04l.77-.75h.86l-1.95,1.88h-.02L.16,4.23h.87l.66.65c0-.47.1-.92.29-1.33s.44-.78.75-1.09.68-.55,1.1-.73.87-.27,1.34-.27.93.09,1.35.27.79.43,1.11.75.57.69.75,1.11.27.87.27,1.35-.09.93-.27,1.35-.43.79-.75,1.11-.69.57-1.11.75-.87.27-1.35.27c-.3,0-.58-.03-.83-.10s-.5-.16-.72-.27-.43-.25-.62-.4-.35-.32-.5-.5l.56-.48c.3.32.61.57.95.74s.72.25,1.15.25c.38,0,.73-.07,1.06-.21s.62-.34.86-.58.44-.53.58-.86.21-.68.21-1.06-.07-.73-.21-1.06-.34-.62-.58-.86-.53-.44-.86-.58-.68-.21-1.06-.21Z"/>
    </svg>`;
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    
    button.onclick = () => {
      map.fitBounds(mapBounds, {
        padding: isMobile ? 20 : 50,
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

// Add the custom reset control
map.addControl(new MapResetControl(), 'top-right');

// ========================
// MAP UTILITIES
// ========================
// High-performance utilities
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
    requestAnimationFrame(() => {
      Object.assign(el.style, styles);
    });
  },
  
  calculateCentroid: (() => {
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
      
      if (cache.size < 100) {
        cache.set(key, result);
      }
      
      return result;
    };
  })()
};

// ========================
// GLOBAL AVAILABILITY
// ========================
// Make map and utilities globally available
window.map = map;
window.utils = utils;
window.mapBounds = mapBounds;
window.isMobile = isMobile;
window.MapResetControl = MapResetControl;