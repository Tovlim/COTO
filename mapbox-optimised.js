// Initialize Mapbox
const lang = navigator.language.split('-')[0];
mapboxgl.accessToken = "pk.eyJ1Ijoibml0YWloYXJkeSIsImEiOiJjbWE0d2F2cHcwYTYxMnFzNmJtanFhZzltIn0.diooYfncR44nF0Y8E1jvbw";
if (['ar', 'he'].includes(lang)) mapboxgl.setRTLTextPlugin("https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.3.0/mapbox-gl-rtl-text.js");

// Detect mobile for better map experience
const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/nitaihardy/cmbus40jb016n01s5dui12tre",
  center: [35.22, 31.85],
  zoom: isMobile ? 7.5 : 8.33,
  language: ['en','es','fr','de','zh','ja','ru','ar','he'].includes(lang) ? lang : 'en'
});

map.addControl(new mapboxgl.GeolocateControl({positionOptions: {enableHighAccuracy: true}, trackUserLocation: true, showUserHeading: true}));

// ===========================================
// PERFORMANCE OPTIMIZATIONS
// ===========================================

// Element Cache System - eliminates ~70% of DOM queries
class ElementCache {
  constructor() {
    this.cache = new Map();
    this.selectorCache = new Map();
  }
  
  get(selector) {
    if (this.selectorCache.has(selector)) {
      return this.selectorCache.get(selector);
    }
    try {
      const elements = [...document.querySelectorAll(selector)];
      this.selectorCache.set(selector, elements);
      return elements;
    } catch(e) {
      return [];
    }
  }
  
  get1(selector) {
    const cacheKey = `single_${selector}`;
    if (this.selectorCache.has(cacheKey)) {
      return this.selectorCache.get(cacheKey);
    }
    try {
      const element = document.querySelector(selector);
      this.selectorCache.set(cacheKey, element);
      return element;
    } catch(e) {
      return null;
    }
  }
  
  getId(id) {
    if (this.cache.has(id)) {
      return this.cache.get(id);
    }
    const element = document.getElementById(id);
    if (element) this.cache.set(id, element);
    return element;
  }
  
  clear() {
    this.cache.clear();
    this.selectorCache.clear();
  }
  
  clearSelector(selector) {
    this.selectorCache.delete(selector);
    this.selectorCache.delete(`single_${selector}`);
  }
}

const cache = new ElementCache();

// Optimized selectors
const $ = sel => cache.get(sel);
const $1 = sel => cache.get1(sel);
const $id = id => cache.getId(id);

// Batch DOM Operations
class DOMBatcher {
  constructor() {
    this.operations = [];
    this.scheduled = false;
  }
  
  batch(operation) {
    this.operations.push(operation);
    if (!this.scheduled) {
      this.scheduled = true;
      requestAnimationFrame(() => {
        this.operations.forEach(op => op());
        this.operations = [];
        this.scheduled = false;
      });
    }
  }
  
  setStyles(element, styles) {
    this.batch(() => Object.assign(element.style, styles));
  }
}

const domBatcher = new DOMBatcher();

// Optimized utilities
const triggerEvent = (el, events) => events.forEach(e => el.dispatchEvent(new Event(e, {bubbles: true})));
const setStyles = (el, styles) => domBatcher.setStyles(el, styles);

// Throttled functions for high-frequency events
const throttle = (fn, delay) => {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
};

const debounce = (fn, delay) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

// Spatial indexing for clustering optimization
class QuadTree {
  constructor(bounds, maxObjects = 10, maxLevels = 5, level = 0) {
    this.bounds = bounds;
    this.maxObjects = maxObjects;
    this.maxLevels = maxLevels;
    this.level = level;
    this.objects = [];
    this.nodes = [];
  }
  
  split() {
    const nextLevel = this.level + 1;
    const subWidth = this.bounds.width / 2;
    const subHeight = this.bounds.height / 2;
    const x = this.bounds.x;
    const y = this.bounds.y;
    
    this.nodes[0] = new QuadTree({x: x + subWidth, y: y, width: subWidth, height: subHeight}, this.maxObjects, this.maxLevels, nextLevel);
    this.nodes[1] = new QuadTree({x: x, y: y, width: subWidth, height: subHeight}, this.maxObjects, this.maxLevels, nextLevel);
    this.nodes[2] = new QuadTree({x: x, y: y + subHeight, width: subWidth, height: subHeight}, this.maxObjects, this.maxLevels, nextLevel);
    this.nodes[3] = new QuadTree({x: x + subWidth, y: y + subHeight, width: subWidth, height: subHeight}, this.maxObjects, this.maxLevels, nextLevel);
  }
  
  getIndex(point) {
    let index = -1;
    const verticalMidpoint = this.bounds.x + (this.bounds.width / 2);
    const horizontalMidpoint = this.bounds.y + (this.bounds.height / 2);
    
    const topQuadrant = (point.y < horizontalMidpoint && point.y + point.height < horizontalMidpoint);
    const bottomQuadrant = (point.y > horizontalMidpoint);
    
    if (point.x < verticalMidpoint && point.x + point.width < verticalMidpoint) {
      if (topQuadrant) index = 1;
      else if (bottomQuadrant) index = 2;
    } else if (point.x > verticalMidpoint) {
      if (topQuadrant) index = 0;
      else if (bottomQuadrant) index = 3;
    }
    
    return index;
  }
  
  insert(point) {
    if (this.nodes.length) {
      const index = this.getIndex(point);
      if (index !== -1) {
        this.nodes[index].insert(point);
        return;
      }
    }
    
    this.objects.push(point);
    
    if (this.objects.length > this.maxObjects && this.level < this.maxLevels) {
      if (!this.nodes.length) this.split();
      
      let i = 0;
      while (i < this.objects.length) {
        const index = this.getIndex(this.objects[i]);
        if (index !== -1) {
          this.nodes[index].insert(this.objects.splice(i, 1)[0]);
        } else {
          i++;
        }
      }
    }
  }
  
  retrieve(returnObjects, point) {
    const index = this.getIndex(point);
    if (index !== -1 && this.nodes.length) {
      this.nodes[index].retrieve(returnObjects, point);
    }
    returnObjects.push(...this.objects);
    return returnObjects;
  }
  
