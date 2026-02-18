// ====================================================================
// MAPBOX SIMPLIFIED - Lightweight Map Module
// Version: 1.1.0
//
// Works with:
//   - webflow-cms-client-mini-reports-with-filters.js
//   - feed-sidebars-0.0.3.js
//
// Features:
//   - Mapbox GL initialization with custom style
//   - Navigation controls (zoom +/-)
//   - Language-aware map labels
//   - Israel-Palestine region bounds
//   - Territory, District, Region, Subregion markers
//   - Settlement markers (blue)
//   - Locality markers (green)
//   - Area overlays (Area A/B/C, Firing Zones)
//   - District/Region boundaries
//   - Hover effects
//
// Not included (handled elsewhere):
//   - Filtering/checkbox logic (use webflow-cms-client)
//   - Sidebar management (handled by feed-sidebars)
//   - Autocomplete search
// ====================================================================

(function(window) {
  'use strict';

  // Skip initialization if already loaded
  if (window.MapboxCore) return;

  // ====================================================================
  // CONFIGURATION
  // ====================================================================
  const CONFIG = {
    CONTAINER: 'map',
    STYLE: 'mapbox://styles/occupationcrimes/cml1ci8xq003t01qs8tcdcyez',
    ACCESS_TOKEN: 'pk.eyJ1Ijoib2NjdXBhdGlvbmNyaW1lcyIsImEiOiJjbWplazA5cnIwZ2tzM2RzaG80cml4YzB6In0.yzU0BCFtPp5Mlwwsnb9CFw',

    // Israel-Palestine region bounds
    BOUNDS: [
      [34.2654, 29.5013], // Southwest (southern tip near Eilat)
      [35.8950, 33.2774]  // Northeast (northern border with Lebanon)
    ],

    // Data URLs
    URLS: {
      combined: 'https://raw.githubusercontent.com/Tovlim/COTO/main/boundaries.geojson',
      localities: 'https://webflow-geojson.occupation-crimes.workers.dev/',
      settlements: 'https://webflow-settlements-geojson.occupation-crimes.workers.dev/',
      // Combined locations worker with filtering support
      locations: 'https://webflow-locations-worker.occupation-crimes.workers.dev/'
    },

    // Supported languages for map labels
    SUPPORTED_LANGUAGES: ['en', 'es', 'fr', 'de', 'zh', 'ja', 'ru', 'ar', 'he', 'fa', 'ur'],

    // Breakpoints
    MOBILE_BREAKPOINT: 478,

    // Area overlay colors
    AREA_COLORS: {
      'Area A': '#adc278',
      'Area B': '#ffdcc6',
      'Area C': '#889c9b',
      'Firing Zones': '#c51d3c'
    },

    // Grayscale base map: true = desaturate all base style layers to B&W
    GRAYSCALE_BASE: true,

    // Marker colors (light map style)
    COLORS: {
      textHalo: '#ffffff',
      boundary: '#ff668c'
    },

    // Zoom tier thresholds for mutually exclusive marker visibility
    // Group 1: Territories (visible at low zoom, fade out before Group 2)
    // Group 2: Districts/Regions/Subregions (visible at medium zoom)
    // Group 3: Localities/Settlements (visible at high zoom)
    ZOOM_TIERS: {
      // Group 1 → Group 2 transition
      territoriesFadeOut: { start: 7.5, end: 8 },
      regionsDistrictsFadeIn: { start: 7.5, end: 8 },
      // Group 2 → Group 3 transition
      regionsDistrictsFadeOut: { start: 10.5, end: 11 },
      localitiesFadeIn: { start: 10.5, end: 11 }
    }
  };

  let map = null;

  // ====================================================================
  // STATE MANAGEMENT
  // ====================================================================
  const state = {
    // GeoJSON data storage
    locationData: null,        // Localities
    settlementData: null,      // Settlements
    districtData: [],          // Districts from combined
    areaData: [],              // Areas from combined

    // Computed marker features
    allRegionFeatures: [],
    allSubregionFeatures: [],
    allDistrictFeatures: [],
    territoryFeatures: [],

    // Boundaries tracking
    boundaryLayers: new Map(),
    highlightedBoundaries: new Set(),  // Currently highlighted district names

    // Loading state
    dataLoaded: {
      combined: false,
      localities: false,
      settlements: false
    },

    // Page filter context (detected from CMS page)
    pageFilter: null,  // e.g., { type: 'reporter', slug: 'btselem' }

    // Filter context from API (contains entity details like name, photo, etc.)
    filterContext: null  // e.g., { type: 'reporter', name: 'Btselem', photo: '...', ... }
  };

  // ====================================================================
  // UTILITY FUNCTIONS
  // ====================================================================

  function getMapLanguage() {
    const browserLang = (navigator.language || navigator.userLanguage || 'en').split('-')[0];
    return CONFIG.SUPPORTED_LANGUAGES.includes(browserLang) ? browserLang : 'en';
  }

  function isMobile() {
    return window.innerWidth <= CONFIG.MOBILE_BREAKPOINT;
  }

  /**
   * Calculate centroid of a polygon geometry
   */
  function calculateCentroid(geometry) {
    if (!geometry || !geometry.coordinates) return null;

    let coords = geometry.coordinates;
    if (geometry.type === 'MultiPolygon') {
      // Use largest polygon
      let largest = coords[0];
      let maxArea = 0;
      coords.forEach(poly => {
        const area = Math.abs(poly[0].reduce((acc, coord, i, arr) => {
          const next = arr[(i + 1) % arr.length];
          return acc + (coord[0] * next[1] - next[0] * coord[1]);
        }, 0) / 2);
        if (area > maxArea) {
          maxArea = area;
          largest = poly;
        }
      });
      coords = largest;
    }

    const ring = coords[0];
    if (!ring || ring.length === 0) return null;

    let sumX = 0, sumY = 0;
    ring.forEach(coord => {
      sumX += coord[0];
      sumY += coord[1];
    });

    return [sumX / ring.length, sumY / ring.length];
  }

  /**
   * Normalize name for ID generation
   */
  function normalizeId(name) {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  // ====================================================================
  // PAGE FILTER DETECTION
  // ====================================================================

  /**
   * Detect page filter context for map markers
   *
   * Priority:
   *   1) Map collection URL: /map/[prefix]-[slug] (e.g., /map/by-btselem)
   *   2) Data attributes (set by webflow-cms-client on CMS pages)
   *   3) URL path patterns (for CMS pages): /reporter/btselem
   *
   * Map collection prefixes:
   *   by-  → reporter  (e.g., /map/by-btselem)
   *   top- → topic     (e.g., /map/top-genocide)
   *   reg- → region    (e.g., /map/reg-hebron)
   *   loc- → locality  (e.g., /map/loc-gaza)
   *   ter- → territory (e.g., /map/ter-west-bank)
   *   stl- → settlement(e.g., /map/stl-ariel)
   *   prp- → perpetrator(e.g., /map/prp-idf)
   *   of-  → custom    (e.g., /map/of-siege-of-gaza) - user-generated
   */

  // Map collection prefixes to filter types
  const MAP_PREFIXES = {
    'by': 'reporter',
    'top': 'topic',
    'reg': 'region',
    'loc': 'locality',
    'ter': 'territory',
    'stl': 'settlement',
    'prp': 'perpetrator',
    'of': 'custom'        // User-generated maps: /map/of-siege-of-gaza
  };

  function detectPageFilter() {
    const path = window.location.pathname;

    // 1. Check for map collection pattern: /map/[prefix]-[slug]
    const mapMatch = path.match(/^\/map\/([a-z]+)-(.+?)\/?$/);
    if (mapMatch) {
      const prefix = mapMatch[1];
      const slug = mapMatch[2];
      const type = MAP_PREFIXES[prefix];

      if (type) {
        console.log('[MapboxCore] Page filter from map collection:', type, slug);
        return { type, slug };
      }
    }

    // 2. Check for page filter data attribute (set by webflow-cms-client on CMS pages)
    const pageFilterEl = document.querySelector('[data-page-filter-type]');
    if (pageFilterEl) {
      const type = pageFilterEl.getAttribute('data-page-filter-type');
      const slug = pageFilterEl.getAttribute('data-page-filter-slug');
      if (type && slug) {
        console.log('[MapboxCore] Page filter from data attribute:', type, slug);
        return { type, slug };
      }
    }

    // 3. Parse URL path patterns (for CMS pages): /reporter/slug, /topic/slug, etc.
    const patterns = [
      { regex: /^\/reporter\/([^\/]+)\/?$/, type: 'reporter' },
      { regex: /^\/topic\/([^\/]+)\/?$/, type: 'topic' },
      { regex: /^\/region\/([^\/]+)\/?$/, type: 'region' },
      { regex: /^\/territory\/([^\/]+)\/?$/, type: 'territory' },
      { regex: /^\/perpetrator\/([^\/]+)\/?$/, type: 'perpetrator' },
      { regex: /^\/perp\/([^\/]+)\/?$/, type: 'perpetrator' },
      { regex: /^\/locality\/([^\/]+)\/?$/, type: 'locality' },
      { regex: /^\/settlement\/([^\/]+)\/?$/, type: 'settlement' }
    ];

    for (const pattern of patterns) {
      const match = path.match(pattern.regex);
      if (match) {
        console.log('[MapboxCore] Page filter from URL path:', pattern.type, match[1]);
        return { type: pattern.type, slug: match[1] };
      }
    }

    return null;
  }

  /**
   * Build query string for locations API based on page filter
   */
  function buildLocationFilterQuery() {
    if (!state.pageFilter) return '';

    const { type, slug } = state.pageFilter;

    // Map page filter types to API parameter names
    const paramMap = {
      reporter: 'pageReporter',
      topic: 'pageTopic',
      region: 'pageRegion',
      territory: 'pageTerritory',
      perpetrator: 'pagePerpetrator',
      locality: 'pageLocality',
      settlement: 'pageSettlement'
    };

    const param = paramMap[type];
    if (!param) return '';

    return `?${param}=${encodeURIComponent(slug)}`;
  }

  // ====================================================================
  // DATA LOADING
  // ====================================================================

  /**
   * Load combined GeoJSON (districts + areas)
   */
  async function loadCombinedData() {
    try {
      const response = await fetch(CONFIG.URLS.combined);
      const data = await response.json();

      data.features.forEach(feature => {
        if (feature.properties.type === 'district') {
          state.districtData.push(feature);
        } else if (feature.properties.type === 'area') {
          state.areaData.push(feature);
        }
      });

      state.dataLoaded.combined = true;
      console.log('[MapboxCore] Combined data loaded:', state.districtData.length, 'districts,', state.areaData.length, 'areas');
      return true;
    } catch (error) {
      console.error('[MapboxCore] Failed to load combined data:', error);
      return false;
    }
  }

  /**
   * Load localities and settlements from combined worker
   * Supports filtering based on page context
   */
  async function loadLocationsData() {
    try {
      // Detect page filter context
      state.pageFilter = detectPageFilter();

      // Build URL with optional filter query
      const filterQuery = buildLocationFilterQuery();
      const url = CONFIG.URLS.locations + filterQuery;

      console.log('[MapboxCore] Loading locations from:', url);
      const response = await fetch(url);
      const data = await response.json();

      // Handle combined response format
      if (data.localities && data.settlements) {
        state.locationData = data.localities;
        state.settlementData = data.settlements;
        state.dataLoaded.localities = true;
        state.dataLoaded.settlements = true;

        const localityCount = data.localities.features?.length || 0;
        const settlementCount = data.settlements.features?.length || 0;

        if (data.filtered) {
          console.log('[MapboxCore] Filtered locations loaded:', localityCount, 'localities,', settlementCount, 'settlements');
          console.log('[MapboxCore] Filter matched', data.metadata?.reportsMatched || 0, 'reports');

          // Store and dispatch filter context if available
          if (data.filterContext) {
            state.filterContext = data.filterContext;
            console.log('[MapboxCore] Filter context:', data.filterContext.type, '-', data.filterContext.name);

            // Update UI elements with filter context
            updateFilterContextUI(data.filterContext);

            // Dispatch event for external UI to display filter info
            document.dispatchEvent(new CustomEvent('mapFilterContext', {
              detail: {
                context: data.filterContext,
                metadata: data.metadata
              }
            }));
          }
        } else {
          console.log('[MapboxCore] All locations loaded:', localityCount, 'localities,', settlementCount, 'settlements');
        }

        return true;
      }

      // Fallback: handle old single-collection format
      console.warn('[MapboxCore] Unexpected response format, falling back to legacy loaders');
      return await loadLocationsLegacy();

    } catch (error) {
      console.error('[MapboxCore] Failed to load locations:', error);
      // Fallback to legacy loaders on error
      return await loadLocationsLegacy();
    }
  }

  /**
   * Legacy loader for backwards compatibility
   * Falls back to separate locality and settlement endpoints
   */
  async function loadLocationsLegacy() {
    console.log('[MapboxCore] Using legacy location loaders');
    try {
      const [localitiesRes, settlementsRes] = await Promise.all([
        fetch(CONFIG.URLS.localities),
        fetch(CONFIG.URLS.settlements)
      ]);

      state.locationData = await localitiesRes.json();
      state.settlementData = await settlementsRes.json();
      state.dataLoaded.localities = true;
      state.dataLoaded.settlements = true;

      console.log('[MapboxCore] Legacy load - Localities:', state.locationData.features?.length || 0);
      console.log('[MapboxCore] Legacy load - Settlements:', state.settlementData.features?.length || 0);
      return true;
    } catch (error) {
      console.error('[MapboxCore] Legacy load failed:', error);
      return false;
    }
  }

  // ====================================================================
  // MARKER FEATURE EXTRACTION
  // ====================================================================

  /**
   * Extract region and subregion features from localities
   */
  function extractRegionFeatures() {
    if (!state.locationData?.features) return;

    const regionMap = new Map();
    const subregionMap = new Map();
    const districtNames = new Set(state.districtData.map(d => d.properties.name));

    state.locationData.features.forEach(feature => {
      const props = feature.properties;
      const coords = feature.geometry?.coordinates;
      if (!coords) return;

      // Collect regions
      if (props.region && !districtNames.has(props.region)) {
        if (!regionMap.has(props.region)) {
          regionMap.set(props.region, { coords: [], territory: props.territory });
        }
        regionMap.get(props.region).coords.push(coords);
      }

      // Collect subregions
      if (props.subRegion) {
        if (!subregionMap.has(props.subRegion)) {
          subregionMap.set(props.subRegion, { coords: [] });
        }
        subregionMap.get(props.subRegion).coords.push(coords);
      }
    });

    // Create region features (centroid of all localities in region)
    regionMap.forEach((data, name) => {
      const avgLng = data.coords.reduce((sum, c) => sum + c[0], 0) / data.coords.length;
      const avgLat = data.coords.reduce((sum, c) => sum + c[1], 0) / data.coords.length;

      state.allRegionFeatures.push({
        type: 'Feature',
        properties: { name, type: 'region', territory: data.territory },
        geometry: { type: 'Point', coordinates: [avgLng, avgLat] }
      });
    });

    // Create subregion features
    subregionMap.forEach((data, name) => {
      const avgLng = data.coords.reduce((sum, c) => sum + c[0], 0) / data.coords.length;
      const avgLat = data.coords.reduce((sum, c) => sum + c[1], 0) / data.coords.length;

      state.allSubregionFeatures.push({
        type: 'Feature',
        properties: { name, type: 'subregion' },
        geometry: { type: 'Point', coordinates: [avgLng, avgLat] }
      });
    });

    console.log('[MapboxCore] Extracted', state.allRegionFeatures.length, 'regions,', state.allSubregionFeatures.length, 'subregions');
  }

  /**
   * Extract district marker features from district boundaries
   */
  function extractDistrictFeatures() {
    state.districtData.forEach(feature => {
      const props = feature.properties;
      let coords;

      // Use admin_centre coordinates if available, otherwise calculate centroid
      if (props.admin_centre?.coordinates) {
        coords = props.admin_centre.coordinates;
      } else {
        coords = calculateCentroid(feature.geometry);
      }

      if (coords) {
        state.allDistrictFeatures.push({
          type: 'Feature',
          properties: {
            name: props.name,
            territory: props.territory,
            type: 'district'
          },
          geometry: { type: 'Point', coordinates: coords }
        });
      }
    });

    console.log('[MapboxCore] Extracted', state.allDistrictFeatures.length, 'district markers');
  }

  /**
   * Create territory features (Israel, West Bank, Gaza, Syria)
   */
  function extractTerritoryFeatures() {
    const territories = [
      { name: 'Israel', coordinates: [34.8516, 31.0461] },
      { name: 'West Bank', coordinates: [35.2507, 31.9466] },
      { name: 'Gaza', coordinates: [34.4668, 31.4167] },
      { name: 'Syria', coordinates: [35.7500, 33.0000] }
    ];

    state.territoryFeatures = territories.map(t => ({
      type: 'Feature',
      properties: { name: t.name, type: 'territory' },
      geometry: { type: 'Point', coordinates: t.coordinates }
    }));

    console.log('[MapboxCore] Created', state.territoryFeatures.length, 'territory markers');
  }

  // ====================================================================
  // GRAYSCALE BASE MAP
  // ====================================================================

  /**
   * Convert a color string to grayscale using luminance weights.
   * Supports hex (#rgb, #rrggbb), rgb(), rgba(), and hsl()/hsla().
   * Returns an rgba() string or null if parsing fails.
   */
  function colorToGrayscale(color) {
    if (!color || typeof color !== 'string') return null;

    let r, g, b, a = 1;

    // Handle hsl/hsla - convert to rgb first
    const hslMatch = color.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+))?\s*\)$/);
    if (hslMatch) {
      const h = parseFloat(hslMatch[1]) / 360;
      const s = parseFloat(hslMatch[2]) / 100;
      const l = parseFloat(hslMatch[3]) / 100;
      a = hslMatch[4] !== undefined ? parseFloat(hslMatch[4]) : 1;

      // HSL to RGB conversion
      if (s === 0) {
        r = g = b = Math.round(l * 255);
      } else {
        const hue2rgb = (p, q, t) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
        g = Math.round(hue2rgb(p, q, h) * 255);
        b = Math.round(hue2rgb(p, q, h - 1/3) * 255);
      }
    }

    // Handle hex
    else if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else if (hex.length === 6) {
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      } else {
        return null;
      }
    }

    // Handle rgb/rgba
    else {
      const rgbMatch = color.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)$/);
      if (!rgbMatch) return null;
      r = parseInt(rgbMatch[1]);
      g = parseInt(rgbMatch[2]);
      b = parseInt(rgbMatch[3]);
      a = rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1;
    }

    // Luminance-weighted grayscale (ITU-R BT.601)
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    return `rgba(${gray}, ${gray}, ${gray}, ${a})`;
  }

  /**
   * Desaturate all existing base style layers to grayscale.
   * Only affects layers that were part of the original Mapbox style,
   * not layers added by this module.
   *
   * Handles fill, line, background, text, and icon color properties.
   */
  function desaturateBaseLayers() {
    if (!CONFIG.GRAYSCALE_BASE) return;

    const style = map.getStyle();
    if (!style || !style.layers) return;

    // Track which layers are base style layers (snapshot before we add our own)
    const baseLayers = style.layers.map(l => l.id);

    // Color paint properties to desaturate per layer type
    const colorProps = {
      fill: ['fill-color', 'fill-outline-color'],
      line: ['line-color'],
      background: ['background-color'],
      symbol: ['text-color', 'text-halo-color', 'icon-color', 'icon-halo-color'],
      circle: ['circle-color', 'circle-stroke-color']
    };

    let converted = 0;

    baseLayers.forEach(layerId => {
      const layer = style.layers.find(l => l.id === layerId);
      if (!layer) return;

      const props = colorProps[layer.type];
      if (!props) return;

      props.forEach(prop => {
        try {
          const value = map.getPaintProperty(layerId, prop);
          if (typeof value === 'string') {
            const gray = colorToGrayscale(value);
            if (gray) {
              map.setPaintProperty(layerId, prop, gray);
              converted++;
            }
          }
        } catch (e) {
          // Skip properties that can't be read/set (expressions, etc.)
        }
      });
    });

    console.log('[MapboxCore] Desaturated', converted, 'color properties across', baseLayers.length, 'base layers');
  }

  // ====================================================================
  // LAYER ADDITION - BOUNDARIES & AREAS
  // ====================================================================

  /**
   * Add district boundary layers
   */
  function addDistrictBoundaries() {
    state.districtData.forEach(feature => {
      const name = feature.properties.name;
      const sourceId = `${normalizeId(name)}-boundary`;
      const fillId = `${normalizeId(name)}-district-fill`;
      const borderId = `${normalizeId(name)}-district-border`;

      if (map.getSource(sourceId)) return; // Already exists

      map.addSource(sourceId, {
        type: 'geojson',
        data: feature
      });

      // Fill layer (hidden by default)
      map.addLayer({
        id: fillId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': CONFIG.COLORS.boundary,
          'fill-opacity': 0
        }
      });

      // Border layer
      map.addLayer({
        id: borderId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': CONFIG.COLORS.boundary,
          'line-width': 1.5,
          'line-opacity': 0.7,
          'line-dasharray': [4, 3]
        }
      });

      state.boundaryLayers.set(name, { sourceId, fillId, borderId });
    });

    console.log('[MapboxCore] Added', state.boundaryLayers.size, 'district boundaries');
  }

  /**
   * Add area overlay layers (Area A, B, C, Firing Zones)
   */
  function addAreaOverlays() {
    state.areaData.forEach(feature => {
      const name = feature.properties.name;
      const color = CONFIG.AREA_COLORS[name];
      if (!color) return;

      const sourceId = `${normalizeId(name)}-source`;
      const layerId = `${normalizeId(name)}-layer`;

      if (map.getSource(sourceId)) return;

      map.addSource(sourceId, {
        type: 'geojson',
        data: feature
      });

      map.addLayer({
        id: layerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': color,
          'fill-opacity': 0.25,
          'fill-outline-color': color
        }
      });

      // Dashed border layer
      map.addLayer({
        id: `${normalizeId(name)}-border`,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': color,
          'line-width': 1.5,
          'line-opacity': 0.6,
          'line-dasharray': [3, 2]
        }
      });
    });

    console.log('[MapboxCore] Added area overlays');
  }

  // ====================================================================
  // LAYER ADDITION - MARKERS
  // ====================================================================

  /**
   * Add territory markers
   */
  function addTerritoryMarkers() {
    if (!state.territoryFeatures.length) return;

    map.addSource('territories-source', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: state.territoryFeatures },
      promoteId: 'name'
    });

    // Group 1: Territories - visible at low zoom, fade out as Group 2 appears
    const t1 = CONFIG.ZOOM_TIERS.territoriesFadeOut;
    map.addLayer({
      id: 'territory-points',
      type: 'symbol',
      source: 'territories-source',
      maxzoom: t1.end, // Disable layer (and clicks) when fully faded out
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 6, 14, 10, 18, 14, 20],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'text-anchor': 'center',
        'symbol-sort-key': -1
      },
      paint: {
        'text-color': '#222222',
        'text-halo-color': CONFIG.COLORS.textHalo,
        'text-halo-width': 1.5,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], t1.start, 1, t1.end, 0]
      }
    });

    // Hover effects (cursor only)
    map.on('mousemove', 'territory-points', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'territory-points', () => {
      map.getCanvas().style.cursor = '';
    });

    // Click handler - dispatch event for external handling
    map.on('click', 'territory-points', (e) => {
      const feature = e.features[0];
      document.dispatchEvent(new CustomEvent('mapMarkerClick', {
        detail: { type: 'territory', name: feature.properties.name, feature }
      }));
    });
  }

  /**
   * Add district markers
   */
  function addDistrictMarkers() {
    if (!state.allDistrictFeatures.length) return;

    map.addSource('districts-source', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: state.allDistrictFeatures },
      promoteId: 'name'
    });

    // Group 2: Districts - fade in as territories fade out, fade out as localities appear
    const g2In = CONFIG.ZOOM_TIERS.regionsDistrictsFadeIn;
    const g2Out = CONFIG.ZOOM_TIERS.regionsDistrictsFadeOut;
    map.addLayer({
      id: 'district-points',
      type: 'symbol',
      source: 'districts-source',
      minzoom: g2In.start, // Disable layer (and clicks) before fade in starts
      maxzoom: g2Out.end,  // Disable layer (and clicks) when fully faded out
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 7, 11, 10, 15, 14, 17],
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-variable-anchor': ['center', 'top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'],
        'text-radial-offset': 0.5,
        'text-justify': 'auto',
        'symbol-sort-key': 2
      },
      paint: {
        'text-color': '#222222',
        'text-halo-color': CONFIG.COLORS.textHalo,
        'text-halo-width': 1.5,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], g2In.start, 0, g2In.end, 1, g2Out.start, 1, g2Out.end, 0]
      }
    });

    // Hover effects (cursor only)
    map.on('mousemove', 'district-points', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'district-points', () => {
      map.getCanvas().style.cursor = '';
    });

    map.on('click', 'district-points', (e) => {
      const feature = e.features[0];
      const districtName = feature.properties.name;

      // Frame the map to the district boundary
      frameBoundary(districtName);

      document.dispatchEvent(new CustomEvent('mapMarkerClick', {
        detail: { type: 'district', name: districtName, feature }
      }));
    });
  }

  /**
   * Add region markers
   */
  function addRegionMarkers() {
    if (!state.allRegionFeatures.length) return;

    map.addSource('regions-source', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: state.allRegionFeatures },
      promoteId: 'name'
    });

    // Group 2: Regions - fade in as territories fade out, fade out as localities appear
    const g2InR = CONFIG.ZOOM_TIERS.regionsDistrictsFadeIn;
    const g2OutR = CONFIG.ZOOM_TIERS.regionsDistrictsFadeOut;
    map.addLayer({
      id: 'region-points',
      type: 'symbol',
      source: 'regions-source',
      minzoom: g2InR.start, // Disable layer (and clicks) before fade in starts
      maxzoom: g2OutR.end,  // Disable layer (and clicks) when fully faded out
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 7, 11, 10, 15, 14, 17],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'text-anchor': 'center',
        'symbol-sort-key': 1
      },
      paint: {
        'text-color': '#222222',
        'text-halo-color': CONFIG.COLORS.textHalo,
        'text-halo-width': 1.5,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], g2InR.start, 0, g2InR.end, 1, g2OutR.start, 1, g2OutR.end, 0]
      }
    });

    // Hover effects (cursor only)
    map.on('mousemove', 'region-points', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'region-points', () => {
      map.getCanvas().style.cursor = '';
    });

    map.on('click', 'region-points', (e) => {
      const feature = e.features[0];
      document.dispatchEvent(new CustomEvent('mapMarkerClick', {
        detail: { type: 'region', name: feature.properties.name, feature }
      }));
    });
  }

  /**
   * Add subregion markers
   */
  function addSubregionMarkers() {
    if (!state.allSubregionFeatures.length) return;

    map.addSource('subregions-source', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: state.allSubregionFeatures },
      promoteId: 'name'
    });

    // Group 2: Subregions - fade in as territories fade out, fade out as localities appear
    const g2InS = CONFIG.ZOOM_TIERS.regionsDistrictsFadeIn;
    const g2OutS = CONFIG.ZOOM_TIERS.regionsDistrictsFadeOut;
    map.addLayer({
      id: 'subregion-points',
      type: 'symbol',
      source: 'subregions-source',
      minzoom: g2InS.start, // Disable layer (and clicks) before fade in starts
      maxzoom: g2OutS.end,  // Disable layer (and clicks) when fully faded out
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 7, 11, 10, 15, 14, 17],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'text-anchor': 'center',
        'symbol-sort-key': 3
      },
      paint: {
        'text-color': '#222222',
        'text-halo-color': CONFIG.COLORS.textHalo,
        'text-halo-width': 1.5,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], g2InS.start, 0, g2InS.end, 1, g2OutS.start, 1, g2OutS.end, 0]
      }
    });

    // Hover effects (cursor only)
    map.on('mousemove', 'subregion-points', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'subregion-points', () => {
      map.getCanvas().style.cursor = '';
    });

    map.on('click', 'subregion-points', (e) => {
      const feature = e.features[0];
      document.dispatchEvent(new CustomEvent('mapMarkerClick', {
        detail: { type: 'subregion', name: feature.properties.name, feature }
      }));
    });
  }

  /**
   * Add settlement markers (text only)
   */
  function addSettlementMarkers() {
    if (!state.settlementData?.features) return;

    map.addSource('settlements-source', {
      type: 'geojson',
      data: state.settlementData,
      cluster: false
    });

    // Group 3: Settlements - fade in as regions/districts fade out
    const g3InSet = CONFIG.ZOOM_TIERS.localitiesFadeIn;

    // Circle layer (black dots)
    map.addLayer({
      id: 'settlement-circles',
      type: 'circle',
      source: 'settlements-source',
      minzoom: g3InSet.start, // Disable layer (and clicks) before fade in starts
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 3, 12, 4, 16, 6],
        'circle-color': '#d94040',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5,
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], g3InSet.start, 0, g3InSet.end, 0.8],
        'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], g3InSet.start, 0, g3InSet.end, 0.8]
      }
    });

    // Text layer
    map.addLayer({
      id: 'settlement-points',
      type: 'symbol',
      source: 'settlements-source',
      minzoom: g3InSet.start, // Disable layer (and clicks) before fade in starts
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 10, 12, 14, 16, 16],
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-optional': true,
        'text-padding': 4,
        'text-offset': [0, 0.6],
        'text-anchor': 'top',
        'symbol-sort-key': 13
      },
      paint: {
        'text-color': '#222222',
        'text-halo-color': CONFIG.COLORS.textHalo,
        'text-halo-width': 2,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], g3InSet.start, 0, g3InSet.end, 1]
      }
    });

    // Hover effects (cursor only) for both layers
    ['settlement-points', 'settlement-circles'].forEach(layerId => {
      map.on('mousemove', layerId, () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
      });

      map.on('click', layerId, (e) => {
        const feature = e.features[0];
        document.dispatchEvent(new CustomEvent('mapMarkerClick', {
          detail: { type: 'settlement', name: feature.properties.name, feature }
        }));
      });
    });
  }

  /**
   * Add locality markers (black dots + text)
   */
  function addLocalityMarkers() {
    if (!state.locationData?.features) return;

    map.addSource('localities-source', {
      type: 'geojson',
      data: state.locationData,
      cluster: false
    });

    // Group 3: Localities - fade in as regions/districts fade out
    const g3InLoc = CONFIG.ZOOM_TIERS.localitiesFadeIn;

    // Circle layer (black dots)
    map.addLayer({
      id: 'locality-circles',
      type: 'circle',
      source: 'localities-source',
      minzoom: g3InLoc.start, // Disable layer (and clicks) before fade in starts
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 3, 12, 4, 16, 6],
        'circle-color': '#555555',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5,
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], g3InLoc.start, 0, g3InLoc.end, 0.8],
        'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], g3InLoc.start, 0, g3InLoc.end, 0.8]
      }
    });

    // Text layer
    map.addLayer({
      id: 'locality-points',
      type: 'symbol',
      source: 'localities-source',
      minzoom: g3InLoc.start, // Disable layer (and clicks) before fade in starts
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 10, 12, 14, 16, 16],
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-optional': true,
        'text-padding': 4,
        'text-offset': [0, 0.6],
        'text-anchor': 'top',
        'symbol-sort-key': 14
      },
      paint: {
        'text-color': '#222222',
        'text-halo-color': CONFIG.COLORS.textHalo,
        'text-halo-width': 2,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], g3InLoc.start, 0, g3InLoc.end, 1]
      }
    });

    // Hover effects (cursor only) for both layers
    ['locality-points', 'locality-circles'].forEach(layerId => {
      map.on('mousemove', layerId, () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
      });

      map.on('click', layerId, (e) => {
        const feature = e.features[0];
        document.dispatchEvent(new CustomEvent('mapMarkerClick', {
          detail: { type: 'locality', name: feature.properties.name, feature }
        }));
      });
    });
  }

  /**
   * Fit map to filtered locations (localities + settlements)
   * Called when page filter is active to zoom to relevant markers
   */
  function fitToFilteredLocations() {
    if (!state.pageFilter) return;

    const bounds = new mapboxgl.LngLatBounds();
    let pointCount = 0;
    let singlePoint = null;

    // Add locality coordinates
    if (state.locationData?.features) {
      state.locationData.features.forEach(feature => {
        const coords = feature.geometry?.coordinates;
        if (coords) {
          bounds.extend(coords);
          pointCount++;
          singlePoint = coords;
        }
      });
    }

    // Add settlement coordinates
    if (state.settlementData?.features) {
      state.settlementData.features.forEach(feature => {
        const coords = feature.geometry?.coordinates;
        if (coords) {
          bounds.extend(coords);
          pointCount++;
          singlePoint = coords;
        }
      });
    }

    // No filtered locations - keep default view
    if (pointCount === 0) {
      console.log('[MapboxCore] No filtered locations to fit');
      return;
    }

    // Single location - center on it at reasonable zoom
    if (pointCount === 1 && singlePoint) {
      console.log('[MapboxCore] Fitting to single location:', singlePoint);
      map.flyTo({
        center: singlePoint,
        zoom: 12,
        duration: 1000
      });
      return;
    }

    // Multiple locations - fit to bounds
    console.log('[MapboxCore] Fitting to', pointCount, 'filtered locations');
    map.fitBounds(bounds, {
      padding: isMobile() ? 40 : 80,
      duration: 1000,
      maxZoom: 14
    });
  }

  /**
   * Frame map to boundary
   */
  function frameBoundary(name) {
    const boundary = state.boundaryLayers.get(name);
    if (!boundary) return;

    const source = map.getSource(boundary.sourceId);
    if (!source) return;

    const data = source._data;
    if (!data?.geometry) return;

    // Calculate bounds from geometry
    const bounds = new mapboxgl.LngLatBounds();
    const addCoords = (coords) => {
      if (Array.isArray(coords[0])) {
        coords.forEach(addCoords);
      } else {
        bounds.extend(coords);
      }
    };
    addCoords(data.geometry.coordinates);

    map.fitBounds(bounds, {
      padding: isMobile() ? 30 : 50,
      duration: 1000
    });
  }

  /**
   * Frame map to all district boundaries belonging to a territory
   */
  function frameTerritoryBoundary(territoryName) {
    const bounds = new mapboxgl.LngLatBounds();
    let hasCoords = false;

    const addCoords = (coords) => {
      if (Array.isArray(coords[0])) {
        coords.forEach(addCoords);
      } else {
        bounds.extend(coords);
        hasCoords = true;
      }
    };

    state.districtData.forEach(feature => {
      if (feature.properties.territory === territoryName && feature.geometry?.coordinates) {
        addCoords(feature.geometry.coordinates);
      }
    });

    if (!hasCoords) return;

    map.fitBounds(bounds, {
      padding: isMobile() ? 30 : 50,
      duration: 1000
    });
  }

  // ====================================================================
  // CUSTOM MAP CONTROLS (External DIV Binding)
  // ====================================================================

  /**
   * Bind external HTML elements with map-controls attribute to map actions
   * Supports: reset-view, zoom-in, zoom-out, clear-page-filter, layers
   */
  function openLayersSidebar(sidebar) {
    document.dispatchEvent(new CustomEvent('layersSidebarOpened'));
    sidebar.classList.add('is--show');
    if (window.innerWidth > CONFIG.MOBILE_BREAKPOINT) {
      sidebar.style.marginRight = '0';
    } else {
      sidebar.style.marginRight = '';
    }
  }

  function closeLayersSidebar(sidebar) {
    sidebar.classList.remove('is--show');
    if (window.innerWidth > CONFIG.MOBILE_BREAKPOINT) {
      const sidebarWidth = parseInt(getComputedStyle(sidebar).width) || 300;
      sidebar.style.marginRight = `-${sidebarWidth + 1}px`;
    } else {
      sidebar.style.marginRight = '';
    }
  }

  function bindCustomControls() {
    // Reset view control
    document.querySelectorAll('[map-controls="reset-view"]').forEach(el => {
      el.addEventListener('click', () => {
        if (!map) return;
        map.fitBounds(CONFIG.BOUNDS, {
          padding: isMobile() ? 20 : 50,
          duration: 1000
        });
      });
    });

    // Zoom in control
    document.querySelectorAll('[map-controls="zoom-in"]').forEach(el => {
      el.addEventListener('click', () => {
        if (!map) return;
        map.zoomIn();
      });
    });

    // Zoom out control
    document.querySelectorAll('[map-controls="zoom-out"]').forEach(el => {
      el.addEventListener('click', () => {
        if (!map) return;
        map.zoomOut();
      });
    });

    // Clear page filter control (removes ?of= param and reloads)
    document.querySelectorAll('[map-controls="clear-page-filter"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        clearPageFilter();
      });
    });

    // Layers sidebar toggle with slide animation
    const layersSidebar = document.querySelector('[map-layers="sidebar"]');
    if (layersSidebar) {
      // Initialize sidebar state (hidden with negative margin)
      if (window.innerWidth > CONFIG.MOBILE_BREAKPOINT) {
        const sidebarWidth = parseInt(getComputedStyle(layersSidebar).width) || 300;
        layersSidebar.style.marginRight = `-${sidebarWidth + 1}px`;
        layersSidebar.style.transition = 'margin-right 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
      }

      document.querySelectorAll('[map-controls="layers"]').forEach(el => {
        el.addEventListener('click', () => {
          if (layersSidebar.classList.contains('is--show')) {
            closeLayersSidebar(layersSidebar);
          } else {
            openLayersSidebar(layersSidebar);
          }
        });
      });

      document.querySelectorAll('[map-layers="sidebar-close"]').forEach(el => {
        el.addEventListener('click', () => {
          closeLayersSidebar(layersSidebar);
        });
      });

      // Close layers sidebar when site-search sidebar opens
      document.addEventListener('siteSearchSidebarOpened', () => {
        if (layersSidebar.classList.contains('is--show')) {
          closeLayersSidebar(layersSidebar);
        }
      });
    }

    // Feed panel toggle
    const feedPanel = document.querySelector('[data-feed-panel]');
    if (feedPanel) {
      document.querySelectorAll('[data-feed-toggle]').forEach(el => {
        el.addEventListener('click', () => {
          feedPanel.classList.toggle('is--open');
        });
      });

      document.querySelectorAll('[data-feed-close]').forEach(el => {
        el.addEventListener('click', () => {
          feedPanel.classList.remove('is--open');
        });
      });

      document.querySelectorAll('[data-map-wrap]').forEach(el => {
        el.addEventListener('click', (e) => {
          if (!feedPanel.classList.contains('is--open')) return;
          if (e.target.closest('[data-feed-toggle], [data-feed-panel]')) return;
          feedPanel.classList.remove('is--open');
        });
      });
    }

    console.log('[MapboxCore] Custom controls bound');
  }

  // ====================================================================
  // LAYER TOGGLE CONTROLS
  // ====================================================================

  /**
   * Setup layer toggle checkboxes for area overlays and marker groups
   * Uses Webflow checkbox elements with specific DOM IDs
   * Checkbox checked = layer hidden (toggled off)
   */
  function loadAreaControls() {
    const areaControls = [
      { keyId: 'area-a-key', layerId: 'area-a-layer', wrapId: 'area-a-key-wrap' },
      { keyId: 'area-b-key', layerId: 'area-b-layer', wrapId: 'area-b-key-wrap' },
      { keyId: 'area-c-key', layerId: 'area-c-layer', wrapId: 'area-c-key-wrap' },
      { keyId: 'firing-zones-key', layerId: 'firing-zones-layer', wrapId: 'firing-zones-key-wrap' }
    ];

    const markerControls = [
      {
        keyId: 'territory-toggle-key',
        wrapId: 'territory-toggle-key-wrap',
        type: 'territory',
        layers: ['territory-points']
      },
      {
        keyId: 'governorate-toggle-key',
        wrapId: 'governorate-toggle-key-wrap',
        type: 'region',
        layers: ['region-points', 'subregion-points', 'district-points']
      },
      {
        keyId: 'locality-toggle-key',
        wrapId: 'locality-toggle-key-wrap',
        type: 'locality',
        layers: ['locality-circles', 'locality-points']
      },
      {
        keyId: 'settlement-toggle-key',
        wrapId: 'settlement-toggle-key-wrap',
        type: 'settlement',
        layers: ['settlement-circles', 'settlement-points']
      }
    ];

    // Setup area controls
    areaControls.forEach(control => {
      const checkbox = document.getElementById(control.keyId);
      if (!checkbox) return;

      checkbox.checked = false;

      if (!checkbox.dataset.mapboxListenerAdded) {
        checkbox.addEventListener('change', () => {
          const layerId = control.layerId;
          const borderId = layerId.replace('-layer', '-border');

          const visibility = checkbox.checked ? 'none' : 'visible';

          if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, 'visibility', visibility);
          }
          if (map.getLayer(borderId)) {
            map.setLayoutProperty(borderId, 'visibility', visibility);
          }
        });
        checkbox.dataset.mapboxListenerAdded = 'true';
      }

      // Hover highlight on wrapper element
      const wrapperDiv = document.getElementById(control.wrapId);
      if (wrapperDiv && !wrapperDiv.dataset.mapboxHoverAdded) {
        wrapperDiv.addEventListener('mouseenter', () => {
          if (map.getLayer(control.layerId)) {
            map.setPaintProperty(control.layerId, 'fill-opacity', 0.7);
          }
        });
        wrapperDiv.addEventListener('mouseleave', () => {
          if (map.getLayer(control.layerId)) {
            map.setPaintProperty(control.layerId, 'fill-opacity', 0.25);
          }
        });
        wrapperDiv.dataset.mapboxHoverAdded = 'true';
      }
    });

    // Setup marker controls
    markerControls.forEach(control => {
      const checkbox = document.getElementById(control.keyId);
      if (!checkbox) return;

      checkbox.checked = false;

      if (!checkbox.dataset.mapboxListenerAdded) {
        checkbox.addEventListener('change', (e) => {
          const visibility = e.target.checked ? 'none' : 'visible';

          // Toggle the marker layers
          control.layers.forEach(layerId => {
            if (map.getLayer(layerId)) {
              map.setLayoutProperty(layerId, 'visibility', visibility);
            }
          });

          // Region toggle also controls boundary fill/border layers
          if (control.type === 'region') {
            const allLayers = map.getStyle().layers;
            allLayers.forEach(layer => {
              if (layer.id.includes('-district-fill') || layer.id.includes('-district-border')) {
                map.setLayoutProperty(layer.id, 'visibility', visibility);
              }
            });
          }
        });
        checkbox.dataset.mapboxListenerAdded = 'true';
      }

      // Hover highlight on wrapper element (region and territory - highlights boundaries)
      if (control.type === 'region' || control.type === 'territory') {
        const wrapperDiv = document.getElementById(control.wrapId);
        if (wrapperDiv && !wrapperDiv.dataset.mapboxHoverAdded) {
          wrapperDiv.addEventListener('mouseenter', () => {
            const allLayers = map.getStyle().layers;
            allLayers.forEach(layer => {
              if (layer.id.includes('-district-fill')) {
                map.setPaintProperty(layer.id, 'fill-opacity', 0.15);
              }
              if (layer.id.includes('-district-border')) {
                map.setPaintProperty(layer.id, 'line-opacity', 1);
              }
            });
          });

          wrapperDiv.addEventListener('mouseleave', () => {
            const allLayers = map.getStyle().layers;
            allLayers.forEach(layer => {
              if (layer.id.includes('-district-fill')) {
                map.setPaintProperty(layer.id, 'fill-opacity', 0);
              }
              if (layer.id.includes('-district-border')) {
                map.setPaintProperty(layer.id, 'line-opacity', 0.7);
              }
            });
          });

          wrapperDiv.dataset.mapboxHoverAdded = 'true';
        }
      }
    });

    console.log('[MapboxCore] Layer toggle controls initialized');
  }

  /**
   * Update visibility of page filter UI elements
   * Shows/hides elements based on whether a page filter is active
   * Supports: [map-controls="clear-page-filter"] and [map-controls="page-filter-element"]
   */
  function updatePageFilterVisibility() {
    const hasPageFilter = state.pageFilter !== null;

    // Elements to show only when page filter is active
    document.querySelectorAll('[map-controls="clear-page-filter"], [map-controls="page-filter-element"]').forEach(el => {
      if (hasPageFilter) {
        el.classList.remove('is--hidden');
      } else {
        el.classList.add('is--hidden');
      }
    });

    console.log('[MapboxCore] Page filter visibility updated:', hasPageFilter ? 'visible' : 'hidden');
  }

  /**
   * Clear the page filter by navigating to the base map page
   * Navigates to /map to show all locations without any filter
   */
  function clearPageFilter() {
    if (!state.pageFilter) return;

    // Navigate to base map page
    window.location.href = '/map';
  }

  // ====================================================================
  // MAP INITIALIZATION
  // ====================================================================

  async function initMap() {
    const container = document.getElementById(CONFIG.CONTAINER);
    if (!container) {
      console.error('[MapboxCore] Map container not found:', CONFIG.CONTAINER);
      return null;
    }

    if (typeof mapboxgl === 'undefined') {
      console.error('[MapboxCore] Mapbox GL JS is not loaded');
      return null;
    }

    mapboxgl.accessToken = CONFIG.ACCESS_TOKEN;

    map = new mapboxgl.Map({
      container: CONFIG.CONTAINER,
      style: CONFIG.STYLE,
      bounds: CONFIG.BOUNDS,
      fitBoundsOptions: {
        padding: isMobile() ? 20 : 50
      },
      language: getMapLanguage()
    });

    // Add scale controls (metric + imperial)
    const scalePosition = isMobile() ? 'bottom-left' : 'bottom-right';
    map.addControl(new mapboxgl.ScaleControl({
      maxWidth: 100,
      unit: 'metric'
    }), scalePosition);
    map.addControl(new mapboxgl.ScaleControl({
      maxWidth: 100,
      unit: 'imperial'
    }), scalePosition);

    // Bind external custom controls (divs with map-controls attribute)
    bindCustomControls();

    map.on('load', async () => {
      console.log('[MapboxCore] Map loaded, loading data...');

      // Load all data in parallel
      // Note: loadLocationsData loads both localities and settlements from the combined worker
      await Promise.all([
        loadCombinedData(),
        loadLocationsData()
      ]);

      // Extract features
      extractTerritoryFeatures();
      extractDistrictFeatures();
      extractRegionFeatures();

      // Desaturate base map layers to grayscale (before adding colored layers)
      desaturateBaseLayers();

      // Add layers in order (bottom to top)
      addAreaOverlays();
      addDistrictBoundaries();

      // Add markers (territories on top, localities at bottom)
      addLocalityMarkers();
      addSettlementMarkers();
      addSubregionMarkers();
      addRegionMarkers();
      addDistrictMarkers();
      addTerritoryMarkers();

      console.log('[MapboxCore] All layers and markers added');

      // Setup layer toggle controls
      loadAreaControls();

      // Update page filter UI visibility
      updatePageFilterVisibility();

      // If page filter is active, zoom to filtered locations
      fitToFilteredLocations();

      document.dispatchEvent(new CustomEvent('mapLoaded', {
        detail: { map }
      }));
    });

    map.on('error', (e) => {
      console.error('[MapboxCore] Map error:', e.error);
    });

    return map;
  }

  // ====================================================================
  // BOUNDARY HIGHLIGHTING
  // ====================================================================

  /**
   * Highlight a single district boundary on the map
   */
  function highlightBoundary(name) {
    const boundary = state.boundaryLayers.get(name);
    if (!boundary || !map) return;

    if (!map.getLayer(boundary.fillId) || !map.getLayer(boundary.borderId)) return;

    map.setPaintProperty(boundary.fillId, 'fill-opacity', 0.2);
    map.setPaintProperty(boundary.borderId, 'line-width', 2.5);
    map.setPaintProperty(boundary.borderId, 'line-opacity', 1);
    map.setPaintProperty(boundary.borderId, 'line-dasharray', [1, 0]);

    state.highlightedBoundaries.add(name);
  }

  /**
   * Highlight all district boundaries belonging to a territory
   */
  function highlightTerritoryBoundaries(territoryName) {
    state.districtData.forEach(feature => {
      if (feature.properties.territory === territoryName) {
        highlightBoundary(feature.properties.name);
      }
    });
  }

  /**
   * Remove all boundary highlights, resetting to default paint values
   */
  function removeAllHighlights() {
    state.highlightedBoundaries.forEach(name => {
      const boundary = state.boundaryLayers.get(name);
      if (!boundary || !map) return;

      if (map.getLayer(boundary.fillId)) {
        map.setPaintProperty(boundary.fillId, 'fill-opacity', 0);
      }
      if (map.getLayer(boundary.borderId)) {
        map.setPaintProperty(boundary.borderId, 'line-width', 1.5);
        map.setPaintProperty(boundary.borderId, 'line-opacity', 0.7);
        map.setPaintProperty(boundary.borderId, 'line-dasharray', [4, 3]);
      }
    });

    state.highlightedBoundaries.clear();
  }

  // ====================================================================
  // PUBLIC API
  // ====================================================================
  window.MapboxCore = {
    init: initMap,
    getMap: () => map,
    CONFIG,
    state,
    isReady: () => map !== null && map.loaded(),
    getPageFilter: () => state.pageFilter,
    getFilterContext: () => state.filterContext,
    isFiltered: () => state.pageFilter !== null,

    flyTo: (options) => {
      if (!map) return;
      map.flyTo({
        center: options.center,
        zoom: options.zoom || 12,
        duration: options.duration || 1000,
        essential: true
      });
    },

    resetView: () => {
      if (!map) return;
      map.fitBounds(CONFIG.BOUNDS, {
        padding: isMobile() ? 20 : 50
      });
    },

    frameBoundary,
    frameTerritoryBoundary,
    clearPageFilter
  };

  // ====================================================================
  // FILTER CONTEXT UI
  // ====================================================================

  /**
   * Update UI elements with filter context data (reporter info, etc.)
   * Uses [reporter-info="..."] attributes to find elements
   */
  function updateFilterContextUI(context) {
    if (!context) return;

    // Image element
    const imageEl = document.querySelector('[reporter-info="image"]');
    if (imageEl) {
      if (context.photo) {
        imageEl.src = context.photo;
        imageEl.classList.remove('is--hidden');
      }
      // If no photo, leave is--hidden as-is (default state)
    }

    // Name element
    const nameEl = document.querySelector('[reporter-info="name"]');
    if (nameEl && context.name) {
      nameEl.textContent = context.name;
    }

    // Description element
    const descEl = document.querySelector('[reporter-info="description"]');
    if (descEl) {
      if (context.description) {
        descEl.innerHTML = context.description;
      } else {
        descEl.classList.add('is--hidden');
      }
    }

    // Join link element
    const joinEl = document.querySelector('[reporter-info="join-link"]');
    if (joinEl) {
      if (context.joinLink && context.joinLink.trim()) {
        joinEl.href = context.joinLink;
        joinEl.style.display = '';
        joinEl.classList.remove('is--hidden');
      } else {
        joinEl.style.display = 'none';
        joinEl.classList.add('is--hidden');
      }
    }

    // Donation link element
    const donationEl = document.querySelector('[reporter-info="donation-link"]');
    if (donationEl) {
      if (context.donationLink && context.donationLink.trim()) {
        donationEl.href = context.donationLink;
        donationEl.style.display = '';
        donationEl.classList.remove('is--hidden');
      } else {
        donationEl.style.display = 'none';
        donationEl.classList.add('is--hidden');
      }
    }

    // Donation/Join wrapper - show if either link exists, hide if neither
    const hasDonation = context.donationLink && context.donationLink.trim();
    const hasJoin = context.joinLink && context.joinLink.trim();
    const wrapEl = document.querySelector('[reporter-info="donation-join-wrap"]');
    if (wrapEl) {
      if (hasDonation || hasJoin) {
        wrapEl.style.display = '';
        wrapEl.classList.remove('is--hidden');
      } else {
        wrapEl.style.display = 'none';
        wrapEl.classList.add('is--hidden');
      }
    }

    console.log('[MapboxCore] Filter context UI updated for:', context.name);
  }

  // ====================================================================
  // CMS FILTER INTEGRATION
  // ====================================================================

  /**
   * Map marker types to CMS filter keys
   * Note: settlements don't have a direct filter - they use locality filter
   */
  const MARKER_TO_FILTER_MAP = {
    territory: 'territory',
    region: 'region',
    district: 'region',      // Districts map to region filter
    subregion: 'region',     // Subregions map to region filter
    locality: 'locality',
    settlement: 'settlement'   // Settlements now have their own filter
  };

  /**
   * Track the current map-selected filter (to replace on next click)
   * Format: { filterKey: string, filterValue: string } or null
   */
  let currentMapSelection = null;

  /**
   * Handle marker click and apply CMS filter
   * Replaces the previous map selection instead of adding to it
   */
  function handleMarkerFilter(event) {
    const { type, name, feature } = event.detail;

    // Open feed panel on marker click
    const feedPanel = document.querySelector('[data-feed-panel]');
    if (feedPanel) feedPanel.classList.add('is--open');

    // Fly/fit to the clicked marker's location
    if (map) {
      if (type === 'territory') {
        frameTerritoryBoundary(name);
      } else if (type === 'district') {
        frameBoundary(name);
      } else if (feature?.geometry?.coordinates) {
        map.flyTo({
          center: feature.geometry.coordinates,
          zoom: Math.max(map.getZoom(), 12),
          duration: 1000,
          essential: true
        });
      }
    }

    // Check if CMS client is available
    if (!window.cmsDebug?.Store || !window.cmsDebug?.applyFilters) {
      console.warn('[MapboxCore] CMS client not available for filtering');
      return;
    }

    const filterKey = MARKER_TO_FILTER_MAP[type];
    if (!filterKey) {
      console.warn('[MapboxCore] No filter mapping for marker type:', type);
      return;
    }

    const { Store, applyFilters } = window.cmsDebug;

    // Use name for the filter value (displays correctly in tags)
    const filterValue = name;

    // Check if clicking the same marker - if so, deselect it
    if (currentMapSelection &&
        currentMapSelection.filterKey === filterKey &&
        currentMapSelection.filterValue === filterValue) {
      console.log('[MapboxCore] Deselecting marker:', filterKey, ':', filterValue);
      Store.removeFromFilter(filterKey, filterValue);
      currentMapSelection = null;
      applyFilters();
      return;
    }

    // Remove previous map selection if exists
    if (currentMapSelection) {
      console.log('[MapboxCore] Removing previous selection:', currentMapSelection.filterKey, ':', currentMapSelection.filterValue);
      Store.removeFromFilter(currentMapSelection.filterKey, currentMapSelection.filterValue);
    }

    console.log('[MapboxCore] Filtering by', filterKey, ':', filterValue);

    // Add new filter value
    Store.addToFilter(filterKey, filterValue);

    // Track this as the current map selection
    currentMapSelection = { filterKey, filterValue };

    // Apply the filter to update the report list
    applyFilters();
  }

  /**
   * Initialize CMS filter integration
   */
  function initFilterIntegration() {
    // Listen for marker click events
    document.addEventListener('mapMarkerClick', handleMarkerFilter);

    // Listen for CMS filter changes to highlight boundaries
    document.addEventListener('cmsFilterChanged', (event) => {
      if (!map) return;

      removeAllHighlights();

      const { territory, region } = event.detail;

      // Clear map selection tracking if the filter it set was removed externally (e.g. tag remove)
      if (currentMapSelection) {
        const key = currentMapSelection.filterKey;
        const values = event.detail[key] || [];
        if (!values.includes(currentMapSelection.filterValue)) {
          currentMapSelection = null;
        }
      }

      if (territory && territory.length > 0) {
        territory.forEach(name => highlightTerritoryBoundaries(name));
      } else if (region && region.length > 0) {
        region.forEach(name => highlightBoundary(name));
      }
    });

    console.log('[MapboxCore] CMS filter integration initialized');
  }

  // Initialize filter integration when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFilterIntegration);
  } else {
    initFilterIntegration();
  }

  // Expose filter integration in public API
  window.MapboxCore.filterByMarker = (type, name, slug) => {
    handleMarkerFilter({
      detail: {
        type,
        name,
        feature: { properties: { slug: slug || name } }
      }
    });
  };

  window.MapboxCore.clearMapFilters = () => {
    if (!window.cmsDebug?.Store || !window.cmsDebug?.applyFilters) {
      console.warn('[MapboxCore] CMS client not available');
      return;
    }

    const { Store, applyFilters } = window.cmsDebug;

    // Clear the current map selection tracking
    currentMapSelection = null;

    // Clear location-related filters
    ['territory', 'region', 'locality', 'settlement'].forEach(key => {
      Store.setFilter(key, []);
    });

    applyFilters();
    console.log('[MapboxCore] Map filters cleared');
  };

  window.MapboxCore.getCurrentSelection = () => currentMapSelection;

  // ====================================================================
  // AUTO-INITIALIZATION
  // ====================================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMap);
  } else {
    initMap();
  }

})(window);
