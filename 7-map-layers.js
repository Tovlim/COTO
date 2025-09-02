/**
 * MAPBOX INTEGRATED SCRIPT - MAP LAYERS
 * Layer management, OptimizedMapLayers class, marker functions, region/boundary functions
 */

// ========================
// OPTIMIZED MAP LAYERS CLASS
// ========================
class OptimizedMapLayers {
  constructor(map) {
    this.map = map;
    this.layerOrder = [];
    this.sourceCache = new Map();
    this.layerCache = new Map();
    this.batchOperations = [];
    this.pendingBatch = false;
  }
  
  // Batch multiple operations for better performance
  addToBatch(operation) {
    this.batchOperations.push(operation);
    if (!this.pendingBatch) {
      this.pendingBatch = true;
      requestAnimationFrame(() => this.processBatch());
    }
  }
  
  processBatch() {
    this.batchOperations.forEach(operation => {
      try {
        operation();
      } catch (error) {
        // Silent error handling in production
      }
    });
    
    this.batchOperations = [];
    this.pendingBatch = false;
    
    // Optimize layer order once after batch
    this.optimizeLayerOrder();
  }
  
  // Optimized layer existence check with caching
  hasLayer(layerId) {
    if (this.layerCache.has(layerId)) {
      return this.layerCache.get(layerId);
    }
    
    const exists = !!this.map.getLayer(layerId);
    this.layerCache.set(layerId, exists);
    return exists;
  }
  
  hasSource(sourceId) {
    if (this.sourceCache.has(sourceId)) {
      return this.sourceCache.get(sourceId);
    }
    
    const exists = !!this.map.getSource(sourceId);
    this.sourceCache.set(sourceId, exists);
    return exists;
  }
  
  // Smart layer ordering - only reorder when necessary
  optimizeLayerOrder() {
    const markerLayers = ['settlement-clusters', 'settlement-points', 'locality-clusters', 'locality-points', 'region-points'];
    
    // Check if all expected layers exist first
    const existingLayers = markerLayers.filter(id => this.hasLayer(id));
    if (existingLayers.length === 0) return;
    
    const currentOrder = this.map.getStyle().layers.map(l => l.id);
    
    // Check if reordering is needed
    const markerIndices = existingLayers
      .map(id => currentOrder.indexOf(id));
      
    const needsReorder = markerIndices.some((index, i) => {
      return i > 0 && index < markerIndices[i - 1];
    });
    
    if (needsReorder) {
      existingLayers.forEach(layerId => {
        try {
          const layer = this.map.getStyle().layers.find(l => l.id === layerId);
          if (layer) {
            this.map.removeLayer(layerId);
            this.map.addLayer(layer);
            this.layerCache.delete(layerId); // Invalidate cache
          }
        } catch (e) {
          // Silent error handling in production
        }
      });
    }
  }
  
  // Clear caches when layers change significantly
  invalidateCache() {
    this.layerCache.clear();
    this.sourceCache.clear();
  }
}

// ========================
// MARKER FUNCTIONS
// ========================
// Add settlement markers to map
function addSettlementMarkersToMap() {
  if (!map || !state.settlementData) return;
  
  const getBeforeLayerId = () => {
    const beforeLayers = ['area-a-layer', 'area-b-layer', 'area-c-layer', 'firing-zones-layer'];
    return beforeLayers.find(layerId => mapLayers.hasLayer(layerId));
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
          'visibility': 'visible'
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#4a5a7c',
          'text-halo-width': 2,
          'text-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 0,
            9, 1
          ]
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
          'text-offset': [0, 0],
          'text-anchor': 'center',
          'visibility': 'visible'
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#2d1810',
          'text-halo-width': 2,
          'text-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 0,
            9, 1
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
        // console.error('[DEBUG] Error hiding base layers:', error);
      }
      
      mapLayers.invalidateCache();
    }
  });
  
  if (window.setupSettlementMarkerClicks) {
    window.setupSettlementMarkerClicks();
  }
}

// Add locality markers to map
function addLocalityMarkersToMap() {
  if (!map || !state.locationData) return;
  
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
          'text-ignore-placement': true,
          'visibility': 'visible' // Always visible, opacity handles fade
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#7e7800',
          'text-halo-width': 2,
          'text-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 0,
            9, 1
          ]
        }
      });
      
      // Add individual locality points layer
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
          'text-offset': [0, 0],
          'text-anchor': 'center',
          'visibility': 'visible'
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#2d1810',
          'text-halo-width': 2,
          'text-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 0,
            9, 1
          ]
        }
      });
      
      mapLayers.invalidateCache();
    }
  });
  
  if (window.setupLocalityMarkerClicks) {
    window.setupLocalityMarkerClicks();
  }
}