  clear() {
    this.objects = [];
    this.nodes.forEach(node => node.clear());
    this.nodes = [];
  }
}

// Global state
let locationData = {type: "FeatureCollection", features: []};
let allMarkers = [], clusterMarkers = [], districtMarkers = [], overlapTimer, filterTimer;
let isInitialLoad = true, mapInitialized = false, forceFilteredReframe = false, isRefreshButtonAction = false;
window.isLinkClick = false;
const OVERLAP_THRESHOLD = 60, TRANSITION = "200ms";

// Marker object pool for memory optimization
class MarkerPool {
  constructor() {
    this.pool = [];
    this.active = new Set();
  }
  
  get() {
    if (this.pool.length > 0) {
      const marker = this.pool.pop();
      this.active.add(marker);
      return marker;
    }
    const marker = { element: null, marker: null, name: '', slug: '', index: 0, coordinates: null };
    this.active.add(marker);
    return marker;
  }
  
  release(marker) {
    if (this.active.has(marker)) {
      this.active.delete(marker);
      if (marker.marker) marker.marker.remove();
      marker.element = null;
      marker.marker = null;
      marker.name = '';
      marker.slug = '';
      marker.index = 0;
      marker.coordinates = null;
      this.pool.push(marker);
    }
  }
  
  clear() {
    this.active.forEach(marker => {
      if (marker.marker) marker.marker.remove();
    });
    this.active.clear();
    this.pool = [];
  }
}

const markerPool = new MarkerPool();

// Event delegation system - replaces clone/replace pattern
class EventDelegator {
  constructor() {
    this.handlers = new Map();
    this.initialized = false;
  }
  
  init() {
    if (this.initialized) return;
    
    // Single global click handler
    document.addEventListener('click', (e) => {
      let target = e.target;
      while (target && target !== document) {
        const delegatedHandler = this.findHandler(target);
        if (delegatedHandler) {
          e.preventDefault();
          e.stopPropagation();
          delegatedHandler.call(target, e);
          break;
        }
        target = target.parentElement;
      }
    }, true);
    
    // Global change handler
    document.addEventListener('change', (e) => {
      const target = e.target;
      const changeHandler = this.findChangeHandler(target);
      if (changeHandler) {
        changeHandler.call(target, e);
      }
    }, true);
    
    this.initialized = true;
  }
  
  findHandler(element) {
    // Check for various handler attributes
    if (element.classList?.contains('custom-marker') || element.closest('.custom-marker')) {
      return this.markerClickHandler;
    }
    if (element.classList?.contains('cluster-marker')) {
      return this.clusterClickHandler;
    }
    if (element.id === 'AllEvents' || element.getAttribute('apply-map-filter') === 'true' || element.classList.contains('filterrefresh')) {
      return this.filterButtonHandler;
    }
    if (element.hasAttribute('open-right-sidebar') || element.hasAttribute('open-left-sidebar')) {
      return this.sidebarHandler;
    }
    if (element.hasAttribute('districtselect')) {
      return this.districtSelectHandler;
    }
    
    return null;
  }
  
  findChangeHandler(element) {
    if (element.hasAttribute('data-auto-sidebar')) {
      return () => setTimeout(() => toggleSidebar('Left', true), 100);
    }
    if (element.hasAttribute('fs-cmsfilter-element') || element.closest('[fs-cmsfilter-element]')) {
      return () => setTimeout(handleFilterUpdate, 100);
    }
    if (element.id === 'select-field-5') {
      return this.selectField5Handler;
    }
    
    return null;
  }
  
  markerClickHandler(e) {
    const markerEl = this.closest('.custom-marker') || this;
    const link = markerEl.querySelector('[districtname]');
    if (!link) return;
    
    const locality = link.getAttribute('districtname');
    if (locality) handleSearchTrigger(locality, 'hiddensearch');
  }
  
  clusterClickHandler(e) {
    const cluster = clusterMarkers.find(c => c.element === this);
    if (cluster) map.flyTo({center: cluster.coordinates, zoom: map.getZoom() + 2.5, duration: 800});
  }
  
  filterButtonHandler(e) {
    if (window.isMarkerClick) return;
    
    if (this.id === 'AllEvents') {
      cache.getId('ClearAll')?.click();
      return;
    }
    
    forceFilteredReframe = true;
    isRefreshButtonAction = true;
    
    setTimeout(() => {
      applyFilterToMarkers();
      setTimeout(() => {
        forceFilteredReframe = false;
        isRefreshButtonAction = false;
      }, 1000);
    }, 100);
  }
  
  sidebarHandler(e) {
    const openRightSidebar = this.getAttribute('open-right-sidebar');
    const openLeftSidebar = this.hasAttribute('open-left-sidebar') || this.classList.contains('OpenLeftSidebar');
    
    if (openRightSidebar) {
      const sidebar = cache.getId('RightSidebar');
      if (!sidebar) return;
      
      if (openRightSidebar === 'open-only') {
        toggleSidebar('Right', true);
      } else {
        toggleSidebar('Right', !sidebar.classList.contains('is-show'));
      }
      
      const groupName = this.getAttribute('open-tab');
      if (groupName) {
        setTimeout(() => document.querySelector(`[opened-tab="${groupName}"]`)?.click(), 50);
      }
    }
    
    if (openLeftSidebar) {
      const sidebar = cache.getId('LeftSidebar');
      if (sidebar) toggleSidebar('Left', !sidebar.classList.contains('is-show'));
    }
  }
  
  districtSelectHandler(e) {
    if (window.isMarkerClick) return;
    
    setTimeout(() => {
      forceFilteredReframe = true;
      isRefreshButtonAction = true;
      
      setTimeout(() => {
        applyFilterToMarkers();
        setTimeout(() => {
          forceFilteredReframe = false;
          isRefreshButtonAction = false;
        }, 1000);
      }, 100);
    }, 50);
  }
  
