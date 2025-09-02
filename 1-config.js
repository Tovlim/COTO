/**
 * MAPBOX INTEGRATED SCRIPT - CONFIGURATION
 * Configuration constants and settings
 */

const APP_CONFIG = {
  cache: {
    duration: 10080, // 7 days in minutes
    maxRecentSearches: 10,
    storagePrefix: 'mapCache_',
    metaPrefix: 'mapMeta_'
  },
  timeouts: {
    debounce: 50,
    filterUpdate: 200,
    refreshDelay: 600,
    mapReady: 3000,
    idle: 5000
  },
  urls: {
    localities: 'https://raw.githubusercontent.com/Tovlim/COTO/refs/heads/main/localities-0.010.geojson',
    settlements: 'https://raw.githubusercontent.com/Tovlim/COTO/refs/heads/main/settlements-0.006.geojson'
  },
  features: {
    enableCache: true,
    enableRecentSearches: true,
    enableMemoization: true,
    enableLazyCheckboxes: true
  },
  breakpoints: {
    mobile: 478,
    tablet: 991,
    desktop: 992
  },
  ui: {
    scoreThreshold: 0.3,
    maxResults: 50,
    sidebarWidth: 300
  }
};

// Mapbox configuration
const MAPBOX_CONFIG = {
  accessToken: "pk.eyJ1Ijoibml0YWloYXJkeSIsImEiOiJjbWRzNGIxemIwMHVsMm1zaWp3aDl2Y3RsIn0.l_GLzIUCO84SF5_4TcmF3g",
  style: "mapbox://styles/occupationcrimes/cmeo2b3yu000601sf4sr066j9",
  bounds: [
    [34.15033592116498, 31.16632630001915], // Southwest coordinates
    [35.70311064830133, 32.60506354440827]  // Northeast coordinates
  ],
  rtlLanguages: ['ar', 'he', 'fa', 'ur', 'yi']
};