// Add territory markers
function addTerritoryMarkersToMap() {
  if (!window.territoryGeoJSON) return;
  
  mapLayers.addToBatch(() => {
    if (mapLayers.hasSource('territories-source')) {
      map.getSource('territories-source').setData(window.territoryGeoJSON);
    } else {
      // Add source
      map.addSource('territories-source', {
        type: 'geojson',
        data: window.territoryGeoJSON
      });
      
      // Add territory points layer - on top of everything
      map.addLayer({
        id: 'territory-points',
        type: 'symbol',
        source: 'territories-source',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            6, 14,  // Bigger than regions (12) at low zoom
            10, 18, // Bigger than regions (16) at mid zoom
            14, 20  // Bigger than regions (18) at high zoom
          ],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'text-offset': [0, 0],
          'text-anchor': 'center',
          'symbol-sort-key': 0, // Highest priority
          'visibility': 'visible'
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#2d1810',
          'text-halo-width': 3,
          'text-opacity': 1.0
        }
      });
      
      mapLayers.invalidateCache();
    }
  });
}

// Add native region markers
function addNativeRegionMarkers() {
  if (!state.allRegionFeatures || state.allRegionFeatures.length === 0) return;
  
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
          10, 16,
          14, 18
        ],
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-optional': true,
        'text-padding': 6,
        'text-offset': [0, 0],
        'text-anchor': 'center',
        'visibility': 'visible'
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#2d1810',
        'text-halo-width': 2,
        'text-opacity': 1.0
      }
    });
    
    mapLayers.invalidateCache();
  }
}

// Add subregion markers
function addSubregionMarkers() {
  if (!state.allSubregionFeatures || state.allSubregionFeatures.length === 0) return;
  
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
    
    map.addLayer({
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
        'text-halo-color': '#2d1810',
        'text-halo-width': 2,
        'text-opacity': 1.0
      }
    });
    
    mapLayers.invalidateCache();
  }
}

// ========================
// BOUNDARY AND REGION FUNCTIONS
// ========================
// Region boundary addition with batching
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
  
  // Add fill layer
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
  
  // Only add beforeId if the layer exists
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
  
  // Only add beforeId if the layer exists
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

// Area overlay addition with batching
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
  
  // Only add beforeId if the layer exists
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

// Frame region boundary function
function frameRegionBoundary(regionName) {
  const normalizedRegionName = regionName.toLowerCase().trim();
  const boundaryId = `${normalizedRegionName.replace(/\s+/g, '-')}-boundary`;
  
  if (!mapLayers.hasSource(boundaryId)) {
    return false;
  }
  
  try {
    const source = map.getSource(boundaryId);
    if (source && source._data && source._data.features && source._data.features.length > 0) {
      const feature = source._data.features[0];
      if (feature.geometry && feature.geometry.coordinates) {
        // Calculate bounds for the region
        const bounds = new mapboxgl.LngLatBounds();
        
        const addCoordinates = (coords) => {
          if (Array.isArray(coords) && coords.length > 0) {
            if (typeof coords[0] === 'number') {
              bounds.extend(coords);
            } else {
              coords.forEach(addCoordinates);
            }
          }
        };
        
        addCoordinates(feature.geometry.coordinates);
        
        // Frame the region with padding
        map.fitBounds(bounds, {
          padding: isMobile ? 40 : 80,
          duration: 1500,
          maxZoom: 11
        });
        
        return true;
      }
    }
  } catch (error) {
    console.error('Error framing region boundary:', error);
  }
  
  return false;
}

// ========================
// GLOBAL LAYER MANAGER INSTANCE
// ========================
// Global layer manager
const mapLayers = new OptimizedMapLayers(map);

// Make globally available
window.mapLayers = mapLayers;
window.OptimizedMapLayers = OptimizedMapLayers;
window.addSettlementMarkersToMap = addSettlementMarkersToMap;
window.addLocalityMarkersToMap = addLocalityMarkersToMap;
window.addTerritoryMarkersToMap = addTerritoryMarkersToMap;
window.addNativeRegionMarkers = addNativeRegionMarkers;
window.addSubregionMarkers = addSubregionMarkers;
window.addRegionBoundaryToMap = addRegionBoundaryToMap;
window.addAreaOverlayToMap = addAreaOverlayToMap;
window.frameRegionBoundary = frameRegionBoundary;