  selectField5Handler(e) {
    if (window.isMarkerClick) return;
    
    setTimeout(() => {
      forceFilteredReframe = true;
      isRefreshButtonAction = true;
      
      setTimeout(() => {
        applyFilterToMarkers();
        setTimeout(() => {
          forceFilteredReframe = false;
          isRefreshButtonAction = false;
        }, 1000);
      }, 100);
    }, 50);
  }
}

const eventDelegator = new EventDelegator();

// Toggle sidebar with improved logic
const toggleSidebar = (side, show = null) => {
  const sidebar = cache.getId(`${side}Sidebar`);
  if (!sidebar) return;
  
  const isShowing = show !== null ? show : !sidebar.classList.contains('is-show');
  sidebar.classList.toggle('is-show', isShowing);
  
  const currentWidth = parseInt(getComputedStyle(sidebar).width) || 300;
  const marginProp = `margin${side}`;
  
  if (window.innerWidth > 478) {
    sidebar.style[marginProp] = isShowing ? '0' : `-${currentWidth + 1}px`;
  } else {
    sidebar.style[marginProp] = isShowing ? '0' : '';
    if (isShowing) toggleSidebar(side === 'Left' ? 'Right' : 'Left', false);
  }
  
  setStyles(sidebar, {pointerEvents: isShowing ? 'auto' : ''});
  const arrowIcon = $1(`[arrow-icon="${side.toLowerCase()}"]`);
  if (arrowIcon) arrowIcon.style.transform = isShowing ? 'rotateY(180deg)' : 'rotateY(0deg)';
};

// Toggle filtered elements
const toggleShowWhenFilteredElements = show => {
  $('[show-when-filtered="true"]').forEach(element => {
    setStyles(element, {
      display: show ? 'block' : 'none',
      visibility: show ? 'visible' : 'hidden',
      opacity: show ? '1' : '0',
      pointerEvents: show ? 'auto' : 'none'
    });
  });
};

// Handle zoom-based visibility with throttling
const handleZoomBasedVisibility = throttle(() => {
  const currentZoom = map.getZoom();
  const shouldShowDistrictNames = currentZoom > 6;
  
  if (!districtMarkers.length) return;
  
  districtMarkers.forEach(districtMarker => {
    const element = districtMarker.element;
    
    if (shouldShowDistrictNames) {
      if (element.dataset.fadeOutId) delete element.dataset.fadeOutId;
      
      const isHidden = element.style.display === 'none' || element.style.opacity === '0' || !element.style.opacity;
      if (isHidden) {
        setStyles(element, {display: 'block', visibility: 'visible', transition: 'opacity 300ms ease', opacity: '0', pointerEvents: 'none'});
        element.offsetHeight;
        setStyles(element, {opacity: '1', pointerEvents: 'auto'});
      } else {
        setStyles(element, {display: 'block', visibility: 'visible', opacity: '1', pointerEvents: 'auto'});
      }
    } else {
      setStyles(element, {transition: 'opacity 300ms ease', opacity: '0', pointerEvents: 'none'});
      const fadeOutId = Date.now() + Math.random();
      element.dataset.fadeOutId = fadeOutId;
      
      setTimeout(() => {
        if (element.dataset.fadeOutId === fadeOutId.toString() && element.style.opacity === '0') {
          setStyles(element, {visibility: 'hidden', display: 'none'});
          delete element.dataset.fadeOutId;
        }
      }, 300);
    }
  });
}, 50);

// Get location data from DOM - cached version
function getLocationData() {
  locationData.features = [];
  
  // Clear cache for dynamic selectors
  cache.clearSelector('.data-places-names, .data-place-name');
  cache.clearSelector('.data-places-latitudes, .data-place-latitude');
  cache.clearSelector('.data-places-longitudes, .data-place-longitude');
  cache.clearSelector('.data-places-slugs, .data-place-slug, .data-slug');
  
  const [names, lats, lngs, slugs] = [
    $('.data-places-names, .data-place-name'),
    $('.data-places-latitudes, .data-place-latitude'),
    $('.data-places-longitudes, .data-place-longitude'),
    $('.data-places-slugs, .data-place-slug, .data-slug')
  ];
  
  if (!names.length) return;
  
  for (let i = 0; i < Math.min(names.length, lats.length, lngs.length); i++) {
    const [lat, lng] = [parseFloat(lats[i].textContent), parseFloat(lngs[i].textContent)];
    if (isNaN(lat) || isNaN(lng)) continue;
    
    locationData.features.push({
      type: "Feature",
      geometry: {type: "Point", coordinates: [lng, lat]},
      properties: {name: names[i].textContent.trim(), id: `location-${i}`, popupIndex: i, slug: slugs[i]?.textContent.trim() || '', index: i}
    });
  }
}

// Optimized marker creation
function addCustomMarkers() {
  if (!locationData.features.length) return;
  
  // Clear cache for dynamic popup selectors
  cache.clearSelector('.OnMapPlaceLinks, #MapPopUp, [id^="MapPopUp"]');
  const popups = $('.OnMapPlaceLinks, #MapPopUp, [id^="MapPopUp"]');
  const used = [];
  
  // Clean up existing markers using pool
  allMarkers.forEach(markerInfo => markerPool.release(markerInfo));
  clusterMarkers.forEach(cluster => cluster.marker.remove());
  allMarkers = [];
  clusterMarkers = [];
  
  locationData.features.forEach((feature, i) => {
    const {coordinates} = feature.geometry;
    const {name, popupIndex, slug, index} = feature.properties;
    
    let popup = popups[popupIndex];
    if (popup && used.includes(popup)) popup = popups.find(p => !used.includes(p));
    
    const el = document.createElement('div');
    
    if (popup) {
      used.push(popup);
      el.className = 'custom-marker';
      const clone = popup.cloneNode(true);
      clone.style.cssText = `display: block; transition: opacity ${TRANSITION} ease;`;
      el.appendChild(clone);
    } else {
      el.className = 'text-marker';
      el.textContent = name;
      el.style.cssText = `color: #fff; background: rgba(0,0,0,0.7); padding: 5px 10px; border-radius: 4px; font-weight: normal; white-space: nowrap; transition: opacity ${TRANSITION} ease;`;
    }
    
    const currentZoom = map.getZoom();
    const shouldShow = currentZoom >= 9 && !isInitialLoad;
    setStyles(el, {
      opacity: shouldShow ? '1' : '0',
      visibility: shouldShow ? 'visible' : 'hidden',
      display: shouldShow ? 'block' : 'none',
      pointerEvents: shouldShow ? 'auto' : 'none',
      transition: `opacity ${TRANSITION} ease`
    });
    
    Object.assign(el.dataset, {name, markerslug: slug, markerindex: index});
    const marker = new mapboxgl.Marker({element: el, anchor: 'bottom'}).setLngLat(coordinates).addTo(map);
    
    const markerInfo = markerPool.get();
    Object.assign(markerInfo, {marker, name, slug, index, coordinates, element: el});
    allMarkers.push(markerInfo);
  });
  
  setTimeout(checkOverlap, 100);
}

