/**
 * Optimized Mapbox Script for Webflow
 * Performance improvements: Event-driven loading, ES6 classes, smart caching, parallel processing
 */

class MapboxController {
  constructor() {
    this.map = null;
    this.state = {
      locationData: { type: "FeatureCollection", features: [] },
      allLocalityFeatures: [],
      allDistrictFeatures: [],
      highlightedBoundary: null,
      flags: {
        isInitialLoad: true,
        mapInitialized: false,
        districtTagsLoaded: false,
        areaControlsSetup: false,
        boundariesLoaded: false
      },
      cache: {
        elements: new Map(),
        layers: new Set(),
        sources: new Set()
      },
      interactions: {
        lastClickedMarker: null,
        lastClickTime: 0,
        markerInteractionLock: false
      }
    };
    
    this.timers = new Map();
    this.loadingPromises = new Map();
    this.cleanupTasks = new Set();
    
    // Optimized constants
    this.CONSTANTS = {
      MARKER_FONT: '"itc-avant-garde-gothic-pro", sans-serif',
      TRANSITIONS: { default: "200ms", district: 'opacity 300ms ease, background-color 0.3s ease' },
      COLORS: { locality: '#739005', district: '#f50000', highlight: '#f50000' },
      ZOOM: { mobile: 7.5, desktop: 8.33, clusterIncrease: 2.5 },
      TIMING: { debounce: 300, animation: 1000, loadingScreen: 1000 }
    };
    
    this.isMobile = this.detectMobile();
    this.init();
  }

  // Optimized utility functions with caching
  $(selector, context = document, useCache = true) {
    if (useCache && this.state.cache.elements.has(selector)) {
      const cached = this.state.cache.elements.get(selector);
      // Validate cache - ensure elements still exist in DOM
      if (cached.length && cached[0].isConnected) {
        return cached;
      }
    }
    
    const elements = Array.from(context.querySelectorAll(selector));
    if (useCache && elements.length) {
      this.state.cache.elements.set(selector, elements);
    }
    return elements;
  }

  $1(selector, context = document, useCache = true) {
    const cacheKey = `single_${selector}`;
    if (useCache && this.state.cache.elements.has(cacheKey)) {
      const cached = this.state.cache.elements.get(cacheKey);
      if (cached?.isConnected) return cached;
    }
    
    const element = context.querySelector(selector);
    if (useCache && element) {
      this.state.cache.elements.set(cacheKey, element);
    }
    return element;
  }

  // Smart cache invalidation
  invalidateCache(pattern = null) {
    if (pattern) {
      for (const key of this.state.cache.elements.keys()) {
        if (key.includes(pattern)) {
          this.state.cache.elements.delete(key);
        }
      }
    } else {
      this.state.cache.elements.clear();
    }
  }

  detectMobile() {
    return window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  // Optimized debounce with cleanup tracking
  debounce(func, delay, key = null) {
    if (key && this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }
    
    const timer = setTimeout(() => {
      func();
      if (key) this.timers.delete(key);
    }, delay);
    
    if (key) {
      this.timers.set(key, timer);
      this.cleanupTasks.add(() => clearTimeout(timer));
    }
    
    return timer;
  }

  // Enhanced utility functions
  setStyles(element, styles) {
    if (!element) return;
    Object.assign(element.style, styles);
  }

  triggerEvents(element, events) {
    if (!element) return;
    events.forEach(event => {
      element.dispatchEvent(new Event(event, { bubbles: true }));
    });
  }

  calculateCentroid(coordinates) {
    let totalLat = 0, totalLng = 0, pointCount = 0;
    
    const processCoords = (coords) => {
      if (Array.isArray(coords) && coords.length > 0) {
        if (typeof coords[0] === 'number') {
          totalLng += coords[0];
          totalLat += coords[1];
          pointCount++;
        } else {
          coords.forEach(processCoords);
        }
      }
    };
    
    processCoords(coordinates);
    return pointCount > 0 ? [totalLng / pointCount, totalLat / pointCount] : [0, 0];
  }

  // Optimized map initialization
  async init() {
    try {
      await this.initializeMap();
      await this.setupLoadingScreen();
      await this.loadInitialData();
      await this.setupEventHandlers();
      await this.loadSecondaryContent();
    } catch (error) {
      console.error('Map initialization error:', error);
      this.hideLoadingScreen();
    }
  }

  async initializeMap() {
    const lang = navigator.language.split('-')[0];
    
    // Set Mapbox token
    mapboxgl.accessToken = "pk.eyJ1Ijoibml0YWloYXJkeSIsImEiOiJjbWE0d2F2cHcwYTYxMnFzNmJtanFhZzltIn0.diooYfncR44nF0Y8E1jvbw";
    
    // Load RTL plugin for Arabic/Hebrew
    if (['ar', 'he'].includes(lang)) {
      mapboxgl.setRTLTextPlugin("https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.3.0/mapbox-gl-rtl-text.js");
    }

    // Initialize map
    this.map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/nitaihardy/cmbus40jb016n01s5dui12tre",
      center: [35.22, 31.85],
      zoom: this.isMobile ? this.CONSTANTS.ZOOM.mobile : this.CONSTANTS.ZOOM.desktop,
      language: ['en','es','fr','de','zh','ja','ru','ar','he'].includes(lang) ? lang : 'en'
    });

    this.addMapControls();
    