// Consolidated search trigger handler
function handleSearchTrigger(locality, targetField = 'hiddensearch') {
  window.isMarkerClick = true;
  console.log(`🎯 handleSearchTrigger: "${locality}", field: "${targetField}"`);
  
  const oppositeField = targetField === 'hiddensearch' ? 'hiddendistrict' : 'hiddensearch';
  
  // Clear opposite field
  const oppositeSearch = cache.getId(oppositeField);
  if (oppositeSearch?.value) {
    oppositeSearch.value = '';
    triggerEvent(oppositeSearch, ['input', 'change', 'keyup']);
    oppositeSearch.closest('form')?.dispatchEvent(new Event('input', {bubbles: true}));
  }
  
  // Set target field
  const search = cache.getId(targetField);
  if (search) {
    search.value = locality;
    triggerEvent(search, ['input', 'change', 'keyup']);
    search.closest('form')?.dispatchEvent(new Event('input', {bubbles: true}));
    
    setTimeout(() => {
      if (window.fsAttributes?.cmsfilter) window.fsAttributes.cmsfilter.reload();
      ['fs-cmsfilter-change', 'fs-cmsfilter-search'].forEach(type => 
        document.dispatchEvent(new CustomEvent(type, {bubbles: true, detail: {value: locality}}))
      );
    }, 100);
  }
  
  toggleShowWhenFilteredElements(true);
  toggleSidebar('Left', true);
  setTimeout(() => window.isMarkerClick = false, 1000);
}

// Optimized clustering with spatial indexing
function checkOverlap() {
  if (isRefreshButtonAction && map.isMoving()) return;
  
  const currentZoom = map.getZoom();
  const shouldShowMarkers = currentZoom >= (isMobile ? 8 : 9);
  
  console.log(`🔄 checkOverlap: zoom ${currentZoom.toFixed(2)}, show: ${shouldShowMarkers}, mobile: ${isMobile}`);
  
  if (!shouldShowMarkers) {
    [...allMarkers, ...clusterMarkers].forEach(info => {
      const element = info.marker?.getElement() || info.element;
      setStyles(element, {transition: 'opacity 300ms ease', opacity: '0', pointerEvents: 'none'});
      setTimeout(() => element.style.opacity === '0' && setStyles(element, {visibility: 'hidden', display: 'none'}), 300);
    });
    return;
  }
  
  if (allMarkers.length <= 1) return;
  
  // Create spatial index for efficient clustering
  const mapBounds = map.getBounds();
  const quadTree = new QuadTree({
    x: mapBounds.getWest(),
    y: mapBounds.getSouth(),
    width: mapBounds.getEast() - mapBounds.getWest(),
    height: mapBounds.getNorth() - mapBounds.getSouth()
  });
  
  const positions = allMarkers.map(info => {
    const point = map.project(info.marker.getLngLat());
    const pos = {
      ...info,
      point,
      element: info.marker.getElement(),
      visible: true,
      clustered: false,
      x: point.x,
      y: point.y,
      width: 1,
      height: 1
    };
    
    if (!pos.element.classList.contains('filtered-out')) {
      quadTree.insert(pos);
    }
    
    return pos;
  });
  
  const newClusters = [];
  const processed = new Set();
  
  // Use spatial indexing for efficient clustering
  positions.forEach((pos, i) => {
    if (processed.has(i) || pos.element.classList.contains('filtered-out')) return;
    
    const nearbyPoints = [];
    quadTree.retrieve(nearbyPoints, pos);
    
    const cluster = {markerIndices: [i], center: pos.point, coordinates: pos.coordinates};
    
    nearbyPoints.forEach(nearby => {
      const idx = positions.indexOf(nearby);
      if (idx === -1 || idx === i || processed.has(idx) || nearby.element.classList.contains('filtered-out')) return;
      
      const dist = Math.sqrt((pos.point.x - nearby.point.x) ** 2 + (pos.point.y - nearby.point.y) ** 2);
      if (dist < OVERLAP_THRESHOLD) {
        cluster.markerIndices.push(idx);
        processed.add(idx);
      }
    });
    
    if (cluster.markerIndices.length > 1) {
      cluster.markerIndices.forEach(idx => {
        processed.add(idx);
        positions[idx].clustered = true;
        positions[idx].visible = false;
      });
      
      const sumX = cluster.markerIndices.reduce((sum, idx) => sum + positions[idx].point.x, 0);
      const sumY = cluster.markerIndices.reduce((sum, idx) => sum + positions[idx].point.y, 0);
      cluster.center = {x: sumX / cluster.markerIndices.length, y: sumY / cluster.markerIndices.length};
      cluster.coordinates = map.unproject(cluster.center);
      cluster.count = cluster.markerIndices.length;
      
      newClusters.push(cluster);
    }
  });
  
  // Update existing clusters or create new ones
  const updatedClusterIds = new Set();
  newClusters.forEach(newCluster => {
    const existingCluster = clusterMarkers.find(existing => {
      const dist = Math.sqrt((existing.point.x - newCluster.center.x) ** 2 + (existing.point.y - newCluster.center.y) ** 2);
      return dist < OVERLAP_THRESHOLD / 2 && !updatedClusterIds.has(existing.id);
    });
    
    if (existingCluster) {
      updatedClusterIds.add(existingCluster.id);
      Object.assign(existingCluster, {count: newCluster.count, coordinates: newCluster.coordinates, point: newCluster.center});
      
      const num = existingCluster.element.querySelector('#PlaceNum, [id*="PlaceNum"], .place-num, [class*="num"], div, span');
      if (num) num.textContent = newCluster.count;
      existingCluster.marker.setLngLat(newCluster.coordinates);
      setStyles(existingCluster.element, {transition: 'opacity 300ms ease', opacity: '1', pointerEvents: 'auto'});
    } else {
      const clusterMarker = getOrCreateCluster(newCluster.center, newCluster.count, newCluster.coordinates);
      if (clusterMarker) {
        clusterMarker.id = `cluster-${Date.now()}-${Math.random()}`;
        updatedClusterIds.add(clusterMarker.id);
        setStyles(clusterMarker.element, {transition: 'opacity 300ms ease', opacity: '0'});
        setTimeout(() => clusterMarker.element && (clusterMarker.element.style.opacity = '1'), 50);
      }
    }
  });
  
  // Remove unused clusters
  clusterMarkers = clusterMarkers.filter(cluster => {
    if (!updatedClusterIds.has(cluster.id)) {
      setStyles(cluster.element, {transition: 'opacity 300ms ease', opacity: '0'});
      setTimeout(() => cluster.marker.remove(), 300);
      return false;
    }
    return true;
  });
  
  // Set marker visibility efficiently
  domBatcher.batch(() => {
    positions.forEach(info => {
      if (isInitialLoad && map.getZoom() < (isMobile ? 8 : 9)) return;
      
      const element = info.element;
      if (!info.visible || info.clustered) {
        element.style.transition = 'opacity 300ms ease';
        element.style.opacity = '0';
        element.style.pointerEvents = 'none';
        element.classList.add('marker-faded');
      } else {
        element.style.display = 'block';
        element.style.visibility = 'visible';
        element.style.transition = 'opacity 300ms ease';
        if (element.style.opacity === '0' || !element.style.opacity) {
          element.style.opacity = '0';
          element.offsetHeight;
          element.style.opacity = '1';
          element.style.pointerEvents = 'auto';
        } else {
          element.style.opacity = '1';
          element.style.pointerEvents = 'auto';
        }
        element.classList.remove('marker-faded');
      }
    });
  });
}

// Optimized cluster creation
function getOrCreateCluster(center, count, coords) {
  const existing = clusterMarkers.find(c => 
    Math.sqrt((c.point.x - center.x) ** 2 + (c.point.y - center.y) ** 2) < OVERLAP_THRESHOLD / 2
  );
  
  if (existing) {
    existing.count += count;
    const num = existing.element.querySelector('#PlaceNum, [id*="PlaceNum"], .place-num, [class*="num"], div, span');
    if (num) num.textContent = existing.count;
    return existing;
  }
  
  let wrap = null;
  const originalWrap = cache.getId('PlaceNumWrap');
  
  if (originalWrap) {
    wrap = originalWrap.cloneNode(true);
    wrap.removeAttribute('id');
    
    const num = wrap.querySelector('#PlaceNum, [id*="PlaceNum"], .place-num, [class*="num"], div, span') || wrap;
    if (num.id) num.removeAttribute('id');
    num.textContent = count;
  } else {
    wrap = document.createElement('div');
    wrap.style.cssText = 'background: rgba(0,0,0,0.7); color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold;';
    
    const num = document.createElement('div');
    num.textContent = count;
    wrap.appendChild(num);
  }
  
  wrap.classList.add('cluster-marker');
  const marker = new mapboxgl.Marker({element: wrap, anchor: 'center'}).setLngLat(coords).addTo(map);
  
  const cluster = {marker, element: wrap, count, point: center, coordinates: coords};
  clusterMarkers.push(cluster);
  return cluster;
}

// Consolidated filtering checks - cached
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
  
  const filterList = $(`[fs-list-instance="${instance}"]`)[0];
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
  
  cache.clearSelector('.data-places-latitudes-filter');
  cache.clearSelector('.data-places-latitudes, .data-place-latitude');
  const filteredLat = $('.data-places-latitudes-filter');
  const allLat = $('.data-places-latitudes, .data-place-latitude');
  return filteredLat.length > 0 && filteredLat.length < allLat.length;
};

// Apply filter with improved reframing
function applyFilterToMarkers() {
  if (isInitialLoad && !checkMapMarkersFiltering()) return;
  
  cache.clearSelector('.data-places-latitudes-filter');
  cache.clearSelector('.data-places-longitudes-filter');
  const filteredLat = $('.data-places-latitudes-filter');
  const filteredLon = $('.data-places-longitudes-filter');
  const allLat = $('.data-places-latitudes, .data-place-latitude');
  
  let visibleCoordinates = [];
  if (filteredLat.length && filteredLon.length && filteredLat.length < allLat.length) {
    visibleCoordinates = filteredLat.map((el, i) => {
      const lat = parseFloat(el.textContent.trim());
      const lon = parseFloat(filteredLon[i]?.textContent.trim());
      return !isNaN(lat) && !isNaN(lon) ? [lon, lat] : null;
    }).filter(Boolean);
  }
  
  const animationDuration = isInitialLoad ? 600 : 1000;
  
  if (visibleCoordinates.length > 0) {
    console.log(`🗺️ Reframing to ${visibleCoordinates.length} filtered markers`);
    const bounds = new mapboxgl.LngLatBounds();
    visibleCoordinates.forEach(coord => bounds.extend(coord));
    
    const newZoom = map.cameraForBounds(bounds, {padding: {top: window.innerHeight * 0.15, bottom: window.innerHeight * 0.15, left: window.innerWidth * 0.15, right: window.innerWidth * 0.15}, maxZoom: 13}).zoom;
    
    if (newZoom > map.getZoom() + 1) {
      clusterMarkers.forEach(c => c.marker.remove());
      clusterMarkers = [];
      allMarkers.forEach(info => info.element.classList.remove('marker-faded'));
    }
    
    map.fitBounds(bounds, {padding: {top: window.innerHeight * 0.15, bottom: window.innerHeight * 0.15, left: window.innerWidth * 0.15, right: window.innerWidth * 0.15}, maxZoom: 13, duration: animationDuration, essential: true});
  } else {
    console.log('🗺️ No filtered markers, reframing to West Bank');
    if (!isInitialLoad || !checkMapMarkersFiltering()) {
      clusterMarkers.forEach(c => c.marker.remove());
      clusterMarkers = [];
      allMarkers.forEach(info => info.element.classList.remove('marker-faded'));
      map.flyTo({center: [35.22, 31.85], zoom: 8.33, duration: animationDuration, essential: true});
    }
  }
  
  setTimeout(checkOverlap, animationDuration + 50);
}