    return new Promise((resolve) => {
      this.map.on('load', resolve);
    });
  }

  addMapControls() {
    // Geolocation control
    this.map.addControl(new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true
    }));

    // Navigation controls
    this.map.addControl(new mapboxgl.NavigationControl({
      showCompass: false,
      showZoom: true,
      visualizePitch: false
    }), 'top-right');

    // Custom reset control
    this.map.addControl(new this.MapResetControl(), 'top-right');
  }

  // Custom reset control class
  MapResetControl = class {
    constructor(controller) {
      this.controller = controller;
    }

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
      
      this._button.addEventListener('click', () => this.controller?.resetMap() || this.defaultReset());
      this._container.appendChild(this._button);
      return this._container;
    }

    defaultReset() {
      this._map.flyTo({
        center: [35.22, 31.85],
        zoom: window.innerWidth <= 768 ? 7.5 : 8.33,
        duration: 1000,
        essential: true
      });
    }

    onRemove() {
      this._container.parentNode?.removeChild(this._container);
      this._map = undefined;
    }
  }

  resetMap() {
    this.map.flyTo({
      center: [35.22, 31.85],
      zoom: this.isMobile ? this.CONSTANTS.ZOOM.mobile : this.CONSTANTS.ZOOM.desktop,
      duration: 1000,
      essential: true
    });

    // Reset markers and boundaries
    if (this.hasSource('localities-source')) {
      this.map.getSource('localities-source').setData({
        type: "FeatureCollection",
        features: this.state.allLocalityFeatures
      });
    }
    this.removeBoundaryHighlight();
  }

  async setupLoadingScreen() {
    const loadingScreen = this.$1('#loading-map-screen');
    if (loadingScreen) {
      loadingScreen.style.display = 'flex';
      
      // Fallback timeout
      setTimeout(() => {
        if (loadingScreen.style.display !== 'none') {
          this.hideLoadingScreen();
        }
      }, 10000);
    }
  }

  hideLoadingScreen() {
    const loadingScreen = this.$1('#loading-map-screen');
    if (loadingScreen) {
      loadingScreen.style.display = 'none';
      console.log('Loading screen hidden');
    }
  }

  // Optimized data loading with parallel processing
  async loadInitialData() {
    try {
      // Load critical data first (parallel)
      await Promise.all([
        this.extractLocationData(),
        this.setupSidebars()
      ]);

      // Add locality markers immediately
      this.addLocalityMarkers();
      
      // Hide loading screen once basic functionality is ready
      setTimeout(() => this.hideLoadingScreen(), this.CONSTANTS.TIMING.loadingScreen);
      
      this.state.flags.mapInitialized = true;
      
      // Apply initial filtering if needed
      this.debounce(() => {
        if (this.checkMapMarkersFiltering()) {
          this.applyFilterToMarkers();
        }
        this.state.flags.isInitialLoad = false;
      }, 500, 'initial-filter');
      
    } catch (error) {
      console.error('Error loading initial data:', error);
      this.hideLoadingScreen();
    }
  }

  async loadSecondaryContent() {
    // Load secondary content in parallel
    const secondaryTasks = [
      this.loadAreaOverlays(),
      this.loadDistrictBoundaries(),
      this.loadDistrictTags()
    ];

    try {
      await Promise.all(secondaryTasks);
      await this.setupAreaControls();
    } catch (error) {
      console.error('Error loading secondary content:', error);
    }
  }

  // Optimized location data extraction
  extractLocationData() {
    return new Promise((resolve) => {
      this.state.locationData.features = [];
      
      const selectors = [
        '.data-places-names, .data-place-name',
        '.data-places-latitudes, .data-place-latitude',
        '.data-places-longitudes, .data-place-longitude',
        '.data-places-slugs, .data-place-slug, .data-slug'
      ];
      
      const [names, lats, lngs, slugs] = selectors.map(sel => this.$(sel, document, false));
      
      if (!names.length) {
        resolve();
        return;
      }
      
      const minLength = Math.min(names.length, lats.length, lngs.length);
      
      for (let i = 0; i < minLength; i++) {
        const lat = parseFloat(lats[i]?.textContent);
        const lng = parseFloat(lngs[i]?.textContent);
        
        if (isNaN(lat) || isNaN(lng)) continue;
        
        this.state.locationData.features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [lng, lat] },
          properties: {
            name: names[i]?.textContent?.trim(),
            id: `location-${i}`,
            popupIndex: i,
            slug: slugs[i]?.textContent?.trim() || '',
            index: i,
            type: 'locality'
          }
        });
      }
      
      // Store backup for reset functionality
      this.state.allLocalityFeatures = [...this.state.locationData.features];
      resolve();
    });
  }

  // Layer management with registry
  hasLayer(layerId) {
    return this.state.cache.layers.has(layerId) && this.map.getLayer(layerId);
  }

  hasSource(sourceId) {
    return this.state.cache.sources.has(sourceId) && this.map.getSource(sourceId);
  }

  addSource(sourceId, sourceOptions) {
    if (this.hasSource(sourceId)) {
      this.map.removeSource(sourceId);
    }
    this.map.addSource(sourceId, sourceOptions);
    this.state.cache.sources.add(sourceId);
  }

  addLayer(layerOptions, beforeLayer = null) {
    const layerId = layerOptions.id;
    if (this.hasLayer(layerId)) {
      this.map.removeLayer(layerId);
    }
    this.map.addLayer(layerOptions, beforeLayer);
    this.state.cache.layers.add(layerId);
  }

  // Optimized locality markers with native clustering
  addLocalityMarkers() {
    if (!this.state.locationData.features.length) return;
    
    // Add source with clustering
    this.addSource('localities-source', {
      type: 'geojson',
      data: this.state.locationData,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50
    });
    
    // Cluster layer
    this.addLayer({
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
        'text-halo-color': this.CONSTANTS.COLORS.locality,
        'text-halo-width': 2
      }
    });
    
    // Individual points layer
    this.addLayer({
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
        'text-halo-color': this.CONSTANTS.COLORS.locality,
        'text-halo-width': 2,
        'text-opacity': [
          'interpolate', ['linear'], ['zoom'],
          this.isMobile ? 7.5 : 8.5, 0,
          this.isMobile ? 8.5 : 9.5, 1
        ]
      }
    });
    
    this.setupLocalityInteractions();
  }

  // Optimized district markers
  addDistrictMarkers() {
    if (!this.state.allDistrictFeatures.length) return;
    
    console.log(`Adding ${this.state.allDistrictFeatures.length} district markers`);
    
    this.addSource('districts-source', {
      type: 'geojson',
      data: {
        type: "FeatureCollection",
        features: this.state.allDistrictFeatures
      }
    });
    
    this.addLayer({
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
        'text-halo-color': this.CONSTANTS.COLORS.district,
        'text-halo-width': 2,
        'text-opacity': [
          'interpolate', ['linear'], ['zoom'],
          5, 0, 6, 1
        ]
      }
    });
    
    this.setupDistrictInteractions();
  }

  // Event-driven interaction setup
  setupLocalityInteractions() {
    // Locality point clicks
    this.map.on('click', 'locality-points', (e) => {
      this.handleLocalityClick(e.features[0]);
    });
    
    // Cluster clicks
    this.map.on('click', 'locality-clusters', (e) => {
      this.handleClusterClick(e.features[0]);
    });
    
    // Cursor changes
    ['locality-clusters', 'locality-points'].forEach(layer => {
      this.map.on('mouseenter', layer, () => {
        this.map.getCanvas().style.cursor = 'pointer';
      });
      this.map.on('mouseleave', layer, () => {
        this.map.getCanvas().style.cursor = '';
      });
    });
  }

  setupDistrictInteractions() {
    this.map.on('click', 'district-points', (e) => {
      this.handleDistrictClick(e.features[0]);
    });
    
    this.map.on('mouseenter', 'district-points', () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });
    
    this.map.on('mouseleave', 'district-points', () => {
      this.map.getCanvas().style.cursor = '';
    });
  }

  // Optimized click handlers with debouncing
  handleLocalityClick(feature) {
    const locality = feature.properties.name;
    const currentTime = Date.now();
    const markerKey = `locality-${locality}`;
    
    // Prevent rapid clicks
    if (this.state.interactions.lastClickedMarker === markerKey && 
        currentTime - this.state.interactions.lastClickTime < 1000) {
      return;
    }
    
    this.setInteractionLock(markerKey, currentTime);
    this.removeBoundaryHighlight();
    this.selectLocalityCheckbox(locality);
    this.showFilteredElements();
    this.toggleSidebar('Left', true);
    
    this.debounce(() => this.clearInteractionLock(), 1500, 'interaction-lock');
  }

  handleDistrictClick(feature) {
    const districtName = feature.properties.name;
    const districtSource = feature.properties.source;
    const currentTime = Date.now();
    const markerKey = `district-${districtName}`;
    
    if (this.state.interactions.lastClickedMarker === markerKey && 
        currentTime - this.state.interactions.lastClickTime < 1000) {
      return;
    }
    
    this.setInteractionLock(markerKey, currentTime);
    this.selectDistrictCheckbox(districtName);
    this.showFilteredElements();
    this.toggleSidebar('Left', true);
    
    if (districtSource === 'boundary') {
      this.handleBoundaryDistrict(districtName);
    } else {
      this.handleTagDistrict(districtName);
    }
    
    this.debounce(() => this.clearInteractionLock(), 1500, 'interaction-lock');
  }

  handleClusterClick(feature) {
    this.removeBoundaryHighlight();
    this.map.flyTo({
      center: feature.geometry.coordinates,
      zoom: this.map.getZoom() + this.CONSTANTS.ZOOM.clusterIncrease,
      duration: 800
    });
  }

  setInteractionLock(markerKey, currentTime) {
    this.state.interactions.markerInteractionLock = true;
    this.state.interactions.lastClickedMarker = markerKey;
    this.state.interactions.lastClickTime = currentTime;
    window.isMarkerClick = true;
  }

  clearInteractionLock() {
    this.state.interactions.markerInteractionLock = false;
    window.isMarkerClick = false;
  }

  // Boundary highlighting with performance optimization
  highlightBoundary(districtName) {
    this.removeBoundaryHighlight();
    
    const baseId = districtName.toLowerCase().replace(/\s+/g, '-');
    const fillId = `${baseId}-fill`;
    const borderId = `${baseId}-border`;
    
    if (this.hasLayer(fillId) && this.hasLayer(borderId)) {
      const color = this.CONSTANTS.COLORS.highlight;
      this.map.setPaintProperty(fillId, 'fill-color', color);
      this.map.setPaintProperty(fillId, 'fill-opacity', 0.25);
      this.map.setPaintProperty(borderId, 'line-color', color);
      this.map.setPaintProperty(borderId, 'line-opacity', 0.6);
      
      this.state.highlightedBoundary = districtName;
      console.log(`Highlighted boundary: ${districtName}`);
    }
  }

  removeBoundaryHighlight() {
    if (!this.state.highlightedBoundary) return;
    
    const baseId = this.state.highlightedBoundary.toLowerCase().replace(/\s+/g, '-');
    const fillId = `${baseId}-fill`;
    const borderId = `${baseId}-border`;
    
    if (this.hasLayer(fillId) && this.hasLayer(borderId)) {
      this.map.setPaintProperty(fillId, 'fill-color', '#1a1b1e');
      this.map.setPaintProperty(fillId, 'fill-opacity', 0.15);
      this.map.setPaintProperty(borderId, 'line-color', '#888888');
      this.map.setPaintProperty(borderId, 'line-opacity', 0.4);
    }
    
    this.state.highlightedBoundary = null;
  }

  // Optimized filtering system
  checkMapMarkersFiltering() {
    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    if (Array.from(urlParams.keys()).some(key => 
      key.startsWith('mapmarkers_') || key.includes('mapmarkers') || 
      key === 'district' || key === 'locality')) {
      return true;
    }
    
    // Check Finsweet filtering
    if (window.fsAttributes?.cmsfilter) {
      const filterInstance = window.fsAttributes.cmsfilter.getByInstance('mapmarkers');
      if (filterInstance?.filtersData && Object.keys(filterInstance.filtersData).length > 0) {
        return true;
      }
    }
    
    // Check filtered elements
    const filteredLat = this.$('.data-places-latitudes-filter');
    const allLat = this.$('.data-places-latitudes, .data-place-latitude');
    return filteredLat.length > 0 && filteredLat.length < allLat.length;
  }

  applyFilterToMarkers() {
    if (this.state.flags.isInitialLoad && !this.checkMapMarkersFiltering()) return;
    
    const filteredLat = this.$('.data-places-latitudes-filter');
    const filteredLon = this.$('.data-places-longitudes-filter');
    const allLat = this.$('.data-places-latitudes, .data-place-latitude');
    
    let visibleCoordinates = [];
    
    if (filteredLat.length && filteredLon.length && filteredLat.length < allLat.length) {
      // Extract filtered coordinates for reframing
      for (let i = 0; i < Math.min(filteredLat.length, filteredLon.length); i++) {
        const lat = parseFloat(filteredLat[i]?.textContent?.trim());
        const lon = parseFloat(filteredLon[i]?.textContent?.trim());
        
        if (!isNaN(lat) && !isNaN(lon)) {
          visibleCoordinates.push([lon, lat]);
        }
      }
      
      // Keep ALL markers visible - only use coordinates for reframing
      if (this.hasSource('localities-source')) {
        this.map.getSource('localities-source').setData({
          type: "FeatureCollection",
          features: this.state.allLocalityFeatures
        });
      }
    } else {
      // No filtering - use all coordinates
      visibleCoordinates = this.state.allLocalityFeatures.map(f => f.geometry.coordinates);
    }
    
    this.reframeMap(visibleCoordinates);
  }

  reframeMap(coordinates) {
    const duration = this.state.flags.isInitialLoad ? 600 : this.CONSTANTS.TIMING.animation;
    
    if (coordinates.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      coordinates.forEach(coord => bounds.extend(coord));
      
      this.map.fitBounds(bounds, {
        padding: {
          top: window.innerHeight * 0.15,
          bottom: window.innerHeight * 0.15,
          left: window.innerWidth * 0.15,
          right: window.innerWidth * 0.15
        },
        maxZoom: 13,
        duration,
        essential: true
      });
    } else if (!this.state.flags.isInitialLoad || !this.checkMapMarkersFiltering()) {
      this.map.flyTo({
        center: [35.22, 31.85],
        zoom: this.isMobile ? this.CONSTANTS.ZOOM.mobile : this.CONSTANTS.ZOOM.desktop,
        duration,
        essential: true
      });
    }
  }

  // Optimized checkbox selection
  selectLocalityCheckbox(localityName) {
    this.clearAllCheckboxes();
    this.selectCheckbox('locality', localityName);
  }

  selectDistrictCheckbox(districtName) {
    this.clearAllCheckboxes();
    this.selectCheckbox('district', districtName);
  }

  clearAllCheckboxes() {
    const allCheckboxes = this.$('[checkbox-filter] input[fs-list-value]');
    allCheckboxes.forEach(checkbox => {
      if (checkbox.checked) {
        checkbox.checked = false;
        this.triggerEvents(checkbox, ['change', 'input']);
        this.triggerFormEvents(checkbox);
      }
    });
  }

  selectCheckbox(type, value) {
    const checkbox = this.$(`[checkbox-filter="${type}"] input[fs-list-value="${value}"]`)[0];
    if (checkbox) {
      checkbox.checked = true;
      this.triggerEvents(checkbox, ['change', 'input']);
      this.triggerFormEvents(checkbox);
    }
  }

  triggerFormEvents(checkbox) {
    const form = checkbox.closest('form');
    if (form) {
      form.dispatchEvent(new Event('change', { bubbles: true }));
      form.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // Parallel data loading with proper error handling
  async loadAreaOverlays() {
    const areas = [
      { name: 'Area A', url: 'https://raw.githubusercontent.com/btselem/map-data/master/s10/area_a.geojson', color: '#98b074' },
      { name: 'Area B', url: 'https://raw.githubusercontent.com/btselem/map-data/master/s10/area_b.geojson', color: '#a84b4b' },
      { name: 'Area C', url: 'https://raw.githubusercontent.com/btselem/map-data/master/s10/area_c.geojson', color: '#e99797' }
    ];

    const loadPromises = areas.map(area => this.loadSingleArea(area));
    
    try {
      await Promise.allSettled(loadPromises);
      console.log('Area overlays loading completed');
    } catch (error) {
      console.error('Error loading area overlays:', error);
    }
  }

  async loadSingleArea(area) {
    try {
      const response = await fetch(area.url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const geojsonData = await response.json();
      const sourceId = `area-${area.name.toLowerCase().replace(/\s+/g, '-')}-source`;
      const layerId = `area-${area.name.toLowerCase().replace(/\s+/g, '-')}-layer`;
      
      this.addSource(sourceId, {
        type: 'geojson',
        data: geojsonData
      });
      
      this.addLayer({
        id: layerId,
        type: 'fill',
        source: sourceId,
        layout: { 'visibility': 'visible' },
        paint: {
          'fill-color': area.color,
          'fill-opacity': 0.5,
          'fill-outline-color': area.color
        }
      }, this.hasLayer('locality-clusters') ? 'locality-clusters' : undefined);
      
      console.log(`${area.name} loaded successfully`);
    } catch (error) {
      console.error(`Error loading ${area.name}:`, error);
    }
  }

  async loadDistrictBoundaries() {
    const districts = [
      'Jerusalem', 'Hebron', 'Tulkarm', 'Tubas', 'Salfit', 'Ramallah',
      'Nablus', 'Jericho', 'Jenin', 'Bethlehem', 'Qalqilya'
    ];

    const customDistricts = [
      { name: 'East Jerusalem', url: 'https://raw.githubusercontent.com/btselem/map-data/master/s0/east_jerusalem.json' },
      { name: 'Deir Al-Balah', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Deir%20Al-Balah.geojson' },
      { name: 'Rafah', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Rafah.geojson' },
      { name: 'North Gaza', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/North%20Gaza.geojson' },
      { name: 'Khan Younis', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Khan%20Younis.geojson' },
      { name: 'Gaza', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Gaza.geojson' }
    ];

    // Reset district features
    this.state.allDistrictFeatures = [];

    // Parallel loading
    const boundaryPromises = [
      ...districts.map(name => this.loadSingleBoundary(name)),
      ...customDistricts.map(district => this.loadSingleBoundary(district.name, district.url))
    ];

    try {
      await Promise.allSettled(boundaryPromises);
      this.addDistrictMarkers();
      this.state.flags.boundariesLoaded = true;
      console.log('District boundaries loading completed');
    } catch (error) {
      console.error('Error loading district boundaries:', error);
    }
  }

  async loadSingleBoundary(name, customUrl = null) {
    try {
      const url = customUrl || `https://raw.githubusercontent.com/Tovlim/COTO/main/${name}.geojson`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const geojsonData = await response.json();
      
      const baseId = name.toLowerCase().replace(/\s+/g, '-');
      const sourceId = `${baseId}-boundary`;
      const fillId = `${baseId}-fill`;
      const borderId = `${baseId}-border`;
      
      this.addSource(sourceId, {
        type: 'geojson',
        data: geojsonData
      });
      
      // Add fill layer
      this.addLayer({
        id: fillId,
        type: 'fill',
        source: sourceId,
        layout: { 'visibility': 'visible' },
        paint: {
          'fill-color': '#1a1b1e',
          'fill-opacity': 0.15
        }
      }, this.hasLayer('locality-clusters') ? 'locality-clusters' : undefined);
      
      // Add border layer
      this.addLayer({
        id: borderId,
        type: 'line',
        source: sourceId,
        layout: { 'visibility': 'visible' },
        paint: {
          'line-color': '#888888',
          'line-width': 1,
          'line-opacity': 0.4
        }
      }, this.hasLayer('locality-clusters') ? 'locality-clusters' : undefined);
      
      // Add district marker
      if (geojsonData.features?.length > 0) {
        const centroid = this.calculateCentroid(geojsonData.features[0].geometry.coordinates);
        this.state.allDistrictFeatures.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: centroid },
          properties: {
            name: name,
            id: `district-${baseId}`,
            type: 'district',
            source: 'boundary'
          }
        });
      }
      
      console.log(`${name} boundary loaded successfully`);
    } catch (error) {
      console.error(`Error loading ${name} boundary:`, error);
    }
  }

  async loadDistrictTags() {
    if (this.state.flags.districtTagsLoaded) return;
    
    const collection = this.$1('#district-tag-collection');
    if (!collection) return;
    
    const tagItems = this.$('#district-tag-item', collection);
    
    // Clear existing tag-based features
    this.state.allDistrictFeatures = this.state.allDistrictFeatures.filter(f => f.properties.source !== 'tag');
    
    tagItems.forEach((tagItem, index) => {
      if (getComputedStyle(tagItem).display === 'none') return;
      
      const name = tagItem.getAttribute('district-tag-name');
      const lat = parseFloat(tagItem.getAttribute('district-tag-lattitude'));
      const lng = parseFloat(tagItem.getAttribute('district-tag-longitude'));
      
      if (!name || isNaN(lat) || isNaN(lng)) return;
      
      this.state.allDistrictFeatures.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: {
          name: name,
          id: `district-tag-${name.toLowerCase().replace(/\s+/g, '-')}`,
          type: 'district',
          source: 'tag'
        }
      });
    });
    
    this.state.flags.districtTagsLoaded = true;
    this.addDistrictMarkers();
    console.log(`District tags loaded. Total features: ${this.state.allDistrictFeatures.length}`);
  }

  // Optimized sidebar management
  async setupSidebars() {
    const sidebars = ['Left', 'Right'];
    const setupPromises = sidebars.map(side => this.setupSidebar(side));
    
    try {
      await Promise.all(setupPromises);
      this.setupInitialMargins();
      await this.setupEventHandlers();
    } catch (error) {
      console.error('Error setting up sidebars:', error);
    }
  }

  async setupSidebar(side) {
    return new Promise((resolve) => {
      const attemptSetup = (attempt = 1) => {
        const sidebar = this.$1(`#${side}Sidebar`);
        const tab = this.$1(`#${side}SideTab`);
        const close = this.$1(`#${side}SidebarClose`);
        
        if (!sidebar || !tab || !close) {
          if (attempt < 5) {
            setTimeout(() => attemptSetup(attempt + 1), [100, 300, 500, 1000][attempt - 1]);
            return;
          } else {
            resolve(false);
            return;
          }
        }
        
        this.configureSidebarElement(sidebar, tab, close, side);
        resolve(true);
      };
      
      attemptSetup();
    });
  }

  configureSidebarElement(sidebar, tab, close, side) {
    // Style configuration
    const zIndex = 1000 + (side === 'Left' ? 1 : 2);
    this.setStyles(sidebar, {
      transition: `margin-${side.toLowerCase()} 0.25s cubic-bezier(0.4, 0, 0.2, 1)`,
      zIndex: zIndex.toString(),
      position: 'relative'
    });
    
    this.setStyles(tab, {
      transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
    });
    
    // Event handlers with cleanup tracking
    if (!tab.dataset.setupComplete) {
      const tabHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleSidebar(side);
      };
      
      tab.addEventListener('click', tabHandler);
      this.cleanupTasks.add(() => tab.removeEventListener('click', tabHandler));
      tab.dataset.setupComplete = 'true';
    }
    
    if (!close.dataset.setupComplete) {
      const closeHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleSidebar(side, false);
      };
      
      close.addEventListener('click', closeHandler);
      this.cleanupTasks.add(() => close.removeEventListener('click', closeHandler));
      close.dataset.setupComplete = 'true';
    }
  }

  toggleSidebar(side, show = null) {
    const sidebar = this.$1(`#${side}Sidebar`);
    if (!sidebar) return;
    
    const isShowing = show !== null ? show : !sidebar.classList.contains('is-show');
    sidebar.classList.toggle('is-show', isShowing);
    
    const currentWidth = parseInt(getComputedStyle(sidebar).width) || 300;
    const marginProp = `margin${side}`;
    
    if (window.innerWidth > 478) {
      this.setStyles(sidebar, {
        [marginProp]: isShowing ? '0' : `-${currentWidth + 1}px`,
        pointerEvents: isShowing ? 'auto' : ''
      });
    } else {
      this.setStyles(sidebar, {
        [marginProp]: isShowing ? '0' : '',
        pointerEvents: isShowing ? 'auto' : ''
      });
      
      if (isShowing) {
        const oppositeSide = side === 'Left' ? 'Right' : 'Left';
        this.toggleSidebar(oppositeSide, false);
      }
    }
    
    const arrowIcon = this.$1(`[arrow-icon="${side.toLowerCase()}"]`);
    if (arrowIcon) {
      this.setStyles(arrowIcon, {
        transform: isShowing ? 'rotateY(180deg)' : 'rotateY(0deg)'
      });
    }
  }

  setupInitialMargins() {
    if (window.innerWidth <= 478) return;
    
    ['Left', 'Right'].forEach(side => {
      const sidebar = this.$1(`#${side}Sidebar`);
      if (sidebar && !sidebar.classList.contains('is-show')) {
        const currentWidth = parseInt(getComputedStyle(sidebar).width) || 300;
        this.setStyles(sidebar, {
          [`margin${side}`]: `-${currentWidth + 1}px`
        });
      }
    });
  }

  // Optimized event handling with delegation
  async setupEventHandlers() {
    // Use event delegation for better performance
    document.addEventListener('change', this.handleGlobalChange.bind(this));
    document.addEventListener('click', this.handleGlobalClick.bind(this));
    
    // Finsweet events
    ['fs-cmsfilter-filtered', 'fs-cmsfilter-pagination-page-changed'].forEach(event => {
      document.addEventListener(event, this.handleFilterUpdate.bind(this));
    });
    
    // Map events
    this.map.on('moveend', this.handleMapMove.bind(this));
    this.map.on('zoomend', this.handleMapMove.bind(this));
    
    // Firefox form handling
    if (navigator.userAgent.toLowerCase().includes('firefox')) {
      this.setupFirefoxForms();
    }
    
    // Setup area controls when ready
    this.debounce(() => this.setupAreaControls(), 2000, 'area-controls');
  }

  handleGlobalChange(e) {
    const target = e.target;
    
    // Auto-sidebar functionality
    if (target.matches('[data-auto-sidebar="true"]') && window.innerWidth > 478) {
      this.debounce(() => this.toggleSidebar('Left', true), 100, 'auto-sidebar');
    }
    
    // Filter updates
    if (target.matches('select, [fs-cmsfilter-element="select"], [fs-cmsfilter-element="filters"] input, [fs-cmsfilter-element="filters"] select')) {
      this.debounce(() => this.handleFilterUpdate(), this.CONSTANTS.TIMING.debounce, 'filter-update');
    }
    
    // Sidebar controls
    if (target.matches('.OpenLeftSidebar, [OpenLeftSidebar], [openleftsidebar]') && 
        (target.type === 'radio' || target.type === 'checkbox') && target.checked) {
      this.toggleSidebar('Left');
    }
  }

  handleGlobalClick(e) {
    const target = e.target;
    
    // Map filter buttons
    if (target.matches('[apply-map-filter="true"], #refreshDiv, #refresh-on-enter, .filterrefresh, #filter-button')) {
      if (window.isMarkerClick) return;
      
      e.preventDefault();
      this.debounce(() => {
        this.applyFilterToMarkers();
      }, 100, 'map-filter');
    }
    
    // Clear all button
    if (target.matches('#AllEvents')) {
      e.preventDefault();
      this.$1('#ClearAll')?.click();
    }
    
    // Sidebar controls
    if (target.matches('[open-right-sidebar]')) {
      const action = target.getAttribute('open-right-sidebar');
      if (action === 'open-only') {
        this.toggleSidebar('Right', true);
      } else {
        this.toggleSidebar('Right');
      }
      
      const groupName = target.getAttribute('open-tab');
      if (groupName) {
        this.debounce(() => {
          this.$1(`[opened-tab="${groupName}"]`)?.click();
        }, 50, 'tab-switch');
      }
    }
    
    // Link handling
    if (target.matches('a:not(.filterrefresh):not([fs-cmsfilter-element])') && 
        !target.closest('[fs-cmsfilter-element]') && 
        !target.matches('.w-pagination-next, .w-pagination-previous')) {
      window.isLinkClick = true;
      this.debounce(() => { window.isLinkClick = false; }, 500, 'link-click');
    }
  }

  handleFilterUpdate() {
    if (window.isLinkClick || window.isMarkerClick || this.state.interactions.markerInteractionLock) {
      return;
    }
    
    this.debounce(() => {
      this.applyFilterToMarkers();
    }, this.CONSTANTS.TIMING.debounce, 'filter-update');
  }

  handleMapMove() {
    // Cleanup any pending timers
    this.debounce(() => {
      // Future: Add any zoom-based logic here
    }, 10, 'map-move');
  }

  setupFirefoxForms() {
    const forms = this.$('form');
    forms.forEach(form => {
      const hasFilterElements = form.querySelector('[fs-cmsfilter-element]') !== null;
      const mapEl = this.$1('#map');
      const isNearMap = mapEl && (form.contains(mapEl) || mapEl.contains(form) || 
                                  form.parentElement === mapEl.parentElement);
      
      if (hasFilterElements || isNearMap) {
        const handler = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.debounce(() => this.applyFilterToMarkers(), 100, 'firefox-form');
          return false;
        };
        
        form.addEventListener('submit', handler, true);
        this.cleanupTasks.add(() => form.removeEventListener('submit', handler, true));
      }
    });
  }

  // Area controls with preserved external functionality
  async setupAreaControls() {
    if (this.state.flags.areaControlsSetup) return;
    
    const areaControls = [
      { keyId: 'area-a-key', layerId: 'area-a-layer', wrapId: 'area-a-key-wrap' },
      { keyId: 'area-b-key', layerId: 'area-b-layer', wrapId: 'area-b-key-wrap' },
      { keyId: 'area-c-key', layerId: 'area-c-layer', wrapId: 'area-c-key-wrap' }
    ];
    
    let setupCount = 0;
    
    areaControls.forEach(control => {
      const checkbox = this.$1(`#${control.keyId}`);
      const wrapper = this.$1(`#${control.wrapId}`);
      
      if (!checkbox || !this.hasLayer(control.layerId)) return;
      
      // Set initial state
      checkbox.checked = false;
      
      // Add our event listener without removing existing ones
      if (!checkbox.dataset.mapboxListenerAdded) {
        const changeHandler = () => {
          if (!this.hasLayer(control.layerId)) return;
          
          const visibility = checkbox.checked ? 'none' : 'visible';
          this.map.setLayoutProperty(control.layerId, 'visibility', visibility);
        };
        
        checkbox.addEventListener('change', changeHandler);
        checkbox.dataset.mapboxListenerAdded = 'true';
        this.cleanupTasks.add(() => checkbox.removeEventListener('change', changeHandler));
      }
      
      // Hover effects
      if (wrapper && !wrapper.dataset.mapboxHoverAdded) {
        const mouseEnterHandler = () => {
          if (this.hasLayer(control.layerId)) {
            this.map.setPaintProperty(control.layerId, 'fill-opacity', 0.8);
          }
        };
        
        const mouseLeaveHandler = () => {
          if (this.hasLayer(control.layerId)) {
            this.map.setPaintProperty(control.layerId, 'fill-opacity', 0.5);
          }
        };
        
        wrapper.addEventListener('mouseenter', mouseEnterHandler);
        wrapper.addEventListener('mouseleave', mouseLeaveHandler);
        wrapper.dataset.mapboxHoverAdded = 'true';
        
        this.cleanupTasks.add(() => {
          wrapper.removeEventListener('mouseenter', mouseEnterHandler);
          wrapper.removeEventListener('mouseleave', mouseLeaveHandler);
        });
      }
      
      setupCount++;
    });
    
    if (setupCount === areaControls.length) {
      this.state.flags.areaControlsSetup = true;
      console.log('Area controls setup completed');
    }
  }

  // District interaction handlers
  handleBoundaryDistrict(districtName) {
    console.log(`District ${districtName} has boundary, highlighting and reframing`);
    
    this.highlightBoundary(districtName);
    
    const boundarySourceId = `${districtName.toLowerCase().replace(/\s+/g, '-')}-boundary`;
    const source = this.map.getSource(boundarySourceId);
    
    if (source?._data) {
      const bounds = new mapboxgl.LngLatBounds();
      const addCoords = (coords) => {
        if (Array.isArray(coords) && coords.length > 0) {
          if (typeof coords[0] === 'number') {
            bounds.extend(coords);
          } else {
            coords.forEach(addCoords);
          }
        }
      };
      
      source._data.features.forEach(feature => addCoords(feature.geometry.coordinates));
      this.map.fitBounds(bounds, { padding: 50, duration: 1000, essential: true });
    } else {
      console.log(`Boundary source ${boundarySourceId} not found, falling back to dropdown`);
      this.removeBoundaryHighlight();
      this.handleTagDistrict(districtName);
    }
  }

  handleTagDistrict(districtName) {
    console.log(`District ${districtName} using dropdown selection`);
    
    this.removeBoundaryHighlight();
    this.selectDistrictInDropdown(districtName);
    
    this.debounce(() => {
      this.applyFilterToMarkers();
    }, 200, 'tag-district');
  }

  selectDistrictInDropdown(districtName) {
    const selectField = this.$1('#select-field-5');
    if (!selectField) return;
    
    selectField.value = districtName;
    this.triggerEvents(selectField, ['change', 'input']);
    this.triggerFormEvents(selectField);
  }

  showFilteredElements() {
    const elements = this.$('[show-when-filtered="true"]');
    elements.forEach(element => {
      this.setStyles(element, {
        display: 'block',
        visibility: 'visible',
        opacity: '1',
        pointerEvents: 'auto'
      });
    });
  }

  // Cleanup and memory management
  destroy() {
    // Clear all timers
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    
    // Run cleanup tasks
    this.cleanupTasks.forEach(task => {
      try {
        task();
      } catch (error) {
        console.error('Cleanup task error:', error);
      }
    });
    this.cleanupTasks.clear();
    
    // Clear caches
    this.state.cache.elements.clear();
    this.state.cache.layers.clear();
    this.state.cache.sources.clear();
    
    // Remove map
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    
    console.log('MapboxController destroyed and cleaned up');
  }
}