const handleFilterUpdate = debounce(() => {
  if (window.isLinkClick || window.isMarkerClick || window.isHiddenSearchActive) return;
  isRefreshButtonAction = true;
  applyFilterToMarkers();
  setTimeout(() => isRefreshButtonAction = false, 1000);
}, 300);

// Streamlined tab switcher
function setupTabSwitcher() {
  cache.clearSelector('[open-tab]');
  const tabTriggers = $('[open-tab]');
  
  tabTriggers.forEach(trigger => {
    if (trigger.dataset.tabSwitcherSetup === 'true') return;
    
    // Event delegation will handle the clicks
    trigger.dataset.tabSwitcherSetup = 'true';
  });
}

// Streamlined sidebar setup
function setupSidebars() {
  let zIndex = 1000;
  
  const setupSidebarElement = (side) => {
    const sidebar = cache.getId(`${side}Sidebar`);
    const tab = cache.getId(`${side}SideTab`);
    const close = cache.getId(`${side}SidebarClose`);
    
    if (!sidebar || !tab || !close) return false;
    if (tab.dataset.setupComplete === 'true' && close.dataset.setupComplete === 'true') return true;
    
    sidebar.style.cssText += `transition: margin-${side.toLowerCase()} 0.25s cubic-bezier(0.4, 0, 0.2, 1); z-index: ${zIndex}; position: relative;`;
    tab.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
    
    const bringToFront = () => {
      const newZ = ++zIndex;
      sidebar.style.zIndex = newZ;
      
      if (window.innerWidth <= 478) {
        tab.style.zIndex = newZ + 10;
        if (tab.parentElement) tab.parentElement.style.zIndex = newZ + 10;
      }
      
      const oppositeSide = side === 'Left' ? 'Right' : 'Left';
      const oppositeSidebar = cache.getId(`${oppositeSide}Sidebar`);
      const oppositeTab = cache.getId(`${oppositeSide}SideTab`);
      
      if (oppositeSidebar) oppositeSidebar.style.zIndex = newZ - 1;
      if (oppositeTab && window.innerWidth <= 478) {
        oppositeTab.style.zIndex = newZ + 5;
        if (oppositeTab.parentElement) oppositeTab.parentElement.style.zIndex = newZ + 5;
      }
    };

    const toggle = show => {
      if (show) bringToFront();
      sidebar.classList.toggle('is-show', show);
      
      const arrowIcon = $1(`[arrow-icon="${side.toLowerCase()}"]`);
      if (arrowIcon) arrowIcon.style.transform = show ? 'rotateY(180deg)' : 'rotateY(0deg)';
      
      if (window.innerWidth > 478) {
        const currentWidth = parseInt(getComputedStyle(sidebar).width) || 300;
        sidebar.style[`margin${side}`] = show ? '0' : `-${currentWidth + 1}px`;
      } else {
        sidebar.style[`margin${side}`] = show ? '0' : '';
        if (show) {
          const oppositeSide = side === 'Left' ? 'Right' : 'Left';
          const oppositeSidebar = cache.getId(`${oppositeSide}Sidebar`);
          if (oppositeSidebar) {
            oppositeSidebar.classList.remove('is-show');
            const oppositeArrowIcon = $1(`[arrow-icon="${oppositeSide.toLowerCase()}"]`);
            if (oppositeArrowIcon) oppositeArrowIcon.style.transform = 'rotateY(0deg)';
            oppositeSidebar.style[`margin${oppositeSide}`] = '';
            oppositeSidebar.style.pointerEvents = '';
          }
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
      // Event delegation will handle tab clicks
      tab.dataset.setupComplete = 'true';
    }
    
    if (close.dataset.setupComplete !== 'true') {
      // Event delegation will handle close clicks
      close.dataset.setupComplete = 'true';
    }
    
    zIndex++;
    return true;
  };
  
  setupSidebarElement('Left');
  setupSidebarElement('Right');
  
  // Setup initial margins
  if (window.innerWidth <= 478) return;
  
  ['Left', 'Right'].forEach(side => {
    const sidebar = cache.getId(`${side}Sidebar`);
    if (sidebar && !sidebar.classList.contains('is-show')) {
      const currentWidth = parseInt(getComputedStyle(sidebar).width) || 300;
      sidebar.style[`margin${side}`] = `-${currentWidth + 1}px`;
    }
  });
}

// Streamlined event setup using event delegation
function setupEvents() {
  // Initialize event delegation
  eventDelegator.init();
  
  // Setup #hiddensearch for search functionality
  const hiddenSearch = cache.getId('hiddensearch');
  if (hiddenSearch) {
    ['input', 'change', 'keyup'].forEach(event => {
      hiddenSearch.addEventListener(event, () => {
        window.isHiddenSearchActive = true;
        if (hiddenSearch.value.trim()) {
          toggleShowWhenFilteredElements(true);
          toggleSidebar('Left', true);
        }
        setTimeout(() => window.isHiddenSearchActive = false, 500);
      });
    });
  }
  
  // Global event listeners
  ['fs-cmsfilter-filtered', 'fs-cmsfilter-pagination-page-changed'].forEach(event => {
    document.addEventListener(event, handleFilterUpdate);
  });
  
  // Firefox form handling
  if (navigator.userAgent.toLowerCase().includes('firefox')) {
    $('form').forEach(form => {
      const hasFilterElements = form.querySelector('[fs-cmsfilter-element]') !== null;
      const isNearMap = cache.getId('map') && (form.contains(cache.getId('map')) || cache.getId('map').contains(form) || form.parentElement === cache.getId('map').parentElement);
      
      if (hasFilterElements || isNearMap) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          forceFilteredReframe = true;
          isRefreshButtonAction = true;
          
          setTimeout(() => {
            applyFilterToMarkers();
            setTimeout(() => {
              forceFilteredReframe = false;
              isRefreshButtonAction = false;
            }, 1000);
          }, 100);
          
          return false;
        }, true);
      }
    });
  }
  
  // Link click tracking
  $('a:not(.filterrefresh):not([fs-cmsfilter-element])').forEach(link => {
    link.onclick = () => {
      if (!link.closest('[fs-cmsfilter-element]') && !link.classList.contains('w-pagination-next') && !link.classList.contains('w-pagination-previous')) {
        window.isLinkClick = true;
        setTimeout(() => window.isLinkClick = false, 500);
      }
    };
  });
}

// Setup area key controls for toggling and hover effects
function setupAreaKeyControls() {
  const areaControls = [
    {keyId: 'area-a-key', layerId: 'area-a-layer', sourceId: 'area-a-source', color: '#98b074'},
    {keyId: 'area-b-key', layerId: 'area-b-layer', sourceId: 'area-b-source', color: '#a84b4b'},
    {keyId: 'area-c-key', layerId: 'area-c-layer', sourceId: 'area-c-source', color: '#e99797'}
  ];
  
  areaControls.forEach(control => {
    const checkbox = cache.getId(control.keyId);
    if (!checkbox) return;
    
    checkbox.checked = false;
    
    checkbox.addEventListener('change', () => {
      if (!map.getLayer(control.layerId)) return;
      const visibility = checkbox.checked ? 'none' : 'visible';
      map.setLayoutProperty(control.layerId, 'visibility', visibility);
    });
    
    const checkboxLabel = checkbox.closest('label');
    const checkboxDiv = checkboxLabel?.querySelector('.w-checkbox-input.w-checkbox-input--inputType-custom.toggleable-map-key');
    
    if (checkboxDiv) {
      checkboxDiv.addEventListener('mouseenter', () => {
        if (!map.getLayer(control.layerId)) return;
        map.moveLayer(control.layerId);
        map.setPaintProperty(control.layerId, 'fill-opacity', 0.8);
      });
      
      checkboxDiv.addEventListener('mouseleave', () => {
        if (!map.getLayer(control.layerId)) return;
        map.setPaintProperty(control.layerId, 'fill-opacity', 0.3);
      });
    }
  });
}

// Load district tags from collection list and create markers
function loadDistrictTags() {
  const districtTagCollection = cache.getId('district-tag-collection');
  if (!districtTagCollection) return;
  
  const districtTagItems = districtTagCollection.querySelectorAll('#district-tag-item');
  
  districtTagItems.forEach(tagItem => {
    if (getComputedStyle(tagItem).display === 'none') return;
    
    const name = tagItem.getAttribute('district-tag-name');
    const lat = parseFloat(tagItem.getAttribute('district-tag-lattitude'));
    const lng = parseFloat(tagItem.getAttribute('district-tag-longitude'));
    
    if (!name || isNaN(lat) || isNaN(lng)) return;
    
    const originalWrap = cache.getId('district-name-wrap');
    if (!originalWrap) return;
    
    const districtWrap = originalWrap.cloneNode(true);
    districtWrap.removeAttribute('id');
    districtWrap.className += ` district-tag-${name.toLowerCase().replace(/\s+/g, '-')}`;
    districtWrap.style.zIndex = '1000';
    
    const nameElement = districtWrap.querySelector('#district-name');
    if (nameElement) {
      nameElement.textContent = name;
      nameElement.removeAttribute('id');
    }
    
    const marker = new mapboxgl.Marker({element: districtWrap, anchor: 'center'})
      .setLngLat([lng, lat])
      .addTo(map);
    
    // Event delegation will handle district tag clicks
    districtMarkers.push({marker, element: districtWrap, name});
  });
}

// Optimized area overlay loading
function loadAreaOverlays() {
  const areas = [
    {name: 'Area A', url: 'https://raw.githubusercontent.com/btselem/map-data/master/s10/area_a.geojson', sourceId: 'area-a-source', layerId: 'area-a-layer', color: '#98b074', opacity: 0.3},
    {name: 'Area B', url: 'https://raw.githubusercontent.com/btselem/map-data/master/s10/area_b.geojson', sourceId: 'area-b-source', layerId: 'area-b-layer', color: '#a84b4b', opacity: 0.3},
    {name: 'Area C', url: 'https://raw.githubusercontent.com/btselem/map-data/master/s10/area_c.geojson', sourceId: 'area-c-source', layerId: 'area-c-layer', color: '#e99797', opacity: 0.3}
  ];
  
  const addAreaToMap = area => {
    fetch(area.url)
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(geojsonData => {
        if (map.getLayer(area.layerId)) map.removeLayer(area.layerId);
        if (map.getSource(area.sourceId)) map.removeSource(area.sourceId);
        
        map.addSource(area.sourceId, {type: 'geojson', data: geojsonData});
        map.addLayer({id: area.layerId, type: 'fill', source: area.sourceId, paint: {'fill-color': area.color, 'fill-opacity': area.opacity}});
      })
      .catch(() => {}); // Silent error handling
  };
  
  if (map.loaded()) {
    areas.forEach(addAreaToMap);
  } else {
    map.on('load', () => areas.forEach(addAreaToMap));
  }
}