// Initialize when DOM is ready
class MapInitializer {
  constructor() {
    this.controller = null;
    this.initPromise = null;
    this.init();
  }

  async init() {
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = new Promise((resolve) => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.startInitialization().then(resolve));
      } else {
        this.startInitialization().then(resolve);
      }
    });
    
    return this.initPromise;
  }

  async startInitialization() {
    try {
      // Show loading screen immediately
      this.showLoadingScreen();
      
      // Wait for Mapbox to be available
      await this.waitForMapbox();
      
      // Initialize controller
      this.controller = new MapboxController();
      
      // Setup window event handlers
      this.setupWindowEvents();
      
      console.log('Map initialization completed');
      return this.controller;
      
    } catch (error) {
      console.error('Map initialization failed:', error);
      this.hideLoadingScreen();
      throw error;
    }
  }

  showLoadingScreen() {
    const loadingScreen = document.getElementById('loading-map-screen');
    if (loadingScreen) {
      loadingScreen.style.display = 'flex';
    }
  }

  hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-map-screen');
    if (loadingScreen) {
      loadingScreen.style.display = 'none';
    }
  }

  async waitForMapbox() {
    return new Promise((resolve, reject) => {
      if (typeof mapboxgl !== 'undefined') {
        resolve();
        return;
      }
      
      let attempts = 0;
      const maxAttempts = 50;
      
      const checkMapbox = () => {
        attempts++;
        if (typeof mapboxgl !== 'undefined') {
          resolve();
        } else if (attempts >= maxAttempts) {
          reject(new Error('Mapbox GL JS failed to load'));
        } else {
          setTimeout(checkMapbox, 100);
        }
      };
      
      checkMapbox();
    });
  }

  setupWindowEvents() {
    // Global error handling
    window.addEventListener('error', (error) => {
      console.error('Global error:', error);
    });
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      if (this.controller) {
        this.controller.destroy();
      }
    });
    
    // Handle resize
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (this.controller?.map) {
          this.controller.map.resize();
        }
      }, 250);
    });
  }
}

// Global initialization
const mapInitializer = new MapInitializer();

// Export for external access if needed
window.MapboxController = MapboxController;
window.mapController = null;

mapInitializer.init().then(controller => {
  window.mapController = controller;
}).catch(error => {
  console.error('Failed to initialize map:', error);
});

// Global window flags for compatibility
window.isLinkClick = false;
window.isMarkerClick = false;