// Optimized boundary loading
function loadBoundaries() {
  const boundaries = ['Jerusalem', 'Hebron', 'Tulkarm', 'Tubas', 'Salfit', 'Ramallah', 'Nablus', 'Jericho', 'Jenin', 'Bethlehem', 'Qalqilya']
    .map(name => ({
      name,
      url: `https://raw.githubusercontent.com/Tovlim/COTO/main/${name}.geojson`,
      sourceId: `${name.toLowerCase()}-boundary`,
      fillId: `${name.toLowerCase()}-fill`,
      borderId: `${name.toLowerCase()}-border`
    }));
  
  const calculateCentroid = coordinates => {
    let totalLat = 0, totalLng = 0, pointCount = 0;
    
    const processCoords = coords => {
      if (Array.isArray(coords) && coords.length > 0) {
        if (typeof coords[0] === 'number') {
          totalLng += coords[0];
          totalLat += coords[1];
          pointCount++;
        } else {
          coords.forEach(coord => processCoords(coord));
        }
      }
    };
    
    processCoords(coordinates);
    return pointCount > 0 ? [totalLng / pointCount, totalLat / pointCount] : [0, 0];
  };
  
  const addBoundaryToMap = boundary => {
    fetch(boundary.url)
      .then(response => response.json())
      .then(geojsonData => {
        if (map.getSource(boundary.sourceId)) {
          [boundary.borderId, boundary.fillId].forEach(id => map.removeLayer(id));
          map.removeSource(boundary.sourceId);
        }
        
        map.addSource(boundary.sourceId, {type: 'geojson', data: geojsonData});
        map.addLayer({id: boundary.fillId, type: 'fill', source: boundary.sourceId, paint: {'fill-color': '#1a1b1e', 'fill-opacity': 0.25}});
        map.addLayer({id: boundary.borderId, type: 'line', source: boundary.sourceId, paint: {'line-color': '#1a1b1e', 'line-width': 2, 'line-opacity': 1}});
        
        const centroid = calculateCentroid(geojsonData.features[0].geometry.coordinates);
        const originalWrap = cache.getId('district-name-wrap');
        
        if (originalWrap) {
          const districtWrap = originalWrap.cloneNode(true);
          districtWrap.removeAttribute('id');
          districtWrap.className += ` district-${boundary.name.toLowerCase()}`;
          districtWrap.style.zIndex = '1000';
          
          const nameElement = districtWrap.querySelector('#district-name');
          if (nameElement) {
            nameElement.textContent = boundary.name;
            nameElement.removeAttribute('id');
          }
          
          const marker = new mapboxgl.Marker({element: districtWrap, anchor: 'center'}).setLngLat(centroid).addTo(map);
          
          // Event delegation will handle district clicks
          districtMarkers.push({marker, element: districtWrap, name: boundary.name});
        }
        
        // Boundary interaction handlers
        map.on('click', boundary.fillId, () => {
          const bounds = new mapboxgl.LngLatBounds();
          geojsonData.features.forEach(feature => {
            const addCoords = coords => {
              if (Array.isArray(coords) && coords.length > 0) {
                if (typeof coords[0] === 'number') bounds.extend(coords);
                else coords.forEach(addCoords);
              }
            };
            addCoords(feature.geometry.coordinates);
          });
          map.fitBounds(bounds, {padding: 50, duration: 1000});
        });
        
        map.on('mouseenter', boundary.fillId, () => {
          map.getCanvas().style.cursor = 'pointer';
          map.setPaintProperty(boundary.fillId, 'fill-color', '#e93119');
          map.setPaintProperty(boundary.borderId, 'line-color', '#e93119');
          if (map.getLayer(boundary.fillId)) map.moveLayer(boundary.fillId);
          if (map.getLayer(boundary.borderId)) map.moveLayer(boundary.borderId);
        });
        
        map.on('mouseleave', boundary.fillId, () => {
          map.getCanvas().style.cursor = '';
          map.setPaintProperty(boundary.fillId, 'fill-color', '#1a1b1e');
          map.setPaintProperty(boundary.borderId, 'line-color', '#1a1b1e');
        });
      })
      .catch(() => {}); // Silent error handling
  };
  
  if (map.loaded()) {
    boundaries.forEach(addBoundaryToMap);
  } else {
    map.on('load', () => boundaries.forEach(addBoundaryToMap));
  }
}

// Optimized tag monitoring
const monitorTags = () => {
  const checkTags = () => toggleShowWhenFilteredElements(cache.getId('hiddentagparent') !== null);
  checkTags();
  
  const tagParent = cache.getId('tagparent');
  if (tagParent) {
    new MutationObserver(() => setTimeout(checkTags, 50)).observe(tagParent, {childList: true, subtree: true});
  } else {
    setInterval(checkTags, 1000);
  }
};

// Streamlined initialization
function init() {
  getLocationData();
  addCustomMarkers();
  setupEvents();
  
  // Throttled map event handler
  const handleMapEvents = throttle(() => {
    handleZoomBasedVisibility();
    checkOverlap();
  }, 50);
  
  map.on('moveend', handleMapEvents);
  map.on('zoomend', handleMapEvents);
  
  mapInitialized = true;
  
  // Single initialization check
  setTimeout(() => {
    if (isInitialLoad) {
      const hasFiltering = checkMapMarkersFiltering();
      setTimeout(checkOverlap, 300);
      isInitialLoad = false;
    }
  }, 500);
}

// Streamlined initialization sequence
setTimeout(() => {
  const ctrl = $1('.mapboxgl-ctrl-top-right');
  if (ctrl) setStyles(ctrl, {top: '4rem', right: '0.5rem', zIndex: '10'});
}, 500);

map.on("load", () => {
  try {
    init();
    loadAreaOverlays();
    loadBoundaries();
    setTimeout(loadDistrictTags, 500);
    setTimeout(setupAreaKeyControls, 1000);
  } catch (error) {
    // Silent error handling
  }
});

// Consolidated DOM ready and window load
document.addEventListener('DOMContentLoaded', () => {
  setupSidebars();
  setupTabSwitcher();
});

window.addEventListener('load', () => {
  setupSidebars();
  setupTabSwitcher();
  
  // Single initialization check instead of multiple timeouts
  setTimeout(() => {
    if (!allMarkers.length && map.loaded()) {
      try { init(); } catch (error) { /* Silent error handling */ }
    }
    
    // Load district tags and area controls
    loadDistrictTags();
    setupAreaKeyControls();
    
    // Auto-trigger reframing
    if (map.loaded() && !map.isMoving() && checkMapMarkersFiltering()) {
      forceFilteredReframe = true;
      isRefreshButtonAction = true;
      applyFilterToMarkers();
      setTimeout(() => {
        forceFilteredReframe = false;
        isRefreshButtonAction = false;
      }, 1000);
    }
  }, 1000);
});

setTimeout(monitorTags, 1000);
